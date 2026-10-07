import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  hashToken,
  hashWachtwoord,
  leesAfmeldToken,
  maakEenmaligToken,
  maakSessieToken,
  verifieerWachtwoord,
} from "../auth.js";
import { verstuurBevestigingsmail, verstuurWachtwoordResetMail } from "../mailer.js";
import { appUrl } from "../nieuwsbriefVersturen.js";
import { claimKruisproductPro } from "../luzexKruisproduct.js";
import { leesSessie, requireLid, wisSessieCookie, zetSessieCookie } from "../plugins/requireAuth.js";

// Strenge limiet waar een aanvaller iets te winnen heeft (wachtwoorden raden, mailboxen
// volspammen). Ruim genoeg voor een mens die zich vertypt, te krap voor een script.
const AUTH_LIMIET = { rateLimit: { max: 10, timeWindow: "15 minutes" } };

const MAX_POGINGEN = 5;
const VERGRENDELING_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const email = z.string().trim().toLowerCase().email("Ongeldig e-mailadres");
const nieuwWachtwoord = z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn").max(200);

const registreerSchema = z.object({
  naam: z.string().trim().min(1, "Naam is verplicht").max(120),
  email,
  wachtwoord: nieuwWachtwoord,
  nieuwsbrief: z.boolean().default(true),
});

const inlogSchema = z.object({ email, wachtwoord: z.string().min(1) });

