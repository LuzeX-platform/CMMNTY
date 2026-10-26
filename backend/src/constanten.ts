// Keuzelijsten voor het netwerk (de praktijkprofielen van leden, voorheen "directory"). Hier op één plek, zodat backend-validatie en de
// dropdowns in de frontend (via GET /api/keuzelijsten) nooit uit elkaar lopen.
export const SPECIALISMEN = [
  "GGZ (algemeen)",
  "Psychologie",
  "Neuropsychologie",
  "Psychotherapie",
  "Seksuologie",
  "Relatietherapie",
  "Kinder- en jeugdpsychologie",
  "Verslavingszorg",
  "Traumabehandeling",
  "Coaching",
  "Psychiatrie",
  "Overig",
] as const;

export const REGIOS = ["Noord", "Oost", "Zuid", "West", "Midden", "Randstad", "Landelijk / online"] as const;

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
