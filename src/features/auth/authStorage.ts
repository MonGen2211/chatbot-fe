import type { AuthSession } from "./types";

// A new key prevents reusing sessions from the previous Supabase integration.
const SESSION_KEY = "ai-chat-backend-session-v1";

export function readSession(): AuthSession | null {
  try {
    sessionStorage.removeItem("ai-chat-session");
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    const valid = typeof session?.accessToken === "string" &&
      typeof session?.user?.id === "string" &&
      typeof session?.expiresAt === "number" && session.expiresAt * 1000 > Date.now() &&
      typeof session?.user?.email === "string" && typeof session?.user?.name === "string";
    if (!valid) sessionStorage.removeItem(SESSION_KEY);
    return valid ? session : null;
  } catch { return null; }
}

export function saveSession(session: AuthSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* The session still works in Redux when browser storage is unavailable. */ }
}
