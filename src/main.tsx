import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import "./index.css";
import { ChatLayout } from "./features/chat/components/ChatLayout";
import { theme } from "./theme";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { ToastNotifications } from "./components/ToastNotifications";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StyledEngineProvider enableCssLayer>
      <ThemeProvider theme={theme}>
        <Provider store={store}>
          <ChatLayout />
          <ToastNotifications />
        </Provider>
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
);
