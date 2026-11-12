// Oussou Time : notes personnelles (routines, programmes, mental). Privées, jamais mélangées au carnet des équipes.
(function () {
  const DB = window.DB, U = () => window.UI;
  const h = (...a) => U().h(...a);
  const state = { q: "" };
  const SECTION = "oussou";

  async function listView() {
    const all = (await DB.live("notes")).filter(n => (n.section || SECTION) === SECTION);
    const q = state.q.trim().toLowerCase();
    const list = all.filter(n => !q || (n.title + " " + (n.body || "")).toLowerCase().includes(q))
      .sort((a, b) => (a.position || 0) - (b.position || 0) || a.title.localeCompare(b.title));
    const search = h("input", { type: "search", placeholder: "Chercher dans mes notes…", value: state.q });
    search.addEventListener("change", () => { state.q = search.value; U().setView({ name: "oussou" }); });
    return [
      h("div", { class: "row" }, h("h2", {}, "Oussou Time"),
        h("div", { class: "btns" }, h("button", { class: "ghost", onclick: () => U().setView({ name: "importJson" }) }, Icon("upload", 18), "Importer"),
          h("button", { onclick: () => U().setView({ name: "noteForm" }) }, Icon("plus", 18), "Nouvelle note"))),
      h("p", { class: "sub" }, "Tes routines, programmes et notes personnelles de joueur. Ici seulement, séparées du carnet des équipes."),
      all.length > 3 ? search : null,
      list.length ? list.map(n => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "note", id: n.id }) },
        h("div", { style: "flex:1;min-width:0" }, h("strong", {}, n.title),
          h("div", { class: "sub" }, (n.source_date ? n.source_date + " — " : "") + ((n.body || "").replace(/\s+/g, " ").slice(0, 90) || "Note vide"))),
        Icon("chevR", 18)))
        : U().empty("ball", all.length ? "Aucun résultat" : "Aucune note pour l'instant",
          all.length ? "Essaie un autre mot." : "Écris une note, ou importe tes pages OneNote d'Oussou Time.",
          all.length ? null : h("button", { onclick: () => U().setView({ name: "noteForm" }) }, Icon("plus", 18), "Écrire une note")),
    ];
  }

  async function noteView(v) {
    const n = await DB.get("notes", v.id);
    if (!n || n.deleted_at) { U().setView({ name: "oussou" }); return []; }
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "oussou" }) }, Icon("chevL", 18), "Oussou Time"),
      h("h2", {}, n.title),
      n.source_date ? h("p", { class: "sub" }, n.source_date) : null,
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: () => U().setView({ name: "noteForm", id: n.id }) }, Icon("edit", 18), "Modifier"),
        h("button", { class: "small ghost danger", onclick: async () => {
          if (!confirm("Supprimer cette note ?")) return; await DB.remove("notes", n); U().setView({ name: "oussou" });
        } }, Icon("trash", 18), "Supprimer")),
      h("section", { class: "card notebody" }, n.body ? n.body : h("span", { class: "sub" }, "Note vide.")),
    ];
  }

  async function noteForm(v) {
    const old = v.id ? await DB.get("notes", v.id) : null;
    const title = h("input", { required: true, value: old ? old.title : "", placeholder: "ex. Routine abdos" });
    const body = h("textarea", { rows: 18, placeholder: "Ta note" }, old && old.body ? old.body : "");
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const data = { title: title.value.trim(), body: body.value.replace(/\s+$/, "") || null };
      const saved = await DB.save("notes", old ? { ...old, ...data } : { ...data, section: SECTION, position: 0 });
      U().setView({ name: "note", id: saved.id });
    } },
      h("h2", {}, old ? "Modifier la note" : "Nouvelle note"), U().field("Titre", title), U().field("Texte", body),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: () => U().setView(old ? { name: "note", id: old.id } : { name: "oussou" }) }, "Annuler"));
  }

  Object.assign(window.Views, { oussou: listView, note: noteView, noteForm });
})();
