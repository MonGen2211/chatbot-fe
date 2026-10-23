import { useState } from "react";
import { Button, Dialog } from "@mui/material";
import type { User } from "../types";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
}

interface FieldProps {
  label: string;
  type: "email" | "password";
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
}

function Field({ label, type, value, onChange, autoFocus, autoComplete }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        required
        type={type}
        value={value}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
      />
    </label>
  );
}

export function LoginDialog({ open, onClose, onLogin }: LoginDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: gọi API đăng nhập ở đây, dùng kết quả trả về thay cho user giả bên dưới
    onLogin({ name: email.split("@")[0] || "User", email });
    setEmail("");
    setPassword("");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="login-title"
      slotProps={{
        paper: { component: "form", onSubmit: handleSubmit, className: "!rounded-2xl" },
      }}
    >
      <div className="p-6">
        <h2 id="login-title" className="text-lg font-semibold">
          Login
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Sign in to sync your chats
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disableElevation>
            Login
          </Button>
        </div>
      </div>
    </Dialog>
  );
}