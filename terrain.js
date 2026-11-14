// Écran terrain pendant le match : joueurs sur le terrain (placés selon leur poste), banc, tirs, lancers francs, fautes, score automatique.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a), SU = () => window.StatsUtil, M = () => window.MatchCore;
  const NS = "http://www.w3.org/2000/svg";
  const SLOTS = [[600, 280], [730, 440], [730, 120], [830, 215], [840, 350]];   // postes 1 à 5, dans la moitié attaquée (viewBox 930 × 560)
  const TS = { ev: null, court: null, bench: null };
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function posteOf(p) {
    const t = norm(p && p.position), d = t.match(/[1-5]/); if (d) return +d[0];
    if (/meneur|point guard/.test(t)) return 1; if (/arriere|guard|shooteur/.test(t)) return 2; if (/ailier fort|power/.test(t)) return 4;
    if (/ailier|wing/.test(t)) return 3; if (/pivot|interieur|center|centre/.test(t)) return 5; return 0;
  }
  function slotsFor(L, P) {
    const out = {}, used = new Set(), ex = L.slots || {};
    for (const id of L.court) if (ex[id] != null && !used.has(ex[id])) { out[id] = ex[id]; used.add(ex[id]); }
    for (const id of L.court.filter(i => out[i] == null).sort((a, b) => posteOf(P[a]) - posteOf(P[b]))) {
      let s = posteOf(P[id]) - 1; if (s < 0 || used.has(s)) s = [0, 1, 2, 3, 4].find(i => !used.has(i)); if (s == null) s = 0;
      out[id] = s; used.add(s);
    }
    return out;
  }
  async function syncScore(eid) {
    const cur = await DB.get("events", eid), acts = (await DB.live("match_actions")).filter(a => a.event_id === eid), sc = SU().scoreOf(acts);
    cur.score_us = sc.us; cur.score_them = sc.them; cur.periods = cur.periods || [];
    const maxQ = Math.max(cur.periods.length, ...Object.keys(sc.per).map(Number), 0);
    for (let q = 1; q <= maxQ; q++) { const v = sc.per[q] || { us: 0, them: 0 }; cur.periods[q - 1] = { ...(cur.periods[q - 1] || {}), us: v.us, them: v.them }; }
    await DB.save("events", cur);
  }

  const el = (t, a, ...k) => { const x = document.createElementNS(NS, t); for (const [kk, v] of Object.entries(a || {})) if (v != null) x.setAttribute(kk, v); k.forEach(c => c != null && x.append(c)); return x; };
  function courtSvg(logo) {
    const svg = el("svg", { viewBox: "0 0 930 560", class: "tr-svg", role: "img", "aria-label": "Terrain" });
    const f = el("filter", { id: "trglow", x: "-10%", y: "-10%", width: "120%", height: "120%" }, el("feGaussianBlur", { stdDeviation: 3, result: "b" }), el("feMerge", {}, el("feMergeNode", { in: "b" }), el("feMergeNode", { in: "SourceGraphic" })));
    const g = el("g", { fill: "none", stroke: "#3ccf8b", "stroke-width": 3, filter: "url(#trglow)" },
      el("rect", { x: 14, y: 34, width: 902, height: 492, rx: 4 }), el("line", { x1: 465, y1: 34, x2: 465, y2: 526 }), el("circle", { cx: 465, cy: 280, r: 74 }),
      el("rect", { x: 14, y: 196, width: 190, height: 168 }), el("rect", { x: 726, y: 196, width: 190, height: 168 }),
      el("path", { d: "M204 222 A58 58 0 0 1 204 338" }), el("path", { d: "M726 222 A58 58 0 0 0 726 338" }),
      el("path", { d: "M14 82 H112 A210 210 0 0 1 112 478 H14" }), el("path", { d: "M916 82 H818 A210 210 0 0 0 818 478 H916" }),
      el("circle", { cx: 52, cy: 280, r: 10 }), el("circle", { cx: 878, cy: 280, r: 10 }), el("line", { x1: 36, y1: 256, x2: 36, y2: 304 }), el("line", { x1: 894, y1: 256, x2: 894, y2: 304 }));
    svg.append(el("defs", {}, f), el("rect", { x: 0, y: 0, width: 930, height: 560, rx: 18, fill: "#060d08" }), g,
      logo ? el("image", { href: logo, x: 405, y: 218, width: 120, height: 124, preserveAspectRatio: "xMidYMid meet", opacity: 0.95 })
        : el("text", { x: 465, y: 307, "text-anchor": "middle", "font-size": 84, "font-weight": 700, fill: "#3ccf8b", "font-family": "Barlow Condensed, sans-serif", opacity: 0.85 }, "7"));
    return svg;
  }

  const BTN = [["m3", "+3 réussi", "à 3 points", "ok"], ["x3", "3 raté", "à 3 points", "no"], ["m2", "+2 réussi", "à 2 points", "ok"], ["x2", "2 raté", "à 2 points", "no"], ["fm", "+1 réussi", "lancer franc", "ok"], ["fx", "LF raté", "lancer franc", "no"], ["foul", "Faute", "personnelle", "fl"]];
  const BTN2 = [["reb", "Rebond", "rb"], ["to", "Balle perdue", "to"]];

  async function view(e, P, stints) {
    const Mc = M(), L = e.live, rerender = () => U().setView({ name: "match", id: e.id });
    Mc.wakeOn();
    if (TS.ev !== e.id) { TS.ev = e.id; TS.court = null; TS.bench = null; }
    const [teams, allActs] = await Promise.all([U().loadTeams(), DB.live("match_actions")]);
    const acts = allActs.filter(a => a.event_id === e.id), by = SU().byPlayer(acts), sc = SU().scoreOf(acts);
    const team = teams.find(x => x.ts.id === e.team_season_id), home = e.home_away !== "exterieur";
    let logo = null; try { if (home) logo = LogoUtil.teamLogoSrc(team ? team.team : null); else { const c = await LogoUtil.clubFor(e.opponent); logo = c && c.logo; } } catch (x) {}
    const tot = Mc.totals(stints, e), squad = e.squad || Object.keys(P), court = L.court, bench = squad.filter(id => !court.includes(id) && P[id]);
    const slots = slotsFor(L, P), nm = id => P[id] ? P[id].first_name : "Joueur";
    const fresh = () => DB.get("events", e.id);

    const swap = async (out, inn) => {
      const cur = await fresh(), sl = { ...slots }; sl[inn] = sl[out]; delete sl[out]; cur.live.slots = sl;
      await Mc.substitute(cur, [out], [inn]); TS.court = null; TS.bench = null; U().toast(nm(inn) + " remplace " + nm(out) + "."); rerender();
    };
    const enter = async inn => {
      const cur = await fresh(), used = new Set(Object.values(slots)), free = [0, 1, 2, 3, 4].find(i => !used.has(i)); cur.live.slots = { ...slots, [inn]: free == null ? 0 : free };
      await Mc.substitute(cur, [], [inn]); TS.bench = null; rerender();
    };
    const record = async (kind, pid) => {
      await DB.save("match_actions", { event_id: e.id, player_id: pid || null, kind, period: L.q, t_s: Math.round(Mc.elapsed(e)), ts_ms: Date.now() });
      await syncScore(e.id); TS.court = null; rerender();
    };
    const undoAction = async () => {
      const last = acts.slice().sort((a, b) => (b.ts_ms || 0) - (a.ts_ms || 0))[0]; if (!last) return;
      await DB.remove("match_actions", last); await syncScore(e.id); rerender();
    };
    const tapCourt = id => { if (TS.bench) swap(id, TS.bench); else { TS.court = TS.court === id ? null : id; rerender(); } };
    const tapBench = id => { if (TS.court) swap(TS.court, id); else if (court.length < 5) enter(id); else { TS.bench = TS.bench === id ? null : id; rerender(); } };

    // --- score, chrono ---
    const clock = h("span", { class: "tr-clock" }, Mc.fmt(Mc.elapsed(e)));
    const tick = setInterval(() => { if (!clock.isConnected) { clearInterval(tick); return; } clock.textContent = Mc.fmt(Mc.elapsed(e)); }, 500);
    const qn = Mc.periodName(e, L.q);
    const myName = team ? team.team.name : "Nous", oppName = e.opponent || "Adversaire";
    const opp = k => h("button", { class: "ghost small", onclick: () => record(k, null) }, "+" + k.slice(1) + " adv.");
    const top = h("section", { class: "card tr-top" },
      h("div", { class: "tr-score" }, h("div", { class: "tr-t" }, h("small", {}, myName), h("b", { class: "us" }, sc.us)), h("span", { class: "tr-dash" }, "–"), h("div", { class: "tr-t" }, h("small", {}, oppName), h("b", {}, sc.them))),
      h("div", { class: "tr-mid" }, L.qstart ? clock : h("span", { class: "tr-clock off" }, "0:00"), h("span", { class: "sub" }, qn + (L.qstart ? " · chrono indicatif" : " · prêt"))),
      h("div", { class: "tr-btns" }, opp("o1"), opp("o2"), opp("o3"),
        L.qstart
          ? h("button", { class: "ghost", onclick: async () => { if (!confirm("Terminer " + qn.toLowerCase() + " ?")) return; const cur = await fresh(); await Mc.endPeriod(cur); TS.court = TS.bench = null; rerender(); } }, Icon("check", 18), "Fin de période")
          : h("button", { onclick: async () => { if (court.length !== 5 && !confirm("Il y a " + court.length + " joueurs sur le terrain. Lancer quand même ?")) return; const cur = await fresh(); cur.live.slots = slots; await Mc.startPeriod(cur); rerender(); } }, Icon("clock", 18), "Coup d'envoi")));

    // --- terrain ---
    const token = id => {
      const [x, y] = SLOTS[slots[id]] || SLOTS[0], s = by[id] || SU().zero(), fl = s.fouls;
      return h("button", { type: "button", class: "tok" + (TS.court === id ? " sel" : "") + (fl >= 5 ? " out" : fl >= 4 ? " warn" : "") + (TS.bench ? " target" : ""), style: "left:" + (x / 9.3).toFixed(2) + "%;top:" + (y / 5.6).toFixed(2) + "%", onclick: () => tapCourt(id) },
        h("i", {}, P[id] && P[id].jersey != null ? P[id].jersey : "•"), h("b", {}, nm(id)), h("em", {}, s.pts + (s.pts > 1 ? " pts" : " pt") + (fl ? " · " + fl + "F" : "")));
    };
    const courtBox = h("div", { class: "tr-court" }, courtSvg(logo), court.map(token),
      court.length < 5 ? h("div", { class: "tr-hint" }, "Il manque " + (5 - court.length) + " joueur(s) : touche un joueur du banc pour le faire entrer.") : null);

    // --- banc ---
    const benchPanel = h("aside", { class: "tr-bench" }, h("h4", {}, "BANC"),
      bench.length ? bench.map(id => { const s = by[id] || SU().zero();
        return h("button", { type: "button", class: "tb" + (TS.bench === id ? " up" : "") + (TS.court ? " target" : ""), onclick: () => tapBench(id) },
          h("i", {}, P[id].jersey != null ? P[id].jersey : "•"), h("div", {}, h("b", {}, P[id].first_name + (P[id].last_name ? " " + P[id].last_name.charAt(0) + "." : "")), h("small", {}, Mc.fmt((tot[id] || { tot: 0 }).tot) + " joué" + (s.fouls ? " · " + s.fouls + "F" : ""))), h("em", {}, s.pts + (s.pts > 1 ? " pts" : " pt"))); })
        : h("p", { class: "sub" }, "Personne sur le banc."),
      h("p", { class: "sub tr-help" }, "Remplacement : touche un joueur du banc, puis celui qu'il remplace."));

    // --- actions ---
    const selId = TS.court && court.includes(TS.court) ? TS.court : null, ss = selId ? (by[selId] || SU().zero()) : null;
    const act = h("section", { class: "tr-act" + (selId ? "" : " idle") },
      selId ? h("div", { class: "tr-who" }, h("b", {}, (P[selId].jersey != null ? "#" + P[selId].jersey + " " : "") + nm(selId)), h("small", {}, Mc.fmt((tot[selId] || { tot: 0 }).tot) + " joué · " + ss.pts + " pts", h("br"), SU().ratio(ss.fgm, ss.fga) + " tirs · " + SU().ratio(ss.tpm, ss.tpa) + " à 3 pts · " + ss.fouls + " faute" + (ss.fouls > 1 ? "s" : "") + " · " + ss.reb + " reb · " + ss.tov + " BP"))
        : h("div", { class: "tr-who" }, h("b", {}, "Touche un joueur"), h("small", {}, "sur le terrain, pour noter un tir ou une faute")),
      h("div", { class: "tr-keys" }, BTN.map(([k, l, s, c]) => h("button", { type: "button", class: "tk r1 " + c, disabled: !selId, onclick: () => record(k, selId) }, l, h("small", {}, s))),
        BTN2.map(([k, l, c]) => h("button", { type: "button", class: "tk r2 " + c, disabled: !selId, onclick: () => record(k, selId) }, l))));

    const last = acts.slice().sort((a, b) => (b.ts_ms || 0) - (a.ts_ms || 0))[0];
    const LAB = { m2: "+2", x2: "2 raté", m3: "+3", x3: "3 raté", fm: "+1 LF", fx: "LF raté", foul: "faute", reb: "rebond", to: "balle perdue", o1: "+1 adv.", o2: "+2 adv.", o3: "+3 adv." };
    const foot = h("div", { class: "tr-foot" },
      last ? h("button", { class: "ghost small", onclick: undoAction }, "Annuler : " + (last.player_id && P[last.player_id] ? nm(last.player_id) + " " : "") + LAB[last.kind]) : null,
      L.last ? h("button", { class: "ghost small", onclick: async () => { const cur = await fresh(); await Mc.undoLast(cur); TS.court = TS.bench = null; rerender(); } }, "Annuler le dernier changement") : null,
      h("button", { class: "ghost small", onclick: () => { Mc.setMode("liste"); rerender(); } }, "Vue liste"),
      h("button", { class: "ghost small", onclick: async () => { if (!confirm("Terminer le match ? Tu pourras corriger les temps ensuite.")) return; const cur = await fresh(); await Mc.finish(cur); Mc.releaseWake(); rerender(); } }, "Terminer le match"));

    return h("div", { class: "tr-wrap" }, top, h("div", { class: "tr-main" }, courtBox, benchPanel), act, foot);
  }

  window.TerrainUtil = { view };
})();
