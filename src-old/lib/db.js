// ── IndexedDB service for chess game persistence ─────────────────────────────

const DB_NAME = "chess-games-db";
const DB_VERSION = 1;
const STORE_NAME = "games";
const AUTOSAVE_ID = "autosave";

/**
 *
 */
const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });

/**
 *
 */
const databasePut = (record) =>
  openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );

/**
 *
 */
const databaseGet = (id) =>
  openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      }),
  );

/**
 *
 */
const databaseGetAll = () =>
  openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );

/**
 *
 */
const databaseDelete = (id) =>
  openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );

// ── Public API ─────────────────────────────────────────────────────────────

/** Silently upsert the rolling auto-save record. */
export const autoSave = (gameData) =>
  databasePut({
    ...gameData,
    id: AUTOSAVE_ID,
    timestamp: Date.now(),
    isAutosave: true,
  });

/** Load the auto-save record (or null if none). */
export const loadAutoSave = () => databaseGet(AUTOSAVE_ID);

/**
 * Save the current game with a user-visible name.
 * Returns the generated id.
 */
export const saveGame = (gameData) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return databasePut({
    ...gameData,
    id,
    timestamp: Date.now(),
    isAutosave: false,
  }).then(() => id);
};

/** List all manually saved games, newest first. */
export const listGames = () =>
  databaseGetAll().then((all) =>
    all
      .filter((g) => g.id !== AUTOSAVE_ID)
      .sort((a, b) => b.timestamp - a.timestamp),
  );

/** Delete a saved game by id. */
export const deleteGame = (id) => databaseDelete(id);
