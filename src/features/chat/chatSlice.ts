import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getApiError } from "../../api/client";
import { authenticate, logout } from "../auth/authSlice";
import type { AuthSession } from "../auth/types";
import type { Conversation } from "./Conservation";
import type { Message } from "./Message";
import { chatService, streamMessage, toMessage, type ChatEvent } from "./chatService";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  draft: Message[];
  list: { loading: boolean; offset: number; hasMore: boolean; error: string | null; requestId: string | null };
  history: Record<string, { loading: boolean; loaded: boolean; error: string | null; requestId: string | null }>;
  stream: { requestId: string; conversationId: string | null; confirmed: boolean } | null;
  sendError: string | null;
}
const initialState: ChatState = {
  conversations: [], activeId: null, draft: [], history: {}, stream: null, sendError: null,
  list: { loading: false, offset: 0, hasMore: false, error: null, requestId: null },
};
type ThunkConfig = { state: { chat: ChatState; auth: { session: AuthSession | null } }; rejectValue: string };

export const loadConversations = createAsyncThunk<Awaited<ReturnType<typeof chatService.conversations>>, number, ThunkConfig>(
  "chat/loadConversations", async (offset, { signal, rejectWithValue }) => {
    try { return await chatService.conversations(offset, signal); }
    catch (error) { return rejectWithValue(getApiError(error)); }
  }, { condition: (offset, { getState }) => Boolean(getState().auth.session) && (offset === 0 || !getState().chat.list.loading) },
);

// History is returned oldest first: read all pages before enabling the composer.
export const loadMessages = createAsyncThunk<{ id: string; messages: Message[] }, string, ThunkConfig>(
  "chat/loadMessages", async (id, { signal, rejectWithValue }) => {
    try {
      const messages: Message[] = [];
      for (let offset = 0; ; ) {
        const page = await chatService.messages(id, offset, signal);
        messages.push(...page.messages);
        if (!page.pagination.has_more) return { id, messages };
        offset = page.pagination.offset + page.pagination.limit;
      }
    } catch (error) { return rejectWithValue(getApiError(error)); }
  }, {
    condition: (id, { getState }) => {
      const { chat, auth } = getState();
      return Boolean(auth.session) && !chat.stream && !chat.history[id]?.loaded;
    },
  },
);

export const sendChatMessage = createAsyncThunk<void, string, ThunkConfig>(
  "chat/sendMessage", async (message, { getState, dispatch, signal, requestId, rejectWithValue }) => {
    const { auth, chat } = getState();
    if (!auth.session) return rejectWithValue("Vui lòng đăng nhập để trò chuyện.");
    try {
      await streamMessage(auth.session.accessToken, message, chat.activeId,
        (event) => dispatch(receiveStreamEvent({ requestId, event })), signal);
    } catch (error) { return rejectWithValue(getApiError(error)); }
  }, {
    condition: (message, { getState }) => {
      const { chat, auth } = getState();
      return Boolean(auth.session) && !chat.stream && Boolean(message.trim()) && message.length <= 12000 &&
        (!chat.activeId || Boolean(chat.history[chat.activeId]?.loaded));
    },
  },
);

