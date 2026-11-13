(function () {
  const $ = id => document.getElementById(id);
  const cfg = window.COACH_CONFIG;
  const sb = window.COACH_SB || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  let uid = null, email = null, syncTimer = null, syncState = "idle", view = { name: "accueil" };

  // ---------- petit constructeur de DOM (jamais de innerHTML : pas de risque d'injection) ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "class") e.className = v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  const field = (label, input) => h("label", {}, label, input);
  const nowYear = new Date().getFullYear();
  const defaultSeason = (() => { const d = new Date(); const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return y + "-" + (y + 1); })();

  // ---------- réseau, synchronisation ----------
  function showNet() {
    const on = navigator.onLine;
    $("net").textContent = on ? "en ligne" : "hors ligne";
    $("net").className = "pill" + (on ? " ok" : "");
  }
  async function refreshSyncPill() {
    const n = await DB.countDirty(), c = (await DB.conflicts()).length;
    const el = $("syncpill");
    let txt = "synchronisé", cls = "pill ok";
    if (syncState === "run") { txt = "synchronisation…"; cls = "pill"; }
    else if (syncState === "err") { txt = "erreur de synchro"; cls = "pill bad"; }
    else if (c) { txt = c + " modif. en double"; cls = "pill bad"; }
    else if (n) { txt = n + " en attente"; cls = "pill warn"; }
    el.textContent = txt; el.className = cls;
    if (window.CoachCal) { try { const b = await CoachCal.badge(); const t = $("tabconf"); t.textContent = "Conflits" + (b ? " (" + b + ")" : ""); } catch (e) {} }
  }
  async function doSync(manual) {
    if (!uid) return;
    if (!navigator.onLine) { if (manual) toast("Hors ligne : les changements sont gardés sur la tablette."); return; }
    syncState = "run"; refreshSyncPill();
    try {
      const r = await Sync.run(sb, uid);
      syncState = "idle";
      if (manual && !r.skipped) toast("Synchronisation terminée (" + r.pulled + " reçus, " + r.pushed + " envoyés).");
    } catch (e) {
      syncState = "err";
      if (manual) toast("Synchronisation impossible : " + (e.message || e));
    }
    await refreshSyncPill(); render();
  }
  window.AppSync = doSync;
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => doSync(false), 2000); refreshSyncPill(); }
  DB.onchange = scheduleSync;

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 4000);
  }

  // ---------- données ----------
  async function loadTeams() {
    const [teams, seasons, ts] = await Promise.all([DB.live("teams"), DB.live("seasons"), DB.live("team_seasons")]);
    const T = Object.fromEntries(teams.map(t => [t.id, t])), S = Object.fromEntries(seasons.map(s => [s.id, s]));
    return ts.filter(x => T[x.team_id] && S[x.season_id]).map(x => ({ ts: x, team: T[x.team_id], season: S[x.season_id] }))
      .sort((a, b) => (b.season.label || "").localeCompare(a.season.label || "") || (a.ts.priority || 9) - (b.ts.priority || 9));
  }
  async function loadRoster(tsId) {
    const [m, p] = await Promise.all([DB.live("memberships"), DB.live("players")]);
    const P = Object.fromEntries(p.map(x => [x.id, x]));
    return m.filter(x => x.team_season_id === tsId && P[x.player_id]).map(x => ({ m: x, p: P[x.player_id] }))
      .sort((a, b) => (a.m.jersey_number ?? 999) - (b.m.jersey_number ?? 999) || a.p.first_name.localeCompare(b.p.first_name));
  }
  const fullName = p => [p.first_name, p.last_name].filter(Boolean).join(" ");

  // ---------- écrans ----------
  const TAB = { accueil: "accueil", home: "teams", team: "teams", teamForm: "teams", playerForm: "teams", cal: "cal", event: "cal", eventForm: "cal", import: "cal", conflicts: "conflicts", carnet: "carnet", session: "carnet", sessionForm: "carnet", library: "carnet", exerciseForm: "carnet", importJson: "carnet", venues: "cal", venue: "cal", venueForm: "cal", oussou: "oussou", note: "oussou", noteForm: "oussou", match: "cal", playtime: "cal", player: "teams", playerPdf: "teams", playbook: "playbook", playEntry: "playbook", playForm: "playbook", playDiagram: "playbook", convoc: "cal", teamLogo: "teams", formations: "formation", formation: "formation", formationForm: "formation", formationItem: "formation" };
  function empty(icon, title, text, action) { return h("div", { class: "empty" }, Icon(icon, 34), h("strong", {}, title), h("p", {}, text), action || null); }
  const app = () => $("app");
  function setView(v) { view = v; render(); window.scrollTo(0, 0); }

  async function render() {
    if (!uid) return;
    const root = app(); root.replaceChildren();
    if (view.name === "home") root.append(...(await homeView()).flat(Infinity).filter(x => x != null && x !== false));
    else if (view.name === "team") root.append(...(await teamView(view.id)).flat(Infinity).filter(x => x != null && x !== false));
    else if (view.name === "teamForm") root.append(teamForm());
    else if (view.name === "playerForm") root.append(await playerForm(view.tsId, view.mId));
    else if (window.Views && Views[view.name]) root.append(...[].concat(await Views[view.name](view)).flat(Infinity).filter(x => x != null && x !== false));
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === (TAB[view.name] || "teams")));
    refreshSyncPill();
  }

  async function conflictsBlock() {
    const cs = await DB.conflicts();
    if (!cs.length) return [];
    return [h("section", { class: "card warnbox" },
      h("h2", {}, "Modifications en double (synchronisation)"),
      h("p", { class: "sub" }, "Cet élément a été modifié ici et sur un autre appareil. Choisis la version à garder."),
      cs.map(c => h("div", { class: "item" },
        h("div", {}, h("strong", {}, c.table), h("div", { class: "sub" }, JSON.stringify(summ(c.server)))),
        h("div", { class: "btns" },
          h("button", { class: "small", onclick: async () => { await Sync.resolve(c, "mine"); scheduleSync(); render(); } }, "Garder la mienne"),
          h("button", { class: "small ghost", onclick: async () => { await Sync.resolve(c, "server"); render(); } }, "Prendre l'autre"))))
    )];
  }
  const summ = r => { const o = {}; for (const k of ["name", "label", "first_name", "last_name", "position", "jersey_number", "category"]) if (r[k] != null) o[k] = r[k]; return o; };

  async function homeView() {
    const list = await loadTeams();
    return [
      ...(await conflictsBlock()),
      h("div", { class: "row" }, h("h2", {}, "Mes équipes"),
        h("button", { onclick: () => setView({ name: "teamForm" }) }, Icon("plus", 18), "Nouvelle équipe")),
      list.length ? list.map(x => h("button", { class: "item btnitem", onclick: () => setView({ name: "team", id: x.ts.id }) },
        window.LogoUtil ? LogoUtil.img(LogoUtil.teamLogoSrc(x.team), "tlogo sm") : null,
        h("div", { style: "flex:1" }, h("strong", {}, x.team.name), h("div", { class: "sub" }, [x.team.category, x.team.club, x.season.label].filter(Boolean).join(" · "))),
        h("span", { class: "pill" }, "P" + (x.ts.priority || "?") + " · " + (x.ts.role || "")))
      
      ) : empty("users", "Aucune équipe pour le moment", "Crée ta première équipe pour y ajouter ses joueurs, ses rencontres et ses séances.",
        h("button", { onclick: () => setView({ name: "teamForm" }) }, Icon("plus", 18), "Créer une équipe")),
    ];
  }

  function teamForm() {
    const name = h("input", { required: true, placeholder: "ex. Seniors DM3 (pré D2)" });
    const cat = h("input", { placeholder: "ex. Seniors, U18F…" });
    const club = h("input", { placeholder: "ex. Eybens" });
    const season = h("input", { required: true, value: defaultSeason });
    const role = h("select", {}, ["principal", "assistant", "joueur"].map(r => h("option", { value: r }, r === "principal" ? "Coach principal" : r === "assistant" ? "Assistant" : "Joueur")));
    const prio = h("select", {}, [1, 2, 3, 4, 5, 6].map(n => h("option", { value: n, selected: n === 3 }, "P" + n)));
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const label = season.value.trim();
      let s = (await DB.live("seasons")).find(x => x.label === label);
      if (!s) s = await DB.save("seasons", { label });
      const t = await DB.save("teams", { name: name.value.trim(), category: cat.value.trim() || null, club: club.value.trim() || null });
      const ts = await DB.save("team_seasons", { team_id: t.id, season_id: s.id, role: role.value, priority: +prio.value });
      setView({ name: "team", id: ts.id });
    } },
      h("h2", {}, "Nouvelle équipe"),
      field("Nom", name), field("Catégorie", cat), field("Club", club), field("Saison", season),
      field("Ton rôle", role), field("Priorité (1 = la plus haute)", prio),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: () => setView({ name: "home" }) }, "Annuler"));
  }

  async function teamView(tsId) {
    const ts = await DB.get("team_seasons", tsId);
    if (!ts || ts.deleted_at) { view = { name: "home" }; return homeView(); }
    const [team, season, roster] = await Promise.all([DB.get("teams", ts.team_id), DB.get("seasons", ts.season_id), loadRoster(tsId)]);
    const file = h("input", { type: "file", accept: ".csv,.txt,text/csv,text/plain", class: "hidden", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      const n = await importCsv(await f.text(), tsId); e.target.value = "";
      toast(n + " joueur(s) importé(s)."); render();
    } });
    return [
      h("button", { class: "small ghost back", onclick: () => setView({ name: "home" }) }, Icon("chevL", 18), "Équipes"),
      h("div", { class: "teamhead" }, window.LogoUtil ? LogoUtil.img(LogoUtil.teamLogoSrc(team), "tlogo") : null, h("div", {}, h("h2", {}, team.name),
      h("p", { class: "sub" }, [team.category, team.club, season.label].filter(Boolean).join(" · ")))),
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: () => setView({ name: "playerForm", tsId }) }, Icon("plus", 18), "Joueur"),
        h("button", { class: "small ghost", onclick: () => setView({ name: "teamLogo", id: tsId }) }, Icon("edit", 18), "Logo"),
        h("button", { class: "small ghost", onclick: () => { if (window.PlaybookState) window.PlaybookState.ts = tsId; setView({ name: "playbook" }); } }, Icon("court", 18), "Playbook"),
        h("button", { class: "small ghost", onclick: () => file.click() }, Icon("upload", 18), "Importer un CSV"), file,
        h("button", { class: "small ghost danger", onclick: async () => {
          if (!confirm("Supprimer cette équipe pour cette saison ? (les joueurs sont gardés)")) return;
          await DB.remove("team_seasons", ts); setView({ name: "home" });
        } }, "Supprimer l'équipe")),
      h("h3", {}, "Effectif (" + roster.length + ")"),
      roster.length ? roster.map(({ m, p }) => h("button", { class: "item btnitem", onclick: () => setView({ name: "player", tsId, mId: m.id }) },
        h("div", {}, h("strong", {}, (m.jersey_number != null ? "#" + m.jersey_number + " " : "") + fullName(p)),
          h("div", { class: "sub" }, [p.position, p.birth_year].filter(Boolean).join(" · "))),
        Icon("chevR", 18)))
        : empty("users", "Aucun joueur dans cette équipe", "Ajoute un joueur ou importe un fichier CSV avec ton effectif.", null),
    ];
  }

  async function playerForm(tsId, mId) {
    const m = mId ? await DB.get("memberships", mId) : null;
    const p = m ? await DB.get("players", m.player_id) : null;
    const first = h("input", { required: true, value: p ? p.first_name : "" });
    const last = h("input", { value: p && p.last_name ? p.last_name : "" });
    const year = h("input", { type: "number", min: 1950, max: nowYear, placeholder: "année seulement", value: p && p.birth_year ? p.birth_year : "" });
    const pos = h("input", { placeholder: "ex. P.2/3", value: p && p.position ? p.position : "" });
    const num = h("input", { type: "number", min: 0, max: 99, value: m && m.jersey_number != null ? m.jersey_number : "" });
    const back = () => setView({ name: "team", id: tsId });
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const data = { first_name: first.value.trim(), last_name: last.value.trim() || null, birth_year: year.value ? +year.value : null, position: pos.value.trim() || null };
      const pl = await DB.save("players", p ? { ...p, ...data } : data);
      const jersey = num.value === "" ? null : +num.value;
      await DB.save("memberships", m ? { ...m, jersey_number: jersey } : { player_id: pl.id, team_season_id: tsId, jersey_number: jersey });
      back();
    } },
      h("h2", {}, p ? "Modifier le joueur" : "Nouveau joueur"),
      field("Prénom", first), field("Nom", last), field("Année de naissance", year), field("Poste", pos), field("Numéro de maillot", num),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: back }, "Annuler"),
      m ? h("button", { type: "button", class: "ghost danger", onclick: async () => {
        if (!confirm("Retirer ce joueur de l'effectif ?")) return;
        await DB.remove("memberships", m); back();
      } }, "Retirer de l'effectif") : null);
  }

  // ---------- import CSV (colonnes : prenom;nom;poste;annee_naissance;numero) ----------
  function parseCsv(text) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const sep = [";", "\t", ","].find(s => lines[0].includes(s)) || ";";
    const cells = lines.map(l => l.split(sep).map(c => c.trim()));
    const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
    const head = cells[0].map(norm);
    const hasHead = head.some(c => ["prenom", "firstname", "nom", "poste"].includes(c));
    const idx = hasHead ? head : ["prenom", "nom", "poste", "anneenaissance", "numero"];
    const col = n => idx.indexOf(n);
    return cells.slice(hasHead ? 1 : 0).map(r => ({
      first: r[col("prenom")] || r[col("firstname")] || "",
      last: r[col("nom")] || "",
      pos: r[col("poste")] || "",
      year: r[col("anneenaissance")] || r[col("annee")] || "",
      num: r[col("numero")] || ""
    })).filter(r => r.first);
  }
  async function importCsv(text, tsId) {
    const roster = await loadRoster(tsId);
    const have = new Set(roster.map(x => (fullName(x.p)).toLowerCase()));
    let n = 0;
    for (const r of parseCsv(text)) {
      const key = [r.first, r.last].filter(Boolean).join(" ").toLowerCase();
      if (have.has(key)) continue;
      have.add(key);
      const pl = await DB.save("players", { first_name: r.first, last_name: r.last || null, position: r.pos || null, birth_year: /^\d{4}$/.test(r.year) ? +r.year : null });
      await DB.save("memberships", { player_id: pl.id, team_season_id: tsId, jersey_number: /^\d{1,2}$/.test(r.num) ? +r.num : null });
      n++;
    }
    return n;
  }

  // ---------- connexion ----------
  async function enter(user, offlineMode) {
    uid = user.id; email = user.email;
    try { localStorage.setItem("coach_user", JSON.stringify({ id: uid, email })); } catch (e) {}
    $("login").classList.add("hidden"); $("shell").classList.remove("hidden"); $("who").textContent = email;
    await render();
    if (!offlineMode) doSync(false);
  }
  async function start() {
    showNet();
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (session) return enter(session.user, false);
    // Hors ligne : on rouvre l'application avec la copie locale si un compte était déjà connecté sur cette tablette.
    let cached = null; try { cached = JSON.parse(localStorage.getItem("coach_user")); } catch (e) {}
    if (cached && !navigator.onLine) return enter(cached, true);
    uid = null; $("shell").classList.add("hidden"); $("login").classList.remove("hidden");
  }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("loginMsg"); msg.className = "msg"; msg.textContent = "Connexion…";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) { msg.className = "msg err"; msg.textContent = "Connexion refusée : " + error.message; return; }
    $("password").value = ""; msg.textContent = ""; enter(data.user, false);
  });
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => setView({ name: b.dataset.view })));
  $("syncpill").addEventListener("click", () => setView({ name: "home" }));
  $("syncbtn").addEventListener("click", () => doSync(true));
  $("logout").addEventListener("click", async () => {
    const n = await DB.countDirty();
    if (n && !confirm(n + " changement(s) pas encore synchronisé(s). Se déconnecter les garde sur la tablette, mais ils ne seront envoyés qu'à la prochaine connexion. Continuer ?")) return;
    try { await sb.auth.signOut(); } catch (e) {}
    try { localStorage.removeItem("coach_user"); } catch (e) {}
    uid = null; view = { name: "accueil" }; start();
  });
  window.addEventListener("online", () => { showNet(); doSync(false); });
  window.addEventListener("offline", showNet);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) doSync(false); });

  document.querySelectorAll("[data-icon]").forEach(e => e.replaceChildren(Icon(e.dataset.icon, e.closest(".nav") ? 22 : 18)));
  window.UI = { h, field, setView, toast, loadTeams, defaultSeason, empty };
  start();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