function ongeldig(reply: import("fastify").FastifyReply, error: z.ZodError) {
  return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", details: error.flatten().fieldErrors });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/registreren", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = registreerSchema.safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const { naam, email, wachtwoord, nieuwsbrief } = parsed.data;

    const { ruweToken, tokenHash } = maakEenmaligToken();
    const bestaand = await prisma.gebruiker.findUnique({ where: { email } });

    if (bestaand) {
      // Zelfde antwoord als bij een nieuw adres, zodat niet af te tasten is wie er lid is.
      // Nog niet bevestigd? Dan sturen we de bevestigingsmail gewoon opnieuw.
      if (!bestaand.emailBevestigdOp) {
        await prisma.gebruiker.update({ where: { id: bestaand.id }, data: { bevestigTokenHash: tokenHash } });
        await verstuurBevestigingsmail(email, bestaand.naam, `${appUrl()}/bevestigen.html?token=${ruweToken}`);
      }
      return { ok: true };
    }

    await prisma.gebruiker.create({
      data: {
        naam,
        email,
        wachtwoordHash: await hashWachtwoord(wachtwoord),
        nieuwsbrief,
        bevestigTokenHash: tokenHash,
        profiel: { create: { weergavenaam: naam } },
      },
    });
    await verstuurBevestigingsmail(email, naam, `${appUrl()}/bevestigen.html?token=${ruweToken}`);
    return { ok: true };
  });

  app.post("/api/auth/bevestigen", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);

    const gebruiker = await prisma.gebruiker.findUnique({
      where: { bevestigTokenHash: hashToken(parsed.data.token) },
    });
    if (!gebruiker) return reply.code(400).send({ errorCode: "TOKEN_ONGELDIG" });

    // Kruisproduct-Pro v2 is hier bewust NIET meer automatisch: dat kende vroeger gratis Pro toe
    // op basis van een gelijk e-mailadres bij ACCRD/SCRNN. Nu vult de klant zelf een kvk-nummer
    // in via POST /api/account/kruisproduct-claim — zie luzexKruisproduct.ts.
    await prisma.gebruiker.update({
      where: { id: gebruiker.id },
      data: { emailBevestigdOp: new Date(), bevestigTokenHash: null },
    });
    // Meteen ingelogd: wie net op de link klikte, hoeft niet nog eens zijn wachtwoord in te typen.
    zetSessieCookie(reply, maakSessieToken({ gebruikerId: gebruiker.id, email: gebruiker.email, rol: gebruiker.rol as "lid" | "admin" }));
    return { ok: true };
  });

  app.post("/api/auth/bevestiging-opnieuw", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ email }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const gebruiker = await prisma.gebruiker.findUnique({ where: { email: parsed.data.email } });
    if (gebruiker && !gebruiker.emailBevestigdOp) {
      const { ruweToken, tokenHash } = maakEenmaligToken();
      await prisma.gebruiker.update({ where: { id: gebruiker.id }, data: { bevestigTokenHash: tokenHash } });
      await verstuurBevestigingsmail(gebruiker.email, gebruiker.naam, `${appUrl()}/bevestigen.html?token=${ruweToken}`);
    }
    return { ok: true };
  });

  app.post("/api/auth/inloggen", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = inlogSchema.safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const { email, wachtwoord } = parsed.data;

    const gebruiker = await prisma.gebruiker.findUnique({ where: { email } });
    // Eén foutmelding voor "onbekend adres" en "verkeerd wachtwoord" (geen user enumeration).
    if (!gebruiker) return reply.code(401).send({ errorCode: "ONJUISTE_INLOGGEGEVENS" });

    if (gebruiker.vergrendeldTot && gebruiker.vergrendeldTot > new Date()) {
      const minuten = Math.ceil((gebruiker.vergrendeldTot.getTime() - Date.now()) / 60000);
      return reply.code(429).send({
        errorCode: "TE_VEEL_POGINGEN",
        bericht: `Te veel mislukte pogingen. Probeer het over ${minuten} minuten opnieuw.`,
      });
    }

    if (!(await verifieerWachtwoord(gebruiker.wachtwoordHash, wachtwoord))) {
      const pogingen = gebruiker.mislukteInlogpogingen + 1;
      await prisma.gebruiker.update({
        where: { id: gebruiker.id },
        data:
          pogingen >= MAX_POGINGEN
            ? { mislukteInlogpogingen: 0, vergrendeldTot: new Date(Date.now() + VERGRENDELING_MS) }
            : { mislukteInlogpogingen: pogingen },
      });
      return reply.code(401).send({ errorCode: "ONJUISTE_INLOGGEGEVENS" });
    }

    // Pas na het juiste wachtwoord: anders zou dit verraden dat het adres bestaat.
    if (!gebruiker.emailBevestigdOp) {
      return reply.code(403).send({ errorCode: "EMAIL_NIET_BEVESTIGD" });
    }

    await prisma.gebruiker.update({
      where: { id: gebruiker.id },
      data: { mislukteInlogpogingen: 0, vergrendeldTot: null },
    });
    zetSessieCookie(reply, maakSessieToken({ gebruikerId: gebruiker.id, email: gebruiker.email, rol: gebruiker.rol as "lid" | "admin" }));
    return { ok: true, rol: gebruiker.rol };
  });

  app.post("/api/auth/uitloggen", async (_request, reply) => {
    wisSessieCookie(reply);
    return { ok: true };
  });

  const gebruikerJson = async (gebruikerId: string) => {
    const gebruiker = await prisma.gebruiker.findUnique({ where: { id: gebruikerId } });
    if (!gebruiker) return null;
    return {
      id: gebruiker.id,
      email: gebruiker.email,
      naam: gebruiker.naam,
      rol: gebruiker.rol,
      abonnement: gebruiker.abonnement,
      nieuwsbrief: gebruiker.nieuwsbrief,
      lidSinds: gebruiker.aangemaaktOp,
    };
  };

  app.get("/api/auth/me", { preHandler: requireLid }, async (request, reply) => {
    const gebruiker = await gebruikerJson(request.gebruiker!.gebruikerId);
    if (!gebruiker) {
      wisSessieCookie(reply);
      return reply.code(401).send({ errorCode: "NIET_INGELOGD" });
    }
    return gebruiker;
  });

  // Voor de frontend: altijd 200, met gebruiker = null voor bezoekers. Scheelt een rode
  // 401 in de console op elke publieke pagina.
  app.get("/api/auth/sessie", async (request) => {
    const sessie = leesSessie(request);
    return { gebruiker: sessie ? await gebruikerJson(sessie.gebruikerId) : null };
  });

  app.post("/api/auth/wachtwoord-vergeten", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ email }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const gebruiker = await prisma.gebruiker.findUnique({ where: { email: parsed.data.email } });
    if (gebruiker) {
      const { ruweToken, tokenHash } = maakEenmaligToken();
      await prisma.gebruiker.update({
        where: { id: gebruiker.id },
        data: { resetTokenHash: tokenHash, resetTokenVerlooptOp: new Date(Date.now() + RESET_TTL_MS) },
      });
      await verstuurWachtwoordResetMail(gebruiker.email, `${appUrl()}/wachtwoord-resetten.html?token=${ruweToken}`);
    }
    return { ok: true };
  });

  app.post("/api/auth/wachtwoord-resetten", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ token: z.string().min(1), nieuwWachtwoord }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const gebruiker = await prisma.gebruiker.findUnique({
      where: { resetTokenHash: hashToken(parsed.data.token) },
    });
    if (!gebruiker || !gebruiker.resetTokenVerlooptOp || gebruiker.resetTokenVerlooptOp < new Date()) {
      return reply.code(400).send({ errorCode: "TOKEN_ONGELDIG" });
    }
    await prisma.gebruiker.update({
      where: { id: gebruiker.id },
      data: {
        wachtwoordHash: await hashWachtwoord(parsed.data.nieuwWachtwoord),
        resetTokenHash: null,
        resetTokenVerlooptOp: null,
        mislukteInlogpogingen: 0,
        vergrendeldTot: null,
        // De resetlink kwam via de mailbox binnen: daarmee is het adres ook bevestigd.
        emailBevestigdOp: gebruiker.emailBevestigdOp ?? new Date(),
        bevestigTokenHash: null,
      },
    });
    return { ok: true };
  });

  // ---------- Account (dashboard) ----------

  app.put("/api/account", { preHandler: requireLid }, async (request, reply) => {
    const parsed = z
      .object({ naam: z.string().trim().min(1).max(120), nieuwsbrief: z.boolean() })
      .safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    await prisma.gebruiker.update({ where: { id: request.gebruiker!.gebruikerId }, data: parsed.data });
    return { ok: true };
  });

  app.post("/api/account/wachtwoord", { preHandler: requireLid, config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ huidigWachtwoord: z.string().min(1), nieuwWachtwoord }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const gebruiker = await prisma.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    if (!(await verifieerWachtwoord(gebruiker.wachtwoordHash, parsed.data.huidigWachtwoord))) {
      return reply.code(400).send({ errorCode: "HUIDIG_WACHTWOORD_ONJUIST" });
    }
    await prisma.gebruiker.update({
      where: { id: gebruiker.id },
      data: { wachtwoordHash: await hashWachtwoord(parsed.data.nieuwWachtwoord) },
    });
    return { ok: true };
  });

  // AVG: een lid moet zijn gegevens zelf kunnen laten verwijderen. Profiel gaat mee (cascade).
  app.delete("/api/account", { preHandler: requireLid, config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ wachtwoord: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const gebruiker = await prisma.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    if (gebruiker.rol === "admin") return reply.code(400).send({ errorCode: "ADMIN_NIET_VERWIJDERBAAR" });
    if (!(await verifieerWachtwoord(gebruiker.wachtwoordHash, parsed.data.wachtwoord))) {
      return reply.code(400).send({ errorCode: "HUIDIG_WACHTWOORD_ONJUIST" });
    }
    await prisma.gebruiker.delete({ where: { id: gebruiker.id } });
    wisSessieCookie(reply);
    return { ok: true };
  });

  // Kruisproduct-Pro v2: de klant vult zelf zijn kvk-nummer in om gratis Pro te claimen op basis
  // van een actief, betalend ACCRD-account. Zie luzexKruisproduct.ts voor het contract met ACCRD.
  // Zonder `wisselen` wijst ACCRD een al bestaande keuze voor RSLNT af (409 met de huidige
  // keuze) in plaats van hem stilletjes te overschrijven — de frontend laat de klant dat dan
  // expliciet bevestigen door opnieuw te posten met `wisselen: true`.
  app.post("/api/account/kruisproduct-claim", { preHandler: requireLid }, async (request, reply) => {
    const parsed = z
      .object({ kvkNummer: z.string().trim().min(1), wisselen: z.boolean().optional() })
      .safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const { kvkNummer, wisselen } = parsed.data;

    const resultaat = await claimKruisproductPro(kvkNummer, wisselen);
    if (resultaat.status === "toegekend") {
      await prisma.gebruiker.update({
        where: { id: request.gebruiker!.gebruikerId },
        data: { abonnement: "pro", abonnementBron: "accrd", kruisproductKvkNummer: kvkNummer },
      });
      return { status: "toegekend" };
    }
    if (resultaat.status === "al_gekozen") {
      // Vanuit CMMNTY's perspectief is de "andere keuze" altijd RSLNT — dit mechanisme kent
      // maar twee ontvangers, en ACCRD geeft hier nooit "cmmnty" terug (dat zou immers al
      // "toegekend" zijn geweest).
      return reply.code(409).send({ errorCode: "AL_GEKOZEN", huidigeKeuze: "rslnt" });
    }
    if (resultaat.status === "niet_actief") {
      return reply.code(400).send({
        errorCode: "NIET_ACTIEF",
        bericht: "Dit KvK-nummer is niet gekoppeld aan een actief, betalend ACCRD-account.",
      });
    }
    // "onbereikbaar": ACCRD is niet te bereiken of niet geconfigureerd — geen foutcode die op
    // het kvk-nummer zelf wijst, want dat is hier niet het probleem.
    return reply.code(503).send({ errorCode: "NIET_BESCHIKBAAR", bericht: "Even niet te controleren. Probeer het later opnieuw." });
  });

  // Afmelden voor de nieuwsbrief via de link in de mail — zonder inloggen.
  app.post("/api/nieuwsbrief/afmelden", { config: AUTH_LIMIET }, async (request, reply) => {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return ongeldig(reply, parsed.error);
    const gebruikerId = leesAfmeldToken(parsed.data.token);
    if (!gebruikerId) return reply.code(400).send({ errorCode: "TOKEN_ONGELDIG" });
    await prisma.gebruiker.updateMany({ where: { id: gebruikerId }, data: { nieuwsbrief: false } });
    return { ok: true };
  });

  // Eén-klik-afmelden (RFC 8058): Gmail en Apple Mail POSTen hier direct naartoe vanuit de
  // "Afmelden"-knop bij de afzender, met het token in de URL uit de List-Unsubscribe-header.
  app.post("/api/nieuwsbrief/afmelden-een-klik", async (request, reply) => {
    const token = (request.query as { token?: string }).token ?? "";
    const gebruikerId = leesAfmeldToken(token);
    if (!gebruikerId) return reply.code(400).send({ errorCode: "TOKEN_ONGELDIG" });
    await prisma.gebruiker.updateMany({ where: { id: gebruikerId }, data: { nieuwsbrief: false } });
    return { ok: true };
  });
}