function streamMessages(state: ChatState) {
  return state.stream?.conversationId
    ? state.conversations.find((item) => item.id === state.stream?.conversationId)?.messages
    : state.draft;
}
function sortConversations(state: ChatState) {
  state.conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const chatSlice = createSlice({
  name: "chat", initialState,
  reducers: {
    clearActiveConversation(state) {
      if (state.stream) return;
      state.activeId = null; state.draft = []; state.sendError = null;
    },
    selectConversation(state, action: PayloadAction<string>) {
      if (state.stream) return;
      state.activeId = action.payload; state.sendError = null; state.draft = [];
    },
    receiveStreamEvent(state, { payload }: PayloadAction<{ requestId: string; event: ChatEvent }>) {
      if (state.stream?.requestId !== payload.requestId) return;
      const { event } = payload;
      const now = new Date().toISOString();
      if (event.event === "conversation") {
        const id = event.data.conversation_id;
        if (!state.stream.conversationId) {
          state.conversations.unshift({
            id, title: state.draft[0]?.content.slice(0, 60) || "New Chat", messages: state.draft,
            createdAt: now, updatedAt: now,
          });
          state.draft = [];
          state.history[id] = { loaded: true, loading: false, error: null, requestId: null };
        }
        state.stream.conversationId = id;
        state.stream.confirmed = true;
        state.activeId = id;
        const messages = streamMessages(state);
        const user = messages?.find((item) => item.id === `${payload.requestId}-user`);
        if (user) { user.id = event.data.user_message_id; user.status = "completed"; }
        const conversation = state.conversations.find((item) => item.id === id);
        if (conversation) conversation.updatedAt = now;
        sortConversations(state);
      } else {
        const messages = streamMessages(state);
        const assistant = messages?.find((item) => item.id === `${payload.requestId}-assistant`);
        if (!assistant) return;
        if (event.event === "delta") assistant.content += event.data.text;
        else {
          Object.assign(assistant, toMessage(event.data.message));
          const conversation = state.conversations.find((item) => item.id === state.stream?.conversationId);
          if (conversation) conversation.updatedAt = event.data.message.created_at;
          state.stream = null;
          sortConversations(state);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(authenticate.fulfilled, () => initialState)
      .addCase(loadConversations.pending, (state, action) => {
        state.list.loading = true; state.list.error = null; state.list.requestId = action.meta.requestId;
      })
      .addCase(loadConversations.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        const { conversations, pagination } = action.payload;
        for (const row of conversations) {
          const existing = state.conversations.find((item) => item.id === row.id);
          if (existing) Object.assign(existing, { ...row, updatedAt: row.updatedAt > existing.updatedAt ? row.updatedAt : existing.updatedAt, messages: existing.messages });
          else state.conversations.push(row);
        }
        sortConversations(state);
        state.list = { loading: false, error: null, requestId: null, offset: pagination.offset + pagination.limit, hasMore: pagination.has_more };
      })
      .addCase(loadConversations.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        state.list.loading = false; state.list.requestId = null;
        state.list.error = action.meta.aborted ? null : action.payload || "Không tải được danh sách chat.";
      })
      .addCase(loadMessages.pending, (state, action) => {
        state.history[action.meta.arg] = { loaded: false, loading: true, error: null, requestId: action.meta.requestId };
      })
      .addCase(loadMessages.fulfilled, (state, action) => {
        const history = state.history[action.payload.id];
        if (history?.requestId !== action.meta.requestId) return;
        const conversation = state.conversations.find((item) => item.id === action.payload.id);
        if (conversation) conversation.messages = action.payload.messages;
        Object.assign(history, { loaded: true, loading: false, error: null, requestId: null });
      })
      .addCase(loadMessages.rejected, (state, action) => {
        const history = state.history[action.meta.arg];
        if (history?.requestId !== action.meta.requestId) return;
        Object.assign(history, { loading: false, requestId: null, error: action.meta.aborted ? null : action.payload || "Không tải được tin nhắn." });
      })
      .addCase(sendChatMessage.pending, (state, action) => {
        state.sendError = null;
        state.stream = { requestId: action.meta.requestId, conversationId: state.activeId, confirmed: false };
        const now = new Date().toISOString();
        const messages: Message[] = [
          { id: `${action.meta.requestId}-user`, role: "user", content: action.meta.arg, createdAt: now, status: "completed" },
          { id: `${action.meta.requestId}-assistant`, role: "assistant", content: "", createdAt: now, status: "streaming" },
        ];
        if (state.activeId) streamMessages(state)?.push(...messages);
        else state.draft = messages;
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        if (state.stream?.requestId !== action.meta.requestId) return;
        const messages = streamMessages(state);
        const assistant = messages?.find((item) => item.id === `${action.meta.requestId}-assistant`);
        if (assistant) assistant.status = "interrupted";
        if (!state.stream.confirmed) {
          const user = messages?.find((item) => item.id === `${action.meta.requestId}-user`);
          if (user) user.status = "failed";
        }
        state.sendError = action.meta.aborted ? "Đã dừng. Câu trả lời chưa hoàn tất." : action.payload || "Câu trả lời bị gián đoạn.";
        state.stream = null;
      });
  },
});

export const { clearActiveConversation, selectConversation, receiveStreamEvent } = chatSlice.actions;
export default chatSlice.reducer;
