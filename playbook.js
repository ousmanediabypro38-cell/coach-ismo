// Playbook : tes systèmes offensifs et défensifs, touches, situations spéciales et lexique, un playbook par équipe.
(function () {
  const DB = window.DB, U = () => window.UI;
  const h = (...a) => U().h(...a);
  const CAT = { attaque: "Attaque", defense: "Défense", touche: "Touches et remises en jeu", situation: "Situations spéciales", lexique: "Lexique" };
  const CAT_SHORT = { attaque: "Attaque", defense: "Défense", touche: "Touches", situation: "Situations", lexique: "Lexique" };
  const STATUS = { a_installer: { n: "À installer", c: "" }, en_cours: { n: "En cours", c: "warn" }, installe: { n: "Installé", c: "ok" } };
  const NEXT = { a_installer: "en_cours", en_cours: "installe", installe: "a_installer" };
  const FIELDS = [["summary", "En bref", "Une ou deux phrases : à quoi ça sert, contre quoi."], ["principles", "Principes", "Quand l'utiliser, pourquoi, qui fait quoi."],
    ["technical", "Axes techniques", "Consignes, placements, signaux."], ["variants", "Variantes et évolutions", "Variantes, étapes suivantes, adaptations."]];
  const S = { ts: null, cat: "all", q: "" };
  try { S.ts = localStorage.getItem("pb_ts"); } catch (e) {}
  window.PlaybookState = S;
  const fdraft = {};   // saisies d'une fiche en cours, gardées hors de l'écran

  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const linkify = text => String(text || "").split(/(https?:\/\/[^\s]+)/g).map(part => /^https?:\/\//.test(part)
    ? h("a", { href: part, target: "_blank", rel: "noopener noreferrer", class: "xlink" }, part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48) + (part.length > 60 ? "…" : "")) : part);
  const rich = t => h("div", { class: "notebody pbtext" }, linkify(t));
  const setTs = id => { S.ts = id; try { localStorage.setItem("pb_ts", id); } catch (e) {} };

  async function pickTeam() {
    const teams = await U().loadTeams();
    if (!teams.length) return { teams, cur: null };
    let cur = teams.find(x => x.ts.id === S.ts) || teams[0];
    if (cur.ts.id !== S.ts) setTs(cur.ts.id);
    return { teams, cur };
  }

  // ---------- liste ----------
  async function listView() {
    const { teams, cur } = await pickTeam();
    if (!cur) return [h("h2", {}, "Playbook"), U().empty("court", "Aucune équipe pour le moment", "Crée une équipe : chaque équipe a son playbook.", null)];
    const all = (await DB.live("playbook_entries")).filter(e => e.team_season_id === cur.ts.id);
    const q = norm(S.q.trim());
    const list = all.filter(e => (S.cat === "all" || e.category === S.cat) && (!q || norm([e.title, e.call_name, e.summary, e.principles, e.technical, e.variants].join(" ")).includes(q)))
      .sort((a, b) => Object.keys(CAT).indexOf(a.category) - Object.keys(CAT).indexOf(b.category) || (a.position || 0) - (b.position || 0) || a.title.localeCompare(b.title));
    const search = h("input", { type: "search", placeholder: "Chercher un système, un appel, un mot…", value: S.q });
    search.addEventListener("change", () => { S.q = search.value; U().setView({ name: "playbook" }); });
    const row = e => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "playEntry", id: e.id }) },
      h("div", { style: "flex:1;min-width:0" }, h("strong", {}, e.title), e.call_name ? h("span", { class: "sub" }, "  « " + e.call_name + " »") : null,
        h("div", { class: "sub" }, (e.summary || e.principles || e.technical || "").replace(/\s+/g, " ").slice(0, 110) || "À compléter")),
      e.category === "lexique" ? null : h("span", { class: "pill " + STATUS[e.status || "a_installer"].c }, STATUS[e.status || "a_installer"].n), Icon("chevR", 18));
    const groups = S.cat === "all" ? Object.keys(CAT).map(k => [k, list.filter(e => e.category === k)]).filter(g => g[1].length) : [[S.cat, list]];
    const nb = k => all.filter(e => e.category === k).length;
    return [
      h("div", { class: "row" }, h("h2", {}, "Playbook"),
        h("div", { class: "btns" }, h("button", { class: "ghost small", onclick: () => U().setView({ name: "importJson" }) }, Icon("upload", 18), "Importer"),
          h("button", { class: "small", onclick: () => { delete fdraft.new; U().setView({ name: "playForm", cat: S.cat !== "all" ? S.cat : null }); } }, Icon("plus", 18), "Nouvelle fiche"))),
      teams.length > 1 ? h("div", { class: "chips filter" }, teams.map(x => h("button", { class: "chip" + (x.ts.id === cur.ts.id ? " on" : ""), onclick: () => { setTs(x.ts.id); U().setView({ name: "playbook" }); } }, x.team.name))) : null,
      h("p", { class: "sub" }, "Les systèmes de " + cur.team.name + " (" + cur.season.label + ") : tes appels, principes, variantes et vidéos."),
      h("div", { class: "chips filter" }, h("button", { class: "chip" + (S.cat === "all" ? " on" : ""), onclick: () => { S.cat = "all"; U().setView({ name: "playbook" }); } }, "Tout (" + all.length + ")"),
        Object.keys(CAT).map(k => h("button", { class: "chip" + (S.cat === k ? " on" : ""), onclick: () => { S.cat = k; U().setView({ name: "playbook" }); } }, CAT_SHORT[k] + (nb(k) ? " (" + nb(k) + ")" : "")))),
      all.length > 5 ? search : null,
      list.length ? groups.map(([k, items]) => h("section", {}, S.cat === "all" ? h("h3", {}, CAT[k]) : null, items.map(row)))
        : U().empty("court", all.length ? "Aucun résultat" : "Playbook vide pour cette équipe",
          all.length ? "Essaie un autre mot ou une autre catégorie." : "Écris ta première fiche, ou importe tes notes OneNote de systèmes.",
          all.length ? null : h("button", { onclick: () => U().setView({ name: "playForm" }) }, Icon("plus", 18), "Écrire une fiche")),
    ];
  }

  // ---------- fiche ----------
  async function entryView(v) {
    const e = await DB.get("playbook_entries", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "playbook" }); return []; }
    const rerender = () => U().setView({ name: "playEntry", id: e.id });
    const teams = await U().loadTeams(), ts = teams.find(x => x.ts.id === e.team_season_id);
    // séances où ce système est travaillé : le titre ou l'appel apparaît dans un bloc
    const needles = [e.title, e.call_name].filter(x => x && x.trim().length >= 4).map(norm);
    let used = [];
    if (needles.length && e.category !== "lexique") {
      const [blocks, sessions] = await Promise.all([DB.live("session_blocks"), DB.live("sessions")]);
      const S2 = Object.fromEntries(sessions.filter(s => s.team_season_id === e.team_season_id).map(s => [s.id, s]));
      const ids = new Set(blocks.filter(b => S2[b.session_id] && needles.some(n => norm([b.title, b.systems, b.description, b.setup, b.coaching_points, b.variants].join(" ")).includes(n))).map(b => b.session_id));
      used = [...ids].map(id => S2[id]).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 10);
    }
    const stat = STATUS[e.status || "a_installer"];
    const videos = (e.videos || "").trim();
    const copyTo = async () => {
      const others = teams.filter(x => x.ts.id !== e.team_season_id); if (!others.length) { U().toast("Il n'y a pas d'autre équipe."); return; }
      const names = others.map((x, i) => (i + 1) + ". " + x.team.name + " · " + x.season.label).join("\n");
      const n = parseInt(prompt("Copier cette fiche vers quelle équipe ?\n" + names + "\n\nEntre le numéro :") || "", 10);
      if (!(n >= 1 && n <= others.length)) return;
      const { id, _dirty, _rev, _base, updated_at, created_at, updated_at_local, ...rest } = e;
      await DB.save("playbook_entries", { ...rest, team_season_id: others[n - 1].ts.id }); U().toast("Fiche copiée vers " + others[n - 1].team.name + ".");
    };
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "playbook" }) }, Icon("chevL", 18), "Playbook"),
      h("h2", {}, e.title),
      h("div", { class: "chips" }, h("span", { class: "pill" }, CAT[e.category]), e.call_name ? h("span", { class: "pill ok" }, "Appel : " + e.call_name) : null,
        e.category !== "lexique" ? h("button", { type: "button", class: "pill pbtn " + stat.c, title: "Changer le statut", onclick: async () => { const cur = await DB.get("playbook_entries", e.id); cur.status = NEXT[cur.status || "a_installer"]; await DB.save("playbook_entries", cur); rerender(); } }, stat.n) : null,
        ts ? h("span", { class: "sub" }, ts.team.name + " · " + ts.season.label) : null),
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: () => { delete fdraft[e.id]; U().setView({ name: "playForm", id: e.id }); } }, Icon("edit", 18), "Modifier"),
        h("button", { class: "small ghost", onclick: copyTo }, Icon("copy", 18), "Copier vers une autre équipe"),
        h("button", { class: "small ghost danger", onclick: async () => { if (!confirm("Supprimer cette fiche ?")) return; await DB.remove("playbook_entries", e); U().setView({ name: "playbook" }); } }, Icon("trash", 18), "Supprimer")),
      FIELDS.map(([k, label]) => e[k] && e[k].trim() ? h("section", { class: "card" }, h("h3", { class: "tight" }, label), rich(e[k])) : null),
      videos ? h("section", { class: "card" }, h("h3", { class: "tight" }, "Vidéos et liens"), rich(videos)) : null,
      !FIELDS.some(([k]) => e[k] && e[k].trim()) && !videos ? h("p", { class: "sub" }, "Fiche vide pour l'instant : touche « Modifier » pour la remplir.") : null,
      window.DiagramUtil ? await window.DiagramUtil.entrySection(e) : null,
      used.length ? h("section", { class: "card" }, h("h3", { class: "tight" }, "Travaillé en séance"),
        used.map(s => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "session", id: s.id }) },
          h("div", { style: "flex:1" }, h("strong", {}, s.title || "Séance"), h("div", { class: "sub" }, window.CalUtil.cap(window.CalUtil.dayFmt.format(new Date(s.starts_at))))), Icon("chevR", 18)))) : null,
    ];
  }

  // ---------- création / modification ----------
  async function formView(v) {
    const old = v.id ? await DB.get("playbook_entries", v.id) : null;
    const key = old ? old.id : "new";
    const D = fdraft[key] || (fdraft[key] = {});
    const val = (k, d) => D[k] != null ? D[k] : old && old[k] != null ? old[k] : d;
    const bind = (el, k) => { el.addEventListener("input", () => { D[k] = el.value; }); el.addEventListener("change", () => { D[k] = el.value; }); return el; };
    const { teams, cur } = await pickTeam();
    const tsSel = bind(h("select", { required: true }, teams.map(x => h("option", { value: x.ts.id, selected: val("team_season_id", cur ? cur.ts.id : "") === x.ts.id }, x.team.name + " · " + x.season.label))), "team_season_id");
    const cat = bind(h("select", {}, Object.entries(CAT).map(([k, l]) => h("option", { value: k, selected: val("category", v.cat || "attaque") === k }, l))), "category");
    const title = bind(h("input", { required: true, value: val("title", ""), placeholder: "ex. Défense OKC" }), "title");
    const call = bind(h("input", { value: val("call_name", ""), placeholder: "Le mot que tu dis aux joueurs (ex. Pouce)" }), "call_name");
    const status = bind(h("select", {}, Object.entries(STATUS).map(([k, s]) => h("option", { value: k, selected: val("status", "a_installer") === k }, s.n))), "status");
    const areas = FIELDS.map(([k, label, ph]) => U().field(label, bind(h("textarea", { rows: k === "summary" ? 2 : 5, placeholder: ph }, val(k, "")), k)));
    const videos = bind(h("textarea", { rows: 3, placeholder: "Un lien par ligne (YouTube…)" }, val("videos", "")), "videos");
    const done = id => { delete fdraft[key]; U().setView(id ? { name: "playEntry", id } : { name: "playbook" }); };
    return h("form", { class: "card", onsubmit: async ev => {
      ev.preventDefault();
      const t = v => (v || "").trim() || null;
      const data = { team_season_id: tsSel.value, category: cat.value, title: title.value.trim(), call_name: t(call.value), status: status.value,
        summary: t(D.summary ?? (old && old.summary)), principles: t(D.principles ?? (old && old.principles)), technical: t(D.technical ?? (old && old.technical)),
        variants: t(D.variants ?? (old && old.variants)), videos: t(videos.value) };
      const saved = await DB.save("playbook_entries", old ? { ...old, ...data } : { ...data, position: 0 });
      setTs(saved.team_season_id); S.cat = "all"; done(saved.id);
    } },
      h("h2", {}, old ? "Modifier la fiche" : "Nouvelle fiche"),
      U().field("Équipe", tsSel), h("div", { class: "two" }, U().field("Catégorie", cat), U().field("Statut", status)),
      U().field("Titre", title), U().field("Appel (facultatif)", call), areas, U().field("Vidéos et liens", videos),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: () => done(old ? old.id : null) }, "Annuler"));
  }

  Object.assign(window.Views, { playbook: listView, playEntry: entryView, playForm: formView });
})();
