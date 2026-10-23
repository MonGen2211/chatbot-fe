import axios from "axios";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface GeminiTextBlock {
  type: string;
  text?: string;
}

interface GeminiStep {
  type: string;
  content?: GeminiTextBlock[];
}

interface GeminiResponse {
  id: string;
  steps?: GeminiStep[];
}

export interface GeminiChatResult {
  answer: string;
  interactionId: string;
}

export async function sendMessageToGemini(
  userText: string,
  previousInteractionId?: string,
): Promise<GeminiChatResult> {
  if (!API_KEY) {
    throw new Error("Thiếu VITE_GEMINI_API_KEY trong file .env.local");
  }

  const response = await axios.post<GeminiResponse>(
    API_URL,
    {
      model: "gemini-3.1-flash-lite",
      input: userText,
      ...(previousInteractionId && {
        previous_interaction_id: previousInteractionId,
      }),
    },
    {
      headers: {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    },
  );

  const answer = response.data.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!answer || !response.data.id) {
    throw new Error("Gemini không trả về câu trả lời hoặc interaction ID.");
  }

  return {
    answer,
    interactionId: response.data.id,
  };
}