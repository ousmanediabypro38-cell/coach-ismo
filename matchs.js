// Matchs : feuille de match, changements en direct, temps de jeu et résultat.
// Principe : pendant le match on touche seulement les changements ; le chrono est indicatif (il tourne aussi pendant les arrêts de jeu).
// À la fin de chaque quart-temps, tous les passages sont recalés sur la durée officielle du quart-temps.
(function () {
  const DB = window.DB, U = () => window.UI;
  const h = (...a) => U().h(...a);
  const pad = n => String(n).padStart(2, "0");
  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + pad(s % 60); };
  const parseT = t => {
    t = String(t || "").trim().replace(",", ".");
    let m = t.match(/^(\d+)\s*[:']\s*(\d{1,2})$/); if (m) return +m[1] * 60 + Math.min(59, +m[2]);
    m = t.match(/^\d+(\.\d+)?$/); return m ? Math.round(parseFloat(t) * 60) : null;   // « 4 » ou « 4.5 » = minutes
  };
  const pname = p => p ? (p.first_name + (p.last_name ? " " + p.last_name.charAt(0) + "." : "")) : "Joueur supprimé";
  const periodLen = (e, q) => q <= (e.nb_periods || 4) ? (e.game_min || 10) * 60 : 300;
  const periodName = (e, q) => q <= (e.nb_periods || 4) ? ((e.nb_periods || 4) === 2 ? "Mi-temps " : "Quart-temps ") + q : "Prolongation " + (q - (e.nb_periods || 4));

  // État de l'écran gardé hors de l'écran (l'appli se redessine à chaque synchronisation)
  const setup = {};                  // réglages avant le match, par rencontre
  const sel = { ev: null, out: new Set(), inn: new Set() };
  const open = {};                   // fiches joueur ouvertes dans l'éditeur de passages
  let wake = null;

  async function roster(e) {
    const [mem, pl] = await Promise.all([DB.live("memberships"), DB.live("players")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    return mem.filter(m => m.team_season_id === e.team_season_id && P[m.player_id])
      .map(m => ({ ...P[m.player_id], jersey: m.jersey_number }))
      .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.first_name.localeCompare(b.first_name));
  }
  const stintsOf = async eid => (await DB.live("match_stints")).filter(s => s.event_id === eid);
  const elapsed = e => e.live && e.live.qstart ? (Date.now() - e.live.qstart) / 1000 : 0;

  function totals(stints, e) {
    const by = {};
    const now = e && e.live && e.live.qstart ? elapsed(e) : null;
    for (const s of stints) {
      const t = by[s.player_id] || (by[s.player_id] = { tot: 0, per: {} });
      const out = s.out_s != null ? s.out_s : (e && e.live && s.period === e.live.q && now != null ? now : s.in_s);
      const d = Math.max(0, out - s.in_s);
      t.tot += d; t.per[s.period] = (t.per[s.period] || 0) + d;
    }
    return by;
  }
  const result = e => e.score_us == null || e.score_them == null ? null
    : e.score_us > e.score_them ? { l: "Victoire", c: "ok" } : e.score_us < e.score_them ? { l: "Défaite", c: "bad" } : { l: "Nul", c: "warn" };
  const resultChip = e => { const r = e.kind === "match" ? result(e) : null; return r ? h("span", { class: "pill " + r.c }, r.l + " " + e.score_us + " – " + e.score_them) : null; };

  // ---------- opérations en direct ----------
  async function startPeriod(e) {
    const q = e.live.q;
    for (const pid of e.live.court) await DB.save("match_stints", { event_id: e.id, player_id: pid, period: q, in_s: 0, out_s: null });
    e.live.qstart = Date.now(); e.live.last = null; await DB.save("events", e);
  }
  async function substitute(e, outs, ins) {
    const t = elapsed(e), q = e.live.q, stints = await stintsOf(e.id);
    const closed = [], created = [];
    if (e.live.qstart) {
      for (const pid of outs) {
        const s = stints.find(x => x.player_id === pid && x.period === q && x.out_s == null);
        if (s) { s.out_s = t; await DB.save("match_stints", s); closed.push(s.id); }
      }
      for (const pid of ins) { const n = await DB.save("match_stints", { event_id: e.id, player_id: pid, period: q, in_s: t, out_s: null }); created.push(n.id); }
    }
    e.live.court = [...e.live.court.filter(x => !outs.includes(x)), ...ins];
    e.live.last = { outs, ins, closed, created, court: null };
    await DB.save("events", e);
  }
  async function undoLast(e) {
    const l = e.live.last; if (!l) return;
    for (const id of l.created) { const s = await DB.get("match_stints", id); if (s) await DB.remove("match_stints", s); }
    for (const id of l.closed) { const s = await DB.get("match_stints", id); if (s) { s.out_s = null; await DB.save("match_stints", s); } }
    e.live.court = [...e.live.court.filter(x => !l.ins.includes(x)), ...l.outs]; e.live.last = null; await DB.save("events", e);
  }
  async function endPeriod(e) {
    const q = e.live.q, game = periodLen(e, q), real = elapsed(e);
    let k = real > 20 ? game / real : 1; if (k < 0.4 || k > 2.5) k = 1;
    for (const s of (await stintsOf(e.id)).filter(x => x.period === q)) {
      s.in_s = Math.min(game, Math.round(s.in_s * k));
      s.out_s = s.out_s == null ? game : Math.min(game, Math.round(s.out_s * k));
      await DB.save("match_stints", s);
    }
    e.periods = e.periods || []; e.periods[q - 1] = { ...(e.periods[q - 1] || {}), game_s: game };
    e.live.q = q + 1; e.live.qstart = null; e.live.last = null; await DB.save("events", e);
  }
  async function finish(e) {
    if (e.live.qstart) await endPeriod(e);
    e.live = null; if (e.status !== "annule") e.status = "joue"; await DB.save("events", e);
  }

  // ---------- écran principal ----------
  async function matchView(v) {
    const e = await DB.get("events", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "cal" }); return []; }
    if (sel.ev !== e.id) { sel.ev = e.id; sel.out.clear(); sel.inn.clear(); }
    const teams = await U().loadTeams();
    const t = teams.find(x => x.ts.id === e.team_season_id);
    const head = [
      h("button", { class: "small ghost back", onclick: () => { releaseWake(); U().setView({ name: "event", id: e.id }); } }, Icon("chevL", 18), "Fiche de la rencontre"),
      h("h2", {}, (t ? t.team.name : "Match") + (e.opponent ? " — " + e.opponent : "")),
    ];
    const players = await roster(e), P = Object.fromEntries(players.map(p => [p.id, p]));
    const stints = await stintsOf(e.id);
    for (const s of stints) if (!P[s.player_id]) { const p = (await DB.get("players", s.player_id)); if (p) P[s.player_id] = { ...p, jersey: null }; }
    if (e.live) return [...head, liveView(e, P, stints)];
    if (e.squad || stints.length || e.score_us != null) { releaseWake(); return [...head, ...summaryView(e, players, P, stints)]; }
    releaseWake();
    return [...head, setupView(e, players)];
  }

  function releaseWake() { try { if (wake) wake.release(); } catch (x) {} wake = null; }

  // ---- avant le match ----
  function setupView(e, players) {
    const S = setup[e.id] || (setup[e.id] = { st: {}, per: 4, len: 10 });
    const get = p => S.st[p.id] == null ? 1 : S.st[p.id];
    const rerender = () => U().setView({ name: "match", id: e.id });
    if (!players.length) return [U().empty("users", "Aucun joueur dans cette équipe", "Ajoute d'abord les joueurs dans l'onglet Équipes.", null)];
    const nStart = players.filter(p => get(p) === 2).length;
    const per = h("select", { onchange: ev => { S.per = +ev.target.value; if (S.per === 2 && S.len === 10) S.len = 20; if (S.per === 4 && S.len === 20) S.len = 10; rerender(); } },
      h("option", { value: 4, selected: S.per === 4 }, "4 quart-temps"), h("option", { value: 2, selected: S.per === 2 }, "2 mi-temps"));
    const len = h("input", { type: "number", min: 1, max: 30, value: S.len, onchange: ev => { S.len = +ev.target.value || 10; } });
    const go = async live => {
      const starters = players.filter(p => get(p) === 2).map(p => p.id);
      if (live && starters.length !== 5) { U().toast("Choisis exactement 5 joueurs de départ."); return; }
      const cur = await DB.get("events", e.id);
      cur.nb_periods = S.per; cur.game_min = +len.value || S.len; cur.squad = players.filter(p => get(p) > 0).map(p => p.id);
      cur.live = live ? { q: 1, qstart: null, court: starters, last: null } : null;
      await DB.save("events", cur); rerender();
    };
    return [
      h("p", { class: "sub" }, "Prépare la feuille de match : qui est là, et les 5 de départ. Tout le monde est « Banc » par défaut, touche « Absent » ou « Départ » pour changer."),
      h("section", { class: "card" },
        h("div", { class: "two" }, U().field("Format", per), U().field("Durée d'une période (min)", len)),
        players.map(p => h("div", { class: "att-row sheet" },
          h("div", { class: "att-name" }, h("span", { class: "num" }, p.jersey != null ? p.jersey : ""), h("span", {}, pname(p))),
          h("div", { class: "seg" }, [["Absent", 0, "absent"], ["Banc", 1, ""], ["Départ", 2, ""]].map(([l, k, c]) =>
            h("button", { type: "button", class: "segb " + c + (get(p) === k ? " on" : ""), onclick: () => { S.st[p.id] = k; rerender(); } }, l))))),
        h("p", { class: "sub" }, nStart + " joueur(s) de départ sur 5."),
        h("div", { class: "btns wrap" },
          h("button", { onclick: () => go(true) }, Icon("ball", 18), "Lancer le suivi en direct"),
          h("button", { class: "ghost", onclick: () => go(false) }, "Je saisirai après le match"))),
    ];
  }

  // ---- pendant le match ----
  function liveView(e, P, stints) {
    const L = e.live, rerender = () => U().setView({ name: "match", id: e.id });
    try { if (!wake && navigator.wakeLock) navigator.wakeLock.request("screen").then(w => { wake = w; }).catch(() => {}); } catch (x) {}
    const tot = totals(stints, e);
    const squad = e.squad || Object.keys(P);
    const court = L.court, bench = squad.filter(id => !court.includes(id));
    const toggle = (set, id) => { if (set.has(id)) set.delete(id); else set.add(id); rerender(); };
    const card = (id, onCourt) => {
      const on = onCourt ? sel.out.has(id) : sel.inn.has(id), p = P[id], t = tot[id];
      return h("button", { type: "button", class: "pcard" + (onCourt ? " court" : "") + (on ? " sel" : ""), onclick: () => toggle(onCourt ? sel.out : sel.inn, id) },
        h("span", { class: "pnum" }, p && p.jersey != null ? p.jersey : "•"), h("span", { class: "pn" }, pname(p)), h("span", { class: "pt" }, fmt(t ? t.tot : 0)));
    };
    const outs = [...sel.out].filter(id => court.includes(id)), ins = [...sel.inn].filter(id => bench.includes(id));
    const free = 5 - court.length;
    const okSub = (outs.length || ins.length) && court.length - outs.length + ins.length <= 5;
    const subBtn = h("button", { class: "bigbtn", disabled: !okSub, onclick: async () => {
      const cur = await DB.get("events", e.id); await substitute(cur, outs, ins); sel.out.clear(); sel.inn.clear(); rerender();
    } }, Icon("refresh", 20), outs.length || ins.length ? "Valider : " + outs.length + " sort · " + ins.length + " entre" : "Touche qui sort, puis qui entre");
    const clock = h("span", { class: "chronov" }, fmt(elapsed(e)));
    const tick = setInterval(() => { if (!clock.isConnected) { clearInterval(tick); return; } clock.textContent = fmt(elapsed(e)); }, 500);
    const qn = periodName(e, L.q);
    return h("div", {},
      h("section", { class: "card chrono" },
        h("div", {}, h("strong", { class: "qname" }, qn), h("div", { class: "sub" }, L.qstart ? "Chrono indicatif : il continue pendant les arrêts de jeu, les temps sont recalés à la fin de la période." : "Prêt. Lance la période au coup d'envoi.")),
        L.qstart ? clock : null,
        L.qstart
          ? h("button", { class: "ghost", onclick: async () => { if (!confirm("Terminer " + qn.toLowerCase() + " ?")) return; const cur = await DB.get("events", e.id); await endPeriod(cur); sel.out.clear(); sel.inn.clear(); rerender(); } }, Icon("check", 18), "Fin de la période")
          : h("button", { onclick: async () => { if (court.length !== 5 && !confirm("Il y a " + court.length + " joueurs sur le terrain. Lancer quand même ?")) return; const cur = await DB.get("events", e.id); await startPeriod(cur); rerender(); } }, Icon("clock", 18), "Coup d'envoi")),
      h("section", { class: "card" }, h("h3", { class: "tight" }, "Sur le terrain" + (free > 0 ? " (il en manque " + free + ")" : "")),
        h("div", { class: "pgrid" }, court.map(id => card(id, true)))),
      h("section", { class: "card" }, h("h3", { class: "tight" }, "Banc"),
        h("div", { class: "pgrid" }, bench.length ? bench.map(id => card(id, false)) : h("span", { class: "sub" }, "Personne sur le banc."))),
      h("div", { class: "subbar" }, subBtn,
        L.last ? h("button", { class: "ghost", onclick: async () => { const cur = await DB.get("events", e.id); await undoLast(cur); sel.out.clear(); sel.inn.clear(); rerender(); } }, "Annuler le dernier changement") : null,
        h("button", { class: "ghost", onclick: async () => {
          if (!confirm("Terminer le match ? Tu pourras corriger les temps ensuite.")) return;
          const cur = await DB.get("events", e.id); await finish(cur); releaseWake(); rerender();
        } }, "Terminer le match")));
  }

  // ---- après le match ----
  function summaryView(e, players, P, stints) {
    const rerender = () => U().setView({ name: "match", id: e.id });
    const by = totals(stints, null);
    const nP = e.nb_periods || 4, maxP = Math.max(nP, ...stints.map(s => s.period), 0);
    const periods = Array.from({ length: maxP }, (_, i) => i + 1);
    const ids = [...new Set([...(e.squad || []), ...stints.map(s => s.player_id)])].filter(id => P[id]);
    const rows = ids.map(id => ({ id, p: P[id], t: by[id] || { tot: 0, per: {} } })).sort((a, b) => b.t.tot - a.t.tot);
    const matchSec = periods.reduce((a, q) => a + periodLen(e, q), 0);

    // --- résultat ---
    const us = h("input", { type: "number", min: 0, value: e.score_us ?? "", placeholder: "Nous" }), them = h("input", { type: "number", min: 0, value: e.score_them ?? "", placeholder: e.opponent || "Eux" });
    const pin = periods.map(q => ({ us: h("input", { type: "number", min: 0, value: ((e.periods || [])[q - 1] || {}).us ?? "" }), them: h("input", { type: "number", min: 0, value: ((e.periods || [])[q - 1] || {}).them ?? "" }) }));
    const notes = h("textarea", { rows: 4, placeholder: "Bilan du match : ce qui a marché, ce qui a manqué, points à reprendre à l'entraînement…" }, e.match_notes || "");
    const saved = h("span", { class: "sub saved" }, "");
    const num = i => i.value === "" ? null : +i.value;
    const save = async () => {
      const cur = await DB.get("events", e.id);
      cur.periods = periods.map((q, i) => ({ ...((cur.periods || [])[q - 1] || {}), game_s: ((cur.periods || [])[q - 1] || {}).game_s ?? periodLen(cur, q), us: num(pin[i].us), them: num(pin[i].them) }));
      const anyP = cur.periods.some(x => x.us != null || x.them != null);
      cur.score_us = num(us) ?? (anyP && us.value === "" ? cur.periods.reduce((a, x) => a + (x.us || 0), 0) : null);
      cur.score_them = num(them) ?? (anyP && them.value === "" ? cur.periods.reduce((a, x) => a + (x.them || 0), 0) : null);
      cur.match_notes = notes.value.trim() || null;
      if (cur.score_us != null && cur.status !== "annule") cur.status = "joue";
      await DB.save("events", cur); saved.textContent = "Enregistré ✓"; rerender();
    };
    const res = result(e);

    // --- contrôle de cohérence ---
    const warns = periods.filter(q => stints.some(s => s.period === q)).map(q => {
      const sum = stints.filter(s => s.period === q && s.out_s != null).reduce((a, s) => a + (s.out_s - s.in_s), 0), exp = 5 * periodLen(e, q);
      return Math.abs(sum - exp) > 20 ? periodName(e, q) + " : " + (sum / periodLen(e, q)).toFixed(1).replace(".", ",") + " joueurs en moyenne sur le terrain (au lieu de 5)." : null;
    }).filter(Boolean);

    // --- ajout d'un passage ---
    const aP = h("select", {}, players.map(p => h("option", { value: p.id }, pname(p))));
    const aQ = h("select", {}, periods.length ? periods.map(q => h("option", { value: q }, periodName(e, q))) : [1].map(q => h("option", { value: q }, periodName(e, q))));
    const aI = h("input", { value: "0:00", placeholder: "0:00" }), aO = h("input", { value: fmt(periodLen(e, 1)), placeholder: "10:00" });
    const add = async () => {
      const i = parseT(aI.value), o = parseT(aO.value);
      if (i == null || o == null || o <= i) { U().toast("Entrée et sortie : écris par ex. 2:30 (la sortie après l'entrée)."); return; }
      await DB.save("match_stints", { event_id: e.id, player_id: aP.value, period: +aQ.value, in_s: i, out_s: o }); open[aP.value] = true;
      const cur = await DB.get("events", e.id); cur.squad = [...new Set([...(cur.squad || []), aP.value])]; await DB.save("events", cur); rerender();
    };

    return [
      h("div", { class: "chips" }, res ? h("span", { class: "pill " + res.c }, res.l) : null,
        h("button", { class: "small ghost", onclick: () => U().setView({ name: "playtime", id: e.team_season_id, from: e.id }) }, "Temps de jeu de la saison")),
      h("section", { class: "card" }, h("h3", { class: "tight" }, "Résultat"),
        h("div", { class: "two" }, U().field("Nous", us), U().field(e.opponent || "Adversaire", them)),
        periods.length ? h("div", {}, h("p", { class: "sub" }, "Score par période (facultatif)"),
          h("div", { class: "pscores" }, periods.map((q, i) => h("div", { class: "stintrow" }, h("span", { class: "psl" }, periodName(e, q)), pin[i].us, h("span", { class: "sub" }, "–"), pin[i].them)))) : null,
        U().field("Bilan", notes), h("div", { class: "btns wrap" }, h("button", { onclick: save }, "Enregistrer le résultat"), saved)),
      h("section", { class: "card" }, h("h3", { class: "tight" }, "Temps de jeu"),
        rows.length ? [
          warns.length ? h("p", { class: "msg err" }, "À vérifier : " + warns.join(" ")) : null,
          h("div", { class: "ptable" },
            h("div", { class: "prow head" }, h("span", {}, "Joueur"), h("span", { class: "r" }, "Total"), periods.map(q => h("span", { class: "r pp" }, (nP === 2 ? "MT" : q <= nP ? "QT" : "Prol.") + (q <= nP ? q : q - nP))), h("span", { class: "r" }, "%")),
            rows.map(r => h("div", { class: "prow" },
              h("span", { class: "pl" }, (r.p.jersey != null ? r.p.jersey + " · " : "") + pname(r.p)),
              h("span", { class: "r strong" }, fmt(r.t.tot)), periods.map(q => h("span", { class: "r pp" }, r.t.per[q] ? fmt(r.t.per[q]) : "—")),
              h("span", { class: "r" }, matchSec ? Math.round(r.t.tot / matchSec * 100) + "%" : "")))),
          h("p", { class: "sub" }, "Le pourcentage compte la durée totale du match (" + fmt(matchSec) + ").")]
          : h("p", { class: "sub" }, "Aucun passage enregistré. Ajoute-les ci-dessous : joueur, période, entrée et sortie (ex. 0:00 à 6:30).")),
      h("section", { class: "card" }, h("h3", { class: "tight" }, "Passages sur le terrain"),
        h("p", { class: "sub" }, "Corrige ici une entrée ou une sortie (format m:ss, temps de jeu de la période). Ajoute un passage oublié, ou supprime-en un."),
        ids.length ? ids.map(id => {
          const mine = stints.filter(s => s.player_id === id).sort((a, b) => a.period - b.period || a.in_s - b.in_s);
          const isOpen = !!open[id];
          return h("div", { class: "pstint" },
            h("button", { type: "button", class: "pshead", onclick: () => { open[id] = !isOpen; rerender(); } },
              h("strong", {}, pname(P[id])), h("span", { class: "sub" }, fmt((by[id] || { tot: 0 }).tot) + " · " + mine.length + " passage(s)")),
            isOpen ? h("div", { class: "psbody" }, mine.map(s => {
              const i = h("input", { value: fmt(s.in_s) }), o = h("input", { value: s.out_s != null ? fmt(s.out_s) : "" , placeholder: "en cours" });
              const upd = async () => {
                const a = parseT(i.value), b = o.value.trim() === "" ? null : parseT(o.value);
                if (a == null || (o.value.trim() !== "" && b == null) || (b != null && b < a)) { U().toast("Temps non valide : écris par ex. 2:30."); rerender(); return; }
                const cur = await DB.get("match_stints", s.id); cur.in_s = a; cur.out_s = b; await DB.save("match_stints", cur); rerender();
              };
              i.addEventListener("change", upd); o.addEventListener("change", upd);
              return h("div", { class: "stintrow" }, h("span", { class: "sub" }, periodName(e, s.period)), i, h("span", { class: "sub" }, "→"), o,
                h("button", { type: "button", class: "small ghost danger", "aria-label": "Supprimer ce passage", onclick: async () => { await DB.remove("match_stints", s); rerender(); } }, Icon("trash", 16)));
            })) : null);
        }) : null,
        h("h3", {}, "Ajouter un passage"),
        h("div", { class: "stintrow add" }, aP, aQ, aI, h("span", { class: "sub" }, "→"), aO, h("button", { type: "button", class: "small", onclick: add }, Icon("plus", 16), "Ajouter"))),
      h("div", { class: "btns wrap" },
        h("button", { class: "small ghost danger", onclick: async () => {
          if (!confirm("Effacer toute la feuille de match (passages, score, bilan) ?")) return;
          for (const s of stints) await DB.remove("match_stints", s);
          const cur = await DB.get("events", e.id);
          Object.assign(cur, { squad: null, live: null, periods: null, score_us: null, score_them: null, match_notes: null, status: cur.status === "joue" ? "prevu" : cur.status });
          await DB.save("events", cur); delete setup[e.id]; rerender();
        } }, "Recommencer la feuille de match")),
    ];
  }

  // ---------- temps de jeu de la saison ----------
  async function playtimeView(v) {
    const teams = await U().loadTeams(), t = teams.find(x => x.ts.id === v.id);
    const [events, stints, pl, mem] = await Promise.all([DB.live("events"), DB.live("match_stints"), DB.live("players"), DB.live("memberships")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    const played = events.filter(e => e.team_season_id === v.id && e.kind === "match" && stints.some(s => s.event_id === e.id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const jersey = Object.fromEntries(mem.filter(m => m.team_season_id === v.id).map(m => [m.player_id, m.jersey_number]));
    const per = {};
    for (const e of played) { const t0 = totals(stints.filter(s => s.event_id === e.id), null); for (const id in t0) (per[id] = per[id] || {})[e.id] = t0[id].tot; }
    const rows = Object.keys(per).filter(id => P[id]).map(id => {
      const vals = Object.values(per[id]); return { id, n: vals.length, tot: vals.reduce((a, b) => a + b, 0) };
    }).sort((a, b) => b.tot - a.tot);
    const back = v.from ? { name: "match", id: v.from } : { name: "cal" };
    const short = e => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "numeric" }).format(new Date(e.starts_at));
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView(back) }, Icon("chevL", 18), v.from ? "Feuille de match" : "Calendrier"),
      h("h2", {}, "Temps de jeu" + (t ? " — " + t.team.name : "")),
      rows.length ? h("section", { class: "card" }, h("div", { class: "ptable wide" },
        h("div", { class: "prow head" }, h("span", {}, "Joueur"), h("span", { class: "r" }, "Total"), h("span", { class: "r" }, "Moy."),
          played.map(e => h("span", { class: "r pp", title: e.opponent || "" }, short(e)))),
        rows.map(r => h("div", { class: "prow" }, h("span", { class: "pl" }, (jersey[r.id] != null ? jersey[r.id] + " · " : "") + pname(P[r.id])),
          h("span", { class: "r strong" }, fmt(r.tot)), h("span", { class: "r" }, fmt(r.tot / r.n)),
          played.map(e => h("span", { class: "r pp" }, per[r.id][e.id] != null ? fmt(per[r.id][e.id]) : "—"))))),
        h("p", { class: "sub" }, "Une colonne par match joué (date), en minutes:secondes. « Moy. » compte seulement les matchs où le joueur a joué."))
        : U().empty("ball", "Pas encore de temps de jeu", "Ouvre un match depuis le calendrier et lance la feuille de match : le cumul de la saison apparaîtra ici.", null),
    ];
  }

  // ---------- carte dans la fiche de la rencontre ----------
  function eventCard(e) {
    if (e.kind !== "match") return null;
    const r = result(e), started = !!(e.live || e.squad);
    return h("section", { class: "card matchcard" },
      h("div", { class: "row tight" }, h("h3", { class: "tight" }, "Match"), r ? h("span", { class: "pill " + r.c }, r.l + " " + e.score_us + " – " + e.score_them) : e.live ? h("span", { class: "pill warn" }, "En cours") : null),
      h("p", { class: "sub" }, r ? "Résultat enregistré. Ouvre la feuille pour le temps de jeu et le bilan." : "Feuille de match, changements en direct, résultat et temps de jeu."),
      h("div", { class: "btns wrap" },
        h("button", { onclick: () => U().setView({ name: "match", id: e.id }) }, Icon("ball", 18), e.live ? "Reprendre le suivi" : started || r ? "Ouvrir la feuille de match" : "Feuille de match"),
        h("button", { class: "ghost", onclick: () => U().setView({ name: "playtime", id: e.team_season_id, from: null }) }, "Temps de jeu de la saison")));
  }

  window.MatchUtil = { resultChip, eventCard };
  Object.assign(window.Views, { match: matchView, playtime: playtimeView });
})();
