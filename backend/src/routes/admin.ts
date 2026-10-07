import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { leestijdMinuten, maakSlug, renderMarkdown } from "../artikelen.js";
import { requireAdmin } from "../plugins/requireAuth.js";
import { verstuurMail } from "../mailer.js";
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

  // Zonder betaling (MVP) zet Job hier handmatig iemand op Pro. Stripe vervangt dit later.
  // Zet ook abonnementBron én kruisproductKvkNummer op null: dit is een bewuste, handmatige
  // keuze, en kruisproductKvkNummer is het veld waarop kruisproductCron.ts filtert wie het mag
  // aanraken — zonder dit zou een latere cron-run deze handmatige keuze stilletjes terugdraaien.
  app.patch("/api/admin/gebruikers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ abonnement: z.enum(["gratis", "pro"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const { count } = await prisma.gebruiker.updateMany({
      where: { id },
      data: { ...parsed.data, abonnementBron: null, kruisproductKvkNummer: null },
    });
    if (count === 0) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    return { ok: true };
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
