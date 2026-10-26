import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-geheim";
const { leesAfmeldToken, maakAfmeldToken, maakSessieToken, verifieerSessieToken, sessieDuurSeconden, hashToken, maakEenmaligToken } =
  await import("../src/auth.js");

test("afmeldtoken: werkt heen en terug, vervalst token wordt geweigerd", () => {
  const token = maakAfmeldToken("gebruiker-123");
  assert.equal(leesAfmeldToken(token), "gebruiker-123");
  assert.equal(leesAfmeldToken(token.replace("gebruiker-123", "gebruiker-456")), null);
  assert.equal(leesAfmeldToken("onzin"), null);
  assert.equal(leesAfmeldToken(`${token}x`), null);
});

test("sessietoken: payload blijft behouden", () => {
  const token = maakSessieToken({ gebruikerId: "g1", email: "a@b.nl", rol: "lid" });
  const payload = verifieerSessieToken(token);
  assert.equal(payload.gebruikerId, "g1");
  assert.equal(payload.rol, "lid");
});

test("sessietoken: de admin moet na 8 uur opnieuw inloggen, een lid niet", async () => {
  const jwt = (await import("jsonwebtoken")).default;
  const uurGeleden = (uren: number) => Math.floor(Date.now() / 1000) - uren * 3600;
  // Zo zag een token eruit vóór de kortere admin-sessie: 30 dagen geldig.
  const oud = (rol: "lid" | "admin", uren: number) =>
    jwt.sign({ gebruikerId: "g1", email: "a@b.nl", rol, iat: uurGeleden(uren) }, process.env.JWT_SECRET!, { expiresIn: 30 * 24 * 3600 });

  assert.equal(verifieerSessieToken(oud("admin", 7)).rol, "admin");
  assert.throws(() => verifieerSessieToken(oud("admin", 9)));
  assert.equal(verifieerSessieToken(oud("lid", 9)).rol, "lid");
  assert.equal(sessieDuurSeconden("admin"), 8 * 3600);
  assert.equal(sessieDuurSeconden("lid"), 30 * 24 * 3600);
});

test("eenmalig token: alleen de hash wordt bewaard", () => {
  const { ruweToken, tokenHash } = maakEenmaligToken();
  assert.notEqual(ruweToken, tokenHash);
  assert.equal(hashToken(ruweToken), tokenHash);
});
