// Adminpaneel (alleen Job): artikelen, gebruikers, nieuwsbrief.
const pagina = document.body.dataset.pagina;
const foutEl = document.getElementById("fout");
const succesEl = document.getElementById("succes");

function toonFout(fout) {
  if (foutEl) foutEl.textContent = foutTekst(fout);
}

function statusBadge(status) {
  const labels = { concept: "Concept", ingepland: "Ingepland", gepubliceerd: "Gepubliceerd" };
  return `<span class="badge badge-${status}">${labels[status]}</span>`;
}

function datumTijd(iso) {
  return iso
    ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

/** ISO-datum → waarde voor <input type="datetime-local"> in lokale tijd. */
function naarLokaal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Artikelen ----------

async function artikelenPagina() {
  const tbody = document.getElementById("artikelen");
  const { artikelen } = await api("/api/admin/artikelen");
  tbody.innerHTML = artikelen.length
    ? artikelen
        .map(
          (a) => `
      <tr>
        <td><a href="/admin/artikel.html?id=${a.id}"><strong>${escapeHtml(a.titel)}</strong></a>${a.categorie ? `<br><span class="subtitle">${escapeHtml(a.categorie)}</span>` : ""}</td>
        <td>${statusBadge(a.status)}</td>
        <td>${badgeHtml(a.toegang)}</td>
        <td>${datumTijd(a.gepubliceerdOp)}</td>
        <td class="acties">
          <a class="text-link" href="/artikelen/${encodeURIComponent(a.slug)}" target="_blank">${a.status === "gepubliceerd" ? "Bekijk" : "Voorbeeld"}</a>
          <a class="text-link" href="/admin/artikel.html?id=${a.id}">Bewerk</a>
        </td>
      </tr>`,
        )
        .join("")
    : '<tr><td colspan="5">Nog geen artikelen. Schrijf je eerste!</td></tr>';
}

async function editorPagina() {
  const id = queryParam("id");
  const $ = (sleutel) => document.getElementById(sleutel);
  const form = $("formulier");
  // undefined = ongewijzigd, null = verwijderen, string = nieuwe data-URL (zie backend admin.ts)
  let cover;

  const { categorieen } = await api("/api/keuzelijsten");
  $("categorie").insertAdjacentHTML(
    "beforeend",
    categorieen.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(""),
  );

  const publicatie = $("publicatie");
  const zetDatumVeld = () => ($("datum-veld").hidden = publicatie.value !== "datum");
  publicatie.addEventListener("change", zetDatumVeld);

  const toonCover = (src) => {
    $("cover-voorbeeld").hidden = !src;
    $("cover-weg").hidden = !src;
    if (src) $("cover-voorbeeld").src = src;
  };

  if (id) {
    const a = await api(`/api/admin/artikelen/${id}`);
    document.title = `${a.titel} — Admin — LuzeX CMMNTY`;
    $("kop").textContent = "Artikel bewerken";
    for (const sleutel of ["titel", "slug", "auteurNaam", "toegang", "samenvatting", "inhoud"]) $(sleutel).value = a[sleutel] ?? "";
    // Een categorie die niet (meer) in de keuzelijst staat, toch als optie tonen. Anders blijft de
    // keuzelijst op "Geen categorie" staan en wist opslaan de categorie zonder dat je het ziet.
    if (a.categorie && ![...$("categorie").options].some((o) => o.value === a.categorie)) {
      $("categorie").insertAdjacentHTML("beforeend", `<option value="${escapeHtml(a.categorie)}">${escapeHtml(a.categorie)}</option>`);
    }
    $("categorie").value = a.categorie ?? "";
    if (a.gepubliceerdOp) {
      publicatie.value = "datum";
      $("publicatiedatum").value = naarLokaal(a.gepubliceerdOp);
    }
    toonCover(a.cover);
    $("verwijder").hidden = false;
    // Ook bij een concept: de artikelpagina toont het dan als voorbeeld, alleen voor de admin.
    $("bekijk").hidden = false;
    $("bekijk").textContent = a.status === "gepubliceerd" ? "Bekijk artikel ↗" : "Bekijk voorbeeld ↗";
    $("bekijk").href = `/artikelen/${encodeURIComponent(a.slug)}`;
    $("slug-hint").textContent = `/artikelen/${a.slug}`;
  }
  zetDatumVeld();

  $("cover").addEventListener("change", () => {
    const bestand = $("cover").files[0];
    if (!bestand) return;
    if (bestand.size > 2 * 1024 * 1024) {
      foutEl.textContent = "Afbeelding is groter dan 2 MB.";
      $("cover").value = "";
      return;
    }
    const lezer = new FileReader();
    lezer.onload = () => {
      cover = lezer.result;
      toonCover(cover);
    };
    lezer.readAsDataURL(bestand);
  });
  $("cover-weg").addEventListener("click", () => {
    cover = null;
    $("cover").value = "";
    toonCover(null);
  });

  // Live voorvertoning met dezelfde Markdown-rendering als voor lezers.
  let timer;
  const verversVoorvertoning = async () => {
    const { html, leestijd } = await api("/api/admin/voorvertoning", { methode: "POST", body: { inhoud: $("inhoud").value } });
    $("voorvertoning").innerHTML = html || '<p class="subtitle">Voorvertoning verschijnt hier.</p>';
    $("leestijd").textContent = `Geschatte leestijd: ${leestijd} min · ${$("inhoud").value.split(/\s+/).filter(Boolean).length} woorden`;
  };
  $("inhoud").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(verversVoorvertoning, 400);
  });
  verversVoorvertoning();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    foutEl.textContent = "";
    succesEl.textContent = "";
    let gepubliceerdOp = null;
    if (publicatie.value === "nu") gepubliceerdOp = new Date().toISOString();
    if (publicatie.value === "datum") {
      if (!$("publicatiedatum").value) {
        foutEl.textContent = "Kies een publicatiedatum.";
        return;
      }
      gepubliceerdOp = new Date($("publicatiedatum").value).toISOString();
    }
    const knop = form.querySelector('button[type="submit"]');
    knop.disabled = true;
    try {
      const body = {
        titel: $("titel").value,
        slug: $("slug").value,
        auteurNaam: $("auteurNaam").value || "Job",
        toegang: $("toegang").value,
        categorie: $("categorie").value,
        samenvatting: $("samenvatting").value,
        inhoud: $("inhoud").value,
        gepubliceerdOp,
        ...(cover !== undefined ? { cover } : {}),
      };
      const opgeslagen = await api(id ? `/api/admin/artikelen/${id}` : "/api/admin/artikelen", { methode: id ? "PUT" : "POST", body });
      window.location.href = `/admin/artikel.html?id=${id ?? opgeslagen.id}&opgeslagen=1`;
    } catch (fout) {
      toonFout(fout);
    } finally {
      knop.disabled = false;
    }
  });

  if (queryParam("opgeslagen")) succesEl.textContent = "Opgeslagen.";

  $("verwijder").addEventListener("click", async () => {
    if (!confirm("Dit artikel definitief verwijderen?")) return;
    try {
      await api(`/api/admin/artikelen/${id}`, { methode: "DELETE" });
      window.location.href = "/admin/";
    } catch (fout) {
      toonFout(fout);
    }
  });
}

