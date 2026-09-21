import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIModel } from "@/lib/ai/types";
import { CHAT_DEFAULT_MODEL, DEFAULT_MODEL, normalizeModel } from "@/lib/ai/types";

interface AIState {
  /** Model for structured generation: résumé parsing, answers, cover letters. */
  selectedModel: AIModel;
  setModel: (model: AIModel) => void;
  /** Model for the website chat, where responsiveness matters most. */
  chatModel: AIModel;
  setChatModel: (model: AIModel) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      selectedModel: DEFAULT_MODEL,
      setModel: (model) => set({ selectedModel: model }),
      chatModel: CHAT_DEFAULT_MODEL,
      setChatModel: (model) => set({ chatModel: model }),
    }),
    {
      name: "careerlaunch-ai",
      version: 3,
      // Retired model ids linger in localStorage — snap them to a live one.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<AIState>;
        return {
          ...state,
          selectedModel: normalizeModel(state.selectedModel),
          chatModel: state.chatModel ? normalizeModel(state.chatModel) : CHAT_DEFAULT_MODEL,
        };
      },
    }
  )
);
