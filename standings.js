// Classement de poule : récupéré automatiquement (API FFBB non officielle) ou saisi à la main si ça ne marche pas.
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI;
  const API = "https://ffbb-api.desimone.fr/api/v1/poule/";
  const EVERY = 6 * 3600 * 1000;
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pick = (o, keys) => { for (const k of keys) { if (o && o[k] != null && typeof o[k] !== "object") return o[k]; } return null; };
  // Accepte un numéro seul, ou un lien contenant « /poules/NNN ». Un autre lien (ex. numéro de comité) est refusé.
  const pouleId = t => { const s = String(t || "").trim(); if (/^\d+$/.test(s)) return s; const m = s.match(/[?&]poule=(\d+)/i) || s.match(/poules?\/(\d+)/i); return m ? m[1] : ""; };

  // Cherche, dans une réponse JSON de forme inconnue, le tableau qui ressemble à un classement.
  function findTable(node, depth) {
    if (depth > 6 || node == null) return null;
    if (Array.isArray(node)) {
      const objs = node.filter(x => x && typeof x === "object" && !Array.isArray(x));
      if (objs.length >= 2 && objs.length === node.length) {
        const keys = Object.keys(objs[0]).map(norm).join(" ");
        if (/(rang|position|classement|rank)/.test(keys) && /(point|pts)/.test(keys)) return objs;
      }
      for (const x of node) { const r = findTable(x, depth + 1); if (r) return r; }
      return null;
    }
    if (typeof node === "object") { for (const k of Object.keys(node)) { const r = findTable(node[k], depth + 1); if (r) return r; } }
    return null;
  }
  const nameOf = o => { let n = pick(o, ["nom", "nom_equipe", "nomEquipe", "equipe_nom", "libelle", "name", "team", "equipe", "label"]);
    if (n == null) for (const k of Object.keys(o)) if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) { n = pick(o[k], ["nom", "libelle", "name", "nomEquipe"]); if (n) break; }
    return n == null ? "?" : String(n); };
  function parse(json) {
    const t = findTable(json, 0); if (!t) return null;
    const rows = t.map((o, i) => ({
      rank: +(pick(o, ["rang", "position", "classement", "rank", "place"]) ?? i + 1),
      name: nameOf(o),
      pts: pick(o, ["points", "pts", "total_points", "nb_points"]),
      played: pick(o, ["matchs_joues", "matchsJoues", "joues", "played", "nb_matchs", "mj", "nbMatchs"]),
      won: pick(o, ["gagnes", "victoires", "won", "wins", "matchs_gagnes", "matchsGagnes", "nb_gagnes"]),
      lost: pick(o, ["perdus", "defaites", "lost", "losses", "matchs_perdus", "matchsPerdus", "nb_perdus"]),
      pf: pick(o, ["points_marques", "pointsMarques", "pour", "pf", "marques", "paniers_marques"]),
      pa: pick(o, ["points_encaisses", "pointsEncaisses", "contre", "pa", "encaisses", "paniers_encaisses"]),
    })).map(r => { if (r.played == null && r.won != null && r.lost != null) r.played = +r.won + +r.lost; return r; }).sort((a, b) => a.rank - b.rank);
    return rows.length ? rows : null;
  }

  // ---- Calendrier / résultats de la poule (lecture tolérante : on ne connaît pas la forme exacte de la réponse) ----
  const nameFrom = v => { if (v == null) return null; if (typeof v === "string") return v; if (typeof v === "object") return pick(v, ["nom", "libelle", "name", "nomEquipe", "nom_equipe", "label"]); return null; };
  const numOr = v => { if (v == null || v === "") return null; const n = +v; return isNaN(n) ? null : n; };
  const PAIRS = [["nomEquipe1", "nomEquipe2"], ["nom_equipe1", "nom_equipe2"], ["equipe1", "equipe2"], ["equipe_domicile", "equipe_visiteur"], ["equipeDomicile", "equipeVisiteur"], ["domicile", "visiteur"], ["home", "away"], ["nom_equipe_dom", "nom_equipe_ext"], ["nomEquipeDomicile", "nomEquipeVisiteur"], ["idEngagementEquipe1", "idEngagementEquipe2"]];
  const SC = [["resultatEquipe1", "resultatEquipe2"], ["resultat_equipe1", "resultat_equipe2"], ["score1", "score2"], ["score_domicile", "score_exterieur"], ["score_dom", "score_ext"], ["scoreDomicile", "scoreVisiteur"], ["home_score", "away_score"], ["homeScore", "awayScore"], ["scoreEquipe1", "scoreEquipe2"]];
  function matchOf(o) {
    let hn = null, an = null;
    for (const [a, b] of PAIRS) { const x = nameFrom(o[a]), y = nameFrom(o[b]); if (x && y && isNaN(+x)) { hn = x; an = y; break; } }
    if (!hn) { const nm = Object.keys(o).filter(k => o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) && nameFrom(o[k])); if (nm.length >= 2) { hn = nameFrom(o[nm[0]]); an = nameFrom(o[nm[1]]); } }
    if (!hn || !an) { const sk = Object.keys(o).filter(k => /equipe|team|club|nom/i.test(k) && typeof o[k] === "string" && o[k] && isNaN(+o[k]) && !/id|logo|url|date/i.test(k)); if (sk.length >= 2) { hn = o[sk[0]]; an = o[sk[1]]; } }
    if (!hn || !an) return null;
    let hs = null, as = null;
    for (const [a, b] of SC) { if (o[a] != null || o[b] != null) { hs = numOr(o[a]); as = numOr(o[b]); break; } }
    if (hs == null && as == null) { const sk = Object.keys(o).filter(k => /score|resultat/i.test(k) && numOr(o[k]) != null); if (sk.length >= 2) { hs = numOr(o[sk[0]]); as = numOr(o[sk[1]]); } }
    const d = pick(o, ["date_rencontre", "dateRencontre", "date", "jour", "date_heure", "dateHeure"]), hr = pick(o, ["heure", "horaire", "heure_rencontre"]);
    let iso = null; if (d) { const t = new Date(String(d).includes(":") || !hr ? d : d + "T" + String(hr).replace("h", ":")); if (!isNaN(t)) iso = t.toISOString(); }
    return { date: iso, timed: !!hr || /[T ]\d{1,2}:\d{2}/.test(String(d || "")), raw: d ? String(d) : null, home: String(hn), away: String(an), hs, as, live: !!(o.live || o.en_cours || o.enCours), played: hs != null && as != null && !(hs === 0 && as === 0) };
  }
  function findMatches(node, depth) {
    if (depth > 6 || node == null) return null;
    if (Array.isArray(node)) {
      const objs = node.filter(x => x && typeof x === "object" && !Array.isArray(x));
      if (objs.length && objs.length === node.length) { const m = objs.map(matchOf).filter(Boolean); if (m.length >= Math.ceil(objs.length / 2)) return m; }
      for (const x of node) { const r = findMatches(x, depth + 1); if (r) return r; }
      return null;
    }
    if (typeof node === "object") { for (const k of Object.keys(node)) { const r = findMatches(node[k], depth + 1); if (r) return r; } }
    return null;
  }
  const parseMatches = json => { const m = findMatches(json, 0); return m && m.length ? m.sort((a, b) => String(a.date).localeCompare(String(b.date))) : null; };
  const firstWord = s => norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 3 && !/^(basket|club|union|amicale|association|bbc|asso)$/.test(w))[0] || "";
  // Résultats FFBB qui correspondent à un de mes matchs sans score : proposés, jamais appliqués tout seuls.
  function pending(matches, events, me) {
    const key = norm(me); if (!key || !matches) return [];
    const out = [];
    for (const e of events) {
      if (e.kind !== "match" || e.deleted_at || e.score_us != null || e.status === "annule") continue;
      const ow = firstWord(e.opponent); if (!ow) continue;
      const m = matches.find(x => x.played && ((norm(x.home).includes(key) && norm(x.away).includes(ow)) || (norm(x.away).includes(key) && norm(x.home).includes(ow))) && (!x.date || !e.starts_at || Math.abs(new Date(x.date) - new Date(e.starts_at)) < 2 * 864e5));
      if (m) { const mineHome = norm(m.home).includes(key); out.push({ e, m, us: mineHome ? m.hs : m.as, them: mineHome ? m.as : m.hs }); }
    }
    return out;
  }
  // Calendrier de l'appli aligné sur la FFBB : si un match est placé à une autre date (ou heure) que sur la FFBB, on le déplace.
  const pday = iso => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
  const phm = iso => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(":", ":");
  function dateFixes(matches, events, me) {
    const key = norm(me); if (!key || !matches || !matches.length) return [];
    const used = new Set(), out = [];
    for (const e of events.filter(x => x.kind === "match" && !x.deleted_at && x.status !== "annule" && x.starts_at && x.score_us == null).sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
      const ow = firstWord(e.opponent); if (!ow) continue;
      const cands = matches.map((m, i) => ({ m, i })).filter(({ m, i }) => m.date && !used.has(i) && ((norm(m.home).includes(key) && norm(m.away).includes(ow)) || (norm(m.away).includes(key) && norm(m.home).includes(ow))))
        .map(c => ({ ...c, d: Math.abs(new Date(c.m.date) - new Date(e.starts_at)) })).filter(c => c.d < 35 * 864e5).sort((a, b) => a.d - b.d);
      if (!cands.length) continue;
      const { m, i } = cands[0]; used.add(i);
      const hasTime = !!m.timed;
      const newDay = pday(m.date), oldDay = pday(e.starts_at);
      const newHM = hasTime ? phm(m.date) : phm(e.starts_at), oldHM = phm(e.starts_at);
      if (newDay === oldDay && newHM === oldHM) continue;
      const iso = new Date(newDay + "T" + newHM.replace("h", ":") + ":00").toISOString();
      out.push({ e, from: e.starts_at, to: iso, day: newDay !== oldDay });
    }
    return out;
  }
  async function syncCalendar(ts, matches, me, manual) {
    const evs = (await DB.live("events")).filter(e => e.team_season_id === ts.id), fixes = dateFixes(matches, evs, me);
    if (!fixes.length) return 0;
    const log = ((await DB.getMeta("calchg_" + ts.id)) || []).slice(0, 20), at = new Date().toISOString();
    for (const f of fixes) {
      const c = await DB.get("events", f.e.id); c.starts_at = f.to; await DB.save("events", c);
      log.unshift({ opp: f.e.opponent, from: f.from, to: f.to, at });
    }
    await DB.setMeta("calchg_" + ts.id, log.slice(0, 20));
    const lbl = iso => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    U().toast("Calendrier mis à jour d'après la FFBB : " + fixes.map(f => (f.e.opponent || "match") + " → " + lbl(f.to)).join(" · "), null, 9000);
    return fixes.length;
  }
  const fmtD = iso => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
  const ord = n => n === 1 ? "1er" : n + "e";
  function summary(rows, me) {
    const key = norm(me); const r = key ? rows.find(x => norm(x.name).includes(key)) : null;
    if (!r) return null;
    const rec = r.won != null && r.lost != null ? " · " + r.won + " V – " + r.lost + " D" : "";
    return ord(r.rank) + " sur " + rows.length + rec;
  }
  const meOf = (ts, team) => ts.standings_team || (team && (team.club || "")) || "";

  async function refresh(ts, team, manual) {
    const id = pouleId(ts.standings_poule);
    if (!id) { if (manual) U().toast("Renseigne d'abord le numéro de la poule."); return false; }
    const old = await stored(ts);
    const get = async () => { const r = await fetch(API + id, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
    const empty = j => !j || j.degraded || (!parse(j) && !(parseMatches(j) || []).length);
    let json;
    try {
      json = await get();
      if (empty(json)) { await new Promise(r => setTimeout(r, 2500)); try { const j2 = await get(); if (!empty(j2)) json = j2; } catch (e) {} }   // la FFBB répond parfois vide : on réessaie une fois
    } catch (e) {
      await DB.setMeta("standings_" + ts.id, { ...old, lastTry: new Date().toISOString(), lastErr: String(e.message || e) });
      if (manual) U().toast("Classement automatique impossible (" + (e.message || e) + "). Les dernières données sont conservées." + (old.at ? "" : " Tu peux le saisir à la main.")); return false;
    }
    try { window.__standingsRaw = json; } catch (e) {}
    const rows = parse(json), matches = parseMatches(json) || [];
    const sample = (() => { try { const o = {}; for (const k of Object.keys(json || {}).slice(0, 12)) { const v = json[k]; o[k] = Array.isArray(v) ? "[" + v.length + " éléments] " + JSON.stringify(v[0] || null).slice(0, 700) : (typeof v === "object" && v ? "{" + Object.keys(v).slice(0, 8).join(",") + "}" : v); } return JSON.stringify(o, null, 1).slice(0, 2400); } catch (e) { return ""; } })();
    if (!rows && !matches.length) {
      // Réponse vide : on GARDE les dernières données valides (rien n'est effacé).
      await DB.setMeta("standings_" + ts.id, { ...old, lastTry: new Date().toISOString(), lastErr: "vide", sample });
      if (manual) U().toast(old.at ? "La FFBB renvoie une réponse vide pour l'instant. Je garde les données du " + new Date(old.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "." : "La poule n° " + id + " renvoie un classement vide. Vérifie le numéro (lien avec ?poule=…).");
      return false;
    }
    const s = rows ? summary(rows, meOf(ts, team)) : (old.rank || null);
    await DB.setMeta("standings_" + ts.id, { rows: rows || old.rows || [], rank: s, at: new Date().toISOString(), matches: matches.length ? matches : (old.matches || []), sample, lastTry: new Date().toISOString(), lastErr: null });
    try { await syncCalendar(ts, matches.length ? matches : (old.matches || []), meOf(ts, team), manual); } catch (e) {}
    if (manual) U().toast(s ? "Classement mis à jour : " + s : "Classement mis à jour. Indique le nom de ton équipe pour voir ta position.");
    return true;
  }

  async function stored(ts) { let m = null; try { m = await DB.getMeta("standings_" + ts.id); } catch (e) {} return m || { rows: [], rank: null, at: null }; }
  async function card(ts, team, rerender) {
    const st = await stored(ts);
    const poule = h("input", { type: "text", inputmode: "numeric", placeholder: "Numéro ou lien de la poule", value: ts.standings_poule || "" });
    const me = h("input", { type: "text", placeholder: "Ex. EYBENS", value: ts.standings_team || (team && team.club) || "" });
    const rank = h("input", { type: "text", placeholder: "Ex. 4e · 6 V – 2 D", value: ts.standings_rank || "" });
    const url = h("input", { type: "url", placeholder: "https://… (page classement FFBB)", value: ts.standings_url || "" });
    const save = async toast => {
      const cur = await DB.get("team_seasons", ts.id), u = url.value.trim(); let ok = true;
      if (u) { try { const x = new URL(u); ok = /^https?:$/.test(x.protocol); } catch (e) { ok = false; } }
      if (!ok) { U().toast("Ce lien ne semble pas valide (il doit commencer par https://)."); return null; }
      if (poule.value.trim() && !pouleId(poule.value)) { U().toast("Je ne trouve pas de numéro de poule dans ce lien. Il doit contenir « ?poule= » ou « /poules/ » suivi du numéro."); return null; }
      cur.standings_poule = pouleId(poule.value) || null; cur.standings_team = me.value.trim() || null; cur.standings_url = u || null;
      if (rank.value.trim() !== (ts.standings_rank || "")) { cur.standings_rank = rank.value.trim() || null; cur.standings_at = new Date().toISOString(); }
      await DB.save("team_seasons", cur); if (toast) U().toast("Enregistré."); return cur;
    };
    const rows = Array.isArray(st.rows) ? st.rows : [];
    const chg = (await DB.getMeta("calchg_" + ts.id)) || [], evs = await DB.live("events"), todo = pending(st.matches, evs.filter(e => e.team_season_id === ts.id), meOf(ts, team)), cal = st.matches || [];
    const mk = norm(meOf(ts, team));
    const meKey = norm(meOf(ts, team));
    const shownRank = st.rank || ts.standings_rank, when = (st.at || ts.standings_at) ? new Date(st.at || ts.standings_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
    return h("section", { class: "card" }, h("h3", { class: "tight" }, "Classement de la poule"),
      h("p", { class: "sub" }, shownRank ? shownRank + (when ? " · mis à jour le " + when : "") : "Renseigne le numéro de ta poule pour le récupérer automatiquement, ou saisis ta position à la main."),
      st.lastErr && st.at ? h("p", { class: "sub warnline" }, "La FFBB ne répond pas correctement pour l'instant (" + st.lastErr + "). Je garde les dernières données reçues, du " + when + ". Nouvel essai automatique plus tard.") : null,
      rows.length ? h("div", { class: "tbl" }, h("table", { class: "stats" },
        h("thead", {}, h("tr", {}, ["#", "Équipe", "J", "V", "D", "Pts", "Diff."].map((x, i) => h("th", { class: i > 1 ? "r" : "" }, x)))),
        h("tbody", {}, rows.map(r => h("tr", { class: meKey && norm(r.name).includes(meKey) ? "me" : "" }, h("td", {}, r.rank), h("td", {}, r.name), h("td", { class: "r" }, r.played ?? "—"), h("td", { class: "r" }, r.won ?? "—"), h("td", { class: "r" }, r.lost ?? "—"), h("td", { class: "r strong" }, r.pts ?? "—"),
          h("td", { class: "r" }, r.pf != null && r.pa != null ? (r.pf - r.pa > 0 ? "+" : "") + (r.pf - r.pa) : "—")))))) : null,
      chg.length ? h("p", { class: "sub" }, "Calendrier recalé sur la FFBB : " + chg.slice(0, 3).map(c => (c.opp || "match") + " (" + new Date(c.from).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }) + " → " + new Date(c.to).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }) + ")").join(", ") + ".") : null,
      todo.length ? h("div", { class: "subcard" }, h("strong", {}, "Résultats trouvés sur la FFBB (" + todo.length + ")"), h("p", { class: "sub" }, "Ils ne sont reportés que si tu valides, et seulement sur des matchs sans score."),
        todo.map(t => h("div", { class: "item" }, h("div", { style: "flex:1;min-width:0" }, h("strong", {}, t.e.opponent + " : " + t.us + " – " + t.them), h("div", { class: "sub" }, fmtD(t.e.starts_at))),
          h("button", { class: "small", onclick: async () => { const c = await DB.get("events", t.e.id); if (c.score_us != null) { U().toast("Ce match a déjà un score."); return; } c.score_us = t.us; c.score_them = t.them; c.status = "joue"; await DB.save("events", c); U().toast("Score reporté."); rerender(); } }, "Reporter")))) : null,
      cal.length ? h("details", { class: "mini" }, h("summary", {}, "Calendrier et résultats de mon équipe (" + cal.filter(m => mk && (norm(m.home).includes(mk) || norm(m.away).includes(mk))).length + ") · poule entière (" + cal.length + ")"),
        h("div", { class: "tbl" }, h("table", { class: "stats" }, h("tbody", {}, [...cal].sort((a, b) => { const A = mk && (norm(a.home).includes(mk) || norm(a.away).includes(mk)) ? 0 : 1, B = mk && (norm(b.home).includes(mk) || norm(b.away).includes(mk)) ? 0 : 1; return A - B; }).map(m => h("tr", { class: mk && (norm(m.home).includes(mk) || norm(m.away).includes(mk)) ? "me" : "" }, h("td", {}, fmtD(m.date) || m.raw || ""), h("td", {}, m.home), h("td", { class: "r strong" }, m.played ? m.hs + " – " + m.as : "à venir"), h("td", {}, m.away))))))) : null,
      h("details", { class: "mini" }, h("summary", {}, "Diagnostic (si le calendrier n'apparaît pas)"),
        h("p", { class: "sub" }, "Matchs lus : " + cal.length + " · lignes de classement lues : " + rows.length + ". Fais une capture de ce bloc et envoie-la-moi."),
        h("pre", { class: "diag" }, st.sample || "Touche d'abord « Mettre à jour maintenant ».")),
      U().field("Numéro de la poule (ou colle le lien de la poule)", poule), U().field("Nom de ton équipe dans le classement", me),
      h("details", { class: "mini" }, h("summary", {}, "Saisie manuelle et lien"), U().field("Position et bilan", rank), U().field("Lien de la page classement", url)),
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: async () => { const cur = await save(false); if (!cur) return; const ok = await refresh(cur, team, true); rerender(); } }, Icon("refresh", 18), "Mettre à jour maintenant"),
        h("button", { class: "small ghost", onclick: async () => { if (await save(true)) rerender(); } }, "Enregistrer"),
        h("button", { class: "small ghost", onclick: async () => { const r = await window.Live.test(); U().toast(r); } }, "Tester les scores en direct"),
        ts.standings_url ? h("a", { class: "btnlink", href: ts.standings_url, target: "_blank", rel: "noopener noreferrer" }, "Ouvrir sur la FFBB") : null,
        h("button", { class: "small ghost", onclick: async () => { const t = JSON.stringify({ poule: window.__standingsRaw || "aucune réponse", lives: window.__livesRaw || "pas testé" }).slice(0, 2500); try { await navigator.clipboard.writeText(t); U().toast("Diagnostic copié : colle-le dans le chat."); } catch (e) { U().toast(t.slice(0, 200)); } } }, "Copier le diagnostic")));
  }

  // Mise à jour automatique : à l'ouverture et au retour sur l'appli, au plus toutes les 6 h par équipe.
  let running = false;
  async function auto() {
    if (running || !navigator.onLine || !window.DB) return; running = true;
    try {
      const [ts, teams] = await Promise.all([DB.live("team_seasons"), DB.live("teams")]);
      for (const x of ts) {
        if (!pouleId(x.standings_poule)) continue;
        const last = x.standings_checked || 0; let lastLocal = 0; try { lastLocal = +localStorage.getItem("ismo_std_" + x.id) || 0; } catch (e) {}
        if (Date.now() - Math.max(last, lastLocal) < EVERY) continue;
        try { localStorage.setItem("ismo_std_" + x.id, String(Date.now())); } catch (e) {}
        await refresh(x, teams.find(t => t.id === x.team_id), false);
      }
    } catch (e) {} finally { running = false; }
  }
  setTimeout(auto, 6000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(auto, 2500); });
  window.Standings = { card, refresh, parse, parseMatches, matchOf, findMatches, pending, pouleId, auto, stored, norm, meOf };
})();
