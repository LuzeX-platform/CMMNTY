import nodemailer, { type Transporter } from "nodemailer";

// Zelfde aanpak als ACCRD: gewone SMTP via nodemailer. Mailgun én SendGrid bieden allebei
// SMTP aan, dus overstappen is alleen een kwestie van andere SMTP_*-waarden — geen code.
//   Mailgun:  SMTP_HOST=smtp.eu.mailgun.org  SMTP_USER=postmaster@mg.luzex.nl
//   SendGrid: SMTP_HOST=smtp.sendgrid.net    SMTP_USER=apikey
// Zonder SMTP_HOST (lokaal) wordt niets verstuurd maar de mail gelogd, zodat links uit
// bevestigings- en resetmails altijd te testen zijn.
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_WACHTWOORD }
        : undefined,
    });
  }
  return transporter;
}

function afzender(): string {
  return process.env.SMTP_AFZENDER ?? "LuzeX CMMNTY <cmmnty@mail.luzex.nl>";
}

interface Mail {
  naar: string;
  onderwerp: string;
  tekst: string;
  html?: string;
  headers?: Record<string, string>;
}

export async function verstuurMail({ naar, onderwerp, tekst, html, headers }: Mail): Promise<void> {
  const client = getTransporter();
  if (!client) {
    console.warn(`[mailer] Geen SMTP_HOST — mail aan ${naar} niet verstuurd, alleen gelogd.\nOnderwerp: ${onderwerp}\n${tekst}`);
    return;
  }
  await client.sendMail({ from: afzender(), to: naar, subject: onderwerp, text: tekst, html, headers });
}

export async function verstuurBevestigingsmail(naar: string, naam: string, link: string): Promise<void> {
  await verstuurMail({
    naar,
    onderwerp: "Bevestig je e-mailadres — LuzeX CMMNTY",
    tekst:
      `Hoi ${naam},\n\nWelkom bij LuzeX CMMNTY. Bevestig je e-mailadres via deze link:\n${link}\n\n` +
      "Heb je je niet aangemeld? Dan kun je deze e-mail negeren.",
  });
}

export async function verstuurWachtwoordResetMail(naar: string, link: string): Promise<void> {
  await verstuurMail({
    naar,
    onderwerp: "Wachtwoord opnieuw instellen — LuzeX CMMNTY",
    tekst:
      `Je hebt een nieuw wachtwoord aangevraagd voor LuzeX CMMNTY.\n\nStel het in via deze link (1 uur geldig):\n${link}\n\n` +
      "Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail negeren.",
  });
}
