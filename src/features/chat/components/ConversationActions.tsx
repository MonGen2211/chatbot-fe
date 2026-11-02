import { useRef, useState, type FormEvent } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ListItemIcon, Menu, MenuItem, TextField } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";

interface ConversationActionsProps {
  conversation: { id: string; title: string };
  busy: boolean;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function ConversationActions({ conversation, busy, onRename, onDelete }: ConversationActionsProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<"rename" | "delete" | null>(null);
  const [title, setTitle] = useState(conversation.title);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const disabled = busy || saving;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode || disabled || submitting.current || (mode === "rename" && (!title.trim() || title.trim().length > 200))) return;
    submitting.current = true; setSaving(true);
    try {
      const success = mode === "rename" ? await onRename(conversation.id, title.trim()) : await onDelete(conversation.id);
      if (success) setMode(null);
    } finally { submitting.current = false; setSaving(false); }
  };

  return (
    <>
      <IconButton
        size="small" disabled={disabled} aria-label={`Tùy chọn ${conversation.title}`} aria-haspopup="menu"
        aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(event.currentTarget)}
        className="shrink-0 text-slate-400 hover:text-blue-400"
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem disabled={disabled} onClick={() => { setAnchor(null); setTitle(conversation.title); setMode("rename"); }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>Đổi tên
        </MenuItem>
        <MenuItem disabled={disabled} onClick={() => { setAnchor(null); setMode("delete"); }} className="text-red-500">
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>Xóa cuộc trò chuyện
        </MenuItem>
      </Menu>
      <Dialog
        open={Boolean(mode)} onClose={() => { if (!disabled) setMode(null); }} fullWidth maxWidth="xs"
        aria-labelledby={`conversation-action-${conversation.id}`}
        slotProps={{ paper: { component: "form", onSubmit: submit, className: "rounded-2xl p-2", "aria-busy": disabled } }}
      >
        <DialogTitle id={`conversation-action-${conversation.id}`} className="px-4 pt-4 pb-2 text-lg font-semibold">
          {mode === "rename" ? "Đổi tên cuộc trò chuyện" : "Xóa cuộc trò chuyện?"}
        </DialogTitle>
        <DialogContent className="px-4 pt-3 pb-4">
          {mode === "rename" ? (
            <TextField
              fullWidth autoFocus required label="Tên cuộc trò chuyện" value={title} disabled={disabled}
              onChange={(event) => setTitle(event.target.value)} className="mt-2"
              slotProps={{ htmlInput: { maxLength: 200 } }} helperText={`${title.length}/200`}
            />
          ) : <p className="m-0 text-sm leading-6">Toàn bộ tin nhắn trong “{conversation.title}” sẽ bị xóa. Bạn không thể hoàn tác thao tác này.</p>}
        </DialogContent>
        <DialogActions className="gap-2 px-4 pb-4">
          <Button color="inherit" disabled={disabled} onClick={() => setMode(null)}>Hủy</Button>
          <Button type="submit" variant="contained" disableElevation color={mode === "delete" ? "error" : "primary"}
            disabled={disabled || (mode === "rename" && !title.trim())} className="min-w-20">
            {saving ? <CircularProgress size={18} color="inherit" aria-label="Đang xử lý" /> : mode === "rename" ? "Lưu" : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
