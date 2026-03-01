import { create } from "zustand";
import { saveGame, listGames, deleteGame } from "@/lib/db";

const useGameStore = create((set, get) => ({
  savedGames: [],

  /** Reload the saved games list from IndexedDB into the store. */
  fetchSavedGames: async () => {
    const games = await listGames();
    set({ savedGames: games });
  },

  /**
   * Save the current game snapshot with a given name.
   * Refreshes the list afterwards and returns the new id.
   */
  saveCurrentGame: async (gameData) => {
    const id = await saveGame(gameData);
    await get().fetchSavedGames();
    return id;
  },

  /**
   * Delete a saved game by id and refresh the list.
   */
  deleteSavedGame: async (id) => {
    await deleteGame(id);
    await get().fetchSavedGames();
  },
}));

export default useGameStore;
