// Suivi individuel : fiche joueur (profil, objectifs, observations + / −, entretiens et bilans) et PDF à partager.
// Les observations se notent depuis la séance ou après un match ; elles se retrouvent toutes sur la fiche du joueur.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);
  const TONE = { plus: { l: "+", c: "ok", n: "Positif" }, moins: { l: "−", c: "bad", n: "À travailler" }, neutre: { l: "•", c: "", n: "Note" } };
  const GOAL = { en_cours: { n: "En cours", c: "warn" }, atteint: { n: "Atteint", c: "ok" }, abandonne: { n: "Abandonné", c: "" } };
  const NEXT = { en_cours: "atteint", atteint: "abandonne", abandonne: "en_cours" };
  const KIND = { entretien: "Entretien", bilan: "Bilan" };
  const full = p => [p.first_name, p.last_name].filter(Boolean).join(" ");
  const dfr = k => k ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" }).format(K().parseKey(k)) : "";
  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  // État des saisies hors de l'écran (l'appli se redessine à chaque synchronisation)
  const draft = {};                                   // observation en cours, par contexte
  const st = { filter: "all", nf: null, gf: { cycle: "", body: "" }, ef: null, lastCycle: "" };
  const pdf = { profil: true, objectifs: true, bilan: false, nom: false };

  async function rosterOf(tsId) {
    const [mem, pl] = await Promise.all([DB.live("memberships"), DB.live("players")]);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    return mem.filter(m => m.team_season_id === tsId && P[m.player_id]).map(m => ({ m, p: P[m.player_id] }))
      .sort((a, b) => (a.m.jersey_number ?? 999) - (b.m.jersey_number ?? 999) || a.p.first_name.localeCompare(b.p.first_name));
  }
  const sourceLabel = async e => {
    if (e.session_id) { const s = await DB.get("sessions", e.session_id); return s && !s.deleted_at ? "Séance · " + (s.title || "sans titre") : "Séance"; }
    if (e.event_id) { const v = await DB.get("events", e.event_id); return v && !v.deleted_at ? "Match" + (v.opponent ? " · " + v.opponent : "") : "Match"; }
    return "Note libre";
  };

  // ---------- saisie rapide + / − (séance ou match) ----------
  async function obsPanel({ key, players, ctx, date, rerender }) {
    const all = (await DB.live("player_entries")).filter(e => e.kind === "observation" && (ctx.session_id ? e.session_id === ctx.session_id : e.event_id === ctx.event_id));
    const dr = draft[key] || null;
    if (!players.length) return h("p", { class: "sub" }, "Aucun joueur à observer pour l'instant.");
    const open = (pid, tone) => { draft[key] = dr && dr.pid === pid && dr.tone === tone ? null : { pid, tone, text: dr && dr.pid === pid ? dr.text : "" }; rerender(); };
    const save = async () => {
      const d = draft[key]; if (!d) return;
      await DB.save("player_entries", { player_id: d.pid, kind: "observation", tone: d.tone, entry_date: date, body: (d.text || "").trim() || null,
        session_id: ctx.session_id || null, event_id: ctx.event_id || null });
      draft[key] = null; rerender();
    };
    return h("div", {}, h("p", { class: "sub" }, "Touche + ou − sur un joueur, écris une phrase si tu veux, puis enregistre. Tout est gardé sur sa fiche."),
      players.map(p => {
        const mine = all.filter(e => e.player_id === p.id).sort((a, b) => (a.created_at || a.updated_at_local || "").localeCompare(b.created_at || b.updated_at_local || ""));
        const isOpen = dr && dr.pid === p.id;
        let input = null;
        if (isOpen) {
          input = h("input", { class: "obsin", placeholder: dr.tone === "plus" ? "Ce qui était bien (facultatif)" : dr.tone === "moins" ? "Ce qu'il faut travailler (facultatif)" : "Note (facultatif)", value: dr.text || "" });
          input.addEventListener("input", () => { draft[key].text = input.value; });
          input.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); save(); } });
        }
        return h("div", { class: "obsrow" },
          h("div", { class: "obstop" },
            h("div", { class: "att-name" }, h("span", { class: "num" }, p.jersey != null ? p.jersey : ""), h("span", {}, p.label)),
            h("div", { class: "obsbtns" },
              ["plus", "moins"].map(t => h("button", { type: "button", class: "tonebtn " + t + (isOpen && dr.tone === t ? " on" : ""), "aria-label": TONE[t].n, onclick: () => open(p.id, t) }, TONE[t].l)))),
          mine.map(e => h("div", { class: "obsline" }, h("span", { class: "pill " + TONE[e.tone || "neutre"].c }, TONE[e.tone || "neutre"].l), h("span", {}, e.body || "—"),
            h("button", { type: "button", class: "ghost icononly danger small", "aria-label": "Supprimer cette observation", onclick: async () => { await DB.remove("player_entries", e); rerender(); } }, Icon("trash", 14)))),
          isOpen ? h("div", { class: "obsedit" }, input, h("button", { type: "button", class: "small", onclick: save }, "Enregistrer")) : null);
      }));
  }
  async function playersFor(tsId, onlyIds) {
    const r = await rosterOf(tsId);
    return r.filter(x => !onlyIds || onlyIds.includes(x.p.id)).map(x => ({ id: x.p.id, label: full(x.p), jersey: x.m.jersey_number }));
  }
  // Séance : les joueurs présents (ou tout l'effectif si l'appel n'est pas fait)
  async function obsForSession(s, rerender) {
    if (!s.team_season_id) return h("p", { class: "sub" }, "Choisis une équipe pour la séance afin de noter des observations.");
    const att = (await DB.live("session_attendance")).filter(a => a.session_id === s.id);
    const present = att.filter(a => a.status === "present").map(a => a.player_id);
    const players = await playersFor(s.team_season_id, att.length ? present : null);
    return obsPanel({ key: "s:" + s.id, players, ctx: { session_id: s.id }, date: K().dkey(s.starts_at), rerender });
  }
  // Match : les joueurs de la feuille de match (ou tout l'effectif)
  async function obsForMatch(e, rerender) {
    const players = await playersFor(e.team_season_id, e.squad && e.squad.length ? e.squad : null);
    return obsPanel({ key: "m:" + e.id, players, ctx: { event_id: e.id }, date: K().dkey(e.starts_at), rerender });
  }

  // ---------- fiche joueur ----------
  async function playerView(v) {
    const m = await DB.get("memberships", v.mId), p = m ? await DB.get("players", m.player_id) : null;
    const back = () => U().setView({ name: "team", id: v.tsId });
    if (!m || !p || p.deleted_at) { back(); return []; }
    const rerender = () => U().setView({ name: "player", tsId: v.tsId, mId: v.mId });
    const [ts, entries, goals, events, stints] = await Promise.all([DB.get("team_seasons", v.tsId), DB.live("player_entries"), DB.live("player_goals"), DB.live("events"), DB.live("match_stints")]);
    const team = ts ? await DB.get("teams", ts.team_id) : null;
    const mineE = entries.filter(e => e.player_id === p.id), mineG = goals.filter(g => g.player_id === p.id);

    // profil : enregistré à chaque modification
    const prof = (key, label, ph) => {
      const note = h("span", { class: "sub saved" }, "");
      const ta = h("textarea", { rows: 3, placeholder: ph }, p[key] || "");
      ta.addEventListener("change", async () => { const cur = await DB.get("players", p.id); cur[key] = ta.value.trim() || null; await DB.save("players", cur); note.textContent = "Enregistré ✓"; });
      return h("div", {}, h("label", {}, label), ta, note);
    };

    // temps de jeu (depuis les feuilles de match)
    const matches = events.filter(e => e.team_season_id === v.tsId && e.kind === "match");
    const per = matches.map(e => stints.filter(s => s.event_id === e.id && s.player_id === p.id && s.out_s != null).reduce((a, s) => a + (s.out_s - s.in_s), 0))
      .filter((t, i) => stints.some(s => s.event_id === matches[i].id && s.player_id === p.id));
    const playtime = per.length ? h("p", { class: "sub" }, "Temps de jeu : " + per.length + " match(s), " + fmt(per.reduce((a, b) => a + b, 0) / per.length) + " en moyenne.") : null;

    // objectifs
    const cycles = [...new Set(mineG.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")).map(g => g.cycle || "Sans cycle"))];
    const gcycle = h("input", { list: "cycles", placeholder: "Cycle (ex. Cycle 2 – novembre-décembre)", value: st.gf.cycle || st.lastCycle });
    gcycle.addEventListener("input", () => { st.gf.cycle = gcycle.value; });
    const gbody = h("input", { placeholder: "Objectif (ex. Finir à gauche avec la main faible)", value: st.gf.body });
    gbody.addEventListener("input", () => { st.gf.body = gbody.value; });
    const addGoal = async () => {
      if (!gbody.value.trim()) return;
      st.lastCycle = gcycle.value.trim();
      await DB.save("player_goals", { player_id: p.id, cycle: gcycle.value.trim() || null, body: gbody.value.trim(), status: "en_cours", position: mineG.length });
      st.gf = { cycle: "", body: "" }; rerender();
    };

    // observations
    const flt = st.filter;
    const obsAll = mineE.filter(e => e.kind === "observation").sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || "") || (b.created_at || b.updated_at_local || "").localeCompare(a.created_at || a.updated_at_local || ""));
    const obs = obsAll.filter(e => flt === "all" || (flt === "seance" && e.session_id) || (flt === "match" && e.event_id) || (flt === "libre" && !e.session_id && !e.event_id));
    const cnt = t => obsAll.filter(e => e.tone === t).length;
    const labels = await Promise.all(obs.map(sourceLabel));
    const nf = st.nf;
    let nfBox = null;
    if (nf) {
      const nbody = h("textarea", { rows: 2, placeholder: "Observation" }, nf.body || ""); nbody.addEventListener("input", () => { nf.body = nbody.value; });
      const ndate = h("input", { type: "date", value: nf.date }); ndate.addEventListener("change", () => { nf.date = ndate.value; });
      nfBox = h("div", { class: "card inner" },
        h("div", { class: "seg" }, ["plus", "moins", "neutre"].map(t => h("button", { type: "button", class: "segb" + (nf.tone === t ? " on" : ""), onclick: () => { nf.tone = t; rerender(); } }, TONE[t].l + " " + TONE[t].n))),
        U().field("Date", ndate), nbody,
        h("div", { class: "btns wrap" }, h("button", { class: "small", onclick: async () => {
          if (!nf.body.trim()) { U().toast("Écris une observation."); return; }
          await DB.save("player_entries", { player_id: p.id, kind: "observation", tone: nf.tone, entry_date: nf.date || K().todayKey(), body: nf.body.trim() }); st.nf = null; rerender();
        } }, "Enregistrer"), h("button", { class: "small ghost", onclick: () => { st.nf = null; rerender(); } }, "Annuler")));
    }

    // entretiens et bilans
    const ent = mineE.filter(e => e.kind !== "observation").sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""));
    const ef = st.ef;
    let efBox = null;
    if (ef) {
      const ek = h("select", {}, Object.entries(KIND).map(([k, l]) => h("option", { value: k, selected: ef.kind === k }, l))); ek.addEventListener("change", () => { ef.kind = ek.value; });
      const et = h("input", { placeholder: "Titre (ex. Entretien de reprise)", value: ef.title || "" }); et.addEventListener("input", () => { ef.title = et.value; });
      const ed = h("input", { type: "date", value: ef.date }); ed.addEventListener("change", () => { ef.date = ed.value; });
      const eb = h("textarea", { rows: 6, placeholder: "Ce qui s'est dit, ce qui a été décidé" }, ef.body || ""); eb.addEventListener("input", () => { ef.body = eb.value; });
      efBox = h("div", { class: "card inner" }, h("div", { class: "two" }, U().field("Type", ek), U().field("Date", ed)), U().field("Titre", et), eb,
        h("div", { class: "btns wrap" }, h("button", { class: "small", onclick: async () => {
          if (!(ef.body || "").trim() && !(ef.title || "").trim()) { U().toast("Écris au moins un titre ou un texte."); return; }
          await DB.save("player_entries", { player_id: p.id, kind: ef.kind, tone: null, entry_date: ef.date || K().todayKey(), title: (ef.title || "").trim() || null, body: (ef.body || "").trim() || null }); st.ef = null; rerender();
        } }, "Enregistrer"), h("button", { class: "small ghost", onclick: () => { st.ef = null; rerender(); } }, "Annuler")));
    }

    return [
      h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), team ? team.name : "Équipe"),
      h("div", { class: "row" }, h("h2", {}, (m.jersey_number != null ? "#" + m.jersey_number + " " : "") + full(p)),
        h("div", { class: "btns" },
          h("button", { class: "small", onclick: () => U().setView({ name: "playerPdf", tsId: v.tsId, mId: v.mId }) }, Icon("copy", 18), "PDF à partager"),
          h("button", { class: "small ghost", onclick: () => U().setView({ name: "playerForm", tsId: v.tsId, mId: v.mId }) }, Icon("edit", 18), "Identité"))),
      h("p", { class: "sub" }, [p.position, p.birth_year].filter(Boolean).join(" · ") || "Poste et année de naissance dans « Identité »."), playtime,

      h("h3", {}, "Profil"),
      h("section", { class: "card" }, prof("role_note", "Rôle dans l'équipe", "Ex. meneuse, première défenseuse, relayeuse"),
        prof("strengths", "Points forts", "Ce sur quoi elle peut s'appuyer"), prof("to_improve", "Axes de progrès", "Ce qu'on travaille en priorité")),

      h("h3", {}, "Objectifs individuels"),
      h("section", { class: "card" },
        mineG.length ? cycles.map(c => h("div", { class: "goalcycle" }, h("div", { class: "sub strong" }, c),
          mineG.filter(g => (g.cycle || "Sans cycle") === c).sort((a, b) => a.position - b.position).map(g => h("div", { class: "goal" },
            h("button", { type: "button", class: "pill " + GOAL[g.status].c + " pbtn", title: "Changer le statut", onclick: async () => { const cur = await DB.get("player_goals", g.id); cur.status = NEXT[cur.status]; await DB.save("player_goals", cur); rerender(); } }, GOAL[g.status].n),
            h("span", { class: "gb" + (g.status !== "en_cours" ? " done" : "") }, g.body),
            h("button", { type: "button", class: "ghost icononly danger small", "aria-label": "Supprimer l'objectif", onclick: async () => { await DB.remove("player_goals", g); rerender(); } }, Icon("trash", 14))))))
          : h("p", { class: "sub" }, "Aucun objectif pour l'instant. Ajoute 2 ou 3 objectifs pour le cycle en cours."),
        h("datalist", { id: "cycles" }, [...new Set(goals.map(g => g.cycle).filter(Boolean))].map(c => h("option", { value: c }))),
        h("div", { class: "goaladd" }, gcycle, gbody, h("button", { class: "small", onclick: addGoal }, Icon("plus", 16), "Ajouter")),
        h("p", { class: "sub" }, "Touche le statut d'un objectif pour le faire passer de « En cours » à « Atteint », puis « Abandonné ».")),

      h("div", { class: "row" }, h("h3", {}, "Observations (" + obsAll.length + ")"),
        h("button", { class: "small ghost", onclick: () => { st.nf = { tone: "plus", body: "", date: K().todayKey() }; rerender(); } }, Icon("plus", 16), "Observation libre")),
      h("p", { class: "sub" }, cnt("plus") + " positives · " + cnt("moins") + " à travailler. Elles se notent depuis la séance ou la feuille de match."),
      h("div", { class: "chips filter" }, [["all", "Toutes"], ["seance", "Séances"], ["match", "Matchs"], ["libre", "Libres"]].map(([k, l]) =>
        h("button", { class: "chip" + (flt === k ? " on" : ""), onclick: () => { st.filter = k; rerender(); } }, l))),
      nfBox,
      obs.length ? obs.map((e, i) => h("div", { class: "item obsitem" },
        h("div", { style: "flex:1;min-width:0" },
          h("div", { class: "chips" }, h("span", { class: "pill " + TONE[e.tone || "neutre"].c }, TONE[e.tone || "neutre"].l + " " + TONE[e.tone || "neutre"].n), h("span", { class: "sub" }, dfr(e.entry_date) + " · " + labels[i])),
          h("div", { style: "white-space:pre-wrap;margin-top:6px" }, e.body || h("span", { class: "sub" }, "Sans commentaire"))),
        h("button", { type: "button", class: "ghost icononly danger small", "aria-label": "Supprimer", onclick: async () => { if (!confirm("Supprimer cette observation ?")) return; await DB.remove("player_entries", e); rerender(); } }, Icon("trash", 14))))
        : h("p", { class: "sub" }, obsAll.length ? "Aucune observation dans ce filtre." : "Aucune observation pour l'instant."),

      h("div", { class: "row" }, h("h3", {}, "Entretiens et bilans"),
        h("button", { class: "small ghost", onclick: () => { st.ef = { kind: "entretien", title: "", body: "", date: K().todayKey() }; rerender(); } }, Icon("plus", 16), "Ajouter")),
      efBox,
      ent.length ? ent.map(e => h("section", { class: "card entry" },
        h("div", { class: "row tight" }, h("div", {}, h("strong", {}, e.title || KIND[e.kind]), h("div", { class: "sub" }, KIND[e.kind] + " · " + dfr(e.entry_date))),
          h("button", { type: "button", class: "ghost icononly danger small", "aria-label": "Supprimer", onclick: async () => { if (!confirm("Supprimer cette fiche ?")) return; await DB.remove("player_entries", e); rerender(); } }, Icon("trash", 14))),
        e.body ? h("div", { class: "notebody", style: "margin-top:8px" }, e.body) : null))
        : (efBox ? null : h("p", { class: "sub" }, "Aucun entretien ni bilan noté.")),
    ];
  }

  // ---------- PDF à partager ----------
  async function pdfView(v) {
    const m = await DB.get("memberships", v.mId), p = m ? await DB.get("players", m.player_id) : null;
    if (!m || !p) { U().setView({ name: "team", id: v.tsId }); return []; }
    const rerender = () => U().setView({ name: "playerPdf", tsId: v.tsId, mId: v.mId });
    const [ts, entries, goals] = await Promise.all([DB.get("team_seasons", v.tsId), DB.live("player_entries"), DB.live("player_goals")]);
    const team = ts ? await DB.get("teams", ts.team_id) : null, season = ts ? await DB.get("seasons", ts.season_id) : null;
    const gl = goals.filter(g => g.player_id === p.id && g.status !== "abandonne").sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.position - b.position);
    const cycles = [...new Set(gl.map(g => g.cycle || "Objectifs"))];
    const lastBilan = entries.filter(e => e.player_id === p.id && e.kind === "bilan").sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""))[0];
    const name = pdf.nom ? full(p) : p.first_name;
    const has = { profil: !!(p.role_note || p.strengths || p.to_improve), obj: gl.length, bil: !!(lastBilan && lastBilan.body) };
    const sec = (title, body) => h("div", { class: "psec" }, h("h3", {}, title), body);
    const para = t => h("p", { class: "ptext" }, t);

    const lines = [];                                  // même contenu en texte brut (WhatsApp, e-mail)
    lines.push(name + (m.jersey_number != null ? " (#" + m.jersey_number + ")" : "") + " — " + [team && team.name, season && season.label].filter(Boolean).join(" · "));
    if (pdf.profil && has.profil) {
      if (p.role_note) lines.push("", "Rôle dans l'équipe", p.role_note);
      if (p.strengths) lines.push("", "Points forts", p.strengths);
      if (p.to_improve) lines.push("", "Axes de progrès", p.to_improve);
    }
    if (pdf.objectifs && has.obj) { lines.push("", "Objectifs"); for (const c of cycles) { lines.push(c + " :"); gl.filter(g => (g.cycle || "Objectifs") === c).forEach(g => lines.push("- " + g.body + (g.status === "atteint" ? " (atteint)" : ""))); } }
    if (pdf.bilan && has.bil) lines.push("", lastBilan.title || "Bilan", lastBilan.body);

    const chk = (key, label, dis) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!pdf[key], disabled: !!dis, onchange: ev => { pdf[key] = ev.target.checked; rerender(); } }), label);
    return [
      h("div", { class: "noprint" },
        h("button", { class: "small ghost back", onclick: () => U().setView({ name: "player", tsId: v.tsId, mId: v.mId }) }, Icon("chevL", 18), "Fiche de " + p.first_name),
        h("h2", {}, "PDF à partager"),
        h("p", { class: "sub" }, "Une version propre à envoyer à la joueuse ou à ses parents. Tes observations + / − et le détail des entretiens n'y sont jamais."),
        h("section", { class: "card" }, h("div", { class: "pdfopts" },
          chk("profil", "Profil (rôle, points forts, axes)", !has.profil), chk("objectifs", "Objectifs", !has.obj), chk("bilan", "Dernier bilan", !has.bil), chk("nom", "Inclure le nom de famille")),
          h("div", { class: "btns wrap" },
            h("button", { onclick: () => window.print() }, Icon("copy", 18), "Imprimer / Enregistrer en PDF"),
            h("button", { class: "ghost", onclick: async () => { try { await navigator.clipboard.writeText(lines.join("\n")); U().toast("Texte copié."); } catch (e) { U().toast("Copie impossible sur cet appareil."); } } }, "Copier en texte")))),
      h("article", { class: "paper" },
        h("header", { class: "phead" }, h("div", { class: "pmark" }, "7"),
          h("div", {}, h("h1", {}, name), h("div", { class: "psub" }, [m.jersey_number != null ? "N° " + m.jersey_number : null, p.position, team && team.name, season && season.label].filter(Boolean).join(" · ")))),
        pdf.profil && has.profil ? [p.role_note ? sec("Rôle dans l'équipe", para(p.role_note)) : null, p.strengths ? sec("Points forts", para(p.strengths)) : null, p.to_improve ? sec("Axes de progrès", para(p.to_improve)) : null] : null,
        pdf.objectifs && has.obj ? sec("Objectifs", cycles.map(c => h("div", {}, h("div", { class: "pcycle" }, c),
          h("ul", {}, gl.filter(g => (g.cycle || "Objectifs") === c).map(g => h("li", { class: g.status === "atteint" ? "ok" : "" }, g.body + (g.status === "atteint" ? " ✓" : "")))))) ) : null,
        pdf.bilan && has.bil ? sec(lastBilan.title || "Bilan", para(lastBilan.body)) : null,
        !(pdf.profil && has.profil) && !(pdf.objectifs && has.obj) && !(pdf.bilan && has.bil) ? h("p", { class: "psub" }, "Rien à afficher : remplis le profil ou ajoute des objectifs sur la fiche.") : null,
        h("footer", { class: "pfoot" }, "COACH ISMO · " + new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }).format(new Date()))),
    ];
  }

  window.SuiviUtil = { obsForSession, obsForMatch };
  Object.assign(window.Views, { player: playerView, playerPdf: pdfView });
})();
