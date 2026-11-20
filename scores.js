// Onglet Scores : un bloc par équipe (avec poule enregistrée) — mes matchs et ceux des autres équipes de la poule, en direct et résultats.
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI;
  const N = s => window.Standings.norm(s);
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "";
  const fmtH = iso => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  let timer = null, busy = false, lastStd = {};

  const sameTeam = (a, b) => { const x = N(a), y = N(b); return x === y || x.includes(y) || y.includes(x); };
  const scoreTxt = m => (m.hs != null && m.as != null) ? m.hs + " – " + m.as : "à venir";

  function row(m, mk, liveSet) {
    const isMine = mk && (N(m.home).includes(mk) || N(m.away).includes(mk));
    const live = liveSet && liveSet.some(l => sameTeam(l.home, m.home) && sameTeam(l.away, m.away));
    return h("div", { class: "item scrow" + (isMine ? " mine" : "") },
      h("div", { class: "scd" }, h("div", {}, fmt(m.date) || m.raw || ""), h("div", { class: "sub" }, fmtH(m.date))),
      h("div", { class: "sct" }, h("div", { class: N(m.home).includes(mk || "§") ? "strong" : "" }, m.home), h("div", { class: N(m.away).includes(mk || "§") ? "strong" : "" }, m.away)),
      h("div", { class: "scs" }, live ? h("span", { class: "pill ok" }, "direct") : null, h("strong", {}, scoreTxt(m))));
  }

  async function refreshAll(force) {
    if (busy) return; busy = true;
    try {
      try { await window.Live.refresh(); } catch (e) {}
      const list = await U().loadTeams();
      for (const x of list) {
        const S = window.Standings; if (!S.pouleId(x.ts.standings_poule)) continue;
        if (!force && Date.now() - (lastStd[x.ts.id] || 0) < 30 * 60e3) continue;
        lastStd[x.ts.id] = Date.now(); await S.refresh(x.ts, x.team, false);
      }
    } finally { busy = false; }
    const v = U().current(); if (v && v.name === "scores" && !document.querySelector("#app input:focus")) U().setView(v);
  }

  async function view() {
    if (!timer) timer = setInterval(() => { const v = U().current(); if (v && v.name === "scores" && !document.hidden && navigator.onLine) refreshAll(false); }, 45000);
    setTimeout(() => refreshAll(false), 300);
    const list = (await U().loadTeams()).filter(x => x.ts && x.team);
    const S = window.Standings, live = (window.Live && window.Live.state.all) || [], at = window.Live && window.Live.state.at;
    const withPoule = list.filter(x => S.pouleId(x.ts.standings_poule)), without = list.filter(x => !S.pouleId(x.ts.standings_poule));
    const head = h("div", { class: "row" }, h("h2", { style: "flex:1" }, "Scores"),
      h("button", { class: "small ghost", onclick: async e => { e.currentTarget.disabled = true; await refreshAll(true); U().toast("Scores actualisés."); } }, Icon("refresh", 16), "Actualiser"));
    const sub = h("p", { class: "sub" }, "Mes matchs et ceux des autres équipes de ma poule, en direct et résultats (source FFBB, indicatif)." + (at ? " Dernière vérification : " + fmtH(new Date(at).toISOString()) + "." : ""));
    const blocks = [];
    for (const x of withPoule) {
      const st = await S.stored(x.ts), rows = st.rows || [], matches = st.matches || [], me = N(S.meOf(x.ts, x.team));
      const mk = me && me.length >= 3 ? me : null;
      const inPoule = live.filter(l => rows.some(r => sameTeam(r.name, l.home)) && rows.some(r => sameTeam(r.name, l.away)) && (l.hs != null || l.as != null || l.live));
      const mine = matches.filter(m => mk && (N(m.home).includes(mk) || N(m.away).includes(mk)));
      const others = matches.filter(m => !mine.includes(m));
      const played = mine.filter(m => m.played), next = mine.filter(m => !m.played);
      const recentOthers = others.filter(m => m.played).slice(-8).reverse(), nextOthers = others.filter(m => !m.played).slice(0, 8);
      blocks.push(h("section", { class: "card scblock" },
        h("div", { class: "row" }, h("div", { style: "flex:1;min-width:0" }, h("h3", { class: "tight" }, x.team.name), h("div", { class: "sub" }, st.rank || "Classement : touche Actualiser")),
          h("button", { class: "small ghost", onclick: () => U().setView({ name: "team", id: x.ts.id }) }, "Fiche équipe")),
        inPoule.length ? [h("div", { class: "scg" }, "En direct dans la poule"), inPoule.map(m => row(m, mk, inPoule))] : h("p", { class: "sub" }, "Aucun match en direct dans cette poule."),
        mine.length ? [h("div", { class: "scg" }, "Mes matchs"), [...next.slice(0, 3), ...played.slice(-3).reverse()].map(m => row(m, mk, inPoule))] : (matches.length ? h("p", { class: "sub" }, "Je ne retrouve pas ton équipe dans le calendrier : vérifie « Nom de ton équipe dans le classement » sur la fiche équipe.") : null),
        (recentOthers.length || nextOthers.length) ? h("details", { class: "mini" }, h("summary", {}, "Matchs des autres équipes de la poule"),
          nextOthers.length ? [h("div", { class: "scg" }, "À venir"), nextOthers.map(m => row(m, mk, inPoule))] : null,
          recentOthers.length ? [h("div", { class: "scg" }, "Derniers résultats"), recentOthers.map(m => row(m, mk, inPoule))] : null) : null));
    }
    if (!list.length) return [head, U().empty("users", "Aucune équipe", "Crée d'abord tes équipes dans l'onglet Équipes.", null)];
    return [head, sub, ...blocks,
      without.length ? h("section", { class: "card" }, h("h3", { class: "tight" }, "Équipes sans poule enregistrée"), h("p", { class: "sub" }, "Ouvre la fiche de l'équipe et colle le lien de sa page classement FFBB (celui qui contient « ?poule= »)."),
        without.map(x => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "team", id: x.ts.id }) }, h("div", { style: "flex:1" }, h("strong", {}, x.team.name)), h("span", { class: "pill" }, "Ajouter la poule")))) : null];
  }
  Object.assign(window.Views, { scores: view });
})();
