const specialismeSelect = document.getElementById("specialisme");
const regioSelect = document.getElementById("regio");
const zoekVeld = document.getElementById("zoek");
const lijst = document.getElementById("profielen");

function profielKaartHtml(p) {
  const contact = [];
  if (p.telefoon) contact.push(`<li>📞 <a href="tel:${escapeHtml(p.telefoon.replace(/[^0-9+]/g, ""))}">${escapeHtml(p.telefoon)}</a></li>`);
  if (p.contactEmail) contact.push(`<li>✉️ <a href="mailto:${escapeHtml(p.contactEmail)}">${escapeHtml(p.contactEmail)}</a></li>`);
  if (p.website) {
    const zichtbaar = p.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
    contact.push(`<li>🌐 <a href="${escapeHtml(p.website)}" target="_blank" rel="noopener nofollow">${escapeHtml(zichtbaar)}</a></li>`);
  }
  return `
    <div class="kaart profiel-kaart">
      <div class="kaart-body">
        <div class="kaart-badges">
          ${p.regio ? `<span class="badge">${escapeHtml(p.regio)}</span>` : ""}
          ${p.specialismen.map((s) => `<span class="badge badge-gratis">${escapeHtml(s)}</span>`).join("")}
        </div>
        <h3>${escapeHtml(p.weergavenaam)}</h3>
        ${p.praktijknaam ? `<p class="profiel-praktijk">${escapeHtml(p.praktijknaam)}</p>` : ""}
        ${p.bio ? `<p>${escapeHtml(p.bio)}</p>` : ""}
        <ul class="profiel-contact">${contact.join("")}</ul>
      </div>
    </div>`;
}

async function laad() {
  const params = new URLSearchParams();
  if (specialismeSelect.value) params.set("specialisme", specialismeSelect.value);
  if (regioSelect.value) params.set("regio", regioSelect.value);
  if (zoekVeld.value.trim()) params.set("zoek", zoekVeld.value.trim());
  try {
    const { profielen } = await api(`/api/directory?${params}`);
    lijst.innerHTML = profielen.length
      ? profielen.map(profielKaartHtml).join("")
      : '<p class="leeg">Nog niemand gevonden met deze filters.</p>';
  } catch {
    lijst.innerHTML = '<p class="leeg">De directory kon niet geladen worden.</p>';
  }
}

const opties = (lijst) => lijst.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");

api("/api/keuzelijsten").then(({ specialismen, regios }) => {
  specialismeSelect.insertAdjacentHTML("beforeend", opties(specialismen));
  regioSelect.insertAdjacentHTML("beforeend", opties(regios));
});

specialismeSelect.addEventListener("change", laad);
regioSelect.addEventListener("change", laad);
let timer;
zoekVeld.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(laad, 300);
});
document.getElementById("filters").addEventListener("submit", (e) => e.preventDefault());

laad();
