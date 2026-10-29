import { apiClient } from "../../api/client";
import type { AuthCredentials, AuthSession } from "./types";

interface AuthResponse {
  data: {
    user: { id: string; email: string };
    session: { access_token: string; token_type: string; expires_in: number; expires_at: number };
  };
}

async function authenticate(mode: "login" | "register", credentials: AuthCredentials) {
  const { data: response } = await apiClient.post<AuthResponse>(`/auth/${mode}`, credentials);
  const { user, session } = response.data;
  if (!session?.access_token || !user?.id || !session.expires_at) {
    throw new Error("Không nhận được phiên đăng nhập hợp lệ.");
  }
  const result: AuthSession = {
    accessToken: session.access_token, tokenType: session.token_type,
    expiresIn: session.expires_in, expiresAt: session.expires_at,
    user: { id: user.id, email: user.email, name: user.email.split("@")[0] || "User" },
  };
  return { session: result, message: null };
}

export const authService = {
  login: (credentials: AuthCredentials) => authenticate("login", credentials),
  register: (credentials: AuthCredentials) => authenticate("register", credentials),
};
