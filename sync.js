// Synchronisation : d'abord on récupère les changements du serveur, ensuite on envoie les nôtres.
// Si une ligne a été modifiée des deux côtés, elle n'est PAS écrasée : elle va dans l'écran de conflits.
(function () {
  const ORDER = ["teams", "clubs", "seasons", "team_seasons", "players", "memberships", "venues", "events", "match_stints", "match_availability", "player_entries", "player_goals", "exercises", "playbook_entries", "playbook_diagrams", "sessions", "session_blocks", "session_attendance", "notes"]; // respecte les liens entre tables
  const LOCAL_ONLY = ["_dirty", "_rev", "_base", "updated_at_local", "updated_at", "created_at"]; // updated_at et created_at sont posés par le serveur (un created_at absent d'une ligne d'un lot serait envoyé « null »)
  let running = false;

  async function pull(sb) {
    let pulled = 0;
    for (const t of ORDER) {
      let since = (await DB.getMeta("pull_" + t)) || "1970-01-01T00:00:00Z";
      for (;;) {
        const { data, error } = await sb.from(t).select("*").gt("updated_at", since).order("updated_at").limit(1000);
        if (error) throw error;
        if (!data.length) break;
        for (const srv of data) {
          const loc = await DB.get(t, srv.id);
          if (!loc || !loc._dirty) await DB.putClean(t, srv);
          else if (srv.updated_at > (loc._base || "")) await DB.addConflict({ key: t + ":" + srv.id, table: t, id: srv.id, server: srv });
          pulled++;
          since = srv.updated_at;
        }
        await DB.setMeta("pull_" + t, since);
        if (data.length < 1000) break;
      }
    }
    return pulled;
  }

  async function push(sb, uid) {
    const confl = new Set((await DB.conflicts()).map(c => c.key));
    let pushed = 0;
    for (const t of ORDER) {
      const rows = (await DB.dirty(t)).filter(r => !confl.has(t + ":" + r.id));
      if (!rows.length) continue;
      const payload = rows.map(r => {
        const p = { ...r };
        LOCAL_ONLY.forEach(k => delete p[k]);
        p.owner_id = p.owner_id || uid;
        return p;
      });
      const { data, error } = await sb.from(t).upsert(payload, { onConflict: "id" }).select();
      if (error) throw error;
      for (const srv of data) {
        const sent = rows.find(r => r.id === srv.id);
        const now = await DB.get(t, srv.id);
        if (now && sent && now._rev === sent._rev) await DB.putClean(t, srv);   // inchangée pendant l'envoi
        else if (now) { now._base = srv.updated_at; await DB.raw(t, now); }      // modifiée entre-temps : reste en attente
        pushed++;
      }
    }
    return pushed;
  }

  window.Sync = {
    async run(sb, uid) {
      if (running) return { skipped: true };
      running = true;
      try {
        const pulled = await pull(sb);
        const pushed = await push(sb, uid);
        await DB.setMeta("last_sync", new Date().toISOString());
        return { pulled, pushed };
      } finally { running = false; }
    },
    // Résolution d'un conflit : "mine" garde ma version, "server" prend celle du serveur.
    async resolve(c, choice) {
      if (choice === "server") await DB.putClean(c.table, c.server);
      else { const l = await DB.get(c.table, c.id); l._base = c.server.updated_at; l._dirty = 1; await DB.raw(c.table, l); }
      await DB.delConflict(c.key);
    }
  };
})();
