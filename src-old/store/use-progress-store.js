import { create } from "zustand";

import {
  TYPE_TUTORIAL,
  TYPE_PUZZLE,
  TYPE_QUIZ,
  TYPE_OPENING,
  getAllProgress,
  markSolved,
  markUnsolved,
  clearProgress as clearAllProgress,
} from "@/lib/progress";

const useProgressStore = create((set, get) => ({
  progress: {},
  isLoading: true,

  fetchProgress: async () => {
    set({ isLoading: true });
    try {
      const allProgress = await getAllProgress();
      const progressMap = {};
      for (const p of allProgress) {
        progressMap[`${p.type}_${p.itemId}`] = p;
      }
      set({ progress: progressMap, isLoading: false });
    } catch (error) {
      console.error("Failed to load progress:", error);
      set({ isLoading: false });
    }
  },

  solveItem: async (id, type) => {
    try {
      await markSolved(id, type);
      const key = `${type}_${id}`;
      set((state) => ({
        progress: {
          ...state.progress,
          [key]: { itemId: id, type, solved: true, solvedAt: Date.now() },
        },
      }));
    } catch (error) {
      console.error("Failed to mark solved:", error);
    }
  },

  unsolveItem: async (id, type) => {
    try {
      await markUnsolved(id, type);
      const key = `${type}_${id}`;
      set((state) => ({
        progress: {
          ...state.progress,
          [key]: { itemId: id, type, solved: false, solvedAt: null },
        },
      }));
    } catch (error) {
      console.error("Failed to mark unsolved:", error);
    }
  },

  isSolved: (id, type) => {
    const key = `${type}_${id}`;
    return get().progress[key]?.solved ?? false;
  },

  getSolvedCount: (type) => {
    const { progress } = get();
    return Object.values(progress).filter((p) => p.type === type && p.solved)
      .length;
  },

  getProgressStats: () => {
    const { progress } = get();
    const stats = {
      [TYPE_TUTORIAL]: { solved: 0, total: 0 },
      [TYPE_PUZZLE]: { solved: 0, total: 0 },
      [TYPE_QUIZ]: { solved: 0, total: 0 },
      [TYPE_OPENING]: { solved: 0, total: 0 },
    };

    for (const p of Object.values(progress)) {
      if (stats[p.type] && p.solved) {
        stats[p.type].solved++;
      }
    }
    return stats;
  },

  clearAll: async () => {
    try {
      await clearAllProgress();
      set({ progress: {} });
    } catch (error) {
      console.error("Failed to clear progress:", error);
    }
  },
}));

export default useProgressStore;
