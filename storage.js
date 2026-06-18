(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_STORAGE = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const RUNTIME_STORAGE_KEY = "bnbflow-runtime-v1";
  const RUNTIME_SCHEMA_VERSION = 1;

  class RuntimeStore {
    constructor(storage, key = RUNTIME_STORAGE_KEY) {
      this.storage = storage;
      this.key = key;
    }

    load() {
      try {
        const raw = this.storage?.getItem(this.key);
        if (!raw) return null;
        const snapshot = JSON.parse(raw);
        if (snapshot.schemaVersion !== RUNTIME_SCHEMA_VERSION) return this.migrate(snapshot);
        return snapshot;
      } catch (error) {
        return null;
      }
    }

    save(data) {
      const snapshot = {
        schemaVersion: RUNTIME_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        data: structuredClone(data),
      };
      this.storage?.setItem(this.key, JSON.stringify(snapshot));
      return snapshot;
    }

    clear() {
      this.storage?.removeItem(this.key);
    }

    migrate(snapshot) {
      if (snapshot?.version === 1 && snapshot.run) {
        return { schemaVersion: 1, savedAt: snapshot.savedAt || new Date().toISOString(), data: snapshot };
      }
      return null;
    }
  }

  return { RuntimeStore, RUNTIME_STORAGE_KEY, RUNTIME_SCHEMA_VERSION };
});
