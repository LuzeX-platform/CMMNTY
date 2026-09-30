import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";
import { authRoutes } from "./routes/auth.js";
import { artikelRoutes } from "./routes/artikelen.js";
import { profielRoutes } from "./routes/profiel.js";
import { adminRoutes } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Werkt vanuit zowel src/ (tsx) als dist/ (productie): beide liggen twee niveaus onder de repo.
const FRONTEND = path.join(__dirname, "..", "..", "frontend");

/** Bouwt de app zonder te luisteren, zodat tests hem via app.inject() kunnen aanroepen. */
export async function bouwApp(opties: { logger?: boolean } = {}): Promise<FastifyInstance> {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET ontbreekt. Zet deze omgevingsvariabele en start opnieuw.");
  }

  // bodyLimit 4 MB: een cover-afbeelding van max 2 MB komt als base64 (~33% groter) binnen.
  const app = Fastify({ logger: opties.logger ?? true, bodyLimit: 4 * 1024 * 1024, trustProxy: true });

  await app.register(fastifyCookie);

  // Zelfde strenge CSP als ACCRD: geen inline scripts, alles van 'self'.
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // https: voor afbeeldingen die Job in een artikel via Markdown insluit.
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    allowList: (request) => !request.url.startsWith("/api/"),
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      errorCode: "TE_VEEL_VERZOEKEN",
      bericht: `Te veel verzoeken. Probeer het over ${Math.ceil(context.ttl / 1000)} seconden opnieuw.`,
    }),
  });

  // CSRF-basis, overgenomen uit ACCRD: schrijvende requests met een vreemde Origin weigeren.
  app.addHook("onRequest", async (request, reply) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin) {
        let originHost: string;
        try {
          originHost = new URL(origin).host;
        } catch {
          return reply.code(403).send({ errorCode: "ONGELDIGE_OORSPRONG" });
        }
        if (originHost !== request.headers.host) {
          return reply.code(403).send({ errorCode: "ONGELDIGE_OORSPRONG" });
        }
      }
    }
  });

  // Eén-klik-afmelden (RFC 8058) stuurt "List-Unsubscribe=One-Click" als formulier. De inhoud
  // doet er niet toe (het token staat in de URL), maar zonder parser antwoordt Fastify 415.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) =>
    done(null, body),
  );

  await app.register(authRoutes);
  await app.register(artikelRoutes);
  await app.register(profielRoutes);
  await app.register(adminRoutes);

  // redirect: /admin → /admin/ (anders 404 op een map zonder slash).
  await app.register(fastifyStatic, { root: FRONTEND, prefix: "/", index: "index.html", redirect: true });

  // Nette artikel-URL's (/artikelen/mijn-artikel) voor de nieuwsbrief en om te delen.
  app.get("/artikelen/:slug", (_request, reply) => reply.sendFile("artikel.html"));

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    return reply.code(404).sendFile("404.html");
  });

  return app;
}
