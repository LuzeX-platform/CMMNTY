(async () => {
  const houder = document.getElementById("uitgelicht");
  try {
    const { artikelen } = await api("/api/artikelen?limiet=3");
    houder.innerHTML = artikelen.length
      ? artikelen.map(artikelKaartHtml).join("")
      : '<p class="leeg">Binnenkort verschijnt hier het eerste artikel.</p>';
  } catch {
    houder.innerHTML = '<p class="leeg">Artikelen konden niet geladen worden.</p>';
  }

  const gebruiker = await haalSessie();
  if (gebruiker) {
    // Wie al een account heeft, hoeft er geen te maken: dan gaat de hoofdknop naar de artikelen.
    const eerste = document.getElementById("hero-eerste");
    eerste.href = "/artikelen.html";
    eerste.textContent = "Artikelen lezen";
    const knop = document.getElementById("hero-tweede");
    knop.href = "/dashboard/";
    knop.textContent = "Mijn CMMNTY";
  }
})();
