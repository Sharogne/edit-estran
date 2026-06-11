import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SessionData = {
  adminId?: string;
};

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters (see .env.example)");
  }
  return {
    password,
    cookieName: "edit_session",
    ttl: 60 * 60 * 24 * 7, // 7 days
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      // Secure in production — except when explicitly overridden (.env.test runs
      // the production build over plain http://localhost for Cypress).
      secure:
        process.env.SESSION_COOKIE_SECURE !== undefined
          ? process.env.SESSION_COOKIE_SECURE === "true"
          : process.env.NODE_ENV === "production",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

/**
 * Gate for every admin page AND every admin server action (defense in depth —
 * the protected layout alone does not protect actions). Redirects anonymous
 * users to the login page; returns the admin id otherwise.
 */
export async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session.adminId) {
    redirect("/admin/login");
  }
  return session.adminId;
}
