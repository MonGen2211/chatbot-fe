export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "pending" | "completed" | "streaming" | "interrupted" | "failed";
  isEdited?: boolean;
  persisted?: boolean;
}
