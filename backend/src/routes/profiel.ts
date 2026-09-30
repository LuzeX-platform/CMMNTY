import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { REGIOS, SPECIALISMEN } from "../constanten.js";
import { requireLid } from "../plugins/requireAuth.js";

const leegNaarNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

// Een website zonder https:// ervoor ("www.praktijk.nl") is wat mensen intypen; dat vullen we
// aan in plaats van het af te keuren.
const website = z.preprocess(
  (v) => {
    const w = leegNaarNull(v);
    if (typeof w !== "string") return w;
    const t = w.trim();
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  },
  z.string().url("Ongeldige website").max(200).refine((u) => /^https?:\/\//i.test(u), "Ongeldige website").nullable(),
);

export const profielSchema = z.object({
  weergavenaam: z.string().trim().min(1, "Naam is verplicht").max(120),
  praktijknaam: z.preprocess(leegNaarNull, z.string().trim().max(120).nullable()),
  specialismen: z.array(z.enum(SPECIALISMEN)).max(5, "Kies maximaal 5 specialismen"),
  telefoon: z.preprocess(
    leegNaarNull,
    z.string().trim().max(30).regex(/^[0-9+()\-\s]{6,30}$/, "Ongeldig telefoonnummer").nullable(),
  ),
  website,
  contactEmail: z.preprocess(leegNaarNull, z.string().trim().email("Ongeldig e-mailadres").max(200).nullable()),
  bio: z.preprocess(leegNaarNull, z.string().trim().max(250, "Maximaal 250 tekens").nullable()),
  regio: z.preprocess(leegNaarNull, z.enum(REGIOS).nullable()),
  gepubliceerd: z.boolean(),
});

const directorySelect = {
  gebruikerId: true,
  weergavenaam: true,
  praktijknaam: true,
  specialismen: true,
  telefoon: true,
  website: true,
  contactEmail: true,
  bio: true,
  regio: true,
} satisfies Prisma.ProfielSelect;

export async function profielRoutes(app: FastifyInstance) {
  app.get("/api/profiel", { preHandler: requireLid }, async (request) => {
    const gebruikerId = request.gebruiker!.gebruikerId;
    const profiel = await prisma.profiel.findUnique({ where: { gebruikerId } });
    if (profiel) return profiel;
    const gebruiker = await prisma.gebruiker.findUniqueOrThrow({ where: { id: gebruikerId } });
    return prisma.profiel.create({ data: { gebruikerId, weergavenaam: gebruiker.naam } });
  });

  app.put("/api/profiel", { preHandler: requireLid }, async (request, reply) => {
    const parsed = profielSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", details: parsed.error.flatten().fieldErrors });
    }
    const data = parsed.data;
    // Een gepubliceerd profiel zonder enige manier om contact op te nemen is geen reclame maar ruis.
    if (data.gepubliceerd && !data.telefoon && !data.website && !data.contactEmail) {
      return reply.code(400).send({
        errorCode: "ONGELDIGE_INVOER",
        details: { contactEmail: ["Vul minstens één contactgegeven in om je profiel te publiceren"] },
      });
    }
    const gebruikerId = request.gebruiker!.gebruikerId;
    return prisma.profiel.upsert({ where: { gebruikerId }, update: data, create: { gebruikerId, ...data } });
  });

  // Openbaar: iedereen mag de directory bekijken — het is reclame voor de praktijken.
  app.get("/api/directory", async (request) => {
    const q = request.query as { specialisme?: string; regio?: string; zoek?: string };
    const where: Prisma.ProfielWhereInput = { gepubliceerd: true };
    if (q.specialisme) where.specialismen = { has: q.specialisme };
    if (q.regio) where.regio = q.regio;
    if (q.zoek?.trim()) {
      const zoek = q.zoek.trim().slice(0, 100);
      where.OR = [
        { weergavenaam: { contains: zoek, mode: "insensitive" } },
        { praktijknaam: { contains: zoek, mode: "insensitive" } },
        { bio: { contains: zoek, mode: "insensitive" } },
      ];
    }
    const profielen = await prisma.profiel.findMany({
      where,
      orderBy: [{ praktijknaam: "asc" }, { weergavenaam: "asc" }],
      select: directorySelect,
      take: 200,
    });
    return { profielen };
  });
}
