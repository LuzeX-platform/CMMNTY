import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { leestijdMinuten, magVolledigLezen, renderMarkdown, vergrendelReden } from "../artikelen.js";
import { CATEGORIEEN, REGIOS, SPECIALISMEN } from "../constanten.js";
import { leesSessie } from "../plugins/requireAuth.js";

const PER_PAGINA = 12;

// Velden voor een kaartje in een lijst: nooit de volledige inhoud of de afbeelding zelf.
const kaartSelect = {
  id: true,
  titel: true,
  slug: true,
  samenvatting: true,
  toegang: true,
  categorie: true,
  auteurNaam: true,
  gepubliceerdOp: true,
  coverMime: true,
  inhoud: true,
} satisfies Prisma.ArtikelSelect;

type KaartRij = Prisma.ArtikelGetPayload<{ select: typeof kaartSelect }>;

export function naarKaart(a: KaartRij) {
  return {
    id: a.id,
    titel: a.titel,
    slug: a.slug,
    samenvatting: a.samenvatting,
    toegang: a.toegang,
    categorie: a.categorie,
    auteurNaam: a.auteurNaam,
    gepubliceerdOp: a.gepubliceerdOp,
    leestijd: leestijdMinuten(a.inhoud),
    coverUrl: a.coverMime ? `/api/artikelen/${encodeURIComponent(a.slug)}/cover` : null,
  };
}

/** Alleen wat gepubliceerd is: een datum in de toekomst is "ingepland" en nog niet zichtbaar. */
export function gepubliceerd(): Prisma.ArtikelWhereInput {
  return { gepubliceerdOp: { not: null, lte: new Date() } };
}

async function bezoekerVan(request: import("fastify").FastifyRequest) {
  const sessie = leesSessie(request);
  if (!sessie) return null;
  const gebruiker = await prisma.gebruiker.findUnique({
    where: { id: sessie.gebruikerId },
    select: { rol: true, abonnement: true },
  });
  return gebruiker ? { rol: gebruiker.rol as "lid" | "admin", abonnement: gebruiker.abonnement } : null;
}

export async function artikelRoutes(app: FastifyInstance) {
  app.get("/api/keuzelijsten", async () => ({
    specialismen: SPECIALISMEN,
    regios: REGIOS,
    categorieen: CATEGORIEEN,
  }));

  app.get("/api/artikelen", async (request) => {
    const q = request.query as { toegang?: string; categorie?: string; zoek?: string; pagina?: string; limiet?: string };
    const where: Prisma.ArtikelWhereInput = { ...gepubliceerd() };
    if (q.toegang === "gratis" || q.toegang === "pro") where.toegang = q.toegang;
    if (q.categorie) where.categorie = q.categorie;
    if (q.zoek?.trim()) {
      const zoek = q.zoek.trim().slice(0, 100);
      where.OR = [
        { titel: { contains: zoek, mode: "insensitive" } },
        { samenvatting: { contains: zoek, mode: "insensitive" } },
      ];
    }
    const limiet = Math.min(Math.max(Number(q.limiet) || PER_PAGINA, 1), 50);
    const pagina = Math.max(Number(q.pagina) || 1, 1);

    const [totaal, artikelen] = await Promise.all([
      prisma.artikel.count({ where }),
      prisma.artikel.findMany({
        where,
        orderBy: { gepubliceerdOp: "desc" },
        skip: (pagina - 1) * limiet,
        take: limiet,
        select: kaartSelect,
      }),
    ]);
    return { totaal, pagina, paginas: Math.max(1, Math.ceil(totaal / limiet)), artikelen: artikelen.map(naarKaart) };
  });

  app.get("/api/artikelen/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const bezoeker = await bezoekerVan(request);
    // De admin mag ook concepten en ingeplande artikelen openen, als voorbeeld van hoe het
    // artikel er straks uitziet. Voor iedereen anders bestaan die niet (404).
    const artikel = await prisma.artikel.findFirst({
      where: { slug, ...(bezoeker?.rol === "admin" ? {} : gepubliceerd()) },
      select: kaartSelect,
    });
    if (!artikel) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    const isVoorbeeld = !artikel.gepubliceerdOp || artikel.gepubliceerdOp > new Date();

    const magLezen = magVolledigLezen(artikel.toegang, bezoeker);

    // Gerelateerd: eerst dezelfde categorie, aangevuld met de nieuwste andere artikelen.
    const zelfdeCategorie = artikel.categorie
      ? await prisma.artikel.findMany({
          where: { ...gepubliceerd(), categorie: artikel.categorie, id: { not: artikel.id } },
          orderBy: { gepubliceerdOp: "desc" },
          take: 3,
          select: kaartSelect,
        })
      : [];
    const aanvulling =
      zelfdeCategorie.length < 3
        ? await prisma.artikel.findMany({
            where: { ...gepubliceerd(), id: { notIn: [artikel.id, ...zelfdeCategorie.map((a) => a.id)] } },
            orderBy: { gepubliceerdOp: "desc" },
            take: 3 - zelfdeCategorie.length,
            select: kaartSelect,
          })
        : [];

    return {
      ...naarKaart(artikel),
      // Pro zonder toegang: wél titel, samenvatting en metadata (als etalage), nooit de inhoud.
      inhoudHtml: magLezen ? renderMarkdown(artikel.inhoud) : null,
      vergrendeld: magLezen ? null : vergrendelReden(bezoeker),
      gerelateerd: [...zelfdeCategorie, ...aanvulling].map(naarKaart),
      voorbeeld: isVoorbeeld,
    };
  });

  app.get("/api/artikelen/:slug/cover", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const bezoeker = await bezoekerVan(request);
    const artikel = await prisma.artikel.findFirst({
      where: { slug, ...(bezoeker?.rol === "admin" ? {} : gepubliceerd()) },
      select: { coverAfbeelding: true, coverMime: true, gepubliceerdOp: true },
    });
    if (!artikel?.coverAfbeelding || !artikel.coverMime) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    const openbaar = artikel.gepubliceerdOp !== null && artikel.gepubliceerdOp <= new Date();
    return reply
      .header("Content-Type", artikel.coverMime)
      // Een concept-afbeelding niet laten bewaren door gedeelde caches.
      .header("Cache-Control", openbaar ? "public, max-age=3600" : "private, no-store")
      .send(Buffer.from(artikel.coverAfbeelding));
  });
}
