import AddIcon from "@mui/icons-material/Add";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import {
  Avatar,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
} from "@mui/material";
import type { User } from "../../auth/types";

export interface ChatItem {
  id: string;
  title: string;
}

interface ChatSidebarProps {
  chats: ChatItem[];
  activeId: string | null;
  user: User | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  busy: boolean;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onReload: () => void;
}

export function ChatSidebar({
  chats,
  activeId,
  user,
  onSelect,
  onNewChat,
  onOpenSettings,
  onOpenLogin,
  onLogout,
  busy, loading, hasMore, error, onLoadMore, onReload,
}: ChatSidebarProps) {
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col bg-[#18202c] p-4 text-slate-200 md:flex dark:border-r dark:border-white/5 dark:bg-[#0b111a]">
      <div className="mb-5 flex items-center gap-2 px-1 pt-1">
        <SmartToyOutlinedIcon fontSize="small" />
        <span className="text-[17px] font-semibold text-white">AI Chat</span>
      </div>

      <Button
        fullWidth
        variant="contained"
        disableElevation
        startIcon={<AddIcon fontSize="small" />}
        onClick={onNewChat}
        disabled={busy || !user}
        className="rounded-lg py-2 text-sm"
      >
        New Chat
      </Button>

      <p className="mt-5 mb-2 px-1 text-xs text-slate-400">Recent Chats</p>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <List disablePadding className="flex flex-col gap-0.5">
        {chats.map((chat) => {
          const active = chat.id === activeId;
          return (
            <ListItemButton
              key={chat.id}
              selected={active}
              onClick={() => onSelect(chat.id)}
              disabled={busy}
              className={`rounded-lg px-2.5 py-2 ${
                active
                  ? "bg-[#2d394b] text-white"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <ListItemText
                primary={chat.title}
                slotProps={{ primary: { className: "text-[13px] truncate" } }}
              />
            </ListItemButton>
          );
        })}
      </List>
      {loading && <div className="flex justify-center py-3"><CircularProgress size={20} aria-label="Đang tải danh sách" /></div>}
      {error && <div role="alert" className="px-1 py-2 text-xs text-red-300">{error}<Button size="small" onClick={onReload} disabled={busy || loading}>Thử lại</Button></div>}
      {hasMore && !error && <Button fullWidth onClick={onLoadMore} disabled={loading || busy}>Tải thêm</Button>}
      {!loading && !error && user && !chats.length && <p className="px-1 text-xs text-slate-400">Chưa có cuộc trò chuyện.</p>}
      </div>

      {/* Footer: Settings + Login / User */}
      <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <SettingsOutlinedIcon fontSize="small" />
          Settings
        </button>

        {user ? (
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <Avatar className="h-8 w-8 bg-blue-500 text-sm">
              {user.name.charAt(0).toUpperCase()}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-slate-400">{user.email}</p>
            </div>
            <Tooltip title="Logout">
              <IconButton size="small" onClick={onLogout} aria-label="Logout">
                <LogoutOutlinedIcon fontSize="small" className="text-slate-300" />
              </IconButton>
            </Tooltip>
          </div>
        ) : (
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LoginOutlinedIcon fontSize="small" />}
            onClick={onOpenLogin}
            className="rounded-lg border-white/20 py-1.5 text-[13px] text-slate-200 hover:border-white/40 hover:bg-white/5"
          >
            Login
          </Button>
        )}
      </div>
    </aside>
  );
}
