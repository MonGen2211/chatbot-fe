import { useState } from "react";
import { Button } from "@mui/material";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatContent } from "./ChatContent";
import { SettingsDialog } from "../../settings/components/SettingsDialog";
import { useAuth } from "../../auth/useAuth";
import { LoginDialog } from "../../auth/components/LoginDialog";
import { useChat } from "../useChat";

export function ChatLayout() {
  const chat = useChat();
  const { user, logout, clearFeedback } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const openLogin = () => { clearFeedback(); setLoginOpen(true); };

  return (
    <div className="flex h-full bg-slate-200 dark:bg-black">
      <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#0f1520]">
        <ChatSidebar
          chats={chat.conversations} activeId={chat.activeId} user={user}
          onSelect={chat.select} onNewChat={chat.newChat}
          onOpenSettings={() => setSettingsOpen(true)} onOpenLogin={openLogin}
          onLogout={() => { chat.stop(); logout(); }}
          busy={chat.isSending} loading={chat.list.loading} hasMore={chat.list.hasMore}
          error={chat.list.error} onLoadMore={chat.loadMore} onReload={chat.reload}
        />
        <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-[#0f1520]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 md:hidden dark:border-slate-700">
            <Button onClick={chat.newChat} disabled={chat.isSending}>New Chat</Button>
            {user ? <Button onClick={() => { chat.stop(); logout(); }}>Logout</Button> : <Button onClick={openLogin}>Login</Button>}
          </div>
          <ChatHeader title={chat.activeConversation?.title ?? "New Chat"} onExit={chat.newChat} disabled={chat.isSending} />
          <ChatContent chat={chat} signedIn={Boolean(user)} onLogin={openLogin} />
        </main>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {loginOpen && <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
