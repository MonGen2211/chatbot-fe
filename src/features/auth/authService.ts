import { apiClient } from "../../api/client";
import type { AuthCredentials, AuthSession } from "./types";

interface AuthResponse {
  message?: string;
  data: {
    user?: { email?: string } | null;
    session: { access_token: string } | null;
  };
}

function toSession(response: AuthResponse, email: string): AuthSession | null {
  const token = response.data.session?.access_token;
  if (!token) return null;
  const userEmail = response.data.user?.email || email;
  return { accessToken: token, user: { email: userEmail, name: userEmail.split("@")[0] || "User" } };
}

export const authService = {
  async login(credentials: AuthCredentials) {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", credentials);
    const session = toSession(data, credentials.email);
    if (!session) throw new Error("Không nhận được token đăng nhập.");
    return { session, message: null };
  },
  async register(credentials: AuthCredentials) {
    const { data } = await apiClient.post<AuthResponse>("/auth/register", credentials);
    const session = toSession(data, credentials.email);
    return {
      session,
      message: session ? null : (data.message || "Vui lòng kiểm tra email xác nhận rồi đăng nhập."),
    };
  },
};
