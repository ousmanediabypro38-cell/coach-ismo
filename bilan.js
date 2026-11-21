// Bilan de match en PDF : version coach (tout) ou version joueurs (sans notes privées ni fautes individuelles). Impression / « Enregistrer en PDF ».
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a), NS = "http://www.w3.org/2000/svg";
  const S = () => window.StatsUtil;
  const st = { mode: "coach" };
  const mmss = s => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
  const nm = p => p.first_name + (p.last_name ? " " + p.last_name.charAt(0) + "." : "");

  function quarterChart(per) {
    const n = per.length, W = 560, H = 190, pl = 28, pb = 28, mx = Math.max(10, ...per.map(q => Math.max(q.us || 0, q.them || 0))), bw = (W - pl) / n;
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "bchart");
    const el = (t, a, tx) => { const x = document.createElementNS(NS, t); for (const k in a) x.setAttribute(k, a[k]); if (tx != null) x.textContent = tx; svg.append(x); };
    per.forEach((q, i) => {
      const x0 = pl + i * bw + bw * 0.14, w = bw * 0.34, hh = v => (H - pb - 18) * (v || 0) / mx;
      el("rect", { x: x0, y: H - pb - hh(q.us), width: w, height: hh(q.us), fill: "#157a4e", rx: 3 });
      el("rect", { x: x0 + w + 4, y: H - pb - hh(q.them), width: w, height: hh(q.them), fill: "#aab5ae", rx: 3 });
      el("text", { x: x0 + w / 2, y: H - pb - hh(q.us) - 4, "text-anchor": "middle", "font-size": 13, fill: "#157a4e", "font-weight": 700 }, q.us ?? "");
      el("text", { x: x0 + w * 1.5 + 4, y: H - pb - hh(q.them) - 4, "text-anchor": "middle", "font-size": 13, fill: "#6f7c74" }, q.them ?? "");
      el("text", { x: x0 + w + 2, y: H - 8, "text-anchor": "middle", "font-size": 12, fill: "#5b6b61" }, "QT" + (i + 1));
    });
    el("line", { x1: pl - 4, x2: W, y1: H - pb, y2: H - pb, stroke: "#c9d3cd" });
    return svg;
  }

  async function view(v) {
    const e = await DB.get("events", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "cal" }); return []; }
    const teams = await U().loadTeams(), t = teams.find(x => x.ts.id === e.team_season_id);
    const [mem, pl, boxes, acts, stints] = await Promise.all([DB.live("memberships"), DB.live("players"), DB.live("match_boxscores").catch(() => []), DB.live("match_actions"), DB.live("match_stints")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p])), jer = {}; mem.filter(m => m.team_season_id === e.team_season_id).forEach(m => jer[m.player_id] = m.jersey_number);
    const ea = acts.filter(a => a.event_id === e.id), eb = boxes.filter(b => b.event_id === e.id && !b.deleted_at);
    const rows = [];
    if (ea.length) {
      const by = S().byPlayer(ea), secs = {}; stints.filter(s => s.event_id === e.id && s.out_s != null).forEach(s => secs[s.player_id] = (secs[s.player_id] || 0) + s.out_s - s.in_s);
      for (const id of Object.keys(by)) if (P[id]) rows.push({ p: P[id], min: secs[id] ?? null, pts: by[id].pts, fgm: by[id].fgm, p3: by[id].tpm, ft: by[id].ftm, fouls: by[id].fouls, start: false });
    } else for (const b of eb) if (P[b.player_id]) { const x = S().boxOf(b); rows.push({ p: P[b.player_id], min: b.seconds ?? null, pts: x.pts, fgm: x.fgm, p3: x.p3, ft: x.ft, fouls: x.fouls, start: x.starter }); }
    rows.sort((a, b) => b.pts - a.pts || (b.min || 0) - (a.min || 0));
    const sc = ea.length ? S().scoreOf(ea) : null;
    const us = e.score_us ?? (sc ? sc.us : null), them = e.score_them ?? (sc ? sc.them : null);
    const per = (e.periods && e.periods.length ? e.periods : sc ? Object.keys(sc.per).sort().map(k => sc.per[k]) : []).filter(q => q && (q.us != null || q.them != null));
    const win = us != null && them != null ? us > them : null;
    const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(e.starts_at));
    const coach = st.mode === "coach", rerender = () => U().setView({ name: "matchBilan", id: e.id });
    const save = async patch => { const c = await DB.get("events", e.id); await DB.save("events", { ...c, ...patch }); Object.assign(e, patch); };
    const txt = (key, label) => { const ta = h("textarea", { rows: 3, onchange: ev => save({ [key]: ev.target.value.trim() }).then(() => rerender()) }); ta.value = e[key] || ""; return U().field(label, ta); };
    const logo = window.LogoUtil && t ? LogoUtil.img(LogoUtil.teamLogoSrc(t.team), "blogo") : null;
    const T = rows.reduce((a, r) => { a.pts += r.pts; a.p3 += r.p3; a.ft += r.ft; a.fouls += r.fouls; return a; }, { pts: 0, p3: 0, ft: 0, fouls: 0 });
    const blocks = [["Ce qui a marché", e.mission_worked], ["À corriger", e.mission_fix], ["Objectif pour la prochaine fois", e.mission_next]].filter(b => b[1]);
    const top = rows[0] && rows[0].pts > 0 ? rows[0] : null;
    const mode = (k, l) => h("button", { class: "chip" + (st.mode === k ? " on" : ""), onclick: () => { st.mode = k; rerender(); } }, l);
    return [
      h("div", { class: "noprint" },
        h("button", { class: "small ghost back", onclick: () => U().setView({ name: "match", id: e.id }) }, Icon("chevL", 18), "Le match"),
        h("h2", {}, "Bilan de match"),
        h("div", { class: "chips filter" }, mode("coach", "Version coach"), mode("joueurs", "Version joueurs")),
        h("p", { class: "sub" }, coach ? "Tout est inclus : stats complètes, fautes, ton analyse." : "Sans les fautes individuelles : à partager avec l'équipe. Ton analyse y figure."),
        h("section", { class: "card" }, h("h3", { class: "tight" }, "Ton analyse"), txt("mission_worked", "Ce qui a marché"), txt("mission_fix", "À corriger"), txt("mission_next", "Objectif pour la prochaine fois"),
          h("p", { class: "sub" }, "Ces 3 champs sont les mêmes que dans « Missions du match »."),
          h("div", { class: "btns" }, h("button", { onclick: () => window.print() }, Icon("copy", 18), "Imprimer / Enregistrer en PDF")))),
      h("article", { class: "paper" },
        h("header", { class: "bhead" }, logo, h("div", { class: "bmid" }, h("h1", {}, (t ? t.team.name : "") + " — " + (e.opponent || "Adversaire")), h("div", { class: "psub" }, [date, e.home_away === "exterieur" ? "à l'extérieur" : "à domicile", e.venue_name].filter(Boolean).join(" · "))),
          us != null && them != null ? h("div", { class: "bscore " + (win ? "w" : us === them ? "n" : "l") }, h("b", {}, us + " – " + them), h("span", {}, win ? "Victoire" : us === them ? "Nul" : "Défaite")) : null),
        per.length ? h("div", { class: "psec" }, h("h3", {}, "Le match par quart-temps"), quarterChart(per), h("div", { class: "blegend" }, h("i", { class: "g" }), "Nous", h("i", { class: "o" }), e.opponent || "Eux")) : null,
        rows.length ? h("div", { class: "psec" }, h("h3", {}, "Les joueurs"),
          h("table", { class: "ptable" }, h("thead", {}, h("tr", {}, ["Joueur", "Min", "Pts", "Tirs réuss.", "3 pts", "LF"].concat(coach ? ["Fautes"] : []).map(x => h("th", {}, x)))),
            h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, (r.start ? "● " : "") + (jer[r.p.id] != null ? "#" + jer[r.p.id] + " " : "") + nm(r.p)), h("td", {}, r.min != null ? mmss(r.min) : "—"), h("td", { class: "strong" }, r.pts), h("td", {}, r.fgm), h("td", {}, r.p3), h("td", {}, r.ft), coach ? h("td", {}, r.fouls) : null)))),
          h("p", { class: "psub" }, "● = 5 de départ")) : h("p", { class: "psub" }, "Aucune stat saisie pour ce match : utilise « Saisir les stats après match »."),
        rows.length ? h("div", { class: "bkpis" }, [["Points marqués", T.pts], ["Paniers à 3 pts", T.p3], ["Lancers francs réussis", T.ft]].concat(coach ? [["Fautes d'équipe", T.fouls]] : []).map(([l, x]) => h("div", {}, h("b", {}, x), h("span", {}, l)))) : null,
        top ? h("div", { class: "psec" }, h("h3", {}, "Meilleur marqueur"), h("p", { class: "ptext" }, nm(top.p) + " — " + top.pts + " points")) : null,
        blocks.length ? h("div", { class: "psec" }, blocks.map(([l, x]) => h("div", { class: "bblock" }, h("h4", {}, l), h("p", { class: "ptext" }, x)))) : null,
        h("footer", { class: "pfoot" }, "COACH ISMO · " + (coach ? "version coach" : "version joueurs")))
    ];
  }
  Object.assign(window.Views, { matchBilan: view });
})();
