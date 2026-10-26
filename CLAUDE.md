# CLAUDE.md — LuzeX CMMNTY

Zie README.md voor wat de app doet en hoe je hem draait. Hier de afspraken voor wie code schrijft.

## Stack en structuur (bewust gelijk aan ACCRD)

```
backend/            Fastify 5 + Prisma 5 + PostgreSQL 16, TypeScript (ESM, NodeNext)
  src/app.ts          bouwApp(): plugins, CSP, CSRF-Origin-check, routes, statische frontend
  src/routes/         auth (ook account + afmelden), artikelen (publiek), profiel (+ netwerk, API-pad /api/directory), admin
  src/artikelen.ts    pure logica: slug, leestijd, Markdown → veilige HTML, toegang Pro
  src/nieuwsbrief.ts  pure logica: verzenddag, periode, segment, mailtekst
  src/nieuwsbriefVersturen.ts  database + mail rond de nieuwsbrief (preview én versturen)
  src/nieuwsbriefCron.ts       dagelijkse Render-cron
  src/luzexKruisproduct.ts Kruisproduct-Pro v2: claim/controle op kvk-nummer bij ACCRD (niet meer op e-mailadres)
  src/kruisproductCron.ts  dagelijkse Render-cron die Kruisproduct-Pro opnieuw controleert
  src/stripe.ts, routes/abonnement.ts  echt betaald Pro (checkout + billing portal + webhook)
  test/               node:test via tsx; api.test.ts draait alleen met TEST_DATABASE_URL
frontend/           losse HTML + één script per pagina(groep), geen build-stap
  styles.css          design tokens 1-op-1 uit ACCRD (platform/frontend/styles.css) + CMMNTY-componenten
  common.js           balk, voettekst, api(), sessie, kaartjes — door elke pagina geladen
```

## Afspraken

- **Nederlands** in UI, code-identifiers en commentaar, zoals in ACCRD.
- **Geen inline scripts of event handlers** in HTML: de CSP staat alleen `script-src 'self'` toe.
- **Huisstijl**: tokens niet herdefiniëren. Wijzig je er één, doe het dan ook in ACCRD.
- **Pure logica los van database/mail** (artikelen.ts, nieuwsbrief.ts) zodat die testbaar blijft.
- **Pro-toegang** loopt altijd via `magVolledigLezen()`; de inhoud van een Pro-artikel verlaat de
  server nooit voor wie geen toegang heeft (ook niet verborgen in de HTML).
- **Markdown-HTML** gaat altijd door `renderMarkdown()` (sanitize-html) — ook al schrijft alleen Job.
- **Nieuwsbrief-periode** = sinds de vorige verzending van dat segment, zodat niets dubbel of
  niet meegaat. Een segment zonder nieuwe artikelen wordt overgeslagen en telt niet als verzending.
- Sessiecookie is `SameSite=Lax` (niet Strict zoals ACCRD): anders ziet een Pro-lid dat vanuit
  de nieuwsbrief doorklikt het artikel als uitgelogd. CSRF blijft gedekt door de Origin-check.
- **Kruisproduct-Pro** (zie hub/CLAUDE.md voor de volledige afspraak): `abonnementBron` is
  alleen "accrd"/"scrnn" als Pro daarvandaan kwam, en moet dan ook altijd expliciet op `null`
  als iemand het handmatig overschrijft (de admin-route doet dit al) — anders draait
  `kruisproductCron.ts` een bewuste handmatige keuze de volgende dag terug.

- **Stripe** (`src/stripe.ts`, `routes/abonnement.ts`) is een derde, onafhankelijke bron voor
  `abonnement`/`abonnementBron`, naast de admin en Kruisproduct-Pro. Een geslaagde checkout zet
  ook `kruisproductKvkNummer` op `null` — anders pakt `kruisproductCron.ts` een inmiddels
  betalende klant alsnog terug op, puur omdat er ooit een kvk-nummer geclaimd is.

## Wekelijkse artikelen ("Zorgtech deze week")

Volg `content/REDACTIE.md`: wat erin komt (de hele zorg, alleen de echt grote innovaties), de
mix per week (AI 1–2, Pro 1–2), feitencontrole en de techniek. Illustraties maak je met de
hulpjes in `content/illustraties/` (`stijl.py` voor de SVG, `render.mjs` voor de JPG).

## Later (niet in MVP)

Reacties, favorieten, social.
