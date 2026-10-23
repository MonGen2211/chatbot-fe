import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";
import { Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";

type Mode = "light" | "dark" | "system";

const OPTIONS: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <LightModeOutlinedIcon fontSize="small" /> },
  { value: "system", label: "System", icon: <SettingsBrightnessOutlinedIcon fontSize="small" /> },
  { value: "dark", label: "Dark", icon: <DarkModeOutlinedIcon fontSize="small" /> },
];

export function ThemeModeToggle() {
  const { mode, setMode } = useColorScheme();

  // mode là undefined ở lần render đầu tiên
  if (!mode) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode"
      className="inline-flex shrink-0 gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
    >
      {OPTIONS.map(({ value, label, icon }) => {
        const active = mode === value;
        return (
          <Tooltip key={value} title={label}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              onClick={() => setMode(value)}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {icon}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}