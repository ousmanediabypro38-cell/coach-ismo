// Page d'accueil : le point de départ de l'appli (prochain match, semaine, raccourcis, sauvegarde).
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI, K = () => window.CalUtil;
  const DAY = 86400000;

  async function view() {
    const [teams, events, sessions, av, confl] = await Promise.all([U().loadTeams(), DB.live("events"), DB.live("sessions"), DB.live("match_availability"), DB.conflicts()]);
    const T = Object.fromEntries(teams.map(x => [x.ts.id, x.team.name]));
    const now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const startToday = d0.getTime();
    const hello = (new Date().getHours() < 18 ? "Bonjour" : "Bonsoir") + " coach";
    const dateTxt = K().cap(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(new Date()));
    const rerender = () => U().setView({ name: "accueil" });

    const ev = events.filter(e => e.starts_at && e.status !== "annule").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const nextMatch = ev.find(e => e.kind === "match" && new Date(e.starts_at).getTime() >= startToday && !(e.score_us != null && e.score_them != null));

    // semaine à venir : rencontres + séances, sur 7 jours
    const horizon = startToday + 7 * DAY;
    const items = [
      ...ev.filter(e => { const t = new Date(e.starts_at).getTime(); return t >= startToday && t < horizon; })
        .map(e => ({ t: e.starts_at, kind: e.kind === "match" ? "Match" : (e.kind === "entrainement" ? "Entraînement" : "Rencontre"), label: (T[e.team_season_id] || "") + (e.opponent ? " — " + e.opponent : e.title ? " — " + e.title : ""), go: { name: "event", id: e.id }, match: e.kind === "match" })),
      ...sessions.filter(s => s.starts_at && !s.deleted_at).filter(s => { const t = new Date(s.starts_at).getTime(); return t >= startToday && t < horizon; })
        .map(s => ({ t: s.starts_at, kind: "Séance", label: (T[s.team_season_id] || "") + (s.title ? " — " + s.title : ""), go: { name: "session", id: s.id } })),
    ].sort((a, b) => a.t.localeCompare(b.t));
    const byDay = []; for (const it of items) { const k = K().dkey(it.t); const g = byDay[byDay.length - 1]; if (g && g.k === k) g.list.push(it); else byDay.push({ k, list: [it] }); }

    const results = ev.filter(e => e.kind === "match" && e.score_us != null && e.score_them != null).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 3);

    // bloc « prochain match »
    let hero = null;
    if (nextMatch) {
      const mine = av.filter(a => a.event_id === nextMatch.id);
      const cnt = s => mine.filter(a => a.status === s).length;
      let roster = 0; try { roster = (await DB.live("memberships")).filter(m => m.team_season_id === nextMatch.team_season_id).length; } catch (e) {}
      const noAns = Math.max(0, roster - mine.length);
      const dt = new Date(nextMatch.starts_at), days = Math.round((new Date(K().dkey(nextMatch.starts_at) + "T00:00:00").getTime() - startToday) / DAY);
      const when = days <= 0 ? "Aujourd'hui" : days === 1 ? "Demain" : "Dans " + days + " jours";
      hero = h("section", { class: "card hero" },
        h("div", { class: "heroin" },
          h("span", { class: "pill ok" }, "Prochain match · " + when),
          h("h2", { class: "herotitle" }, (nextMatch.opponent || "Adversaire à renseigner")),
          h("p", { class: "sub" }, [T[nextMatch.team_season_id], K().cap(K().dayFmt.format(dt)) + " à " + K().hm(nextMatch.starts_at), nextMatch.venue_name].filter(Boolean).join(" · ")),
          h("div", { class: "chips" }, h("span", { class: "pill ok" }, cnt("present") + " présents"), h("span", { class: "pill warn" }, cnt("peut_etre") + " peut-être"), h("span", { class: "pill bad" }, cnt("absent") + " absents"), h("span", { class: "pill" }, noAns + " sans réponse")),
          h("div", { class: "btns wrap" },
            h("button", { onclick: () => U().setView({ name: "convoc", id: nextMatch.id }) }, Icon("users", 18), "Convocation et présences"),
            h("button", { class: "ghost", onclick: () => U().setView({ name: "match", id: nextMatch.id }) }, Icon("ball", 18), "Feuille de match"),
            h("button", { class: "ghost", onclick: () => U().setView({ name: "event", id: nextMatch.id }) }, "Fiche"))));
    } else {
      hero = h("section", { class: "card hero" }, h("div", { class: "heroin" }, h("strong", {}, "Pas de match à venir"), h("p", { class: "sub" }, "Ajoute la prochaine rencontre pour préparer la convocation et suivre les présences."),
        h("button", { onclick: () => U().setView({ name: "eventForm" }) }, Icon("plus", 18), "Ajouter une rencontre")));
    }

    const tile = (icon, label, sub, go) => h("button", { class: "tile", onclick: () => U().setView(go) }, Icon(icon, 26), h("strong", {}, label), h("span", { class: "sub" }, sub));
    const dayLbl = k => { const d = new Date(k + "T12:00:00"); const dd = Math.round((new Date(k + "T00:00:00").getTime() - startToday) / DAY); return (dd === 0 ? "Aujourd'hui" : dd === 1 ? "Demain" : K().cap(K().dayFmt.format(d))); };

    return [
      h("div", { class: "greet" }, h("h1", {}, hello), h("p", { class: "sub" }, dateTxt)),
      confl.length ? h("button", { class: "card warnbox btnitem", onclick: () => U().setView({ name: "conflicts" }) }, h("strong", {}, confl.length + " modification" + (confl.length > 1 ? "s" : "") + " en double à trancher"), h("span", { class: "sub" }, "Ouvrir les conflits")) : null,
      window.Backup ? await Backup.banner(rerender) : null,
      hero,
      h("h3", {}, "Cette semaine"),
      byDay.length ? h("section", { class: "card" }, byDay.map(g => h("div", { class: "agday" }, h("div", { class: "aglbl" }, dayLbl(g.k)),
        g.list.map(it => h("button", { class: "item btnitem", onclick: () => U().setView(it.go) },
          h("div", { class: "evtime" }, K().hm(it.t)), h("div", { style: "flex:1;min-width:0" }, h("strong", {}, it.label), h("div", { class: "sub" }, it.kind)), it.match ? h("span", { class: "pill ok" }, "Match") : null))))) 
        : h("p", { class: "sub" }, "Rien de prévu dans les 7 prochains jours."),
      h("h3", {}, "Raccourcis"),
      h("div", { class: "tiles" },
        tile("clipboard", "Nouvelle séance", "Préparer un entraînement", { name: "sessionForm" }),
        tile("calendar", "Nouvelle rencontre", "Match, réunion…", { name: "eventForm" }),
        tile("users", "Mes équipes", "Effectifs et fiches joueurs", { name: "home" }),
        tile("court", "Playbook", "Systèmes et schémas", { name: "playbook" }),
        tile("clipboard", "Exercices", "Bibliothèque", { name: "library" }),
        tile("pin", "Lieux et trajets", "Salles, durées", { name: "venues" })),
      results.length ? [h("h3", {}, "Derniers résultats"), h("section", { class: "card" }, results.map(e => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "match", id: e.id }) },
        h("div", { style: "flex:1;min-width:0" }, h("strong", {}, (T[e.team_season_id] || "") + " — " + (e.opponent || "")), h("div", { class: "sub" }, K().cap(K().dayFmt.format(new Date(e.starts_at))))),
        window.MatchUtil ? MatchUtil.resultChip(e) : null)))] : null,
      window.Backup ? await Backup.card(rerender) : null,
    ];
  }
  Object.assign(window.Views, { accueil: view });
})();
