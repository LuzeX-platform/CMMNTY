const specialismeSelect = document.getElementById("specialisme");
const regioSelect = document.getElementById("regio");
const zoekVeld = document.getElementById("zoek");
const lijst = document.getElementById("profielen");
const aantal = document.getElementById("aantal");
const toonAlles = document.getElementById("toon-alles");

/** "in regio Noord", "met specialisme Seksuologie", of allebei: zegt in gewone taal waarop gezocht is. */
function zoekopdrachtInWoorden() {
  const delen = [];
  if (regioSelect.value) delen.push(`in regio ${regioSelect.value}`);
  if (specialismeSelect.value) delen.push(`met specialisme ${specialismeSelect.value}`);
  if (zoekVeld.value.trim()) delen.push(`voor "${zoekVeld.value.trim()}"`);
  return delen.join(" ");
}

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
    // Zodra er gefilterd is, staat er altijd een knop om terug te gaan naar het hele netwerk.
    toonAlles.hidden = !params.toString();
    if (profielen.length) {
      lijst.innerHTML = profielen.map(profielKaartHtml).join("");
    } else if (params.toString()) {
      lijst.innerHTML = `
        <div class="lege-staat">
          <h3>Nog geen collega's ${escapeHtml(zoekopdrachtInWoorden())}.</h3>
          <p>Probeer een ander specialisme of een andere regio, of bekijk het hele netwerk.</p>
          <button type="button" class="pil-knop pil-knop-donker" data-toon-alles>Bekijk het hele netwerk</button>
        </div>`;
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

// "Toon alle leden" en "Bekijk het hele netwerk": alle filters leeg en opnieuw laden.
function wisFilters() {
  specialismeSelect.value = "";
  regioSelect.value = "";
  zoekVeld.value = "";
  laad();
  specialismeSelect.focus();
}
toonAlles.addEventListener("click", wisFilters);
lijst.addEventListener("click", (e) => {
  if (e.target.closest("[data-toon-alles]")) wisFilters();
});
