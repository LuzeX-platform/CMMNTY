import { test } from "node:test";
import assert from "node:assert/strict";
import { schoonKvkNummer } from "../src/luzexKruisproduct.js";

test("schoonKvkNummer: zo getypt als op het uittreksel, terug naar wat ACCRD bewaart", () => {
  assert.equal(schoonKvkNummer("12345678"), "12345678");
  assert.equal(schoonKvkNummer(" 1234 5678 "), "12345678");
  assert.equal(schoonKvkNummer("12.34.56.78"), "12345678");
  assert.equal(schoonKvkNummer("1234-5678"), "12345678");
  // Een buitenlands Tax-ID houdt zijn letters en streepjes.
  assert.equal(schoonKvkNummer("AB-12 345"), "AB-12345");
});
