import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2979ea" },
        background: { default: "#ffffff", paper: "#ffffff" },
        text: { primary: "#1a2230", secondary: "#6b7a90" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#4d94ff" },
        background: { default: "#0f1520", paper: "#161e2b" },
        text: { primary: "#e6ebf2", secondary: "#93a1b5" },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: { borderRadius: 10 },
});