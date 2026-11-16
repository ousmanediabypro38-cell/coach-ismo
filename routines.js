// Routines d'avant-match : une ou plusieurs routines par équipe (vestiaire, échauffement, tirs…), à cocher le jour du match.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a);
  const VIDEO = "https://drive.google.com/file/d/1AkUGdBnSOPW_3kqHAcDPQakCmuHKvuIz/view";
  // Modèles trouvés chez d'autres clubs : on les copie pour une équipe, puis on les adapte.
  const MODELS = [
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
  const rows = async tsId => (await DB.live("routines")).filter(r => r.team_season_id === tsId).sort((a, b) => (a.position || 0) - (b.position || 0) || (a.name || "").localeCompare(b.name || ""));
  const clone = b => JSON.parse(JSON.stringify(b));
  const linkify = t => { const m = String(t).match(/^(.*?)(https?:\/\/\S+)(.*)$/); return m ? [m[1], h("a", { href: m[2], target: "_blank", rel: "noopener" }, "ouvrir le lien"), m[3]] : t; };
  const teamName = async tsId => { const ts = await DB.get("team_seasons", tsId); const t = ts && await DB.get("teams", ts.team_id); return t ? t.name : "Équipe"; };

  async function listView(v) {
    const tsId = v.tsId, mine = await rows(tsId), name = await teamName(tsId);
    const back = v.from === "match" ? () => U().setView({ name: "event", id: v.eventId }) : () => U().setView({ name: "team", id: tsId });
    const copy = async m => { const r = await DB.save("routines", { team_season_id: tsId, name: m.name, source: m.source, notes: m.notes || "", blocks: clone(m.blocks), position: mine.length }); U().toast("Routine copiée : tu peux la modifier."); U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId }); };
    return [
      h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), v.from === "match" ? "Fiche de la rencontre" : name),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, "Routines d'avant-match"), h("p", { class: "sub" }, name)),
        h("button", { onclick: async () => { const r = await DB.save("routines", { team_season_id: tsId, name: "Nouvelle routine", blocks: [{ title: "Vestiaire", duration: "", items: [] }], position: mine.length }); delete draft[r.id]; U().setView({ name: "routineEdit", id: r.id, from: v.from, eventId: v.eventId }); } }, Icon("plus", 18), "Nouvelle routine")),
      mine.length ? mine.map(r => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId }) },
        h("div", { style: "flex:1;min-width:0" }, h("strong", {}, r.name), h("div", { class: "sub" }, (r.blocks || []).length + " bloc(s)" + (r.source ? " · " + r.source : ""))), Icon("chevR", 18)))
        : U().empty("clipboard", "Aucune routine pour cette équipe", "Crée la tienne, ou copie un des modèles ci-dessous et adapte-le.", null),
      h("h3", {}, "Modèles à copier"),
      h("p", { class: "sub" }, "Routines récupérées ailleurs. La copie est à toi : tu peux tout changer sans toucher au modèle."),
      MODELS.map(m => h("section", { class: "card" }, h("div", { class: "row tight" }, h("strong", {}, m.name), h("button", { class: "small", onclick: () => copy(m) }, Icon("copy", 16), "Copier pour cette équipe")),
        h("p", { class: "sub" }, m.blocks.map(b => b.title + (b.duration ? " (" + b.duration + ")" : "")).join(" · ")))),
    ];
  }

  async function routineView(v) {
    const r = await DB.get("routines", v.id); if (!r || r.deleted_at) return listView({ tsId: v.tsId });
    const set = ck[r.id] || (ck[r.id] = new Set()), rerender = () => U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId });
    const blocks = r.blocks || [], total = blocks.reduce((t, b) => t + Math.max(1, (b.items || []).length), 0), done = [...set].length;
    const row = (key, label, sub) => h("button", { type: "button", class: "chk" + (set.has(key) ? " on" : ""), onclick: () => { set.has(key) ? set.delete(key) : set.add(key); rerender(); } }, h("i", {}, set.has(key) ? Icon("check", 16) : null), h("span", {}, linkify(label), sub ? h("small", {}, sub) : null));
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "routines", tsId: r.team_season_id, from: v.from, eventId: v.eventId }) }, Icon("chevL", 18), "Routines"),
      h("div", { class: "row" }, h("div", {}, h("h2", { class: "tight" }, r.name), r.source ? h("p", { class: "sub" }, "Inspirée de : " + r.source) : null),
        h("div", { class: "btns" }, h("button", { class: "small ghost", onclick: () => { delete draft[r.id]; U().setView({ name: "routineEdit", id: r.id, from: v.from, eventId: v.eventId }); } }, Icon("edit", 16), "Modifier"),
          set.size ? h("button", { class: "small ghost", onclick: () => { set.clear(); rerender(); } }, "Tout décocher") : null)),
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
    const D = draft[r.id] || (draft[r.id] = { name: r.name, notes: r.notes || "", blocks: (r.blocks || []).map(b => ({ title: b.title || "", duration: b.duration || "", text: (b.items || []).join("\n") })) });
    const rerender = () => U().setView({ name: "routineEdit", id: r.id, from: v.from, eventId: v.eventId });
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= D.blocks.length) return; [D.blocks[i], D.blocks[j]] = [D.blocks[j], D.blocks[i]]; rerender(); };
    const name = h("input", { value: D.name, oninput: e => { D.name = e.target.value; } });
    const notes = h("textarea", { rows: 2, placeholder: "Ex. arriver 1 h avant, qui fait quoi…", oninput: e => { D.notes = e.target.value; } }, D.notes);
    return h("div", {}, 
      h("button", { class: "small ghost back", onclick: () => { delete draft[r.id]; U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId }); } }, Icon("chevL", 18), "Annuler"),
      h("h2", {}, "Modifier la routine"),
      h("section", { class: "card" }, U().field("Nom de la routine", name), U().field("Remarque (facultatif)", notes)),
      D.blocks.map((b, i) => h("section", { class: "card" },
        h("div", { class: "row tight" }, h("strong", {}, "Bloc " + (i + 1)), h("div", { class: "btns" },
          h("button", { type: "button", class: "small ghost", disabled: i === 0, onclick: () => move(i, -1) }, "Monter"), h("button", { type: "button", class: "small ghost", disabled: i === D.blocks.length - 1, onclick: () => move(i, 1) }, "Descendre"),
          h("button", { type: "button", class: "small ghost danger", onclick: () => { D.blocks.splice(i, 1); rerender(); } }, Icon("trash", 16)))),
        h("div", { class: "grid2" }, U().field("Titre", h("input", { value: b.title, placeholder: "Ex. Vestiaire, Tirs…", oninput: e => { b.title = e.target.value; } })),
          U().field("Durée (facultatif)", h("input", { value: b.duration, placeholder: "Ex. 15 min", oninput: e => { b.duration = e.target.value; } }))),
        U().field("Détail : une ligne par exercice", h("textarea", { rows: 4, oninput: e => { b.text = e.target.value; } }, b.text)))),
      h("div", { class: "btns wrap" },
        h("button", { type: "button", class: "ghost", onclick: () => { D.blocks.push({ title: "", duration: "", text: "" }); rerender(); } }, Icon("plus", 18), "Ajouter un bloc"),
        h("button", { type: "button", onclick: async () => {
          const cur = await DB.get("routines", r.id);
          cur.name = D.name.trim() || "Routine"; cur.notes = D.notes.trim();
          cur.blocks = D.blocks.filter(b => b.title.trim() || b.text.trim()).map(b => ({ title: b.title.trim(), duration: b.duration.trim(), items: b.text.split("\n").map(x => x.trim()).filter(Boolean) }));
          await DB.save("routines", cur); delete draft[r.id]; delete ck[r.id]; U().toast("Routine enregistrée."); U().setView({ name: "routine", id: r.id, from: v.from, eventId: v.eventId });
        } }, Icon("check", 18), "Enregistrer"),
        h("button", { type: "button", class: "ghost danger", onclick: async () => { if (!confirm("Supprimer cette routine ?")) return; await DB.remove("routines", r); delete draft[r.id]; U().setView({ name: "routines", tsId: r.team_season_id, from: v.from, eventId: v.eventId }); } }, "Supprimer")));
  }

  // bouton réutilisable (fiche équipe, fiche match) : ouvre la liste, ou la routine si l'équipe n'en a qu'une
  async function open(tsId, from, eventId) {
    const mine = await rows(tsId);
    U().setView(mine.length === 1 && from === "match" ? { name: "routine", id: mine[0].id, from, eventId } : { name: "routines", tsId, from, eventId });
  }

  window.RoutineUtil = { open };
  Object.assign(window.Views, { routines: listView, routine: routineView, routineEdit: editView });
})();
