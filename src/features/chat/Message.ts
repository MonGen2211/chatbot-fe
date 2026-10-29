export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "completed" | "streaming" | "interrupted" | "failed";
}