// ---------- Gebruikers ----------

async function gebruikersPagina() {
  const { gebruikers } = await api("/api/admin/gebruikers");
  const leden = gebruikers.filter((g) => g.rol !== "admin");
  const stats = [
    [leden.length, "Leden"],
    [leden.filter((g) => g.abonnement === "pro").length, "Pro-leden"],
    [leden.filter((g) => g.nieuwsbrief && g.emailBevestigdOp).length, "Nieuwsbrief-abonnees"],
    [leden.filter((g) => g.profiel?.gepubliceerd).length, "In de directory"],
  ];
  document.getElementById("stats").innerHTML = stats
    .map(([waarde, label]) => `<div class="panel stat"><div class="stat-waarde">${waarde}</div><div class="stat-label">${label}</div></div>`)
    .join("");

  const tbody = document.getElementById("gebruikers");
  tbody.innerHTML = gebruikers
    .map(
      (g) => `
      <tr>
        <td><strong>${escapeHtml(g.naam)}</strong>${g.profiel?.praktijknaam ? `<br><span class="subtitle">${escapeHtml(g.profiel.praktijknaam)}</span>` : ""}</td>
        <td>${escapeHtml(g.email)}</td>
        <td>${g.rol === "admin" ? '<span class="badge badge-pro">Admin</span>' : g.emailBevestigdOp ? '<span class="badge badge-gratis">Bevestigd</span>' : '<span class="badge badge-ingepland">Onbevestigd</span>'}</td>
        <td>${g.nieuwsbrief ? "Ja" : "Nee"}</td>
        <td>${g.profiel?.gepubliceerd ? "Zichtbaar" : "—"}</td>
        <td>${formatteerDatum(g.aangemaaktOp)}</td>
        <td>${
          g.rol === "admin"
            ? "—"
            : `<select data-id="${g.id}" aria-label="Abonnement van ${escapeHtml(g.naam)}" style="width:auto">
                 <option value="gratis" ${g.abonnement === "gratis" ? "selected" : ""}>Gratis</option>
                 <option value="pro" ${g.abonnement === "pro" ? "selected" : ""}>Pro</option>
               </select>${g.abonnementBron ? `<br><span class="subtitle">via ${g.abonnementBron === "accrd" ? "ACCRD" : "SCRNN"}</span>` : ""}`
        }</td>
      </tr>`,
    )
    .join("");

  tbody.addEventListener("change", async (e) => {
    const select = e.target.closest("select[data-id]");
    if (!select) return;
    select.disabled = true;
    try {
      await api(`/api/admin/gebruikers/${select.dataset.id}`, { methode: "PATCH", body: { abonnement: select.value } });
    } catch (fout) {
      alert(foutTekst(fout));
    } finally {
      select.disabled = false;
    }
  });
}

