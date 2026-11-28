// Séance à imprimer ou enregistrer en PDF : déroulé complet, avec présences et bilan en option.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a), K = () => window.CalUtil;
  const KINDS = { physique: "Préparation physique", echauffement: "Échauffement", exercice: "Exercice", jeu: "Phase de jeu", autre: "Autre" };
  const INT = { legere: "légère", moyenne: "moyenne", forte: "forte" };
  const opts = { presences: false, bilan: false, details: true };
  const hasDur = b => b.duration_min != null && b.duration_min !== "" && +b.duration_min > 0;
  const full = p => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Joueur";

  async function view(v) {
    const s = await DB.get("sessions", v.id);
    if (!s || s.deleted_at) { U().setView({ name: "carnet" }); return []; }
    const rerender = () => U().setView({ name: "sessionPrint", id: s.id });
    const [blocksAll, teams, att, pl, mem] = await Promise.all([DB.live("session_blocks"), U().loadTeams(), DB.live("session_attendance"), DB.live("players"), DB.live("memberships")]);
    const blocks = blocksAll.filter(b => b.session_id === s.id).sort((a, b) => a.position - b.position);
    const t = teams.find(x => x.ts.id === s.team_season_id), ven = s.venue_id ? await DB.get("venues", s.venue_id) : null;
    const P = Object.fromEntries(pl.map(p => [p.id, p])), J = {}; mem.filter(m => m.team_season_id === s.team_season_id).forEach(m => J[m.player_id] = m.jersey_number);
    const mine = att.filter(a => a.session_id === s.id && P[a.player_id]);
    const by = f => mine.filter(f).sort((a, b) => full(P[a.player_id]).localeCompare(full(P[b.player_id]))).map(a => (J[a.player_id] != null ? "#" + J[a.player_id] + " " : "") + full(P[a.player_id]));
    const logo = window.LogoUtil && t ? LogoUtil.img(LogoUtil.teamLogoSrc(t.team), "blogo") : null;
    const total = blocks.reduce((n, b) => n + (hasDur(b) ? +b.duration_min : 0), 0);
    const end = new Date(Date.parse(s.starts_at) + (s.duration_min || 90) * 60000).toISOString();
    let cur = Date.parse(s.starts_at), known = true;
    const part = (l, x) => x ? h("p", { class: "ptext" }, h("b", {}, l + " : "), x) : null;
    const rows = blocks.map(b => { const at = known ? new Date(cur).toISOString() : null; if (hasDur(b)) cur += +b.duration_min * 60000; else known = false;
      return h("div", { class: "sblock" }, h("div", { class: "sat" }, at ? K().hm(at) : "–", h("small", {}, hasDur(b) ? b.duration_min + " min" : "")),
        h("div", { class: "sbody" }, h("div", { class: "stitle" }, b.kind ? h("span", { class: "skind" }, KINDS[b.kind]) : null, h("strong", {}, b.title || "Bloc")),
          opts.details ? [part("Mise en place", b.setup), part("Déroulement", b.description), part("Axes techniques", b.coaching_points), part("Variantes", b.variants), part("Systèmes", b.systems), part("Matériel", b.material)] : null)); });
    const chk = (k, l) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!opts[k], onchange: e => { opts[k] = e.target.checked; rerender(); } }), l);
    const pres = by(a => a.status === "present"), abs = by(a => a.status === "absent"), inj = by(a => a.status === "blesse");
    const bil = [["Ce qui a bien marché", s.bilan_worked], ["À améliorer", s.bilan_improve], ["Pour la prochaine séance", s.bilan_next]].filter(x => x[1]);
    return [
      h("div", { class: "noprint" },
        h("button", { class: "small ghost back", onclick: () => U().setView({ name: "session", id: s.id }) }, Icon("chevL", 18), "La séance"),
        h("h2", {}, "Imprimer la séance"), h("p", { class: "sub" }, "Un déroulé propre, prêt à imprimer ou à enregistrer en PDF depuis la fenêtre d'impression."),
        h("section", { class: "card" }, h("div", { class: "pdfopts" }, chk("details", "Détail des blocs (mise en place, consignes…)"), chk("presences", "Présences"), chk("bilan", "Bilan de la séance")),
          h("div", { class: "btns" }, h("button", { onclick: () => window.print() }, Icon("copy", 18), "Imprimer / Enregistrer en PDF")))),
      h("article", { class: "paper" },
        h("header", { class: "bhead" }, logo, h("div", { class: "bmid" }, h("h1", {}, s.title || "Séance"),
          h("div", { class: "psub" }, [t && t.team.name, K().cap(K().dayFmt.format(new Date(s.starts_at))), K().hm(s.starts_at) + " – " + K().hm(end), ven && ven.name, s.intensity ? "intensité " + INT[s.intensity] : null].filter(Boolean).join(" · ")))),
        s.objective ? h("div", { class: "bblock" }, h("h4", {}, "Objectif"), h("p", { class: "ptext" }, s.objective)) : null,
        h("div", { class: "psec" }, h("h3", {}, "Déroulé" + (total ? " — " + total + " min" : "")), rows.length ? rows : h("p", { class: "psub" }, "Aucun bloc saisi.")),
        opts.presences && mine.length ? h("div", { class: "psec" }, h("h3", {}, "Présences"), h("p", { class: "ptext" }, h("b", {}, "Présents (" + pres.length + ") : "), pres.join(", ") || "—"),
          abs.length ? h("p", { class: "ptext" }, h("b", {}, "Absents (" + abs.length + ") : "), abs.join(", ")) : null, inj.length ? h("p", { class: "ptext" }, h("b", {}, "Blessés (" + inj.length + ") : "), inj.join(", ")) : null) : null,
        opts.bilan && bil.length ? h("div", { class: "psec" }, h("h3", {}, "Bilan"), bil.map(([l, x]) => h("div", { class: "bblock" }, h("h4", {}, l), h("p", { class: "ptext" }, x)))) : null,
        h("footer", { class: "pfoot" }, "COACH ISMO · séance"))
    ];
  }
  Object.assign(window.Views, { sessionPrint: view });
})();
