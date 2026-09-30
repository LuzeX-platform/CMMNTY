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
    const knop = document.getElementById("hero-tweede");
    knop.href = "/dashboard/";
    knop.textContent = "Mijn Community";
  }
})();
