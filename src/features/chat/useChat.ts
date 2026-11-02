import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { toast } from "../../components/toast";
import { handleUnauthorized } from "../../api/client";
import {
  changeChatMessage, clearActiveConversation, deleteConversation, detachStream, invalidateHistory,
  loadConversations, loadMessages, renameConversation, selectConversation, sendChatMessage,
} from "./chatSlice";

type Operation = { kind: "send"; message: string } | { kind: "retry"; id: string } | { kind: "edit"; id: string; message: string };

export function useChat() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((root) => root.chat);
  const session = useAppSelector((root) => root.auth.session);
  const controller = useRef<AbortController | null>(null);
  const activeConversation = state.conversations.find((item) => item.id === state.activeId);
  const historyState = state.activeId ? state.history[state.activeId] : undefined;
  const historyLoaded = Boolean(historyState?.loaded);
  const historyError = historyState?.error;
  const isSending = Boolean(state.stream);
  const mutating = Boolean(state.mutations[state.activeId || ""]);

  useEffect(() => {
    if (!session) return;
    const task = dispatch(loadConversations(0));
    const timer = window.setTimeout(handleUnauthorized, Math.max(0, session.expiresAt * 1000 - Date.now()));
    return () => { task.abort(); controller.current?.abort(); window.clearTimeout(timer); };
  }, [dispatch, session]);

  useEffect(() => {
    if (!session || !state.activeId || isSending || mutating || historyLoaded || historyError) return;
    const task = dispatch(loadMessages(state.activeId));
    return () => task.abort();
  }, [dispatch, session, state.activeId, isSending, mutating, historyLoaded, historyError]);

  const cancelCurrent = () => {
    controller.current?.abort(); controller.current = null;
    dispatch(detachStream());
  };
  const authorized = () => {
    if (!session) return false;
    if (session.expiresAt * 1000 <= Date.now()) { handleUnauthorized(); return false; }
    return true;
  };
  const runStream = async (input: Operation) => {
    if (!authorized()) return false;
    if (input.kind !== "retry" && (!input.message.trim() || input.message.trim().length > 12000)) {
      toast.warning("Tin nhắn phải có từ 1 đến 12000 ký tự."); return false;
    }
    if (input.kind === "edit") cancelCurrent();
    else if (state.stream || controller.current) return false;
    const abortController = new AbortController();
    controller.current = abortController;
    const task = input.kind === "send"
      ? dispatch(sendChatMessage(input.message.trim(), { signal: abortController.signal }))
      : dispatch(changeChatMessage(input, { signal: abortController.signal }));
    const result = await task;
    if (controller.current === abortController) controller.current = null;
    if ((sendChatMessage.rejected.match(result) || changeChatMessage.rejected.match(result)) && !result.meta.aborted && !result.meta.condition) {
      toast.error(result.payload || "Không xử lý được tin nhắn.");
    }
    return result.meta.requestStatus === "fulfilled";
  };

  const messages = activeConversation?.messages ?? state.draft;
  const blocked = messages.some((item) => item.role === "assistant" && ["pending", "failed", "interrupted"].includes(item.status || ""));
  return {
    ...state, activeConversation, messages, historyState, isSending,
    canSend: Boolean(session) && !isSending && !mutating && (!state.activeId || (historyLoaded && !blocked)),
    newChat: () => dispatch(clearActiveConversation()),
    select: (id: string) => dispatch(selectConversation(id)),
    loadMore: () => dispatch(loadConversations(state.list.offset)),
    reload: () => dispatch(loadConversations(0)),
    retryHistory: () => { if (state.activeId && !isSending) dispatch(invalidateHistory(state.activeId)); },
    stop: () => controller.current?.abort(),
    editMessage: (id: string, message: string) => runStream({ kind: "edit", id, message }),
    retryAssistant: (id: string) => runStream({ kind: "retry", id }),
    send: (message: string) => runStream({ kind: "send", message }),
    rename: async (id: string, title: string) => {
      if (!authorized()) return false;
      const result = await dispatch(renameConversation({ id, title }));
      if (renameConversation.fulfilled.match(result)) { toast.success("Đã đổi tên cuộc trò chuyện."); return true; }
      if (!result.meta.condition) toast.error(result.payload || "Không đổi được tên.");
      return false;
    },
    remove: async (id: string) => {
      if (!authorized()) return false;
      if (state.stream?.conversationId === id) cancelCurrent();
      const result = await dispatch(deleteConversation(id));
      if (deleteConversation.fulfilled.match(result)) { toast.success("Đã xóa cuộc trò chuyện."); return true; }
      if (!result.meta.condition) toast.error(result.payload || "Không xóa được cuộc trò chuyện.");
      return false;
    },
  };
}
