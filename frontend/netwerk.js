const specialismeSelect = document.getElementById("specialisme");
const regioSelect = document.getElementById("regio");
const zoekVeld = document.getElementById("zoek");
const lijst = document.getElementById("profielen");
const aantal = document.getElementById("aantal");

/** Zet de filters in de adresbalk, zodat een zoekopdracht te delen is (en de homepage ernaar kan linken). */
function bewaarFiltersInUrl() {
  const params = new URLSearchParams();
  if (specialismeSelect.value) params.set("specialisme", specialismeSelect.value);
  if (regioSelect.value) params.set("regio", regioSelect.value);
  if (zoekVeld.value.trim()) params.set("zoek", zoekVeld.value.trim());
  history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
  return params;
}

async function laad() {
  const params = bewaarFiltersInUrl();
  try {
    const { profielen, totaal } = await api(`/api/directory?${params}`);
    aantal.textContent = totaal === 1 ? "1 collega" : `${totaal} collega's`;
    if (profielen.length) {
      lijst.innerHTML = profielen.map(profielKaartHtml).join("");
    } else if (params.toString()) {
      lijst.innerHTML = '<p class="leeg">Nog niemand gevonden met deze filters.</p>';
    } else {
      aantal.textContent = "";
      lijst.innerHTML = '<p class="leeg">Het netwerk is net begonnen. Zet je praktijk er als een van de eersten in.</p>';
    }
  } catch {
    aantal.textContent = "";
    lijst.innerHTML = '<p class="leeg">Het netwerk kon niet geladen worden.</p>';
  }
}

const opties = (lijst) => lijst.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");

(async () => {
  // Eerst de keuzelijsten, dan pas de filters uit de URL invullen: een <select> neemt alleen een
  // waarde aan die als optie bestaat.
  try {
    const { specialismen, regios } = await api("/api/keuzelijsten");
    specialismeSelect.insertAdjacentHTML("beforeend", opties(specialismen));
    regioSelect.insertAdjacentHTML("beforeend", opties(regios));
  } catch {
    // Zonder keuzelijsten werkt zoeken op naam nog steeds.
  }
  specialismeSelect.value = queryParam("specialisme") ?? "";
  regioSelect.value = queryParam("regio") ?? "";
  zoekVeld.value = queryParam("zoek") ?? "";
  laad();
})();

haalSessie().then((gebruiker) => {
  // Op deze pagina zelf is "Bekijk het netwerk" overbodig: toon de eerste andere stap.
  const knoppen = netwerkStap(gebruiker).knoppen.filter(([, href]) => href !== "/netwerk.html");
  document.getElementById("netwerk-acties").innerHTML = netwerkKnoppenHtml(knoppen.slice(0, 1));
});

specialismeSelect.addEventListener("change", laad);
regioSelect.addEventListener("change", laad);
let timer;
zoekVeld.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(laad, 300);
});
document.getElementById("filters").addEventListener("submit", (e) => e.preventDefault());
