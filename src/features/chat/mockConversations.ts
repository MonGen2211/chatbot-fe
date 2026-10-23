import type { Conversation } from "./Conservation";

export const mockConversations: Conversation[] = [
  {
    id: "conversation-1",
    title: "React useState",
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Giải thích useState trong React giúp mình với.",
        createdAt: "2026-10-15T10:00:00.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content:
          "useState là một Hook giúp component lưu và cập nhật dữ liệu. Khi state thay đổi, React sẽ render lại component.",
        createdAt: "2026-10-15T10:00:05.000Z",
      },
      {
        id: "message-3",
        role: "user",
        content: "Cho mình ví dụ ngắn được không?",
        createdAt: "2026-10-15T10:01:00.000Z",
      },
      {
        id: "message-4",
        role: "assistant",
        content:
          "Ví dụ: const [count, setCount] = useState(0). Gọi setCount(count + 1) để tăng count lên 1.",
        createdAt: "2026-10-15T10:01:05.000Z",
      },
    ],
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-10-15T10:01:05.000Z",
  },
];
