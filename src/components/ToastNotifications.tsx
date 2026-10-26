import { useColorScheme } from "@mui/material/styles";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ToastNotifications() {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;

  return (
    <ToastContainer
      position="top-right"
      theme={resolvedMode === "dark" ? "dark" : "light"}
      autoClose={4000}
      closeOnClick
      pauseOnHover
      pauseOnFocusLoss
      newestOnTop
      limit={3}
      style={{ zIndex: 1500 }}
    />
  );
}
