// Werkt op /artikelen/<slug> (nette URL, zie backend/src/app.ts) en op /artikel.html?slug=<slug>.
const slug = decodeURIComponent(location.pathname.match(/^\/artikelen\/([^/]+)/)?.[1] ?? queryParam("slug") ?? "");
const houder = document.getElementById("artikel");

function slotHtml(reden) {
  const terug = encodeURIComponent(location.pathname);
  if (reden === "inloggen") {
    return `
      <div class="panel slot">
        <span class="badge badge-pro">Pro</span>
        <h2 style="margin-top:12px">Log in om verder te lezen</h2>
        <p>Dit is een Pro-artikel. Log in met je Pro-account om het hele artikel te lezen.</p>
        <div class="formulier-acties">
          <a class="pil-knop pil-knop-donker" href="/inloggen.html?terug=${terug}">Inloggen</a>
          <a class="pil-knop pil-knop-glas" href="/registreren.html">Gratis lid worden</a>
        </div>
      </div>`;
  }
  return `
    <div class="panel slot">
      <span class="badge badge-pro">Pro</span>
      <h2 style="margin-top:12px">Dit artikel is voor Pro-leden</h2>
      <p>Pro-abonnementen komen binnenkort. Wil je nu al toegang? Stuur Job een mailtje.</p>
      <div class="formulier-acties">
        <a class="pil-knop pil-knop-donker" href="mailto:job@luzex.nl?subject=Pro-toegang%20CMMNTY">Mail Job</a>
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
      <header class="artikel-kop">
        <div class="kaart-badges">${badgeHtml(a.toegang)}${a.categorie ? `<a class="badge" href="/artikelen.html?categorie=${encodeURIComponent(a.categorie)}">${escapeHtml(a.categorie)}</a>` : ""}</div>
        <h1>${escapeHtml(a.titel)}</h1>
        <div class="artikel-meta">
          <span>Door ${escapeHtml(a.auteurNaam)}</span>
          <span>${formatteerDatum(a.gepubliceerdOp)}</span>
          <span>${a.leestijd} min lezen</span>
        </div>
        <p class="artikel-samenvatting">${escapeHtml(a.samenvatting)}</p>
        ${a.coverUrl ? `<img class="artikel-cover" src="${escapeHtml(a.coverUrl)}" alt="" />` : ""}
      </header>
      ${a.inhoudHtml !== null
        ? `<div class="artikel-inhoud">${a.inhoudHtml /* door de server gesaneerd (sanitize-html) */}</div>`
        : slotHtml(a.vergrendeld)}`;

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
