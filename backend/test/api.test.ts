// Integratietest over de echte API + database. Draait alleen met TEST_DATABASE_URL gezet
// (een lege, wegwerpbare database — de tabellen worden leeggemaakt!). Lokaal:
//   TEST_DATABASE_URL=postgresql://…/community_test npx prisma migrate deploy
//   TEST_DATABASE_URL=postgresql://…/community_test npm test
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe("API", { skip: !TEST_DB && "TEST_DATABASE_URL niet gezet" }, () => {
  process.env.DATABASE_URL = TEST_DB;
  process.env.JWT_SECRET ??= "test-geheim";
  process.env.APP_URL = "http://community.test";
  delete process.env.SMTP_HOST;

  let app: import("fastify").FastifyInstance;
  let prisma: import("@prisma/client").PrismaClient;
  const mails: string[] = [];
  const origineleWarn = console.warn;

  // Zonder SMTP_HOST logt de mailer elke mail via console.warn: daar vissen we de links uit.
  const laatsteLink = (pad: string) => {
    const mail = [...mails].reverse().find((m) => m.includes(pad));
    const match = mail?.match(new RegExp(`${pad.replace(/[.?]/g, "\\$&")}\\?token=([a-f0-9]+)`));
    assert.ok(match, `geen mail met ${pad}`);
    return match[1];
  };

  const cookieUit = (res: { headers: Record<string, unknown> }) => {
    const header = res.headers["set-cookie"];
    const cookie = (Array.isArray(header) ? header[0] : String(header)).split(";")[0];
    return cookie;
  };

  before(async () => {
    console.warn = (...args: unknown[]) => void mails.push(args.join(" "));
    ({ prisma } = await import("../src/db.js"));
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Gebruiker", "Profiel", "Artikel", "NieuwsbriefVerzending", "Instellingen" CASCADE',
    );
    const { hashWachtwoord } = await import("../src/auth.js");
    await prisma.gebruiker.create({
      data: {
        email: "job@test.nl",
        naam: "Job",
        rol: "admin",
        abonnement: "pro",
        emailBevestigdOp: new Date(),
        wachtwoordHash: await hashWachtwoord("admin-wachtwoord"),
      },
    });
    const { bouwApp } = await import("../src/app.js");
    app = await bouwApp({ logger: false });
  });

  after(async () => {
    console.warn = origineleWarn;
    await app?.close();
    await prisma?.$disconnect();
  });

  let adminCookie = "";
  let lidCookie = "";

  test("admin logt in en maakt een gratis en een Pro-artikel", async () => {
    const login = await app.inject({ method: "POST", url: "/api/auth/inloggen", payload: { email: "job@test.nl", wachtwoord: "admin-wachtwoord" } });
    assert.equal(login.statusCode, 200);
    adminCookie = cookieUit(login);

    for (const [titel, toegang] of [["Gratis tip", "gratis"], ["Pro verdieping", "pro"]]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/artikelen",
        headers: { cookie: adminCookie },
        payload: { titel, samenvatting: "Kort", inhoud: "## Kop\n\nGeheime inhoud", toegang, categorie: "Tools & software", gepubliceerdOp: new Date(Date.now() - 1000).toISOString() },
      });
      assert.equal(res.statusCode, 201, res.body);
    }
    // Een concept is niet openbaar.
    await app.inject({
      method: "POST",
      url: "/api/admin/artikelen",
      headers: { cookie: adminCookie },
      payload: { titel: "Concept", samenvatting: "x", inhoud: "x", toegang: "gratis", categorie: "", gepubliceerdOp: null },
    });
    const lijst = await app.inject({ method: "GET", url: "/api/artikelen" });
    assert.equal(lijst.json().totaal, 2);
  });

  test("dubbele titel krijgt een unieke slug", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/artikelen",
      headers: { cookie: adminCookie },
      payload: { titel: "Gratis tip", samenvatting: "x", inhoud: "x", toegang: "gratis", categorie: "", gepubliceerdOp: null },
    });
    assert.equal(res.json().slug, "gratis-tip-2");
  });

  test("admin-routes zijn dicht voor bezoekers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/artikelen" });
    assert.equal(res.statusCode, 401);
  });

  test("bezoeker zonder account ziet gratis én Pro alleen als etalage", async () => {
    const gratis = (await app.inject({ method: "GET", url: "/api/artikelen/gratis-tip" })).json();
    assert.equal(gratis.inhoudHtml, null);
    assert.equal(gratis.vergrendeld, "inloggen");
    assert.equal(gratis.samenvatting, "Kort");
    const pro = (await app.inject({ method: "GET", url: "/api/artikelen/pro-verdieping" })).json();
    assert.equal(pro.inhoudHtml, null);
    assert.equal(pro.vergrendeld, "inloggen");
    assert.equal(pro.samenvatting, "Kort");
    assert.equal(pro.gerelateerd.length, 1);
  });

  test("concept: onzichtbaar voor bezoekers, als voorbeeld zichtbaar voor de admin", async () => {
    const bezoeker = await app.inject({ method: "GET", url: "/api/artikelen/concept" });
    assert.equal(bezoeker.statusCode, 404);
    const lijst = (await app.inject({ method: "GET", url: "/api/artikelen", headers: { cookie: adminCookie } })).json();
    assert.ok(!lijst.artikelen.some((a: { slug: string }) => a.slug === "concept"), "concept hoort niet in de lijst");
    const admin = await app.inject({ method: "GET", url: "/api/artikelen/concept", headers: { cookie: adminCookie } });
    assert.equal(admin.statusCode, 200);
    assert.equal(admin.json().voorbeeld, true);
    const gepubliceerd = (await app.inject({ method: "GET", url: "/api/artikelen/gratis-tip", headers: { cookie: adminCookie } })).json();
    assert.equal(gepubliceerd.voorbeeld, false);
  });

  test("registreren → niet inloggen vóór bevestigen → bevestigen logt in", async () => {
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/registreren",
      payload: { email: "Sanne@Test.nl", wachtwoord: "geheim123", nieuwsbrief: true },
    });
    assert.equal(reg.statusCode, 200);

    const tevroeg = await app.inject({ method: "POST", url: "/api/auth/inloggen", payload: { email: "sanne@test.nl", wachtwoord: "geheim123" } });
    assert.equal(tevroeg.json().errorCode, "EMAIL_NIET_BEVESTIGD");

    const bevestig = await app.inject({ method: "POST", url: "/api/auth/bevestigen", payload: { token: laatsteLink("/bevestigen.html") } });
    assert.equal(bevestig.statusCode, 200);
    lidCookie = cookieUit(bevestig);

    const me = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: lidCookie } })).json();
    assert.equal(me.email, "sanne@test.nl");
    assert.equal(me.abonnement, "gratis");
    assert.equal(me.nieuwsbrief, true);

    // Met account wel: het gratis artikel is nu helemaal te lezen.
    const gratis = (await app.inject({ method: "GET", url: "/api/artikelen/gratis-tip", headers: { cookie: lidCookie } })).json();
    assert.match(gratis.inhoudHtml, /Geheime inhoud/);
  });

  test("registreren zonder vinkje: niet op de nieuwsbrief", async () => {
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/registreren",
      payload: { email: "geen-nieuwsbrief@test.nl", wachtwoord: "geheim123" },
    });
    assert.equal(reg.statusCode, 200);
    const rij = await prisma.gebruiker.findUniqueOrThrow({ where: { email: "geen-nieuwsbrief@test.nl" } });
    assert.equal(rij.nieuwsbrief, false);
    assert.equal(rij.naam, "");
  });

  test("kruisproduct-Pro v2: een actief ACCRD-kvk-nummer geeft gratis Pro via de claim-route", async () => {
    // Nep-ACCRD: kent alleen kvk-nummer "11112222" toe, en alleen aan "cmmnty".
    const http = await import("node:http");
    const nepAccrd = http.createServer((req, res) => {
      const juisteSleutel = req.headers["x-luzex-intern-sleutel"] === "test-sleutel";
      res.setHeader("content-type", "application/json");
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const { kvkNummer, product } = JSON.parse(body || "{}");
        const toegekend = juisteSleutel && kvkNummer === "11112222" && product === "cmmnty";
        res.end(JSON.stringify({ status: toegekend ? "toegekend" : "niet_actief" }));
      });
    });
    await new Promise<void>((resolve) => nepAccrd.listen(0, resolve));
    const poort = (nepAccrd.address() as import("node:net").AddressInfo).port;
    process.env.ACCRD_INTERN_URL = `http://127.0.0.1:${poort}`;
    process.env.LUZEX_INTERN_SLEUTEL = "test-sleutel";

    try {
      const afgewezen = await app.inject({
        method: "POST",
        url: "/api/account/kruisproduct-claim",
        headers: { cookie: lidCookie },
        payload: { kvkNummer: "00000000" },
      });
      assert.equal(afgewezen.statusCode, 400);

      const toegekend = await app.inject({
        method: "POST",
        url: "/api/account/kruisproduct-claim",
        headers: { cookie: lidCookie },
        payload: { kvkNummer: "11112222" },
      });
      assert.equal(toegekend.json().status, "toegekend");

      const me = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: lidCookie } })).json();
      assert.equal(me.abonnement, "pro");

      const rij = await prisma.gebruiker.findUniqueOrThrow({ where: { email: "sanne@test.nl" } });
      assert.equal(rij.abonnementBron, "accrd");
      assert.equal(rij.kruisproductKvkNummer, "11112222");

      // Terugzetten: de hierna volgende tests gaan ervan uit dat sanne weer gratis lid is.
      await prisma.gebruiker.update({
        where: { id: rij.id },
        data: { abonnement: "gratis", abonnementBron: null, kruisproductKvkNummer: null },
      });
    } finally {
      delete process.env.ACCRD_INTERN_URL;
      delete process.env.LUZEX_INTERN_SLEUTEL;
      await new Promise((resolve) => nepAccrd.close(resolve));
    }
  });

  test("gratis lid ziet Pro nog steeds niet; na upgrade door admin wel", async () => {
    const voor = (await app.inject({ method: "GET", url: "/api/artikelen/pro-verdieping", headers: { cookie: lidCookie } })).json();
    assert.equal(voor.vergrendeld, "pro_nodig");

    const me = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: lidCookie } })).json();
    const upgrade = await app.inject({ method: "PATCH", url: `/api/admin/gebruikers/${me.id}`, headers: { cookie: adminCookie }, payload: { abonnement: "pro" } });
    assert.equal(upgrade.statusCode, 200);

    const na = (await app.inject({ method: "GET", url: "/api/artikelen/pro-verdieping", headers: { cookie: lidCookie } })).json();
    assert.match(na.inhoudHtml, /Geheime inhoud/);

    await app.inject({ method: "PATCH", url: `/api/admin/gebruikers/${me.id}`, headers: { cookie: adminCookie }, payload: { abonnement: "gratis" } });
  });

  test("lid-routes weigeren een admin-actie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/gebruikers", headers: { cookie: lidCookie } });
    assert.equal(res.statusCode, 403);
  });

  test("adminpagina's: zonder inloggen naar het inlogscherm, een lid naar zijn dashboard", async () => {
    const bezoeker = await app.inject({ method: "GET", url: "/admin/" });
    assert.equal(bezoeker.statusCode, 302);
    assert.equal(bezoeker.headers.location, "/inloggen.html?terug=%2Fadmin%2F");
    const script = await app.inject({ method: "GET", url: "/admin/admin.js" });
    assert.equal(script.statusCode, 302);
    const lid = await app.inject({ method: "GET", url: "/admin/gebruikers.html", headers: { cookie: lidCookie } });
    assert.equal(lid.headers.location, "/dashboard/");
    const admin = await app.inject({ method: "GET", url: "/admin/", headers: { cookie: adminCookie } });
    assert.equal(admin.statusCode, 200);
    assert.match(admin.body, /Alle artikelen/);

    // De admin-sessie duurt een werkdag, die van een lid 30 dagen.
    const login = await app.inject({ method: "POST", url: "/api/auth/inloggen", payload: { email: "job@test.nl", wachtwoord: "admin-wachtwoord" } });
    assert.match(String(login.headers["set-cookie"]), /Max-Age=28800/);
  });

  test("profiel publiceren → verschijnt in directory, filterbaar", async () => {
    const zonderContact = await app.inject({
      method: "PUT",
      url: "/api/profiel",
      headers: { cookie: lidCookie },
      payload: { weergavenaam: "Sanne", praktijknaam: "Praktijk Vries", specialismen: ["Seksuologie"], telefoon: "", website: "", contactEmail: "", bio: "Hoi", regio: "Oost", gepubliceerd: true },
    });
    assert.equal(zonderContact.statusCode, 400);

    const ok = await app.inject({
      method: "PUT",
      url: "/api/profiel",
      headers: { cookie: lidCookie },
      payload: { weergavenaam: "Sanne", praktijknaam: "Praktijk Vries", specialismen: ["Seksuologie"], telefoon: "06-12345678", website: "www.praktijkvries.nl", contactEmail: "", bio: "Hoi", regio: "Oost", gepubliceerd: true },
    });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ok.json().website, "https://www.praktijkvries.nl");

    const teLang = await app.inject({
      method: "PUT",
      url: "/api/profiel",
      headers: { cookie: lidCookie },
      payload: { weergavenaam: "Sanne", praktijknaam: "", specialismen: [], telefoon: "0612345678", website: "", contactEmail: "", bio: "x".repeat(251), regio: "", gepubliceerd: true },
    });
    assert.equal(teLang.statusCode, 400);

    const treffer = (await app.inject({ method: "GET", url: "/api/directory?specialisme=Seksuologie&regio=Oost" })).json();
    assert.equal(treffer.profielen.length, 1);
    const mis = (await app.inject({ method: "GET", url: "/api/directory?regio=Noord" })).json();
    assert.equal(mis.profielen.length, 0);
  });

  test("nieuwsbrief: gratis-segment krijgt alleen gratis artikelen, daarna niets dubbel", async () => {
    mails.length = 0;
    const res = await app.inject({ method: "POST", url: "/api/admin/nieuwsbrief/versturen", headers: { cookie: adminCookie } });
    const { resultaten } = res.json();
    const gratis = resultaten.find((r: { segment: string }) => r.segment === "gratis");
    const pro = resultaten.find((r: { segment: string }) => r.segment === "pro");
    assert.deepEqual([gratis.aantalArtikelen, gratis.aantalOntvangers], [1, 1]);
    assert.deepEqual([pro.aantalArtikelen, pro.aantalOntvangers], [2, 1]); // alleen de admin is Pro

    const aanSanne = mails.find((m) => m.includes("sanne@test.nl"))!;
    assert.match(aanSanne, /Gratis tip/);
    assert.doesNotMatch(aanSanne, /Pro verdieping/);

    const opnieuw = (await app.inject({ method: "POST", url: "/api/admin/nieuwsbrief/versturen", headers: { cookie: adminCookie } })).json();
    assert.ok(opnieuw.resultaten.every((r: { overgeslagen?: string }) => r.overgeslagen));
  });

  test("afmelden via de link uit de nieuwsbrief", async () => {
    const { maakAfmeldToken } = await import("../src/auth.js");
    const sanne = await prisma.gebruiker.findUniqueOrThrow({ where: { email: "sanne@test.nl" } });
    const res = await app.inject({ method: "POST", url: "/api/nieuwsbrief/afmelden", payload: { token: maakAfmeldToken(sanne.id) } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.gebruiker.findUniqueOrThrow({ where: { id: sanne.id } })).nieuwsbrief, false);

    const eenKlik = await app.inject({
      method: "POST",
      url: `/api/nieuwsbrief/afmelden-een-klik?token=${encodeURIComponent(maakAfmeldToken(sanne.id))}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "List-Unsubscribe=One-Click",
    });
    assert.equal(eenKlik.statusCode, 200);
  });

  test("wachtwoord vergeten → resetten → inloggen met nieuw wachtwoord", async () => {
    await app.inject({ method: "POST", url: "/api/auth/wachtwoord-vergeten", payload: { email: "sanne@test.nl" } });
    const reset = await app.inject({
      method: "POST",
      url: "/api/auth/wachtwoord-resetten",
      payload: { token: laatsteLink("/wachtwoord-resetten.html"), nieuwWachtwoord: "nieuwgeheim456" },
    });
    assert.equal(reset.statusCode, 200);
    const login = await app.inject({ method: "POST", url: "/api/auth/inloggen", payload: { email: "sanne@test.nl", wachtwoord: "nieuwgeheim456" } });
    assert.equal(login.statusCode, 200);
  });

  test("oud adres /directory.html stuurt door naar /netwerk.html", async () => {
    const res = await app.inject({ method: "GET", url: "/directory.html" });
    assert.equal(res.statusCode, 301);
    assert.equal(res.headers.location, "/netwerk.html");
    const pagina = await app.inject({ method: "GET", url: "/netwerk.html" });
    assert.equal(pagina.statusCode, 200);
    assert.match(pagina.body, /<p class="kicker">Netwerk<\/p>/);
  });

  test("vreemde Origin wordt geweigerd (CSRF)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/uitloggen",
      headers: { origin: "https://kwaadaardig.example", host: "community.test" },
    });
    assert.equal(res.statusCode, 403);
  });

  test("account verwijderen haalt ook het profiel weg", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/account", headers: { cookie: lidCookie }, payload: { wachtwoord: "nieuwgeheim456" } });
    assert.equal(res.statusCode, 200);
    const directory = (await app.inject({ method: "GET", url: "/api/directory" })).json();
    assert.equal(directory.profielen.length, 0);
  });

  // Het importscript echt draaien (als los proces, zoals in de Render Shell) tegen de testdatabase.
  test("importscript --afbeeldingen-aanvullen: alleen een afbeelding waar er nog geen is, verder niets", async () => {
    const map = fs.mkdtempSync(path.join(os.tmpdir(), "cmmnty-import-"));
    const md = (slug: string) =>
      `---\ntitel: "Tekst uit het bestand"\nslug: ${slug}\nsamenvatting: "Uit bestand"\ncategorie: Behandelen\ncover: plaatje.png\n---\n\nNieuwe tekst uit het bestand.\n`;
    fs.writeFileSync(path.join(map, "zonder.md"), md("import-zonder-afbeelding"));
    fs.writeFileSync(path.join(map, "met.md"), md("import-met-afbeelding"));
    fs.writeFileSync(path.join(map, "plaatje.png"), Buffer.from("png-uit-bestand"));

    const gepubliceerd = new Date("2026-10-01T08:00:00Z");
    const basis = { samenvatting: "Door Job aangepast", inhoud: "Door Job aangepaste tekst", toegang: "gratis", gepubliceerdOp: gepubliceerd };
    await prisma.artikel.create({ data: { ...basis, titel: "Zonder", slug: "import-zonder-afbeelding" } });
    await prisma.artikel.create({
      data: { ...basis, titel: "Met", slug: "import-met-afbeelding", coverAfbeelding: Buffer.from("handmatig"), coverMime: "image/jpeg" },
    });

    const draai = (...extra: string[]) =>
      execFileSync(process.execPath, ["--import", "tsx", "src/importeerArtikelen.ts", map, ...extra], {
        env: { ...process.env, DATABASE_URL: TEST_DB },
        encoding: "utf8",
      });
    const lees = (slug: string) => prisma.artikel.findUniqueOrThrow({ where: { slug } });

    // Zonder de optie: niets aangeraakt.
    draai();
    assert.equal((await lees("import-zonder-afbeelding")).coverMime, null);

    const uitvoer = draai("--afbeeldingen-aanvullen");
    assert.match(uitvoer, /1 afbeelding\(en\) toegevoegd/);
    const zonder = await lees("import-zonder-afbeelding");
    assert.equal(zonder.coverMime, "image/png");
    assert.equal(Buffer.from(zonder.coverAfbeelding!).toString(), "png-uit-bestand");
    // Tekst, titel en publicatiedatum blijven zoals Job ze had.
    assert.equal(zonder.inhoud, "Door Job aangepaste tekst");
    assert.equal(zonder.titel, "Zonder");
    assert.equal(zonder.gepubliceerdOp?.toISOString(), gepubliceerd.toISOString());
    // Een afbeelding die er al was, blijft staan.
    const met = await lees("import-met-afbeelding");
    assert.equal(Buffer.from(met.coverAfbeelding!).toString(), "handmatig");

    // Nog een keer: niets meer te doen.
    assert.match(draai("--afbeeldingen-aanvullen"), /0 afbeelding\(en\) toegevoegd/);
    fs.rmSync(map, { recursive: true, force: true });
  });

  test("bulk: concepten in één keer publiceren, wat al online staat houdt zijn datum", async () => {
    const maak = async (titel: string, gepubliceerdOp: string | null) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/admin/artikelen",
          headers: { cookie: adminCookie },
          payload: { titel, samenvatting: "x", inhoud: "x", toegang: "gratis", categorie: "", gepubliceerdOp },
        })
      ).json() as { id: string };
    const een = await maak("Bulk een", null);
    const twee = await maak("Bulk twee", null);
    const al = "2026-09-01T08:00:00.000Z";
    const online = await maak("Bulk al online", al);
    const bulk = (payload: unknown, cookie?: string) =>
      app.inject({ method: "POST", url: "/api/admin/artikelen/bulk", headers: cookie ? { cookie } : {}, payload });

    assert.equal((await bulk({ ids: [een.id], actie: "publiceren" })).statusCode, 401);
    assert.equal((await bulk({ ids: [], actie: "publiceren" }, adminCookie)).statusCode, 400);

    const res = await bulk({ ids: [twee.id, een.id, online.id, "bestaat-niet"], actie: "publiceren" }, adminCookie);
    assert.deepEqual(res.json(), { bijgewerkt: 2, overgeslagen: 2 });
    const slugs = (await app.inject({ method: "GET", url: "/api/artikelen?limiet=50" })).json().artikelen.map((a: { slug: string }) => a.slug);
    // Wat het eerst is aangemaakt, staat bovenaan; het artikel dat al online stond, is niet verplaatst.
    assert.ok(slugs.indexOf("bulk-een") < slugs.indexOf("bulk-twee"), slugs.join(","));
    assert.equal((await prisma.artikel.findUniqueOrThrow({ where: { id: online.id } })).gepubliceerdOp?.toISOString(), al);

    const terug = await bulk({ ids: [een.id, twee.id], actie: "concept" }, adminCookie);
    assert.deepEqual(terug.json(), { bijgewerkt: 2, overgeslagen: 0 });
    assert.equal((await app.inject({ method: "GET", url: "/api/artikelen/bulk-een" })).statusCode, 404);
  });
});
