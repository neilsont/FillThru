import { create } from "zustand";

interface KanbanState {
  draggedJobId: string | null;
  setDraggedJobId: (id: string | null) => void;
}

export const useKanbanStore = create<KanbanState>()((set) => ({
  draggedJobId: null,
  setDraggedJobId: (id) => set({ draggedJobId: id }),
}));
