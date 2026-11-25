# Prompt: blok "Over Job" op de andere LuzeX-sites

Plak de tekst hieronder in de overkoepelende LuzeX-chat.

---

**Opdracht: zet het blok "Wie zit erachter?" over Job op de andere LuzeX-sites**

Op CMMNTY (repo `LuzeX-platform/CMMNTY`, pagina `frontend/over.html`) staat een Over-pagina met een persoonlijk blok over mij, met foto. Ik wil datzelfde persoonlijke blok ook op de andere LuzeX-sites (luzex.nl en de andere producten). Het CMMNTY-deel neem je níét over.

**Wat er per site komt**
- Kicker: "Wie zit erachter?"
- Kop: "Hoi, ik ben Job"
- Deze tekst, letterlijk:
  > Ik haal mijn energie uit het helpen van anderen. Ik ben opgegroeid tussen zorgprofessionals en zag van dichtbij hoeveel moeite de digitale wereld hun kostte. Die moeite wil ik zo veel mogelijk wegnemen.
- Daaronder één of twee zinnen over hoe dít product daarbij helpt. Haal die uit teksten die al op die site staan, en verzin niets. Staat er niets bruikbaars, zet dan `[PLACEHOLDER: hoe <product> zorgprofessionals helpt]` neer en vraag het mij.
- De foto: gebruik alléén de bijgesneden versie, waarop alleen ik sta. Die staat in de CMMNTY-repo als `frontend/assets/job.jpg` (328×410 px, verhouding 4:5). Neem het bestand op in de eigen assets van elke site. Geen link naar een andere site. Alt-tekst: "Portret van Job".
- Contact (alleen waar het past): job@luzex.nl.

**Níét overnemen (dat is CMMNTY)**
De zin "Ik heb CMMNTY opgezet…", de alinea "Waarom ik CMMNTY maak" (artikelen en zorginnovatie), "Drie dingen", "Hoe het werkt", Pro, de nieuwsbrief, het netwerk en de oproep "Samen sta je sterker".

**Waar op de site**
Op een bestaande Over-pagina of Over-sectie. Is die er niet, stel dan een plek voor (een eigen Over-pagina, of een sectie op de homepage) en vraag mij eerst.

**Vormgeving (zoals op CMMNTY, binnen de LuzeX-huisstijl)**
- Twee kolommen: links de foto (hooguit 300 px breed, 4:5, afgeronde hoeken met de grote radius van de site, zachte schaduw), rechts de tekst. Onder 760 px komen ze onder elkaar, met de foto hooguit 260 px breed.
- Gebruik de tokens van de site (lettertype, tekstkleur, radius, schaduw) en herdefinieer niets. Koppen gewicht 600, geen uitroeptekens, geen superlatieven.
- Elke tekstkleur haalt minstens 4,5:1 op de echte pagina. De focus moet zichtbaar zijn. Er mag geen horizontale scrollbalk zijn op 320, 360, 390, 768 en 1440 px.
- Geen externe scripts, lettertypes of tracking erbij.

**Werkwijze per site**
- Hernoem niets. Sluit aan bij de structuur en gewoontes van die repo.
- Werk op een aparte branch. Zet niets op `main` zonder mijn akkoord, want Render rolt automatisch uit.
- Stuur me per site:
  - een schermafbeelding op desktop en op mobiel;
  - welke zin over het product je hebt gebruikt, en waar die vandaan komt.
