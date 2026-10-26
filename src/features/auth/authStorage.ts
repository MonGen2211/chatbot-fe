import type { AuthSession } from "./types";

const SESSION_KEY = "ai-chat-session";

export function readSession(): AuthSession | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return typeof session?.accessToken === "string" &&
      typeof session?.user?.email === "string" && typeof session?.user?.name === "string"
      ? session : null;
  } catch { return null; }
}

export function saveSession(session: AuthSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* The session still works in Redux when browser storage is unavailable. */ }
}
