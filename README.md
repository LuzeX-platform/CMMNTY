# LuzeX Community

Een web app onder het LuzeX-merk voor zorgprofessionals: artikelen over innovatie in de zorg
(gratis en Pro), een ZZP-directory en een automatische nieuwsbrief.

Dezelfde stack en huisstijl als ACCRD, maar **volledig los** daarvan: eigen database, eigen
deployment, eigen geheimen.

| Onderdeel   | Keuze (gelijk aan ACCRD) |
|-------------|--------------------------|
| Backend     | Node 22, Fastify 5, TypeScript |
| Database    | PostgreSQL 16 via Prisma 5 |
| Frontend    | Losse HTML/CSS/JS, geserveerd door dezelfde server (geen build-stap) |
| Inloggen    | E-mail + wachtwoord (Argon2id), sessie in een httpOnly-cookie |
| Mail        | SMTP via nodemailer — werkt met Mailgun én SendGrid |
| Hosting     | Render (Blueprint in `render.yaml`), regio Frankfurt |

## Wat zit erin

- **Artikelen** — Markdown, gratis of Pro, categorie, cover, auteur, publicatiedatum (concept /
  nu / ingepland). Pro-artikelen tonen aan wie geen toegang heeft alleen titel en samenvatting.
- **Leden** — registreren met bevestigingsmail, inloggen, wachtwoord vergeten, account
  wijzigen of verwijderen (AVG).
- **Directory** — leden publiceren zelf een profiel (specialismen, regio, contact, bio van
  max. 250 tekens). Openbaar, filterbaar op specialisme en regio.
- **Nieuwsbrief** — wekelijks (maandag) of maandelijks (de 1e), in te stellen door Job.
  Gratis-leden krijgen alleen gratis artikelen, Pro-leden alles. Met voorbeeld, testmail,
  handmatig versturen en afmeldlink (ook één-klik in Gmail/Apple Mail).
- **Admin** (alleen Job) — artikelen beheren met live voorvertoning, gebruikers bekijken en
  handmatig op Pro zetten, nieuwsbrief beheren.

**Pro zonder betaling:** zolang Stripe er niet is, zet Job iemand in *Admin → Gebruikers* op Pro.

## Pagina's

| Pad | Wat |
|-----|-----|
| `/` | Homepage |
| `/artikelen.html`, `/artikelen/<slug>` | Overzicht en artikel |
| `/directory.html` | ZZP-directory |
| `/registreren.html`, `/inloggen.html` | Lid worden, inloggen |
| `/dashboard/` | Mijn artikelen, mijn profiel, account |
| `/admin/` | Artikelen, gebruikers, nieuwsbrief |

## Lokaal draaien

```bash
docker compose up -d                  # PostgreSQL 16 (of gebruik een eigen Postgres)
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed                          # admin@luzex.local / wijzig-dit-meteen
npm run dev                           # http://localhost:4100
```

Zonder `SMTP_HOST` worden mails niet verstuurd maar in de console gelogd — kopieer de
bevestigingslink daaruit.

## Tests

```bash
cd backend
npm run typecheck
npm test                              # unit tests
# Plus integratietests (maken de tabellen leeg — gebruik een aparte database!):
TEST_DATABASE_URL=postgresql://…/community_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://…/community_test npm test
```

GitHub Actions draait beide bij elke push (`.github/workflows/test.yml`).

## Naar Render

1. Render → **New + → Blueprint** → kies deze repository → **Apply**.
2. Vul bij het aanmaken in: `SEED_ADMIN_EMAIL` en `SEED_ADMIN_WACHTWOORD` (Jobs login) en de
   `SMTP_*`-waarden (voor beide services: web én nieuwsbrief-cron).
3. Pas `APP_URL` aan als het domein anders wordt dan `https://community.luzex.nl`, en koppel het
   domein in Render (Settings → Custom Domains).

### Mailgun of SendGrid

Beide via SMTP; kiezen is alleen andere waarden invullen.

| | Mailgun (EU) | SendGrid |
|---|---|---|
| `SMTP_HOST` | `smtp.eu.mailgun.org` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` | `587` |
| `SMTP_USER` | `postmaster@mg.luzex.nl` | `apikey` |
| `SMTP_WACHTWOORD` | SMTP-wachtwoord van het domein | de API-key |
| `SMTP_AFZENDER` | `LuzeX Community <community@mg.luzex.nl>` | idem, geverifieerd adres |

Zet SPF/DKIM voor het afzenddomein goed (staat in het Mailgun/SendGrid-dashboard), anders
belandt de nieuwsbrief in spam. Mailgun EU houdt de data in de EU (AVG).

### Kosten (Render, indicatief)

Web service *starter* ± $7, cron *starter* ± $1 (draait een paar seconden per dag),
database *basic-256mb* ± $6 per maand. Mailgun/SendGrid: gratis tot een paar duizend mails per maand.
