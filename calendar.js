// Écrans du calendrier : agenda par semaine, fiche d'une rencontre, modification, conflits, import CSV.
(function () {
  const TZ = "Europe/Paris";
  const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const shortFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "short" });
  const stampFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // AAAA-MM-JJ
  const C = window.Conflicts, DB = window.DB;
  const U = () => window.UI;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const hm = iso => timeFmt.format(new Date(iso));
  const dkey = iso => keyFmt.format(new Date(iso));
  const toISO = (d, t) => new Date(d + "T" + t + ":00").toISOString();
  const pad = n => String(n).padStart(2, "0");
  const localKey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return localKey(d); };
  const mondayOf = k => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localKey(d); };
  const todayKey = () => keyFmt.format(new Date());
  const KIND = { match: "Match", entrainement: "Entraînement", reunion: "Réunion", formation: "Formation", autre: "Autre" };
  const STATUS = { prevu: "Prévu", reporte: "Reporté", annule: "Annulé", joue: "Joué" };
  const HA = { domicile: "Domicile", exterieur: "Extérieur", neutre: "Terrain neutre" };

  const state = { week: mondayOf(todayKey()), cstatus: "todo", cscope: "future" };
  let filter = []; try { filter = JSON.parse(localStorage.getItem("cal_filter") || "[]"); } catch (e) {}
  const saveFilter = () => { try { localStorage.setItem("cal_filter", JSON.stringify(filter)); } catch (e) {} };

  async function context() {
    const teams = await U().loadTeams();
    const info = Object.fromEntries(teams.map(x => [x.ts.id, x]));
    const events = await DB.live("events");
    const prio = e => (info[e.team_season_id] && info[e.team_season_id].ts.priority) || 99;
    return { teams, info, events, prio, an: C.analyse(events, prio) };
  }
  const teamName = (e, c) => (c.info[e.team_season_id] ? c.info[e.team_season_id].team.name : "Sans équipe");
  const title = (e, c) => teamName(e, c) + (e.opponent ? " — " + e.opponent : e.title ? " — " + e.title : "");
  const departBy = e => e.home_away === "exterieur" && e.travel_minutes
    ? hm(new Date(C.startMs(e) - Math.max(+e.travel_minutes, 15) * 60000).toISOString()) : null;
  const h = (...a) => U().h(...a);

  // ---------- pastilles ----------
  function conflictChip(e, c) {
    const i = c.an.info.get(e.id);
    if (!i) return null;
    const s = i.group.status;
    return h("span", { class: "pill " + (s === "done" ? "ok" : s === "blocked" ? "bad" : "warn") },
      s === "done" ? "Conflit géré" : s === "blocked" ? "Toujours en conflit" : "Conflit à traiter");
  }
  const decisionChip = e => e.conflict_decision === "delegue" ? h("span", { class: "pill" }, "Je me fais remplacer")
    : e.conflict_decision === "autre" ? h("span", { class: "pill warn" }, "Autre solution")
    : e.conflict_decision === "present" ? h("span", { class: "pill ok" }, "Je suis présent") : null;
  const statusChip = e => e.status && e.status !== "prevu" ? h("span", { class: "pill " + (e.status === "annule" ? "bad" : "warn") }, STATUS[e.status]) : null;
  const changedChip = e => (e.change_log && e.change_log.length) ? h("span", { class: "pill warn" }, "Modifié") : null;

  // ---------- agenda ----------
  function eventRow(e, c) {
    const away = e.home_away === "exterieur";
    return h("button", { class: "item btnitem ev" + (e.status === "annule" ? " cancelled" : ""), onclick: () => U().setView({ name: "event", id: e.id }) },
      h("div", { class: "evtime" }, hm(e.starts_at)),
      h("div", { class: "evmain" },
        h("strong", {}, title(e, c)),
        h("div", { class: "sub" }, [e.competition, e.home_away ? (away ? "Extérieur" + (e.travel_minutes ? " · " + e.travel_minutes + " min" : "") : HA[e.home_away]) : null, e.venue_name].filter(Boolean).join(" · ")),
        h("div", { class: "chips" }, statusChip(e), changedChip(e), conflictChip(e, c), decisionChip(e))));
  }

  async function calView() {
    const c = await context();
    const from = state.week, to = addDays(from, 6);
    const shown = c.events.filter(e => e.starts_at && (!filter.length || filter.includes(e.team_season_id)))
      .filter(e => { const k = dkey(e.starts_at); return k >= from && k <= to; })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const days = [];
    for (const e of shown) {
      const k = dkey(e.starts_at); let d = days.find(x => x.k === k);
      if (!d) days.push(d = { k, list: [] }); d.list.push(e);
    }
    const next = c.events.filter(e => e.starts_at && dkey(e.starts_at) > to && e.status !== "annule").sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    const jump = h("input", { type: "date", value: from });
    jump.addEventListener("change", () => { if (jump.value) { state.week = mondayOf(jump.value); U().setView({ name: "cal" }); } });
    return [
      h("div", { class: "row" }, h("h2", {}, "Calendrier"),
        h("div", { class: "btns" },
          h("button", { class: "small", onclick: () => U().setView({ name: "eventForm" }) }, Icon("plus", 18), "Rencontre"),
          h("button", { class: "small ghost", onclick: () => U().setView({ name: "venues" }) }, Icon("pin", 18), "Lieux"),
          h("button", { class: "small ghost", onclick: () => U().setView({ name: "import" }) }, Icon("upload", 18), "Importer"))),
      h("div", { class: "weeknav" },
        h("button", { class: "small ghost", onclick: () => { state.week = addDays(state.week, -7); U().setView({ name: "cal" }); } }, Icon("chevL", 18)),
        h("div", { class: "weeklabel" }, "Semaine du " + shortFmt.format(parseKey(from)) + " au " + shortFmt.format(parseKey(to))),
        h("button", { class: "small ghost", onclick: () => { state.week = addDays(state.week, 7); U().setView({ name: "cal" }); } }, Icon("chevR", 18)),
        h("button", { class: "small ghost", onclick: () => { state.week = mondayOf(todayKey()); U().setView({ name: "cal" }); } }, "Aujourd'hui")),
      h("label", { class: "inline" }, "Aller à la date ", jump),
      c.teams.length ? h("div", { class: "chips filter" },
        h("button", { class: "chip" + (!filter.length ? " on" : ""), onclick: () => { filter = []; saveFilter(); U().setView({ name: "cal" }); } }, "Toutes"),
        c.teams.map(x => h("button", { class: "chip" + (filter.includes(x.ts.id) ? " on" : ""), onclick: () => {
          filter = filter.includes(x.ts.id) ? filter.filter(i => i !== x.ts.id) : [...filter, x.ts.id]; saveFilter(); U().setView({ name: "cal" });
        } }, x.team.name))) : null,
      days.length ? days.map(d => h("section", {}, h("h3", {}, cap(dayFmt.format(parseKey(d.k)))), d.list.map(e => eventRow(e, c))))
        : U().empty("calendar", "Aucune rencontre cette semaine", next ? "Tu peux aller directement à la prochaine." : "Ajoute une rencontre ou importe ton planning depuis Google Sheets.",
          next ? h("button", { onclick: () => { state.week = mondayOf(dkey(next.starts_at)); U().setView({ name: "cal" }); } },
            "Prochaine rencontre : " + shortFmt.format(new Date(next.starts_at))) : null),
    ];
  }

  // ---------- décision + solution (réutilisé dans la fiche et dans l'écran Conflits) ----------
  function decisionBar(e, c, after) {
    const sug = (c.an.info.get(e.id) || {}).suggestion;
    const set = async v => { const cur = await DB.get("events", e.id); cur.conflict_decision = cur.conflict_decision === v ? null : v; await DB.save("events", cur); after(); };
    const btn = (v, label) => h("button", { type: "button", class: "choice" + (e.conflict_decision === v ? " on " + v : ""), onclick: () => set(v) },
      label, sug === v && !e.conflict_decision ? h("span", { class: "hint" }, " (suggéré)") : null);
    return h("div", { class: "choices" }, btn("present", "Je suis présent"), btn("delegue", "Je me fais remplacer"), btn("autre", "Autre solution"));
  }
  function solutionBox(e, rows) {
    const note = h("span", { class: "sub saved" }, "");
    const ta = h("textarea", { rows: rows || 3, placeholder: "Ma solution : qui me remplace, auto-coaching, arrivée décalée, covoiturage, arrangement avec le club…" }, e.conflict_solution || "");
    ta.addEventListener("change", async () => {
      const cur = await DB.get("events", e.id); cur.conflict_solution = ta.value.trim() || null; await DB.save("events", cur); note.textContent = "Enregistré ✓";
    });
    return h("div", { class: "solution" }, ta, note);
  }

  // ---------- fiche d'une rencontre ----------
  async function eventView(v) {
    const c = await context();
    const e = await DB.get("events", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "cal" }); return []; }
    const inf = c.an.info.get(e.id);
    const dep = departBy(e);
    const rerender = () => U().setView({ name: "event", id: e.id });
    const log = (e.change_log || []).slice().reverse();
    const ven = e.venue_id ? await DB.get("venues", e.venue_id) : null;
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "cal" }) }, Icon("chevL", 18), "Calendrier"),
      h("h2", {}, title(e, c)),
      h("p", { class: "big" }, cap(dayFmt.format(new Date(e.starts_at))) + " · " + hm(e.starts_at) + " – " + hm(new Date(C.endMs(e)).toISOString())),
      h("div", { class: "chips" }, statusChip(e), changedChip(e), conflictChip(e, c)),
      h("div", { class: "card facts" },
        [["Type", KIND[e.kind] || e.kind], ["Compétition", e.competition], ["Lieu", [e.home_away ? HA[e.home_away] : null, e.venue_name].filter(Boolean).join(" · ")],
          ["Trajet", e.home_away === "exterieur" && e.travel_minutes ? e.travel_minutes + " min" : null], ["Départ au plus tard", dep]]
          .filter(r => r[1]).map(r => h("div", { class: "fact" }, h("span", { class: "sub" }, r[0]), h("strong", {}, r[1])))),
      ven && !ven.deleted_at ? h("div", { class: "card" }, h("strong", {}, ven.name), h("div", { class: "sub" }, [ven.address, ven.city].filter(Boolean).join(", ") || "Adresse à compléter"),
        ven.notes ? h("p", { class: "sub", style: "white-space:pre-wrap;margin:8px 0 0" }, ven.notes) : null,
        h("div", { class: "btns wrap" }, h("button", { class: "small", onclick: () => window.VenueUtil.openMaps(ven) }, Icon("pin", 16), "Itinéraire"),
          h("button", { class: "small ghost", onclick: () => U().setView({ name: "venue", id: ven.id }) }, "Fiche du lieu"))) : null,
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: () => U().setView({ name: "eventForm", id: e.id }) }, "Modifier (date, heure, lieu…)"),
        h("button", { class: "small ghost danger", onclick: async () => { if (!confirm("Supprimer cette rencontre ?")) return; await DB.remove("events", e); U().setView({ name: "cal" }); } }, "Supprimer")),
      h("section", { class: "card" },
        h("h3", { class: "tight" }, "Gestion du conflit"),
        inf ? [
          h("p", { class: "sub" }, inf.others.map(o => (o.rel === "overlap" ? "Chevauchement avec " : "Trop juste avec ") + title(o.event, c) + " (" + hm(o.event.starts_at) + ")").join(" · ")),
          inf.others.map(o => h("button", { class: "small ghost", onclick: () => U().setView({ name: "event", id: o.event.id }) }, "Voir : " + teamName(o.event, c))),
          h("p", { class: "sub" }, inf.suggestion === "present" ? "Cette équipe est plus prioritaire que les autres : je te suggère d'être présent."
            : inf.suggestion === "delegue" ? "Une équipe plus prioritaire joue en même temps : je te suggère de te faire remplacer." : "Priorités égales : à toi de décider."),
          decisionBar(e, c, rerender),
        ] : h("p", { class: "sub" }, "Aucun conflit pour cette rencontre actuellement."),
        solutionBox(e, 4)),
      h("section", {}, h("h3", {}, "Historique des modifications"),
        log.length ? log.map(l => h("div", { class: "item" }, h("div", {}, h("strong", {}, l.field + " : " + (l.from || "—") + " → " + (l.to || "—")),
          h("div", { class: "sub" }, stampFmt.format(new Date(l.at)) + (l.why ? " · " + l.why : "")))))
          : h("p", { class: "sub" }, "Aucune modification depuis la création."),
        e.original_starts_at ? h("p", { class: "sub" }, "Date d'origine : " + cap(dayFmt.format(new Date(e.original_starts_at))) + " à " + hm(e.original_starts_at)) : null),
    ];
  }

  // ---------- création / modification ----------
  async function eventForm(v) {
    const c = await context();
    const old = v.id ? await DB.get("events", v.id) : null;
    const f = old || {};
    const val = (x, d) => x != null && x !== "" ? x : d;
    const tsSel = h("select", { required: true }, h("option", { value: "" }, "— choisir —"),
      c.teams.map(x => h("option", { value: x.ts.id, selected: f.team_season_id === x.ts.id }, x.team.name + " · " + x.season.label)));
    const kind = h("select", {}, Object.entries(KIND).map(([k, l]) => h("option", { value: k, selected: (f.kind || "match") === k }, l)));
    const date = h("input", { type: "date", required: true, value: f.starts_at ? dkey(f.starts_at) : (state.prefillDate || todayKey()) });
    const time = h("input", { type: "time", required: true, value: f.starts_at ? hm(f.starts_at) : "14:00" });
    const dur = h("input", { type: "number", min: 15, step: 5, value: old ? C.durationMin(old) : 120 });
    const opp = h("input", { value: val(f.opponent, ""), placeholder: "Adversaire" });
    const comp = h("input", { value: val(f.competition, ""), placeholder: "ex. Départementale M3" });
    const ha = h("select", {}, h("option", { value: "" }, "—"), Object.entries(HA).map(([k, l]) => h("option", { value: k, selected: f.home_away === k }, l)));
    const venue = h("input", { value: val(f.venue_name, ""), placeholder: "ex. Gymnase des Ovalistes" });
    const travel = h("input", { type: "number", min: 0, step: 5, value: val(f.travel_minutes, ""), placeholder: "minutes, aller simple" });
    const venues = (await DB.live("venues")).sort((a, b) => a.name.localeCompare(b.name));
    const vSel = h("select", {}, h("option", { value: "" }, "— lieu non enregistré —"), venues.map(x => h("option", { value: x.id, selected: f.venue_id === x.id }, x.name + (x.city ? " · " + x.city : ""))));
    vSel.addEventListener("change", () => {
      const x = venues.find(y => y.id === vSel.value); if (!x) return;
      venue.value = x.name; if (x.travel_minutes != null) travel.value = x.travel_minutes;
      if (!ha.value) ha.value = x.is_home ? "domicile" : "exterieur";
    });
    const keep = h("input", { type: "checkbox", id: "keepv" });
    const status = h("select", {}, Object.entries(STATUS).map(([k, l]) => h("option", { value: k, selected: (f.status || "prevu") === k }, l)));
    const why = h("input", { placeholder: "Pourquoi ? (ex. demande du club adverse, salle indisponible)" });
    return h("form", { class: "card", onsubmit: async ev => {
      ev.preventDefault();
      const startIso = toISO(date.value, time.value);
      const d = +dur.value || 120;
      const next = { ...(old || {}), team_season_id: tsSel.value || null, kind: kind.value, starts_at: startIso,
        ends_at: new Date(Date.parse(startIso) + d * 60000).toISOString(), opponent: opp.value.trim() || null, competition: comp.value.trim() || null,
        home_away: ha.value || null, venue_name: venue.value.trim() || null, venue_id: vSel.value || null, travel_minutes: travel.value === "" ? null : +travel.value, status: status.value };
      if (old) {
        const log = (old.change_log || []).slice();
        const add = (field, from, to) => { if ((from || "") !== (to || "")) log.push({ at: new Date().toISOString(), field, from: from || "", to: to || "", why: why.value.trim() || "" }); };
        add("Date", cap(shortFmt.format(new Date(old.starts_at))), cap(shortFmt.format(new Date(next.starts_at))));
        add("Heure", hm(old.starts_at), hm(next.starts_at));
        add("Lieu", old.venue_name, next.venue_name);
        add("Domicile/extérieur", old.home_away ? HA[old.home_away] : "", next.home_away ? HA[next.home_away] : "");
        add("Adversaire", old.opponent, next.opponent);
        add("Statut", STATUS[old.status || "prevu"], STATUS[next.status]);
        next.change_log = log;
        if (dkey(old.starts_at) !== dkey(next.starts_at) || hm(old.starts_at) !== hm(next.starts_at)) next.original_starts_at = old.original_starts_at || old.starts_at;
        if ((old.venue_name || "") !== (next.venue_name || "")) next.original_venue_name = old.original_venue_name || old.venue_name || null;
        const timeChanged = old.starts_at !== next.starts_at || C.durationMin(old) !== d || (old.travel_minutes || 0) !== (next.travel_minutes || 0) || old.home_away !== next.home_away || old.status !== next.status;
        if (timeChanged && old.conflict_decision) { next.conflict_decision = null; U().toast("Horaire modifié : revois ta décision de conflit pour cette rencontre."); }
      } else next.change_log = [];
      if (keep.checked && !next.venue_id && next.venue_name) {
        const nv = await DB.save("venues", { name: next.venue_name, travel_minutes: next.travel_minutes, is_home: next.home_away === "domicile" });
        next.venue_id = nv.id;
      }
      const saved = await DB.save("events", next);
      state.week = mondayOf(dkey(saved.starts_at));
      U().setView({ name: "event", id: saved.id });
    } },
      h("h2", {}, old ? "Modifier la rencontre" : "Nouvelle rencontre"),
      U().field("Équipe", tsSel), U().field("Type", kind),
      h("div", { class: "two" }, U().field("Date", date), U().field("Heure", time)),
      U().field("Durée (minutes)", dur), U().field("Adversaire", opp), U().field("Compétition", comp),
      U().field("Domicile / extérieur", ha), venues.length ? U().field("Lieu enregistré", vSel) : null, U().field("Lieu", venue),
      h("label", { class: "check", for: "keepv" }, keep, "Garder ce lieu dans mes lieux"), U().field("Trajet depuis Grenoble (minutes, pour l'extérieur)", travel),
      U().field("Statut", status),
      old ? U().field("Raison du changement (gardée dans l'historique)", why) : null,
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: () => U().setView(old ? { name: "event", id: old.id } : { name: "cal" }) }, "Annuler"));
  }

  // ---------- écran Conflits ----------
  function timeline(g, c) {
    const occ = e => [C.startMs(e) - C.travelMin(e) * 60000, C.endMs(e) + C.travelMin(e) * 60000];
    const t0 = Math.min(...g.events.map(e => occ(e)[0])), t1 = Math.max(...g.events.map(e => occ(e)[1])), span = t1 - t0 || 1;
    const pct = t => ((t - t0) / span * 100).toFixed(2) + "%";
    return g.events.map(e => {
      const [a, b] = occ(e);
      return h("div", { class: "tl" },
        h("div", { class: "tllabel" }, h("strong", {}, hm(e.starts_at)), " ", teamName(e, c)),
        h("div", { class: "track" },
          h("div", { class: "travel", style: "left:" + pct(a) + ";width:" + ((b - a) / span * 100).toFixed(2) + "%" }),
          h("div", { class: "bar " + (e.conflict_decision || "none"), style: "left:" + pct(C.startMs(e)) + ";width:" + ((C.endMs(e) - C.startMs(e)) / span * 100).toFixed(2) + "%" })));
    });
  }
  async function conflictsView() {
    const c = await context();
    const nowMs = Date.now();
    let groups = c.an.groups;
    if (state.cscope === "future") groups = groups.filter(g => g.events.some(e => C.endMs(e) >= nowMs));
    const count = s => groups.filter(g => g.status === s).length;
    const shown = groups.filter(g => state.cstatus === "all" ? true : state.cstatus === "todo" ? g.status !== "done" : g.status === "done");
    const tab = (k, label) => h("button", { class: "chip" + (state.cstatus === k ? " on" : ""), onclick: () => { state.cstatus = k; U().setView({ name: "conflicts" }); } }, label);
    const rerender = () => U().setView({ name: "conflicts" });
    return [
      h("div", { class: "row" }, h("h2", {}, "Conflits"),
        h("button", { class: "small ghost", onclick: () => { state.cscope = state.cscope === "future" ? "all" : "future"; rerender(); } }, state.cscope === "future" ? "Voir aussi le passé" : "Seulement à venir")),
      h("p", { class: "sub" }, "Un conflit apparaît quand deux rencontres se chevauchent, ou quand il manque le temps de trajet entre elles. Deux matchs de la même équipe ne comptent pas."),
      h("div", { class: "chips filter" }, tab("todo", "À traiter (" + (count("todo") + count("blocked")) + ")"), tab("done", "Résolus (" + count("done") + ")"), tab("all", "Tous (" + groups.length + ")")),
      shown.length ? shown.map(g => h("section", { class: "card group " + g.status },
        h("div", { class: "row" }, h("h3", { class: "tight" }, cap(dayFmt.format(new Date(g.events[0].starts_at)))),
          h("span", { class: "pill " + (g.status === "done" ? "ok" : g.status === "blocked" ? "bad" : "warn") },
            g.status === "done" ? "Résolu" : g.status === "blocked" ? "Deux présences impossibles" : "À traiter")),
        timeline(g, c),
        g.events.map(e => {
          const inf = c.an.info.get(e.id);
          return h("div", { class: "cevent" },
            h("div", { class: "row" }, h("div", {}, h("strong", {}, title(e, c)),
              h("div", { class: "sub" }, hm(e.starts_at) + " – " + hm(new Date(C.endMs(e)).toISOString()) + " · " + (e.home_away === "exterieur" ? "Extérieur" + (e.travel_minutes ? " " + e.travel_minutes + " min" : "") : "Domicile") + " · P" + c.prio(e))),
              h("button", { class: "small ghost", onclick: () => U().setView({ name: "event", id: e.id }) }, "Détail")),
            decisionBar(e, c, rerender), solutionBox(e, 2));
        }),
        g.events.some(e => !e.conflict_decision) ? h("button", { class: "small ghost", onclick: async () => {
          for (const e of g.events) { const s = c.an.info.get(e.id).suggestion; if (!e.conflict_decision && s) { const cur = await DB.get("events", e.id); cur.conflict_decision = s; await DB.save("events", cur); } }
          rerender();
        } }, "Appliquer mes suggestions (priorité des équipes)") : null,
      )) : U().empty("check", state.cstatus === "todo" ? "Aucun conflit à traiter" : "Rien à afficher ici", state.cstatus === "todo" ? "Toutes tes rencontres à venir sont compatibles, ou déjà gérées." : "Change de filtre pour voir les autres conflits.", null)
    ];
  }

  // ---------- import du planning (CSV exporté depuis Google Sheets) ----------
  function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    const first = text.split(/\r?\n/, 1)[0] || "";
    const sep = (first.split(";").length > first.split(",").length) ? ";" : ",";
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch !== "\r") cur += ch;
    }
    row.push(cur); rows.push(row);
    return rows.filter(r => r.some(x => x.trim()));
  }
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  function readPlanning(text) {
    const rows = parseCsv(text);
    const hi = rows.findIndex(r => { const n = r.map(norm); return n.includes("date") && n.includes("equipe"); });
    if (hi < 0) return { error: "Je ne trouve pas les colonnes « Date » et « Équipe » dans ce fichier." };
    const head = rows[hi].map(norm), at = p => head.findIndex(x => x.startsWith(p));
    const ix = { date: at("date"), time: at("heure"), team: at("equipe"), role: at("role"), prio: at("priorite"), comp: at("competition"), place: at("lieu"), opp: at("adversaire"), trip: at("trajet") };
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const dm = (r[ix.date] || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/), tm = (r[ix.time] || "").match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
      if (!dm || !tm || !(r[ix.team] || "").trim()) continue;
      const lieu = norm(r[ix.place]), trip = ((r[ix.trip] || "").match(/(\d+)\s*min/) || [])[1];
      const prio = ((r[ix.prio] || "").match(/P\s*(\d)/) || [])[1], role = norm(r[ix.role]);
      out.push({ team: r[ix.team].trim(), starts: toISO(dm[3] + "-" + pad(dm[2]) + "-" + pad(dm[1]), pad(tm[1]) + ":" + tm[2]),
        comp: (r[ix.comp] || "").trim() || null, opp: (r[ix.opp] || "").trim() || null,
        ha: lieu.startsWith("dom") ? "domicile" : lieu.startsWith("ext") ? "exterieur" : lieu.startsWith("neutre") ? "neutre" : null,
        travel: trip ? +trip : null, prio: prio ? +prio : null, role: role.includes("assist") ? "assistant" : role.includes("joueur") ? "joueur" : "principal" });
    }
    return { rows: out };
  }
  let pending = null;
  async function importView() {
    const c = await context();
    const file = h("input", { type: "file", accept: ".csv,.txt,text/csv,text/plain", class: "hidden", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      pending = readPlanning(await f.text()); e.target.value = ""; U().setView({ name: "import" });
    } });
    const back = h("button", { class: "small ghost back", onclick: () => { pending = null; U().setView({ name: "cal" }); } }, Icon("chevL", 18), "Calendrier");
    if (!pending) return [back, h("h2", {}, "Importer un planning"),
      h("div", { class: "card" },
        h("p", {}, "Dans Google Sheets : ouvre ton planning, onglet « Calendrier complet », puis Fichier → Télécharger → Valeurs séparées par des virgules (.csv)."),
        h("p", { class: "sub" }, "Colonnes reconnues : Date, Heure, Équipe, Rôle, Priorité, Compétition, Lieu (Domicile/Extérieur), Adversaire, Trajet. Les anciennes colonnes de décision ne sont pas reprises : tu décides dans l'écran Conflits."),
        h("button", { onclick: () => file.click() }, "Choisir le fichier CSV"), file)];
    if (pending.error) return [back, h("div", { class: "card" }, h("p", { class: "msg err" }, pending.error), h("button", { onclick: () => { pending = null; U().setView({ name: "import" }); } }, "Réessayer"))];
    const names = [...new Set(pending.rows.map(r => r.team))];
    const selects = {};
    const season = U().defaultSeason;
    for (const n of names) {
      const sel = h("select", {}, h("option", { value: "new" }, "➕ Créer « " + n + " »"),
        c.teams.map(x => h("option", { value: x.ts.id, selected: norm(x.team.name) === norm(n) }, x.team.name + " · " + x.season.label)));
      selects[n] = sel;
    }
    return [back, h("h2", {}, "Importer " + pending.rows.length + " rencontres"),
      h("p", { class: "sub" }, "Associe chaque équipe du fichier à une équipe de l'application. Choisis « Créer » pour les nouvelles équipes (saison " + season + ")."),
      h("div", { class: "card" }, names.map(n => h("label", {}, n + " (" + pending.rows.filter(r => r.team === n).length + ")", selects[n])),
        h("button", { onclick: async () => {
          const map = {}, existing = await DB.live("events");
          let sea = (await DB.live("seasons")).find(s => s.label === season) || await DB.save("seasons", { label: season });
          for (const n of names) {
            if (selects[n].value !== "new") { map[n] = selects[n].value; continue; }
            const sample = pending.rows.find(r => r.team === n);
            const t = await DB.save("teams", { name: n });
            map[n] = (await DB.save("team_seasons", { team_id: t.id, season_id: sea.id, role: sample.role, priority: sample.prio || 3 })).id;
          }
          const seen = new Set(existing.map(e => e.team_season_id + "|" + e.starts_at + "|" + (e.opponent || "").toLowerCase()));
          let n = 0, first = null;
          for (const r of pending.rows) {
            const key = map[r.team] + "|" + r.starts + "|" + (r.opp || "").toLowerCase();
            if (seen.has(key)) continue; seen.add(key);
            await DB.save("events", { team_season_id: map[r.team], kind: "match", starts_at: r.starts, opponent: r.opp, competition: r.comp, home_away: r.ha,
              travel_minutes: r.travel, status: "prevu", change_log: [] });
            n++; if (!first || r.starts < first) first = r.starts;
          }
          pending = null; if (first) state.week = mondayOf(dkey(first));
          U().toast(n + " rencontre(s) importée(s)."); U().setView({ name: "conflicts" });
        } }, "Importer"))];
  }

  async function badge() {
    const c = await context(), now = Date.now();
    return c.an.groups.filter(g => g.status !== "done" && g.events.some(e => C.endMs(e) >= now)).length;
  }
  window.CalUtil = { hm, dkey, toISO, cap, dayFmt, shortFmt, pad, todayKey, parseKey, mondayOf };
  window.Views = { cal: calView, event: eventView, eventForm, conflicts: conflictsView, import: importView };
  window.CoachCal = { badge };
})();
