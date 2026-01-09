import { create } from 'zustand';

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: UpdateServiceWorker | null;
  setNeedRefresh: (needRefresh: boolean) => void;
  setOfflineReady: (offlineReady: boolean) => void;
  setUpdateServiceWorker: (updateServiceWorker: UpdateServiceWorker) => void;
  dismissUpdate: () => void;
}

export const usePwaUpdateStore = create<PwaUpdateState>((set) => ({
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: null,
  setNeedRefresh: (needRefresh) => set({ needRefresh }),
  setOfflineReady: (offlineReady) => set({ offlineReady }),
  setUpdateServiceWorker: (updateServiceWorker) => set({ updateServiceWorker }),
  dismissUpdate: () => set({ needRefresh: false }),
}));

