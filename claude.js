// Préparer pour Claude : assemble un texte (contexte + demande) à coller dans Claude avec ton abonnement. Rien n'est envoyé par l'appli.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);
  const SUBJECTS = { week: "Ma semaine", match: "Un match", player: "Un joueur ou une joueuse", session: "Une séance", team: "Une équipe" };
  const ASK = {
    week: "Aide-moi à organiser cette semaine : priorités, points de vigilance et ce que je dois préparer.",
    match: "Aide-moi à préparer ce match : plan de jeu, rotation et temps de jeu, consignes d'avant-match.",
    player: "Propose-moi des objectifs individuels pour les 4 prochaines semaines et des exercices adaptés.",
    session: "Critique cette séance et propose des améliorations (rythme, progressivité, variantes).",
    team: "Fais le point sur cette équipe : forces, points à travailler et priorités pour le mois à venir.",
  };
  const S = { subject: "week", target: "", ask: null, first: true, ts: "" };
  const KIND = { physique: "Physique", echauffement: "Échauffement", exercice: "Exercice", jeu: "Jeu", autre: "Autre" };
  const mmss = s => Math.floor(s / 60) + " min " + String(Math.round(s % 60)).padStart(2, "0") + " s";

  async function ctx() {
    const [teams, events, sessions, players, mem, av, stints, entries, goals, blocks, att, pb] = await Promise.all([U().loadTeams(), DB.live("events"), DB.live("sessions"), DB.live("players"), DB.live("memberships"),
      DB.live("match_availability"), DB.live("match_stints"), DB.live("player_entries"), DB.live("player_goals"), DB.live("session_blocks"), DB.live("session_attendance"), DB.live("playbook_entries")]);
    return { teams, events, sessions, players, mem, av, stints, entries, goals, blocks, att, pb, T: Object.fromEntries(teams.map(x => [x.ts.id, x.team.name])), P: Object.fromEntries(players.map(p => [p.id, p])) };
  }
  const when = iso => K().cap(K().dayFmt.format(new Date(iso))) + " à " + K().hm(iso);
  const nm = (p, first) => first ? p.first_name : [p.first_name, p.last_name].filter(Boolean).join(" ");
  const roster = (c, tsId) => c.mem.filter(m => m.team_season_id === tsId && c.P[m.player_id]).map(m => ({ m, p: c.P[m.player_id] }));
  const resLine = (e, c) => (c.T[e.team_season_id] || "") + " — " + (e.opponent || "?") + " : " + e.score_us + "-" + e.score_them + " (" + (e.score_us > e.score_them ? "victoire" : e.score_us < e.score_them ? "défaite" : "nul") + ", " + K().cap(K().dayFmt.format(new Date(e.starts_at))) + ")";
  const isRes = e => e.kind === "match" && e.score_us != null && e.score_them != null;

  function availText(c, e, first) {
    const mine = c.av.filter(a => a.event_id === e.id), by = s => mine.filter(a => a.status === s && c.P[a.player_id]).map(a => nm(c.P[a.player_id], first));
    const total = roster(c, e.team_season_id).length, ans = mine.length;
    return "Présences : " + by("present").length + " présents (" + (by("present").join(", ") || "—") + "), " + by("peut_etre").length + " peut-être (" + (by("peut_etre").join(", ") || "—") + "), " + by("absent").length + " absents (" + (by("absent").join(", ") || "—") + "), " + Math.max(0, total - ans) + " sans réponse.";
  }
  function playtimeText(c, e, first) {
    const mine = c.stints.filter(s => s.event_id === e.id && s.out_s != null), ids = [...new Set(mine.map(s => s.player_id))];
    if (!ids.length) return null;
    return "Temps de jeu : " + ids.map(id => c.P[id] ? nm(c.P[id], first) + " " + mmss(mine.filter(s => s.player_id === id).reduce((a, s) => a + (s.out_s - s.in_s), 0)) : null).filter(Boolean).join(" ; ");
  }
  function sessionText(c, s) {
    const bl = c.blocks.filter(b => b.session_id === s.id).sort((a, b) => (a.position || 0) - (b.position || 0));
    const L = ["Séance : " + (s.title || "sans titre") + " — " + c.T[s.team_season_id] + ", " + when(s.starts_at) + (s.duration_min ? ", " + s.duration_min + " min" : "") + (s.intensity ? ", intensité " + s.intensity : "")];
    if (s.objective) L.push("Objectif : " + s.objective);
    bl.forEach((b, i) => { L.push((i + 1) + ". " + (b.kind ? "[" + (KIND[b.kind] || b.kind) + "] " : "") + b.title + (b.duration_min ? " (" + b.duration_min + " min)" : "")); [["Mise en place", b.setup], ["Déroulement", b.description], ["Axes techniques", b.coaching_points], ["Variantes", b.variants], ["Systèmes", b.systems], ["Matériel", b.material]].forEach(([l, t]) => { if (t) L.push("   " + l + " : " + String(t).replace(/\n+/g, " / ")); }); });
    return L.join("\n");
  }

  async function build(subject, target, first) {
    const c = await ctx(), now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0); const L = [];
    if (subject === "week") {
      const t0 = d0.getTime(), t1 = t0 + 7 * 86400000;
      const ev = c.events.filter(e => e.starts_at && e.status !== "annule" && new Date(e.starts_at).getTime() >= t0 && new Date(e.starts_at).getTime() < t1).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const se = c.sessions.filter(s => s.starts_at && new Date(s.starts_at).getTime() >= t0 && new Date(s.starts_at).getTime() < t1).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      L.push("Semaine à venir (7 jours)."); 
      [...ev.map(e => ({ t: e.starts_at, e })), ...se.map(s => ({ t: s.starts_at, s }))].sort((a, b) => a.t.localeCompare(b.t)).forEach(x => {
        if (x.e) { const e = x.e; L.push("", "• " + when(e.starts_at) + " — " + (c.T[e.team_season_id] || "") + (e.opponent ? " contre " + e.opponent : e.title ? " : " + e.title : "") + (e.kind === "match" ? " (match" + (e.home_away ? ", " + e.home_away : "") + ")" : "") + (e.venue_name ? " — " + e.venue_name : "") + (e.travel_minutes ? " — trajet " + e.travel_minutes + " min" : "")); if (e.kind === "match") L.push("  " + availText(c, e, first)); }
        else L.push("", "• " + when(x.s.starts_at) + " — séance " + (c.T[x.s.team_season_id] || "") + (x.s.title ? " : " + x.s.title : "") + (x.s.objective ? " (objectif : " + x.s.objective + ")" : ""));
      });
      if (!ev.length && !se.length) L.push("Rien de prévu dans l'appli.");
      const rec = c.events.filter(isRes).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 4); if (rec.length) L.push("", "Derniers résultats :", ...rec.map(e => "- " + resLine(e, c)));
    } else if (subject === "match") {
      const e = c.events.find(x => x.id === target); if (!e) return "Choisis un match.";
      L.push("Match : " + (c.T[e.team_season_id] || "") + " contre " + (e.opponent || "?") + ", " + when(e.starts_at) + (e.competition ? " (" + e.competition + ")" : "") + (e.home_away ? ", " + e.home_away : "") + (e.venue_name ? ", " + e.venue_name : "") + (e.travel_minutes ? ", trajet " + e.travel_minutes + " min" : ""));
      if (isRes(e)) L.push("Résultat : " + e.score_us + "-" + e.score_them);
      L.push(availText(c, e, first)); const pt = playtimeText(c, e, first); if (pt) L.push(pt);
      if (e.match_notes) L.push("Notes de match : " + e.match_notes);
      const prev = c.events.filter(x => x.team_season_id === e.team_season_id && isRes(x) && x.id !== e.id && x.starts_at < e.starts_at).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 5);
      const vs = c.events.filter(x => isRes(x) && x.id !== e.id && x.opponent && x.opponent === e.opponent && x.starts_at < e.starts_at);
      if (prev.length) L.push("", "Derniers résultats de l'équipe :", ...prev.map(x => "- " + resLine(x, c)));
      if (vs.length) L.push("", "Déjà rencontré cette saison :", ...vs.map(x => "- " + resLine(x, c)));
      const r = roster(c, e.team_season_id); if (r.length) L.push("", "Effectif : " + r.map(({ m, p }) => (m.jersey_number != null ? "#" + m.jersey_number + " " : "") + nm(p, first) + (p.position ? " (" + p.position + ")" : "")).join(", "));
    } else if (subject === "player") {
      const [tsId, pid] = target.split("|"), p = c.P[pid], m = c.mem.find(x => x.team_season_id === tsId && x.player_id === pid); if (!p) return "Choisis un joueur.";
      L.push("Joueur : " + nm(p, first) + (m && m.jersey_number != null ? " (#" + m.jersey_number + ")" : "") + " — " + (c.T[tsId] || "") + (p.position ? ", poste " + p.position : ""));
      [["Rôle dans l'équipe", p.role_note], ["Points forts", p.strengths], ["Axes de progrès", p.to_improve]].forEach(([l, t]) => { if (t) L.push(l + " : " + t); });
      const g = c.goals.filter(x => x.player_id === pid).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")); if (g.length) L.push("", "Objectifs :", ...g.map(x => "- " + (x.cycle ? x.cycle + " : " : "") + x.body + " [" + ({ en_cours: "en cours", atteint: "atteint", abandonne: "abandonné" }[x.status] || x.status) + "]"));
      const en = c.entries.filter(x => x.player_id === pid).sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || "")).slice(0, 15);
      if (en.length) L.push("", "Observations, entretiens et bilans récents :", ...en.map(x => "- " + (x.entry_date || "") + " (" + ({ observation: "observation", entretien: "entretien", bilan: "bilan" }[x.kind] || x.kind) + (x.tone ? ", " + (x.tone === "plus" ? "+" : x.tone === "moins" ? "−" : "neutre") : "") + ") " + [x.title, x.body].filter(Boolean).join(" — ")));
      const ms = c.events.filter(e => e.team_season_id === tsId && e.kind === "match" && c.stints.some(s => s.event_id === e.id && s.player_id === pid && s.out_s != null));
      if (ms.length) { const per = ms.map(e => c.stints.filter(s => s.event_id === e.id && s.player_id === pid && s.out_s != null).reduce((a, s) => a + (s.out_s - s.in_s), 0)); L.push("", "Temps de jeu : " + ms.length + " match(s), " + mmss(per.reduce((a, b) => a + b, 0) / per.length) + " en moyenne."); }
    } else if (subject === "session") {
      const s = c.sessions.find(x => x.id === target); if (!s) return "Choisis une séance.";
      L.push(sessionText(c, s)); const a = c.att.filter(x => x.session_id === s.id && c.P[x.player_id]);
      if (a.length) L.push("", "Présences : " + a.map(x => nm(c.P[x.player_id], first) + " (" + x.status + (x.group_label ? ", groupe " + x.group_label : "") + ")").join(", "));
    } else if (subject === "team") {
      const x = c.teams.find(t => t.ts.id === target); if (!x) return "Choisis une équipe.";
      L.push("Équipe : " + x.team.name + " — saison " + x.season.label + ", mon rôle : " + (x.ts.role || "?"));
      const r = roster(c, x.ts.id); L.push("Effectif (" + r.length + ") : " + r.map(({ m, p }) => (m.jersey_number != null ? "#" + m.jersey_number + " " : "") + nm(p, first) + (p.position ? " (" + p.position + ")" : "")).join(", "));
      const rs = c.events.filter(e => e.team_season_id === x.ts.id && isRes(e)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
      if (rs.length) { const w = rs.filter(e => e.score_us > e.score_them).length; L.push("", "Bilan : " + w + " victoire(s), " + (rs.length - w) + " défaite(s) ou nul(s) sur " + rs.length + " match(s).", ...rs.slice(0, 6).map(e => "- " + resLine(e, c))); }
      const nx = c.events.filter(e => e.team_season_id === x.ts.id && e.status !== "annule" && new Date(e.starts_at).getTime() >= d0.getTime()).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4); if (nx.length) L.push("", "À venir :", ...nx.map(e => "- " + when(e.starts_at) + " — " + (e.opponent || e.title || e.kind)));
      const ss = c.sessions.filter(s => s.team_season_id === x.ts.id && new Date(s.starts_at).getTime() < now).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 6); if (ss.length) L.push("", "Dernières séances :", ...ss.map(s => "- " + K().cap(K().dayFmt.format(new Date(s.starts_at))) + " : " + (s.title || "séance") + (s.objective ? " (" + s.objective + ")" : "")));
      const pb = c.pb.filter(e => e.team_season_id === x.ts.id && e.category !== "lexique"); if (pb.length) L.push("", "Playbook : " + pb.map(e => e.title + " [" + ({ a_installer: "à installer", en_cours: "en cours", installe: "installé" }[e.status] || "") + "]").join(", "));
    }
    return L.join("\n");
  }

  async function prompt(subject, target, first, ask) {
    const body = await build(subject, target, first);
    return "Tu es mon assistant de coach de basket (clubs de l'Isère). Voici des données tirées de mon application COACH ISMO." + (first ? " Les joueurs sont désignés par leur prénom." : "") + "\nRéponds en français, de façon concrète et directement utilisable sur le terrain. J'emploie MEP pour « mise en place ».\n\n=== CONTEXTE ===\n" + body + "\n\n=== MA DEMANDE ===\n" + (ask || ASK[subject]);
  }

  async function view(v) {
    if (v.subject) { S.subject = v.subject; S.target = v.target || ""; S.ask = null; v.subject = null; v.target = null; }
    const c = await ctx(), now = Date.now();
    const rerender = () => U().setView({ name: "claudePrep" });
    // cible par défaut
    const matches = c.events.filter(e => e.kind === "match" && e.starts_at).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const upc = matches.filter(e => new Date(e.starts_at).getTime() >= now - 86400000), past = matches.filter(e => new Date(e.starts_at).getTime() < now - 86400000).reverse();
    const optsMatch = [...upc, ...past.slice(0, 8)];
    const sess = c.sessions.filter(s => s.starts_at).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 25);
    const rosterAll = c.teams.map(x => ({ x, list: roster(c, x.ts.id).sort((a, b) => (a.m.jersey_number ?? 999) - (b.m.jersey_number ?? 999)) })).filter(g => g.list.length);
    let sel = null;
    if (S.subject === "match") { if (!optsMatch.some(e => e.id === S.target)) S.target = (upc[0] || optsMatch[0] || {}).id || ""; sel = h("select", {}, optsMatch.map(e => h("option", { value: e.id, selected: e.id === S.target }, (c.T[e.team_season_id] || "") + " — " + (e.opponent || "?") + " · " + K().cap(K().dayFmt.format(new Date(e.starts_at))))));
    } else if (S.subject === "session") { if (!sess.some(s => s.id === S.target)) S.target = (sess[0] || {}).id || ""; sel = h("select", {}, sess.map(s => h("option", { value: s.id, selected: s.id === S.target }, (c.T[s.team_season_id] || "") + " — " + (s.title || "Séance") + " · " + K().cap(K().dayFmt.format(new Date(s.starts_at))))));
    } else if (S.subject === "team") { if (!c.teams.some(x => x.ts.id === S.target)) S.target = (c.teams[0] || { ts: {} }).ts.id || ""; sel = h("select", {}, c.teams.map(x => h("option", { value: x.ts.id, selected: x.ts.id === S.target }, x.team.name)));
    } else if (S.subject === "player") { if (!S.target || !S.target.includes("|") || !rosterAll.some(g => g.list.some(({ p }) => S.target === g.x.ts.id + "|" + p.id))) { const g0 = rosterAll[0]; S.target = g0 ? g0.x.ts.id + "|" + g0.list[0].p.id : ""; }
      sel = h("select", {}, rosterAll.map(g => h("optgroup", { label: g.x.team.name }, g.list.map(({ p }) => h("option", { value: g.x.ts.id + "|" + p.id, selected: S.target === g.x.ts.id + "|" + p.id }, nm(p, S.first))))));
    }
    if (sel) sel.addEventListener("change", () => { S.target = sel.value; S.ask = null; rerender(); });
    const askTa = h("textarea", { rows: 3 }, S.ask != null ? S.ask : ASK[S.subject]); askTa.addEventListener("input", () => { S.ask = askTa.value; });
    const text = await prompt(S.subject, S.target, S.first, S.ask);
    const out = h("textarea", { rows: 14, readonly: "true", class: "claudeout" }, text);
    const copy = async () => { try { await navigator.clipboard.writeText(out.value); U().toast("Copié. Colle-le dans Claude."); return true; } catch (e) { out.select(); U().toast("Copie auto impossible : sélectionne et copie le texte."); return false; } };
    const regen = async () => { out.value = await prompt(S.subject, S.target, S.first, askTa.value); };
    askTa.addEventListener("change", regen);
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "accueil" }) }, Icon("chevL", 18), "Accueil"),
      h("h2", {}, "Préparer pour Claude"),
      h("p", { class: "sub" }, "Choisis un sujet : l'appli assemble un texte avec le contexte, que tu colles dans Claude (ton abonnement). L'appli n'envoie rien toute seule."),
      h("div", { class: "chips filter" }, Object.entries(SUBJECTS).map(([k, l]) => h("button", { class: "chip" + (S.subject === k ? " on" : ""), onclick: () => { S.subject = k; S.target = ""; S.ask = null; rerender(); } }, l))),
      h("section", { class: "card" }, sel ? U().field("Lequel ?", sel) : null,
        U().field("Ta demande", askTa),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: S.first, onchange: ev => { S.first = ev.target.checked; rerender(); } }), "Prénoms seulement (recommandé, surtout pour les mineurs)")),
      h("h3", {}, "Texte prêt à coller"), out,
      h("div", { class: "btns wrap" },
        h("button", { onclick: async () => { await copy(); window.open("https://claude.ai/new", "_blank", "noopener"); } }, Icon("copy", 18), "Copier et ouvrir Claude"),
        h("button", { class: "ghost", onclick: copy }, "Copier seulement")),
      h("p", { class: "sub" }, "Les photos et les coordonnées ne sont jamais incluses."),
    ];
  }
  window.Views.claudePrep = view;
})();
