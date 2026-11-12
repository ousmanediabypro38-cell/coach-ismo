// Carnet d'entraînement : séances par équipe, déroulé en blocs, bilan après la séance.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);
  const INTENSITY = { legere: "Légère", moyenne: "Moyenne", forte: "Forte" };
  const STATUS = { prevue: "Prévue", faite: "Faite", annulee: "Annulée" };
  const QUICK = [["Échauffement", 15], ["Fondamentaux", 20], ["Jeu réduit", 20], ["5 contre 5", 25], ["Lancers francs", 10], ["Retour au calme", 5]];
  const TZ = "Europe/Paris";
  const monthFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" });
  const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric" });
  const state = { filter: [], scope: "future", editBlock: null };

  async function context() {
    const teams = await U().loadTeams();
    const info = Object.fromEntries(teams.map(x => [x.ts.id, x]));
    const sessions = await DB.live("sessions");
    const blocks = await DB.live("session_blocks");
    const bySession = {};
    for (const b of blocks) (bySession[b.session_id] = bySession[b.session_id] || []).push(b);
    for (const k in bySession) bySession[k].sort((a, b) => a.position - b.position);
    return { teams, info, sessions, bySession };
  }
  const teamName = (s, c) => (c.info[s.team_season_id] ? c.info[s.team_season_id].team.name : "Sans équipe");
  const total = list => (list || []).reduce((n, b) => n + (+b.duration_min || 0), 0);
  const endIso = s => new Date(Date.parse(s.starts_at) + (s.duration_min || 90) * 60000).toISOString();
  const statusChip = s => h("span", { class: "pill " + (s.status === "faite" ? "ok" : s.status === "annulee" ? "bad" : "") }, STATUS[s.status || "prevue"]);

  // ---------- liste ----------
  async function carnetView() {
    const c = await context();
    const today = K().todayKey();
    const inFilter = s => !state.filter.length || state.filter.includes(s.team_season_id);
    const future = state.scope === "future";
    const list = c.sessions.filter(inFilter).filter(s => future ? K().dkey(s.starts_at) >= today : K().dkey(s.starts_at) < today)
      .sort((a, b) => future ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at));
    const scope = (k, label) => h("button", { class: "chip" + (state.scope === k ? " on" : ""), onclick: () => { state.scope = k; U().setView({ name: "carnet" }); } }, label);
    return [
      h("div", { class: "row" }, h("h2", {}, "Carnet d'entraînement"),
        h("button", { onclick: () => U().setView({ name: "sessionForm" }) }, Icon("plus", 18), "Nouvelle séance")),
      h("div", { class: "chips filter" }, scope("future", "À venir"), scope("past", "Passées"),
        c.teams.map(x => h("button", { class: "chip" + (state.filter.includes(x.ts.id) ? " on" : ""), onclick: () => {
          state.filter = state.filter.includes(x.ts.id) ? state.filter.filter(i => i !== x.ts.id) : [...state.filter, x.ts.id]; U().setView({ name: "carnet" });
        } }, x.team.name))),
      list.length ? list.map(s => {
        const bl = c.bySession[s.id] || [];
        return h("button", { class: "item btnitem", onclick: () => U().setView({ name: "session", id: s.id }) },
          h("div", { class: "date-tile" }, h("span", { class: "d" }, dayNum.format(new Date(s.starts_at))), h("span", { class: "m" }, monthFmt.format(new Date(s.starts_at)))),
          h("div", { style: "flex:1;min-width:0" }, h("strong", {}, s.title || "Séance"),
            h("div", { class: "sub" }, teamName(s, c) + " — " + K().hm(s.starts_at) + ", " + (s.duration_min || 90) + " min"
              + (bl.length ? " — " + bl.length + " bloc" + (bl.length > 1 ? "s" : "") : " — déroulé à construire"))),
          h("div", { class: "chips" }, s.intensity ? h("span", { class: "pill" }, INTENSITY[s.intensity]) : null, statusChip(s)));
      }) : U().empty("clipboard", future ? "Aucune séance à venir" : "Aucune séance passée",
        "Prépare ta prochaine séance : thème, objectif, déroulé en blocs, et note le bilan après l'entraînement.",
        future ? h("button", { onclick: () => U().setView({ name: "sessionForm" }) }, Icon("plus", 18), "Créer une séance") : null),
    ];
  }

  // ---------- création, modification, copie ----------
  async function sessionForm(v) {
    const c = await context();
    const old = v.id ? await DB.get("sessions", v.id) : null;
    const src = old || (v.dupFrom ? await DB.get("sessions", v.dupFrom) : null) || {};
    const dupe = !!v.dupFrom;
    const tsSel = h("select", { required: true }, h("option", { value: "" }, "— choisir —"),
      c.teams.map(x => h("option", { value: x.ts.id, selected: src.team_season_id === x.ts.id }, x.team.name + " · " + x.season.label)));
    const date = h("input", { type: "date", required: true, value: !dupe && src.starts_at ? K().dkey(src.starts_at) : K().todayKey() });
    const time = h("input", { type: "time", required: true, value: src.starts_at ? K().hm(src.starts_at) : "18:30" });
    const dur = h("input", { type: "number", min: 15, step: 5, value: src.duration_min || 90 });
    const title = h("input", { value: src.title || "", placeholder: "ex. Transition défense-attaque" });
    const obj = h("textarea", { rows: 3, placeholder: "Ce que les joueurs doivent savoir faire à la fin de la séance" }, src.objective || "");
    const inten = h("select", {}, h("option", { value: "" }, "—"), Object.entries(INTENSITY).map(([k, l]) => h("option", { value: k, selected: src.intensity === k }, l)));
    const back = () => U().setView(old ? { name: "session", id: old.id } : v.dupFrom ? { name: "session", id: v.dupFrom } : { name: "carnet" });
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const data = { team_season_id: tsSel.value || null, starts_at: K().toISO(date.value, time.value), duration_min: +dur.value || 90,
        title: title.value.trim() || null, objective: obj.value.trim() || null, intensity: inten.value || null };
      const saved = await DB.save("sessions", old ? { ...old, ...data } : { ...data, status: "prevue" });
      if (dupe) {
        const bl = (await DB.live("session_blocks")).filter(b => b.session_id === v.dupFrom).sort((a, b) => a.position - b.position);
        for (const b of bl) await DB.save("session_blocks", { session_id: saved.id, position: b.position, title: b.title, duration_min: b.duration_min, description: b.description, material: b.material });
      }
      U().setView({ name: "session", id: saved.id });
    } },
      h("h2", {}, old ? "Modifier la séance" : dupe ? "Copier la séance" : "Nouvelle séance"),
      dupe ? h("p", { class: "sub" }, "Choisis la nouvelle date. Le déroulé est copié, le bilan repart de zéro.") : null,
      U().field("Équipe", tsSel), h("div", { class: "two" }, U().field("Date", date), U().field("Heure", time)),
      U().field("Durée (minutes)", dur), U().field("Thème", title), U().field("Objectif", obj), U().field("Intensité", inten),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: back }, "Annuler"));
  }

  // ---------- fiche d'une séance ----------
  async function sessionView(v) {
    const c = await context();
    const s = await DB.get("sessions", v.id);
    if (!s || s.deleted_at) { U().setView({ name: "carnet" }); return []; }
    const blocks = c.bySession[s.id] || [];
    const planned = s.duration_min || 90, used = total(blocks);
    const rerender = () => U().setView({ name: "session", id: s.id });
    let cursor = Date.parse(s.starts_at);
    const rows = blocks.map((b, i) => {
      const at = new Date(cursor).toISOString(); cursor += (+b.duration_min || 0) * 60000;
      if (state.editBlock === b.id) return blockForm(s, b, blocks, rerender);
      const swap = async j => { const o = blocks[j]; const p = b.position; b.position = o.position; o.position = p; await DB.save("session_blocks", b); await DB.save("session_blocks", o); rerender(); };
      return h("div", { class: "block" },
        h("div", { class: "at" }, K().hm(at)),
        h("div", { class: "body" }, h("strong", {}, b.title), b.description ? h("p", {}, b.description) : null, b.material ? h("p", {}, "Matériel : " + b.material) : null),
        h("div", { class: "dur" }, b.duration_min + " min"),
        h("div", { class: "acts" },
          i > 0 ? h("button", { class: "ghost icononly", "aria-label": "Monter", onclick: () => swap(i - 1) }, Icon("up", 16)) : null,
          i < blocks.length - 1 ? h("button", { class: "ghost icononly", "aria-label": "Descendre", onclick: () => swap(i + 1) }, Icon("down", 16)) : null,
          h("button", { class: "ghost icononly", "aria-label": "Modifier le bloc", onclick: () => { state.editBlock = b.id; rerender(); } }, Icon("edit", 16)),
          h("button", { class: "ghost icononly danger", "aria-label": "Supprimer le bloc", onclick: async () => { await DB.remove("session_blocks", b); rerender(); } }, Icon("trash", 16))));
    });
    const addQuick = async (t, d) => {
      const max = blocks.reduce((m, b) => Math.max(m, b.position), -1);
      const nb = await DB.save("session_blocks", { session_id: s.id, position: max + 1, title: t, duration_min: d });
      state.editBlock = nb.id; rerender();
    };
    const bil = (key, label, ph) => {
      const note = h("span", { class: "sub saved" }, "");
      const ta = h("textarea", { rows: 3, placeholder: ph }, s[key] || "");
      ta.addEventListener("change", async () => { const cur = await DB.get("sessions", s.id); cur[key] = ta.value.trim() || null; await DB.save("sessions", cur); note.textContent = "Enregistré ✓"; });
      return h("div", {}, h("label", {}, label), ta, note);
    };
    return [
      h("button", { class: "small ghost back", onclick: () => { state.editBlock = null; U().setView({ name: "carnet" }); } }, Icon("chevL", 18), "Carnet"),
      h("h2", {}, s.title || "Séance"),
      h("p", { class: "big" }, teamName(s, c) + " — " + K().cap(K().dayFmt.format(new Date(s.starts_at))) + ", " + K().hm(s.starts_at) + " à " + K().hm(endIso(s))),
      h("div", { class: "chips" }, statusChip(s), s.intensity ? h("span", { class: "pill" }, "Intensité " + INTENSITY[s.intensity].toLowerCase()) : null),
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: () => U().setView({ name: "sessionForm", id: s.id }) }, Icon("edit", 18), "Modifier"),
        h("button", { class: "small ghost", onclick: () => U().setView({ name: "sessionForm", dupFrom: s.id }) }, Icon("copy", 18), "Copier vers une autre date"),
        h("button", { class: "small ghost danger", onclick: async () => {
          if (!confirm("Supprimer cette séance et son déroulé ?")) return;
          for (const b of blocks) await DB.remove("session_blocks", b);
          await DB.remove("sessions", s); U().setView({ name: "carnet" });
        } }, Icon("trash", 18), "Supprimer")),
      s.objective ? h("section", { class: "card" }, h("h3", { class: "tight" }, "Objectif"), h("p", { style: "margin:8px 0 0;white-space:pre-wrap" }, s.objective)) : null,
      h("h3", {}, "Déroulé"),
      h("div", { class: "sub" }, used + " min planifiées sur " + planned + (used > planned ? " : dépasse de " + (used - planned) + " min" : used < planned && used ? " : il reste " + (planned - used) + " min" : "")),
      h("div", { class: "meter" + (used > planned ? " over" : "") }, h("i", { style: "width:" + Math.min(100, Math.round(used / planned * 100)) + "%" })),
      h("div", { class: "blocks" }, rows.length ? rows : h("p", { class: "sub" }, "Aucun bloc pour l'instant. Choisis un bloc type ci-dessous ou crée le tien.")),
      state.editBlock === "new" ? blockForm(s, null, blocks, rerender) : null,
      h("div", { class: "quick" }, QUICK.map(([t, d]) => h("button", { class: "chip", onclick: () => addQuick(t, d) }, "+ " + t + " (" + d + " min)")),
        h("button", { class: "chip", onclick: () => { state.editBlock = "new"; rerender(); } }, "+ Autre bloc")),
      h("h3", {}, "Bilan de la séance"),
      h("section", { class: "card bilan" },
        bil("bilan_worked", "Ce qui a bien marché", "Exercices ou consignes qui ont fonctionné"),
        bil("bilan_improve", "À améliorer", "Ce qui n'a pas marché, ou les joueurs en difficulté"),
        bil("bilan_next", "Pour la prochaine séance", "À reprendre, à préparer, à vérifier"),
        h("button", { class: s.status === "faite" ? "ghost" : "", onclick: async () => {
          const cur = await DB.get("sessions", s.id); cur.status = cur.status === "faite" ? "prevue" : "faite"; await DB.save("sessions", cur); rerender();
        } }, Icon("check", 18), s.status === "faite" ? "Remettre en « prévue »" : "Marquer comme faite")),
    ];
  }

  function blockForm(s, b, blocks, rerender) {
    const title = h("input", { required: true, value: b ? b.title : "", placeholder: "ex. 3 contre 2 en transition" });
    const dur = h("input", { type: "number", min: 1, step: 1, required: true, value: b ? b.duration_min : 10 });
    const desc = h("textarea", { rows: 3, placeholder: "Consignes, variantes, règles" }, b && b.description ? b.description : "");
    const mat = h("input", { value: b && b.material ? b.material : "", placeholder: "ex. 6 plots, 2 ballons" });
    return h("form", { class: "card", style: "margin:10px 0", onsubmit: async e => {
      e.preventDefault();
      const data = { title: title.value.trim(), duration_min: +dur.value || 10, description: desc.value.trim() || null, material: mat.value.trim() || null };
      if (b) await DB.save("session_blocks", { ...b, ...data });
      else await DB.save("session_blocks", { ...data, session_id: s.id, position: blocks.reduce((m, x) => Math.max(m, x.position), -1) + 1 });
      state.editBlock = null; rerender();
    } },
      U().field("Bloc", title), U().field("Durée (minutes)", dur), U().field("Description", desc), U().field("Matériel", mat),
      h("button", { type: "submit" }, "Enregistrer le bloc"),
      h("button", { type: "button", class: "ghost", onclick: () => { state.editBlock = null; rerender(); } }, "Annuler"));
  }

  Object.assign(window.Views, { carnet: carnetView, session: sessionView, sessionForm });
})();
