export interface User {
  id: string;
  name: string;
  email: string;
}
export interface AuthSession {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
  user: User;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export type AuthMode = "login" | "register";
