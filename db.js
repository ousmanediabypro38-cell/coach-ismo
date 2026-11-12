// Copie locale (IndexedDB) : l'application lit et écrit ici, la synchronisation se fait à part.
(function () {
  const STORES = ["teams", "seasons", "team_seasons", "players", "memberships", "events", "exercises", "sessions", "session_blocks", "session_attendance"];
  let dbp;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open("coach-ismo", 4);
      r.onupgradeneeded = () => {
        const d = r.result;
        // Création des tables manquantes seulement : les données déjà présentes (phase 1A) sont conservées.
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "k" });
        if (!d.objectStoreNames.contains("conflicts")) d.createObjectStore("conflicts", { keyPath: "key" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function st(name, mode) { const d = await open(); return d.transaction(name, mode).objectStore(name); }

  const DB = {
    STORES,
    onchange: null,
    uuid() { return crypto.randomUUID(); },
    async all(name) { return rq((await st(name, "readonly")).getAll()); },
    async live(name) { return (await DB.all(name)).filter(r => !r.deleted_at); },
    async get(name, id) { return rq((await st(name, "readonly")).get(id)); },
    // Écriture faite par l'utilisateur : la ligne devient « en attente d'envoi ».
    async save(name, row) {
      row.id = row.id || DB.uuid();
      row._dirty = 1; row._rev = (row._rev || 0) + 1;
      row.updated_at_local = new Date().toISOString();
      await rq((await st(name, "readwrite")).put(row));
      if (DB.onchange) DB.onchange();
      return row;
    },
    async remove(name, row) { row.deleted_at = new Date().toISOString(); return DB.save(name, row); },
    // Ligne reçue du serveur : propre, rien à renvoyer.
    async putClean(name, row) {
      row._dirty = 0; row._base = row.updated_at;
      const old = await DB.get(name, row.id); row._rev = old ? old._rev || 0 : 0;
      await rq((await st(name, "readwrite")).put(row));
    },
    async raw(name, row) { await rq((await st(name, "readwrite")).put(row)); },
    async dirty(name) { return (await DB.all(name)).filter(r => r._dirty); },
    async getMeta(k) { const r = await rq((await st("meta", "readonly")).get(k)); return r ? r.v : null; },
    async setMeta(k, v) { await rq((await st("meta", "readwrite")).put({ k, v })); },
    async conflicts() { return rq((await st("conflicts", "readonly")).getAll()); },
    async addConflict(c) { await rq((await st("conflicts", "readwrite")).put(c)); },
    async delConflict(key) { await rq((await st("conflicts", "readwrite")).delete(key)); },
    async countDirty() { let n = 0; for (const s of STORES) n += (await DB.dirty(s)).length; return n; },
    async wipe() { for (const s of [...STORES, "meta", "conflicts"]) await rq((await st(s, "readwrite")).clear()); }
  };
  window.DB = DB;
})();
