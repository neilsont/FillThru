import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIModel } from "@/lib/ai/types";
import { DEFAULT_MODEL, normalizeModel } from "@/lib/ai/types";

interface AIState {
  selectedModel: AIModel;
  setModel: (model: AIModel) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      selectedModel: DEFAULT_MODEL,
      setModel: (model) => set({ selectedModel: model }),
    }),
    {
      name: "careerlaunch-ai",
      version: 2,
      // Retired model ids linger in localStorage — snap them to a live one.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<AIState>;
        return { ...state, selectedModel: normalizeModel(state.selectedModel) };
      },
    }
  )
);
