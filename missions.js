// Missions de match : missions collectives et individuelles, résultat (réussie / partielle / non), banque de missions et suivi automatique.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a);
  const RES = { reussie: "Réussie", partielle: "Partielle", non: "Non" };
  const AXES_C = ["Attaque", "Défense", "Libre"], AXES_I = ["Porteurs / meneurs", "Shooteurs", "Intérieurs", "Attitude / rôle"];
  // Banque de départ : celle de ta Fiche Missions (kind, axe, mission, indicateur, joueurs ciblés)
  const SEED = [
    ["c", "Attaque", "Jeu rapide : courir à chaque récupération", "Nb de points en transition / nb de contre-attaques lancées en moins de 6 s", "Tous"],
    ["c", "Attaque", "Jouer le surnombre (2c1, 3c2) sans perdre la balle", "Nb de surnombres convertis en tir ouvert ou lay-up", "Porteurs + ailiers"],
    ["c", "Attaque", "Mouvements sans ballon : ne jamais rester statique", "Nb de coupes / écrans utiles observés ; peu de possessions statiques", "Tous"],
    ["c", "Attaque", "Jeu placé : exécuter Vert/Blanc sans improviser", "% de possessions jouées dans le système (à l'œil)", "Tous"],
    ["c", "Attaque", "Contre zone : exécuter Maillots avec patience", "Tirs ouverts obtenus contre zone / possessions", "Tous"],
    ["c", "Attaque", "Limiter les pertes de balle", "Pertes <= objectif fixé (ex : 12 par match)", "Porteurs + collectif"],
    ["c", "Attaque", "Qualité de tir : tirs ouverts ou proches du cercle", "% de tirs pris en rythme ; peu de tirs forcés", "Tous"],
    ["c", "Défense", "H2H agressif : pression sur le porteur, pas d'aide facile", "Nb de passes faciles empêchées ; points encaissés en 1re intention", "Tous"],
    ["c", "Défense", "Stunt : aide courte puis retour immédiat sur son joueur", "Nb de tirs ouverts concédés après stunt (doit baisser)", "Défenseurs d'aile + intérieurs"],
    ["c", "Défense", "Défense de poste en overplay (deny avant réception)", "Nb de réceptions au poste bas empêchées / points concédés au poste", "4 / 5"],
    ["c", "Défense", "Rebond défensif + tag (taper la balle à la redescente)", "Nb de rebonds off adverses (objectif <= X)", "Tous, surtout intérieurs"],
    ["c", "Défense", "Zone press tout terrain : activer sur signal du banc", "Nb de balles volées ou de 8 s / pertes provoquées pendant la presse", "Tous"],
    ["c", "Défense", "Fin de match : zone 2-3 organisée en alternance", "Points concédés sur les dernières 5 min", "Tous"],
    ["c", "Défense", "Communication défensive : parler à chaque possession", "Appréciation coach (oui / à moitié / non)", "Tous"],
    ["i", "Porteurs / meneurs", "Ratio passes décisives / pertes >= 2", "Passes dé / pertes de balle", "Flo, Ouss, Andreas, Ruben, Hugo"],
    ["i", "Porteurs / meneurs", "Pousser le rythme : relancer vite après panier encaissé", "Nb de relances en moins de 4 s", "Flo, Ouss, Andreas"],
    ["i", "Porteurs / meneurs", "Trouver l'intérieur avant de shooter", "Nb de passes vers le poste bas", "Porteurs"],
    ["i", "Shooteurs", "Prendre ses tirs ouverts après passe sans hésiter", "Tirs en catch & shoot pris / ouverts manqués par hésitation", "Diego, Hugo, Ruben, Leo"],
    ["i", "Shooteurs", "Se déplacer pour rester ouvert (relocation)", "Nb de relocations observées", "Shooteurs"],
    ["i", "Shooteurs", "Réduire les tirs forcés au dribble", "Nb de tirs hors système (objectif <= X)", "Joueurs qui tirent beaucoup avec moins de réussite"],
    ["i", "Intérieurs", "Rebond offensif + rebond défensif sécurisé", "Rebonds off / déf (objectif chiffré)", "Franklin, Leo, Romain, Diego"],
    ["i", "Intérieurs", "Être dur sur les contacts : finir à travers le contact", "Fautes obtenues / lay-ups finis sous contact", "Franklin"],
    ["i", "Intérieurs", "Gagner le placement au poste bas avant réception", "Nb de postes bas obtenus en bonne position", "Romain, Leo"],
    ["i", "Attitude / rôle", "Apporter de l'énergie en entrant du banc", "Impact sur les 3 premières minutes de jeu", "Remplaçants"],
    ["i", "Attitude / rôle", "Leader vocal : parler, encourager, organiser", "Appréciation coach", "Capitaine / cadres"],
    ["i", "Attitude / rôle", "Zéro geste d'humeur, bonne attitude après une erreur", "Appréciation coach (oui / non)", "Tous"],
  ];
  const ST = {};   // état d'écran par match : { pick: {kind, playerId} }
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const val = m => m.result === "reussie" ? 1 : m.result === "partielle" ? 0.5 : 0;
  const pct = list => { const d = list.filter(m => m.result); return d.length ? Math.round(100 * d.reduce((t, m) => t + val(m), 0) / d.length) : null; };
  const pctTxt = p => p == null ? "—" : p + " %";
  const pname = p => p ? [p.first_name, p.last_name && p.last_name.charAt(0) + "."].filter(Boolean).join(" ") : "Joueur";
  const dayTxt = e => new Date(e.starts_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const live = async s => (await DB.live(s));
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); U().toast("Message copié : colle-le dans WhatsApp."); }
    catch (x) { const a = document.createElement("textarea"); a.value = t; document.body.append(a); a.select(); try { document.execCommand("copy"); U().toast("Message copié."); } catch (y) { U().toast("Copie impossible."); } a.remove(); }
  }
  const resSeg = (m, onset) => h("div", { class: "seg", role: "group", "aria-label": "Résultat de la mission" }, Object.entries(RES).map(([k, l]) =>
    h("button", { type: "button", class: "segb rs-" + k + (m.result === k ? " on" : ""), onclick: () => onset(m.result === k ? null : k) }, l)));
  const txt = (value, ph, onsave, tag) => { const i = h(tag || "input", { value: value || "", placeholder: ph }); if (tag) i.textContent = value || ""; i.addEventListener("change", () => onsave(i.value)); return i; };
  const chip = (t, on, f) => h("button", { type: "button", class: "chip" + (on ? " on" : ""), onclick: f }, t);

  async function ensureBank() {
    const b = (await live("mission_bank"));
    if (b.length) return b;
    for (let i = 0; i < SEED.length; i++) { const s = SEED[i]; await DB.save("mission_bank", { kind: s[0] === "c" ? "collectif" : "individuel", axis: s[1], title: s[2], indicator: s[3], profile: s[4], position: i }); }
    return live("mission_bank");
  }

  // ------------------------------------------------ écran missions d'un match
  async function matchView(v) {
    const e = await DB.get("events", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "cal" }); return []; }
    const S = ST[e.id] || (ST[e.id] = { pick: null, axisF: null });
    const rerender = () => U().setView({ name: "missions", id: e.id });
    const [teams, mem, pl, av, all, bank, acts, events] = await Promise.all([U().loadTeams(), live("memberships"), live("players"), live("match_availability"), live("match_missions"), live("mission_bank"), live("match_actions"), live("events")]);
    const t = teams.find(x => x.ts.id === e.team_season_id), P = Object.fromEntries(pl.map(p => [p.id, p]));
    const roster = mem.filter(m => m.team_season_id === e.team_season_id && P[m.player_id]).map(m => ({ ...P[m.player_id], jersey: m.jersey_number }))
      .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || (a.first_name || "").localeCompare(b.first_name || ""));
    const av2 = av.filter(a => a.event_id === e.id && !a.deleted_at), conv = new Set(av2.filter(a => a.convoked).map(a => a.player_id));
    const mine = all.filter(m => m.event_id === e.id).sort((a, b) => (a.position || 0) - (b.position || 0));
    const hasConv = conv.size > 0, mp = new Set(mine.filter(m => m.player_id).map(m => m.player_id));
    const players = roster.filter(p => hasConv ? (conv.has(p.id) || mp.has(p.id)) : true);
    const stats = window.StatsUtil ? StatsUtil.byPlayer(acts.filter(a => a.event_id === e.id)) : {};
    const hint = p => { const s = stats[p.id]; return s && (s.pts || s.reb || s.tov || s.fouls || s.fga) ? s.pts + " pts · " + s.reb + " reb · " + s.tov + " BP · " + s.fouls + " fautes" : null; };

    const addMission = async (kind, o) => { await DB.save("match_missions", { event_id: e.id, kind, axis: o.axis || null, player_id: o.player_id || null, title: o.title || "", indicator: o.indicator || "", result: null, actual: "", comment: "", position: mine.length }); S.pick = null; rerender(); };
    const upd = async (m, patch) => { const cur = await DB.get("match_missions", m.id); await DB.save("match_missions", { ...cur, ...patch }); };
    const del = async m => { await DB.remove("match_missions", m); rerender(); };
    const saveEvent = async patch => { const cur = await DB.get("events", e.id); await DB.save("events", { ...cur, ...patch }); };

    const card = (m, showAxis) => h("div", { class: "msn" + (m.result ? " r-" + m.result : "") },
      h("div", { class: "row tight" }, showAxis ? h("span", { class: "pill" }, m.axis || "Libre") : h("span"),
        h("button", { type: "button", class: "ghost icononly danger small", "aria-label": "Supprimer la mission", onclick: () => del(m) }, Icon("trash", 16))),
      txt(m.title, "Mission", v => upd(m, { title: v.trim() })),
      txt(m.indicator, "Indicateur : comment on saura que c'est réussi", v => upd(m, { indicator: v.trim() })),
      resSeg(m, async r => { await upd(m, { result: r }); rerender(); }),
      h("div", { class: "grid2e" }, txt(m.actual, "Constat réel (ex. 2/4 réussis)", v => upd(m, { actual: v.trim() })), txt(m.comment, "Commentaire", v => upd(m, { comment: v.trim() }))));

    const addRow = (kind, o) => h("div", { class: "btns wrap" },
      h("button", { type: "button", class: "small ghost", onclick: () => { S.pick = { kind, player_id: o.player_id || null }; rerender(); } }, Icon("clipboard", 16), "Depuis la banque"),
      h("button", { type: "button", class: "small ghost", onclick: () => addMission(kind, { ...o, title: "" }) }, Icon("plus", 16), "Mission libre"));

    // sélecteur de banque
    const picker = () => {
      const kind = S.pick.kind, pid = S.pick.player_id, p = pid ? P[pid] : null, axes = kind === "collectif" ? AXES_C : AXES_I;
      const fn = p ? norm(p.first_name) : "";
      let list = bank.filter(b => b.kind === kind && (!S.axisF || b.axis === S.axisF)).sort((a, b) => (a.position || 0) - (b.position || 0));
      if (p) { const w = b => norm(b.profile).includes(fn) ? 0 : /tous|remplacants/.test(norm(b.profile)) ? 2 : 1; list = list.slice().sort((a, b) => w(a) - w(b)); }
      return h("section", { class: "card pick" },
        h("div", { class: "row tight" }, h("strong", {}, "Banque de missions" + (p ? " · pour " + pname(p) : " · collectif")), h("button", { type: "button", class: "small ghost", onclick: () => { S.pick = null; S.axisF = null; rerender(); } }, "Fermer")),
        h("div", { class: "chips filter" }, chip("Toutes", !S.axisF, () => { S.axisF = null; rerender(); }), axes.map(a => chip(a, S.axisF === a, () => { S.axisF = S.axisF === a ? null : a; rerender(); }))),
        list.length ? list.map(b => h("button", { type: "button", class: "item btnitem", onclick: () => addMission(kind, { axis: kind === "collectif" ? b.axis : (b.axis || null), player_id: pid, title: b.title, indicator: b.indicator }) },
          h("div", { style: "flex:1;min-width:0;text-align:left" }, h("strong", {}, b.title), h("div", { class: "sub" }, b.indicator || ""), b.profile ? h("div", { class: "sub" }, "Pour : " + b.profile) : null), Icon("plus", 18)))
          : h("p", { class: "sub" }, bank.length ? "Aucune mission pour ce filtre." : "La banque est vide."),
        bank.length ? null : h("button", { type: "button", onclick: async () => { await ensureBank(); rerender(); } }, "Charger ma banque de départ (" + SEED.length + " missions)"));
    };

    const coll = mine.filter(m => m.kind === "collectif"), ind = mine.filter(m => m.kind === "individuel");
    const text = () => {
      const L = ["MISSIONS : " + (t ? t.team.name : "") + (e.opponent ? " contre " + e.opponent : "") + " (" + dayTxt(e) + ")"];
      if (e.mission_goal) L.push("", "Objectif : " + e.mission_goal);
      if (coll.length) { L.push("", "COLLECTIF"); coll.forEach(m => L.push("- " + m.title + (m.indicator ? " (" + m.indicator + ")" : ""))); }
      const by = {}; ind.forEach(m => { (by[m.player_id] = by[m.player_id] || []).push(m); });
      if (ind.length) { L.push("", "INDIVIDUEL"); players.forEach(p => (by[p.id] || []).forEach(m => L.push("- " + p.first_name + " : " + m.title + (m.indicator ? " (" + m.indicator + ")" : "")))); }
      return L.join("\n");
    };
    const prev = events.filter(x => x.team_season_id === e.team_season_id && x.id !== e.id && x.kind === "match" && x.starts_at < e.starts_at).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    const reprise = async () => {
      const pm = all.filter(m => prev && m.event_id === prev.id && m.result && m.result !== "reussie");
      if (!pm.length) { U().toast("Rien à reprendre : aucune mission partielle ou non réussie au match précédent."); return; }
      let n = mine.length; for (const m of pm) await DB.save("match_missions", { event_id: e.id, kind: m.kind, axis: m.axis, player_id: m.player_id, title: m.title, indicator: m.indicator, result: null, actual: "", comment: "", position: n++ });
      U().toast(pm.length + " mission(s) reprise(s) du match précédent."); rerender();
    };

    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "event", id: e.id }) }, Icon("chevL", 18), "Fiche de la rencontre"),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, "Missions du match"), h("p", { class: "sub" }, (t ? t.team.name : "") + (e.opponent ? " · " + e.opponent : "") + " · " + dayTxt(e))),
        h("div", { class: "btns wrap" }, h("button", { class: "small", onclick: () => copyText(text()) }, Icon("copy", 16), "Copier pour l'équipe"),
          h("button", { class: "small ghost", onclick: () => U().setView({ name: "missionBank", tsId: e.team_season_id, from: e.id }) }, "Banque"))),
      prev ? h("button", { class: "small ghost", onclick: reprise }, "Reprendre les missions à retravailler du match précédent") : null,
      S.pick ? picker() : null,
      h("section", { class: "card" }, U().field("Objectif du match", txt(e.mission_goal, "Ex. gagner en courant, moins de 12 pertes de balle…", v => saveEvent({ mission_goal: v.trim() })))),
      h("div", { class: "row" }, h("h3", {}, "Missions collectives"), h("span", { class: "sub" }, "Réussite : " + pctTxt(pct(coll)))),
      coll.length ? coll.map(m => h("section", { class: "card" }, card(m, true))) : h("p", { class: "sub" }, "2 à 4 missions collectives (attaque et défense) suffisent."),
      addRow("collectif", { axis: "Libre" }),
      h("div", { class: "row" }, h("h3", {}, "Missions individuelles"), h("span", { class: "sub" }, "Réussite : " + pctTxt(pct(ind)))),
      !hasConv ? h("p", { class: "sub" }, "Astuce : choisis les convoqués dans la convocation, seuls eux apparaîtront ici.") : null,
      players.map(p => { const pm = ind.filter(m => m.player_id === p.id), hn = hint(p);
        return h("section", { class: "card" }, h("div", { class: "row tight" }, h("strong", {}, (p.jersey != null ? "#" + p.jersey + " " : "") + pname(p)), hn ? h("span", { class: "sub" }, hn) : null),
          pm.length ? pm.map(m => card(m, false)) : h("p", { class: "sub" }, "Pas de mission."), addRow("individuel", { player_id: p.id })); }),
      h("section", { class: "card" }, h("h3", {}, "Bilan du match"),
        h("p", { class: "sub" }, e.score_us != null && e.score_them != null ? "Score : " + e.score_us + " – " + e.score_them + " · " : "", "Missions collectives " + pctTxt(pct(coll)) + " · individuelles " + pctTxt(pct(ind))),
        U().field("Ce qui a marché", txt(e.mission_worked, "", v => saveEvent({ mission_worked: v.trim() }), "textarea")),
        U().field("À corriger à l'entraînement", txt(e.mission_fix, "", v => saveEvent({ mission_fix: v.trim() }), "textarea")),
        U().field("Missions à reconduire au prochain match", txt(e.mission_next, "", v => saveEvent({ mission_next: v.trim() }), "textarea"))),
    ];
  }

  // ------------------------------------------------ banque de missions
  const BS = { edit: null };
  async function bankView(v) {
    const bank = (await live("mission_bank")).sort((a, b) => (a.position || 0) - (b.position || 0));
    const rerender = () => U().setView({ name: "missionBank", tsId: v.tsId, from: v.from });
    const back = v.from ? () => U().setView({ name: "missions", id: v.from }) : () => U().setView({ name: v.tsId ? "missionSuivi" : "accueil", tsId: v.tsId });
    const form = b => { const o = { kind: b.kind || "individuel", axis: b.axis || "", title: b.title || "", indicator: b.indicator || "", profile: b.profile || "" };
      const f = (k, ph) => h("input", { value: o[k], placeholder: ph, oninput: ev => { o[k] = ev.target.value; } });
      const kind = h("select", { onchange: ev => { o.kind = ev.target.value; } }, h("option", { value: "collectif", selected: o.kind === "collectif" }, "Collective"), h("option", { value: "individuel", selected: o.kind === "individuel" }, "Individuelle"));
      return h("section", { class: "card" }, U().field("Type", kind), U().field("Catégorie", f("axis", "Ex. Attaque, Défense, Shooteurs…")), U().field("Mission", f("title", "")), U().field("Indicateur", f("indicator", "Comment on sait que c'est réussi")), U().field("Joueurs ciblés", f("profile", "Tous, ou des prénoms")),
        h("div", { class: "btns" }, h("button", { onclick: async () => { if (!o.title.trim()) { U().toast("Écris la mission."); return; } const base = b.id ? await DB.get("mission_bank", b.id) : { position: bank.length }; await DB.save("mission_bank", { ...base, kind: o.kind, axis: o.axis.trim(), title: o.title.trim(), indicator: o.indicator.trim(), profile: o.profile.trim() }); BS.edit = null; rerender(); } }, "Enregistrer"),
          h("button", { class: "ghost", onclick: () => { BS.edit = null; rerender(); } }, "Annuler"))); };
    const groups = {}; bank.forEach(b => { const k = (b.kind === "collectif" ? "Collectif" : "Individuel") + " · " + (b.axis || "Autres"); (groups[k] = groups[k] || []).push(b); });
    return [
      h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), "Retour"),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, "Banque de missions"), h("p", { class: "sub" }, "Tes idées de missions, à piocher pour chaque match.")),
        h("button", { onclick: () => { BS.edit = "new"; rerender(); } }, Icon("plus", 18), "Nouvelle mission")),
      BS.edit === "new" ? form({}) : null,
      bank.length ? Object.entries(groups).map(([g, list]) => h("section", { class: "card" }, h("h3", {}, g),
        list.map(b => BS.edit === b.id ? form(b) : h("div", { class: "bkrow" }, h("div", { style: "flex:1;min-width:0" }, h("strong", {}, b.title), h("div", { class: "sub" }, b.indicator || ""), b.profile ? h("div", { class: "sub" }, "Pour : " + b.profile) : null),
          h("button", { class: "ghost icononly small", "aria-label": "Modifier", onclick: () => { BS.edit = b.id; rerender(); } }, Icon("edit", 16)),
          h("button", { class: "ghost icononly danger small", "aria-label": "Supprimer", onclick: async () => { if (confirm("Supprimer cette mission de la banque ?")) { await DB.remove("mission_bank", b); rerender(); } } }, Icon("trash", 16))))))
        : h("section", { class: "card" }, h("p", { class: "sub" }, "La banque est vide."), h("button", { onclick: async () => { await ensureBank(); rerender(); } }, "Charger ma banque de départ (" + SEED.length + " missions)")),
    ];
  }

  // ------------------------------------------------ suivi de la saison pour une équipe
  async function suiviView(v) {
    const [teams, ev, mm, mem, pl] = await Promise.all([U().loadTeams(), live("events"), live("match_missions"), live("memberships"), live("players")]);
    const t = teams.find(x => x.ts.id === v.tsId), P = Object.fromEntries(pl.map(p => [p.id, p]));
    const E = Object.fromEntries(ev.filter(e => e.team_season_id === v.tsId).map(e => [e.id, e])), M = mm.filter(m => E[m.event_id]);
    const coll = M.filter(m => m.kind === "collectif"), ind = M.filter(m => m.kind === "individuel");
    const rows = mem.filter(m => m.team_season_id === v.tsId && P[m.player_id]).map(m => { const l = ind.filter(x => x.player_id === m.player_id), d = l.filter(x => x.result);
      return { p: P[m.player_id], n: l.length, ok: d.filter(x => x.result === "reussie").length, part: d.filter(x => x.result === "partielle").length, pc: pct(l) }; }).filter(r => r.n).sort((a, b) => (b.pc ?? -1) - (a.pc ?? -1));
    const matches = Object.values(E).filter(e => M.some(m => m.event_id === e.id)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "team", id: v.tsId }) }, Icon("chevL", 18), t ? t.team.name : "Équipe"),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, "Suivi des missions"), h("p", { class: "sub" }, t ? t.team.name : "")), h("button", { class: "small ghost", onclick: () => U().setView({ name: "missionBank", tsId: v.tsId }) }, "Banque de missions")),
      h("div", { class: "kpis" }, [["Collectif", pctTxt(pct(coll))], ["Individuel", pctTxt(pct(ind))], ["Missions suivies", String(M.filter(m => m.result).length)]].map(([l, x]) => h("div", { class: "kpi" }, h("b", {}, x), h("span", {}, l)))),
      h("p", { class: "sub" }, "Réussite = (réussies + 0,5 × partielles) / missions notées."),
      rows.length ? h("section", { class: "card" }, h("h3", {}, "Par joueur"), h("div", { class: "tbl" }, h("table", { class: "stats" }, h("thead", {}, h("tr", {}, ["Joueur", "Missions", "Réussies", "Partielles", "Réussite"].map((x, i) => h("th", { class: i ? "r" : "" }, x)))),
        h("tbody", {}, rows.map(r => h("tr", { class: "click", onclick: () => { const m = mem.find(z => z.team_season_id === v.tsId && z.player_id === r.p.id); U().setView({ name: "player", tsId: v.tsId, mId: m.id }); } },
          h("td", {}, pname(r.p)), h("td", { class: "r" }, r.n), h("td", { class: "r" }, r.ok), h("td", { class: "r" }, r.part), h("td", { class: "r strong" }, pctTxt(r.pc)))))))) : null,
      matches.length ? h("section", { class: "card" }, h("h3", {}, "Par match"), matches.map(e => { const l = M.filter(m => m.event_id === e.id);
        return h("button", { class: "item btnitem", onclick: () => U().setView({ name: "missions", id: e.id }) }, h("div", { style: "flex:1;text-align:left" }, h("strong", {}, "vs " + (e.opponent || "?") + " · " + dayTxt(e)),
          h("div", { class: "sub" }, "Collectif " + pctTxt(pct(l.filter(m => m.kind === "collectif"))) + " · individuel " + pctTxt(pct(l.filter(m => m.kind === "individuel"))))), Icon("chevR", 18)); })) : h("p", { class: "sub" }, "Aucune mission pour l'instant. Ouvre un match et appuie sur « Missions du match »."),
    ];
  }

  // ------------------------------------------------ section dans la fiche joueur
  async function playerSection(p, tsId) {
    const [mm, ev] = await Promise.all([live("match_missions"), live("events")]);
    const E = Object.fromEntries(ev.map(e => [e.id, e])), mine = mm.filter(m => m.player_id === p.id && E[m.event_id] && (!tsId || E[m.event_id].team_season_id === tsId)).sort((a, b) => E[b.event_id].starts_at.localeCompare(E[a.event_id].starts_at));
    if (!mine.length) return [];
    return [h("section", { class: "card" }, h("div", { class: "row tight" }, h("h3", {}, "Missions de match"), h("span", { class: "pill" }, "Réussite " + pctTxt(pct(mine)))),
      mine.slice(0, 8).map(m => h("button", { type: "button", class: "item btnitem", onclick: () => U().setView({ name: "missions", id: m.event_id }) },
        h("div", { style: "flex:1;min-width:0;text-align:left" }, h("strong", {}, m.title), h("div", { class: "sub" }, "vs " + (E[m.event_id].opponent || "?") + " · " + dayTxt(E[m.event_id]) + (m.actual ? " · " + m.actual : ""))),
        h("span", { class: "pill rs-" + (m.result || "none") }, m.result ? RES[m.result] : "À noter"))))];
  }

  window.MissionUtil = { open: id => U().setView({ name: "missions", id }), playerSection, pct };
  Object.assign(window.Views, { missions: matchView, missionBank: bankView, missionSuivi: suiviView });
})();
