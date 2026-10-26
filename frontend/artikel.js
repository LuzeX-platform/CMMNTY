// Werkt op /artikelen/<slug> (nette URL, zie backend/src/app.ts) en op /artikel.html?slug=<slug>.
const slug = decodeURIComponent(location.pathname.match(/^\/artikelen\/([^/]+)/)?.[1] ?? queryParam("slug") ?? "");
const houder = document.getElementById("artikel");

function slotHtml(reden, toegang) {
  const terug = encodeURIComponent(location.pathname + location.search);
  if (reden === "inloggen") {
    // Zonder account is niets te lezen, ook geen gratis artikel. De tekst noemt wat je nodig
    // hebt: voor een gratis artikel is een gratis account genoeg, voor Pro daarna nog Pro.
    const pro = toegang === "pro";
    return `
      <div class="panel slot">
        ${pro ? '<span class="badge badge-pro">Pro</span>' : '<span class="badge badge-gratis">Gratis</span>'}
        <h2 style="margin-top:12px">Log in om verder te lezen</h2>
        <p>${pro
          ? "Dit is een Pro-artikel. Log in met je Pro-account om het hele artikel te lezen."
          : "Met een gratis account lees je dit artikel en alle andere gratis artikelen. Je hebt alleen een e-mailadres en een wachtwoord nodig."}</p>
        <div class="formulier-acties">
          <a class="pil-knop pil-knop-donker" href="/registreren.html">Gratis account maken</a>
          <a class="pil-knop pil-knop-glas" href="/inloggen.html?terug=${terug}">Inloggen</a>
        </div>
      </div>`;
  }
  return `
    <div class="panel slot">
      <span class="badge badge-pro">Pro</span>
      <h2 style="margin-top:12px">Dit artikel is voor Pro-leden</h2>
      <p>Met Pro lees je alle Pro-artikelen, voor € 5 per maand.</p>
      <div class="formulier-acties">
        <a class="pil-knop pil-knop-donker" href="/dashboard/account.html">Pro worden</a>
        <a class="pil-knop pil-knop-glas" href="/artikelen.html?toegang=gratis">Gratis artikelen lezen</a>
      </div>
    </div>`;
}

(async () => {
  try {
    const a = await api(`/api/artikelen/${encodeURIComponent(slug)}`);
    document.title = `${a.titel} — LuzeX CMMNTY`;
    document.querySelector('meta[name="description"]').setAttribute("content", a.samenvatting);

    houder.innerHTML = `
      ${a.voorbeeld ? `<p class="melding voorbeeld-melding"><strong>Voorbeeld</strong> — dit artikel is nog niet gepubliceerd. Alleen jij (admin) ziet deze pagina.</p>` : ""}
      <header class="artikel-kop">
        <div class="kaart-badges">${badgeHtml(a.toegang)}${a.categorie ? `<a class="badge" href="/artikelen.html?categorie=${encodeURIComponent(a.categorie)}">${escapeHtml(a.categorie)}</a>` : ""}</div>
        <h1>${escapeHtml(a.titel)}</h1>
        <div class="artikel-meta">
          <span>Door ${escapeHtml(a.auteurNaam)}</span>
          <span>${a.gepubliceerdOp ? formatteerDatum(a.gepubliceerdOp) : "Nog niet gepubliceerd"}</span>
          <span>${a.leestijd} min lezen</span>
        </div>
        <p class="artikel-samenvatting">${escapeHtml(a.samenvatting)}</p>
        ${a.coverUrl ? `<img class="artikel-cover" src="${escapeHtml(a.coverUrl)}" alt="" />` : ""}
      </header>
      ${a.inhoudHtml !== null
        ? `<div class="artikel-inhoud">${a.inhoudHtml /* door de server gesaneerd (sanitize-html) */}</div>`
        : slotHtml(a.vergrendeld, a.toegang)}`;

    if (a.gerelateerd.length) {
      document.getElementById("gerelateerd").innerHTML = a.gerelateerd.map(artikelKaartHtml).join("");
      document.getElementById("gerelateerd-sectie").hidden = false;
    }
  } catch (fout) {
    houder.innerHTML =
      fout.status === 404
        ? '<div class="pagina-kop"><h1>Artikel niet gevonden</h1><p class="lead">Misschien is het verplaatst. <a href="/artikelen.html">Bekijk alle artikelen</a>.</p></div>'
        : '<p class="leeg">Het artikel kon niet geladen worden.</p>';
  }
})();
