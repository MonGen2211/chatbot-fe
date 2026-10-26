import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const apiClient = axios.create({
  baseURL: `${API_URL.replace(/\/$/, "")}/api`,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

export function setAccessToken(token: string | null) {
  if (token) apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete apiClient.defaults.headers.common.Authorization;
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "Không kết nối được máy chủ. Vui lòng thử lại.";
  }
  return error instanceof Error ? error.message : "Có lỗi xảy ra.";
}
