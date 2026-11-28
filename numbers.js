// Confirmation des numéros de maillot avant le match : manquants à saisir (enregistrés sur la fiche), doublons seulement entre joueurs sélectionnés.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a);
  const full = p => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Joueur";
  const val = i => { const t = i.value.trim(); return /^\d{1,2}$/.test(t) ? +t : null; };

  // players : joueurs sélectionnés. Résout true quand tout est bon (ou confirmé), false si annulé.
  async function confirm(tsId, players) {
    const [mem, all] = await Promise.all([DB.live("memberships"), DB.live("memberships")]);
    const mine = Object.fromEntries(mem.filter(m => m.team_season_id === tsId).map(m => [m.player_id, m]));
    const rows = players.map(p => { const m = mine[p.id]; const cur = m && m.jersey_number != null ? m.jersey_number : null;
      const old = cur == null ? all.filter(x => x.player_id === p.id && x.jersey_number != null && x.team_season_id !== tsId).map(x => x.jersey_number)[0] : null;   // numéro d'une saison précédente
      return { p, m, cur, old: old == null ? null : old }; });
    // numéros portés par des joueurs de l'équipe non sélectionnés (sert à la note « pas de problème »)
    const sel = new Set(players.map(p => p.id));
    const pl = Object.fromEntries((await DB.live("players")).map(p => [p.id, p]));
    const bench = Object.values(mine).filter(m => !sel.has(m.player_id) && m.jersey_number != null && pl[m.player_id]);
    const ok0 = rows.every(r => r.cur != null) && new Set(rows.map(r => r.cur)).size === rows.length;
    if (ok0) return true;
    return new Promise(resolve => {
      const ins = rows.map(r => h("input", { class: "num", inputmode: "numeric", maxlength: 2, placeholder: "?", value: r.cur != null ? r.cur : r.old != null ? r.old : "" }));
      const cards = rows.map(() => h("div", { class: "nr" }));
      const msg = h("p", { class: "sub" });
      let api;
      const check = () => {
        const v = ins.map(val), count = {}; v.forEach(n => { if (n != null) count[n] = (count[n] || 0) + 1; });
        let bad = 0;
        rows.forEach((r, i) => {
          const n = v[i], miss = n == null, dup = n != null && count[n] > 1, sugg = r.cur == null && r.old != null && n === r.old;
          const other = n != null ? bench.filter(m => m.jersey_number === n && m.player_id !== r.p.id).map(m => full(pl[m.player_id])) : [];
          const twins = dup ? rows.filter((x, j) => j !== i && v[j] === n).map(x => full(x.p)) : [];
          if (miss || dup || (ins[i].value.trim() !== "" && n == null)) bad++;
          cards[i].className = "nr " + (miss ? "miss" : dup ? "dup" : "ok");
          cards[i].replaceChildren(ins[i], h("div", { class: "nm" }, full(r.p),
            h("div", { class: "sm" }, miss ? "Pas de numéro : saisis-le, il sera enregistré sur sa fiche" : dup ? "Le " + n + " est aussi porté par " + twins.join(", ") + " : ils jouent ensemble, change l'un des deux." : sugg ? "Numéro de la saison précédente : à confirmer" : other.length ? "Le " + n + " est aussi sur la fiche de " + other.join(", ") + " (non sélectionné) : pas de problème" : r.cur != null && r.cur === n ? "enregistré sur sa fiche" : "sera enregistré sur sa fiche")),
            h("span", { class: "st " + (miss ? "a" : dup ? "r" : "g") }, miss ? "Manquant" : dup ? "Doublon" : "OK"));
        });
        const b = api && api.el.querySelector(".mfoot button:last-child"); if (b) { b.disabled = bad > 0; b.style.opacity = bad ? ".45" : ""; }
        msg.textContent = bad ? bad + " numéro" + (bad > 1 ? "s" : "") + " à régler avant de continuer." : "Tout est bon.";
      };
      ins.forEach(i => i.addEventListener("input", check));
      let done = false;
      api = window.Modal.open({ title: "Confirmer les numéros", onclose: () => { if (!done) resolve(false); },
        body: h("div", {}, h("p", { class: "sub" }, players.length + " joueurs sélectionnés. Vérifie les maillots avant les 5 de départ. Un numéro n'est un problème que si les deux joueurs sont sélectionnés."), cards, msg),
        actions: [{ label: "Annuler" }, { label: "Confirmer et continuer", primary: true, onclick: async () => {
          const v = ins.map(val); if (v.some(n => n == null) || new Set(v).size !== v.length) return false;
          for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r.cur === v[i]) continue;
            if (r.m) await DB.save("memberships", { ...r.m, jersey_number: v[i] }); else await DB.save("memberships", { player_id: r.p.id, team_season_id: tsId, jersey_number: v[i] }); }
          done = true; resolve(true); } }] });
      check();
    });
  }
  window.NumbersUtil = { confirm };
})();
