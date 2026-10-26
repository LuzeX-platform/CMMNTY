import type { FastifyReply, FastifyRequest } from "fastify";
import { maakSessieToken, sessieDuurSeconden, verifieerSessieToken, type SessionPayload } from "../auth.js";

declare module "fastify" {
  interface FastifyRequest {
    gebruiker?: SessionPayload;
  }
}

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "luzex_community_sessie";

/** Logt in: token en cookie krijgen dezelfde duur (de admin korter dan een lid, zie auth.ts). */
export function zetSessieCookie(reply: FastifyReply, payload: SessionPayload) {
  reply.setCookie(COOKIE_NAME, maakSessieToken(payload), {
    httpOnly: true,
    // "lax" en niet "strict" zoals in ACCRD: wie vanuit de nieuwsbrief op een Pro-artikel
    // klikt, komt binnen via een link uit een andere site (de mail-client). Met "strict" gaat
    // de cookie dan niet mee en ziet een ingelogd Pro-lid alsnog "log in om te lezen".
    // Schrijvende requests blijven beschermd door de Origin-check in app.ts.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessieDuurSeconden(payload.rol),
  });
}

export function wisSessieCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Leest de sessie als die er is; geen fout als er geen is. Voor publieke routes die ingelogd anders doen. */
export function leesSessie(request: FastifyRequest): SessionPayload | null {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return verifieerSessieToken(token);
  } catch {
    return null;
  }
}

function requireRol(...rollen: SessionPayload["rol"][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessie = leesSessie(request);
    if (!sessie) return reply.code(401).send({ errorCode: "NIET_INGELOGD" });
    if (!rollen.includes(sessie.rol)) return reply.code(403).send({ errorCode: "GEEN_TOEGANG" });
    request.gebruiker = sessie;
  };
}

export const requireLid = requireRol("lid", "admin");
export const requireAdmin = requireRol("admin");
