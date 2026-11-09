import { test } from "node:test";
import assert from "node:assert/strict";
import { kiesUitgelicht } from "../src/netwerk.js";

const profielen = [
  { id: "a", bio: null },
  { id: "b", bio: "Psycholoog in Utrecht" },
  { id: "c", bio: "  " },
  { id: "d", bio: "Fysiotherapeut" },
  { id: "e", bio: "Diëtist" },
];

test("kiesUitgelicht: profielen met introductie gaan voor, nooit meer dan gevraagd", () => {
  const drie = kiesUitgelicht(profielen, 3);
  assert.equal(drie.length, 3);
  assert.deepEqual(new Set(drie.map((p) => p.id)), new Set(["b", "d", "e"]));
});

test("kiesUitgelicht: vult aan met profielen zonder introductie als er te weinig zijn", () => {
  const vier = kiesUitgelicht(profielen, 4);
  assert.equal(vier.length, 4);
  assert.equal(vier.slice(0, 3).every((p) => p.bio?.trim()), true);
});

test("kiesUitgelicht: willekeurig, en laat de invoer ongemoeid", () => {
  const kopie = structuredClone(profielen);
  const eerste = kiesUitgelicht(profielen, 3, () => 0).map((p) => p.id);
  const laatste = kiesUitgelicht(profielen, 3, () => 0.999).map((p) => p.id);
  assert.notDeepEqual(eerste, laatste);
  assert.deepEqual(profielen, kopie);
});

test("kiesUitgelicht: lege lijst of aantal 0 geeft niets", () => {
  assert.deepEqual(kiesUitgelicht([], 3), []);
  assert.deepEqual(kiesUitgelicht(profielen, 0), []);
});
