import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getApiError } from "../../api/client";
import { authenticate, logout } from "../auth/authSlice";
import type { AuthSession } from "../auth/types";
import type { Conversation } from "./Conservation";
import type { Message } from "./Message";
import { chatService, streamMessage, retryMessage, editMessage, toMessage, type ChatEvent } from "./chatService";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  draft: Message[];
  list: { loading: boolean; offset: number; hasMore: boolean; error: string | null; requestId: string | null };
  history: Record<string, { loading: boolean; loaded: boolean; error: string | null; requestId: string | null }>;
  stream: { requestId: string; conversationId: string | null; confirmed: boolean; assistantId: string; kind: "send" | "retry" | "edit" } | null;
  mutations: Record<string, string>;
  deletedConversations: Record<string, boolean>;
  sendError: string | null;
}
const initialState: ChatState = {
  conversations: [], activeId: null, draft: [], history: {}, stream: null, sendError: null, mutations: {}, deletedConversations: {},
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
        (!chat.activeId || (Boolean(chat.history[chat.activeId]?.loaded) && !chat.mutations[chat.activeId] &&
          !chat.conversations.find((item) => item.id === chat.activeId)?.messages.some((item) => item.role === "assistant" && ["pending", "failed", "interrupted"].includes(item.status || ""))));
    },
  },
);

export const renameConversation = createAsyncThunk<Awaited<ReturnType<typeof chatService.rename>>, { id: string; title: string }, ThunkConfig>(
  "chat/rename", async ({ id, title }, { signal, rejectWithValue }) => {
    try { return await chatService.rename(id, title.trim(), signal); }
    catch (error) { return rejectWithValue(getApiError(error)); }
  }, { condition: ({ id, title }, { getState }) => Boolean(getState().auth.session) && !getState().chat.mutations[id] && Boolean(title.trim()) && title.trim().length <= 200 },
);
export const deleteConversation = createAsyncThunk<Awaited<ReturnType<typeof chatService.remove>>, string, ThunkConfig>(
  "chat/delete", async (id, { signal, rejectWithValue }) => {
    try { return await chatService.remove(id, signal); }
    catch (error) { return rejectWithValue(getApiError(error)); }
  }, { condition: (id, { getState }) => Boolean(getState().auth.session) && !getState().chat.mutations[id] },
);
export const changeChatMessage = createAsyncThunk<void, { kind: "retry" | "edit"; id: string; message?: string }, ThunkConfig>(
  "chat/changeMessage", async (input, { getState, dispatch, signal, requestId, rejectWithValue }) => {
    const token = getState().auth.session?.accessToken;
    if (!token) return rejectWithValue("Vui lòng đăng nhập lại.");
    const onEvent = (event: ChatEvent) => dispatch(receiveStreamEvent({ requestId, event }));
    try {
      if (input.kind === "retry") await retryMessage(token, input.id, onEvent, signal);
      else await editMessage(token, input.id, input.message!.trim(), onEvent, signal);
    } catch (error) { return rejectWithValue(getApiError(error)); }
  }, { condition: (input, { getState }) => {
    const { chat, auth } = getState();
    const conversation = chat.conversations.find((item) => item.id === chat.activeId);
    const message = conversation?.messages.find((item) => item.id === input.id);
    return Boolean(auth.session) && !chat.stream && !chat.mutations[chat.activeId || ""] && Boolean(message?.persisted) &&
      (input.kind === "retry" ? message?.role === "assistant" && message.status === "failed" :
        message?.role === "user" && Boolean(input.message?.trim()) && input.message!.trim().length <= 12000);
  } },
);

