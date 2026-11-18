// Routines d'avant-match : une ou plusieurs routines par équipe (vestiaire, échauffement, tirs…), à cocher le jour du match.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a);
  const VIDEO = "https://drive.google.com/file/d/1AkUGdBnSOPW_3kqHAcDPQakCmuHKvuIz/view";
  // Modèles trouvés chez d'autres clubs : on les copie pour une équipe, puis on les adapte.
  const MODELS = [
    { key: "ma", mine: true, name: "Ma routine d'avant-match (brouillon)", source: "", notes: "Brouillon à valider : les exercices sont écrits avec une explication pour que tu puisses les faire et les expliquer. Je n'ai pas pu ouvrir ta vidéo de déverrouillage, donc la séquence suivante est classique : remplace-la par celle de la vidéo si elle diffère. Les blocs marqués par groupe (seniors, U15 à U21, U13) s'affichent selon l'équipe.", blocks: [
      { title: "Vestiaire : consignes du jour", duration: "10 min", items: ["Les 3 clés du match — 3 idées simples, les mêmes que sur la fiche missions", "Missions — qui doit faire quoi (collectif puis individuel)", "Rotation — rappeler qui joue quand, pour que personne ne soit surpris"], for: ["seniors", "u18"] },
      { title: "Vestiaire : consignes du jour", duration: "5 min", items: ["1 ou 2 consignes simples — pas plus, pour que les enfants s'en souviennent", "Objectif — jouer ensemble et se faire plaisir"], for: ["u13"] },
      { title: "Déverrouillage musculaire et articulaire", duration: "8 min", items: [
        "Vidéo de référence : " + VIDEO,
        "Cou — dis « oui » puis « non » avec la tête, lentement, puis incline l'oreille vers chaque épaule. 5 fois chaque. Pas de grands cercles brusques.",
        "Épaules — grands cercles de bras vers l'arrière puis vers l'avant, dos droit. 10 dans chaque sens.",
        "Poignets et coudes — bras devant toi, ouvre et ferme les mains, puis cercles de poignets. 10 dans chaque sens.",
        "Thorax — pieds écartés, bassin qui ne bouge pas, tourne le buste à droite puis à gauche, bras relâchés. 10 fois.",
        "Hanches — debout sur une jambe, lève le genou et dessine un grand cercle avec, vers l'extérieur puis vers l'intérieur. 8 fois chaque sens, chaque jambe.",
        "Bassin — mains sur les hanches, grands cercles du bassin. 8 dans chaque sens.",
        "Genoux — pieds joints, mains sur les genoux, petits cercles lents. 8 dans chaque sens.",
        "Chevilles — sur un pied, cercle avec la pointe, puis 10 montées sur la pointe des pieds. Change de pied.",
        "Fente avec rotation — grand pas en avant, tourne le buste vers la jambe avant, reviens. 5 par côté."] },
      { title: "Ateliers 45 s / 15 s", duration: "20 min", items: [
        "Échelles de course — 45 s de travail, 15 s de pause : un pied dans chaque case, le plus vite possible, regard devant",
        "Jonglage balles de tennis — jongle avec deux balles (lancer-rattraper d'une main à l'autre), puis une main seulement",
        "Contact épaule torse — par deux : pose l'épaule contre le torse du partenaire et pousse sans les bras, il résiste (apprend à défendre au contact)",
        "Lancers francs — lancers francs tranquilles, concentration sur le geste, toujours la même routine avant de tirer",
        "Réflexe balles de tennis — le partenaire lâche une balle, tu l'attrapes avant le 2e rebond"], for: ["u13"] },
      { title: "Gammes de courses + slides défensifs", duration: "5 min", items: [
        "Montées de genoux — 15 m, genou à hauteur de hanche, bras opposés au genou, retour en marchant",
        "Talons-fesses — 15 m, le talon touche la fesse, buste droit",
        "Pas chassés — 15 m de côté sans croiser les pieds, puis retour de l'autre côté",
        "Slides défensifs — position basse (fesses basses, dos droit, bras actifs), 3 allers-retours sur la largeur sans croiser les pieds",
        "Accélérations — 2 sprints de 15 m pour finir"] },
      { title: "Tirs à deux points : 30 marqués", duration: "", items: [
        "Objectif — 30 paniers marqués en tout pour le groupe (à valider : par équipe ou par joueur ?)",
        "45° — tirs depuis les ailes, en diagonale du panier",
        "0° — tirs depuis le côté, près de la ligne de fond",
        "Dans l'axe — tirs face au panier",
        "Comment — par deux : un tire, l'autre rebondit et passe, puis on échange"], for: ["seniors", "u18"] },
      { title: "Tirs à trois points : 20 marqués", duration: "", items: [
        "Objectif — 20 paniers marqués en tout (même règle que pour les 2 points)",
        "Positions — 45°, 0° puis dans l'axe, derrière la ligne à 3 points",
        "Conseil — même geste qu'à mi-distance : jambes, pas seulement les bras"], for: ["seniors", "u18"] },
      { title: "Tir à 3 colonnes", duration: "", items: ["Trois files face au panier : le 1er de chaque file tire, rebondit et passe à la file suivante. Chacun change de file après son tir."], for: ["u13"] },
      { title: "Mini ateliers à 2", duration: "", items: [
        "Échelle de rythme — l'un passe dans l'échelle (1 pied par case, puis 2 pieds, puis de côté), l'autre attend. 2 passages chacun",
        "Exo finition — l'un passe, l'autre attaque le cercle et finit (main forte puis main faible). 3 chacun",
        "Exo tir — tirs en arrêt, l'autre rebondit et passe. 5 tirs chacun",
        "Exo dextérité / défense — au choix : dribble main faible en zigzag entre plots, ou glissés défensifs autour des plots (à préciser)"], for: ["seniors", "u18"] },
      { title: "Manège passe et va", duration: "", items: ["Deux files sur le côté : le premier passe à l'autre file et coupe vers le panier pour finir, puis va se placer au bout de l'autre file. Tout le groupe tourne en continu, 3 minutes."] },
      { title: "Lancers francs", duration: "", items: ["Chacun marque 2 lancers — tant qu'il n'a pas marqué ses 2 lancers, il en refait (à valider avec ta règle)"], for: ["seniors", "u18"] },
      { title: "Fin d'échauffement", duration: "", items: ["Double pas rapide — lay-ups en file, un par joueur, rythme rapide, main forte puis main faible", "Sprint final — un aller sur la largeur du terrain, à fond"] },
      { title: "Vestiaire coaching", duration: "5 min", items: ["Dernier mot du coach — une seule phrase à retenir", "Cri d'équipe"] }] },
    { key: "u13", name: "U13 région · club de Grenoble", source: "Routine du club de Grenoble (U13 région)", blocks: [
      { title: "Ateliers 45 s / 15 s", duration: "20 min", items: ["Échelles de course", "Jonglage balles de tennis", "Contact épaule torse", "Lancers francs", "Réflexe balles de tennis"] },
      { title: "Vestiaire", duration: "", items: [] },
      { title: "Gammes de courses + slides défensifs", duration: "", items: [] },
      { title: "Tir à 3 colonnes", duration: "", items: [] },
      { title: "Manège passe et va", duration: "", items: [] }] },
    { key: "sharkys", name: "Sharkys · N2F Antibes", source: "Routine Sharkys (N2F Antibes)", blocks: [
      { title: "Vestiaire", duration: "15 min", items: [] },
      { title: "Déroulé articulaire + sprint à la fin", duration: "10 min", items: [] },
      { title: "Tirs à deux points : 30 paniers marqués", duration: "", items: ["45°", "0°", "Dans l'axe"] },
      { title: "Tirs à trois points : 20 paniers marqués", duration: "", items: ["45°", "0°", "Dans l'axe"] },
      { title: "Mini ateliers à 2", duration: "", items: ["Échelle de rythme", "Exo finition", "Exo tir", "Exo dextérité, défense ?", "Exo élastique style parachute"] },
      { title: "Lancers francs", duration: "", items: ["Marquer 2 lancers par personne"] },
      { title: "Vestiaire coaching", duration: "", items: [] },
      { title: "Fin de l'échauffement", duration: "", items: ["Double pas rapide"] }],
      notes: "Il reste 45 minutes après les 15 minutes de vestiaire. L'ordre des derniers blocs est celui de ta note : déplace-les si besoin." },
    { key: "deverr", name: "Déverrouillage musculaire et articulaire", source: "Ta vidéo « Déverrouillage articulaire »", blocks: [
      { title: "Déverrouillage articulaire", duration: "", items: ["Vidéo : " + VIDEO, "Écris ici les exercices dans l'ordre"] }] },
  ];
  const ck = {};            // cases cochées (par routine, gardées seulement le temps de l'ouverture)
  const draft = {};         // routine en cours de modification
  const rows = async tsId => (await DB.live("routines")).filter(r => r.team_season_id === tsId || !r.team_season_id).sort((a, b) => (a.position || 0) - (b.position || 0) || (a.name || "").localeCompare(b.name || ""));
  const GROUPS = [["seniors", "Seniors"], ["u18", "U15 à U21"], ["u13", "U13 et moins"]];
  async function groupOf(tsId) {
    const ts = tsId && await DB.get("team_seasons", tsId), t = ts && await DB.get("teams", ts.team_id), s = t ? (t.name + " " + (t.category || "")) : "";
    return /U\s?(7|9|11|13)\b/i.test(s) ? "u13" : /U\s?(15|16|17|18|20|21)\b/i.test(s) ? "u18" : "seniors";
  }
  const grpOf = {};   // groupe choisi à l'écran, par routine
  const clone = b => JSON.parse(JSON.stringify(b));
  const linkify = t => { const m = String(t).match(/^(.*?)(https?:\/\/\S+)(.*)$/); return m ? [m[1], h("a", { href: m[2], target: "_blank", rel: "noopener" }, "ouvrir le lien"), m[3]] : t; };
  const nameDesc = t => { t = String(t); const i = t.indexOf(" — "); return i > 0 && !/https?:/.test(t.slice(0, i)) ? [h("b", { class: "xn" }, t.slice(0, i)), h("small", { class: "xd" }, t.slice(i + 3))] : [linkify(t)]; };
  const teamName = async tsId => { const ts = await DB.get("team_seasons", tsId); const t = ts && await DB.get("teams", ts.team_id); return t ? t.name : "Équipe"; };

  async function listView(v) {
    const tsId = v.tsId, mine = await rows(tsId), name = await teamName(tsId);
    const back = v.from === "match" ? () => U().setView({ name: "event", id: v.eventId }) : () => U().setView({ name: "team", id: tsId });
    const copy = async m => { const r = await DB.save("routines", { team_season_id: m.mine ? null : tsId, name: m.mine ? "Ma routine d'avant-match" : m.name, source: m.source, notes: m.notes || "", blocks: clone(m.blocks), position: mine.length }); U().toast("Routine copiée : tu peux la modifier."); U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId }); };
    return [
      h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), v.from === "match" ? "Fiche de la rencontre" : name),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, "Routines d'avant-match"), h("p", { class: "sub" }, name)),
        h("button", { onclick: async () => { const r = await DB.save("routines", { team_season_id: tsId, name: "Nouvelle routine", blocks: [{ title: "Vestiaire", duration: "", items: [] }], position: mine.length }); delete draft[r.id]; U().setView({ name: "routineEdit", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId }); } }, Icon("plus", 18), "Nouvelle routine")),
      mine.length ? mine.map(r => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId }) },
        h("div", { style: "flex:1;min-width:0" }, h("strong", {}, r.name), h("div", { class: "sub" }, (r.blocks || []).length + " bloc(s)" + (!r.team_season_id ? " · toutes mes équipes" : "") + (r.source ? " · " + r.source : ""))), Icon("chevR", 18)))
        : U().empty("clipboard", "Aucune routine pour cette équipe", "Crée la tienne, ou copie un des modèles ci-dessous et adapte-le.", null),
      h("h3", {}, "Modèles à copier"),
      h("p", { class: "sub" }, "Routines récupérées ailleurs. La copie est à toi : tu peux tout changer sans toucher au modèle."),
      MODELS.map(m => h("section", { class: "card" }, h("div", { class: "row tight" }, h("strong", {}, m.name), h("button", { class: "small", onclick: () => copy(m) }, Icon("copy", 16), m.mine ? "Créer ma routine (toutes mes équipes)" : "Copier pour cette équipe")),
        h("p", { class: "sub" }, m.blocks.map(b => b.title + (b.duration ? " (" + b.duration + ")" : "")).join(" · ")))),
    ];
  }

  async function routineView(v) {
    const r = await DB.get("routines", v.id); if (!r || r.deleted_at) return listView({ tsId: v.tsId });
    const gk = r.id + "|" + (v.tsId || ""), grp = grpOf[gk] || (grpOf[gk] = await groupOf(v.tsId || r.team_season_id));
    const set = ck[r.id] || (ck[r.id] = new Set()), rerender = () => U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId });
    const allB = r.blocks || [], hasGrp = allB.some(b => b.for && b.for.length), blocks = allB.filter(b => !b.for || !b.for.length || b.for.includes(grp)), total = blocks.reduce((t, b) => t + Math.max(1, (b.items || []).length), 0), done = [...set].length;
    const row = (key, label, sub) => h("button", { type: "button", class: "chk" + (set.has(key) ? " on" : ""), onclick: () => { set.has(key) ? set.delete(key) : set.add(key); rerender(); } }, h("i", {}, set.has(key) ? Icon("check", 16) : null), h("span", {}, ...nameDesc(label), sub ? h("small", {}, sub) : null));
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "routines", tsId: v.tsId || r.team_season_id, from: v.from, eventId: v.eventId }) }, Icon("chevL", 18), "Routines"),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, r.name), r.source ? h("p", { class: "sub" }, "Inspirée de : " + r.source) : null),
        h("div", { class: "btns" }, h("button", { class: "small ghost", onclick: () => { delete draft[r.id]; U().setView({ name: "routineEdit", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId }); } }, Icon("edit", 16), "Modifier"),
          set.size ? h("button", { class: "small ghost", onclick: () => { set.clear(); rerender(); } }, "Tout décocher") : null)),
      hasGrp ? h("div", { class: "btns wrap" }, GROUPS.map(([k, l]) => h("button", { class: "small " + (grp === k ? "" : "ghost"), onclick: () => { grpOf[gk] = k; set.clear(); rerender(); } }, l))) : null,
      r.notes ? h("p", { class: "sub" }, r.notes) : null,
      total ? h("p", { class: "sub" }, done + " / " + total + " faits") : null,
      blocks.map((b, bi) => (b.items || []).length
        ? h("section", { class: "card" }, h("div", { class: "row tight" }, h("h3", { class: "tight" }, b.title || "Bloc"), b.duration ? h("span", { class: "pill" }, b.duration) : null),
            h("div", { class: "chklist" }, b.items.map((t, ii) => row(bi + ":" + ii, t))))
        : h("div", { class: "chklist solo" }, row(bi + ":b", b.title || "Bloc", b.duration))),
    ];
  }

  async function editView(v) {
    const r = await DB.get("routines", v.id); if (!r) return listView({ tsId: v.tsId });
    const D = draft[r.id] || (draft[r.id] = { name: r.name, notes: r.notes || "", blocks: (r.blocks || []).map(b => ({ title: b.title || "", duration: b.duration || "", text: (b.items || []).join("\n"), for: (b.for || []).slice() })), shared: !r.team_season_id });
    const rerender = () => U().setView({ name: "routineEdit", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId });
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= D.blocks.length) return; [D.blocks[i], D.blocks[j]] = [D.blocks[j], D.blocks[i]]; rerender(); };
    const name = h("input", { value: D.name, oninput: e => { D.name = e.target.value; } });
    const notes = h("textarea", { rows: 2, placeholder: "Ex. arriver 1 h avant, qui fait quoi…", oninput: e => { D.notes = e.target.value; } }, D.notes);
    return h("div", {}, 
      h("button", { class: "small ghost back", onclick: () => { delete draft[r.id]; U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId }); } }, Icon("chevL", 18), "Annuler"),
      h("h2", {}, "Modifier la routine"),
      h("section", { class: "card" }, U().field("Nom de la routine", name), U().field("Remarque (facultatif)", notes),
        h("button", { type: "button", class: "small " + (D.shared ? "" : "ghost"), onclick: () => { D.shared = !D.shared; rerender(); } }, D.shared ? "Visible pour toutes mes équipes" : "Seulement pour cette équipe")),
      D.blocks.map((b, i) => h("section", { class: "card" },
        h("div", { class: "row tight" }, h("strong", {}, "Bloc " + (i + 1)), h("div", { class: "btns" },
          h("button", { type: "button", class: "small ghost", disabled: i === 0, onclick: () => move(i, -1) }, "Monter"), h("button", { type: "button", class: "small ghost", disabled: i === D.blocks.length - 1, onclick: () => move(i, 1) }, "Descendre"),
          h("button", { type: "button", class: "small ghost danger", onclick: () => { D.blocks.splice(i, 1); rerender(); } }, Icon("trash", 16)))),
        h("div", { class: "grid2" }, U().field("Titre", h("input", { value: b.title, placeholder: "Ex. Vestiaire, Tirs…", oninput: e => { b.title = e.target.value; } })),
          U().field("Durée (facultatif)", h("input", { value: b.duration, placeholder: "Ex. 15 min", oninput: e => { b.duration = e.target.value; } }))),
        h("div", { class: "btns wrap" }, h("span", { class: "sub" }, "Pour :"), GROUPS.map(([k, l]) => { const all = !b.for.length, on = all || b.for.includes(k); return h("button", { type: "button", class: "small " + (on ? "" : "ghost"), onclick: () => { let f = all ? GROUPS.map(g => g[0]) : b.for.slice(); f = f.includes(k) ? f.filter(x => x !== k) : f.concat(k); b.for = f.length === GROUPS.length || !f.length ? [] : f; rerender(); } }, l); })),
        U().field("Détail : une ligne par exercice", h("textarea", { rows: 4, oninput: e => { b.text = e.target.value; } }, b.text)))),
      h("div", { class: "btns wrap" },
        h("button", { type: "button", class: "ghost", onclick: () => { D.blocks.push({ title: "", duration: "", text: "" }); rerender(); } }, Icon("plus", 18), "Ajouter un bloc"),
        h("button", { type: "button", onclick: async () => {
          const cur = await DB.get("routines", r.id);
          cur.name = D.name.trim() || "Routine"; cur.notes = D.notes.trim(); cur.team_season_id = D.shared ? null : (cur.team_season_id || v.tsId || null);
          cur.blocks = D.blocks.filter(b => b.title.trim() || b.text.trim()).map(b => ({ title: b.title.trim(), duration: b.duration.trim(), items: b.text.split("\n").map(x => x.trim()).filter(Boolean), for: b.for && b.for.length ? b.for : undefined }));
          await DB.save("routines", cur); delete draft[r.id]; delete ck[r.id]; U().toast("Routine enregistrée."); U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId, tsId: v.tsId });
        } }, Icon("check", 18), "Enregistrer"),
        h("button", { type: "button", class: "ghost danger", onclick: async () => { if (!confirm("Supprimer cette routine ?")) return; await DB.remove("routines", r); delete draft[r.id]; U().setView({ name: "routines", tsId: v.tsId || r.team_season_id, from: v.from, eventId: v.eventId }); } }, "Supprimer")));
  }

  // bouton réutilisable (fiche équipe, fiche match) : ouvre la liste, ou la routine si l'équipe n'en a qu'une
  async function open(tsId, from, eventId) {
    const mine = await rows(tsId);
    U().setView(mine.length === 1 && from === "match" ? { name: "routine", id: mine[0].id, from, eventId } : { name: "routines", tsId, from, eventId });
  }

  window.RoutineUtil = { open };
  Object.assign(window.Views, { routines: listView, routine: routineView, routineEdit: editView });
})();
