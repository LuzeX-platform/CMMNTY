import Stripe from "stripe";

// Zelfde aanpak als RSLNT's stripe.ts (de functioneel dichtstbijzijnde bestaande
// Stripe-koppeling): zonder STRIPE_GEHEIME_SLEUTEL (lokaal) is er geen client, en werkt
// /api/account/pro-checkout dan niet — dat is prima, want zonder sleutel kan er toch niets
// echt afgerekend worden. In productie moet de sleutel er wél zijn.
let client: Stripe | null = null;

export function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_GEHEIME_SLEUTEL) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_GEHEIME_SLEUTEL);
  }
  return client;
}

/** De Price van het CMMNTY Pro-abonnement (€5/maand), aangemaakt in het Stripe-dashboard. */
export function proPrijsId(): string {
  const id = process.env.STRIPE_PRIJS_ID;
  if (!id) throw new Error("STRIPE_PRIJS_ID ontbreekt.");
  return id;
}
