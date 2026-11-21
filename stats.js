// Statistiques de match : points, tirs, lancers francs, fautes. Calculs, tableau d'un match et suivi match par match d'un joueur.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a), K = () => window.CalUtil;
  const NS = "http://www.w3.org/2000/svg";
  const PTS = { m2: 2, m3: 3, fm: 1 }, OPP = { o1: 1, o2: 2, o3: 3 };
  const zero = () => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, fouls: 0, reb: 0, tov: 0 });
  function add(t, k) {
    if (k === "m2") { t.pts += 2; t.fgm++; t.fga++; } else if (k === "x2") { t.fga++; }
    else if (k === "m3") { t.pts += 3; t.fgm++; t.fga++; t.tpm++; t.tpa++; } else if (k === "x3") { t.fga++; t.tpa++; }
    else if (k === "fm") { t.pts++; t.ftm++; t.fta++; } else if (k === "fx") { t.fta++; } else if (k === "foul") { t.fouls++; } else if (k === "reb") { t.reb++; } else if (k === "to") { t.tov++; }
  }
  const byPlayer = actions => { const by = {}; for (const a of actions) { if (!a.player_id || OPP[a.kind]) continue; add(by[a.player_id] || (by[a.player_id] = zero()), a.kind); } return by; };
  function scoreOf(actions) {
    const r = { us: 0, them: 0, per: {} };
    for (const a of actions) {
      const p = r.per[a.period] || (r.per[a.period] = { us: 0, them: 0 });
      if (OPP[a.kind]) { r.them += OPP[a.kind]; p.them += OPP[a.kind]; } else if (PTS[a.kind]) { r.us += PTS[a.kind]; p.us += PTS[a.kind]; }
    }
    return r;
  }
  const pct = (m, a) => a ? Math.round(100 * m / a) : null;
  const pctTxt = (m, a) => a ? pct(m, a) + " %" : "—";
  const ratio = (m, a) => a ? m + "/" + a : "—";
  const mmss = s => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  // Stats recopiées de la feuille de match (pas de tentatives, pas de rebonds ni de balles perdues).
  const boxPts = b => 2 * ((b.p2i || 0) + (b.p2e || 0)) + 3 * (b.p3 || 0) + (b.ft || 0);
  const boxOf = b => ({ pts: boxPts(b), fgm: (b.p2i || 0) + (b.p2e || 0) + (b.p3 || 0), p3: b.p3 || 0, ft: b.ft || 0, fouls: b.fouls || 0, starter: !!b.starter, seconds: b.seconds });
  const ptsOf = r => r.tracked ? r.s.pts : r.box ? r.box.pts : null;
  const foulsOf = r => r.tracked ? r.s.fouls : r.box ? r.box.fouls : null;

  // ---- tableau d'un match (après le match) ----
  function matchTable(e, P, stints, actions) {
    const by = byPlayer(actions), sc = scoreOf(actions);
    const secs = {}; for (const s of stints) if (s.out_s != null) secs[s.player_id] = (secs[s.player_id] || 0) + (s.out_s - s.in_s);
    const ids = [...new Set([...(e.squad || []), ...Object.keys(by), ...Object.keys(secs)])].filter(id => P[id]);
    if (!actions.length) return null;
    const rows = ids.map(id => ({ id, p: P[id], s: by[id] || zero(), m: secs[id] || 0 })).sort((a, b) => b.s.pts - a.s.pts || b.m - a.m);
    const T = rows.reduce((t, r) => { for (const k of Object.keys(t)) t[k] += r.s[k]; return t; }, zero());
    const nm = p => p.first_name + (p.last_name ? " " + p.last_name.charAt(0) + "." : "");
    return h("section", { class: "card" }, h("h3", { class: "tight" }, "Statistiques du match"),
      h("p", { class: "sub" }, "Saisies pendant le match depuis l'écran terrain. Le score " + sc.us + " – " + sc.them + " en est déduit."),
      h("div", { class: "tbl" }, h("table", { class: "stats" },
        h("thead", {}, h("tr", {}, ["Joueur", "Min", "Pts", "Tirs", "3 pts", "LF", "Reb", "BP", "Fautes"].map((x, i) => h("th", { class: i ? "r" : "" }, x)))),
        h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, (r.p.jersey != null ? "#" + r.p.jersey + " " : "") + nm(r.p)), h("td", { class: "r" }, mmss(r.m)), h("td", { class: "r strong" }, r.s.pts),
          h("td", { class: "r" }, ratio(r.s.fgm, r.s.fga)), h("td", { class: "r" }, ratio(r.s.tpm, r.s.tpa)), h("td", { class: "r" }, ratio(r.s.ftm, r.s.fta)), h("td", { class: "r" }, r.s.reb), h("td", { class: "r" }, r.s.tov), h("td", { class: "r" + (r.s.fouls >= 4 ? " bad" : "") }, r.s.fouls)))),
        h("tfoot", {}, h("tr", {}, h("td", {}, "Équipe"), h("td", { class: "r" }, ""), h("td", { class: "r strong" }, T.pts), h("td", { class: "r" }, ratio(T.fgm, T.fga) + " · " + pctTxt(T.fgm, T.fga)), h("td", { class: "r" }, ratio(T.tpm, T.tpa)), h("td", { class: "r" }, ratio(T.ftm, T.fta)), h("td", { class: "r" }, T.reb), h("td", { class: "r" }, T.tov), h("td", { class: "r" }, T.fouls))))));
  }

  // ---- tableau d'un match recopié de la feuille ----
  function sheetTable(e, P, boxes) {
    const rows = boxes.filter(b => P[b.player_id]).map(b => ({ b, p: P[b.player_id], x: boxOf(b) })).sort((a, c) => c.x.pts - a.x.pts || (c.b.seconds || 0) - (a.b.seconds || 0));
    if (!rows.length) return null;
    const T = rows.reduce((t, r) => { t.pts += r.x.pts; t.fgm += r.x.fgm; t.p3 += r.x.p3; t.ft += r.x.ft; t.fouls += r.x.fouls; t.sec += r.b.seconds || 0; return t; }, { pts: 0, fgm: 0, p3: 0, ft: 0, fouls: 0, sec: 0 });
    const nm = p => p.first_name + (p.last_name ? " " + p.last_name.charAt(0) + "." : "");
    const edit = h("button", { class: "small ghost", onclick: () => U().setView({ name: "boxEntry", id: e.id }) }, Icon("edit", 16), "Modifier la saisie");
    return h("section", { class: "card" }, h("div", { class: "row" }, h("h3", { class: "tight" }, "Statistiques (feuille de match)"), edit),
      h("p", { class: "sub" }, "Recopiées de la feuille de match officielle : seuls les tirs réussis sont connus."),
      h("div", { class: "tbl" }, h("table", { class: "stats" },
        h("thead", {}, h("tr", {}, ["Joueur", "Min", "Pts", "Tirs réuss.", "3 pts", "LF", "Fautes"].map((x, i) => h("th", { class: i ? "r" : "" }, x)))),
        h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, (r.b.starter ? "● " : "") + (r.p.jersey != null ? "#" + r.p.jersey + " " : "") + nm(r.p)), h("td", { class: "r" }, r.b.seconds != null ? mmss(r.b.seconds) : "—"), h("td", { class: "r strong" }, r.x.pts), h("td", { class: "r" }, r.x.fgm), h("td", { class: "r" }, r.x.p3), h("td", { class: "r" }, r.x.ft), h("td", { class: "r" + (r.x.fouls >= 4 ? " bad" : "") }, r.x.fouls)))),
        h("tfoot", {}, h("tr", {}, h("td", {}, "Équipe"), h("td", { class: "r" }, ""), h("td", { class: "r strong" }, T.pts), h("td", { class: "r" }, T.fgm), h("td", { class: "r" }, T.p3), h("td", { class: "r" }, T.ft), h("td", { class: "r" }, T.fouls))))),
      h("p", { class: "sub" }, "● = 5 de départ."));
  }

  // ---- données d'un joueur, match par match ----
  async function forPlayer(pid, tsId) {
    const [events, av, stints, actions, boxes] = await Promise.all([DB.live("events"), DB.live("match_availability"), DB.live("match_stints"), DB.live("match_actions"), DB.live("match_boxscores").catch(() => [])]);
    const now = Date.now(), rows = [];
    for (const e of events.filter(x => x.team_season_id === tsId && x.kind === "match" && x.status !== "annule").sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
      const a = av.find(x => x.event_id === e.id && x.player_id === pid && x.convoked);
      const sts = stints.filter(s => s.event_id === e.id && s.player_id === pid), acts = actions.filter(x => x.event_id === e.id && x.player_id === pid);
      const inSquad = (e.squad || []).includes(pid);
      const bx = boxes.find(x => x.event_id === e.id && x.player_id === pid);
      if (!(a || sts.length || acts.length || inSquad || bx)) continue;
      if (new Date(e.starts_at).getTime() > now && !sts.length && !acts.length) continue;
      const evAct = actions.filter(x => x.event_id === e.id);
      const s = zero(); acts.forEach(x => add(s, x.kind));
      const liveMin = sts.some(x => x.out_s != null) ? sum(sts.filter(x => x.out_s != null), x => x.out_s - x.in_s) : null;
      const useBox = bx && !acts.length;
      rows.push({ e, min: liveMin != null ? liveMin : (useBox && bx.seconds != null ? bx.seconds : null), s, tracked: evAct.length > 0, box: useBox ? boxOf(bx) : null });
    }
    return rows;
  }
  const METRICS = { pts: ["Points", r => ptsOf(r), v => String(v)], min: ["Minutes", r => r.min != null ? r.min / 60 : null, v => Math.round(v) + " min"],
    fg: ["Tirs %", r => r.tracked && r.s.fga ? pct(r.s.fgm, r.s.fga) : null, v => v + " %"], tp: ["3 pts %", r => r.tracked && r.s.tpa ? pct(r.s.tpm, r.s.tpa) : null, v => v + " %"],
    ft: ["LF %", r => r.tracked && r.s.fta ? pct(r.s.ftm, r.s.fta) : null, v => v + " %"], reb: ["Rebonds", r => r.tracked ? r.s.reb : null, v => String(v)], tov: ["Balles perdues", r => r.tracked ? r.s.tov : null, v => String(v)], fouls: ["Fautes", r => foulsOf(r), v => String(v)] };
  const state = { metric: "pts" };

  function chart(rows, key) {
    const [, get, fmtv] = METRICS[key];
    const pts = rows.map(r => ({ r, v: get(r) })).filter(x => x.v != null);
    if (!pts.length) return h("p", { class: "sub" }, "Pas encore de donnée pour cette courbe.");
    const W = 760, H = 210, pl = 12, pr = 12, pt = 26, pb = 40, n = pts.length, max = Math.max(1, ...pts.map(x => x.v)) * 1.12;
    const bw = Math.min(54, (W - pl - pr) / n * 0.6), step = (W - pl - pr) / n, avg = pts.reduce((t, x) => t + x.v, 0) / n;
    const el = (t, a, ...k) => { const x = document.createElementNS(NS, t); for (const [kk, v] of Object.entries(a || {})) x.setAttribute(kk, v); k.forEach(c => x.append(c)); return x; };
    const svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "statchart", role: "img", "aria-label": "Évolution : " + METRICS[key][0] });
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    svg.append(el("line", { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: "#2b392f", "stroke-width": 1 }));
    pts.forEach((x, i) => {
      const cx = pl + step * (i + 0.5), top = y(x.v), won = x.r.e.score_us != null && x.r.e.score_them != null ? x.r.e.score_us > x.r.e.score_them : null;
      svg.append(el("rect", { x: cx - bw / 2, y: top, width: bw, height: Math.max(2, H - pb - top), rx: 6, fill: "#23b574", opacity: i === n - 1 ? 1 : 0.72 }),
        el("text", { x: cx, y: top - 7, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "#ecf1ed", "font-family": "Barlow Condensed, sans-serif" }, fmtv(Math.round(x.v * 10) / 10)),
        el("text", { x: cx, y: H - pb + 17, "text-anchor": "middle", "font-size": 12.5, fill: "#98a99e" }, (x.r.e.opponent || "?").slice(0, 7)),
        el("text", { x: cx, y: H - pb + 32, "text-anchor": "middle", "font-size": 11.5, fill: "#6f8076" }, new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric", timeZone: "Europe/Paris" }).format(new Date(x.r.e.starts_at))));
    });
    svg.append(el("line", { x1: pl, x2: W - pr, y1: y(avg), y2: y(avg), stroke: "#f2b23a", "stroke-width": 1.5, "stroke-dasharray": "6 5" }),
      el("text", { x: W - pr, y: y(avg) - 5, "text-anchor": "end", "font-size": 12.5, fill: "#f2b23a" }, "moyenne " + fmtv(Math.round(avg * 10) / 10)));
    return h("div", { class: "chartbox" }, svg);
  }


  // ---- synthèse d'une saison pour un joueur (aperçu coach + fiche de fin de saison) ----
  function summary(rows) {
    const gp = rows.length, A = (a, f) => a.length ? a.reduce((t, x) => t + f(x), 0) / a.length : null;
    const withP = rows.filter(r => ptsOf(r) != null), withM = rows.filter(r => r.min != null), tr = rows.filter(r => r.tracked);
    const T = tr.reduce((t, r) => { for (const k of Object.keys(t)) t[k] += r.s[k]; return t; }, zero());
    const p3 = sum(rows, r => r.tracked ? r.s.tpm : r.box ? r.box.p3 : 0), ft = sum(rows, r => r.tracked ? r.s.ftm : r.box ? r.box.ft : 0);
    const ptsTot = sum(withP, r => ptsOf(r)), minTot = sum(withM, r => r.min);
    const hi = withP.reduce((b, r) => !b || ptsOf(r) > ptsOf(b) ? r : b, null);
    const last = withP.slice(-3), prev = withP.slice(0, -3);
    const trend = last.length >= 2 && prev.length ? A(last, r => ptsOf(r)) - A(prev, r => ptsOf(r)) : null;
    const res = rows.filter(r => r.e.score_us != null && r.e.score_them != null);
    return { gp, starts: rows.filter(r => r.box && r.box.starter).length, ptsTot, ptsAvg: A(withP, r => ptsOf(r)), hi, minAvg: A(withM, r => r.min), minTot,
      per10: minTot > 0 ? Math.round(100 * sum(withM.filter(r => ptsOf(r) != null), r => ptsOf(r)) / (sum(withM.filter(r => ptsOf(r) != null), r => r.min) / 600)) / 100 : null,
      p3, ft, foulsAvg: A(rows.filter(r => foulsOf(r) != null), r => foulsOf(r)), fg: pct(T.fgm, T.fga), tp: pct(T.tpm, T.tpa), ftp: pct(T.ftm, T.fta), nTr: tr.length,
      reb: tr.length ? T.reb / tr.length : null, tov: tr.length ? T.tov / tr.length : null,
      win: res.filter(r => r.e.score_us > r.e.score_them).length, loss: res.filter(r => r.e.score_us < r.e.score_them).length, trend, withP };
  }
  const f1 = v => v == null ? "—" : (Math.round(v * 10) / 10).toString().replace(".", ",");
  function overview(rows) {
    const m = summary(rows), tr = m.trend;
    const items = [["Points / match", f1(m.ptsAvg)], ["Meilleur match", m.hi ? ptsOf(m.hi) + " pts" : "—"], ["Minutes / match", m.minAvg != null ? mmss(m.minAvg) : "—"], ["Points / 10 min", f1(m.per10)],
      ["Titularisations", m.starts || "—"], ["Paniers à 3 pts", m.p3 || "—"], ["Lancers francs réussis", m.ft || "—"], ["Bilan quand il joue", (m.win + m.loss) ? m.win + " V – " + m.loss + " D" : "—"]];
    return h("section", { class: "card ovw" }, h("h3", { class: "tight" }, "Aperçu coach"),
      h("div", { class: "kpis" }, items.map(([l, v]) => h("div", { class: "kpi" }, h("b", {}, v), h("span", {}, l)))),
      tr != null ? h("p", { class: "trend " + (tr > 0.5 ? "up" : tr < -0.5 ? "dn" : "eq") }, (tr > 0.5 ? "▲ En progression : " : tr < -0.5 ? "▼ En baisse : " : "● Stable : ") + "3 derniers matchs " + (tr > 0 ? "+" : "") + f1(tr) + " pt vs le début de saison.") : h("p", { class: "sub" }, "La tendance apparaît dès 4 matchs avec des points saisis."),
      m.nTr ? h("p", { class: "sub" }, "Adresse (matchs suivis en direct, " + m.nTr + ") : tirs " + (m.fg ?? "—") + " % · 3 pts " + (m.tp ?? "—") + " % · LF " + (m.ftp ?? "—") + " %.") : h("p", { class: "sub" }, "Les pourcentages d'adresse demandent un suivi en direct (la feuille de match ne donne que les tirs réussis)."));
  }

  async function playerSection(p, tsId, rerender) {
    const rows = await forPlayer(p.id, tsId);
    if (!rows.length) return [h("h3", {}, "Matchs et statistiques"), h("section", { class: "card" }, h("p", { class: "sub" }, "Aucun match pour l'instant. Les matchs où ce joueur est convoqué ou utilisé apparaissent ici, avec ses statistiques saisies depuis l'écran terrain."))];
    const tr = rows.filter(r => r.tracked), T = tr.reduce((t, r) => { for (const k of Object.keys(t)) t[k] += r.s[k]; return t; }, zero());
    const mins = rows.filter(r => r.min != null);
    const resChip = e => e.score_us == null || e.score_them == null ? null : h("span", { class: "pill " + (e.score_us > e.score_them ? "ok" : e.score_us < e.score_them ? "bad" : "warn") }, (e.score_us > e.score_them ? "V " : e.score_us < e.score_them ? "D " : "N ") + e.score_us + "-" + e.score_them);
    const fd = iso => K().cap(new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso)));
    const avg = (v, n) => n ? (Math.round(10 * v / n) / 10).toString().replace(".", ",") : "—";
    return [
      h("h3", {}, "Matchs et statistiques (" + rows.length + ")"),
      overview(rows),
      h("section", { class: "card" },
        h("div", { class: "kpis" },
          [["Matchs", rows.length], ["Min / match", mins.length ? mmss(sum(mins, r => r.min) / mins.length) : "—"], ["Pts / match", avg(sum(rows.filter(r => ptsOf(r) != null), r => ptsOf(r)), rows.filter(r => ptsOf(r) != null).length)], ["Tirs", pctTxt(T.fgm, T.fga)], ["3 pts", pctTxt(T.tpm, T.tpa)], ["LF", pctTxt(T.ftm, T.fta)], ["Reb / match", avg(T.reb, tr.length)], ["BP / match", avg(T.tov, tr.length)], ["Fautes / match", avg(sum(rows.filter(r => foulsOf(r) != null), r => foulsOf(r)), rows.filter(r => foulsOf(r) != null).length)]]
            .map(([l, v]) => h("div", { class: "kpi" }, h("b", {}, v), h("span", {}, l)))),
        h("div", { class: "chips filter" }, Object.entries(METRICS).map(([k, m]) => h("button", { class: "chip" + (state.metric === k ? " on" : ""), onclick: () => { state.metric = k; rerender(); } }, m[0]))),
        chart(rows, state.metric),
        h("div", { class: "tbl" }, h("table", { class: "stats" },
          h("thead", {}, h("tr", {}, ["Match", "Rés.", "Min", "Pts", "Tirs", "3 pts", "LF", "Reb", "BP", "F"].map((x, i) => h("th", { class: i > 1 ? "r" : "" }, x)))),
          h("tbody", {}, rows.slice().reverse().map(r => h("tr", { class: "click", onclick: () => U().setView({ name: "match", id: r.e.id }) },
            h("td", {}, fd(r.e.starts_at) + " · " + (r.e.opponent || "?")), h("td", {}, resChip(r.e)), h("td", { class: "r" }, r.min != null ? mmss(r.min) : "—"),
            h("td", { class: "r strong" }, ptsOf(r) ?? "—"), h("td", { class: "r" }, r.tracked ? ratio(r.s.fgm, r.s.fga) : r.box ? r.box.fgm + " réuss." : "—"), h("td", { class: "r" }, r.tracked ? ratio(r.s.tpm, r.s.tpa) : r.box ? r.box.p3 + " réuss." : "—"), h("td", { class: "r" }, r.tracked ? ratio(r.s.ftm, r.s.fta) : r.box ? r.box.ft + " réuss." : "—"), h("td", { class: "r" }, r.tracked ? r.s.reb : "—"), h("td", { class: "r" }, r.tracked ? r.s.tov : "—"), h("td", { class: "r" + (foulsOf(r) >= 4 ? " bad" : "") }, foulsOf(r) ?? "—")))))),
        h("p", { class: "sub" }, "Un « — » veut dire qu'aucune stat n'a été saisie pour ce match (terrain ou feuille de match). « réuss. » : seuls les tirs réussis sont connus (stats recopiées de la feuille). Touche une ligne pour ouvrir le match.")),
    ];
  }

  // bloc pour le PDF du joueur
  async function pdfBlock(p, tsId) {
    const rows = (await forPlayer(p.id, tsId)).filter(r => r.tracked || r.min != null);
    if (!rows.length) return null;
    const fd = iso => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
    return h("section", { class: "psec" }, h("h4", {}, "Ses matchs"), h("table", { class: "ptable" },
      h("thead", {}, h("tr", {}, ["Match", "Min", "Pts", "Tirs", "3 pts", "LF", "Reb", "BP", "F"].map(x => h("th", {}, x)))),
      h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, fd(r.e.starts_at) + " · " + (r.e.opponent || "?")), h("td", {}, r.min != null ? mmss(r.min) : "—"), h("td", {}, r.tracked ? r.s.pts : "—"), h("td", {}, r.tracked ? ratio(r.s.fgm, r.s.fga) : "—"), h("td", {}, r.tracked ? ratio(r.s.tpm, r.s.tpa) : "—"), h("td", {}, r.tracked ? ratio(r.s.ftm, r.s.fta) : "—"), h("td", {}, r.tracked ? r.s.reb : "—"), h("td", {}, r.tracked ? r.s.tov : "—"), h("td", {}, r.tracked ? r.s.fouls : "—"))))));
  }

  window.StatsUtil = { summary, f1, byPlayer, scoreOf, zero, add, pct, pctTxt, ratio, mmss, matchTable, sheetTable, boxOf, boxPts, forPlayer, playerSection, pdfBlock };
})();
