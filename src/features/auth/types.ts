export interface User {
  name: string;
  email: string;
}
export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export type AuthMode = "login" | "register";
