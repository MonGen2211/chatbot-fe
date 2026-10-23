import { Button } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <Button variant="contained" endIcon={<SendIcon />}>
        Gửi tin nhắn
      </Button>
    </div>
  );
}