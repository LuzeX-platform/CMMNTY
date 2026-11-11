#!/usr/bin/env python3
"""Maakt het deelplaatje van cmmnty.luzex.nl: frontend/assets/og-image.png.

Linkvoorbeelden in WhatsApp, LinkedIn, Slack en iMessage willen een liggend
beeld van 1200x630. Zonder zo'n beeld pakken ze het vierkante app-icoon en
snijden dat bij, of tonen ze helemaal niets.

Het woordmerk komt uit assets/accrd-logo-zwart.svg in plaats van overgetekend
te worden: zo kan het deelplaatje niet gaan afwijken van het merk op de site.
Achtergrond en glas zijn dezelfde als in styles.css, zodat het plaatje bij
luzex.nl en bij het platform hoort.

    python3 tools/og.py

Draai dit opnieuw als het woordmerk verandert.
"""
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
MERK = WORTEL / "frontend/assets/cmmnty-logo-zwart.svg"
UIT = WORTEL / "frontend/assets/og-image.png"
ONDERSCHRIFT = "VOOR ZELFSTANDIGE ZORGPROFESSIONALS"
BREED, HOOG = 1200, 630

PAGINA = """<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ width: {breed}px; height: {hoog}px; background: #cfc6bc; position: relative;
    overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
    'Segoe UI', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; }}
  .vlek {{ position: absolute; border-radius: 50%; filter: blur(90px); }}
  .glas {{ position: absolute; inset: 62px; border-radius: 44px;
    background: linear-gradient(142deg, rgba(255,255,255,0.60),
      rgba(255,255,255,0.24) 46%, rgba(255,255,255,0.40));
    backdrop-filter: blur(30px) saturate(190%);
    border: 1px solid rgba(255,255,255,0.58);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.95),
      inset 0 -18px 34px rgba(255,255,255,0.20),
      0 26px 64px rgba(29,29,31,0.20);
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 46px; }}
  .merk {{ width: 660px; display: block; }}
  .onderschrift {{ font-size: 24px; font-weight: 600; letter-spacing: 0.26em;
    color: #3b2e24; text-indent: 0.26em; }}
</style></head><body>
  <div class="vlek" style="width:560px;height:560px;left:-140px;top:-170px;
    background:#c98a63;opacity:0.55"></div>
  <div class="vlek" style="width:470px;height:470px;right:-90px;top:-120px;
    background:#8d9472;opacity:0.42"></div>
  <div class="vlek" style="width:620px;height:620px;right:-150px;bottom:-280px;
    background:#3b2e24;opacity:0.32"></div>
  <div class="vlek" style="width:380px;height:380px;left:330px;bottom:-190px;
    background:#e8dccc;opacity:0.60"></div>
  <div class="glas">
    <div class="merk">{logo}</div>
    <div class="onderschrift">{onderschrift}</div>
  </div>
</body></html>"""


def main():
    from playwright.sync_api import sync_playwright

    logo = MERK.read_text(encoding="utf-8")
    # De vaste breedte en hoogte moeten weg, anders negeert de SVG de 660px
    # van .merk en staat hij op ware grootte in de hoek.
    logo = logo.replace('width="707.3" height="126"', 'width="100%" height="auto"', 1)
    pagina = PAGINA.format(breed=BREED, hoog=HOOG, logo=logo, onderschrift=ONDERSCHRIFT)

    tijdelijk = WORTEL / ".og-tijdelijk.html"
    tijdelijk.write_text(pagina, encoding="utf-8")
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")
            p = b.new_page(viewport={"width": BREED, "height": HOOG})
            p.goto(tijdelijk.as_uri())
            p.wait_for_timeout(1200)
            p.screenshot(path=str(UIT))
            b.close()
    finally:
        tijdelijk.unlink(missing_ok=True)
    print(f"{UIT.relative_to(WORTEL)} geschreven ({UIT.stat().st_size} bytes, {BREED}x{HOOG})")


if __name__ == "__main__":
    main()
