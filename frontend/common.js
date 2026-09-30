// Gedeeld door alle pagina's: de zwevende balk, de voettekst, sessie en kleine hulpfuncties.
// Geen inline <script> in de HTML: de CSP (zie backend/src/app.ts) staat alleen scripts van
// 'self' toe — zelfde afspraak als in ACCRD.

function escapeHtml(waarde) {
  const div = document.createElement("div");
  div.textContent = waarde ?? "";
  return div.innerHTML;
}

function formatteerDatum(iso) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

/** fetch met JSON heen en terug. Gooit een Error met .status en .data bij een foutstatus. */
async function api(pad, { methode = "GET", body } = {}) {
  const response = await fetch(pad, {
    method: methode,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fout = new Error(data.bericht || data.errorCode || `Fout ${response.status}`);
    fout.status = response.status;
    fout.data = data;
    throw fout;
  }
  return data;
}

const FOUTTEKSTEN = {
  ONJUISTE_INLOGGEGEVENS: "E-mailadres of wachtwoord klopt niet.",
  EMAIL_NIET_BEVESTIGD: "Bevestig eerst je e-mailadres via de link in je mailbox.",
  TOKEN_ONGELDIG: "Deze link is ongeldig of verlopen.",
  HUIDIG_WACHTWOORD_ONJUIST: "Je huidige wachtwoord klopt niet.",
  TE_VEEL_VERZOEKEN: "Even rustig aan — probeer het zo opnieuw.",
  NIET_INGELOGD: "Je bent niet (meer) ingelogd.",
  GEEN_TOEGANG: "Je hebt geen toegang tot deze pagina.",
};

/** Maakt van een API-fout één leesbare zin, inclusief de eerste veldfout als die er is. */
function foutTekst(fout) {
  const details = fout.data?.details;
  if (details) {
    const eerste = Object.values(details).flat()[0];
    if (eerste) return eerste;
  }
  return fout.data?.bericht || FOUTTEKSTEN[fout.data?.errorCode] || "Er ging iets mis. Probeer het opnieuw.";
}

let sessieBelofte;
/** De ingelogde gebruiker, of null. Eén keer opgehaald per pagina. */
function haalSessie() {
  sessieBelofte ??= fetch("/api/auth/sessie")
    .then((r) => (r.ok ? r.json() : { gebruiker: null }))
    .then((d) => d.gebruiker)
    .catch(() => null);
  return sessieBelofte;
}

/** Voor pagina's achter een login: stuurt anders door naar inloggen, met een terugweg. */
async function vereisSessie({ admin = false } = {}) {
  const gebruiker = await haalSessie();
  if (!gebruiker) {
    window.location.href = `/inloggen.html?terug=${encodeURIComponent(location.pathname + location.search)}`;
    return new Promise(() => {}); // pagina blijft staan tot de redirect er is
  }
  if (admin && gebruiker.rol !== "admin") {
    window.location.href = "/dashboard/";
    return new Promise(() => {});
  }
  return gebruiker;
}

function badgeHtml(toegang) {
  return toegang === "pro"
    ? '<span class="badge badge-pro">Pro</span>'
    : '<span class="badge badge-gratis">Gratis</span>';
}

function artikelKaartHtml(a) {
  const beeld = a.coverUrl
    ? `<div class="kaart-beeld"><img src="${escapeHtml(a.coverUrl)}" alt="" loading="lazy" /></div>`
    : '<div class="kaart-beeld" aria-hidden="true"></div>';
  return `
    <a class="kaart" href="/artikelen/${encodeURIComponent(a.slug)}">
      ${beeld}
      <div class="kaart-body">
        <div class="kaart-badges">${badgeHtml(a.toegang)}${a.categorie ? `<span class="badge">${escapeHtml(a.categorie)}</span>` : ""}</div>
        <h3>${escapeHtml(a.titel)}</h3>
        <p>${escapeHtml(a.samenvatting)}</p>
        <p class="kaart-meta">${escapeHtml(a.auteurNaam)} · ${formatteerDatum(a.gepubliceerdOp)} · ${a.leestijd} min lezen</p>
        <span class="kaart-lees">Lees meer →</span>
      </div>
    </a>`;
}

// ---------- Balk en voettekst ----------

const NAV = [
  { href: "/artikelen.html", label: "Artikelen", match: ["/artikelen"] },
  { href: "/directory.html", label: "Directory", match: ["/directory"] },
  { href: "/#over", label: "Over", match: [] },
];

function tekenBalk(gebruiker) {
  const houder = document.getElementById("balk");
  if (!houder) return;
  const pad = location.pathname;
  const links = NAV.map(
    (item) =>
      `<a href="${item.href}"${item.match.some((m) => pad.startsWith(m)) ? ' class="actief" aria-current="page"' : ""}>${item.label}</a>`,
  ).join("");

  const acties = gebruiker
    ? `${gebruiker.rol === "admin" ? '<a class="text-link" href="/admin/">Admin</a>' : ""}
       <a class="pil-knop pil-knop-donker" href="/dashboard/">Mijn Community</a>`
    : `<a class="text-link balk-inloggen" href="/inloggen.html">Inloggen</a>
       <a class="pil-knop pil-knop-donker" href="/registreren.html">Gratis lid worden</a>`;

  houder.className = "balkhouder";
  houder.innerHTML = `
    <div class="balk">
      <a href="/" class="merk" aria-label="LuzeX Community — naar de homepage">
        <span class="brand-logo" role="img" aria-label="LuzeX"></span>
        <span class="merk-product">Community</span>
      </a>
      <nav class="balk-nav" aria-label="Hoofdnavigatie">${links}</nav>
      <div class="balk-acties">${acties}</div>
    </div>`;
}

function tekenVoet() {
  const voet = document.getElementById("voet");
  if (!voet) return;
  voet.className = "voet";
  voet.innerHTML = `
    <div class="voet-boven">
      <div class="voet-merk">
        <a href="https://luzex.nl" class="brand-logo" role="img" aria-label="LuzeX — Imagination Innovation Illumination"></a>
        <p class="voet-tagline">Zorginnovatie in jip-en-janneke taal. Voor zorgprofessionals die het zelf doen.</p>
      </div>
      <div class="voet-kolom">
        <p class="voet-kop">Community</p>
        <a href="/artikelen.html">Artikelen</a>
        <a href="/directory.html">Directory</a>
        <a href="/registreren.html">Lid worden</a>
      </div>
      <div class="voet-kolom">
        <p class="voet-kop">LuzeX</p>
        <a href="https://luzex.nl" target="_blank" rel="noopener">luzex.nl</a>
        <a href="https://accrd.luzex.nl" target="_blank" rel="noopener">ACCRD</a>
        <a href="mailto:job@luzex.nl">Contact</a>
      </div>
    </div>
    <p class="voet-copyright">© ${new Date().getFullYear()} LuzeX. Alle rechten voorbehouden.</p>`;
}

// Tekent de balk meteen voor bezoekers (geen flits bij laden) en werkt hem bij zodra de sessie
// bekend is.
tekenBalk(null);
tekenVoet();
haalSessie().then((gebruiker) => {
  if (gebruiker) tekenBalk(gebruiker);
});

/** Zet de waarde van een ?parameter uit de URL. */
function queryParam(naam) {
  return new URLSearchParams(location.search).get(naam);
}

async function uitloggen() {
  await fetch("/api/auth/uitloggen", { method: "POST" });
  window.location.href = "/";
}