// ---------- Nieuwsbrief ----------

async function nieuwsbriefPagina() {
  let segment = "gratis";

  const laadOverzicht = async () => {
    const data = await api("/api/admin/nieuwsbrief");
    document.querySelectorAll("[data-frequentie]").forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.frequentie === data.frequentie)));
    document.getElementById("segmenten").innerHTML = ["gratis", "pro"]
      .map((s) => {
        const seg = data.segmenten[s];
        return `<div class="panel stat">
          <div class="stat-waarde">${seg.artikelen.length}</div>
          <div class="stat-label">artikel(en) klaar voor ${s === "pro" ? "Pro" : "gratis"}-leden · ${seg.abonnees} abonnee(s)<br>sinds ${datumTijd(seg.vanaf)}</div>
        </div>`;
      })
      .join("");
    document.getElementById("verzendingen").innerHTML = data.verzendingen.length
      ? data.verzendingen
          .map(
            (v) => `<tr><td>${datumTijd(v.verstuurdOp)}</td><td>${badgeHtml(v.segment)}</td><td>${v.artikelIds.length}</td><td>${v.aantalOntvangers}</td><td>${v.aanleiding}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5">Nog niets verstuurd.</td></tr>';
  };

  const laadVoorbeeld = async () => {
    const data = await api(`/api/admin/nieuwsbrief/voorbeeld?segment=${segment}`);
    document.getElementById("voorbeeld-onderwerp").textContent = data.aantalArtikelen
      ? `Onderwerp: "${data.onderwerp}"`
      : "Nog geen nieuwe artikelen voor dit segment — er gaat nu niets uit.";
    document.getElementById("voorbeeld").srcdoc = data.html;
  };

  document.getElementById("frequentie").addEventListener("click", async (e) => {
    const knop = e.target.closest("[data-frequentie]");
    if (!knop) return;
    try {
      await api("/api/admin/nieuwsbrief", { methode: "PUT", body: { frequentie: knop.dataset.frequentie } });
      document.getElementById("frequentie-succes").textContent = "Opgeslagen.";
      await Promise.all([laadOverzicht(), laadVoorbeeld()]);
    } catch (fout) {
      toonFout(fout);
    }
  });

  document.getElementById("segment-keuze").addEventListener("click", (e) => {
    const knop = e.target.closest("[data-segment]");
    if (!knop) return;
    segment = knop.dataset.segment;
    document.querySelectorAll("[data-segment]").forEach((k) => k.setAttribute("aria-pressed", String(k === knop)));
    laadVoorbeeld();
  });

  document.getElementById("test").addEventListener("click", async () => {
    foutEl.textContent = "";
    try {
      const { naar } = await api("/api/admin/nieuwsbrief/test", { methode: "POST", body: { segment } });
      succesEl.textContent = `Testmail verstuurd naar ${naar}.`;
    } catch (fout) {
      toonFout(fout);
    }
  });

  document.getElementById("versturen").addEventListener("click", async (e) => {
    if (!confirm("De nieuwsbrief nu naar alle abonnees versturen?")) return;
    foutEl.textContent = "";
    e.target.disabled = true;
    try {
      const { resultaten } = await api("/api/admin/nieuwsbrief/versturen", { methode: "POST" });
      succesEl.textContent = resultaten
        .map((r) => `${r.segment}: ${r.overgeslagen ?? `${r.aantalArtikelen} artikel(en) naar ${r.aantalOntvangers} ontvanger(s)`}`)
        .join(" · ");
      await Promise.all([laadOverzicht(), laadVoorbeeld()]);
    } catch (fout) {
      toonFout(fout);
    } finally {
      e.target.disabled = false;
    }
  });

  await Promise.all([laadOverzicht(), laadVoorbeeld()]);
}

(async () => {
  await vereisSessie({ admin: true });
  try {
    if (pagina === "artikelen") await artikelenPagina();
    if (pagina === "editor") await editorPagina();
    if (pagina === "gebruikers") await gebruikersPagina();
    if (pagina === "nieuwsbrief") await nieuwsbriefPagina();
  } catch (fout) {
    toonFout(fout);
    console.error(fout);
  }
})();
