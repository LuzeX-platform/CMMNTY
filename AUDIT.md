# Audit, plan en uitvoering: redesign CMMNTY (november 2026)

**Stand van zaken (21 november 2026):** stap 1 (audit), 2 (plan), 3 (uitvoeren) en 4 (controleren)
zijn klaar op de branch `redesign/cmmnty-2026`. **Er staat nog niets op `main` en dus nog niets live.**
Dat gebeurt pas na akkoord van Job, omdat Render automatisch uitrolt.

- Hoofdstuk 0 t/m 4 is de audit zoals die vóór de wijzigingen is gemaakt. Die laat ik staan als
  nulmeting.
- Hoofdstuk 5 en verder beschrijft wat er gekozen en gedaan is, en hoe het gecontroleerd is.
- Job heeft op 21 november de open vragen beantwoord. Die keuzes zijn ook verwerkt (specialismen,
  logo, teller).

---

## 0. Hoe is gemeten

- **Welke versie:** exact de code die live staat (`main`, commit `3f38080`, live sinds 16 november).
- **Waar:** lokaal, niet op cmmnty.luzex.nl zelf. Deze werkomgeving mag de live site niet openen.
  De pagina's zijn dus gelijk aan live, de inhoud uit de database niet helemaal:
  - **Netwerk:** zoals Job het beschrijft, met precies één zichtbaar profiel. Lokaal heet dat
    "Demo Eva" (een testprofiel, geen echt lid).
  - **Artikelen:** de echte artikelen uit `content/`.
- **Screenshots:** 1440 px (desktop) en 375 px (mobiel), in `docs/redesign/voor/`. Gemaakt van
  de homepage, het netwerk, het netwerk met een zoekopdracht zonder resultaat, de artikelenlijst
  en een artikel. Alle screenshots zijn als bezoeker gemaakt.
