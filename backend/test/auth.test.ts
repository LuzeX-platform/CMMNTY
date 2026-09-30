import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-geheim";
const { leesAfmeldToken, maakAfmeldToken, maakSessieToken, verifieerSessieToken, hashToken, maakEenmaligToken } =
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

test("eenmalig token: alleen de hash wordt bewaard", () => {
  const { ruweToken, tokenHash } = maakEenmaligToken();
  assert.notEqual(ruweToken, tokenHash);
  assert.equal(hashToken(ruweToken), tokenHash);
});
