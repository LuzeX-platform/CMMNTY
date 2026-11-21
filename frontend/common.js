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

// Pro en Gratis verschillen in kleur én vorm, zodat het verschil ook zonder kleur te zien is:
// Pro is grafiet met een slotje, Gratis is wit met een groen stipje.
const SLOTJE = '<svg class="badge-icoon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="3.2" y="7" width="9.6" height="7" rx="1.8" fill="currentColor"/></svg>';

function badgeHtml(toegang) {
  return toegang === "pro"
    ? `<span class="badge badge-pro">${SLOTJE}Pro</span>`
    : '<span class="badge badge-gratis"><span class="badge-stip" aria-hidden="true"></span>Gratis</span>';
}

// meteen: de bovenste kaarten van een lijst laden hun foto direct; de rest pas als je ernaartoe scrolt.
// (Via .map(artikelKaartHtml) komt hier een getal binnen; dat telt als "niet meteen".)
function artikelKaartHtml(a, opties) {
  const laden = opties?.meteen ? "eager" : "lazy";
  const beeld = a.coverUrl
    ? `<div class="kaart-beeld"><img src="${escapeHtml(a.coverUrl)}" alt="" width="1600" height="900" loading="${laden}" decoding="async" /></div>`
    : '<div class="kaart-beeld" aria-hidden="true"></div>';
  return `
    <a class="kaart kaart-artikel" href="/artikelen/${encodeURIComponent(a.slug)}">
      ${beeld}
      <div class="kaart-body">
        <div class="kaart-badges">${badgeHtml(a.toegang)}${a.categorie ? `<span class="badge badge-categorie">${escapeHtml(a.categorie)}</span>` : ""}</div>
        <h3>${escapeHtml(a.titel)}</h3>
        <p class="kaart-samenvatting">${escapeHtml(a.samenvatting)}</p>
        <p class="kaart-meta">${escapeHtml(a.auteurNaam)} · ${formatteerDatum(a.gepubliceerdOp)} · ${a.leestijd} min lezen</p>
        <span class="kaart-lees">Lees meer →</span>
      </div>
    </a>`;
}

// ---------- Netwerk ----------

function profielKaartHtml(p) {
  const contact = [];
  if (p.telefoon) contact.push(`<li>📞 <a href="tel:${escapeHtml(p.telefoon.replace(/[^0-9+]/g, ""))}">${escapeHtml(p.telefoon)}</a></li>`);
  if (p.contactEmail) contact.push(`<li>✉️ <a href="mailto:${escapeHtml(p.contactEmail)}">${escapeHtml(p.contactEmail)}</a></li>`);
  if (p.website) {
    const zichtbaar = p.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
    contact.push(`<li>🌐 <a href="${escapeHtml(p.website)}" target="_blank" rel="noopener nofollow">${escapeHtml(zichtbaar)}</a></li>`);
  }
  return `
    <div class="kaart profiel-kaart">
      <div class="kaart-body">
        <div class="kaart-badges">
          ${p.regio ? `<span class="badge">${escapeHtml(p.regio)}</span>` : ""}
          ${p.specialismen.map((s) => `<span class="badge badge-specialisme">${escapeHtml(s)}</span>`).join("")}
        </div>
        <h3>${escapeHtml(p.weergavenaam)}</h3>
        ${p.praktijknaam ? `<p class="profiel-praktijk">${escapeHtml(p.praktijknaam)}</p>` : ""}
        ${p.bio ? `<p>${escapeHtml(p.bio)}</p>` : ""}
        <ul class="profiel-contact">${contact.join("")}</ul>
      </div>
    </div>`;
}

/**
 * De volgende stap richting het netwerk, passend bij wie er kijkt: een bezoeker wordt lid, een
 * lid zonder zichtbaar profiel zet zijn praktijk erin, wie er al in staat zoekt collega's.
 */
function netwerkStap(gebruiker) {
  if (!gebruiker) {
    return {
      kop: "Zelfstandig in de zorg?",
      tekst: "In het CMMNTY-netwerk vinden collega's en verwijzers je op specialisme en regio. Gratis voor leden.",
      knoppen: [["Gratis lid worden", "/registreren.html"], ["Bekijk het netwerk", "/netwerk.html"]],
    };
  }
  if (!gebruiker.inNetwerk) {
    return {
      kop: "Sta jij al in het netwerk?",
      tekst: "Zet je praktijk erin, dan vinden collega's en verwijzers je op specialisme en regio. Gratis, en in twee minuten geregeld.",
      knoppen: [["Deel jouw expertise", "/dashboard/profiel.html"], ["Bekijk het netwerk", "/netwerk.html"]],
    };
  }
  return {
    kop: "Vind een collega",
    tekst: "Zoek in het netwerk op specialisme en regio. Voor een verwijzing, overleg of vervanging.",
    knoppen: [["Bekijk het netwerk", "/netwerk.html"], ["Mijn netwerkprofiel", "/dashboard/profiel.html"]],
  };
}

