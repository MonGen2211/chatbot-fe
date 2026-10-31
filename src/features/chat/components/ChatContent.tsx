import { useEffect, useRef, useState } from "react";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { Button, CircularProgress, IconButton, InputBase } from "@mui/material";
import type { useChat } from "../useChat";
import { ChatMessage } from "./ChatMessage";

interface ChatContentProps {
  chat: ReturnType<typeof useChat>;
  signedIn: boolean;
  onLogin: () => void;
}

export function ChatContent({ chat, signedIn, onLogin }: ChatContentProps) {
  const [composer, setComposer] = useState({ id: chat.activeId, text: "" });
  const message = composer.id === chat.activeId ? composer.text : "";
  const scroller = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const historyReady = !chat.activeId || Boolean(chat.historyState?.loaded);
  const disabled = !signedIn || chat.isSending || !historyReady;

  useEffect(() => {
    if (follow.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [chat.messages, chat.activeId]);

  const handleSend = () => {
    const text = message.trim();
    if (!text || disabled || text.length > 12000) return;
    follow.current = true;
    setComposer({ id: chat.activeId, text: "" });
    void chat.send(text);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
        onScroll={() => {
          const element = scroller.current;
          if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        }}
        aria-busy={chat.isSending || chat.historyState?.loading}
      >
        {chat.historyState?.loading && <div className="flex items-center gap-2 text-sm text-slate-500"><CircularProgress size={18} /> Đang tải lịch sử...</div>}
        {chat.historyState?.error && (
          <div role="alert" className="text-sm text-red-500">
            {chat.historyState.error} <Button onClick={chat.retryHistory}>Thử lại</Button>
          </div>
        )}
        {chat.messages.length ? chat.messages.map((item) => (
          <ChatMessage key={item.id} message={item} busy={chat.isSending} onEdit={chat.editMessage} />
        )) : !chat.historyState?.loading && !chat.historyState?.error && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <SmartToyOutlinedIcon className="mb-3 text-4xl text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">How can I help you?</h2>
            <p className="mt-2 text-sm text-slate-500">{signedIn ? "Gửi tin nhắn để bắt đầu cuộc trò chuyện mới." : "Đăng nhập để xem lịch sử và bắt đầu trò chuyện."}</p>
            {!signedIn && <Button variant="contained" onClick={onLogin} className="mt-3">Đăng nhập</Button>}
          </div>
        )}
        {chat.sendError && <p role="alert" className="text-sm text-red-500">{chat.sendError}</p>}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white py-3 pr-2 pl-4 focus-within:border-blue-500 dark:border-slate-700 dark:bg-[#161e2b]">
          <InputBase
            fullWidth multiline minRows={2} maxRows={8} value={message} disabled={disabled}
            onChange={(event) => setComposer({ id: chat.activeId, text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); handleSend();
              }
            }}
            placeholder={signedIn ? "Type a message..." : "Đăng nhập để gửi tin nhắn"}
            inputProps={{ "aria-label": "Tin nhắn", maxLength: 12000 }}
            className="items-start text-base"
          />
          {chat.isSending ? (
            <IconButton color="error" onClick={chat.stop} aria-label="Dừng trả lời"><StopRoundedIcon /></IconButton>
          ) : (
            <IconButton color="primary" onClick={handleSend} disabled={disabled || !message.trim()} aria-label="Send message"><SendOutlinedIcon fontSize="small" /></IconButton>
          )}
        </div>
      </div>
    </section>
  );
}
