import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface UiState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const uiStore = create<UiState>()(
  devtools((set) => ({
    sidebarOpen: false,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  })),
);

