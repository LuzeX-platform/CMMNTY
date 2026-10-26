# Redactierichtlijn: "Zorgtech deze week"

Vastgelegd op verzoek van Job (26 oktober 2026). Geldt voor elke wekelijkse ronde met nieuwe
artikelen voor CMMNTY, tot Job iets anders zegt.

## Wat komt erin

**De hele zorg.** Niet alleen de ggz, maar alles: ziekenhuis, huisarts, ggz, thuiszorg,
wijkverpleging, ouderenzorg, gehandicaptenzorg, jeugdzorg, revalidatie, apotheek, enzovoort.
Ook nieuws van buiten de zorg mag erin, als het zo veel impact heeft dat het er gewoon in
móet (categorie "Tech & trends", zoals de Tesla Roadster).

**Alleen de lijpe innovaties.** Echt nieuw, echt indrukwekkend, of met grote gevolgen voor de
zorg. Een goede toets: zou een zorgverlener dit aan een collega vertellen bij de koffie?

Wel bijvoorbeeld:
- een nieuwe behandeling, techniek of apparaat dat iets kan wat eerst niet kon;
- een doorbraak in onderzoek met een duidelijk zorg-effect;
- een grote uitrol in Nederland die het werk van veel zorgverleners verandert;
- nieuwe regels of besluiten met grote gevolgen voor de praktijk.

Niet:
- software-updates en kleine productnieuwtjes (Job: "ik hoef niet te weten dat de Medido een
  nieuwe softwareupdate heeft");
- financieringsrondes, overnames en benoemingen, tenzij ze de zorg direct veranderen;
- opiniestukken, congressen, awards en "we gaan onderzoeken of…".

## Mix per week

| | Aantal per week |
|---|---|
| Artikelen totaal | 4 à 5 |
| Waarvan over AI | **1, maximaal 2** |
| Waarvan Pro | **1 à 2**: de meest interessante, met de meeste diepgang |
| Waarvan buiten de zorg ("Tech & trends") | hooguit 1, alleen als het echt groot is |

Spreid de onderwerpen over de sectoren: liever ziekenhuis, thuiszorg én ggz dan drie keer ggz.
Is er in een sector die week niets wat echt de moeite waard is, laat het dan weg: liever vier
goede artikelen dan vijf met opvulling. Zeg Job welke sector ontbrak.

**Pro** is voor de stukken waar een lezer het meest aan heeft of het meest van opkijkt. Pro-
artikelen zijn langer en gaan dieper: wat is er precies gebeurd, wat kan het (nog) niet, wat
betekent het voor jouw werk, en wat kun je nu al doen. De samenvatting is de etalage die niet-
Pro-lezers wél zien: maak hem zo dat je verder wilt lezen.

## Feiten

- Alleen nieuws dat in de **afgelopen 7 dagen** is aangekondigd of gepubliceerd. Ouder nieuws
  hooguit als korte context, met datum erbij.
- Controleer in meerdere bronnen. Noem het als cijfers van de maker zelf komen, of als iets nog
  niet onafhankelijk is getoetst.
- Elke bron in `bronnen` in de frontmatter. Het importscript zet ze als "Bronnen" onderaan.
- Twijfel over een feit: weglaten of voorzichtiger formuleren. Nooit invullen.

## Toon

Jip-en-janneke taal: korte zinnen, geen jargon, geen hype. Schrijf voor zorgverleners in het
algemeen (niet alleen ggz-zzp'ers). Eindig praktisch, bijvoorbeeld met "Wat betekent dit voor
jou?" en "Morgen al beginnen?".

## Techniek

- Map: `content/artikelen/zorgtech-week-NN/`, bestanden `01-…md`, `02-…md`. NN is het
  weeknummer van het nieuws (meestal de week vóór de ronde). Een extra ronde over dezelfde week
  krijgt een achtervoegsel, zoals `zorgtech-week-43-zorgbreed`.
- Frontmatter zoals de vorige weken: `titel`, `slug`, `samenvatting`, `toegang` (gratis/pro),
  `status: concept`, `categorie` (uit `backend/src/constanten.ts`), `cover`, `tags`,
  `reeks: Zorgtech deze week`, `volgorde` (doortellen vanaf de vorige week), `gecontroleerd_op`,
  `bronnen`.
- **Illustraties**: eigen graphics in de huisstijl, geen foto's van anderen (rechten). Gebruik
  de hulpjes in `content/illustraties/` (zie de uitleg bovenin `stijl.py`): 1600×900, greige
  achtergrond met terracotta/olijf/zand/diepbruin licht, glaspanelen, geen tekst, geen logo's van
  bedrijven. SVG-bron én JPG naast de artikelen in `afbeeldingen/`.
- Controle: `npm test` (ook met `TEST_DATABASE_URL`), lokaal importeren, artikelen bekijken op
  desktop en mobiel, Pro-afscherming en nieuwsbriefsegmenten nalopen.
- Daarna een branch `content/zorgtech-week-NN`, pull request en samenvoegen naar `main`, zodat
  Job alleen nog het importscript op Render hoeft te draaien (`node dist/importeerArtikelen.js`)
  en in het adminpanel kan publiceren (*Alle concepten selecteren → Publiceer nu*).
