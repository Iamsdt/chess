// ── IndexedDB service for chess game persistence ─────────────────────────────

const DB_NAME = "chess-games-db";
const DB_VERSION = 1;
const STORE_NAME = "games";
const AUTOSAVE_ID = "autosave";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

function dbPut(record) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).put(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function dbGet(id) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function dbGetAll() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function dbDelete(id) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Silently upsert the rolling auto-save record. */
export function autoSave(gameData) {
  return dbPut({
    ...gameData,
    id: AUTOSAVE_ID,
    timestamp: Date.now(),
    isAutosave: true,
  });
}

/** Load the auto-save record (or null if none). */
export function loadAutoSave() {
  return dbGet(AUTOSAVE_ID);
}

/**
 * Save the current game with a user-visible name.
 * Returns the generated id.
 */
export function saveGame(gameData) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return dbPut({ ...gameData, id, timestamp: Date.now(), isAutosave: false }).then(
    () => id
  );
}

/** List all manually saved games, newest first. */
export function listGames() {
  return dbGetAll().then((all) =>
    all
      .filter((g) => g.id !== AUTOSAVE_ID)
      .sort((a, b) => b.timestamp - a.timestamp)
  );
}

/** Delete a saved game by id. */
export function deleteGame(id) {
  return dbDelete(id);
}
