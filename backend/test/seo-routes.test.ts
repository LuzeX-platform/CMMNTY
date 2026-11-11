// Integratietest over de SEO-routes + database. Draait alleen met TEST_DATABASE_URL
// gezet (een lege, wegwerpbare database):
//   TEST_DATABASE_URL=postgresql://…/community_test npx prisma migrate deploy
//   TEST_DATABASE_URL=postgresql://…/community_test npm test
//
// seo.test.ts dekt het opbouwen van de HTML met een nagebootste database. Deze
// test dekt wat daar niet in past: dat de routes ook echt aan staan, dat ze
// voorrang krijgen op de statische bestanden, en vooral dat de volledige
// artikeltekst er niet uit komt. Dat laatste is de reden dat dit bestand
// bestaat: de etalage mag alles tonen behalve de tekst zelf, en die grens moet
// een test bewaken en niet een belofte in een commitbericht.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe("SEO-routes", { skip: !TEST_DB && "TEST_DATABASE_URL niet gezet" }, () => {
  process.env.DATABASE_URL = TEST_DB;
  process.env.JWT_SECRET ??= "test-geheim";
  process.env.APP_URL = "https://cmmnty.luzex.nl";

  let app: import("fastify").FastifyInstance;
  let prisma: import("@prisma/client").PrismaClient;

  const GEHEIM = "DIT-IS-DE-VOLLEDIGE-TEKST-DIE-NOOIT-MAG-LEKKEN";

  // Eigen slugs met een voorvoegsel, en bij het opruimen alleen die weghalen.
  // node:test draait testbestanden parallel: een deleteMany({}) hier maakte de
  // artikelen weg waar api.test.ts op dat moment mee bezig was, en die viel dan
  // om. Losse bestanden mogen elkaars gegevens niet aanraken.
  const PREFIX = "seo-test-";
  const ECHT = `${PREFIX}agenda-avg-proof`;
  const CONCEPT = `${PREFIX}concept`;
  const opruimen = () => prisma.artikel.deleteMany({ where: { slug: { startsWith: PREFIX } } });

  before(async () => {
    ({ prisma } = await import("../src/db.js"));
    ({ app } = { app: await (await import("../src/app.js")).bouwApp({ logger: false }) });

    await opruimen();
    await prisma.artikel.create({
      data: {
        titel: "Zo houd je je agenda AVG-proof",
        slug: ECHT,
        samenvatting: "Wat je wel en niet mag vastleggen over cliënten.",
        inhoud: `# Kop\n\n${GEHEIM}`,
        toegang: "pro",
        categorie: "Wet & regelgeving",
        auteurNaam: "Job Faber",
        gepubliceerdOp: new Date("2026-10-01T09:00:00Z"),
      },
    });
    // Een nog niet gepubliceerd artikel: mag nergens opduiken.
    await prisma.artikel.create({
      data: {
        titel: "Nog niet af",
        slug: CONCEPT,
        samenvatting: "Nog niet voor publiek.",
        inhoud: "x",
        toegang: "gratis",
        gepubliceerdOp: null,
      },
    });
  });

  after(async () => {
    await opruimen();
    await app.close();
    await prisma.$disconnect();
  });

  test("het artikel levert titel en samenvatting, maar nooit de tekst", async () => {
    const r = await app.inject({ method: "GET", url: `/artikelen/${ECHT}` });
    assert.equal(r.statusCode, 200);
    assert.ok(r.body.includes("Zo houd je je agenda AVG-proof"));
    assert.ok(r.body.includes("Wat je wel en niet mag vastleggen"));
    assert.ok(!r.body.includes(GEHEIM), "de volledige tekst lekt uit de SEO-route");
  });

  test("het artikel draagt zijn eigen canonical en markeert de afscherming", async () => {
    const r = await app.inject({ method: "GET", url: `/artikelen/${ECHT}` });
    assert.match(r.body, new RegExp(`<link rel="canonical" href="https://cmmnty\\.luzex\\.nl/artikelen/${ECHT}"`));
    assert.ok(r.body.includes('"isAccessibleForFree":"False"'));
  });

  test("?slug= geeft dezelfde pagina als het nette adres", async () => {
    const r = await app.inject({ method: "GET", url: `/artikel.html?slug=${ECHT}` });
    assert.equal(r.statusCode, 200);
    assert.ok(r.body.includes("Zo houd je je agenda AVG-proof"));
    assert.ok(!r.body.includes(GEHEIM));
  });

  test("de lijst bevat het artikel als echte link", async () => {
    const r = await app.inject({ method: "GET", url: "/artikelen.html" });
    assert.equal(r.statusCode, 200);
    assert.match(r.body, new RegExp(`<a href="/artikelen/${ECHT}">`));
    assert.ok(!r.body.includes("Artikelen laden…"), "de laadtekst hoort vervangen te zijn");
  });

  test("de sitemap komt uit de database", async () => {
    const r = await app.inject({ method: "GET", url: "/sitemap.xml" });
    assert.equal(r.statusCode, 200);
    assert.match(String(r.headers["content-type"]), /xml/);
    assert.ok(r.body.includes(`<loc>https://cmmnty.luzex.nl/artikelen/${ECHT}</loc>`));
    assert.ok(r.body.includes("<lastmod>2026-10-01</lastmod>"));
  });

  test("een onbekend artikel geeft 404", async () => {
    const r = await app.inject({ method: "GET", url: "/artikelen/bestaat-niet" });
    assert.equal(r.statusCode, 404);
  });

  test("een concept staat nergens in", async () => {
    assert.equal((await app.inject({ method: "GET", url: `/artikelen/${CONCEPT}` })).statusCode, 404);
    assert.ok(!(await app.inject({ method: "GET", url: "/artikelen.html" })).body.includes("Nog niet af"));
    assert.ok(!(await app.inject({ method: "GET", url: "/sitemap.xml" })).body.includes(`/artikelen/${CONCEPT}`));
  });
});