/** De specialismen als <option>s, in groepen (<optgroup>), voor de zoeklijsten. */
function specialismeOptiesHtml(groepen) {
  return groepen
    .map(
      (g) =>
        `<optgroup label="${escapeHtml(g.naam)}">${g.specialismen
          .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
          .join("")}</optgroup>`,
    )
    .join("");
}

function netwerkKnoppenHtml(knoppen) {
  return knoppen
    .map(([label, href], i) => `<a class="pil-knop ${i === 0 ? "pil-knop-donker" : "pil-knop-glas"}" href="${href}">${label}</a>`)
    .join("");
}

/** Blok dat uitnodigt tot de volgende stap in het netwerk (onder artikelen). */
function netwerkBlokHtml(gebruiker) {
  const stap = netwerkStap(gebruiker);
  return `
    <aside class="panel netwerk-blok" aria-label="Netwerk">
      <p class="kicker">Netwerk</p>
      <h2>${stap.kop}</h2>
      <p>${stap.tekst}</p>
      <div class="formulier-acties">${netwerkKnoppenHtml(stap.knoppen)}</div>
    </aside>`;
}

// ---------- Balk en voettekst ----------

const NAV = [
  { href: "/netwerk.html", label: "Netwerk", match: ["/netwerk"] },
  { href: "/artikelen.html", label: "Artikelen", match: ["/artikelen"] },
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

  // De hoofdknop staat rechts in de balk. Op een telefoon krijgt hij een kortere tekst, en op de
  // smalste telefoons staat hij in het uitklapmenu (zie styles.css).
  const hoofdknop = gebruiker
    ? { href: "/dashboard/", lang: "Mijn CMMNTY", kort: "Mijn CMMNTY" }
    : { href: "/registreren.html", lang: "Gratis lid worden", kort: "Lid worden" };
  const extraMobiel = gebruiker
    ? `${gebruiker.rol === "admin" ? '<a class="alleen-mobiel" href="/admin/">Admin</a>' : ""}`
    : '<a class="alleen-mobiel" href="/inloggen.html">Inloggen</a>';

  const acties = `${gebruiker?.rol === "admin" ? '<a class="text-link balk-inloggen" href="/admin/">Admin</a>' : ""}
       ${gebruiker ? "" : '<a class="text-link balk-inloggen" href="/inloggen.html">Inloggen</a>'}
       <a class="pil-knop pil-knop-donker" href="${hoofdknop.href}"><span class="knop-lang">${hoofdknop.lang}</span><span class="knop-kort">${hoofdknop.kort}</span></a>`;

  houder.className = "balkhouder";
  houder.innerHTML = `
    <div class="balk">
      <a href="/" class="merk" aria-label="LuzeX CMMNTY — naar de homepage">
        <span class="brand-logo" role="img" aria-label="CMMNTY — Samen beter in de zorg."></span>
      </a>
      <nav class="balk-nav" id="balk-nav" aria-label="Hoofdnavigatie">${links}${extraMobiel}<a class="pil-knop pil-knop-donker alleen-mobiel" href="${hoofdknop.href}">${hoofdknop.lang}</a></nav>
      <div class="balk-acties">${acties}</div>
      <button type="button" class="balk-menuknop" aria-expanded="false" aria-controls="balk-nav" aria-label="Menu openen"><span></span><span></span><span></span></button>
    </div>`;

  const balk = houder.querySelector(".balk");
  const menuknop = houder.querySelector(".balk-menuknop");
  const zetOpen = (open) => {
    balk.classList.toggle("open", open);
    menuknop.setAttribute("aria-expanded", String(open));
    menuknop.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
  };
  menuknop.addEventListener("click", () => zetOpen(!balk.classList.contains("open")));
  houder.querySelector(".balk-nav").addEventListener("click", (e) => {
    if (e.target.closest("a")) zetOpen(false);
  });
  houder.sluitMenu = () => {
    if (!balk.classList.contains("open")) return false;
    zetOpen(false);
    menuknop.focus();
    return true;
  };
}

// Escape sluit het uitklapmenu. Eén keer gekoppeld; de balk wordt twee keer getekend.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.getElementById("balk")?.sluitMenu?.();
});

function tekenVoet() {
  const voet = document.getElementById("voet");
  if (!voet) return;
  voet.className = "voet";
  voet.innerHTML = `
    <div class="voet-boven">
      <div class="voet-merk">
        <a href="https://luzex.nl" class="voet-logo" aria-label="CMMNTY, onderdeel van LuzeX: naar luzex.nl"><span class="brand-logo" aria-hidden="true"></span></a>
        <p class="voet-tagline">Zorginnovatie in jip-en-janneke taal. Voor zorgprofessionals die het zelf doen.</p>
      </div>
      <div class="voet-kolom">
        <p class="voet-kop">CMMNTY</p>
        <a href="/netwerk.html">Netwerk</a>
        <a href="/artikelen.html">Artikelen</a>
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
