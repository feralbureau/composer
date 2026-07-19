import { create } from "zustand";

// -- Types --------------------------------------------------------------------

interface ComposerReturnState {
  returnApi: string | null;
  armor: string | null;
}

interface ComposerReturnActions {
  setReturnConfig: (config: { returnApi?: string; armor?: string }) => void;
  clear: () => void;
}

type ComposerReturnStore = ComposerReturnState & ComposerReturnActions;

// -- Store --------------------------------------------------------------------

const useComposerReturnStore = create<ComposerReturnStore>((set) => ({
  returnApi: null,
  armor: null,

  setReturnConfig: (config) =>
    set((state) => ({
      returnApi: config.returnApi ?? state.returnApi,
      armor: config.armor ?? state.armor,
    })),

  clear: () => set({ returnApi: null, armor: null }),
}));

// -- Exports ------------------------------------------------------------------

export { useComposerReturnStore };
