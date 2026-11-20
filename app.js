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
    try { const ls = await DB.getMeta("last_sync"); if (ls) txt += " · " + new Date(ls).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); } catch (e) {}
    if (syncState === "run") { txt = "synchronisation…"; cls = "pill"; }
    else if (syncState === "err") { txt = "erreur · toucher pour réessayer"; cls = "pill bad"; }
    else if (c) { txt = c + " modif. en double"; cls = "pill bad"; }
    else if (n) { txt = n + " en attente"; cls = "pill warn"; }
    el.textContent = txt; el.className = cls;
    if (window.CoachCal) { try { const b = await CoachCal.badge(); const t = $("tabconf"); t.textContent = "Conflits" + (b ? " (" + b + ")" : ""); } catch (e) {} }
  }
  async function doSync(manual) {
    if (!uid) return;
    if (!navigator.onLine) { if (manual) toast("Hors ligne : les changements sont gardés sur la tablette."); return; }
    syncState = "run"; refreshSyncPill();
    let changed = !!manual;
    try {
      const r = await Sync.run(sb, uid);
      syncState = "idle"; if (r && r.pulled) changed = true;
      if (manual && !r.skipped) toast("Synchronisation terminée (" + r.pulled + " reçus, " + r.pushed + " envoyés).");
    } catch (e) {
      const first = syncState !== "err"; syncState = "err"; changed = false;
      if (manual) toast("Synchronisation impossible : " + (e.message || e));
      else if (first) toast("Synchronisation impossible pour l'instant. Tes changements restent sur la tablette.");
    }
    await refreshSyncPill(); if (changed) softRender();
  }
  // Ne redessine pas la page pendant que tu écris : on attend que tu quittes le champ (sinon le texte saisi disparaît).
  let pendingRender = false;
  const typing = () => { const a = document.activeElement; return !!(a && a !== document.body && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(button|checkbox|radio|file|submit)$/.test(a.type || "")); };
  function softRender() {
    if (!typing()) { pendingRender = false; const y = window.scrollY; return render().then(() => window.scrollTo(0, y)); }
    pendingRender = true;
  }
  document.addEventListener("focusout", () => { if (!pendingRender) return; setTimeout(() => { if (pendingRender && !typing()) { pendingRender = false; const y = window.scrollY; render().then(() => window.scrollTo(0, y)); } }, 400); });
  window.AppSync = doSync;
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => doSync(false), 2000); refreshSyncPill(); }
  DB.onchange = scheduleSync;

  function toast(msg, action, ms) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    if (action) { const b = document.createElement("button"); b.type = "button"; b.className = "toastbtn"; b.textContent = action.label;
      b.addEventListener("click", () => { t.classList.add("hidden"); action.run(); }); t.append(b); }
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms || (action ? 8000 : 4000));
  }
  // Annuler une suppression : toutes les suppressions faites dans la même seconde sont annulées ensemble.
  (function () {
    const orig = DB.remove.bind(DB); let batch = [], timer = null;
    DB.remove = async function (name, row) {
      const r = await orig(name, row);
      if (name === "match_actions") return r;
      batch.push([name, row.id]);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const b = batch; batch = [];
        toast(b.length > 1 ? b.length + " éléments supprimés" : "Supprimé", { label: "Annuler", run: async () => {
          for (const [n, id] of b) { const x = await DB.get(n, id); if (x) { x.deleted_at = null; await DB.save(n, x); } }
          toast("Suppression annulée"); softRender();
        } });
      }, 350);
      return r;
    };
  })();

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
  const TAB = { accueil: "accueil", routines: "teams", missions: "cal", boxEntry: "cal", missionBank: "teams", missionSuivi: "teams", routine: "teams", routineEdit: "teams", home: "teams", team: "teams", teamForm: "teams", playerForm: "teams", cal: "cal", event: "cal", eventForm: "cal", import: "cal", conflicts: "conflicts", carnet: "carnet", session: "carnet", sessionForm: "carnet", library: "carnet", exerciseForm: "carnet", importJson: "carnet", venues: "cal", venue: "cal", venueForm: "cal", oussou: "oussou", note: "oussou", noteForm: "oussou", match: "cal", playtime: "cal", player: "teams", playerPdf: "teams", playbook: "playbook", playEntry: "playbook", playForm: "playbook", playDiagram: "playbook", convoc: "cal", teamLogo: "teams", claudePrep: "accueil", formations: "formation", formation: "formation", formationForm: "formation", formationItem: "formation" };
  function empty(icon, title, text, action) { return h("div", { class: "empty" }, Icon(icon, 34), h("strong", {}, title), h("p", {}, text), action || null); }
  const app = () => $("app");
  // Même écran redessiné (bouton, présence, case cochée…) : on garde la position de défilement. Autre écran : retour en haut.
  let lastKey = null;
  const viewKey = v => [v.name, v.id, v.tsId, v.mId].join("|");
  const stack = [], ROOTS = ["accueil", "home", "cal", "conflicts", "carnet", "playbook", "formations", "oussou"];
  function setView(v, fromPop) {
    if (!fromPop && view && viewKey(view) !== viewKey(v)) { stack.push(view); if (stack.length > 60) stack.shift(); try { history.pushState({ n: stack.length }, ""); } catch (e) {} }
    view = v; return render();
  }
  window.addEventListener("popstate", () => {
    const prev = stack.pop();
    if (prev) { view = prev; render(); }
    else if (view.name !== "accueil") { view = { name: "accueil" }; render(); try { history.pushState({ n: 0 }, ""); } catch (e) {} }
  });
  function goBack() { if (stack.length) history.back(); else setView({ name: "accueil" }); }
  function backBar() {
    let bar = $("backbar");
    const need = !ROOTS.includes(view.name) && !document.querySelector("#app .back");
    if (!need) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement("div"); bar.id = "backbar"; app().before(bar); }
    bar.replaceChildren(h("button", { class: "small ghost back", onclick: goBack }, Icon("chevL", 18), stack.length ? "Retour" : "Accueil"));
  }

  async function render() {
    if (!uid) return;
    const root = app(), key = viewKey(view), keep = key === lastKey, y = window.scrollY;
    if (keep) root.style.minHeight = root.offsetHeight + "px";
    root.replaceChildren();
    if (view.name === "home") root.append(...(await homeView()).flat(Infinity).filter(x => x != null && x !== false));
    else if (view.name === "team") root.append(...(await teamView(view.id)).flat(Infinity).filter(x => x != null && x !== false));
    else if (view.name === "teamForm") root.append(teamForm());
    else if (view.name === "playerForm") root.append(await playerForm(view.tsId, view.mId));
    else if (window.Views && Views[view.name]) root.append(...[].concat(await Views[view.name](view)).flat(Infinity).filter(x => x != null && x !== false));
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === (TAB[view.name] || "teams")));
    refreshSyncPill(); backBar();
    lastKey = key; root.style.minHeight = "";
    window.scrollTo(0, keep ? y : 0);
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
    const [mem, evs] = await Promise.all([DB.live("memberships"), DB.live("events")]);
    const nowIso = new Date().toISOString(), fr = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const info = x => {
      const n = mem.filter(m => m.team_season_id === x.ts.id).length;
      const nx = evs.filter(e => e.team_season_id === x.ts.id && e.starts_at >= nowIso && e.status !== "annule").sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      return n + " joueur" + (n > 1 ? "s" : "") + (nx ? " · prochain : " + fr.format(new Date(nx.starts_at)) + (nx.opponent ? " vs " + nx.opponent : "") : "");
    };
    return [
      ...(await conflictsBlock()),
      h("div", { class: "row" }, h("h2", {}, "Mes équipes"),
        h("button", { onclick: () => setView({ name: "teamForm" }) }, Icon("plus", 18), "Nouvelle équipe")),
      list.length ? list.map(x => h("button", { class: "item btnitem", onclick: () => setView({ name: "team", id: x.ts.id }) },
        window.LogoUtil ? LogoUtil.img(LogoUtil.teamLogoSrc(x.team), "tlogo sm") : null,
        h("div", { style: "flex:1" }, h("strong", {}, x.team.name), h("div", { class: "sub" }, [x.team.category, x.team.club, x.season.label].filter(Boolean).join(" · ")), h("div", { class: "sub" }, info(x))),
        h("span", { class: "pill" }, "P" + (x.ts.priority || "?") + (x.ts.role ? " · " + x.ts.role : "")))
      
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

  const safeUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  function standingsCard(ts) {
    const rank = h("input", { type: "text", placeholder: "Ex. 4e · 6 V – 2 D", value: ts.standings_rank || "" });
    const url = h("input", { type: "url", placeholder: "https://… (page classement de ta poule)", value: ts.standings_url || "" });
    const go = safeUrl(ts.standings_url);
    return h("section", { class: "card" }, h("h3", { class: "tight" }, "Classement de la poule"),
      h("p", { class: "sub" }, ts.standings_rank ? ts.standings_rank + (ts.standings_at ? " · mis à jour le " + new Date(ts.standings_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "") : "Colle le lien de la page classement de ta poule et note ta position : elle s'affiche sur l'accueil."),
      field("Position et bilan", rank), field("Lien de la page classement", url),
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: async () => {
          const cur = await DB.get("team_seasons", ts.id), u = url.value.trim();
          if (u && !safeUrl(u)) { toast("Ce lien ne semble pas valide (il doit commencer par https://)."); return; }
          cur.standings_rank = rank.value.trim() || null; cur.standings_url = u ? safeUrl(u) : null; cur.standings_at = new Date().toISOString();
          await DB.save("team_seasons", cur); toast("Classement enregistré."); render();
        } }, Icon("check", 18), "Enregistrer"),
        go ? h("a", { class: "btnlink", href: go, target: "_blank", rel: "noopener noreferrer" }, "Ouvrir le classement") : null));
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
        h("button", { class: "small ghost", onclick: () => window.RoutineUtil && RoutineUtil.open(tsId) }, Icon("clipboard", 18), "Routines"),
        h("button", { class: "small ghost", onclick: () => setView({ name: "missionSuivi", tsId }) }, Icon("check", 18), "Missions"),
        h("button", { class: "small ghost", onclick: () => { if (window.PlaybookState) window.PlaybookState.ts = tsId; setView({ name: "playbook" }); } }, Icon("court", 18), "Playbook"),
        h("button", { class: "small ghost", onclick: () => file.click() }, Icon("upload", 18), "Importer un CSV"), file,
        h("button", { class: "small ghost danger", onclick: async () => {
          if (!confirm("Supprimer cette équipe pour cette saison ? (les joueurs sont gardés)")) return;
          await DB.remove("team_seasons", ts); setView({ name: "home" });
        } }, "Supprimer l'équipe")),
      window.Standings ? await Standings.card(ts, team, () => render()) : standingsCard(ts),
      h("h3", {}, "Effectif (" + roster.length + ")"),
      roster.length ? roster.map(({ m, p }) => h("button", { class: "item btnitem", onclick: () => setView({ name: "player", tsId, mId: m.id }) },
        window.SuiviUtil ? SuiviUtil.avatar(p, "sm") : null,
        h("div", { style: "flex:1" }, h("strong", {}, (m.jersey_number != null ? "#" + m.jersey_number + " " : "") + fullName(p)),
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
  const brand = document.querySelector(".side-top .brand");
  if (brand) { brand.setAttribute("role", "button"); brand.setAttribute("tabindex", "0"); brand.setAttribute("aria-label", "Retour à l'accueil"); brand.style.cursor = "pointer";
    brand.addEventListener("click", () => setView({ name: "accueil" })); brand.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView({ name: "accueil" }); } }); }
  $("syncpill").addEventListener("click", () => doSync(true));
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
  window.UI = { h, field, setView, toast, loadTeams, defaultSeason, empty, goBack };
  start();
  if ("serviceWorker" in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!had || document.getElementById("updbar")) return;
      const b = h("div", { id: "updbar", role: "status" }, h("span", {}, "Nouvelle version prête."), h("button", { class: "small", onclick: () => location.reload() }, "Mettre à jour"), h("button", { class: "small ghost", "aria-label": "Plus tard", onclick: () => b.remove() }, "Plus tard"));
      document.body.append(b);
    });
    navigator.serviceWorker.register("sw.js").then(reg => {
      const chk = () => { try { reg.update(); } catch (e) {} };
      document.addEventListener("visibilitychange", () => { if (!document.hidden) chk(); });
      setInterval(chk, 30 * 60 * 1000);
    }).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
