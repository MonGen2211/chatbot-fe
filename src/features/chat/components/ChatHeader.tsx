import CloseIcon from "@mui/icons-material/Close";
import { IconButton, Tooltip } from "@mui/material";

interface ChatHeaderProps {
  title: string;
  onExit: () => void;
  disabled?: boolean;
}

export function ChatHeader({ title, onExit, disabled }: ChatHeaderProps) {
  return (
    <header className="mx-4 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-700/60">
      <h1 className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
        {title}
      </h1>

      <Tooltip title="Exit chat">
        <IconButton size="small" onClick={onExit} disabled={disabled} aria-label="Exit chat">
          <CloseIcon fontSize="small" className="text-slate-500 dark:text-slate-400" />
        </IconButton>
      </Tooltip>
    </header>
  );
}
