import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getApiError } from "../../api/client";
import { authService } from "./authService";
import { readSession } from "./authStorage";
import type { AuthCredentials, AuthMode, AuthSession } from "./types";

interface AuthState {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  requestId: string | null;
}

export const authenticate = createAsyncThunk<
  { session: AuthSession | null; message: string | null },
  { mode: AuthMode; credentials: AuthCredentials },
  { state: { auth: AuthState }; rejectValue: string }
>("auth/authenticate", async ({ mode, credentials }, { rejectWithValue }) => {
  try { return await authService[mode](credentials); }
  catch (error) { return rejectWithValue(getApiError(error)); }
}, { condition: (_, { getState }) => !getState().auth.loading });

const initialState: AuthState = {
  session: readSession(), loading: false, error: null, message: null, requestId: null,
};

const authSlice = createSlice({
  name: "auth", initialState,
  reducers: {
    logout(state) {
      state.session = null;
      state.loading = false;
      state.error = null;
      state.message = null;
      state.requestId = null;
    },
    clearAuthFeedback(state) { state.error = null; state.message = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(authenticate.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.message = null;
        state.requestId = action.meta.requestId;
      })
      .addCase(authenticate.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.requestId = null;
        state.session = action.payload.session;
        state.message = action.payload.message;
      })
      .addCase(authenticate.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.requestId = null;
        state.error = action.payload || "Có lỗi xảy ra.";
      });
  },
});

export const { logout, clearAuthFeedback } = authSlice.actions;
export default authSlice.reducer;
