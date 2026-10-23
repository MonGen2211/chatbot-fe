import { useEffect, useState } from "react";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { IconButton, InputBase } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  addMessage,
  setConversationInteractionId,
} from "../chatSlice";
import { sendMessageToGemini } from "../chatService";

export function ChatContent() {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const { conversations, activeId } = useAppSelector((state) => state.chat);
  const activeConversation = conversations.find((item) => item.id === activeId);

  useEffect(() => {
    setMessage("");
    setSendError(null);
  }, [activeId]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !activeConversation || isSending) return;

    const conversationId = activeConversation.id;
    const previousInteractionId = activeConversation.lastInteractionId;

    setMessage("");
    setIsSending(true);
    setSendError(null);

    dispatch(
      addMessage({
        conversationId,
        message: {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    try {
      const { answer, interactionId } = await sendMessageToGemini(
        text,
        previousInteractionId,
      );

      dispatch(
        addMessage({
          conversationId,
          message: {
            id: crypto.randomUUID(),
            role: "assistant",
            content: answer,
            createdAt: new Date().toISOString(),
          },
        }),
      );

      dispatch(
        setConversationInteractionId({
          conversationId,
          interactionId,
        }),
      );
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Không gửi được tin nhắn.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const hasMessages = Boolean(activeConversation?.messages.length);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {hasMessages ? (
          activeConversation?.messages.map((item) => (
            <div
              key={item.id}
              className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                style={
                  item.role === "assistant"
                    ? { backgroundColor: "#1b2635", color: "#f1f5f9" }
                    : undefined
                }
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  item.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-900 dark:bg-[#1b2635] dark:text-slate-100"
                }`}
              >
                {item.content}
              </p>
            </div>
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <SmartToyOutlinedIcon className="mb-3 text-4xl text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">
              How can I help you?
            </h2>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Ask me <span className="text-blue-600 dark:text-blue-400">anything</span> to
              get started
            </p>
          </div>
        )}

        {isSending && <p className="text-sm text-slate-400">Gemini đang trả lời...</p>}
        {sendError && <p className="text-sm text-red-500">{sendError}</p>}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white py-3 pr-2 pl-4 transition-colors focus-within:border-blue-500 dark:border-slate-700 dark:bg-[#161e2b] dark:focus-within:border-blue-400">
          <InputBase
            fullWidth
            minRows={4}
            maxRows={8}
            value={message}
            disabled={!activeConversation || isSending}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a message..."
            className="items-start text-[16px] h-24"
          />
          <IconButton
            color="primary"
            onClick={() => void handleSend()}
            disabled={!activeConversation || !message.trim() || isSending}
            aria-label="Send message"
          >
            <SendOutlinedIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
