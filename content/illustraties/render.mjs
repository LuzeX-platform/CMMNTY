// Zet alle .svg-bestanden in een map om naar .jpg (1600x900, kwaliteit 90) met een
// headless Chromium. Playwright is geen afhankelijkheid van de app zelf; installeer hem los:
//
//   mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright@1
//   NODE_PATH=/tmp/pw/node_modules node content/illustraties/render.mjs content/artikelen/zorgtech-week-NN/afbeeldingen
//
// In de Claude Code-cloudomgeving staat Chromium al klaar in /opt/pw-browsers/chromium;
// elders gebruikt Playwright zijn eigen browser (CHROMIUM_PAD leeg laten).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const map = process.argv[2];
if (!map) throw new Error("Geef de map met .svg-bestanden op");

const pad = process.env.CHROMIUM_PAD ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(pad ? { executablePath: pad } : {});
const pagina = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const bestand of fs.readdirSync(map).filter((f) => f.endsWith(".svg"))) {
  await pagina.setContent(`<html><body style="margin:0">${fs.readFileSync(path.join(map, bestand), "utf8")}</body></html>`);
  const uit = path.join(map, bestand.replace(/\.svg$/, ".jpg"));
  await pagina.screenshot({ path: uit, type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 1600, height: 900 } });
  console.log(`${uit}  ${Math.round(fs.statSync(uit).size / 1024)} kB`);
}
await browser.close();
