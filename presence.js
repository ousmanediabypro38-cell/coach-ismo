// Appel d'une séance : confirmation dans une fenêtre flottante, et saisie des présents par liste de prénoms (création des joueurs inconnus).
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a);
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  function dist(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
  async function attId(sid, pid) {
    try { const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(sid + ":" + pid)); const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32); } catch (e) { return DB.uuid(); }
  }
  const full = p => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Joueur";
  const split = txt => txt.split(/[\n,;]+/).map(x => x.replace(/^[\s\-•*\d.)]+/, "").trim()).filter(Boolean);

  function match(name, roster) {
    const n = norm(name); if (!n) return null;
    let r = roster.filter(p => norm(full(p)) === n || norm(p.first_name) === n); if (r.length === 1) return r[0];
    if (r.length > 1) return null;
    const w = n.split(" "), first = w[0], rest = w.slice(1).join(" ");
    if (rest) { r = roster.filter(p => norm(p.first_name) === first && (norm(p.last_name).startsWith(rest.charAt(0)) )); if (r.length === 1) return r[0]; }
    r = roster.filter(p => dist(norm(p.first_name), first) <= (first.length > 4 ? 1 : 0) && (!rest || !p.last_name || norm(p.last_name).startsWith(rest.charAt(0)))); if (r.length === 1) return r[0];
    r = roster.filter(p => norm(p.first_name).startsWith(n) && n.length >= 3); if (r.length === 1) return r[0];
    return null;
  }

  async function sha(key) { const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key)); const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32); }
  // Configuration « match » : disponibilités (match_availability) au lieu des présences de séance.
  const matchCfg = e => ({ kind: "match", tsId: e.team_season_id, async data() {
    const [mem, pl, av] = await Promise.all([DB.live("memberships"), DB.live("players"), DB.live("match_availability")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    const roster = mem.filter(m => m.team_season_id === e.team_season_id && P[m.player_id]).map(m => P[m.player_id]).sort((a, b) => full(a).localeCompare(full(b)));
    const mine = Object.fromEntries(av.filter(a => a.event_id === e.id && !a.deleted_at).map(a => [a.player_id, a]));
    return { roster, mine, all: pl.filter(p => !p.deleted_at) };
  }, async mark(pid, status) {
    const id = await sha("avail:" + e.id + ":" + pid), old = await DB.get("match_availability", id);
    await DB.save("match_availability", { ...(old || {}), id, event_id: e.id, player_id: pid, status, convoked: status === "present", source: "coach", answered_at: new Date().toISOString(), deleted_at: null });
  }, ST: { present: "Présents (convoqués)", peut_etre: "Peut-être", absent: "Absents" }, label: "match" });
  const sessCfg = s => ({ kind: "seance", tsId: s.team_season_id, data: () => data(s), mark: (pid, status) => mark(s, pid, status), ST: { present: "Présents", absent: "Absents", blesse: "Blessés" }, label: "séance" });

  async function data(s) {
    const [mem, pl, att] = await Promise.all([DB.live("memberships"), DB.live("players"), DB.live("session_attendance")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    const roster = mem.filter(m => m.team_season_id === s.team_season_id && P[m.player_id]).map(m => P[m.player_id]).sort((a, b) => full(a).localeCompare(full(b)));
    const mine = Object.fromEntries(att.filter(a => a.session_id === s.id).map(a => [a.player_id, a]));
    return { roster, mine, all: pl.filter(p => !p.deleted_at) };
  }
  async function mark(s, pid, status) {
    const id = await attId(s.id, pid), cur = (await DB.get("session_attendance", id)) || { id, session_id: s.id, player_id: pid, group_label: null };
    await DB.save("session_attendance", { ...cur, status, group_label: status === "present" ? cur.group_label || null : null });
  }

  // ---- 1) Confirmation de l'appel ----
  async function confirm(x, done) {
    const cfg = typeof x.data === "function" ? x : sessCfg(x);
    const { roster, mine } = await cfg.data();
    const st = p => mine[p.id] ? mine[p.id].status : null;
    const g = k => roster.filter(p => st(p) === k), none = roster.filter(p => !st(p));
    const fillAbs = h("input", { type: "checkbox", checked: true });
    const list = (title, arr, cls) => arr.length ? h("div", { class: "mgrp " + (cls || "") }, h("b", {}, title + " (" + arr.length + ")"), h("span", {}, arr.map(full).join(", "))) : null;
    const body = h("div", {}, h("p", { class: "sub" }, "Vérifie que c'est bien la bonne liste avant de valider."),
      Object.entries(cfg.ST).map(([k, l]) => list(l, g(k), k === "present" ? "ok" : "")),
      none.length ? h("div", { class: "mgrp warn" }, h("b", {}, "Pas encore notés (" + none.length + ")"), h("span", {}, none.map(full).join(", ")),
        h("label", { class: "check" }, fillAbs, "Les marquer absents")) : null);
    window.Modal.open({ title: cfg.kind === "match" ? "Confirmer les présences du match" : "Confirmer l'appel", body, actions: [
      { label: "Modifier", close: true },
      { label: "Confirmer : " + g("present").length + " présent" + (g("present").length > 1 ? "s" : ""), primary: true, onclick: async () => { if (none.length && fillAbs.checked) for (const p of none) await cfg.mark(p.id, "absent"); U().toast("Présences confirmées."); if (done) done(); } }] });
  }

  // ---- 2) Appel par liste de prénoms ----
  async function byList(x, done, prefill) {
    const cfg = typeof x.data === "function" ? x : sessCfg(x);
    if (prefill && split(prefill).length) return review(typeof x.data === "function" ? x : sessCfg(x), split(prefill), done);
    const ta = h("textarea", { rows: 7, placeholder: "Amine\nLucas B.\nMoussa Diallo\n…" });
    window.Modal.open({ title: "Appel par liste", body: h("div", {}, h("p", { class: "sub" }, "Écris ou colle les présents : un par ligne, ou séparés par des virgules. Je les reconnais dans l'effectif ; ceux que je ne connais pas, je te propose de les créer."), ta),
      actions: [{ label: "Annuler" }, { label: "Vérifier les noms", primary: true, close: false, onclick: async mo => { const names = split(ta.value); if (!names.length) { U().toast("Écris au moins un prénom."); return false; } mo.close(); await review(cfg, names, done); } }] });
  }
  async function review(cfg, names, done) {
    const { roster, all } = await cfg.data();
    const used = new Set(), rows = names.map(nm => { const p = match(nm, roster); if (p && !used.has(p.id)) used.add(p.id); else if (p) { return { nm, p: null, dup: true }; } return { nm, p }; });
    const others = all.filter(p => !roster.some(r => r.id === p.id)).sort((a, b) => full(a).localeCompare(full(b)));
    const sels = rows.map(r => {
      const sel = h("select", {}, h("option", { value: "create" }, "➕ Créer « " + r.nm + " »"), h("option", { value: "skip" }, "Ignorer"),
        h("optgroup", { label: "Effectif de l'équipe" }, roster.map(p => h("option", { value: "p:" + p.id }, full(p)))),
        others.length ? h("optgroup", { label: "Autres joueurs (ajout à l'équipe)" }, others.map(p => h("option", { value: "o:" + p.id }, full(p)))) : null);
      sel.value = r.p ? "p:" + r.p.id : r.dup ? "skip" : "create"; return sel;
    });
    const rest = h("input", { type: "checkbox" });
    const body = h("div", {}, h("p", { class: "sub" }, rows.filter(r => r.p).length + " reconnu" + (rows.filter(r => r.p).length > 1 ? "s" : "") + ", " + rows.filter(r => !r.p).length + " à vérifier."),
      h("div", { class: "mlist" }, rows.map((r, i) => h("div", { class: "mrow " + (r.p ? "ok" : "new") }, h("span", { class: "mtxt" }, (r.p ? "✓ " : "? ") + r.nm), sels[i]))),
      h("label", { class: "check" }, rest, "Marquer les autres joueurs de l'équipe comme absents"));
    window.Modal.open({ title: "Confirmer les joueurs", body, actions: [{ label: "Retour", close: true, onclick: () => setTimeout(() => byList(cfg, done), 200) }, { label: "Valider l'appel", primary: true, onclick: async () => {
      const present = new Set(); let created = 0;
      for (let i = 0; i < rows.length; i++) {
        const v = sels[i].value; if (v === "skip") continue;
        let pid;
        if (v === "create") { const w = rows[i].nm.trim().split(/\s+/); const p = await DB.save("players", { first_name: w[0], last_name: w.slice(1).join(" ") || null }); await DB.save("memberships", { player_id: p.id, team_season_id: cfg.tsId, jersey_number: null }); pid = p.id; created++; }
        else { pid = v.slice(2); if (v[0] === "o") await DB.save("memberships", { player_id: pid, team_season_id: cfg.tsId, jersey_number: null }); }
        present.add(pid); await cfg.mark(pid, "present");
      }
      if (rest.checked) for (const p of roster) if (!present.has(p.id)) await cfg.mark(p.id, "absent");
      U().toast(present.size + " présent" + (present.size > 1 ? "s" : "") + (created ? " · " + created + " joueur" + (created > 1 ? "s" : "") + " créé" + (created > 1 ? "s" : "") : "") + "."); if (done) done();
    } }] });
  }
  window.PresenceUtil = { confirm, byList, matchCfg };
})();