- **Lighthouse:** versie 12.8, per pagina een keer met het mobiele en een keer met het
  desktop-profiel.
  - **Toegankelijkheid en SEO:** deze scores gelden ook voor live, want het is dezelfde HTML en CSS.
  - **Performance:** lokaal is er geen internetvertraging en geen Cloudflare. Live is dit cijfer
    anders, en zeker niet beter. Een live-meting kan Job zelf in een minuut doen op
    [pagespeed.web.dev](https://pagespeed.web.dev) (zie open vragen).

## 1. Huisstijl: wat staat er echt in de code?

De opdracht noemt Cormorant Garamond, DM Sans en donkerbruin `#4a3f37`. **In de code staat iets anders:**

| | In de opdracht | In de CMMNTY-code |
|---|---|---|
| Koppen | Cormorant Garamond | systeemletter (San Francisco op Apple, Segoe UI op Windows) |
| Lopende tekst | DM Sans | dezelfde systeemletter |
| Donkerbruin | `#4a3f37` | `#3b2e24` (volgens het commentaar "zelfde als luzex.nl en ACCRD") |
| Achtergrond | warm beige | `#cfc6bc` (greige) |
| Accent | – | grafiet `#1d1d1f` (knoppen, Pro-label) |

- Webfonts worden niet geladen, en de CSP staat alleen lettertypes van de eigen site toe.
- De kleur- en glas-tokens zijn 1-op-1 overgenomen uit ACCRD. `CLAUDE.md` zegt: wie een token
  wijzigt, doet dat ook in ACCRD.
- Ik heb geprobeerd de huisstijl van luzex.nl na te kijken in de repository van de website. Dat
  mocht niet vanuit deze sessie. Of luzex.nl zelf Cormorant Garamond, DM Sans en `#4a3f37`
  gebruikt, kon ik dus niet bevestigen. → **Beslissing A**.

## 2. Bevindingen per probleem uit de opdracht

### 1. Sociaal bewijs ontbreekt ✔ klopt
Bij 1 of 2 profielen toont de homepage die profielen plus een kaart "Jouw praktijk hier?"
(`frontend/home.js`). Bij één profiel oogt het netwerk daardoor leeg in plaats van levendig.

Er is al een teller: "N zorgprofessionals in het netwerk". Die staat in de zoekkaart en verschijnt
pas vanaf 10 profielen. Hij telt **zichtbare netwerkprofielen**, niet alle leden.

Screenshot: `desktop-home.jpg`, sectie "Collega's in CMMNTY".

### 2. Zoekfunctie zonder feedback ◐ deels
- **Netwerkpagina:** bij geen resultaat staat er wel "0 collega's" en "Nog niemand gevonden met
  deze filters". Dat is kleine, gecentreerde grijze tekst, zonder knop om de filters los te laten.
  Op mobiel valt het weg tussen de formuliervelden (`mobiel-netwerk-leeg.jpg`).
- **Homepage:** de zoekkaart stuurt je altijd naar de netwerkpagina, ook als daar niets te vinden is.

### 3. Specialismenlijst onoverzichtelijk ✔ klopt
- Er zijn twaalf opties, en ze staan in de code (`backend/src/constanten.ts`), niet in een aparte
  databasetabel.
- Leden slaan de gekozen namen op in hun profiel. Wie namen samenvoegt, moet dus ook de bestaande
  profielen bijwerken. Dat is een datawijziging, geen schemawijziging. → **Beslissing B**.

### 4. Artikelkaarten inconsistent ◐ deels
- **Labels:** er is wel verschil. Pro is een zwart pilletje, Gratis een lichtgroen pilletje. Maar:
  - het groene Gratis-label haalt maar **2,5:1 contrast** (de norm is 4,5:1);
  - het categorielabel haalt 4,0:1;
  - beide labels zijn klein (11,5 px), dus het verschil valt nauwelijks op.
- **Titels:** gemeten op de artikelenpagina (desktop) zijn ze **2 tot 4 regels** lang. De
  samenvattingen zijn ook lang, dus de kaarten worden 616 tot 687 px hoog.

### 5. Mobiele header breekt ✔ klopt
Op 375 px staat de balk op **drie rijen** en is hij **149 px hoog**: het logo, dan de knop, dan
het menu. Op een telefoonscherm van 812 px is dat 18 % van de ruimte (`mobiel-home.jpg`).

### 6. Op mobiel eerst alleen tekst ◐ deels
- De zoekkaart staat in de huidige code al direct na de knoppen, maar hij is groot.
- Hij begint op **707 px**, en de zoekknop staat op **1019 px**. Op een scherm van 812 px hoog
  zie je de kaart dus pas na het scrollen.
- Oorzaak: de hoge header (zie 5) plus de volledige kaart, met twee lijsten en de knop onder elkaar.

### 7. Ondertitel onder het logo te klein ✔ klopt
"Samen beter in de zorg." zit in het logobestand zelf. In de mobiele balk is het hele logo
30 px hoog. De ondertitel wordt daardoor zo'n 4 tot 5 px: onleesbaar.

Er is al een los beeldmerk zonder tekst (`assets/cmmnty-merk-zwart.svg`).

### 8. Contrast en focus ✔ klopt, gemeten
Lighthouse vindt contrastfouten op alle pagina's. Daarnaast heb ik zelf nagerekend:

| Wat | Waar | Contrast | Norm |
|---|---|---|---|
| Kopjes en copyright in de voettekst (`--text-tertiary` `#6e6760`) | alle pagina's | **3,30:1** | 4,5:1 |
| Gratis-label (groen op lichtgroen) | kaarten, artikel | **2,46:1** | 4,5:1 |
| Grijze tekst op de uitnodigingskaart en het categorielabel | home, artikel | **4,04:1** | 4,5:1 |
| Grijze lopende tekst (`#585249`) op de kale achtergrond | overal | 4,58:1 | haalt het net, zonder marge |
| Grijze lopende tekst op glas | kaarten | 5,51:1 | ok |

**Focus:**
- Alleen invoervelden hebben een eigen focusring.
- Links en knoppen vallen terug op de dunne standaardrand van de browser. Op de donkere knoppen
  "Gratis lid worden" is die vrijwel onzichtbaar.
- Er is geen `:focus-visible`-stijl.

Andere toegankelijkheidspunten uit Lighthouse:
- **Logo in de voettekst:** dat is een link met `role="img"`. Die combinatie mag niet: een
  schermlezer leest het niet als link voor.
- **Netwerk- en artikelenpagina:** de kopjes springen van `h1` direct naar `h3`.

### 9. Glas overal hetzelfde ✔ klopt
- Hetzelfde glas (vervaging en verloop) zit op de balk, de zoekkaart, alle profielkaarten, alle
  artikelkaarten, alle panelen en zelfs de invoervelden en knoppen.
- Op de artikelenpagina staan zo tot 20 glaskaarten tegelijk. Dat is druk voor het oog en zwaar
  voor oudere telefoons: elke kaart vervaagt de achtergrond opnieuw.

## 3. Extra bevindingen (niet in de opdracht)

- **De artikelpagina verspringt sterk tijdens het laden.**
  - De CLS-score (Cumulative Layout Shift) is **0,86 op desktop** en 0,16 op mobiel. Onder de 0,1
    is goed.
  - Oorzaak: de server zet eerst een korte versie in de pagina, voor zoekmachines. Daarna vervangt
    het script die door de volledige versie.
  - De omslagafbeelding heeft bovendien geen vaste afmeting.
  - Ook de netwerkpagina verspringt, met 0,20 op desktop.
- **Omslagafbeeldingen zijn zwaar.** Elke kaart laadt de volledige afbeelding van 1600×900 als JPG,
  ook als de kaart maar 290 px breed is. De afbeeldingen worden niet bewaard in de browser
  (er wordt geen cache-tijd meegestuurd).
  - Lighthouse schat de mogelijke besparing op 0,2 tot 0,7 MB per pagina.
- **Compressie:** lokaal worden HTML, CSS en JS niet gecomprimeerd verstuurd. Live doet
  Cloudflare/Render dat waarschijnlijk wel. Te controleren met een live-meting.
- **Scripts staan achteraan, maar zonder `defer`.** Lighthouse telt ze daardoor mee als
  "render-blocking". De mogelijke winst is klein: 0,1 tot 0,5 s op mobiel.

## 4. Lighthouse (lokaal, vóór)

| Pagina | Toestel | Performance | Toegankelijkheid | Best practices | SEO | CLS |
|---|---|---|---|---|---|---|
| Home | mobiel | 99 | 95 | 100 | 100 | 0 |
| Home | desktop | 100 | 95 | 100 | 100 | 0 |
| Netwerk | mobiel | 99 | 93 | 100 | 100 | 0,06 |
| Netwerk | desktop | 91 | 93 | 100 | 100 | 0,20 |
| Artikelen | mobiel | 97 | 93 | 100 | 100 | 0 |
| Artikelen | desktop | 100 | 93 | 100 | 100 | 0,06 |
| Artikel | mobiel | 92 | 94 | 100 | 100 | 0,16 |
| Artikel | desktop | **76** | 94 | 100 | 100 | **0,86** |

Performance live: [nog te meten] (zie open vragen).

---

## 5. Beslissingen van Job

| | Vraag | Antwoord van Job | Wat ik ermee gedaan heb |
|---|---|---|---|
| A | Lettertype en bruin | Huisstijl LuzeX aangeleverd (zie hieronder) | Toegepast. Geen webfonts: één systeemletter via `--font`. |
| B | Specialismen groeperen of samenvoegen | Eerst: "Weet niet wat dat doet." Na uitleg: "B1, maar ik wil niets over seksualiteit of relaties." | Gedaan: groepen in de lijst, en Seksuologie en Relatietherapie eruit. Zie hoofdstuk 6. |
| C | Ledenteller | "Teller vanaf 100. Noem het 100 zorgprofessionals." Alle bevestigde accounts tellen mee: "dat is goed". | Gedaan: pas vanaf 100 bevestigde accounts een getal, nooit namen. |
| D | Mobiel menu | "Hamburger menu knop is top." | Gedaan. |
| E | Pro-kleur | Volgt uit de huisstijl | Pro wordt grafiet met een slotje (geen terracotta: dat staat niet in de huisstijl). |
| F | Kleine serveraanpassingen voor snelheid | "Ja." | Gedaan: cache-tijd voor omslagen en een artikelpagina die niet verspringt. Geen database- of Render-wijziging. |

**Huisstijl LuzeX, zoals toegepast:**
- **Lettertype:** één familie voor koppen en tekst, vastgelegd in één token
  `--font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif`.
  Geen Google Fonts, geen `@font-face`. Koppen gewicht 600 (was 700).
- **Kleuren:** de bestaande tokens bleven gelijk; ze kwamen al overeen met de huisstijl
  (`--bg #cfc6bc`, `--surface #fff`, `--text #1d1d1f`, `--accent #1d1d1f`, zachtere tekst `#585249`,
  lichtste `#6e6760`). Nieuw is alleen `--diep: #3b2e24`, voor het ene donkere blok per pagina.
- **Vormen:** knoppen en de balk zijn pillen, panelen ronde hoeken (bestaande tokens).
- **Focus:** `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` overal,
  ook op velden en vinkjes. Raakvlakken minstens 44 px.
- **Toon:** uitroeptekens weg uit de vaste teksten ("Bijna klaar.", "Gelukt.").

## 6. Wat er veranderd is, per probleem

| # | Probleem | Vóór | Na |
|---|---|---|---|
| 1 | Sociaal bewijs | Bij 1 profiel een half leeg ledenblok | Ledenblok pas vanaf **3** zichtbare profielen. Daaronder een rustige uitnodiging "Vind collega's en word gevonden" met twee knoppen. Getal pas vanaf **100**: "[aantal] zorgprofessionals zijn aangesloten bij CMMNTY." |
| 2 | Zoeken zonder resultaat | Klein grijs "Nog niemand gevonden" | Duidelijk blok: "Nog geen collega's in regio Noord." met knop **Bekijk het hele netwerk**. Bij elke zoekopdracht staat er een knop **Toon alle leden**. |
| 3 | Specialismen | Twaalf namen in één lijst | Tien namen in drie groepen: **Algemeen** (Psychologie, Psychotherapie, Psychiatrie, GGZ (algemeen)), **Doelgroep en thema** (Kinder- en jeugdpsychologie, Verslavingszorg, Traumabehandeling, Neuropsychologie) en **Anders** (Coaching, Overig). Seksuologie en Relatietherapie zijn eruit. Zelfde groepen in de zoeklijsten en in het profiel van een lid. |
| 4 | Artikelkaarten | Gratis-label 2,5:1; titels 2–4 regels; kaarten 616–687 px hoog | **Pro** grafiet met slotje, **Gratis** wit met groen stipje, categorie grijs. Titel max. 2 regels, samenvatting max. 3. Alle kaarten even hoog (478 px op desktop). |
| 5 | Mobiele header | 3 rijen, 149 px hoog | 1 rij, 62 px: logo, knop "Lid worden", menuknop. Menu klapt open, sluit met Esc of een klik op een link. |
| 6 | Mobiel eerst alleen tekst | Zoekknop op 1019 px (onder de vouw) | Compacte zoekkaart, lijsten naast elkaar. Zoekknop op 667 px: zichtbaar zonder scrollen op een telefoon van 812 px. |
| 7 | Ondertitel logo onleesbaar | 4–5 px op mobiel, zo'n 8 px op desktop | Overal (balk en voettekst, licht en donker) het logo zonder ondertitel. De zin "Samen beter in de zorg." staat groot bovenaan de homepage. |
| 8 | Contrast en focus | Fouten op alle pagina's; geen focusring | **0 contrastfouten** op alle pagina's, licht én donker thema. Duidelijke grafiet focusring overal. |
| 9 | Glas overal | Tot 20 glaskaarten tegelijk | Glas op de balk, de zoekkaart, de profielkaarten en de panelen. Artikelkaarten zijn effen wit. |
| – | Artikelpagina verspringt | CLS 0,86 (desktop) | CLS 0: de server zet meteen dezelfde opbouw neer als het script, omslag met vaste maat. |
| – | Omslagen niet bewaard | Elke keer opnieuw geladen | Met versie in het adres: een jaar in de cache. Nieuwe foto = nieuw adres, dus nooit een oude foto. |

## 7. Wijzigingen per bestand

**Frontend**
- `frontend/styles.css`
  - Tokens `--font` en `--diep` erbij; koppen 600; `:focus-visible`-ring; `outline: none` weg bij velden.
  - Voettekst: kopjes en copyright in de zachtere tekstkleur (was te licht); links 44 px hoog.
  - Mobiele balk (tot 900 px): één rij, compact logo, menuknop, uitklapmenu.
  - Ruimte voor de balk vóórdat het script hem tekent (tegen verspringen).
  - Homepage: uitnodigingsblok `.netwerk-start`, compacte zoekkaart op mobiel.
  - Netwerk: lege staat `.lege-staat`, resultaatbalk met "Toon alle leden", filters volle breedte op mobiel.
  - Labels: `.badge-pro` (grafiet + slotje), `.badge-gratis` (wit + groen stipje), `.badge-categorie`, `.badge-specialisme`.
  - Logo zonder ondertitel op alle breedtes.
  - Specialismen in het profiel per groep (`.chip-groepen`, `.chip-groep`), keuzeknoppen 44 px hoog.
  - Rode knop (`button.gevaar`, account verwijderen) ook in donker thema leesbaar (was 3,4:1).
  - Artikelkaarten `.kaart-artikel`: effen, titel 2 en samenvatting 3 regels; omslag vaste 16:9.
- `frontend/common.js`: nieuwe balk met menuknop (Esc sluit); labels met slotje en stipje;
  artikelkaart met vaste maat en "lui" laden; logo in de voettekst als gewone link naar luzex.nl;
  `specialismeOptiesHtml()` voor de zoeklijsten met groepen.
- `frontend/index.html`, `frontend/home.js`: uitnodiging of ledenblok (vanaf 3), teller (vanaf 100),
  compacte zoekkaart.
- `frontend/netwerk.html`, `frontend/netwerk.js`: lege staat in gewone woorden, knop "Toon alle leden",
  verborgen kopje voor de juiste kopvolgorde, specialismen in groepen.
- `frontend/dashboard/profiel.html`, `frontend/dashboard/dashboard.js`: specialismen in groepen.
- `frontend/artikelen.html`, `frontend/artikelen.js`: verborgen kopje; bovenste drie foto's laden meteen.
- `frontend/artikel.js`: zelfde labels als de kaarten; omslag met vaste maat.
- `frontend/registreren.html`, `frontend/auth.js`, `frontend/dashboard/dashboard.js`: uitroeptekens weg.
- `frontend/assets/cmmnty-logo-zwart-compact.svg`, `cmmnty-logo-wit-compact.svg` (nieuw): het logo zonder ondertitel.
- Alle HTML-bestanden: `defer` op de scripts.

**Backend** (geen schema- of Render-wijziging, geen aanpassing van gegevens in de database)
- `backend/src/constanten.ts`: Seksuologie en Relatietherapie uit de lijst; nieuw `SPECIALISME_GROEPEN`.
- `backend/src/routes/artikelen.ts` (`/api/keuzelijsten`): geeft ook de groepen mee.
- `backend/src/routes/profiel.ts`: `alleenBekendeSpecialismen()` toont van een profiel alleen
  specialismen die nog in de lijst staan. Zoeken op een oud specialisme filtert niet meer. Het
  profiel zelf blijft zichtbaar; de opgeslagen gegevens blijven zoals ze zijn.
- `backend/src/routes/profiel.ts`: `/api/netwerk/uitgelicht` geeft ook `zorgprofessionals`: het aantal
  bevestigde accounts, maar alleen vanaf 100 (`TELLER_VANAF`), anders `null`. Nooit namen.
- `backend/src/artikelen.ts`: `coverPad()` maakt het omslag-adres met versie (`?v=`).
- `backend/src/routes/artikelen.ts`: kaarten krijgen dat adres; de omslag-route stuurt met versie
  "een jaar bewaren", zonder versie "een uur", en concepten nooit.
- `backend/src/seo.ts`: de artikelpagina komt van de server al met labels, meta en omslag. De
  artikeltekst blijft daar buiten, net als eerst.
- Tests: `backend/test/api.test.ts` (teller vanaf 100, cache-regels omslag),
  `backend/test/artikelen.test.ts` (`coverPad`), `backend/test/seo.test.ts` (opbouw artikelpagina),
  `backend/test/netwerk.test.ts` en `api.test.ts` (specialismen: groepen kloppen, oude keuzes niet
  meer te kiezen, te zien of te vinden, gegevens onaangetast).
  **77 van 77 tests slagen.**

## 8. Controle (stap 4)

Gemeten op dezelfde manier als de nulmeting: lokaal, met dezelfde code en inhoud.

### Lighthouse vóór en na

Volgorde per cel: performance / toegankelijkheid / best practices / SEO.

| Pagina | Toestel | Vóór | Na | CLS vóór → na |
|---|---|---|---|---|
| Home | mobiel | 99 / 95 / 100 / 100 | **100 / 100 / 100 / 100** | 0 → 0 |
| Home | desktop | 100 / 95 / 100 / 100 | **100 / 100 / 100 / 100** | 0 → 0 |
| Netwerk | mobiel | 99 / 93 / 100 / 100 | **100 / 100 / 100 / 100** | 0,06 → 0,00 |
| Netwerk | desktop | 91 / 93 / 100 / 100 | **100 / 100 / 100 / 100** | 0,20 → 0,01 |
| Artikelen | mobiel | 97 / 93 / 100 / 100 | **96–98** / 100 / 100 / 100 | 0 → 0 |
| Artikelen | desktop | 100 / 93 / 100 / 100 | **100 / 100 / 100 / 100** | 0,06 → 0 |
| Artikel | mobiel | 92 / 94 / 100 / 100 | **98 / 100 / 100 / 100** | 0,16 → 0 |
| Artikel | desktop | **76** / 94 / 100 / 100 | **100 / 100 / 100 / 100** | **0,86 → 0** |

Artikelen-mobiel wisselt tussen metingen: drie keer gemeten gaf 96, 98 en 98. Dat is ruis van de
meting, geen verslechtering. Performance live: [nog te meten] (zie open vraag 2).

### Overige controles

| Controle | Hoe | Uitkomst |
|---|---|---|
| Contrast (≥ 4,5:1, vanaf 24 px ≥ 3:1) | axe op de getekende pagina: alle publieke pagina's (als bezoeker), alle dashboard-pagina's (als lid) en alle beheerpagina's (als admin), 375 en 1440 px, licht én donker thema | **0 fouten** (de rode verwijderknop in donker thema is onderweg gevonden en opgelost) |
| Geen horizontale scrollbalk | 320, 360, 375, 390, 768 en 1440 px, alle pagina's, als bezoeker, lid en admin | **0 keer** |
| Focus zichtbaar | met Tab door home, netwerk, netwerk leeg, artikelen, artikel, registreren, inloggen (375 en 1440 px) | elke tabstop heeft de ring |
| Verspringen tijdens laden | layout-shift gemeten op home, netwerk, artikelen, artikel | **geen** verschuivingen |
| Scriptfouten | alle pagina's als bezoeker, lid en admin | geen |
| Links | alle links op alle pagina's opgevraagd | 22 interne links, **0 kapot**. Registreren, inloggen, netwerk en artikelen aanwezig. Voettekst: `https://luzex.nl`, `https://accrd.luzex.nl`, `mailto:job@luzex.nl` (externe adressen kan deze werkomgeving niet openen; de adressen zelf kloppen). |

Schermafbeeldingen: `docs/redesign/voor/` en `docs/redesign/na/` (zelfde pagina's, zelfde breedtes).

## 9. Niet gedaan, en waarom

- **Kleinere omslagfoto's voor kaartjes.** Lighthouse ziet nog 0,2 à 0,7 MB winst als kaartjes een
  kleinere versie van de foto krijgen. Dat vraagt een tweede, kleinere foto per artikel, en dus een
  extra kolom in de database of een extra stap bij het importeren. Dat is een schemawijziging:
  eerst vragen. De foto's zijn nu gemiddeld 62 kB, dus de winst is beperkt.
- **Compressie (gzip/brotli) en cache van CSS/JS.** Lokaal staat dat uit. Live doet Render dat
  mogelijk al. Eerst live meten, dan pas iets toevoegen.
- **ACCRD:** de nieuwe tokens `--font` en `--diep` staan alleen in CMMNTY. Volgens `CLAUDE.md` hoort
  een tokenwijziging ook in ACCRD; dit zijn toevoegingen, geen wijzigingen, maar ACCRD kan ze
  overnemen voor dezelfde huisstijl.
- **Bestaande keuzes Seksuologie/Relatietherapie.** Leden die die eerder kozen, zijn niet aangepast
  in de database. Hun profiel blijft gewoon zichtbaar; alleen die keuze wordt niet meer getoond.
  Slaan ze hun profiel opnieuw op, dan valt hij vanzelf weg.

## 10. Antwoorden van Job (21 november) en wat nog openstaat

| Vraag | Antwoord | Gedaan |
|---|---|---|
| Specialismen | "B1, maar ik wil niets over seksualiteit of relaties." | Ja, zie hoofdstuk 6. |
| Wie telt als zorgprofessional? | Alle bevestigde accounts: "dat is goed". | Niets te veranderen. |
| Ondertitel logo op desktop | "Mag" (weghalen). | Ja, overal. |
| Live meten | "Is goed." | Na het live zetten (zie hieronder). |

**Live meten, in gewone woorden:** alle cijfers hierboven zijn gemeten op een kopie van de site in
deze werkomgeving. Die kan de echte site cmmnty.luzex.nl niet openen. Na het live zetten meten we
één keer de echte site, om te zien of hij daar net zo snel is. Dat kost niets en verandert niets.

**Nog open:** akkoord van Job om `redesign/cmmnty-2026` samen te voegen met `main`. Daarna rolt
Render het automatisch uit.
