import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { toast } from "../../components/toast";
import { handleUnauthorized } from "../../api/client";
import { clearActiveConversation, editMessageLocally, loadConversations, loadMessages, selectConversation, sendChatMessage } from "./chatSlice";

export function useChat() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((root) => root.chat);
  const session = useAppSelector((root) => root.auth.session);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!session) return;
    const task = dispatch(loadConversations(0));
    const timer = window.setTimeout(handleUnauthorized, Math.max(0, session.expiresAt * 1000 - Date.now()));
    return () => {
      task.abort(); controller.current?.abort(); window.clearTimeout(timer);
    };
  }, [dispatch, session]);

  useEffect(() => {
    if (!session || !state.activeId) return;
    const task = dispatch(loadMessages(state.activeId));
    return () => task.abort();
  }, [dispatch, session, state.activeId]);

  const activeConversation = state.conversations.find((item) => item.id === state.activeId);
  return {
    ...state, activeConversation,
    messages: activeConversation?.messages ?? state.draft,
    historyState: state.activeId ? state.history[state.activeId] : undefined,
    isSending: Boolean(state.stream),
    newChat: () => dispatch(clearActiveConversation()),
    select: (id: string) => dispatch(selectConversation(id)),
    loadMore: () => dispatch(loadConversations(state.list.offset)),
    reload: () => dispatch(loadConversations(0)),
    retryHistory: () => { if (state.activeId) void dispatch(loadMessages(state.activeId)); },
    stop: () => controller.current?.abort(),
    editMessage: (messageId: string, content: string) => dispatch(editMessageLocally({ conversationId: state.activeId, messageId, content })),
    send: async (message: string) => {
      if (!session || state.stream || controller.current) return false;
      if (session.expiresAt * 1000 <= Date.now()) { handleUnauthorized(); return false; }
      if (message.length > 12000) { toast.warning("Tin nhắn tối đa 12000 ký tự."); return false; }
      const abortController = new AbortController();
      controller.current = abortController;
      const task = dispatch(sendChatMessage(message, { signal: abortController.signal }));
      const result = await task;
      if (controller.current === abortController) controller.current = null;
      if (sendChatMessage.rejected.match(result) && !result.meta.aborted && !result.meta.condition) {
        toast.error(result.payload || "Không gửi được tin nhắn.");
      }
      return sendChatMessage.fulfilled.match(result);
    },
  };
}
