// Onder deze aantallen tonen we geen teller: "3 zorgprofessionals" verkoopt het netwerk niet.
const TELLER_VANAF = 10;

(async () => {
  const gebruiker = await haalSessie();

  // Netwerk: zoekvak, teller en een paar uitgelichte collega's.
  api("/api/keuzelijsten")
    .then(({ specialismen, regios }) => {
      const opties = (lijst) => lijst.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
      document.getElementById("hero-specialisme").insertAdjacentHTML("beforeend", opties(specialismen));
      document.getElementById("hero-regio").insertAdjacentHTML("beforeend", opties(regios));
    })
    .catch(() => {});

  const netwerk = document.getElementById("uit-netwerk");
  try {
    const { totaal, profielen } = await api("/api/netwerk/uitgelicht");
    if (totaal >= TELLER_VANAF) {
      document.getElementById("netwerk-teller").textContent = `${totaal} zorgprofessionals in het netwerk. Zoek op specialisme en regio.`;
    }
    // Minder dan drie profielen: vul aan met een uitnodiging, zodat er geen gat in de rij zit.
    const stap = netwerkStap(gebruiker);
    const uitnodiging = `
      <div class="kaart netwerk-uitnodiging">
        <div class="kaart-body">
          <h3>${profielen.length ? "Jouw praktijk hier?" : "Wees een van de eersten"}</h3>
          <p>${stap.tekst}</p>
          <div class="cta-rij">${netwerkKnoppenHtml(stap.knoppen.filter(([, href]) => href !== "/netwerk.html").slice(0, 1))}</div>
        </div>
      </div>`;
    netwerk.innerHTML = profielen.map(profielKaartHtml).join("") + (profielen.length < 3 && !gebruiker?.inNetwerk ? uitnodiging : "");
    if (!netwerk.innerHTML.trim()) document.getElementById("netwerk").hidden = true;
  } catch {
    document.getElementById("netwerk").hidden = true;
  }

  const houder = document.getElementById("uitgelicht");
  try {
    const { artikelen } = await api("/api/artikelen?limiet=3");
    houder.innerHTML = artikelen.length
      ? artikelen.map(artikelKaartHtml).join("")
      : '<p class="leeg">Binnenkort verschijnt hier het eerste artikel.</p>';
  } catch {
    houder.innerHTML = '<p class="leeg">Artikelen konden niet geladen worden.</p>';
  }

  if (gebruiker) {
    // Wie al lid is, hoeft geen account te maken: de hoofdknop wordt de volgende stap in het netwerk.
    const [eerste, tweede] = netwerkStap(gebruiker).knoppen;
    const knop1 = document.getElementById("hero-eerste");
    const knop2 = document.getElementById("hero-tweede");
    [knop1.textContent, knop1.href] = eerste;
    [knop2.textContent, knop2.href] = gebruiker.inNetwerk ? ["Mijn CMMNTY", "/dashboard/"] : tweede;
  }
})();
