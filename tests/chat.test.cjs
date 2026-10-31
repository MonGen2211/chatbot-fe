const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

// Run the real services/reducers with Node, without a browser or extra test dependencies.
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8").replace("import.meta.env.VITE_API_URL", "undefined");
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const storage = new Map();
Object.defineProperty(globalThis, "sessionStorage", { value: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
} });
const { configureStore } = require("@reduxjs/toolkit");
const { AxiosError } = require("axios");
const { apiClient, setAccessToken, setUnauthorizedHandler } = require("../src/api/client.ts");
const { authService } = require("../src/features/auth/authService.ts");
const { readSession, saveSession } = require("../src/features/auth/authStorage.ts");
const { default: auth, authenticate, logout } = require("../src/features/auth/authSlice.ts");
const { default: chat, loadConversations, loadMessages, sendChatMessage, clearActiveConversation, selectConversation } = require("../src/features/chat/chatSlice.ts");
const { streamMessage } = require("../src/features/chat/chatService.ts");
const originalFetch = globalThis.fetch;
const originalAdapter = apiClient.defaults.adapter;
afterEach(() => {
  globalThis.fetch = originalFetch;
  apiClient.defaults.adapter = originalAdapter;
  setUnauthorizedHandler(() => {});
  storage.clear();
});
const id = "9bb04d0a-4001-4f6f-a3e7-9865ae719666";
const session = {
  accessToken: "backend-jwt", tokenType: "bearer", expiresIn: 3600,
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "test@example.com", name: "test" },
};
const date = "2026-10-29T00:00:00.000Z";
const row = (conversationId = id) => ({ id: conversationId, title: "Chat", created_at: date, updated_at: date });
const assistant = { id: "saved-assistant", role: "assistant", content: "Xin chào bạn!", created_at: date };
const frame = (event, data) => `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
const conversationFrame = frame("conversation", { conversation_id: id, created: true, user_message_id: "saved-user" });
const doneFrame = frame("done", { conversation_id: id, message: assistant });
function response(text, byteSize = 7) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += byteSize) controller.enqueue(bytes.slice(i, i + byteSize));
      controller.close();
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}
function store() {
  const result = configureStore({ reducer: { auth, chat } });
  result.dispatch(authenticate.pending("auth-request", {}));
  result.dispatch(authenticate.fulfilled({ session, message: null }, "auth-request", {}));
  setAccessToken(session.accessToken);
  return result;
}
const jsonResponse = (config, data) => ({ status: 200, statusText: "OK", headers: {}, config, data: { success: true, data } });

test("login/register keep backend user ID and expiry, and registration signs in immediately", async () => {
  apiClient.defaults.adapter = async (config) => {
    assert.match(config.url, /^\/auth\/(login|register)$/);
    assert.deepEqual(JSON.parse(config.data), { email: "test@example.com", password: "password123" });
    return jsonResponse(config, { user: session.user, session: { access_token: "backend-jwt", token_type: "bearer", expires_in: 3600, expires_at: session.expiresAt } });
  };
  for (const mode of ["login", "register"]) {
    const result = await authService[mode]({ email: "test@example.com", password: "password123" });
    assert.deepEqual(result, { session, message: null });
  }
});

test("old Supabase sessions and expired backend sessions are discarded", () => {
  storage.set("ai-chat-session", JSON.stringify({ accessToken: "old-supabase-token" }));
  assert.equal(readSession(), null);
  assert.equal(storage.has("ai-chat-session"), false);
  saveSession(session);
  assert.deepEqual(readSession(), session);
  saveSession({ ...session, expiresAt: 1 });
  assert.equal(readSession(), null);
  assert.equal(storage.size, 0);
});

test("conversation pages use limit/offset and Bearer, deduplicate and sort", async () => {
  const app = store();
  const offsets = [];
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.headers.Authorization, "Bearer backend-jwt");
    assert.equal(config.url, "/conversations");
    assert.equal(config.params.limit, 50);
    offsets.push(config.params.offset);
    return jsonResponse(config, {
      conversations: config.params.offset ? [row(), { ...row("other"), updated_at: "2026-10-30T00:00:00Z" }] : [row()],
      pagination: { limit: 50, offset: config.params.offset, has_more: !config.params.offset },
    });
  };
  await app.dispatch(loadConversations(0));
  assert.equal(app.getState().chat.list.hasMore, true);
  await app.dispatch(loadConversations(app.getState().chat.list.offset));
  assert.deepEqual(offsets, [0, 50]);
  assert.deepEqual(app.getState().chat.conversations.map((item) => item.id), ["other", id]);
  assert.equal(app.getState().chat.list.hasMore, false);
});

test("history reads all pages oldest first and caches the completed result", async () => {
  const app = store();
  app.dispatch(loadConversations.fulfilled({ conversations: [], pagination: {} }, "stale", 0));
  apiClient.defaults.adapter = async (config) => jsonResponse(config, { conversations: [row()], pagination: { offset: 0, limit: 50, has_more: false } });
  await app.dispatch(loadConversations(0));
  const offsets = [];
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.url, "/messages");
    assert.equal(config.params.conversation_id, id);
    const offset = config.params.offset;
    offsets.push(offset);
    return jsonResponse(config, { messages: [{ id: String(offset), role: "user", content: `page ${offset}`, created_at: date }], pagination: { offset, limit: 50, has_more: offset === 0 } });
  };
  app.dispatch(selectConversation(id));
  await app.dispatch(loadMessages(id));
  await app.dispatch(loadMessages(id));
  assert.deepEqual(offsets, [0, 50]);
  assert.deepEqual(app.getState().chat.conversations[0].messages.map((item) => item.content), ["page 0", "page 50"]);
  assert.equal(app.getState().chat.history[id].loaded, true);
});

test("SSE buffers one-byte chunks, split CRLF and multibyte Vietnamese text", async () => {
  globalThis.fetch = async () => response(conversationFrame + ": keepalive\r\n\r\n" + frame("delta", { text: "Xin chào bạn!" }) + doneFrame, 1);
  const events = [];
  await streamMessage("backend-jwt", "Hello", null, (event) => events.push(event), new AbortController().signal);
  assert.deepEqual(events.map((event) => event.event), ["conversation", "delta", "done"]);
  assert.equal(events[1].data.text, "Xin chào bạn!");
});

test("new chat never sends a temporary ID, adopts the server ID and replaces the streamed message", async () => {
  const app = store();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:3001/api/chat");
    assert.equal(options.headers.Authorization, "Bearer backend-jwt");
    requests.push(JSON.parse(options.body));
    return response(conversationFrame + frame("delta", { text: "partial" }) + doneFrame);
  };
  await app.dispatch(sendChatMessage("Hello"));
  const state = app.getState().chat;
  assert.equal(state.activeId, id);
  assert.equal(state.stream, null);
  assert.equal(state.draft.length, 0);
  assert.deepEqual(state.conversations[0].messages.map((item) => [item.id, item.content, item.status]), [
    ["saved-user", "Hello", "completed"], ["saved-assistant", "Xin chào bạn!", "completed"],
  ]);
  await app.dispatch(sendChatMessage("Follow up"));
  assert.deepEqual(requests, [{ message: "Hello" }, { conversation_id: id, message: "Follow up" }]);
});

test("HTTP 200 without done preserves partial text and marks it interrupted", async () => {
  const app = store();
  globalThis.fetch = async () => response(conversationFrame + frame("delta", { text: "Partial answer" }));
  const result = await app.dispatch(sendChatMessage("Hello"));
  assert.equal(sendChatMessage.rejected.match(result), true);
  const state = app.getState().chat;
  assert.equal(state.stream, null);
  assert.equal(state.conversations[0].messages[1].content, "Partial answer");
  assert.equal(state.conversations[0].messages[1].status, "interrupted");
  assert.match(state.sendError, /hoàn tất/);
});

test("Stop cancels the display delay without showing buffered deltas or done", async () => {
  globalThis.fetch = async () => response(conversationFrame + frame("delta", { text: "Buffered" }) + doneFrame, 10000);
  const controller = new AbortController();
  const events = [];
  let timer;
  try {
    await assert.rejects(streamMessage("backend-jwt", "Hello", null, (event) => {
      events.push(event.event);
      if (event.event === "conversation") timer = setTimeout(() => controller.abort(), 10);
    }, controller.signal), { name: "AbortError" });
    assert.deepEqual(events, ["conversation"]);
  } finally { clearTimeout(timer); }
});

test("SSE errors preserve partial text and expose the backend error", async () => {
  const app = store();
  globalThis.fetch = async () => response(conversationFrame + frame("delta", { text: "Partial" }) + frame("error", { message: "Quota exceeded", code: "rate_limited" }));
  await app.dispatch(sendChatMessage("Hello"));
  assert.equal(app.getState().chat.sendError, "Quota exceeded");
  assert.equal(app.getState().chat.conversations[0].messages[1].status, "interrupted");
});

test("HTTP JSON errors before streaming do not create fake conversations or retry", async () => {
  const app = store();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ message: "Service unavailable", code: "service_unavailable" }), { status: 503 });
  };
  await app.dispatch(sendChatMessage("Hello"));
  assert.equal(calls, 1);
  assert.equal(app.getState().chat.conversations.length, 0);
  assert.equal(app.getState().chat.activeId, null);
  assert.equal(app.getState().chat.draft[0].status, "failed");
  assert.equal(app.getState().chat.sendError, "Service unavailable");
});

test("AbortController stops streaming, blocks overlapping sends and retains the partial reply", async () => {
  const app = store();
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(conversationFrame + frame("delta", { text: "Partial" })));
        options.signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      },
    }));
  };
  const controller = new AbortController();
  const task = app.dispatch(sendChatMessage("Hello", { signal: controller.signal }));
  await new Promise((resolve) => {
    const unsubscribe = app.subscribe(() => {
      if (app.getState().chat.conversations[0]?.messages[1]?.content === "Partial") { unsubscribe(); resolve(); }
    });
  });
  app.dispatch(clearActiveConversation());
  assert.equal(app.getState().chat.activeId, id);
  const overlap = await app.dispatch(sendChatMessage("Duplicate"));
  assert.equal(overlap.meta.condition, true);
  controller.abort();
  const result = await task;
  assert.equal(result.meta.aborted, true);
  assert.equal(calls, 1);
  assert.equal(app.getState().chat.conversations[0].messages[1].status, "interrupted");
  assert.equal(app.getState().chat.stream, null);
});

test("401 from both Axios and SSE expires the session and clears chat state", async () => {
  for (const transport of ["axios", "fetch"]) {
    const app = store();
    let expired = 0;
    setUnauthorizedHandler(() => { expired++; app.dispatch(logout()); });
    if (transport === "axios") {
      apiClient.defaults.adapter = async (config) => { throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, { status: 401, data: { message: "Expired" } }); };
      await app.dispatch(loadConversations(0));
    } else {
      globalThis.fetch = async () => new Response(JSON.stringify({ message: "Expired" }), { status: 401 });
      await app.dispatch(sendChatMessage("Hello"));
    }
    assert.equal(expired, 1);
    assert.equal(app.getState().auth.session, null);
    assert.equal(app.getState().chat.conversations.length, 0);
    assert.equal(app.getState().chat.draft.length, 0);
    assert.equal(app.getState().chat.list.error, null);
  }
});

test("late history/list results after logout cannot restore the previous user's data", async () => {
  const app = store();
  let finish;
  apiClient.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(jsonResponse(config, { conversations: [row()], pagination: { limit: 50, offset: 0, has_more: false } })); });
  const task = app.dispatch(loadConversations(0));
  app.dispatch(logout());
  finish();
  await task;
  assert.equal(app.getState().chat.conversations.length, 0);
});
