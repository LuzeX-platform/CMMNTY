import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { leestijdMinuten, maakSlug, publicatieVolgorde, renderMarkdown } from "../artikelen.js";
import { requireAdmin } from "../plugins/requireAuth.js";
import { mailStatus, verstuurMail } from "../mailer.js";
import { wisselProUitnodigingIn } from "../proUitnodiging.js";
import { stripeClient } from "../stripe.js";
import {
  appUrl,
  artikelenVoorNieuwsbrief,
  leesFrequentie,
  verstuurNieuwsbrief,
  voorbeeldHtml,
} from "../nieuwsbriefVersturen.js";
import { bouwTekst, onderwerp, type Frequentie } from "../nieuwsbrief.js";

const COVER_MAX_BYTES = 2 * 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

// cover: undefined = ongewijzigd laten, null = verwijderen, data-URL = nieuwe afbeelding.
const artikelSchema = z.object({
  titel: z.string().trim().min(1, "Titel is verplicht").max(200),
  slug: z.string().trim().max(80).optional(),
  samenvatting: z.string().trim().min(1, "Samenvatting is verplicht").max(400),
  inhoud: z.string().min(1, "Inhoud is verplicht").max(100_000),
  toegang: z.enum(["gratis", "pro"]),
  categorie: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(60).nullable()),
  auteurNaam: z.string().trim().min(1).max(120).default("Job"),
  gepubliceerdOp: z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable()),
  cover: z.string().nullable().optional(),
});

function leesCover(dataUrl: string): { bytes: Buffer; mime: string } | { fout: string } {
  const match = /^data:([a-z/+]+);base64,(.+)$/.exec(dataUrl);
  if (!match || !COVER_TYPES.includes(match[1])) return { fout: "Afbeelding moet JPG, PNG of WebP zijn" };
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > COVER_MAX_BYTES) return { fout: "Afbeelding is groter dan 2 MB" };
  return { bytes, mime: match[1] };
}

async function uniekeSlug(basis: string, negeerId?: string): Promise<string> {
  const start = basis || "artikel";
  let kandidaat = start;
  for (let i = 2; ; i++) {
    const bestaand = await prisma.artikel.findUnique({ where: { slug: kandidaat }, select: { id: true } });
    if (!bestaand || bestaand.id === negeerId) return kandidaat;
    kandidaat = `${start}-${i}`;
  }
}

