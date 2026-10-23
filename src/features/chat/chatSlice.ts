import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Message } from "./Message";
import { mockConversations } from "./mockConversations";
import type { Conversation } from "./Conservation";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
}

const initialState: ChatState = {
  conversations: mockConversations,
  activeId: mockConversations[0]?.id ?? null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    clearActiveConversation(state) {
      state.activeId = null;
    },
    selectConversation(state, action: PayloadAction<string>) {
      state.activeId = action.payload;
    },
    setConversationInteractionId(
      state,
      action: PayloadAction<{
        conversationId: string;
        interactionId: string;
      }>,
    ) {
      const conversation = state.conversations.find(
        (item) => item.id === action.payload.conversationId,
      );

      if (!conversation) return;

      conversation.lastInteractionId = action.payload.interactionId;
    },

    createConversation(state, action: PayloadAction<Conversation>) {
      state.conversations.unshift(action.payload);
      state.activeId = action.payload.id;
    },

    addMessage(
      state,
      action: PayloadAction<{ conversationId: string; message: Message }>,
    ) {
      const conversation = state.conversations.find(
        (item) => item.id === action.payload.conversationId,
      );

      if (!conversation) return;

      conversation.messages.push(action.payload.message);
      conversation.updatedAt = action.payload.message.createdAt;
    },
  },
});

export const {
  clearActiveConversation,
  selectConversation,
  setConversationInteractionId,
  createConversation,
  addMessage,
} = chatSlice.actions;

export default chatSlice.reducer;
