import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

// Zelfde opzet als ACCRD: Argon2id voor wachtwoorden, een ondertekend JWT in een httpOnly-
// cookie als sessie. Geen 2FA: CMMNTY bevat geen gevoelige (financiële) gegevens, en
// een drempel bij het lezen van artikelen kost meer lezers dan hij aan veiligheid oplevert.
const SESSION_TTL_SECONDEN = 30 * 24 * 60 * 60; // 30 dagen: lezers willen niet elke week inloggen
// De admin kan alles publiceren, wijzigen en verwijderen. Die sessie loopt na een werkdag af, zodat
// je niet weken later op een laptop die openstaat nog zomaar in het adminpanel komt.
const ADMIN_SESSIE_TTL_SECONDEN = 8 * 60 * 60;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET ontbreekt");
  return secret;
}

export interface SessionPayload {
  gebruikerId: string;
  email: string;
  rol: "lid" | "admin";
}

export function sessieDuurSeconden(rol: SessionPayload["rol"]): number {
  return rol === "admin" ? ADMIN_SESSIE_TTL_SECONDEN : SESSION_TTL_SECONDEN;
}

export async function hashWachtwoord(wachtwoord: string): Promise<string> {
  return argon2.hash(wachtwoord, { type: argon2.argon2id });
}

export async function verifieerWachtwoord(hash: string, wachtwoord: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, wachtwoord);
  } catch {
    return false;
  }
}

export function maakSessieToken(payload: SessionPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: sessieDuurSeconden(payload.rol) });
}

export function verifieerSessieToken(token: string): SessionPayload {
  const payload = jwt.verify(token, jwtSecret()) as SessionPayload & { iat?: number };
  // Ook een admin-token van vóór de kortere sessie (toen 30 dagen geldig) vervalt na 8 uur.
  if (payload.rol === "admin" && !(payload.iat && Date.now() / 1000 - payload.iat <= ADMIN_SESSIE_TTL_SECONDEN)) {
    throw new Error("Admin-sessie verlopen");
  }
  return payload;
}

// Eenmalige tokens (e-mailbevestiging, wachtwoordreset): alleen de hash gaat de database in,
// het ruwe token staat alleen in de link. Een gelekte database levert zo geen bruikbare links op.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function maakEenmaligToken(): { ruweToken: string; tokenHash: string } {
  const ruweToken = crypto.randomBytes(32).toString("hex");
  return { ruweToken, tokenHash: hashToken(ruweToken) };
}

// Afmeldlink in de nieuwsbrief: moet zonder inloggen werken en mag niet verlopen (een oude
// nieuwsbrief moet nog steeds af te melden zijn). Een HMAC over het gebruikers-id volstaat:
// niet te raden, en er hoeft niets voor opgeslagen te worden.
export function maakAfmeldToken(gebruikerId: string): string {
  const handtekening = crypto
    .createHmac("sha256", jwtSecret())
    .update(`afmelden:${gebruikerId}`)
    .digest("base64url");
  return `${gebruikerId}.${handtekening}`;
}

export function leesAfmeldToken(token: string): string | null {
  const punt = token.lastIndexOf(".");
  if (punt <= 0) return null;
  const gebruikerId = token.slice(0, punt);
  const verwacht = Buffer.from(maakAfmeldToken(gebruikerId));
  const gegeven = Buffer.from(token);
  if (verwacht.length !== gegeven.length) return null;
  return crypto.timingSafeEqual(verwacht, gegeven) ? gebruikerId : null;
}
