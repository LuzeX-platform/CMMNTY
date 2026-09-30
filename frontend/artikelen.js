const staat = {
  toegang: queryParam("toegang") ?? "",
  categorie: queryParam("categorie") ?? "",
  zoek: queryParam("zoek") ?? "",
  pagina: Number(queryParam("pagina")) || 1,
};

const lijst = document.getElementById("artikelen");
const paginering = document.getElementById("paginering");
const categorieSelect = document.getElementById("categorie");
const zoekVeld = document.getElementById("zoek");

function zetUrl() {
  const params = new URLSearchParams();
  for (const [sleutel, waarde] of Object.entries(staat)) {
    if (waarde && !(sleutel === "pagina" && waarde === 1)) params.set(sleutel, waarde);
  }
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
}

async function laad() {
  zetUrl();
  const params = new URLSearchParams({ pagina: staat.pagina });
  if (staat.toegang) params.set("toegang", staat.toegang);
  if (staat.categorie) params.set("categorie", staat.categorie);
  if (staat.zoek) params.set("zoek", staat.zoek);
  try {
    const data = await api(`/api/artikelen?${params}`);
    lijst.innerHTML = data.artikelen.length
      ? data.artikelen.map(artikelKaartHtml).join("")
      : '<p class="leeg">Geen artikelen gevonden met deze filters.</p>';
    paginering.innerHTML =
      data.paginas > 1
        ? `<button class="secondary" data-pagina="${data.pagina - 1}" ${data.pagina <= 1 ? "disabled" : ""}>← Vorige</button>
           <span>Pagina ${data.pagina} van ${data.paginas}</span>
           <button class="secondary" data-pagina="${data.pagina + 1}" ${data.pagina >= data.paginas ? "disabled" : ""}>Volgende →</button>`
        : "";
  } catch {
    lijst.innerHTML = '<p class="leeg">Artikelen konden niet geladen worden.</p>';
  }
}

document.querySelectorAll("[data-toegang]").forEach((knop) => {
  knop.setAttribute("aria-pressed", String(knop.dataset.toegang === staat.toegang));
  knop.addEventListener("click", () => {
    staat.toegang = knop.dataset.toegang;
    staat.pagina = 1;
    document.querySelectorAll("[data-toegang]").forEach((k) => k.setAttribute("aria-pressed", String(k === knop)));
    laad();
  });
});

categorieSelect.addEventListener("change", () => {
  staat.categorie = categorieSelect.value;
  staat.pagina = 1;
  laad();
});

let zoekTimer;
zoekVeld.value = staat.zoek;
zoekVeld.addEventListener("input", () => {
  clearTimeout(zoekTimer);
  zoekTimer = setTimeout(() => {
    staat.zoek = zoekVeld.value.trim();
    staat.pagina = 1;
    laad();
  }, 300);
});

document.getElementById("filters").addEventListener("submit", (e) => e.preventDefault());

paginering.addEventListener("click", (e) => {
  const knop = e.target.closest("[data-pagina]");
  if (!knop) return;
  staat.pagina = Number(knop.dataset.pagina);
  laad();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

api("/api/keuzelijsten").then(({ categorieen }) => {
  categorieSelect.insertAdjacentHTML(
    "beforeend",
    categorieen.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(""),
  );
  categorieSelect.value = staat.categorie;
});

laad();
