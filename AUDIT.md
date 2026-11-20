# Audit en plan: redesign CMMNTY (november 2026)

Stap 1 (audit) en stap 2 (plan) uit de opdracht. **Er is nog geen code aangepast.** Alles hieronder
wacht op akkoord van Job. Branch: `redesign/cmmnty-2026`. Er gaat niets naar `main` zonder akkoord.

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

## 5. Plan (stap 2)

### Visuele richting: "rustig, warm, betrouwbaar"

- **Herkenbaar LuzeX.** De zwevende glazen balk, het greige met warm licht en het donkerbruine blok
  blijven.
- **Glas alleen waar je iets doet.** Glas komt nog op vier plekken:
  - de balk;
  - de zoekkaart;
  - de profielkaarten;
  - de grote oproep (lid worden).

  Artikellijsten krijgen rustige, effen kaarten in een lichte zandkleur, met een dunne rand en
  zonder vervaging. Dat leest rustiger en laadt sneller.
- **Duidelijke labels.**
  - **Pro** krijgt een eigen accentkleur: donker terracotta `#8a4b2a` met witte tekst, 6,7:1, met
    een slotje ervoor.
  - **Gratis** wordt donkergroen op heel lichtgroen, 5,1:1.
  - De categorie wordt een rustig, neutraal label.
- **Rustiger typografie.** Grotere regelafstand in de kaarten en kortere zichtbare titels.
  - De titel krijgt maximaal 2 regels in de kaart, de samenvatting maximaal 3.
  - Op de artikelpagina zelf blijft de volledige titel staan.
  - Lettertype: zie **Beslissing A**.
- **Toegankelijk als basis.**
  - Alle tekst komt op minstens 4,5:1.
  - Toetsenbordgebruikers zien een duidelijke focusring: 3 px donkerbruin met een witte rand eromheen,
    zodat hij zowel op lichte als op donkere knoppen zichtbaar is.

### Volgorde (elke stap een eigen commit, kleinste risico eerst)

| # | Wat | Bestanden (verwacht) |
|---|---|---|
| 1 | **Contrast en focus**: tekstkleuren in de voettekst en labels, `:focus-visible` voor links, knoppen en kaarten, logo in de voettekst als gewone link, juiste kopvolgorde | `frontend/styles.css`, `frontend/common.js`, `netwerk.html`, `artikelen.html` |
| 2 | **Mobiele header op één rij**: logo zonder ondertitel, compacte knop "Lid worden" en een menuknop (hamburger) die het menu uitklapt | `frontend/common.js`, `frontend/styles.css`, nieuw: `assets/cmmnty-logo-*-compact.svg` (zelfde logo zonder ondertitel) |
| 3 | **Homepage**: ledensectie alleen bij 3 of meer profielen, anders een neutrale regel met het aantal (zie Beslissing C); op mobiel een compacte zoekkaart (lijsten naast elkaar, knop eronder) direct na de knoppen | `frontend/index.html`, `frontend/home.js`, `frontend/styles.css`, eventueel een kleine telling in `backend/src/routes/profiel.ts` |
| 4 | **Netwerk zonder resultaat**: duidelijke lege staat ("Nog geen collega's in [regio]. Bekijk het hele netwerk.") met een knop **Toon alle leden** die de filters wist | `frontend/netwerk.html`, `frontend/netwerk.js`, `frontend/styles.css` |
| 5 | **Artikelkaarten**: nieuwe Pro/Gratis-labels, titel max. 2 regels en samenvatting max. 3 (met line-clamp), effen kaarten | `frontend/common.js` (`artikelKaartHtml`), `frontend/styles.css` |
| 6 | **Glas bewust inzetten**: glas alleen op de balk, de zoekkaart, de profielkaarten en de grote oproep | `frontend/styles.css` |
| 7 | **Specialismen** volgens Beslissing B | `backend/src/constanten.ts`, `frontend/netwerk.js`, `frontend/home.js`, `frontend/dashboard/dashboard.js` (en bij samenvoegen ook een eenmalige update van bestaande profielen) |
| 8 | **Snelheid en verspringen**: vaste afmeting voor omslagafbeeldingen, cache-tijd voor omslagen, scripts met `defer`, de artikelpagina niet laten verspringen | `backend/src/routes/artikelen.ts`, `backend/src/seo.ts`, `frontend/artikel.js`, HTML-bestanden |
| 9 | **Lettertype** volgens Beslissing A: alleen zelf gehost, geen Google Fonts (geen externe verzoeken, AVG) | `frontend/assets/fonts/`, `frontend/styles.css` |

