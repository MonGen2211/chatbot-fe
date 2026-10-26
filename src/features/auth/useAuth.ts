import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { authenticate, clearAuthFeedback, logout } from "./authSlice";
import type { AuthCredentials, AuthMode } from "./types";

export function useAuth() {
  const dispatch = useAppDispatch();
  const { session, loading, error, message } = useAppSelector((state) => state.auth);

  return {
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    loading, error, message,
    submit: (mode: AuthMode, credentials: AuthCredentials) =>
      dispatch(authenticate({ mode, credentials })).unwrap(),
    logout: () => dispatch(logout()),
    clearFeedback: () => dispatch(clearAuthFeedback()),
  };
}
