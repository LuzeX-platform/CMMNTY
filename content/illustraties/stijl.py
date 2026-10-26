"""Huisstijl voor de illustraties bij CMMNTY-artikelen (zie content/REDACTIE.md).

Gebruik: schrijf per week een klein script naast dit bestand, bijvoorbeeld:

    import pathlib, sys
    sys.path.insert(0, "content/illustraties")
    from stijl import *

    def mijn_plaatje():
        d = [glas(560, 170, 480, 560), lijn(600, 214, 200, 18, .9), vink(1000, 230)]
        return basis("\n".join(d))

    pathlib.Path("content/artikelen/zorgtech-week-NN/afbeeldingen/01-naam.svg").write_text(mijn_plaatje())

Zet de SVG daarna om naar JPG met render.mjs (zie daar). Afspraken:
- Canvas 1600x900 (16:9, past op de artikelkaartjes en bovenaan het artikel).
- Achtergrond en licht via basis(); geen eigen achtergrondkleuren.
- Alleen de kleuren hieronder. Geen tekst in het beeld, geen logo's of merken van bedrijven.
- Abstract en rustig: panelen van glas, simpele vormen, een stippellijn voor "van A naar B".
"""
import math

TERRA, OLIJF, ZAND, DIEP, GRAFIET, GREIGE, CREME, GROEN = "#c98a63", "#8d9472", "#e8dccc", "#3b2e24", "#1d1d1f", "#cfc6bc", "#f5efe7", "#248a3d"

def basis(inhoud, licht=None):
    licht = licht or [(1350, 110, 340, TERRA, .55), (170, 770, 300, OLIJF, .42), (250, 150, 250, ZAND, .7), (1460, 870, 330, DIEP, .26)]
    vlekken = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{k}" opacity="{o}"/>' for x, y, r, k, o in licht)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs>
  <filter id="licht" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="95"/></filter>
  <linearGradient id="glas" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.66"/>
    <stop offset="0.46" stop-color="#fff" stop-opacity="0.32"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0.48"/>
  </linearGradient>
  <linearGradient id="glasdun" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0.28"/>
  </linearGradient>
  <filter id="schaduw" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="{GRAFIET}" flood-opacity="0.20"/></filter>
  <filter id="schaduwklein" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="{GRAFIET}" flood-opacity="0.14"/></filter>
  <marker id="pijl" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{DIEP}" fill-opacity="0.45"/></marker>
</defs>
<rect width="1600" height="900" fill="{GREIGE}"/>
<g filter="url(#licht)">{vlekken}</g>
{inhoud}
</svg>'''

def glas(x, y, b, h, r=28, klein=False, extra=""):
    f = "schaduwklein" if klein else "schaduw"
    vul = "glasdun" if klein else "glas"
    return (f'<rect x="{x}" y="{y}" width="{b}" height="{h}" rx="{r}" fill="url(#{vul})" stroke="#fff" stroke-opacity="0.65" stroke-width="2" filter="url(#{f})" {extra}/>'
            f'<path d="M{x+r} {y+1.5} H{x+b-r}" stroke="#fff" stroke-opacity="0.95" stroke-width="2" stroke-linecap="round"/>')

def lijn(x, y, b, h=12, o=.14, k=GRAFIET):
    return f'<rect x="{x}" y="{y}" width="{b}" height="{h}" rx="{h/2}" fill="{k}" fill-opacity="{o}"/>'

def vink(cx, cy, s=1, k=GROEN, achtergrond=True):
    bg = f'<circle cx="{cx}" cy="{cy}" r="{15*s}" fill="{k}" fill-opacity="0.16"/>' if achtergrond else ""
    return bg + f'<path d="M{cx-6*s} {cy} l{4.5*s} {4.5*s} l{8*s} {-9*s}" fill="none" stroke="{k}" stroke-width="{3.2*s}" stroke-linecap="round" stroke-linejoin="round"/>'


# ---------- Losse bouwstenen die vaak terugkomen ----------

def persoon(cx, cy, s=1, k=GRAFIET, o=0.85):
    """Hoofd en schouders, gecentreerd rond (cx, cy)."""
    return (f'<circle cx="{cx}" cy="{cy - 14*s}" r="{13*s}" fill="{k}" fill-opacity="{o}"/>'
            f'<path d="M{cx-24*s} {cy+26*s} C{cx-24*s} {cy+4*s} {cx+24*s} {cy+4*s} {cx+24*s} {cy+26*s} Z" fill="{k}" fill-opacity="{o}"/>')

def kruis(cx, cy, s=1, k=TERRA):
    """Rondje met kruisje: fout, weggelaten, niet doen."""
    return (f'<circle cx="{cx}" cy="{cy}" r="{15*s}" fill="{k}" fill-opacity="0.16"/>'
            f'<path d="M{cx-6*s} {cy-6*s} L{cx+6*s} {cy+6*s} M{cx+6*s} {cy-6*s} L{cx-6*s} {cy+6*s}" stroke="{k}" stroke-width="{3.2*s}" stroke-linecap="round"/>')

def pijl(pad):
    """Stippellijn met pijlpunt langs een SVG-pad, bv. pijl("M700 450 C 760 450, 790 450, 840 450")."""
    return f'<path d="{pad}" fill="none" stroke="{DIEP}" stroke-opacity="0.4" stroke-width="4" stroke-dasharray="2 11" stroke-linecap="round" marker-end="url(#pijl)"/>'

def hart(cx, cy, s=1, k=TERRA):
    return (f'<path d="M{cx-26*s} {cy} C{cx-26*s} {cy-20*s}, {cx} {cy-20*s}, {cx} {cy} '
            f'C{cx} {cy-20*s}, {cx+26*s} {cy-20*s}, {cx+26*s} {cy} C{cx+26*s} {cy+22*s}, {cx} {cy+38*s}, {cx} {cy+44*s} '
            f'C{cx} {cy+38*s}, {cx-26*s} {cy+22*s}, {cx-26*s} {cy} Z" fill="{k}"/>')

def vonk(cx, cy, r, k=TERRA, o=1):
    """Vierpuntige ster: het gangbare beeld voor "AI"."""
    q = r * 0.18
    return (f'<path d="M{cx} {cy-r} C{cx+q} {cy-q} {cx+q} {cy-q} {cx+r} {cy} C{cx+q} {cy+q} {cx+q} {cy+q} {cx} {cy+r} '
            f'C{cx-q} {cy+q} {cx-q} {cy+q} {cx-r} {cy} C{cx-q} {cy-q} {cx-q} {cy-q} {cx} {cy-r} Z" fill="{k}" fill-opacity="{o}"/>')
