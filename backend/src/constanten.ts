// Keuzelijsten voor het netwerk (de praktijkprofielen van leden, voorheen "directory"). Hier op één plek, zodat backend-validatie en de
// dropdowns in de frontend (via GET /api/keuzelijsten) nooit uit elkaar lopen.
export const SPECIALISMEN = [
  "Psychologie",
  "Psychotherapie",
  "Psychiatrie",
  "GGZ (algemeen)",
  "Kinder- en jeugdpsychologie",
  "Verslavingszorg",
  "Traumabehandeling",
  "Neuropsychologie",
  "Coaching",
  "Overig",
] as const;

export type Specialisme = (typeof SPECIALISMEN)[number];

/**
 * Dezelfde specialismen, in groepen voor de keuzelijsten (keuze B1 van Job, november 2026).
 * "Seksuologie" en "Relatietherapie" zijn op verzoek van Job uit de lijst gehaald. Een lid dat
 * die eerder koos, houdt zijn profiel; die keuze wordt alleen niet meer getoond (zie
 * alleenBekendeSpecialismen in routes/profiel.ts). De database is niet aangepast.
 */
export const SPECIALISME_GROEPEN: readonly { naam: string; specialismen: readonly Specialisme[] }[] = [
  { naam: "Algemeen", specialismen: ["Psychologie", "Psychotherapie", "Psychiatrie", "GGZ (algemeen)"] },
  {
    naam: "Doelgroep en thema",
    specialismen: ["Kinder- en jeugdpsychologie", "Verslavingszorg", "Traumabehandeling", "Neuropsychologie"],
  },
  { naam: "Anders", specialismen: ["Coaching", "Overig"] },
];

// Provincies (sinds november 2026; eerder zeven grove regio's zoals "Noord", te grof voor een
// verwijzer: Groningen en Enschede vielen allebei onder "Noord/Oost"). De plaats van de praktijk
// staat in een eigen veld en is zoekbaar.
export const REGIOS = [
  "Groningen",
  "Friesland",
  "Drenthe",
  "Overijssel",
  "Flevoland",
  "Gelderland",
  "Utrecht",
  "Noord-Holland",
  "Zuid-Holland",
  "Zeeland",
  "Noord-Brabant",
  "Limburg",
  "Landelijk / online",
] as const;

export const CATEGORIEEN = [
  "AI & automatisering",
  "Administratie",
  "Privacy & AVG",
  "Tools & software",
  "Praktijkvoering",
  "Regelgeving",
  "AI in de praktijk",
  "Regels en wetgeving",
  "Behandelen",
  // Nieuws van buiten de zorg dat zo veel impact heeft dat het er toch in hoort.
  "Tech & trends",
] as const;
