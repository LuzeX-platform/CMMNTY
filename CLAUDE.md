# CLAUDE.md — LuzeX CMMNTY

Zie README.md voor wat de app doet en hoe je hem draait. Hier de afspraken voor wie code schrijft.

## Stack en structuur (bewust gelijk aan ACCRD)

```
backend/            Fastify 5 + Prisma 5 + PostgreSQL 16, TypeScript (ESM, NodeNext)
  src/app.ts          bouwApp(): plugins, CSP, CSRF-Origin-check, routes, statische frontend
  src/routes/         auth (ook account + afmelden), artikelen (publiek), profiel (+ directory), admin
  src/artikelen.ts    pure logica: slug, leestijd, Markdown → veilige HTML, toegang Pro
  src/nieuwsbrief.ts  pure logica: verzenddag, periode, segment, mailtekst
  src/nieuwsbriefVersturen.ts  database + mail rond de nieuwsbrief (preview én versturen)
  src/nieuwsbriefCron.ts       dagelijkse Render-cron
  src/luzexEntitlement.ts  Kruisproduct-Pro: controleert of een e-mailadres een actief ACCRD/SCRNN-account is
  src/kruisproductCron.ts  dagelijkse Render-cron die Kruisproduct-Pro opnieuw controleert
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

## Later (niet in MVP)

Stripe (vervangt handmatig Pro zetten in Admin → Gebruikers), reacties, favorieten, social.
