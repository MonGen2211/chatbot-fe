import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "../features/chat/chatSlice";
import authReducer from "../features/auth/authSlice";
import { saveSession } from "../features/auth/authStorage";
import { setAccessToken, setUnauthorizedHandler } from "../api/client";
import { logout } from "../features/auth/authSlice";
import { toast } from "../components/toast";

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    auth: authReducer,
  },
});

let previousSession = store.getState().auth.session;
setAccessToken(previousSession?.accessToken ?? null);
setUnauthorizedHandler(() => {
  if (!store.getState().auth.session) return;
  store.dispatch(logout());
  toast.warning("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.", 5000);
});
store.subscribe(() => {
  const session = store.getState().auth.session;
  if (session !== previousSession) {
    previousSession = session;
    setAccessToken(session?.accessToken ?? null);
    saveSession(session);
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
