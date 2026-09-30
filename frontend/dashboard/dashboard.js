// Mijn CMMNTY: overzicht, profiel en account. <body data-pagina="…"> bepaalt de pagina.
const pagina = document.body.dataset.pagina;

/** Formulier versturen met knop-blokkering; toont fout- of succestekst in de opgegeven elementen. */
function koppelFormulier(form, foutEl, succesEl, handler) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knop = form.querySelector('button[type="submit"]');
    foutEl.textContent = "";
    if (succesEl) succesEl.textContent = "";
    knop.disabled = true;
    try {
      const melding = await handler();
      if (succesEl && melding) succesEl.textContent = melding;
    } catch (fout) {
      foutEl.textContent = foutTekst(fout);
    } finally {
      knop.disabled = false;
    }
  });
}

(async () => {
  const gebruiker = await vereisSessie();

  if (pagina === "overzicht") {
    document.getElementById("kop").textContent = `Welkom, ${gebruiker.naam.split(" ")[0]}`;
    const pro = gebruiker.abonnement === "pro" || gebruiker.rol === "admin";
    document.getElementById("abonnement-tekst").innerHTML = pro
      ? `${badgeHtml("pro")} Je hebt toegang tot alle artikelen, ook Pro.`
      : `${badgeHtml("gratis")} Je leest alle gratis artikelen. Pro-abonnementen komen binnenkort — wil je nu al Pro? <a href="mailto:job@luzex.nl?subject=Pro-toegang%20CMMNTY">Mail Job</a>.`;

    // "Mijn artikelen": de nieuwste artikelen die dit lid volledig kan lezen.
    const houder = document.getElementById("artikelen");
    try {
      const { artikelen } = await api(`/api/artikelen?limiet=6${pro ? "" : "&toegang=gratis"}`);
      houder.innerHTML = artikelen.length
        ? artikelen.map(artikelKaartHtml).join("")
        : '<p class="leeg">Nog geen artikelen. Het eerste komt eraan!</p>';
    } catch {
      houder.innerHTML = '<p class="leeg">Artikelen konden niet geladen worden.</p>';
    }
  }

  if (pagina === "profiel") {
    const form = document.getElementById("formulier");
    const [profiel, keuzes] = await Promise.all([api("/api/profiel"), api("/api/keuzelijsten")]);

    document.getElementById("specialismen").innerHTML = keuzes.specialismen
      .map(
        (s) =>
          `<label class="chip"><input type="checkbox" value="${escapeHtml(s)}" ${profiel.specialismen.includes(s) ? "checked" : ""} />${escapeHtml(s)}</label>`,
      )
      .join("");
    const regio = document.getElementById("regio");
    regio.insertAdjacentHTML(
      "beforeend",
      keuzes.regios.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join(""),
    );

    for (const sleutel of ["weergavenaam", "praktijknaam", "telefoon", "contactEmail", "website", "bio", "regio"]) {
      document.getElementById(sleutel).value = profiel[sleutel] ?? "";
    }
    document.getElementById("gepubliceerd").checked = profiel.gepubliceerd;

    const bio = document.getElementById("bio");
    const teller = document.getElementById("bio-teller");
    const tel = () => (teller.textContent = bio.value.length);
    bio.addEventListener("input", tel);
    tel();

    koppelFormulier(form, document.getElementById("fout"), document.getElementById("succes"), async () => {
      const waarde = (id) => document.getElementById(id).value;
      const opgeslagen = await api("/api/profiel", {
        methode: "PUT",
        body: {
          weergavenaam: waarde("weergavenaam"),
          praktijknaam: waarde("praktijknaam"),
          specialismen: [...document.querySelectorAll("#specialismen input:checked")].map((i) => i.value),
          telefoon: waarde("telefoon"),
          contactEmail: waarde("contactEmail"),
          website: waarde("website"),
          bio: waarde("bio"),
          regio: waarde("regio"),
          gepubliceerd: document.getElementById("gepubliceerd").checked,
        },
      });
      document.getElementById("website").value = opgeslagen.website ?? "";
      return opgeslagen.gepubliceerd ? "Opgeslagen — je staat in de directory." : "Opgeslagen. Je profiel is niet zichtbaar in de directory.";
    });
  }

  if (pagina === "account") {
    document.getElementById("account-email").textContent = `Ingelogd als ${gebruiker.email}`;
    document.getElementById("naam").value = gebruiker.naam;
    document.getElementById("nieuwsbrief").checked = gebruiker.nieuwsbrief;

    koppelFormulier(
      document.getElementById("account-form"),
      document.getElementById("account-fout"),
      document.getElementById("account-succes"),
      async () => {
        await api("/api/account", {
          methode: "PUT",
          body: { naam: document.getElementById("naam").value.trim(), nieuwsbrief: document.getElementById("nieuwsbrief").checked },
        });
        return "Opgeslagen.";
      },
    );

    const wachtwoordForm = document.getElementById("wachtwoord-form");
    koppelFormulier(wachtwoordForm, document.getElementById("wachtwoord-fout"), document.getElementById("wachtwoord-succes"), async () => {
      await api("/api/account/wachtwoord", {
        methode: "POST",
        body: { huidigWachtwoord: document.getElementById("huidig").value, nieuwWachtwoord: document.getElementById("nieuw").value },
      });
      wachtwoordForm.reset();
      return "Je wachtwoord is gewijzigd.";
    });

    document.getElementById("uitloggen").addEventListener("click", uitloggen);

    koppelFormulier(document.getElementById("verwijder-form"), document.getElementById("verwijder-fout"), null, async () => {
      if (!confirm("Weet je het zeker? Dit kan niet ongedaan worden gemaakt.")) return;
      await api("/api/account", { methode: "DELETE", body: { wachtwoord: document.getElementById("verwijder-wachtwoord").value } });
      window.location.href = "/";
    });
  }
})();
