import { useId, useState } from "react";
import { Button, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, TextField, Tooltip } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import type { Message } from "../Message";
import { toast } from "../../../components/toast";

interface ChatMessageProps {
  message: Message;
  busy: boolean;
  onEdit: (messageId: string, content: string) => void;
}

export function ChatMessage({ message, busy, onEdit }: ChatMessageProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const menuId = useId();
  const isUser = message.role === "user";
  const valid = Boolean(draft.trim()) && draft.trim().length <= 12000;

  const saveEdit = () => {
    if (busy || !valid) return;
    onEdit(message.id, draft);
    setEditing(false);
  };

  return (
    <div className={`flex items-start gap-1 ${isUser ? "justify-end" : "justify-start"}`}>
      {isUser && !editing && (
        <>
          <Tooltip title="Message options">
            <IconButton
              size="small" disabled={busy} aria-label="Message options"
              aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? menuId : undefined}
              onClick={(event) => setAnchor(event.currentTarget)}
              className="mt-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu id={menuId} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem disabled={busy} onClick={() => {
              setAnchor(null);
              setDraft(message.content);
              setEditing(true);
            }}>
              <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
              Edit chat
            </MenuItem>
          </Menu>
        </>
      )}

      {editing ? (
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-[#1b2635]">
          <TextField
            fullWidth multiline autoFocus minRows={2} maxRows={10}
            value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)}
            slotProps={{ htmlInput: { "aria-label": "Edit chat", maxLength: 12000 } }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setEditing(false); }
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                event.preventDefault(); saveEdit();
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button color="inherit" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="contained" disableElevation disabled={busy || !valid} onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="max-w-[85%]">
          <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${isUser ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-[#1b2635] dark:text-slate-100"}`}>
            <p className="m-0 whitespace-pre-wrap wrap-break-word">
              {message.content || (message.status === "streaming" ? "" : "Chưa nhận được câu trả lời.")}
            </p>
            {message.status === "streaming" && <CircularProgress size={13} className="mt-1" aria-label="Đang trả lời" />}
            {message.status === "failed" && <p className="mt-2 mb-0 text-xs text-blue-100">Chưa xác nhận tin nhắn đã được lưu.</p>}
          </div>
          {!isUser && message.status === "interrupted" && (
            <Button
              size="small" color="inherit" disabled={busy}
              startIcon={<ReplayRoundedIcon fontSize="small" />}
              onClick={() => toast.info("Tính năng Retry sẽ được bổ sung sau.", 3000)}
              className="mt-1 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
