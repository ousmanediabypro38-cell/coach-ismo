// Carnet d'entraînement : séances, blocs détaillés, présences et groupes, bibliothèque d'exercices.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);
  const INTENSITY = { legere: "Légère", moyenne: "Moyenne", forte: "Forte" };
  const STATUS = { prevue: "Prévue", faite: "Faite", annulee: "Annulée" };
  const KINDS = { physique: "Préparation physique", echauffement: "Échauffement", exercice: "Exercice", jeu: "Phase de jeu", autre: "Autre" };
  const ATT = { present: "Présent", absent: "Absent", blesse: "Blessé" };
  const GROUPS = ["1", "2", "3"];
  const TZ = "Europe/Paris";
  const monthFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" });
  const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric" });
  const state = { filter: [], scope: "future", editBlock: null, newKind: null, lib: { q: "", kind: "" } };

  window.CarnetState = state;

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
  const hasDur = b => b.duration_min !== null && b.duration_min !== undefined && b.duration_min !== "" && +b.duration_min > 0;
  const total = list => (list || []).reduce((n, b) => n + (hasDur(b) ? +b.duration_min : 0), 0);
  const endIso = s => new Date(Date.parse(s.starts_at) + (s.duration_min || 90) * 60000).toISOString();
  const statusChip = s => h("span", { class: "pill " + (s.status === "faite" ? "ok" : s.status === "annulee" ? "bad" : "") }, STATUS[s.status || "prevue"]);
  const BLOCK_FIELDS = ["kind", "title", "duration_min", "setup", "description", "coaching_points", "variants", "systems", "material"];

  // Identifiant stable d'une présence (séance + joueur) : deux appareils ne créent jamais de doublon.
  async function attId(sessionId, playerId) {
    try {
      const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(sessionId + ":" + playerId));
      const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
      return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32);
    } catch (e) { return DB.uuid(); }
  }

  const tabs = active => h("div", { class: "chips filter" },
    h("button", { class: "chip" + (active === "sessions" ? " on" : ""), onclick: () => U().setView({ name: "carnet" }) }, "Séances"),
    h("button", { class: "chip" + (active === "library" ? " on" : ""), onclick: () => U().setView({ name: "library" }) }, "Exercices"));

  // ---------- liste des séances ----------
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
        h("div", { class: "btns" }, h("button", { class: "ghost", onclick: () => U().setView({ name: "importJson" }) }, Icon("upload", 18), "Importer"),
          h("button", { onclick: () => U().setView({ name: "sessionForm" }) }, Icon("plus", 18), "Nouvelle séance"))),
      tabs("sessions"),
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
        "Prépare ta prochaine séance : thème, objectif, déroulé en blocs, présences, et note le bilan après l'entraînement.",
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
    const vens = (await DB.live("venues")).sort((a, b) => a.name.localeCompare(b.name));
    const vSel = h("select", {}, h("option", { value: "" }, "— salle non précisée —"), vens.map(x => h("option", { value: x.id, selected: src.venue_id === x.id }, x.name + (x.city ? " · " + x.city : ""))));
    const inten = h("select", {}, h("option", { value: "" }, "—"), Object.entries(INTENSITY).map(([k, l]) => h("option", { value: k, selected: src.intensity === k }, l)));
    const back = () => U().setView(old ? { name: "session", id: old.id } : v.dupFrom ? { name: "session", id: v.dupFrom } : { name: "carnet" });
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const data = { team_season_id: tsSel.value || null, starts_at: K().toISO(date.value, time.value), duration_min: +dur.value || 90,
        title: title.value.trim() || null, objective: obj.value.trim() || null, intensity: inten.value || null, venue_id: vSel.value || null };
      const saved = await DB.save("sessions", old ? { ...old, ...data } : { ...data, status: "prevue" });
      if (dupe) {
        const bl = (await DB.live("session_blocks")).filter(b => b.session_id === v.dupFrom).sort((a, b) => a.position - b.position);
        for (const b of bl) {
          const nb = { session_id: saved.id, position: b.position, exercise_id: b.exercise_id || null };
          BLOCK_FIELDS.forEach(f => { nb[f] = b[f] === undefined ? null : b[f]; });
          await DB.save("session_blocks", nb);
        }
      }
      U().setView({ name: "session", id: saved.id });
    } },
      h("h2", {}, old ? "Modifier la séance" : dupe ? "Copier la séance" : "Nouvelle séance"),
      dupe ? h("p", { class: "sub" }, "Choisis la nouvelle date. Le déroulé est copié ; les présences et le bilan repartent de zéro.") : null,
      U().field("Équipe", tsSel), h("div", { class: "two" }, U().field("Date", date), U().field("Heure", time)),
      U().field("Durée de la séance (minutes)", dur), vens.length ? U().field("Salle", vSel) : null, U().field("Thème", title), U().field("Objectif", obj), U().field("Intensité", inten),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: back }, "Annuler"));
  }

  // ---------- présences et groupes ----------
  async function attendanceSection(s, rerender) {
    if (!s.team_season_id) return h("p", { class: "sub" }, "Choisis une équipe pour la séance afin de faire l'appel.");
    const [mem, pl, att] = await Promise.all([DB.live("memberships"), DB.live("players"), DB.live("session_attendance")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    const roster = mem.filter(m => m.team_season_id === s.team_season_id && P[m.player_id])
      .map(m => ({ m, p: P[m.player_id] }))
      .sort((a, b) => (a.m.jersey_number ?? 999) - (b.m.jersey_number ?? 999) || (a.p.last_name || a.p.nom || "").localeCompare(b.p.last_name || b.p.nom || ""));
    if (!roster.length) return h("p", { class: "sub" }, "Aucun joueur dans l'effectif de cette équipe.");
    const mine = Object.fromEntries(att.filter(a => a.session_id === s.id).map(a => [a.player_id, a]));
    const nameOf = p => [p.first_name || p.prenom, p.last_name || p.nom].filter(Boolean).join(" ") || "Joueur";
    const set = async (p, patch) => {
      const cur = mine[p.id] || { id: await attId(s.id, p.id), session_id: s.id, player_id: p.id, status: "present", group_label: null };
      const next = { ...cur, ...patch };
      if (next.status !== "present") next.group_label = null;
      await DB.save("session_attendance", next); rerender();
    };
    const status = p => (mine[p.id] ? mine[p.id].status : null);
    const count = k => roster.filter(r => status(r.p) === k).length;
    const noted = roster.filter(r => status(r.p)).length;
    const groupCounts = GROUPS.map(g => [g, roster.filter(r => mine[r.p.id] && mine[r.p.id].status === "present" && mine[r.p.id].group_label === g).length]).filter(x => x[1]);
    return h("div", {},
      h("div", { class: "row tight" },
        h("div", { class: "sub" }, noted ? count("present") + " présent" + (count("present") > 1 ? "s" : "") + ", " + count("absent") + " absent" + (count("absent") > 1 ? "s" : "") + ", " + count("blesse") + " blessé" + (count("blesse") > 1 ? "s" : "")
          + (groupCounts.length ? " — " + groupCounts.map(([g, n]) => "groupe " + g + " : " + n).join(", ") : "") : "Appel pas encore fait."),
        h("button", { class: "small ghost", onclick: async () => { for (const r of roster) if (!mine[r.p.id]) { const id = await attId(s.id, r.p.id); await DB.save("session_attendance", { id, session_id: s.id, player_id: r.p.id, status: "present", group_label: null }); } rerender(); } }, Icon("check", 16), "Tous présents")),
      h("div", { class: "att" }, roster.map(({ m, p }) => {
        const st = status(p), a = mine[p.id];
        return h("div", { class: "att-row" },
          h("div", { class: "att-name" }, h("span", { class: "num" }, m.jersey_number != null ? String(m.jersey_number) : "–"), h("span", {}, nameOf(p))),
          h("div", { class: "seg", role: "group", "aria-label": "Présence de " + nameOf(p) }, Object.entries(ATT).map(([k, l]) =>
            h("button", { type: "button", class: "segb " + k + (st === k ? " on" : ""), onclick: () => set(p, { status: k }) }, l))),
          st === "present" ? h("div", { class: "seg grp", role: "group", "aria-label": "Groupe de " + nameOf(p) }, GROUPS.map(g =>
            h("button", { type: "button", class: "segb" + (a.group_label === g ? " on" : ""), "aria-label": "Groupe " + g, onclick: () => set(p, { group_label: a.group_label === g ? null : g }) }, g))) : h("div", { class: "seg grp ph" }));
      })));
  }

  // Équipes de la séance, visibles d'un coup d'œil en haut de la fiche
  async function groupsCard(s) {
    const [mem, pl, att] = await Promise.all([DB.live("memberships"), DB.live("players"), DB.live("session_attendance")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p])), J = {};
    mem.filter(m => m.team_season_id === s.team_season_id).forEach(m => { J[m.player_id] = m.jersey_number; });
    const mine = att.filter(a => a.session_id === s.id && P[a.player_id]);
    if (!mine.some(a => a.status === "present" && a.group_label)) return null;
    const nm = a => { const p = P[a.player_id]; return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Joueur"; };
    const by = f => mine.filter(f).sort((a, b) => nm(a).localeCompare(nm(b)));
    const cols = GROUPS.map(g => [g, by(a => a.status === "present" && a.group_label === g)]).filter(x => x[1].length);
    const free = by(a => a.status === "present" && !a.group_label);
    const out = by(a => a.status !== "present");
    const col = (title, list, cls) => h("div", { class: "gcol " + (cls || "") }, h("div", { class: "gtitle" }, title, h("span", {}, String(list.length))),
      list.map(a => h("div", { class: "gname" }, nm(a))));
    return h("section", { class: "card" }, h("h3", { class: "tight" }, "Équipes de la séance"),
      h("div", { class: "groups" }, cols.map(([g, l]) => col("Équipe " + g, l)), free.length ? col("Sans équipe", free, "dim") : null),
      out.length ? h("p", { class: "sub", style: "margin:12px 0 0" }, out.map(a => nm(a) + " (" + ATT[a.status].toLowerCase() + ")").join(", ")) : null);
  }

  // ---------- fiche d'une séance ----------
  async function sessionView(v) {
    const c = await context();
    const s = await DB.get("sessions", v.id);
    if (!s || s.deleted_at) { U().setView({ name: "carnet" }); return []; }
    const blocks = c.bySession[s.id] || [];
    const planned = s.duration_min || 90, used = total(blocks);
    const rerender = () => U().setView({ name: "session", id: s.id });
    let cursor = Date.parse(s.starts_at), known = true; // l'heure d'un bloc n'est affichée que si toutes les durées avant lui sont notées
    const rows = blocks.map((b, i) => {
      const at = known ? new Date(cursor).toISOString() : null;
      if (hasDur(b)) cursor += +b.duration_min * 60000; else known = false;
      if (state.editBlock === b.id) return blockForm(s, b, blocks, rerender);
      const swap = async j => { const o = blocks[j]; const p = b.position; b.position = o.position; o.position = p; await DB.save("session_blocks", b); await DB.save("session_blocks", o); rerender(); };
      const part = (label, txt) => txt ? h("p", {}, h("b", {}, label + " : "), txt) : null;
      return h("div", { class: "block" },
        h("div", { class: "at" }, at ? K().hm(at) : "–"),
        h("div", { class: "body" },
          h("div", { class: "btitle" }, b.kind ? h("span", { class: "kind k-" + b.kind }, KINDS[b.kind]) : null, h("strong", {}, b.title)),
          part("Mise en place", b.setup), part("Déroulement", b.description), part("Axes techniques", b.coaching_points),
          part("Variantes", b.variants), b.systems ? h("p", { class: "sys" }, h("b", {}, "Systèmes : "), b.systems) : null, part("Matériel", b.material)),
        h("div", { class: "dur" + (hasDur(b) ? "" : " none") }, hasDur(b) ? b.duration_min + " min" : "durée ?"),
        h("div", { class: "acts" },
          i > 0 ? h("button", { class: "ghost icononly", "aria-label": "Monter", onclick: () => swap(i - 1) }, Icon("up", 16)) : null,
          i < blocks.length - 1 ? h("button", { class: "ghost icononly", "aria-label": "Descendre", onclick: () => swap(i + 1) }, Icon("down", 16)) : null,
          h("button", { class: "ghost icononly", "aria-label": "Modifier le bloc", onclick: () => { state.editBlock = b.id; rerender(); } }, Icon("edit", 16)),
          h("button", { class: "ghost icononly danger", "aria-label": "Supprimer le bloc", onclick: async () => { await DB.remove("session_blocks", b); rerender(); } }, Icon("trash", 16))));
    });
    const startNew = k => { state.editBlock = "new"; state.newKind = k; rerender(); };
    const bil = (key, label, ph) => {
      const note = h("span", { class: "sub saved" }, "");
      const ta = h("textarea", { rows: 3, placeholder: ph }, s[key] || "");
      ta.addEventListener("change", async () => { const cur = await DB.get("sessions", s.id); cur[key] = ta.value.trim() || null; await DB.save("sessions", cur); note.textContent = "Enregistré ✓"; });
      return h("div", {}, h("label", {}, label), ta, note);
    };
    const ven = s.venue_id ? await DB.get("venues", s.venue_id) : null;
    const att = await attendanceSection(s, rerender);
    const gcard = await groupsCard(s);
    const obsCard = window.SuiviUtil ? await window.SuiviUtil.obsForSession(s, rerender) : null;
    return [
      h("button", { class: "small ghost back", onclick: () => { state.editBlock = null; U().setView({ name: "carnet" }); } }, Icon("chevL", 18), "Carnet"),
      h("h2", {}, s.title || "Séance"),
      h("p", { class: "big" }, teamName(s, c) + " — " + K().cap(K().dayFmt.format(new Date(s.starts_at))) + ", " + K().hm(s.starts_at) + " à " + K().hm(endIso(s))),
      ven && !ven.deleted_at ? h("p", { class: "sub" }, h("button", { class: "small ghost", onclick: () => window.VenueUtil.openMaps(ven) }, Icon("pin", 16), ven.name + (ven.city ? " · " + ven.city : ""))) : null,
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
      gcard,
      h("h3", {}, "Déroulé"),
      used ? h("div", { class: "sub" }, used + " min notées sur " + planned + (used > planned ? " : dépasse de " + (used - planned) + " min" : " : il reste " + (planned - used) + " min")) : h("div", { class: "sub" }, "Les durées se notent bloc par bloc, à ta façon."),
      used ? h("div", { class: "meter" + (used > planned ? " over" : "") }, h("i", { style: "width:" + Math.min(100, Math.round(used / planned * 100)) + "%" })) : null,
      h("div", { class: "blocks" }, rows.length ? rows : h("p", { class: "sub" }, "Aucun bloc pour l'instant. Ajoute le premier ci-dessous.")),
      state.editBlock === "new" ? blockForm(s, null, blocks, rerender) : null,
      h("div", { class: "quick" }, Object.entries(KINDS).map(([k, l]) => h("button", { class: "chip", onclick: () => startNew(k) }, "+ " + l))),
      h("h3", {}, "Présences et groupes"),
      h("section", { class: "card" }, att),
      h("h3", {}, "Observations des joueurs"),
      h("section", { class: "card" }, obsCard),
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

  // Champs communs bloc / exercice de bibliothèque
  function detailFields(src) {
    const kind = h("select", {}, h("option", { value: "" }, "— type —"), Object.entries(KINDS).map(([k, l]) => h("option", { value: k, selected: src.kind === k }, l)));
    const title = h("input", { required: true, value: src.title || "", placeholder: "ex. 3 contre 2 en transition" });
    const setup = h("textarea", { rows: 3, placeholder: "Placement des joueurs, terrain, groupes" }, src.setup || "");
    const desc = h("textarea", { rows: 4, placeholder: "Comment ça se déroule, les règles" }, src.description || "");
    const coach = h("textarea", { rows: 3, placeholder: "Ce que je veux voir, ce que je corrige" }, src.coaching_points || "");
    const vars = h("textarea", { rows: 2, placeholder: "Variantes, systèmes de points" }, src.variants || "");
    const sys = h("input", { value: src.systems || "", placeholder: "ex. Blanc - pouce - poing" });
    const mat = h("input", { value: src.material || "", placeholder: "ex. 6 plots, 2 ballons" });
    const read = () => ({ kind: kind.value || null, title: title.value.trim(), setup: setup.value.trim() || null, description: desc.value.trim() || null,
      coaching_points: coach.value.trim() || null, variants: vars.value.trim() || null, systems: sys.value.trim() || null, material: mat.value.trim() || null });
    const fill = ex => { kind.value = ex.kind || ""; title.value = ex.title || ""; setup.value = ex.setup || ""; desc.value = ex.description || ""; coach.value = ex.coaching_points || ""; vars.value = ex.variants || ""; sys.value = ex.systems || ""; mat.value = ex.material || ""; };
    const nodes = [U().field("Type", kind), U().field("Titre", title), U().field("Mise en place", setup), U().field("Déroulement", desc),
      U().field("Axes techniques", coach), U().field("Variantes", vars), U().field("Systèmes travaillés", sys), U().field("Matériel", mat)];
    return { nodes, read, fill, kind, title };
  }

  function blockForm(s, b, blocks, rerender) {
    const f = detailFields(b || { kind: state.newKind });
    const dur = h("input", { type: "number", min: 1, step: 1, value: b && hasDur(b) ? b.duration_min : "", placeholder: "à noter" });
    const save = h("input", { type: "checkbox", id: "tolib" });
    let exId = b ? b.exercise_id || null : null;
    const pick = h("select", {}, h("option", { value: "" }, "— choisir un exercice enregistré —"));
    DB.live("exercises").then(list => list.sort((a, c) => a.title.localeCompare(c.title)).forEach(x => pick.append(h("option", { value: x.id }, (x.kind ? KINDS[x.kind] + " · " : "") + x.title))));
    pick.addEventListener("change", async () => { if (!pick.value) return; const ex = await DB.get("exercises", pick.value); if (ex) { f.fill(ex); exId = ex.id; } });
    return h("form", { class: "card", style: "margin:10px 0", onsubmit: async e => {
      e.preventDefault();
      const d = f.read();
      if (!d.title) return;
      if (save.checked) { const ex = await DB.save("exercises", { ...d }); exId = ex.id; }
      const data = { ...d, duration_min: dur.value ? Math.max(1, +dur.value) : null, exercise_id: exId };
      if (b) await DB.save("session_blocks", { ...b, ...data });
      else await DB.save("session_blocks", { ...data, session_id: s.id, position: blocks.reduce((m, x) => Math.max(m, x.position), -1) + 1 });
      state.editBlock = null; state.newKind = null; rerender();
    } },
      b ? null : U().field("Partir d'un exercice de la bibliothèque", pick),
      f.nodes[0], f.nodes[1], U().field("Durée (minutes)", dur), f.nodes.slice(2),
      b ? null : h("label", { class: "check", for: "tolib" }, save, "Enregistrer aussi dans la bibliothèque d'exercices"),
      h("button", { type: "submit" }, "Enregistrer le bloc"),
      h("button", { type: "button", class: "ghost", onclick: () => { state.editBlock = null; state.newKind = null; rerender(); } }, "Annuler"));
  }

  // ---------- bibliothèque d'exercices ----------
  async function libraryView() {
    const all = await DB.live("exercises");
    const q = state.lib.q.trim().toLowerCase();
    const list = all.filter(x => (!state.lib.kind || x.kind === state.lib.kind)
      && (!q || [x.title, x.setup, x.description, x.coaching_points, x.variants, x.systems, x.material].some(t => (t || "").toLowerCase().includes(q))))
      .sort((a, b) => a.title.localeCompare(b.title));
    const search = h("input", { type: "search", placeholder: "Chercher un exercice, un système, du matériel…", value: state.lib.q });
    search.addEventListener("change", () => { state.lib.q = search.value; U().setView({ name: "library" }); });
    const kindChip = (k, l) => h("button", { class: "chip" + (state.lib.kind === k ? " on" : ""), onclick: () => { state.lib.kind = k; U().setView({ name: "library" }); } }, l);
    return [
      h("div", { class: "row" }, h("h2", {}, "Carnet d'entraînement"),
        h("button", { onclick: () => U().setView({ name: "exerciseForm" }) }, Icon("plus", 18), "Nouvel exercice")),
      tabs("library"),
      search,
      h("div", { class: "chips filter" }, kindChip("", "Tous"), Object.entries(KINDS).map(([k, l]) => kindChip(k, l))),
      list.length ? list.map(x => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "exerciseForm", id: x.id }) },
        h("div", { style: "flex:1;min-width:0" }, h("strong", {}, x.title),
          h("div", { class: "sub" }, [x.systems, x.material].filter(Boolean).join(" — ") || (x.description || "").slice(0, 90))),
        x.kind ? h("span", { class: "kind k-" + x.kind }, KINDS[x.kind]) : null))
        : U().empty("clipboard", all.length ? "Aucun résultat" : "Aucun exercice enregistré",
          all.length ? "Essaie un autre mot ou enlève le filtre." : "Crée un exercice ici, ou coche « Enregistrer aussi dans la bibliothèque » quand tu écris un bloc de séance. Tu pourras le reprendre en un geste.",
          all.length ? null : h("button", { onclick: () => U().setView({ name: "exerciseForm" }) }, Icon("plus", 18), "Créer un exercice")),
    ];
  }

  async function exerciseForm(v) {
    const old = v.id ? await DB.get("exercises", v.id) : null;
    const f = detailFields(old || {});
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const d = f.read(); if (!d.title) return;
      await DB.save("exercises", old ? { ...old, ...d } : { ...d });
      U().setView({ name: "library" });
    } },
      h("h2", {}, old ? "Modifier l'exercice" : "Nouvel exercice"), f.nodes,
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: () => U().setView({ name: "library" }) }, "Annuler"),
      old ? h("button", { type: "button", class: "ghost danger", onclick: async () => {
        if (!confirm("Supprimer cet exercice de la bibliothèque ? Les séances qui l'utilisent gardent leur copie.")) return;
        await DB.remove("exercises", old); U().setView({ name: "library" });
      } }, Icon("trash", 18), "Supprimer") : null);
  }

  Object.assign(window.Views, { carnet: carnetView, session: sessionView, sessionForm, library: libraryView, exerciseForm });
})();
