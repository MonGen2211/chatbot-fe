import { useState, type FormEvent } from "react";
import { Box, Button, CircularProgress, Dialog, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { toast } from "../../../components/toast";
import { useAuth } from "../useAuth";
import type { AuthMode } from "../types";

const inputClassName = "h-[42px] rounded-[10px] bg-white pr-3 text-[#353535] [&_.MuiOutlinedInput-notchedOutline]:border-[#dedede] hover:[&_.MuiOutlinedInput-notchedOutline]:border-[#b8a2c7] [&.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-[#805a9b] [&.Mui-focused]:shadow-[0_0_0_3px_#805a9b1a] [&.Mui-disabled]:bg-[#f6f4f7]";
const htmlInputClassName = "box-border h-[42px] px-4 py-0 text-xs text-[#353535] placeholder:text-[#666] placeholder:opacity-100 [&:-webkit-autofill]:[box-shadow:0_0_0_100px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#353535]";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { submit, loading, clearFeedback } = useAuth();
  const isRegister = mode === "register";
  const title = isRegister ? "Create Account" : "Agent Login";
  const actionLabel = isRegister ? "Create account" : "Sign in";

  const handleClose = () => {
    if (loading) return;
    clearFeedback();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    try {
      const result = await submit(mode, { email: email.trim(), password });
      setPassword("");
      setShowPassword(false);
      if (result.session) {
        toast.success(isRegister ? "Đăng ký thành công!" : "Đăng nhập thành công!", 3000);
        onClose();
      } else {
        toast.info(result.message || "Vui lòng kiểm tra email xác nhận rồi đăng nhập.", 7000);
        setMode("login");
      }
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Có lỗi xảy ra. Vui lòng thử lại.", 5000);
    }
  };

  return (
    <Dialog
      open={open} onClose={handleClose} maxWidth={false}
      aria-labelledby="login-title" aria-describedby="login-description"
      slotProps={{
        backdrop: { className: "bg-[rgba(25,22,30,0.48)] backdrop-blur-sm" },
        paper: {
          component: "form", onSubmit: handleSubmit, "aria-busy": loading,
          className: "relative m-4 box-border w-[428px] max-w-[calc(100vw-32px)] rounded-[26px] bg-white bg-none px-6 pt-[38px] pb-[46px] text-[#353535] shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:px-[42px]",
        },
      }}
    >
      <IconButton type="button" className="absolute top-3.5 right-3.5 size-7 p-1 text-[#888]" onClick={handleClose} disabled={loading} aria-label="Close">
        <CloseRoundedIcon className="size-5" />
      </IconButton>
      <Typography component="h2" id="login-title" className="m-0 text-center text-[25px] leading-8 font-bold tracking-[-0.5px] text-[#353535]">{title}</Typography>
      <Typography component="p" id="login-description" className="mx-auto mt-4 mb-9 max-w-68.75 text-center text-sm leading-5 text-[#555]">
        {isRegister ? "Enter your details to create your account" : "Hey, Enter your details to get sign in to your account"}
      </Typography>

      <Box className="flex flex-col gap-3">
        <TextField
          placeholder="Enter your email" type="email" required autoFocus fullWidth variant="outlined"
          value={email} onChange={(event) => setEmail(event.target.value)}
          autoComplete="email" disabled={loading}
          slotProps={{
            htmlInput: { "aria-label": "Email", className: htmlInputClassName },
            input: {
              className: inputClassName,
              endAdornment: (
                <InputAdornment position="end" className="ml-2.5 text-[#999]">
                  <AccountCircleOutlinedIcon className="size-5" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          placeholder="Password" type={showPassword ? "text" : "password"} required fullWidth variant="outlined"
          value={password} onChange={(event) => setPassword(event.target.value)}
          autoComplete={isRegister ? "new-password" : "current-password"}
          disabled={loading}
          slotProps={{
            htmlInput: {
              "aria-label": "Password", className: htmlInputClassName,
              minLength: isRegister ? 8 : undefined,
              "aria-describedby": isRegister ? "password-hint" : undefined,
            },
            input: {
              className: inputClassName,
              endAdornment: (
                <InputAdornment position="end" className="ml-2.5">
                  <IconButton
                    type="button" className="size-7 p-1 text-[#888]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword} disabled={loading}
                    onClick={() => setShowPassword((value) => !value)}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {showPassword ? <VisibilityOffOutlinedIcon className="size-5" /> : <VisibilityOutlinedIcon className="size-5" />}
                  </IconButton>
                  </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {isRegister ? (
        <Typography component="p" id="password-hint" className="mt-2 mb-4 text-xs leading-5 text-[#777]">At least 8 characters</Typography>
      ) : (
        <Typography component="p" className="my-4 text-[15px] leading-5.25 font-semibold text-[#353535]">Having trouble in sign in?</Typography>
      )}

      <Button
        type="submit" variant="contained" fullWidth disableElevation
        className="m-0 min-h-10 rounded-[7px] bg-[#805a9b] px-4 py-2.5 text-[13px] leading-5 font-semibold text-white normal-case transition-colors hover:bg-[#6e4889] disabled:bg-[#b39bc4] disabled:text-white"
        disabled={loading}
        aria-label={actionLabel} aria-busy={loading}
      >
        {loading ? <CircularProgress size={20} color="inherit" aria-label="Đang xử lý" /> : actionLabel}
      </Button>

      <Typography component="p" className="mt-12 mb-0 text-center text-xs leading-5 text-[#666]">
        {isRegister ? "Already have an account? " : "Don't have an account? "}
        <Button
          type="button" className="m-0 inline min-w-0 p-0 align-baseline text-xs leading-5 font-bold text-[#555] normal-case hover:bg-transparent hover:text-[#805a9b]" disabled={loading}
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setPassword("");
            setShowPassword(false);
            clearFeedback();
          }}
        >
          {isRegister ? "Sign in" : "Request Now"}
        </Button>
      </Typography>
    </Dialog>
  );
}
