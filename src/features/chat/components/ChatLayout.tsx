import { useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatContent } from "./ChatContent";
import { SettingsDialog } from "../../settings/components/SettingsDialog";
import { useAuth } from "../../auth/useAuth";
import { LoginDialog } from "../../auth/components/LoginDialog";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  clearActiveConversation,
  createConversation,
  selectConversation,
} from "../chatSlice";

export function ChatLayout() {
  const dispatch = useAppDispatch();
  const { conversations, activeId } = useAppSelector((state) => state.chat);
  const activeConversation = conversations.find((item) => item.id === activeId);

  const { user, logout, clearFeedback } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const handleNewChat = () => {
    const now = new Date().toISOString();

    dispatch(
      createConversation({
        id: crypto.randomUUID(),
        title: "New Chat",
        messages: [],
        createdAt: now,
        updatedAt: now,
      }),
    );
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-200 dark:bg-black">
      <div className="flex h-full w-full overflow-hidden bg-white shadow-2xl ring-1 ring-black/5 dark:bg-[#0f1520] dark:ring-white/10">
        <ChatSidebar
          chats={conversations}
          activeId={activeId}
          user={user}
          onSelect={(id) => dispatch(selectConversation(id))}
          onNewChat={handleNewChat}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLogin={() => { clearFeedback(); setLoginOpen(true); }}
          onLogout={logout}
        />

        <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-[#0f1520]">
          <ChatHeader
            title={activeConversation?.title ?? "New Chat"}
            onExit={() => dispatch(clearActiveConversation())}
          />
          <ChatContent />
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {loginOpen && <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
      />}
    </div>
  );
}
