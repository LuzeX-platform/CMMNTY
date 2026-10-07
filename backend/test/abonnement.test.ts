import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-geheim";
process.env.APP_URL ??= "http://community.test";
// Nep-sleutels: genoeg om stripeClient() een client te laten aanmaken en om
// webhooks.constructEvent lokaal (zonder netwerk) een handtekening te laten afwijzen — er wordt
// in deze tests niets echt naar Stripe gestuurd.
process.env.STRIPE_GEHEIME_SLEUTEL ??= "sk_test_neptest";
process.env.STRIPE_WEBHOOK_GEHEIM ??= "whsec_neptest";

const { bouwApp } = await import("../src/app.js");
const app = await bouwApp({ logger: false });

test("pro-checkout: zonder sessie 401, niet zonder in te loggen", async () => {
  const res = await app.inject({ method: "POST", url: "/api/account/pro-checkout" });
  assert.equal(res.statusCode, 401);
});

test("pro-portaal: zonder sessie 401", async () => {
  const res = await app.inject({ method: "POST", url: "/api/account/pro-portaal" });
  assert.equal(res.statusCode, 401);
});

test("stripe-webhook: zonder handtekening-header 400", async () => {
  const res = await app.inject({ method: "POST", url: "/api/stripe/webhook", payload: { type: "test" } });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).errorCode, "ONGELDIGE_HANDTEKENING");
});

test("stripe-webhook: ongeldige handtekening wordt geweigerd (geen vertrouwen zonder verificatie)", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/stripe/webhook",
    headers: { "stripe-signature": "t=1,v1=onzin" },
    payload: { type: "checkout.session.completed" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).errorCode, "ONGELDIGE_HANDTEKENING");
});

test.after(async () => {
  await app.close();
});
