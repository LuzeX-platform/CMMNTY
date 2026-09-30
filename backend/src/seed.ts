import "dotenv/config";
import { prisma } from "./db.js";
import { hashWachtwoord } from "./auth.js";

// Maakt het admin-account (Job) aan. Bewust niet via registratie: wie zich aanmeldt wordt
// altijd "lid". Idempotent — draait bij elke opstart (zie Dockerfile).
async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@luzex.local").toLowerCase();
  const wachtwoord = process.env.SEED_ADMIN_WACHTWOORD ?? "wijzig-dit-meteen";
  const naam = process.env.SEED_ADMIN_NAAM ?? "Job";

  const bestaat = await prisma.gebruiker.findUnique({ where: { email } });
  if (bestaat) {
    console.log(`Admin-account bestaat al: ${email}`);
  } else {
    await prisma.gebruiker.create({
      data: {
        email,
        naam,
        wachtwoordHash: await hashWachtwoord(wachtwoord),
        rol: "admin",
        abonnement: "pro",
        emailBevestigdOp: new Date(),
      },
    });
    console.log(`Admin-account aangemaakt: ${email}`);
    if (!process.env.SEED_ADMIN_WACHTWOORD) {
      console.log(`Standaardwachtwoord "${wachtwoord}" — alleen voor lokale ontwikkeling.`);
    }
  }

  await prisma.instellingen.upsert({ where: { id: "standaard" }, update: {}, create: { id: "standaard" } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
