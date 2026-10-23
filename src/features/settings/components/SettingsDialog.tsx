import { Button, Dialog } from "@mui/material";
import { ThemeModeToggle } from "../../../components/ThemeModeToggle";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="settings-title"
      slotProps={{ paper: { className: "!rounded-2xl" } }}
    >
      <div className="p-6">
        <h2 id="settings-title" className="text-lg font-semibold">
          Settings
        </h2>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Theme</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Choose light, dark, or match your system
            </p>
          </div>
          <ThemeModeToggle />
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
}