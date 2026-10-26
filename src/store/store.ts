import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "../features/chat/chatSlice";
import authReducer from "../features/auth/authSlice";
import { saveSession } from "../features/auth/authStorage";
import { setAccessToken } from "../api/client";

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    auth: authReducer,
  },
});

let previousSession = store.getState().auth.session;
setAccessToken(previousSession?.accessToken ?? null);
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
