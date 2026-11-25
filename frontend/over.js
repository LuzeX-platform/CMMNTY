// Over-pagina: wie al lid is, krijgt in de oproep onderaan de volgende stap in het netwerk in
// plaats van "Gratis lid worden".
haalSessie().then((gebruiker) => {
  if (!gebruiker) return;
  document.getElementById("over-knoppen").innerHTML = netwerkStap(gebruiker)
    .knoppen.map(
      ([label, href], i) =>
        `<a class="pil-knop ${i === 0 ? "pil-knop-licht" : "pil-knop-glas"}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`,
    )
    .join("");
});
