import { API_URL, apiClient, handleUnauthorized } from "../../api/client";
import type { Conversation } from "./Conservation";
import type { Message } from "./Message";

export const PAGE_SIZE = 50;
const STREAM_DELAY_MS = 200;

function waitForDelta(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, STREAM_DELAY_MS);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
export interface Pagination { limit: number; offset: number; has_more: boolean }
interface ApiConversation {
  id: string; title: string; created_at: string; updated_at: string;
}
interface ApiMessage {
  id: string; role: Message["role"]; content: string; created_at: string;
  status?: "pending" | "completed" | "failed";
  is_edited?: boolean;
}
export const toMessage = (row: ApiMessage): Message => ({
  id: row.id, role: row.role, content: row.content, createdAt: row.created_at,
  status: row.status ?? "completed", isEdited: row.is_edited ?? false, persisted: true,
});
export const chatService = {
  async rename(id: string, title: string, signal: AbortSignal) {
    const { data: { data } } = await apiClient.patch<{ data: { conversation: ApiConversation } }>(
      `/conversations/${encodeURIComponent(id)}`, { title }, { signal },
    );
    return data.conversation;
  },
  async remove(id: string, signal: AbortSignal) {
    const { data: { data } } = await apiClient.delete<{ data: { conversation_id: string; deleted_message_ids: string[] } }>(
      `/conversations/${encodeURIComponent(id)}`, { signal },
    );
    return data;
  },
  async conversations(offset: number, signal: AbortSignal) {
    const { data: { data } } = await apiClient.get<{ data: { conversations: ApiConversation[]; pagination: Pagination } }>(
      "/conversations", { params: { limit: PAGE_SIZE, offset }, signal },
    );
    const conversations: Conversation[] = data.conversations.map((row) => ({
      id: row.id, title: row.title || "New Chat", createdAt: row.created_at, updatedAt: row.updated_at, messages: [],
    }));
    return { conversations, pagination: data.pagination };
  },
  async messages(id: string, offset: number, signal: AbortSignal) {
    const { data: { data } } = await apiClient.get<{ data: { messages: ApiMessage[]; pagination: Pagination } }>(
      "/messages", { params: { conversation_id: id, limit: PAGE_SIZE, offset }, signal },
    );
    return { messages: data.messages.map(toMessage), pagination: data.pagination };
  },
};

interface OperationData {
  user_message?: ApiMessage;
  assistant_message?: ApiMessage;
  deleted_message_ids?: string[];
}
export type ChatEvent =
  | { event: "conversation"; data: OperationData & { conversation_id: string; created?: boolean; user_message_id?: string } }
  | { event: "delta"; data: { text: string } }
  | { event: "reset"; data: { assistant_message_id: string; attempt?: number } }
  | { event: "superseded"; data: { assistant_message_id: string } }
  | { event: "done"; data: OperationData & { conversation_id: string; message: ApiMessage } };

export async function streamMessage(token: string, message: string, conversationId: string | null, onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
  return streamOperation(token, "/chat", "POST", { message_id: crypto.randomUUID(), message, ...(conversationId && { conversation_id: conversationId }) }, onEvent, signal);
}

export function retryMessage(token: string, id: string, onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
  return streamOperation(token, `/chat/messages/${encodeURIComponent(id)}/retry`, "POST", undefined, onEvent, signal);
}

export function editMessage(token: string, id: string, message: string, onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
  return streamOperation(token, `/chat/messages/${encodeURIComponent(id)}`, "PATCH", { message }, onEvent, signal);
}

async function streamOperation(token: string, path: string, method: string, body: object | undefined, onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
  const response = await fetch(`${API_URL.replace(/\/$/, "")}/api${path}`, {
    method, signal,
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${token}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Không gửi được tin nhắn (${response.status}).`);
  }
  if (!response.body) throw new Error("Không nhận được stream từ máy chủ.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  try {
    while (!completed) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const lines = frame.split(/\r?\n/);
        const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const raw = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!event || !raw) continue;
        const data = JSON.parse(raw);
        if (event === "error") throw new Error(data.message || "Câu trả lời bị gián đoạn.");
        if (event === "conversation" || event === "delta" || event === "done" || event === "reset" || event === "superseded") {
          if (event === "delta") await waitForDelta(signal);
          signal.throwIfAborted();
          onEvent({ event, data } as ChatEvent);
          if (event === "done" || event === "superseded") { completed = true; break; }
        }
      }
      if (done) break;
    }
    if (!completed) throw new Error("Kết nối ngắt trước khi câu trả lời hoàn tất.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
