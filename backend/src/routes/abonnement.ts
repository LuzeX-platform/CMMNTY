import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { prisma } from "../db.js";
import { appUrl } from "../nieuwsbriefVersturen.js";
import { proPrijsId, stripeClient } from "../stripe.js";
import { requireLid } from "../plugins/requireAuth.js";

// Checkout en Billing Portal zijn allebei door Stripe gehost: we sturen de gebruiker naar een
// Stripe-URL en nooit zelf kaartgegevens aan. Dat is ook waarom de CSP (app.ts) geen frame-src
// of script-src voor Stripe nodig heeft — er draait hier geen Stripe.js, alleen een redirect.
// Zelfde opzet als RSLNT's routes/abonnement.ts, de functioneel dichtstbijzijnde bestaande
// Stripe-koppeling — aangepast aan CMMNTY's eigen `abonnement: "gratis"|"pro"` in plaats van
// RSLNT's `pro: Boolean`.
//
// De Pro-status zelf wordt NERGENS in /pro-checkout of /portaal gezet: dat gebeurt uitsluitend
// in de webhook hieronder, op basis van een door Stripe ondertekende gebeurtenis. Een
// checkout-redirect terug naar de app betekent dus nog niet per se dat de betaling al verwerkt
// is; de webhook loopt er vrijwel altijd voor, maar de account-pagina leest de sessie opnieuw
// in plaats van de betaling zelf te vertrouwen.
//
// Dit loopt volledig los van Kruisproduct-Pro (luzexKruisproduct.ts, kruisproductCron.ts): een
// échte Stripe-betaling zet `abonnementBron` altijd op null en raakt `kruisproductKvkNummer`
// nooit aan. Zo blijft de cron — die alleen rijen met een gezet kvk-nummer mag aanpassen —
// gegarandeerd van deze betaalde abonnees weg, ook als iemand ooit beide tegelijk zou gebruiken.

export async function abonnementRoutes(app: FastifyInstance) {
  app.post("/api/account/pro-checkout", { preHandler: requireLid }, async (request, reply) => {
    const stripe = stripeClient();
    if (!stripe) {
      return reply.code(503).send({ errorCode: "ABONNEMENT_NIET_BESCHIKBAAR", bericht: "Betalen is op dit moment niet beschikbaar." });
    }

    const gebruiker = await prisma.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    if (gebruiker.abonnement === "pro") {
      return { url: `${appUrl()}/dashboard/account.html` };
    }

    // Eén Stripe-klant per gebruiker, hergebruikt bij een tweede poging (bijv. na het
    // annuleren van de eerste checkout).
    let stripeKlantId = gebruiker.stripeKlantId;
    if (!stripeKlantId) {
      const klant = await stripe.customers.create({
        email: gebruiker.email,
        name: gebruiker.naam,
        metadata: { gebruikerId: gebruiker.id },
      });
      stripeKlantId = klant.id;
      await prisma.gebruiker.update({ where: { id: gebruiker.id }, data: { stripeKlantId } });
    }

    const sessie = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeKlantId,
      line_items: [{ price: proPrijsId(), quantity: 1 }],
      success_url: `${appUrl()}/dashboard/account.html?afgerekend=1`,
      cancel_url: `${appUrl()}/dashboard/account.html`,
      // Niet strikt nodig naast customer.metadata, maar zo hoeft de webhook niet op een
      // tussenliggende Stripe-lookup te vertrouwen om van customer naar gebruikerId te komen.
      subscription_data: { metadata: { gebruikerId: gebruiker.id } },
    });
    if (!sessie.url) {
      return reply.code(502).send({ errorCode: "ABONNEMENT_MISLUKT", bericht: "Kon geen betaalpagina openen. Probeer het opnieuw." });
    }
    return { url: sessie.url };
  });

  app.post("/api/account/pro-portaal", { preHandler: requireLid }, async (request, reply) => {
    const stripe = stripeClient();
    if (!stripe) {
      return reply.code(503).send({ errorCode: "ABONNEMENT_NIET_BESCHIKBAAR", bericht: "Abonnement beheren is op dit moment niet beschikbaar." });
    }
    const gebruiker = await prisma.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    if (!gebruiker.stripeKlantId) {
      return reply.code(404).send({ errorCode: "GEEN_ABONNEMENT", bericht: "Je hebt nog geen betaald abonnement om te beheren." });
    }
    const sessie = await stripe.billingPortal.sessions.create({
      customer: gebruiker.stripeKlantId,
      return_url: `${appUrl()}/dashboard/account.html`,
    });
    return { url: sessie.url };
  });

  // Geen requireLid: Stripe roept dit zelf aan, met een handtekening in plaats van onze
  // sessiecookie. De CSRF-Origin-check in app.ts raakt dit niet — die kijkt alleen naar een
  // Origin-header, en Stripe's server-naar-server-request stuurt er geen mee.
  app.post("/api/stripe/webhook", async (request, reply) => {
    const stripe = stripeClient();
    const geheim = process.env.STRIPE_WEBHOOK_GEHEIM;
    if (!stripe || !geheim) return reply.code(503).send({ errorCode: "ABONNEMENT_NIET_BESCHIKBAAR" });

    const handtekening = request.headers["stripe-signature"];
    if (typeof handtekening !== "string" || !request.rawBody) {
      return reply.code(400).send({ errorCode: "ONGELDIGE_HANDTEKENING" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, handtekening, geheim);
    } catch {
      return reply.code(400).send({ errorCode: "ONGELDIGE_HANDTEKENING" });
    }

    switch (event.type) {
      // Na een geslaagde checkout staat de subscription al op "active" (of "trialing"); we
      // hoeven hier dus niet apart op de eerste betaling te wachten.
      case "checkout.session.completed": {
        const sessie = event.data.object as Stripe.Checkout.Session;
        if (sessie.mode === "subscription" && typeof sessie.customer === "string" && typeof sessie.subscription === "string") {
          await prisma.gebruiker.updateMany({
            where: { stripeKlantId: sessie.customer },
            // abonnementBron op null: een echte betaling maakt Stripe leidend, niet
            // kruisproductCron.ts — die filtert toch alleen op kruisproductKvkNummer, maar zo
            // blijft abonnementBron ook informatief correct.
            data: { abonnement: "pro", abonnementBron: null, stripeAbonnementId: sessie.subscription },
          });
        }
        break;
      }
      // Dekt zowel een hernieuwing als een opzegging (status gaat naar canceled) als een
      // mislukte incasso (past_due/unpaid): de Pro-status volgt steeds de actuele Stripe-status.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const abonnement = event.data.object as Stripe.Subscription;
        if (typeof abonnement.customer === "string") {
          const actief = abonnement.status === "active" || abonnement.status === "trialing";
          await prisma.gebruiker.updateMany({
            where: { stripeKlantId: abonnement.customer },
            data: { abonnement: actief ? "pro" : "gratis", abonnementBron: null, stripeAbonnementId: actief ? abonnement.id : null },
          });
        }
        break;
      }
    }

    return { ontvangen: true };
  });
}
