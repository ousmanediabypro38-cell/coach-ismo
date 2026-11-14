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

  // ---- données d'un joueur, match par match ----
  async function forPlayer(pid, tsId) {
    const [events, av, stints, actions] = await Promise.all([DB.live("events"), DB.live("match_availability"), DB.live("match_stints"), DB.live("match_actions")]);
    const now = Date.now(), rows = [];
    for (const e of events.filter(x => x.team_season_id === tsId && x.kind === "match" && x.status !== "annule").sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
      const a = av.find(x => x.event_id === e.id && x.player_id === pid && x.convoked);
      const sts = stints.filter(s => s.event_id === e.id && s.player_id === pid), acts = actions.filter(x => x.event_id === e.id && x.player_id === pid);
      const inSquad = (e.squad || []).includes(pid);
      if (!(a || sts.length || acts.length || inSquad)) continue;
      if (new Date(e.starts_at).getTime() > now && !sts.length && !acts.length) continue;
      const evAct = actions.filter(x => x.event_id === e.id);
      const s = zero(); acts.forEach(x => add(s, x.kind));
      rows.push({ e, min: sts.some(x => x.out_s != null) ? sum(sts.filter(x => x.out_s != null), x => x.out_s - x.in_s) : null, s, tracked: evAct.length > 0 });
    }
    return rows;
  }
  const METRICS = { pts: ["Points", r => r.tracked ? r.s.pts : null, v => String(v)], min: ["Minutes", r => r.min != null ? r.min / 60 : null, v => Math.round(v) + " min"],
    fg: ["Tirs %", r => r.tracked && r.s.fga ? pct(r.s.fgm, r.s.fga) : null, v => v + " %"], tp: ["3 pts %", r => r.tracked && r.s.tpa ? pct(r.s.tpm, r.s.tpa) : null, v => v + " %"],
    ft: ["LF %", r => r.tracked && r.s.fta ? pct(r.s.ftm, r.s.fta) : null, v => v + " %"], reb: ["Rebonds", r => r.tracked ? r.s.reb : null, v => String(v)], tov: ["Balles perdues", r => r.tracked ? r.s.tov : null, v => String(v)], fouls: ["Fautes", r => r.tracked ? r.s.fouls : null, v => String(v)] };
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
      h("section", { class: "card" },
        h("div", { class: "kpis" },
          [["Matchs", rows.length], ["Min / match", mins.length ? mmss(sum(mins, r => r.min) / mins.length) : "—"], ["Pts / match", avg(T.pts, tr.length)], ["Tirs", pctTxt(T.fgm, T.fga)], ["3 pts", pctTxt(T.tpm, T.tpa)], ["LF", pctTxt(T.ftm, T.fta)], ["Reb / match", avg(T.reb, tr.length)], ["BP / match", avg(T.tov, tr.length)], ["Fautes / match", avg(T.fouls, tr.length)]]
            .map(([l, v]) => h("div", { class: "kpi" }, h("b", {}, v), h("span", {}, l)))),
        h("div", { class: "chips filter" }, Object.entries(METRICS).map(([k, m]) => h("button", { class: "chip" + (state.metric === k ? " on" : ""), onclick: () => { state.metric = k; rerender(); } }, m[0]))),
        chart(rows, state.metric),
        h("div", { class: "tbl" }, h("table", { class: "stats" },
          h("thead", {}, h("tr", {}, ["Match", "Rés.", "Min", "Pts", "Tirs", "3 pts", "LF", "Reb", "BP", "F"].map((x, i) => h("th", { class: i > 1 ? "r" : "" }, x)))),
          h("tbody", {}, rows.slice().reverse().map(r => h("tr", { class: "click", onclick: () => U().setView({ name: "match", id: r.e.id }) },
            h("td", {}, fd(r.e.starts_at) + " · " + (r.e.opponent || "?")), h("td", {}, resChip(r.e)), h("td", { class: "r" }, r.min != null ? mmss(r.min) : "—"),
            h("td", { class: "r strong" }, r.tracked ? r.s.pts : "—"), h("td", { class: "r" }, r.tracked ? ratio(r.s.fgm, r.s.fga) : "—"), h("td", { class: "r" }, r.tracked ? ratio(r.s.tpm, r.s.tpa) : "—"), h("td", { class: "r" }, r.tracked ? ratio(r.s.ftm, r.s.fta) : "—"), h("td", { class: "r" }, r.tracked ? r.s.reb : "—"), h("td", { class: "r" }, r.tracked ? r.s.tov : "—"), h("td", { class: "r" + (r.tracked && r.s.fouls >= 4 ? " bad" : "") }, r.tracked ? r.s.fouls : "—")))))),
        h("p", { class: "sub" }, "Un « — » veut dire que ce match n'a pas été suivi sur l'écran terrain. Touche une ligne pour ouvrir le match.")),
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

  window.StatsUtil = { byPlayer, scoreOf, zero, add, pct, pctTxt, ratio, mmss, matchTable, forPlayer, playerSection, pdfBlock };
})();
