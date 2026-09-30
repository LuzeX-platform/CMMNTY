// Eén script voor alle auth-pagina's; <body data-pagina="…"> bepaalt wat er gebeurt.
const pagina = document.body.dataset.pagina;
const formulier = document.getElementById("formulier");
const foutEl = document.getElementById("fout");
const succesEl = document.getElementById("succes");

function veld(id) {
  return document.getElementById(id)?.value.trim() ?? "";
}

/** Koppelt een submit-handler met knop-blokkering en foutweergave. */
function bijVersturen(form, handler) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knop = form.querySelector('button[type="submit"]');
    if (foutEl) foutEl.textContent = "";
    if (succesEl) succesEl.textContent = "";
    knop.disabled = true;
    try {
      await handler();
    } catch (fout) {
      if (foutEl) foutEl.textContent = foutTekst(fout);
    } finally {
      knop.disabled = false;
    }
  });
}

/** Alleen interne paden als terugweg, zodat ?terug= niet naar een andere site kan sturen. */
function veiligTerug(standaard) {
  const terug = queryParam("terug");
  return terug && terug.startsWith("/") && !terug.startsWith("//") ? terug : standaard;
}

if (pagina === "inloggen") {
  haalSessie().then((g) => {
    if (g) window.location.href = veiligTerug("/dashboard/");
  });
  bijVersturen(formulier, async () => {
    const { rol } = await api("/api/auth/inloggen", {
      methode: "POST",
      body: { email: veld("email"), wachtwoord: document.getElementById("wachtwoord").value },
    });
    window.location.href = veiligTerug(rol === "admin" ? "/admin/" : "/dashboard/");
  });
}

if (pagina === "registreren") {
  bijVersturen(formulier, async () => {
    await api("/api/auth/registreren", {
      methode: "POST",
      body: {
        naam: veld("naam"),
        email: veld("email"),
        wachtwoord: document.getElementById("wachtwoord").value,
        nieuwsbrief: document.getElementById("nieuwsbrief").checked,
      },
    });
    formulier.hidden = true;
    document.getElementById("klaar").hidden = false;
  });
}

if (pagina === "bevestigen") {
  const status = document.getElementById("status");
  const opnieuw = document.getElementById("opnieuw");
  const token = queryParam("token");
  (async () => {
    if (!token) {
      status.textContent = "Deze link is niet compleet.";
      opnieuw.hidden = false;
      return;
    }
    try {
      await api("/api/auth/bevestigen", { methode: "POST", body: { token } });
      status.textContent = "Gelukt! Je e-mailadres is bevestigd. Je wordt doorgestuurd…";
      setTimeout(() => (window.location.href = "/dashboard/"), 1200);
    } catch {
      status.textContent = "Deze link is ongeldig of al gebruikt. Al bevestigd? Log dan gewoon in.";
      opnieuw.hidden = false;
    }
  })();
  bijVersturen(opnieuw, async () => {
    await api("/api/auth/bevestiging-opnieuw", { methode: "POST", body: { email: veld("email") } });
    succesEl.textContent = "Als dit adres nog niet bevestigd is, staat er een nieuwe link in je mailbox.";
  });
}

if (pagina === "wachtwoord-vergeten") {
  bijVersturen(formulier, async () => {
    await api("/api/auth/wachtwoord-vergeten", { methode: "POST", body: { email: veld("email") } });
    succesEl.textContent = "Als dit adres bij ons bekend is, staat er een link in je mailbox.";
  });
}

if (pagina === "wachtwoord-resetten") {
  bijVersturen(formulier, async () => {
    await api("/api/auth/wachtwoord-resetten", {
      methode: "POST",
      body: { token: queryParam("token") ?? "", nieuwWachtwoord: document.getElementById("wachtwoord").value },
    });
    formulier.querySelector('button[type="submit"]').hidden = true;
    succesEl.innerHTML = 'Je wachtwoord is gewijzigd. <a href="/inloggen.html">Log nu in</a>.';
  });
}

if (pagina === "afmelden") {
  bijVersturen(formulier, async () => {
    await api("/api/nieuwsbrief/afmelden", { methode: "POST", body: { token: queryParam("token") ?? "" } });
    formulier.querySelector('button[type="submit"]').hidden = true;
    succesEl.textContent = "Je bent afgemeld. Je ontvangt de nieuwsbrief niet meer.";
  });
}
