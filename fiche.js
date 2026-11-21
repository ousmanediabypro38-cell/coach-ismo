// Fiche de fin de saison d'un joueur : bilan complet façon pro, à envoyer au joueur (ou à ses parents pour l'U13).
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a), NS = "http://www.w3.org/2000/svg";
  const S = () => window.StatsUtil;
  const opts = { nom: true, photo: true, matchs: true, mot: true, fautes: true };
  const full = p => p.first_name + (p.last_name ? " " + p.last_name : "");
  const dfr = iso => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

  function formChart(rows) {
    const pts = rows.filter(r => S().summary([r]).ptsAvg != null).map(r => ({ r, v: S().summary([r]).ptsAvg }));
    if (pts.length < 2) return null;
    const W = 640, H = 170, pb = 30, pt = 22, n = pts.length, max = Math.max(5, ...pts.map(x => x.v)) * 1.12, step = (W - 20) / n, bw = Math.min(46, step * 0.6);
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "bchart");
    const el = (t, a, tx) => { const x = document.createElementNS(NS, t); for (const k in a) x.setAttribute(k, a[k]); if (tx != null) x.textContent = tx; svg.append(x); };
    const avg = pts.reduce((t, x) => t + x.v, 0) / n, y = v => pt + (H - pt - pb) * (1 - v / max);
    pts.forEach((x, i) => { const cx = 10 + step * (i + .5), top = y(x.v), e = x.r.e, won = e.score_us != null && e.score_them != null ? e.score_us > e.score_them : null;
      el("rect", { x: cx - bw / 2, y: top, width: bw, height: Math.max(2, H - pb - top), rx: 4, fill: won === false ? "#b9c4bd" : "#157a4e" });
      el("text", { x: cx, y: top - 5, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "#15201a" }, Math.round(x.v));
      el("text", { x: cx, y: H - 10, "text-anchor": "middle", "font-size": 11, fill: "#5b6b61" }, (e.opponent || "?").slice(0, 8)); });
    el("line", { x1: 10, x2: W - 10, y1: y(avg), y2: y(avg), stroke: "#e0a02a", "stroke-width": 1.5, "stroke-dasharray": "5 4" });
    el("text", { x: W - 10, y: y(avg) - 4, "text-anchor": "end", "font-size": 11.5, fill: "#b07a10" }, "moyenne " + S().f1(avg));
    return svg;
  }

  async function view(v) {
    const m = await DB.get("memberships", v.mId), p = m ? await DB.get("players", m.player_id) : null;
    if (!m || !p) { U().setView({ name: "team", id: v.tsId }); return []; }
    const rerender = () => U().setView({ name: "playerSeason", tsId: v.tsId, mId: v.mId });
    const [ts, entries, goals] = await Promise.all([DB.get("team_seasons", v.tsId), DB.live("player_entries"), DB.live("player_goals")]);
    const team = ts ? await DB.get("teams", ts.team_id) : null, season = ts ? await DB.get("seasons", ts.season_id) : null;
    const rows = (await S().forPlayer(p.id, v.tsId)).filter(r => r.tracked || r.min != null || r.box);
    const M = S().summary(rows), f1 = S().f1;
    const gl = goals.filter(g => g.player_id === p.id && g.status !== "abandonne");
    const mot = entries.filter(e => e.player_id === p.id && e.kind === "bilan" && e.title === "Bilan de saison").sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""))[0];
    const ta = h("textarea", { rows: 5, placeholder: "Ton bilan de la saison pour ce joueur : progression, état d'esprit, ce qu'il doit travailler cet été…" }); ta.value = mot ? mot.body || "" : "";
    const saveMot = async () => { const body = ta.value.trim(); if (mot) await DB.save("player_entries", { ...mot, body }); else if (body) await DB.save("player_entries", { player_id: p.id, kind: "bilan", tone: null, entry_date: new Date().toISOString().slice(0, 10), title: "Bilan de saison", body }); U().toast("Enregistré."); rerender(); };
    const chk = (k, l) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!opts[k], onchange: ev => { opts[k] = ev.target.checked; rerender(); } }), l);
    const name = opts.nom ? full(p) : p.first_name;
    const logo = window.LogoUtil && team ? LogoUtil.img(LogoUtil.teamLogoSrc(team), "blogo") : null;
    const tiles = [["Matchs joués", M.gp], ["Points / match", f1(M.ptsAvg)], ["Meilleur match", M.withP.length ? Math.max(...M.withP.map(r => S().summary([r]).ptsAvg)) + " pts" : "—"],
      ["Minutes / match", M.minAvg != null ? S().mmss(M.minAvg) : "—"], ["Paniers à 3 pts", M.p3 || "—"], ["Lancers francs réussis", M.ft || "—"], ["Titularisations", M.starts || "—"], ["Points au total", M.ptsTot || "—"]];
    const chart = formChart(rows);
    const sec = (t, b) => h("div", { class: "psec" }, h("h3", {}, t), b);
    return [
      h("div", { class: "noprint" },
        h("button", { class: "small ghost back", onclick: () => U().setView({ name: "player", tsId: v.tsId, mId: v.mId }) }, Icon("chevL", 18), "Fiche de " + p.first_name),
        h("h2", {}, "Fiche de fin de saison"),
        h("p", { class: "sub" }, "Un bilan complet sur toute la saison, à envoyer au joueur (ou à ses parents). Tes observations + / − et les entretiens n'y figurent jamais."),
        h("section", { class: "card" },
          h("div", { class: "pdfopts" }, chk("nom", "Nom de famille"), chk("photo", "Photo"), chk("matchs", "Tableau match par match"), chk("fautes", "Fautes"), chk("mot", "Mot du coach")),
          U().field("Mot du coach", ta), h("div", { class: "btns wrap" }, h("button", { class: "ghost", onclick: saveMot }, "Enregistrer le mot"),
            h("button", { onclick: async () => { if (ta.value.trim() !== (mot ? mot.body || "" : "")) await saveMot(); window.print(); } }, Icon("copy", 18), "Imprimer / Enregistrer en PDF")))),
      h("article", { class: "paper" },
        h("header", { class: "bhead" }, opts.photo && p.photo ? h("img", { class: "pphoto", src: p.photo, alt: "" }) : logo,
          h("div", { class: "bmid" }, h("h1", {}, name), h("div", { class: "psub" }, [m.jersey_number != null ? "N° " + m.jersey_number : null, p.position, team && team.name, season && season.label].filter(Boolean).join(" · "))),
          opts.photo && p.photo ? logo : null),
        sec("Ma saison en chiffres", h("div", { class: "bkpis" }, tiles.map(([l, x]) => h("div", {}, h("b", {}, x), h("span", {}, l))))),
        M.win + M.loss ? h("p", { class: "psub" }, "Bilan de l'équipe quand " + p.first_name + " joue : " + M.win + " victoire" + (M.win > 1 ? "s" : "") + ", " + M.loss + " défaite" + (M.loss > 1 ? "s" : "") + ".") : null,
        chart ? sec("Points match après match", chart) : null,
        M.nTr ? h("p", { class: "psub" }, "Adresse (matchs suivis en direct) : tirs " + (M.fg ?? "—") + " % · 3 pts " + (M.tp ?? "—") + " % · lancers francs " + (M.ftp ?? "—") + " %.") : null,
        opts.matchs && rows.length ? sec("Match par match", h("table", { class: "ptable" },
          h("thead", {}, h("tr", {}, ["Match", "Rés.", "Min", "Pts", "3 pts", "LF"].concat(opts.fautes ? ["F"] : []).map(x => h("th", {}, x)))),
          h("tbody", {}, rows.map(r => { const e = r.e, x = S().summary([r]); return h("tr", {}, h("td", {}, dfr(e.starts_at) + " · " + (e.opponent || "?")),
            h("td", {}, e.score_us != null && e.score_them != null ? (e.score_us > e.score_them ? "V " : e.score_us < e.score_them ? "D " : "N ") + e.score_us + "-" + e.score_them : "—"),
            h("td", {}, r.min != null ? S().mmss(r.min) : "—"), h("td", { class: "strong" }, x.ptsAvg != null ? Math.round(x.ptsAvg) : "—"), h("td", {}, x.p3), h("td", {}, x.ft), opts.fautes ? h("td", {}, x.foulsAvg != null ? Math.round(x.foulsAvg) : "—") : null); })))) : null,
        p.role_note ? sec("Mon rôle dans l'équipe", h("p", { class: "ptext" }, p.role_note)) : null,
        p.strengths || p.to_improve ? h("div", { class: "bcols" }, p.strengths ? h("div", { class: "bblock" }, h("h4", {}, "Points forts"), h("p", { class: "ptext" }, p.strengths)) : null,
          p.to_improve ? h("div", { class: "bblock" }, h("h4", {}, "Axes de progrès"), h("p", { class: "ptext" }, p.to_improve)) : null) : null,
        gl.length ? sec("Objectifs de la saison", h("ul", {}, gl.map(g => h("li", { class: g.status === "atteint" ? "ok" : "" }, g.body + (g.status === "atteint" ? " ✓ atteint" : " (en cours)"))))) : null,
        opts.mot && mot && mot.body ? sec("Le mot du coach", h("p", { class: "ptext" }, mot.body)) : null,
        h("footer", { class: "pfoot" }, "Fiche de saison · " + [team && team.name, season && season.label].filter(Boolean).join(" · ") + " · COACH ISMO"))
    ];
  }
  Object.assign(window.Views, { playerSeason: view });
})();