function status(gepubliceerdOp: Date | null): "concept" | "ingepland" | "gepubliceerd" {
  if (!gepubliceerdOp) return "concept";
  return gepubliceerdOp > new Date() ? "ingepland" : "gepubliceerd";
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/api/admin/")) await requireAdmin(request, reply);
  });

  // ---------- Artikelen ----------

  app.get("/api/admin/artikelen", async () => {
    const artikelen = await prisma.artikel.findMany({
      orderBy: [{ gepubliceerdOp: { sort: "desc", nulls: "first" } }, { aangemaaktOp: "desc" }],
      select: { id: true, titel: true, slug: true, toegang: true, categorie: true, auteurNaam: true, gepubliceerdOp: true, bijgewerktOp: true },
    });
    return { artikelen: artikelen.map((a) => ({ ...a, status: status(a.gepubliceerdOp) })) };
  });

  app.get("/api/admin/artikelen/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const artikel = await prisma.artikel.findUnique({ where: { id } });
    if (!artikel) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    const { coverAfbeelding, ...rest } = artikel;
    return {
      ...rest,
      cover: coverAfbeelding && artikel.coverMime
        ? `data:${artikel.coverMime};base64,${Buffer.from(coverAfbeelding).toString("base64")}`
        : null,
      status: status(artikel.gepubliceerdOp),
    };
  });

  // Voorvertoning in de editor: dezelfde Markdown-rendering als voor lezers.
  app.post("/api/admin/voorvertoning", async (request) => {
    const inhoud = String((request.body as { inhoud?: unknown })?.inhoud ?? "");
    return { html: renderMarkdown(inhoud), leestijd: leestijdMinuten(inhoud) };
  });

  const opslaan = async (
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
    id?: string,
  ) => {
    const parsed = artikelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", details: parsed.error.flatten().fieldErrors });
    }
    const { cover, slug, ...velden } = parsed.data;

    const coverVelden: { coverAfbeelding?: Buffer | null; coverMime?: string | null } = {};
    if (cover === null) {
      coverVelden.coverAfbeelding = null;
      coverVelden.coverMime = null;
    } else if (typeof cover === "string") {
      const gelezen = leesCover(cover);
      if ("fout" in gelezen) {
        return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", details: { cover: [gelezen.fout] } });
      }
      coverVelden.coverAfbeelding = gelezen.bytes;
      coverVelden.coverMime = gelezen.mime;
    }

    const definitieveSlug = await uniekeSlug(maakSlug(slug || velden.titel), id);
    const data = { ...velden, ...coverVelden, slug: definitieveSlug };

    if (id) {
      const bestaat = await prisma.artikel.findUnique({ where: { id }, select: { id: true } });
      if (!bestaat) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
      const artikel = await prisma.artikel.update({ where: { id }, data, select: { id: true, slug: true } });
      return artikel;
    }
    const artikel = await prisma.artikel.create({ data, select: { id: true, slug: true } });
    return reply.code(201).send(artikel);
  };

  app.post("/api/admin/artikelen", (request, reply) => opslaan(request, reply));
  app.put("/api/admin/artikelen/:id", (request, reply) => opslaan(request, reply, (request.params as { id: string }).id));

  // Meerdere artikelen tegelijk publiceren of terugzetten naar concept, bijvoorbeeld na een import.
  app.post("/api/admin/artikelen/bulk", async (request, reply) => {
    const parsed = z
      .object({ ids: z.array(z.string().min(1).max(64)).min(1).max(200), actie: z.enum(["publiceren", "concept"]) })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const ids = [...new Set(parsed.data.ids)];

    if (parsed.data.actie === "concept") {
      const { count } = await prisma.artikel.updateMany({ where: { id: { in: ids } }, data: { gepubliceerdOp: null } });
      return { bijgewerkt: count, overgeslagen: ids.length - count };
    }

    // Alleen concepten en ingeplande artikelen. Een artikel dat al online staat houdt zijn datum:
    // een nieuwe datum zou het opnieuw bovenaan zetten en nog een keer in de nieuwsbrief laten meegaan.
    const nu = new Date();
    const teDoen = publicatieVolgorde(
      await prisma.artikel.findMany({
        where: { id: { in: ids }, OR: [{ gepubliceerdOp: null }, { gepubliceerdOp: { gt: nu } }] },
        select: { id: true, aangemaaktOp: true },
      }),
    );
    // Eén milliseconde verschil per artikel legt die volgorde op de site vast; met precies
    // dezelfde tijd zou de database de volgorde per keer anders kunnen kiezen.
    await prisma.$transaction(
      teDoen.map((a, i) => prisma.artikel.update({ where: { id: a.id }, data: { gepubliceerdOp: new Date(nu.getTime() - i) } })),
    );
    return { bijgewerkt: teDoen.length, overgeslagen: ids.length - teDoen.length };
  });

  app.delete("/api/admin/artikelen/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { count } = await prisma.artikel.deleteMany({ where: { id } });
    if (count === 0) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    return { ok: true };
  });

  // ---------- Gebruikers ----------

  app.get("/api/admin/gebruikers", async () => {
    const gebruikers = await prisma.gebruiker.findMany({
      orderBy: { aangemaaktOp: "desc" },
      select: {
        id: true,
        email: true,
        naam: true,
        rol: true,
        abonnement: true,
        abonnementBron: true,
        nieuwsbrief: true,
        emailBevestigdOp: true,
        aangemaaktOp: true,
        profiel: { select: { gepubliceerd: true, praktijknaam: true } },
      },
    });
    return { gebruikers };
  });

  // Job zet hier handmatig iemand op Pro (een cadeau) of terug op gratis. abonnementBron wordt
  // "handmatig" bij Pro, zodat het lid op zijn account ziet dat hij niets betaalt, en null bij
  // gratis. kruisproductKvkNummer gaat altijd op null: dat is het veld waarop kruisproductCron.ts
  // filtert wie het mag aanraken — zonder dit zou een latere cron-run deze handmatige keuze
  // stilletjes terugdraaien.
  app.patch("/api/admin/gebruikers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ abonnement: z.enum(["gratis", "pro"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const { count } = await prisma.gebruiker.updateMany({
      where: { id },
      data: {
        abonnement: parsed.data.abonnement,
        abonnementBron: parsed.data.abonnement === "pro" ? "handmatig" : null,
        kruisproductKvkNummer: null,
      },
    });
    if (count === 0) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    return { ok: true };
  });

  // Voor wie de bevestigingsmail niet krijgt (mail nog niet ingesteld, of in de spam): de admin
  // bevestigt het adres dan zelf. Wisselt ook een klaargezet Pro-cadeau in, net als de link.
  app.post("/api/admin/gebruikers/:id/bevestigen", async (request, reply) => {
    const { id } = request.params as { id: string };
    const gebruiker = await prisma.gebruiker.findUnique({ where: { id } });
    if (!gebruiker) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    if (gebruiker.emailBevestigdOp) return { ok: true };
    const bevestigd = await prisma.gebruiker.update({
      where: { id },
      data: { emailBevestigdOp: new Date(), bevestigTokenHash: null },
    });
    await wisselProUitnodigingIn(bevestigd);
    return { ok: true };
  });

  // ---------- E-mail ----------

  app.get("/api/admin/mail", async () => mailStatus());

  // Echte testmail, met de echte foutmelding van de mailserver als het misgaat. De
  // nieuwsbrief-testmail hierboven zegt "verstuurd" ook als er geen mailserver is. Met een adres
  // van mail-tester.com krijg je een cijfer en zie je wat er aan SPF, DKIM, DMARC of de inhoud
  // mankeert; zonder adres gaat hij naar de admin zelf.
  app.post("/api/admin/mail/test", async (request, reply) => {
    const parsed = z.object({ naar: z.string().trim().email().max(200).optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", bericht: "Vul een geldig e-mailadres in." });
    if (!mailStatus().ingesteld) {
      return reply.code(503).send({ errorCode: "MAIL_NIET_INGESTELD", bericht: "Er is geen mailserver ingesteld: zet SMTP_HOST en de andere SMTP-waarden in Render." });
    }
    const admin = await prisma.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    const naar = parsed.data.naar ?? admin.email;
    try {
      await verstuurMail({
        naar,
        onderwerp: "Bevestig je e-mailadres — LuzeX CMMNTY (test)",
        // Zo dicht mogelijk bij een echte bevestigingsmail, anders meet mail-tester iets anders.
        tekst: `Hoi,\n\nDit is een testmail van CMMNTY, opgebouwd zoals een bevestigingsmail. Komt hij aan, dan komen bevestigingsmails en de nieuwsbrief ook aan.\n\n${appUrl()}/bevestigen.html?token=test`,
      });
      return { ok: true, naar };
    } catch (fout) {
      return reply.code(502).send({ errorCode: "MAIL_MISLUKT", bericht: `De mailserver weigerde: ${(fout as Error).message}` });
    }
  });

  // ---------- Pro cadeau op e-mailadres ----------

  app.get("/api/admin/pro-uitnodigingen", async () => ({
    uitnodigingen: await prisma.proUitnodiging.findMany({
      where: { ingewisseldOp: null, ingetrokkenOp: null },
      orderBy: { aangemaaktOp: "desc" },
      select: { id: true, email: true, aangemaaktOp: true },
    }),
  }));

  // Heeft het adres al een bevestigd account, dan krijgt dat meteen Pro; anders blijft het cadeau
  // klaarstaan tot iemand dat adres bevestigt (zie proUitnodiging.ts).
  app.post("/api/admin/pro-uitnodigingen", async (request, reply) => {
    const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", bericht: "Vul een geldig e-mailadres in." });
    const { email } = parsed.data;

    const gebruiker = await prisma.gebruiker.findUnique({ where: { email } });
    if (gebruiker?.rol === "admin") return reply.code(409).send({ errorCode: "AL_PRO", bericht: "Dit is het admin-account: dat leest altijd alles." });
    if (gebruiker?.abonnement === "pro") return reply.code(409).send({ errorCode: "AL_PRO", bericht: "Dit account heeft al Pro." });
    if (gebruiker?.emailBevestigdOp) {
      await prisma.gebruiker.update({
        where: { id: gebruiker.id },
        data: { abonnement: "pro", abonnementBron: "handmatig", kruisproductKvkNummer: null },
      });
      return { status: "toegekend" };
    }

    // Opnieuw uitnodigen na intrekken zet dezelfde rij weer open (email is uniek).
    await prisma.proUitnodiging.upsert({
      where: { email },
      create: { email },
      update: { aangemaaktOp: new Date(), ingewisseldOp: null, ingetrokkenOp: null },
    });
    return { status: "klaargezet" };
  });

  app.post("/api/admin/pro-uitnodigingen/:id/intrekken", async (request, reply) => {
    const { id } = request.params as { id: string };
    const uitnodiging = await prisma.proUitnodiging.findUnique({ where: { id } });
    if (!uitnodiging) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    if (!uitnodiging.ingewisseldOp && !uitnodiging.ingetrokkenOp) {
      await prisma.proUitnodiging.update({ where: { id }, data: { ingetrokkenOp: new Date() } });
    }
    return { ok: true };
  });

  // ---------- Stripe ----------

  // Wat er van de Stripe-koppeling klaarstaat, zonder ooit een sleutel of geheim terug te geven.
  app.get("/api/admin/stripe", async () => {
    const sleutel = process.env.STRIPE_GEHEIME_SLEUTEL ?? "";
    const instellingen = await prisma.instellingen.findUnique({ where: { id: "standaard" } });
    return {
      sleutel: sleutel ? (sleutel.startsWith("sk_live_") || sleutel.startsWith("rk_live_") ? "live" : "test") : null,
      prijs: Boolean(process.env.STRIPE_PRIJS_ID),
      webhook: process.env.STRIPE_WEBHOOK_GEHEIM ? "render" : instellingen?.stripeWebhookGeheim ? "knop" : null,
      webhookUrl: `${appUrl()}/api/stripe/webhook`,
    };
  });

  // Maakt de webhook in Stripe aan en bewaart het geheim zelf, zodat niemand het uit een Render
  // Shell hoeft over te zetten. Bestaat er al een endpoint naar dit adres, dan is het geheim
  // daarvan niet meer op te vragen (Stripe toont het alleen bij aanmaken): dat endpoint wordt
  // vervangen. Het wijst naar ons eigen adres, dus er hangt niets anders aan.
  app.post("/api/admin/stripe/webhook", async (_request, reply) => {
    const stripe = stripeClient();
    if (!stripe) {
      return reply.code(503).send({ errorCode: "STRIPE_NIET_INGESTELD", bericht: "Zet eerst STRIPE_GEHEIME_SLEUTEL in Render en deploy opnieuw." });
    }
    // Staat het geheim al in Render, dan hoort daar een bestaand endpoint bij; dat vervangen zou
    // de werkende koppeling breken, want Render's geheim gaat voor (zie webhookGeheim()).
    if (process.env.STRIPE_WEBHOOK_GEHEIM) {
      return reply.code(409).send({ errorCode: "WEBHOOK_AL_INGESTELD", bericht: "De webhook is al ingesteld via Render. Er hoeft niets te gebeuren." });
    }
    const url = `${appUrl()}/api/stripe/webhook`;
    try {
      const bestaand = await stripe.webhookEndpoints.list({ limit: 100 });
      for (const oud of bestaand.data.filter((w) => w.url === url)) await stripe.webhookEndpoints.del(oud.id);
      const nieuw = await stripe.webhookEndpoints.create({
        url,
        enabled_events: ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"],
        description: "CMMNTY Pro",
      });
      await prisma.instellingen.upsert({
        where: { id: "standaard" },
        create: { id: "standaard", stripeWebhookGeheim: nieuw.secret ?? null, stripeWebhookId: nieuw.id },
        update: { stripeWebhookGeheim: nieuw.secret ?? null, stripeWebhookId: nieuw.id },
      });
      return { ok: true, vervangen: bestaand.data.some((w) => w.url === url) };
    } catch (fout) {
      return reply.code(502).send({ errorCode: "STRIPE_FOUT", bericht: `Stripe gaf een fout: ${(fout as Error).message}` });
    }
  });

  // ---------- Nieuwsbrief ----------

  app.get("/api/admin/nieuwsbrief", async () => {
    const frequentie = await leesFrequentie();
    const tekstFrequentie: Frequentie = frequentie === "uit" ? "wekelijks" : frequentie;
    const [gratis, pro, verzendingen, abonnees] = await Promise.all([
      artikelenVoorNieuwsbrief("gratis", tekstFrequentie),
      artikelenVoorNieuwsbrief("pro", tekstFrequentie),
      prisma.nieuwsbriefVerzending.findMany({ orderBy: { verstuurdOp: "desc" }, take: 20 }),
      prisma.gebruiker.groupBy({
        by: ["abonnement"],
        where: { nieuwsbrief: true, emailBevestigdOp: { not: null }, rol: { not: "admin" } },
        _count: true,
      }),
    ]);
    const aantal = (abonnement: string) => abonnees.find((a) => a.abonnement === abonnement)?._count ?? 0;
    return {
      frequentie,
      segmenten: {
        gratis: { vanaf: gratis.vanaf, artikelen: gratis.artikelen.map((a) => a.titel), abonnees: aantal("gratis") },
        pro: { vanaf: pro.vanaf, artikelen: pro.artikelen.map((a) => a.titel), abonnees: aantal("pro") },
      },
      verzendingen,
    };
  });

  app.put("/api/admin/nieuwsbrief", async (request, reply) => {
    const parsed = z.object({ frequentie: z.enum(["wekelijks", "maandelijks", "uit"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    await prisma.instellingen.upsert({
      where: { id: "standaard" },
      update: { nieuwsbriefFrequentie: parsed.data.frequentie },
      create: { id: "standaard", nieuwsbriefFrequentie: parsed.data.frequentie },
    });
    return { ok: true };
  });

  app.get("/api/admin/nieuwsbrief/voorbeeld", async (request) => {
    const segment = (request.query as { segment?: string }).segment === "pro" ? "pro" : "gratis";
    const frequentie = await leesFrequentie();
    const tekstFrequentie: Frequentie = frequentie === "uit" ? "wekelijks" : frequentie;
    const { artikelen } = await artikelenVoorNieuwsbrief(segment, tekstFrequentie);
    return {
      onderwerp: onderwerp(tekstFrequentie, artikelen.length),
      aantalArtikelen: artikelen.length,
      html: voorbeeldHtml(artikelen, tekstFrequentie, "Voornaam"),
    };
  });

  // Stuurt het voorbeeld naar Job zelf — om te zien hoe het er in een echte mailbox uitziet.
  app.post("/api/admin/nieuwsbrief/test", async (request) => {
    const segment = (request.body as { segment?: string })?.segment === "pro" ? "pro" : "gratis";
    const admin = await prisma.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    const frequentie = await leesFrequentie();
    const tekstFrequentie: Frequentie = frequentie === "uit" ? "wekelijks" : frequentie;
    const { artikelen } = await artikelenVoorNieuwsbrief(segment, tekstFrequentie);
    await verstuurMail({
      naar: admin.email,
      onderwerp: `[TEST ${segment}] ${onderwerp(tekstFrequentie, artikelen.length)}`,
      html: voorbeeldHtml(artikelen, tekstFrequentie, admin.naam),
      tekst: bouwTekst({ artikelen, frequentie: tekstFrequentie, appUrl: appUrl(), naam: admin.naam, afmeldLink: "(testmail)" }),
    });
    return { ok: true, naar: admin.email };
  });

  app.post("/api/admin/nieuwsbrief/versturen", async () => {
    const resultaten = await verstuurNieuwsbrief("handmatig");
    return { resultaten };
  });
}
