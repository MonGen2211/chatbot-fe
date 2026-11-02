import { useId, useRef, useState } from "react";
import { Button, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, TextField, Tooltip } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import type { Message } from "../Message";

interface ChatMessageProps {
  message: Message;
  busy: boolean;
  onEdit: (messageId: string, content: string) => Promise<boolean>;
  onRetry: (messageId: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function ChatMessage({ message, busy, onEdit, onRetry, onRefresh }: ChatMessageProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const menuId = useId();
  const isUser = message.role === "user";
  const valid = Boolean(draft.trim()) && draft.trim().length <= 12000;

  const saveEdit = async () => {
    if (saving || submitting.current || !valid) return;
    submitting.current = true; setSaving(true);
    try { if (await onEdit(message.id, draft)) setEditing(false); }
    finally { submitting.current = false; setSaving(false); }
  };

  return (
    <div className={`flex items-start gap-1 ${isUser ? "justify-end" : "justify-start"}`}>
      {isUser && !editing && (
        <>
          <Tooltip title="Message options">
            <IconButton
              size="small" disabled={message.persisted !== true || saving} aria-label="Message options"
              aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? menuId : undefined}
              onClick={(event) => setAnchor(event.currentTarget)}
              className="mt-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu id={menuId} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem disabled={message.persisted !== true || saving} onClick={() => {
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
          <p className="mt-0 mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Sửa tin nhắn sẽ xóa toàn bộ tin nhắn phía sau và tạo lại câu trả lời.</p>
          <TextField
            fullWidth multiline autoFocus minRows={2} maxRows={10}
            value={draft} disabled={saving} onChange={(event) => setDraft(event.target.value)}
            slotProps={{ htmlInput: { "aria-label": "Edit chat", maxLength: 12000 } }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setEditing(false); }
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                event.preventDefault(); saveEdit();
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button color="inherit" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="contained" disableElevation disabled={saving || !valid} onClick={() => void saveEdit()}>
              {saving ? <CircularProgress size={18} color="inherit" aria-label="Đang lưu" /> : "Save & regenerate"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-[85%]">
          <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${isUser ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-[#1b2635] dark:text-slate-100"}`}>
            <p className="m-0 whitespace-pre-wrap wrap-break-word">
              {message.content || (["streaming", "pending"].includes(message.status || "") ? "" : "Chưa nhận được câu trả lời.")}
            </p>
            {(message.status === "streaming" || message.status === "pending") && <CircularProgress size={13} className="mt-1" aria-label="Đang trả lời" />}
            {isUser && message.isEdited && <p className="mt-1 mb-0 text-[11px] text-blue-100">Đã chỉnh sửa</p>}
            {isUser && message.status === "failed" && <p className="mt-2 mb-0 text-xs text-blue-100">Chưa xác nhận tin nhắn đã được lưu.</p>}
          </div>
          {!isUser && message.status === "failed" && message.persisted && (
            <Button
              size="small" color="inherit" disabled={busy}
              startIcon={<ReplayRoundedIcon fontSize="small" />}
              onClick={() => void onRetry(message.id)}
              className="mt-1 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Retry
            </Button>
          )}
          {!isUser && message.persisted && (message.status === "interrupted" || message.status === "pending") && !busy && (
            <Button size="small" color="inherit" onClick={onRefresh} startIcon={<ReplayRoundedIcon fontSize="small" />} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tải lại trạng thái
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
