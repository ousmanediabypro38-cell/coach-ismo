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

  // Reconnaissance d'un nom saisi dans l'effectif : exact, surnom, prénom seul, nom de famille manquant, orthographe proche.
  function classify(name, roster) {
    const N = window.Names, n = N.norm(name); if (!n) return { kind: "skip" };
    const w = n.split(" "), first = w[0], last = w.slice(1).join(" ");
    const byFirst = roster.filter(p => N.writings(p).includes(first) || N.norm(p.first_name) === first);
    let r = roster.filter(p => N.norm(N.full(p)) === n); if (r.length === 1) return { kind: "ok", p: r[0] };
    r = roster.filter(p => N.aliasesOf(p).map(N.norm).includes(n)); if (r.length === 1) return { kind: "ok", p: r[0], tag: "surnom" };
    if (last) {
      const same = byFirst.filter(p => p.last_name && (N.norm(p.last_name) === last || N.norm(p.last_name).startsWith(last) || last.startsWith(N.norm(p.last_name))));
      if (same.length === 1) return { kind: "ok", p: same[0] };
      const noLast = byFirst.filter(p => !p.last_name);
      if (noLast.length === 1) return { kind: "addlast", p: noLast[0], last: N.cap(w.slice(1).join(" ")) };
      return { kind: "new" };
    }
    if (byFirst.length === 1) return { kind: "ok", p: byFirst[0], tag: N.norm(byFirst[0].first_name) === first ? null : "surnom" };
    if (byFirst.length > 1) return { kind: "amb", cands: byFirst };
    r = roster.filter(p => first.length > 4 && dist(N.norm(p.first_name), first) <= 1); if (r.length === 1) return { kind: "ok", p: r[0], tag: "orthographe" };
    r = roster.filter(p => first.length >= 3 && N.norm(p.first_name).startsWith(first)); if (r.length === 1) return { kind: "ok", p: r[0], tag: "abrégé" };
    r = roster.filter(p => N.norm(p.first_name).length >= 3 && first.startsWith(N.norm(p.first_name))); if (r.length === 1) return { kind: "ok", p: r[0], tag: "surnom" };   // « Ismaël » pour « Isma »
    return { kind: "new" };
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
    const N = window.Names, { roster, all } = await cfg.data();
    const seen = new Set();
    const rows = names.map(nm => { const c = classify(nm, roster); c.nm = nm; if (c.p) { if (seen.has(c.p.id)) { c.dup = true; } seen.add(c.p.id); } return c; });
    const others = all.filter(p => !roster.some(r => r.id === p.id)).sort((a, b) => full(a).localeCompare(full(b)));
    const label = r => r.kind === "ok" ? "✓ " : r.kind === "new" ? "? " : "⚠ ";
    const opts = r => [h("option", { value: "create" }, "➕ Créer « " + N.cap(r.nm) + " »"), h("option", { value: "skip" }, "Ignorer"),
      r.kind === "amb" ? h("option", { value: "ask" }, "— choisir le bon joueur —") : null,
      h("optgroup", { label: "Effectif de l'équipe" }, roster.map(p => h("option", { value: "p:" + p.id }, full(p)))),
      others.length ? h("optgroup", { label: "Autres joueurs (ajout à l'équipe)" }, others.map(p => h("option", { value: "o:" + p.id }, full(p)))) : null];
    const ctl = rows.map((r, i) => {
      if (r.kind === "addlast") {
        const name = "al" + i, mk = (v, t, on) => h("label", { class: "opt" + (on ? " on" : "") }, h("input", { type: "radio", name, value: v, checked: !!on, onchange: () => body.querySelectorAll('input[name="' + name + '"]').forEach(x => x.closest(".opt").classList.toggle("on", x.checked)) }), t);
        r.radios = h("div", { class: "opts" }, mk("add", "Oui, c'est lui : ajouter « " + r.last + " » à sa fiche", true), mk("keep", "Oui, mais ne pas modifier sa fiche", false), mk("other", "Non, c'est un autre joueur : créer « " + N.cap(r.nm) + " »", false)); r.name = name; return null; }
      const sel = h("select", {}, opts(r)); sel.value = r.dup ? "skip" : r.kind === "ok" ? "p:" + r.p.id : r.kind === "amb" ? "ask" : "create"; return sel;
    });
    const rest = h("input", { type: "checkbox" });
    const okN = rows.filter(r => r.kind === "ok").length;
    const body = h("div", {}, h("p", { class: "sub" }, okN + " reconnu" + (okN > 1 ? "s" : "") + ", " + (rows.length - okN) + " à vérifier. Les noms sont enregistrés avec une majuscule."),
      h("div", { class: "mlist" }, rows.map((r, i) => r.kind === "addlast"
        ? h("div", { class: "mrow new", style: "grid-template-columns:1fr" }, h("div", {}, h("span", { class: "mtxt" }, "⚠ " + N.cap(r.nm)), h("span", { class: "mtag w" }, "nom de famille"),
            h("div", { class: "mq" }, "Dans l'appli, ce joueur est enregistré « ", h("b", {}, r.p.first_name), " » sans nom de famille. C'est le même ?")), r.radios)
        : h("div", { class: "mrow " + (r.kind === "ok" ? "ok" : "new") }, h("div", {}, h("span", { class: "mtxt" }, label(r) + N.cap(r.nm)), r.tag ? h("span", { class: "mtag" }, r.tag) : null,
            r.kind === "ok" && r.tag ? h("div", { class: "mq" }, "Reconnu : ", h("b", {}, full(r.p))) : r.kind === "new" ? h("div", { class: "mq" }, "Inconnu : sera créé « ", h("b", {}, N.cap(r.nm)), " »") : r.kind === "amb" ? h("div", { class: "mq" }, "Plusieurs joueurs portent ce prénom : choisis le bon.") : null), ctl[i]))),
      h("label", { class: "check" }, rest, "Marquer les autres joueurs de l'équipe comme absents"));
    const learn = async (p, typed) => {   // retient l'écriture : la prochaine fois, elle est reconnue d'office
      const t = N.cap(typed), k = N.norm(t); if (!k || N.writings(p).includes(k)) return p;
      return await DB.save("players", { ...p, aliases: [...N.aliasesOf(p), t] });
    };
    window.Modal.open({ title: "Confirmer les joueurs", body, actions: [{ label: "Retour", close: true, onclick: () => setTimeout(() => byList(cfg, done), 200) }, { label: "Valider l'appel", primary: true, onclick: async () => {
      if (rows.some((r, i) => ctl[i] && ctl[i].value === "ask")) { U().toast("Choisis le bon joueur pour les prénoms en double."); return false; }
      const present = new Set(); let created = 0, learned = 0;
      const newPlayer = async nm => { const w = N.cap(nm).split(" "); const p = await DB.save("players", { first_name: w[0], last_name: w.slice(1).join(" ") || null, aliases: [] }); await DB.save("memberships", { player_id: p.id, team_season_id: cfg.tsId, jersey_number: null }); created++; return p.id; };
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]; let pid = null;
        if (r.kind === "addlast") {
          const ch = (r.radios.querySelector("input:checked") || {}).value || "add";
          if (ch === "other") pid = await newPlayer(r.nm);
          else { const cur = await DB.get("players", r.p.id); if (ch === "add") await DB.save("players", { ...cur, first_name: N.cap(cur.first_name), last_name: r.last }); else { await learn(cur, r.nm); learned++; } pid = r.p.id; }
        } else {
          const v = ctl[i].value; if (v === "skip") continue;
          if (v === "create") pid = await newPlayer(r.nm);
          else { pid = v.slice(2); const cur = await DB.get("players", pid); if (v[0] === "o") await DB.save("memberships", { player_id: pid, team_season_id: cfg.tsId, jersey_number: null });
            if (cur && N.norm(r.nm) && !N.writings(cur).includes(N.norm(r.nm))) { await learn(cur, r.nm); learned++; } }
        }
        present.add(pid); await cfg.mark(pid, "present");
      }
      if (rest.checked) for (const p of roster) if (!present.has(p.id)) await cfg.mark(p.id, "absent");
      U().toast(present.size + " présent" + (present.size > 1 ? "s" : "") + (created ? " · " + created + " joueur" + (created > 1 ? "s" : "") + " créé" + (created > 1 ? "s" : "") : "") + (learned ? " · " + learned + " surnom" + (learned > 1 ? "s" : "") + " retenu" + (learned > 1 ? "s" : "") : "") + "."); if (done) done();
    } }] });
  }
  window.PresenceUtil = { confirm, byList, matchCfg };
})();
