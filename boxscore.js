// Saisie après match : on recopie la feuille de match officielle (e-Marque « Résumé ») pour avoir les stats sans avoir fait le suivi en direct.
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI;
  const COLS = [["p2i", "2 int.", "Paniers à 2 points à l'intérieur"], ["p2e", "2 ext.", "Paniers à 2 points à l'extérieur"], ["p3", "3 pts", "Paniers à 3 points réussis"], ["ft", "LF", "Lancers francs réussis"], ["fouls", "Fautes", "Fautes commises"]];
  const parseMin = t => { t = String(t || "").trim().replace(",", "."); if (!t) return null; const m = t.match(/^(\d+):(\d{1,2})$/); if (m) return +m[1] * 60 + +m[2]; const n = parseFloat(t); return isNaN(n) ? null : Math.round(n * 60); };
  const mmss = s => s == null ? "" : Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
  const num = i => i.value === "" ? null : Math.max(0, parseInt(i.value, 10) || 0);

  const showAll = {};
  async function view(v) {
    const e = await DB.get("events", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "cal" }); return []; }
    const [mem, pl, boxes, teams, av] = await Promise.all([DB.live("memberships"), DB.live("players"), DB.live("match_boxscores"), U().loadTeams(), DB.live("match_availability")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p])), t = teams.find(x => x.ts.id === e.team_season_id);
    const fullRoster = mem.filter(m => m.team_season_id === e.team_season_id && P[m.player_id]).map(m => ({ ...P[m.player_id], jersey: m.jersey_number }))
      .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.first_name.localeCompare(b.first_name));
    const mine = Object.fromEntries(boxes.filter(b => b.event_id === e.id && !b.deleted_at).map(b => [b.player_id, b]));
    // Seuls les joueurs sélectionnés apparaissent : convoqués (présences), sinon groupe du match, sinon tout l'effectif. Ceux déjà saisis restent affichés.
    const convoked = new Set(av.filter(a => a.event_id === e.id && !a.deleted_at && a.convoked).map(a => a.player_id));
    const picked = convoked.size ? convoked : new Set(e.squad || []);
    const filtered = picked.size ? fullRoster.filter(p => picked.has(p.id) || mine[p.id]) : fullRoster;
    const roster = showAll[e.id] || !filtered.length ? fullRoster : filtered;
    const hidden = fullRoster.length - roster.length;
    const back = () => U().setView({ name: "match", id: e.id });
    if (!roster.length) return [h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), "Match"), U().empty("users", "Aucun joueur dans cette équipe", "Ajoute d'abord les joueurs dans l'onglet Équipes.", null)];

    const rows = roster.map(p => {
      const b = mine[p.id] || {};
      const st = h("input", { type: "checkbox", checked: !!b.starter, "aria-label": "5 de départ" });
      const min = h("input", { type: "text", inputmode: "numeric", placeholder: "mm:ss", value: mmss(b.seconds), class: "bxm", "aria-label": "Temps de jeu" });
      const f = Object.fromEntries(COLS.map(([k]) => [k, h("input", { type: "number", min: 0, inputmode: "numeric", value: b[k] ?? "", class: "bxn", "aria-label": k })]));
      const pts = h("td", { class: "r strong" }, "0");
      return { p, b, st, min, f, pts };
    });
    const pts = r => 2 * ((num(r.f.p2i) || 0) + (num(r.f.p2e) || 0)) + 3 * (num(r.f.p3) || 0) + (num(r.f.ft) || 0);
    const used = r => r.st.checked || parseMin(r.min.value) != null || COLS.some(([k]) => num(r.f[k]) != null);
    const nPer = e.nb_periods || 4, per = Array.from({ length: nPer }, (_, i) => i);
    const pin = per.map(i => ({ us: h("input", { type: "number", min: 0, class: "bxn", value: ((e.periods || [])[i] || {}).us ?? "" }), them: h("input", { type: "number", min: 0, class: "bxn", value: ((e.periods || [])[i] || {}).them ?? "" }) }));
    const them = h("input", { type: "number", min: 0, class: "bxn", value: e.score_them ?? "", "aria-label": "Score adverse" });
    const sumTxt = h("div", { class: "sub" }), msg = h("span", { class: "sub saved" }, "");
    const refresh = () => {
      let tot = 0, nUsed = 0;
      for (const r of rows) { const p = pts(r); r.pts.textContent = p; tot += p; if (used(r)) nUsed++; }
      const q = pin.reduce((a, x) => a + (num(x.us) || 0), 0), anyQ = pin.some(x => num(x.us) != null);
      sumTxt.textContent = "Total des joueurs : " + tot + " pts" + (anyQ ? " · total des quart-temps : " + q : "") + (anyQ && q !== tot ? "  ⚠ les deux ne correspondent pas, vérifie la saisie." : "");
      sumTxt.className = "sub" + (anyQ && q !== tot ? " warnline" : "");
    };
    rows.forEach(r => { [r.min, r.st, ...Object.values(r.f)].forEach(i => i.addEventListener("input", refresh)); }); pin.forEach(x => x.us.addEventListener("input", refresh));

    const save = async () => {
      let tot = 0;
      for (const r of rows) {
        const old = mine[r.p.id];
        if (used(r)) {
          const d = { event_id: e.id, team_season_id: e.team_season_id, player_id: r.p.id, starter: r.st.checked, seconds: parseMin(r.min.value) };
          COLS.forEach(([k]) => { d[k] = num(r.f[k]) || 0; });
          await DB.save("match_boxscores", old && !old.deleted_at ? { ...old, ...d } : d); tot += pts(r);
        } else if (old && !old.deleted_at) await DB.remove("match_boxscores", old);
      }
      const cur = await DB.get("events", e.id);
      const anyQ = pin.some(x => num(x.us) != null || num(x.them) != null);
      if (anyQ) cur.periods = per.map(i => ({ ...((cur.periods || [])[i] || {}), us: num(pin[i].us), them: num(pin[i].them) }));
      cur.score_us = anyQ ? pin.reduce((a, x) => a + (num(x.us) || 0), 0) : (tot || cur.score_us);
      cur.score_them = num(them) ?? (anyQ ? pin.reduce((a, x) => a + (num(x.them) || 0), 0) : cur.score_them);
      if (cur.score_us != null && cur.status !== "annule") cur.status = "joue";
      await DB.save("events", cur);
      U().toast("Stats enregistrées."); back();
    };
    refresh();
    return [
      h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), "Match"),
      h("h2", {}, "Saisie après match"),
      h("p", { class: "sub" }, (t ? t.team.name : "") + (e.opponent ? " — " + e.opponent : "") + " · recopie la feuille « Résumé » de l'e-Marque. Seuls les joueurs convoqués sont listés ; laisse vide ceux qui n'ont pas joué."),
      h("section", { class: "card" },
        h("h3", { class: "tight" }, "Score"),
        h("div", { class: "tbl" }, h("table", { class: "stats" },
          h("thead", {}, h("tr", {}, [h("th", {}, ""), ...per.map(i => h("th", { class: "r" }, nPer === 2 ? "MT" + (i + 1) : "QT" + (i + 1))), h("th", { class: "r" }, "Final")])),
          h("tbody", {}, h("tr", {}, h("td", {}, "Nous"), ...pin.map(x => h("td", { class: "r" }, x.us)), h("td", { class: "r" }, h("span", { class: "sub" }, "= total joueurs"))),
            h("tr", {}, h("td", {}, e.opponent || "Eux"), ...pin.map(x => h("td", { class: "r" }, x.them)), h("td", { class: "r" }, them))))),
        sumTxt),
      h("section", { class: "card" },
        h("h3", { class: "tight" }, "Joueurs"),
        h("div", { class: "tbl" }, h("table", { class: "stats bx" },
          h("thead", {}, h("tr", {}, [h("th", {}, "Joueur"), h("th", { class: "r", title: "5 de départ" }, "5 dép."), h("th", { class: "r" }, "Min"), ...COLS.map(([, l, tt]) => h("th", { class: "r", title: tt }, l)), h("th", { class: "r" }, "Pts")])),
          h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, (r.p.jersey != null ? "#" + r.p.jersey + " " : "") + r.p.first_name + (r.p.last_name ? " " + r.p.last_name.charAt(0) + "." : "")),
            h("td", { class: "r" }, r.st), h("td", { class: "r" }, r.min), ...COLS.map(([k]) => h("td", { class: "r" }, r.f[k])), r.pts))))),
        hidden > 0 ? h("button", { class: "small ghost", onclick: () => { showAll[e.id] = true; U().setView({ name: "boxEntry", id: e.id }); } }, "Ajouter un joueur non sélectionné (" + hidden + ")") : null,
        h("p", { class: "sub" }, "Les points sont calculés : 2 × (2 int. + 2 ext.) + 3 × 3 pts + LF. Le temps de jeu s'écrit « 22:54 » ou en minutes (« 23 »).")),
      h("div", { class: "btns" }, h("button", { onclick: save }, Icon("check", 18), "Enregistrer"), h("button", { class: "ghost", onclick: back }, "Annuler"), msg),
    ];
  }
  Object.assign(window.Views, { boxEntry: view });
})();