Wat ik **niet** aanpak:
- De zichtbaarheid van profielen, en welke profielgegevens getoond worden.
- De Render-configuratie en het databaseschema.
- Tracking, cookies en externe scripts: die komen er niet bij.

Lukt iets alleen met zo'n wijziging, dan meld ik dat eerst.

### Beslissingen voor Job

**A. Lettertype en bruin.**
De code gebruikt systeemletters en `#3b2e24`. De opdracht noemt Cormorant Garamond, DM Sans en
`#4a3f37`.
1. Wat is leidend: wat luzex.nl nu echt gebruikt, of wat in de opdracht staat?
2. Volgens `CLAUDE.md` hoort een tokenwijziging ook in ACCRD.
   - *Voorstel:* zet de lettertypes alleen voor CMMNTY in een eigen laag, en laat de gedeelde
     kleur-tokens ongemoeid. Zo hoeft ACCRD niet mee.
   - Kost: twee lettertypebestanden van samen ongeveer 80 à 120 kB, zelf gehost en eenmalig geladen.

**B. Specialismen.** Twee mogelijkheden:
- **B1 – Groeperen, niets samenvoegen (aanbevolen voor nu).** Dezelfde twaalf namen, maar in
  groepen in de keuzelijst. Er verandert niets aan bestaande profielen.
  - *Algemeen:* Psychologie · Psychotherapie · Psychiatrie · GGZ (algemeen)
  - *Doelgroep en thema:* Kinder- en jeugdpsychologie · Verslavingszorg · Traumabehandeling ·
    Neuropsychologie
  - *Relaties en seksualiteit:* Relatietherapie · Seksuologie
  - *Anders:* Coaching · Overig
- **B2 – Samenvoegen tot negen.**
  - "GGZ (algemeen)", "Psychologie" en "Psychotherapie" worden **Psychologie en psychotherapie**.
  - "Relatietherapie" en "Seksuologie" worden **Relaties en seksualiteit**.
  - De rest blijft.
  - Nadeel: bestaande profielen moeten eenmalig worden bijgewerkt. En een psychotherapeut is niet
    meer apart te vinden van een psycholoog.

**C. Ledenteller.**
1. Wat tellen we?
   - **(a)** Zichtbare netwerkprofielen. Die telling bestaat al.
   - **(b)** Alle bevestigde accounts. Daarvoor is een kleine nieuwe telling nodig. Hij geeft alleen
     een getal, nooit namen.
2. Welk woord? Niet elk account is een zorgprofessional: lezers kunnen zich ook aanmelden.
   "[AANTAL] leden" is daarom eerlijker dan "[AANTAL] zorgprofessionals".
3. Vanaf welk aantal tonen we het getal? *Voorstel:* vanaf 10. Daaronder een neutrale regel:
   "Het netwerk is net van start. Zet je praktijk er als een van de eersten in."

**D. Mobiel menu.** Een menuknop (hamburger, *aanbevolen*), of een rij met drie links onder de
balk. Die rij is eenvoudiger, maar kost ruimte.

**E. Pro-kleur.** Donker terracotta (*aanbevolen*) of donkerbruin.

**F. Snelheid (stap 8)** vraagt kleine aanpassingen in de server. Het gaat om cache-tijd en de
afmetingen van afbeeldingen, niet om de database of Render. Mag dat?

### Open vragen

1. **Echte profielen:** zijn er naast het profiel van de oprichter al echte, zichtbare profielen?
   De ledensectie verschijnt pas vanaf 3. Ik verander niets aan wie zichtbaar is.
2. **Live meten:** deze werkomgeving kan cmmnty.luzex.nl niet openen. Twee mogelijkheden:
   - Job draait zelf [pagespeed.web.dev](https://pagespeed.web.dev) voor de vier pagina's en stuurt
     de cijfers.
   - Ik doe de controle in een nieuwe sessie in de werkomgeving "LuzeX CMMNTY", die de live site
     wél mag openen.
3. **Huisstijl luzex.nl:** mag ik de repository van luzex.nl (`WBST`) lezen om de lettertypes en
   kleuren te bevestigen? Of stuurt Job de juiste waarden?
4. **Teksten:** mogen de vaste teksten op de homepage licht worden ingekort voor mobiel? De
   betekenis blijft gelijk.

Na akkoord werk ik op `redesign/cmmnty-2026`. Daarna maak ik nieuwe screenshots
(`docs/redesign/na/`), draai ik Lighthouse opnieuw en controleer ik alle links:
- registreren en inloggen;
- de netwerk- en artikelpagina's;
- luzex.nl en ACCRD;
- `mailto:job@luzex.nl`.