function streamMessages(state: ChatState) {
  return state.stream?.conversationId
    ? state.conversations.find((item) => item.id === state.stream?.conversationId)?.messages
    : state.draft;
}
function sortConversations(state: ChatState) {
  state.conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
function upsertMessage(messages: Message[], message: Message, placeholderId?: string) {
  let index = messages.findIndex((item) => item.id === message.id);
  if (index >= 0) {
    messages[index] = message;
    if (placeholderId && placeholderId !== message.id) {
      const placeholder = messages.findIndex((item) => item.id === placeholderId);
      if (placeholder >= 0) messages.splice(placeholder, 1);
    }
  } else {
    index = messages.findIndex((item) => item.id === placeholderId);
    if (index >= 0) messages[index] = message;
    else messages.push(message);
  }
}
function interruptStream(state: ChatState) {
  const assistant = streamMessages(state)?.find((item) => item.id === state.stream?.assistantId);
  if (assistant && ["pending", "streaming"].includes(assistant.status || "")) assistant.status = "interrupted";
  state.stream = null;
}

const chatSlice = createSlice({
  name: "chat", initialState,
  reducers: {
    detachStream(state) { interruptStream(state); },
    invalidateHistory(state, action: PayloadAction<string>) {
      delete state.history[action.payload];
      if (state.activeId === action.payload) state.sendError = null;
    },
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
      if (event.event === "superseded") {
        const id = state.stream.conversationId;
        const messages = streamMessages(state);
        const index = messages?.findIndex((item) => item.id === state.stream?.assistantId) ?? -1;
        if (messages && index >= 0) messages.splice(index, 1);
        state.stream = null;
        if (id) delete state.history[id];
        return;
      }
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
        state.history[id] = { loaded: true, loading: false, error: null, requestId: null };
        const messages = streamMessages(state);
        if (messages) {
          const deleted = new Set(event.data.deleted_message_ids || []);
          for (let index = messages.length - 1; index >= 0; index--) if (deleted.has(messages[index].id)) messages.splice(index, 1);
          if (event.data.user_message) upsertMessage(messages, toMessage(event.data.user_message), `${payload.requestId}-user`);
          else {
            const user = messages.find((item) => item.id === `${payload.requestId}-user`);
            if (user && event.data.user_message_id) { user.id = event.data.user_message_id; user.status = "completed"; user.persisted = true; }
          }
          if (event.data.assistant_message) {
            upsertMessage(messages, toMessage(event.data.assistant_message), state.stream.assistantId);
            state.stream.assistantId = event.data.assistant_message.id;
          }
        }
        const conversation = state.conversations.find((item) => item.id === id);
        if (conversation) conversation.updatedAt = now;
        sortConversations(state);
      } else {
        const messages = streamMessages(state);
        const assistant = messages?.find((item) => item.id === state.stream?.assistantId);
        if (event.event === "delta") { if (assistant) assistant.content += event.data.text; }
        else if (event.event === "reset") {
          if (assistant && assistant.id === event.data.assistant_message_id) assistant.content = "";
        } else if (event.event === "done") {
          if (messages) {
            const deleted = new Set(event.data.deleted_message_ids || []);
            for (let index = messages.length - 1; index >= 0; index--) if (deleted.has(messages[index].id)) messages.splice(index, 1);
            if (event.data.user_message) upsertMessage(messages, toMessage(event.data.user_message), `${payload.requestId}-user`);
            upsertMessage(messages, toMessage(event.data.message), state.stream.assistantId);
          }
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
      .addCase(renameConversation.pending, (state, action) => { state.mutations[action.meta.arg.id] = action.meta.requestId; })
      .addCase(renameConversation.fulfilled, (state, action) => {
        if (state.mutations[action.meta.arg.id] !== action.meta.requestId) return;
        delete state.mutations[action.meta.arg.id];
        const conversation = state.conversations.find((item) => item.id === action.payload.id);
        if (conversation) { conversation.title = action.payload.title; conversation.updatedAt = action.payload.updated_at; }
        state.list.requestId = null; state.list.loading = false;
        sortConversations(state);
      })
      .addCase(renameConversation.rejected, (state, action) => {
        if (state.mutations[action.meta.arg.id] === action.meta.requestId) delete state.mutations[action.meta.arg.id];
      })
      .addCase(deleteConversation.pending, (state, action) => {
        state.mutations[action.meta.arg] = action.meta.requestId;
        if (state.stream?.conversationId === action.meta.arg) interruptStream(state);
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        const id = action.meta.arg;
        if (state.mutations[id] !== action.meta.requestId) return;
        delete state.mutations[id]; delete state.history[id];
        state.deletedConversations[id] = true;
        state.conversations = state.conversations.filter((item) => item.id !== id);
        if (state.activeId === id) { state.activeId = null; state.draft = []; state.sendError = null; }
        state.list.requestId = null; state.list.loading = false;
        state.list.offset = Math.max(0, state.list.offset - 1);
      })
      .addCase(deleteConversation.rejected, (state, action) => {
        if (state.mutations[action.meta.arg] === action.meta.requestId) delete state.mutations[action.meta.arg];
      })
      .addCase(loadConversations.pending, (state, action) => {
        state.list.loading = true; state.list.error = null; state.list.requestId = action.meta.requestId;
      })
      .addCase(loadConversations.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        const { conversations, pagination } = action.payload;
        for (const row of conversations) {
          if (state.deletedConversations[row.id]) continue;
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
        state.stream = { requestId: action.meta.requestId, conversationId: state.activeId, confirmed: false, kind: "send", assistantId: `${action.meta.requestId}-assistant` };
        const now = new Date().toISOString();
        const messages: Message[] = [
          { id: `${action.meta.requestId}-user`, role: "user", content: action.meta.arg, createdAt: now, status: "completed", persisted: false },
          { id: `${action.meta.requestId}-assistant`, role: "assistant", content: "", createdAt: now, status: "streaming", persisted: false },
        ];
        if (state.activeId) streamMessages(state)?.push(...messages);
        else state.draft = messages;
      })
      .addCase(changeChatMessage.pending, (state, action) => {
        state.sendError = null;
        state.stream = { requestId: action.meta.requestId, conversationId: state.activeId, confirmed: false,
          kind: action.meta.arg.kind, assistantId: action.meta.arg.kind === "retry" ? action.meta.arg.id : "" };
        if (state.activeId && state.history[state.activeId]) state.history[state.activeId].requestId = null;
      })
      .addMatcher((action): action is ReturnType<typeof sendChatMessage.rejected> | ReturnType<typeof changeChatMessage.rejected> =>
        sendChatMessage.rejected.match(action) || changeChatMessage.rejected.match(action), (state, action) => {
        if (state.stream?.requestId !== action.meta.requestId) return;
        const messages = streamMessages(state);
        const assistant = messages?.find((item) => item.id === state.stream?.assistantId);
        if (assistant && (state.stream.confirmed || state.stream.kind === "send")) assistant.status = "interrupted";
        if (!state.stream.confirmed) {
          const user = messages?.find((item) => item.id === `${action.meta.requestId}-user`);
          if (user) user.status = "failed";
        }
        state.sendError = action.meta.aborted ? "Đã dừng. Câu trả lời chưa hoàn tất." : action.payload || "Câu trả lời bị gián đoạn.";
        state.stream = null;
      });
  },
});

export const { clearActiveConversation, selectConversation, receiveStreamEvent, detachStream, invalidateHistory } = chatSlice.actions;
export default chatSlice.reducer;
