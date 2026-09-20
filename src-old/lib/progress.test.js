import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearProgress,
  getAllProgress,
  getProgress,
  getSolvedItems,
  isSolved,
  markSolved,
  markUnsolved,
  TYPE_OPENING,
  TYPE_PUZZLE,
  TYPE_QUIZ,
} from "@/lib/progress";

const createRequest = () => ({
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
});

const createFakeIndexedDB = () => {
  const stores = new Map();

  const getStore = (name) => {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }

    return stores.get(name);
  };

  const database = {
    objectStoreNames: {
      contains: (name) => stores.has(name),
    },
    createObjectStore: (name) => {
      getStore(name);
      return { createIndex: vi.fn() };
    },
    transaction: (name) => {
      const store = getStore(name);

      return {
        objectStore: () => ({
          put: (record) => {
            const request = createRequest();
            queueMicrotask(() => {
              store.set(record.id, { ...record });
              request.result = record.id;
              request.onsuccess?.();
            });
            return request;
          },
          get: (id) => {
            const request = createRequest();
            queueMicrotask(() => {
              request.result = store.get(id) ?? undefined;
              request.onsuccess?.();
            });
            return request;
          },
          getAll: () => {
            const request = createRequest();
            queueMicrotask(() => {
              request.result = [...store.values()];
              request.onsuccess?.();
            });
            return request;
          },
          clear: () => {
            const request = createRequest();
            queueMicrotask(() => {
              store.clear();
              request.onsuccess?.();
            });
            return request;
          },
        }),
      };
    },
  };

  return {
    open: vi.fn(() => {
      const request = createRequest();
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.({ target: { result: database } });
        request.onsuccess?.();
      });
      return request;
    }),
  };
};

describe("progress helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", createFakeIndexedDB());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and reads progress records", async () => {
    await markSolved("p1", TYPE_PUZZLE);
    await markUnsolved("q1", TYPE_QUIZ);

    expect(await isSolved("p1", TYPE_PUZZLE)).toBe(true);
    expect(await isSolved("q1", TYPE_QUIZ)).toBe(false);
    expect(await getProgress("p1", TYPE_PUZZLE)).toMatchObject({
      id: `${TYPE_PUZZLE}_p1`,
      type: TYPE_PUZZLE,
      itemId: "p1",
      solved: true,
    });
  });

  it("filters solved items and clears stored progress", async () => {
    await markSolved("t1", TYPE_OPENING);
    await markSolved("p2", TYPE_PUZZLE);
    await markUnsolved("q2", TYPE_QUIZ);

    expect(await getSolvedItems(TYPE_OPENING)).toHaveLength(1);
    expect(await getSolvedItems(TYPE_PUZZLE)).toHaveLength(1);
    expect(await getSolvedItems(TYPE_QUIZ)).toHaveLength(0);

    expect(await getAllProgress()).toHaveLength(3);

    await clearProgress();

    expect(await getAllProgress()).toEqual([]);
  });
});
