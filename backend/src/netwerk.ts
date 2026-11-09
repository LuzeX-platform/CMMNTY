// Pure logica rond het netwerk (de praktijkprofielen van leden), los van de database.

/**
 * Kiest een paar profielen om uit te lichten op de homepage. Willekeurig, zodat elk lid een kans
 * krijgt (het netwerk is gratis reclame voor hun praktijk), maar profielen met een korte
 * introductie gaan voor: een kaartje met alleen een naam zegt een bezoeker weinig.
 */
export function kiesUitgelicht<T extends { bio: string | null }>(
  profielen: readonly T[],
  aantal: number,
  willekeurig: () => number = Math.random,
): T[] {
  const schud = (lijst: T[]) => {
    for (let i = lijst.length - 1; i > 0; i--) {
      const j = Math.floor(willekeurig() * (i + 1));
      [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
    }
    return lijst;
  };
  const metBio = schud(profielen.filter((p) => p.bio?.trim()));
  const zonderBio = schud(profielen.filter((p) => !p.bio?.trim()));
  return [...metBio, ...zonderBio].slice(0, Math.max(0, aantal));
}
