// De ledensectie verschijnt pas vanaf drie zichtbare profielen. Daaronder een neutrale regel, zodat
// het netwerk niet leeg oogt. Het aantal zorgprofessionals komt van de server, en alleen vanaf 100
// (zie TELLER_VANAF in backend/src/routes/profiel.ts); anders noemen we geen getal.
const LEDEN_VANAF = 3;

(async () => {
  const gebruiker = await haalSessie();

  // Netwerk: zoekvak, teller en een paar uitgelichte collega's.
  api("/api/keuzelijsten")
    .then(({ specialismeGroepen, regios }) => {
      const opties = (lijst) => lijst.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
      document.getElementById("hero-specialisme").insertAdjacentHTML("beforeend", specialismeOptiesHtml(specialismeGroepen));
      document.getElementById("hero-regio").insertAdjacentHTML("beforeend", opties(regios));
    })
    .catch(() => {});

  const stap = netwerkStap(gebruiker);
  const eigenKnop = stap.knoppen.filter(([, href]) => href !== "/netwerk.html").slice(0, 1);
  try {
    const { profielen, zorgprofessionals } = await api("/api/netwerk/uitgelicht");
    const teller = zorgprofessionals
      ? `${zorgprofessionals.toLocaleString("nl-NL")} zorgprofessionals zijn aangesloten bij CMMNTY.`
      : null;
    if (teller) document.getElementById("netwerk-teller").textContent = `${teller} Zoek op specialisme en regio.`;

    if (profielen.length >= LEDEN_VANAF) {
      document.getElementById("uit-netwerk").innerHTML = profielen.map(profielKaartHtml).join("");
      if (teller) {
        const regel = document.getElementById("netwerk-teller-regel");
        regel.textContent = teller;
        regel.hidden = false;
      }
      document.getElementById("netwerk-start").hidden = true;
      document.getElementById("netwerk").hidden = false;
    } else {
      if (teller) document.getElementById("netwerk-start-tekst").textContent = `${teller} Zet je praktijk erin, dan vinden collega's en verwijzers je op specialisme en regio.`;
      document.getElementById("netwerk-start-knoppen").innerHTML = netwerkKnoppenHtml([
        ...eigenKnop,
        ["Bekijk het netwerk", "/netwerk.html"],
      ]);
    }
  } catch {
    // Zonder netwerkgegevens blijft de uitnodiging staan; de zoekkaart werkt dan nog steeds.
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
