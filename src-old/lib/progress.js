// ── IndexedDB service for training progress tracking ──────────────────────────

const PROGRESS_DB_NAME = "chess-progress-db";
const PROGRESS_DB_VERSION = 1;
const PROGRESS_STORE_NAME = "progress";

const openProgressDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(PROGRESS_DB_NAME, PROGRESS_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(PROGRESS_STORE_NAME)) {
        const store = database.createObjectStore(PROGRESS_STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("solved", "solved", { unique: false });
      }
    };
  });

const progressPut = (record) =>
  openProgressDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(PROGRESS_STORE_NAME, "readwrite");
        const request = tx.objectStore(PROGRESS_STORE_NAME).put(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );

const progressGet = (id) =>
  openProgressDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(PROGRESS_STORE_NAME, "readonly");
        const request = tx.objectStore(PROGRESS_STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      }),
  );

const progressGetAll = () =>
  openProgressDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(PROGRESS_STORE_NAME, "readonly");
        const request = tx.objectStore(PROGRESS_STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      }),
  );

// ── Public API ─────────────────────────────────────────────────────────────

export const TYPE_TUTORIAL = "tutorial";
export const TYPE_PUZZLE = "puzzle";
export const TYPE_QUIZ = "quiz";
export const TYPE_OPENING = "opening";

export const markSolved = async (id, type) => {
  await progressPut({
    id: `${type}_${id}`,
    type,
    itemId: id,
    solved: true,
    solvedAt: Date.now(),
  });
};

export const markUnsolved = async (id, type) => {
  await progressPut({
    id: `${type}_${id}`,
    type,
    itemId: id,
    solved: false,
    solvedAt: null,
  });
};

export const getProgress = async (id, type) => {
  return progressGet(`${type}_${id}`);
};

export const getAllProgress = async () => {
  return progressGetAll();
};

export const getSolvedItems = async (type) => {
  const all = await progressGetAll();
  return all.filter((p) => p.type === type && p.solved);
};

export const isSolved = async (id, type) => {
  const progress = await getProgress(id, type);
  return progress?.solved ?? false;
};

export const clearProgress = async () => {
  const database = await openProgressDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROGRESS_STORE_NAME, "readwrite");
    const request = tx.objectStore(PROGRESS_STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
