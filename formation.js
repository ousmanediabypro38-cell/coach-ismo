// Formation : tes formations de coach (BF jeunes, DETB, à venir) avec documents, notes et tâches.
(function () {
  const DB = window.DB, U = () => window.UI, h = (...a) => U().h(...a);
  const STATUS = { a_venir: { n: "À venir", c: "" }, en_cours: { n: "En cours", c: "warn" }, terminee: { n: "Terminée", c: "ok" } };
  const fdraft = {};

  async function sha(key) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key));
    const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32);
  }
  const D = id => "https://drive.google.com/file/d/" + id + "/view";
  const F = id => "https://drive.google.com/drive/folders/" + id;
  // Documents déjà présents dans ton Drive « Coach Ismo » (liens seulement : rien n'est copié).
  const SEED = [
    { key: "bfj-2026", title: "BF Jeunes 2026-2027", organisme: "Comité de l'Isère", status: "en_cours", items: [
      ["Guide et stage", "Guide de formation BFJ", D("1gUpy4WYc0K5DYF3KY5t7t7NtlumtkQ83")],
      ["Guide et stage", "Convocation au stage (session 1)", D("1qHz96pZpmF41ngw0IwKNUrfvRCfcc-bo")],
      ["Guide et stage", "Résultat du questionnaire BFJ", D("1V127cWmaOP4VtG5Qx-uX8JYne1q6TTMv")],
      ["Guide et stage", "Les signes en basketball", D("1agWg2-H_8jl5RR08O_b3svZQCFNbSXSF")],
      ["Fiches U13 et U15", "BFJ U13 — terrain entier", D("1XUPLfanE6SfPF_U5MKxH1w7Yd7Kluuem")],
      ["Fiches U13 et U15", "BFJ U13 — demi-terrain", D("1ot4n208FBRkB5M8ayf737ZoGhBEoPb56")],
      ["Fiches U13 et U15", "BFJ U15 — terrain entier", D("1fblfYiCauKaJG6vOqYZw9A51eY8Jt9IY")],
      ["Fiches U13 et U15", "BFJ U15 — demi-terrain", D("14qY3G-bDz3joztoxjZ4ZlOXJrFMI8c3P")],
      ["Fiches U13 et U15", "Fiche BFJ U13 — 3 stops", D("1X1blsZmw1CqZIjN1Ao0iVX6syIMyaqSU")],
      ["Fiches U13 et U15", "Fiches exercices BFJ (dossier compressé)", D("1dQuP6M2tfTxAAsDq28i2zi1kARl-0gC8")],
      ["Documents complémentaires", "BFJ — Communiquer et animer", D("1mONtr40Eisk2476v0q0vnhn2fbGlmRpr")],
      ["Documents complémentaires", "BFJ — Jeu rapide", D("1eg6AlskTrYO53zev5yMr7X5VI5alvuGD")],
      ["Documents complémentaires", "BFJ — Fiche technique : situations de référence Jeu rapide", D("1a1MOJJ5n_VJaKWzhSy_VaG9vmbCWN9Vu")],
      ["Documents complémentaires", "BFJ — 1c1", D("1mJdcaJBgxphU2xDzEQkmnp2RocQZNA5o")],
      ["Interventions", "Intervention BFJ — étape 2", D("1l5iJqFaQ1l0MBFXanEm5WD0UkO_tUTj2")],
      ["Dossiers Drive", "BF 2026-2027 (tout le dossier)", F("1wsFS40LTTsZe4Z535e2uXA3geaSURg8E")],
      ["Dossiers Drive", "Situation à préparer", F("1Ti84XvJ08W-YNAcFMwboy0F5Hn0aX2aT")],
      ["Dossiers Drive", "Interventions", F("1HXiXkIJLuSvw4_9Mg3fMzGlbp2k1cqZU")],
      ["Dossiers Drive", "Séance U13 à envoyer", F("1PkMo1wL8k52K5Qp3IRgWavbgS3KSXCiW")]] },
    { key: "detb", title: "DETB", organisme: "", status: "a_venir", items: [["Dossier", "Dossier DETB (PDF)", D("1tuk61I3Qn0Oro6_FnI2xKsK8Xr54WN7C")]] },
  ];

  async function seed() {
    const have = await DB.all("formations"), haveI = await DB.all("formation_items");
    let pos = have.length, n = 0;
    for (const f of SEED) {
      const fid = await sha("formation:" + f.key);
      const old = have.find(x => x.id === fid);
      if (!old) await DB.save("formations", { id: fid, title: f.title, organisme: f.organisme || null, status: f.status, position: pos++ });
      else if (old.deleted_at) continue;
      let i = 0;
      for (const [grp, title, url] of f.items) {
        const id = await sha("formation-item:" + f.key + ":" + url), o = haveI.find(x => x.id === id);
        if (!o) { await DB.save("formation_items", { id, formation_id: fid, kind: "lien", group_name: grp, title, url, position: i }); n++; }
        i++;
      }
    }
    return n;
  }

  const isFolder = u => /\/folders\//.test(u || "");
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
  const bodyText = t => h("div", { class: "notebody" }, String(t || "").split(/(https?:\/\/[^\s]+)/g).map(p => /^https?:\/\//.test(p) ? h("a", { href: p, target: "_blank", rel: "noopener noreferrer", class: "xlink" }, p) : p));

  // ---------- liste ----------
  async function listView() {
    const [fs, its] = await Promise.all([DB.live("formations"), DB.live("formation_items")]);
    fs.sort((a, b) => (a.position || 0) - (b.position || 0));
    const seedBtn = h("button", { onclick: async () => { const n = await seed(); U().toast(n ? n + " documents ajoutés." : "Tout est déjà là."); U().setView({ name: "formations" }); } }, Icon("upload", 18), "Ajouter mes documents BF jeunes et DETB");
    return [
      h("div", { class: "row" }, h("h2", {}, "Formation"), h("button", { onclick: () => U().setView({ name: "formationForm" }) }, Icon("plus", 18), "Nouvelle formation")),
      fs.length ? fs.map(f => {
        const mine = its.filter(i => i.formation_id === f.id), todos = mine.filter(i => i.kind === "todo"), done = todos.filter(i => i.done).length;
        const st = STATUS[f.status] || STATUS.en_cours;
        return h("button", { class: "item btnitem", onclick: () => U().setView({ name: "formation", id: f.id }) },
          h("div", { style: "flex:1;min-width:0" }, h("strong", {}, f.title),
            h("div", { class: "sub" }, [f.organisme, mine.filter(i => i.kind === "lien").length + " document(s)", mine.filter(i => i.kind === "note").length ? mine.filter(i => i.kind === "note").length + " note(s)" : null, todos.length ? done + "/" + todos.length + " tâches" : null].filter(Boolean).join(" · "))),
          h("span", { class: "pill " + st.c }, st.n));
      }) : U().empty("book", "Aucune formation pour le moment", "Range ici tes formations de coach : documents, notes de cours et choses à faire. Je peux déjà y mettre tes documents BF jeunes et ton dossier DETB depuis ton Drive.", seedBtn),
      fs.length && !SEED.every(f => fs.some(x => x.title === f.title)) ? h("div", { class: "btns wrap" }, h("button", { class: "small ghost", onclick: async () => { const n = await seed(); U().toast(n ? n + " documents ajoutés." : "Tout est déjà là."); U().setView({ name: "formations" }); } }, "Ajouter mes documents BF jeunes et DETB")) : null,
    ];
  }

  // ---------- fiche formation ----------
  async function detailView(v) {
    const f = await DB.get("formations", v.id);
    if (!f || f.deleted_at) { U().setView({ name: "formations" }); return []; }
    const its = (await DB.live("formation_items")).filter(i => i.formation_id === f.id).sort((a, b) => (a.position || 0) - (b.position || 0));
    const rerender = () => U().setView({ name: "formation", id: f.id });
    const links = its.filter(i => i.kind === "lien"), notes = its.filter(i => i.kind === "note"), todos = its.filter(i => i.kind === "todo");
    const groups = []; for (const i of links) { const g = i.group_name || "Documents"; let x = groups.find(y => y.g === g); if (!x) groups.push(x = { g, list: [] }); x.list.push(i); }
    const st = STATUS[f.status] || STATUS.en_cours;
    const add = kind => U().setView({ name: "formationItem", fid: f.id, kind });
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "formations" }) }, Icon("chevL", 18), "Formation"),
      h("div", { class: "row" }, h("div", {}, h("h2", {}, f.title), h("p", { class: "sub" }, [f.organisme, f.start_date ? "du " + f.start_date : null, f.end_date ? "au " + f.end_date : null].filter(Boolean).join(" · "))),
        h("div", { class: "btns" }, h("span", { class: "pill " + st.c }, st.n), h("button", { class: "small ghost", onclick: () => U().setView({ name: "formationForm", id: f.id }) }, Icon("edit", 18), "Modifier"))),
      f.notes ? h("section", { class: "card" }, bodyText(f.notes)) : null,
      h("div", { class: "btns wrap" }, h("button", { onclick: () => add("lien") }, Icon("plus", 18), "Document ou lien"), h("button", { class: "ghost", onclick: () => add("note") }, "Note"), h("button", { class: "ghost", onclick: () => add("todo") }, "Tâche")),
      todos.length ? [h("h3", {}, "À faire (" + todos.filter(t => t.done).length + "/" + todos.length + ")"), h("section", { class: "card" }, todos.map(t => h("div", { class: "item" },
        h("label", { class: "check", style: "flex:1;margin:0" }, h("input", { type: "checkbox", checked: !!t.done, onchange: async ev => { t.done = ev.target.checked; await DB.save("formation_items", t); rerender(); } }), h("span", { style: t.done ? "text-decoration:line-through;opacity:.6" : "" }, t.title)),
        h("button", { class: "small ghost", onclick: () => U().setView({ name: "formationItem", id: t.id, fid: f.id, kind: "todo" }) }, Icon("edit", 16)))))] : null,
      groups.map(g => [h("h3", {}, g.g), h("section", { class: "card" }, g.list.map(i => h("div", { class: "item" },
        h("a", { class: "item btnitem", style: "flex:1;border:0;padding:0;text-decoration:none;color:inherit", href: i.url || "#", target: "_blank", rel: "noopener noreferrer" },
          Icon(isFolder(i.url) ? "clipboard" : "book", 20), h("div", { style: "flex:1;min-width:0;margin-left:12px" }, h("strong", {}, i.title), h("div", { class: "sub" }, (isFolder(i.url) ? "Dossier Drive" : host(i.url)) + (i.body ? " · " + i.body.split("\n")[0].slice(0, 80) : "")))),
        h("button", { class: "small ghost", onclick: () => U().setView({ name: "formationItem", id: i.id, fid: f.id, kind: "lien" }) }, Icon("edit", 16)))))]),
      notes.length ? [h("h3", {}, "Notes"), notes.map(n => h("section", { class: "card" }, h("div", { class: "row tight" }, h("strong", {}, n.title), h("button", { class: "small ghost", onclick: () => U().setView({ name: "formationItem", id: n.id, fid: f.id, kind: "note" }) }, Icon("edit", 16))), bodyText(n.body)))] : null,
      !its.length ? U().empty("book", "Rien dans cette formation", "Ajoute un document (lien Drive), une note de cours ou une tâche.", null) : null,
    ];
  }

  // ---------- formulaires ----------
  async function formationForm(v) {
    const old = v.id ? await DB.get("formations", v.id) : null, key = "f:" + (v.id || "new");
    const d = fdraft[key] || (fdraft[key] = { title: old ? old.title : "", organisme: old ? old.organisme || "" : "", status: old ? old.status : "en_cours", start_date: old ? old.start_date || "" : "", end_date: old ? old.end_date || "" : "", notes: old ? old.notes || "" : "" });
    const bind = (el, k) => { el.addEventListener("input", () => { d[k] = el.value; }); return el; };
    const title = bind(h("input", { value: d.title, placeholder: "ex. BF Jeunes 2026-2027", required: true }), "title");
    const org = bind(h("input", { value: d.organisme, placeholder: "ex. Comité de l'Isère" }), "organisme");
    const status = bind(h("select", {}, Object.entries(STATUS).map(([k, s]) => h("option", { value: k, selected: d.status === k }, s.n))), "status");
    const sd = bind(h("input", { type: "date", value: d.start_date }), "start_date"), ed = bind(h("input", { type: "date", value: d.end_date }), "end_date");
    const notes = bind(h("textarea", { rows: 4, placeholder: "Objectif, lieu, contacts utiles…" }, d.notes), "notes");
    const back = () => { delete fdraft[key]; U().setView(old ? { name: "formation", id: old.id } : { name: "formations" }); };
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const row = { ...(old || {}), title: title.value.trim(), organisme: org.value.trim() || null, status: status.value, start_date: sd.value || null, end_date: ed.value || null, notes: notes.value.trim() || null };
      if (!old) row.position = (await DB.all("formations")).length;
      const s = await DB.save("formations", row); delete fdraft[key]; U().setView({ name: "formation", id: s.id });
    } }, h("h2", {}, old ? "Modifier la formation" : "Nouvelle formation"),
      U().field("Nom", title), h("div", { class: "two" }, U().field("Organisme", org), U().field("Statut", status)), h("div", { class: "two" }, U().field("Début", sd), U().field("Fin", ed)), U().field("Notes", notes),
      h("div", { class: "btns wrap" }, h("button", { type: "submit" }, "Enregistrer"), h("button", { type: "button", class: "ghost", onclick: back }, "Annuler"),
        old ? h("button", { type: "button", class: "ghost danger", onclick: async () => { if (!confirm("Supprimer cette formation et tout ce qu'elle contient ?")) return; for (const i of (await DB.live("formation_items")).filter(i => i.formation_id === old.id)) await DB.remove("formation_items", i); await DB.remove("formations", old); delete fdraft[key]; U().setView({ name: "formations" }); } }, Icon("trash", 18), "Supprimer") : null));
  }

  async function itemForm(v) {
    const old = v.id ? await DB.get("formation_items", v.id) : null, kind = old ? old.kind : v.kind || "lien", key = "i:" + (v.id || "new:" + v.fid + kind);
    const existing = (await DB.live("formation_items")).filter(i => i.formation_id === v.fid);
    const groupsUsed = [...new Set(existing.map(i => i.group_name).filter(Boolean))];
    const d = fdraft[key] || (fdraft[key] = { title: old ? old.title : "", url: old ? old.url || "" : "", group_name: old ? old.group_name || "" : "", body: old ? old.body || "" : "" });
    const bind = (el, k) => { el.addEventListener("input", () => { d[k] = el.value; }); return el; };
    const title = bind(h("input", { value: d.title, required: true, placeholder: kind === "todo" ? "ex. Préparer ma situation d'intervention" : kind === "note" ? "ex. Jeu rapide : points clés" : "ex. Guide de formation" }), "title");
    const url = bind(h("input", { value: d.url, type: "url", placeholder: "https://drive.google.com/… (colle le lien de partage)" }), "url");
    const grp = bind(h("input", { value: d.group_name, list: "grplist", placeholder: "ex. Fiches U13 et U15" }), "group_name");
    const body = bind(h("textarea", { rows: kind === "note" ? 9 : 3, placeholder: kind === "note" ? "Tes notes de cours…" : "Remarque (facultatif)" }, d.body), "body");
    const back = () => { delete fdraft[key]; U().setView({ name: "formation", id: v.fid }); };
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const row = { ...(old || {}), formation_id: v.fid, kind, title: title.value.trim(), url: kind === "lien" ? (url.value.trim() || null) : null, group_name: kind === "lien" ? (grp.value.trim() || null) : null, body: body.value.trim() || null };
      if (!old) row.position = existing.length ? Math.max(...existing.map(i => i.position || 0)) + 1 : 0;
      await DB.save("formation_items", row); delete fdraft[key]; U().setView({ name: "formation", id: v.fid });
    } }, h("h2", {}, (old ? "Modifier" : "Ajouter") + " — " + (kind === "lien" ? "document ou lien" : kind === "note" ? "note" : "tâche")),
      U().field("Titre", title), kind === "lien" ? [U().field("Lien", url), U().field("Rangé dans", grp), h("datalist", { id: "grplist" }, groupsUsed.map(g => h("option", { value: g })))] : null,
      U().field(kind === "note" ? "Note" : "Remarque", body),
      h("div", { class: "btns wrap" }, h("button", { type: "submit" }, "Enregistrer"), h("button", { type: "button", class: "ghost", onclick: back }, "Annuler"),
        old ? h("button", { type: "button", class: "ghost danger", onclick: async () => { if (!confirm("Supprimer cet élément ?")) return; await DB.remove("formation_items", old); delete fdraft[key]; U().setView({ name: "formation", id: v.fid }); } }, Icon("trash", 18), "Supprimer") : null));
  }

  Object.assign(window.Views, { formations: listView, formation: detailView, formationForm, formationItem: itemForm });
})();
