// Recherche globale : joueurs, équipes, rencontres, séances, exercices, notes, playbook, routines. Accessible de partout (loupe en haut).
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI;
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let box = null;

  async function index() {
    const [teams, ts, players, mem, events, sessions, ex, notes, pb, routines] = await Promise.all(
      ["teams", "team_seasons", "players", "memberships", "events", "sessions", "exercises", "notes", "playbook_entries", "routines"].map(t => DB.live(t).catch(() => [])));
    const T = Object.fromEntries(teams.map(t => [t.id, t.name])), TS = Object.fromEntries(ts.map(x => [x.id, T[x.team_id] || ""]));
    const out = [];
    for (const x of ts) if (T[x.team_id]) out.push({ g: "Équipes", t: T[x.team_id], s: "", go: { name: "team", id: x.id } });
    for (const m of mem) { const p = players.find(q => q.id === m.player_id); if (p && TS[m.team_season_id]) out.push({ g: "Joueurs", t: [p.first_name, p.last_name].filter(Boolean).join(" "), s: TS[m.team_season_id], go: { name: "player", tsId: m.team_season_id, mId: m.id } }); }
    for (const e of events) { const d = e.starts_at ? new Date(e.starts_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""; out.push({ g: "Rencontres", t: (TS[e.team_season_id] || "") + (e.opponent ? " — " + e.opponent : e.title ? " — " + e.title : ""), s: d, go: { name: "event", id: e.id } }); }
    for (const s of sessions) out.push({ g: "Séances", t: s.title || "Séance", s: TS[s.team_season_id] || "", go: { name: "session", id: s.id } });
    for (const e of ex) out.push({ g: "Exercices", t: e.title, s: "", go: { name: "library" } });
    for (const n of notes) out.push({ g: "Notes", t: n.title || "Note", s: "", go: { name: "note", id: n.id } });
    for (const p of pb) out.push({ g: "Playbook", t: p.title, s: TS[p.team_season_id] || "", go: { name: "playEntry", id: p.id } });
    for (const r of routines) out.push({ g: "Routines", t: r.name || r.title || "Routine", s: r.team_season_id ? TS[r.team_season_id] || "" : "Toutes équipes", go: { name: "routine", id: r.id, tsId: r.team_season_id || null } });
    return out.filter(x => x.t);
  }

  async function open() {
    if (box) return close();
    const data = await index();
    const list = h("div", { class: "srlist" });
    const inp = h("input", { type: "search", placeholder: "Joueur, équipe, adversaire, exercice, séance…", "aria-label": "Rechercher", autocomplete: "off" });
    const draw = () => {
      const q = norm(inp.value).trim(); list.replaceChildren();
      if (!q) { list.append(h("p", { class: "sub" }, "Tape un nom : joueur, équipe, adversaire, exercice, séance, note, système, routine.")); return; }
      const hit = data.filter(x => norm(x.t + " " + x.s).includes(q)).slice(0, 40);
      if (!hit.length) { list.append(h("p", { class: "sub" }, "Aucun résultat pour « " + inp.value.trim() + " ».")); return; }
      let g = null;
      for (const x of hit) { if (x.g !== g) { g = x.g; list.append(h("div", { class: "srg" }, g)); }
        list.append(h("button", { class: "item btnitem", onclick: () => { close(); U().setView(x.go); } }, h("div", { style: "flex:1;min-width:0" }, h("strong", {}, x.t), x.s ? h("div", { class: "sub" }, x.s) : null))); }
    };
    inp.addEventListener("input", draw); draw();
    box = h("div", { id: "searchbox", role: "dialog", "aria-label": "Recherche" },
      h("div", { class: "srpanel" }, h("div", { class: "srtop" }, inp, h("button", { class: "ghost small", onclick: close }, "Fermer")), list));
    box.addEventListener("click", e => { if (e.target === box) close(); });
    document.body.append(box); inp.focus();
  }
  function close() { if (box) { box.remove(); box = null; } }
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); } });
  const b = document.getElementById("searchbtn"); if (b) b.addEventListener("click", open);
  window.Search = { open, close };
})();
