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
    let json;
    try {
      const r = await fetch(API + id, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      json = await r.json();
    } catch (e) { if (manual) U().toast("Classement automatique impossible (" + (e.message || e) + "). Tu peux le saisir à la main."); return false; }
    const rows = parse(json);
    if (!rows && json && (json.degraded || (Array.isArray(json.classements) && !json.classements.length))) { if (manual) U().toast("La poule n° " + id + " existe mais renvoie un classement vide. Vérifie que c'est bien le numéro de la poule (le lien contient /poules/…), pas celui du comité ou de l'équipe."); return false; }
    if (!rows) { try { window.__standingsRaw = json; } catch (e) {} if (manual) U().toast("Réponse reçue mais format non reconnu. Touche « Copier le diagnostic »."); return false; }
    // Gardé uniquement sur cet appareil (pas synchronisé) : évite les « modifications en double » entre tablette et PC.
    const s = summary(rows, meOf(ts, team));
    await DB.setMeta("standings_" + ts.id, { rows, rank: s, at: new Date().toISOString() });
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
    const meKey = norm(meOf(ts, team));
    const shownRank = st.rank || ts.standings_rank, when = (st.at || ts.standings_at) ? new Date(st.at || ts.standings_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
    return h("section", { class: "card" }, h("h3", { class: "tight" }, "Classement de la poule"),
      h("p", { class: "sub" }, shownRank ? shownRank + (when ? " · mis à jour le " + when : "") : "Renseigne le numéro de ta poule pour le récupérer automatiquement, ou saisis ta position à la main."),
      rows.length ? h("div", { class: "tbl" }, h("table", { class: "stats" },
        h("thead", {}, h("tr", {}, ["#", "Équipe", "J", "V", "D", "Pts", "Diff."].map((x, i) => h("th", { class: i > 1 ? "r" : "" }, x)))),
        h("tbody", {}, rows.map(r => h("tr", { class: meKey && norm(r.name).includes(meKey) ? "me" : "" }, h("td", {}, r.rank), h("td", {}, r.name), h("td", { class: "r" }, r.played ?? "—"), h("td", { class: "r" }, r.won ?? "—"), h("td", { class: "r" }, r.lost ?? "—"), h("td", { class: "r strong" }, r.pts ?? "—"),
          h("td", { class: "r" }, r.pf != null && r.pa != null ? (r.pf - r.pa > 0 ? "+" : "") + (r.pf - r.pa) : "—")))))) : null,
      U().field("Numéro de la poule (ou colle le lien de la poule)", poule), U().field("Nom de ton équipe dans le classement", me),
      h("details", { class: "mini" }, h("summary", {}, "Saisie manuelle et lien"), U().field("Position et bilan", rank), U().field("Lien de la page classement", url)),
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: async () => { const cur = await save(false); if (!cur) return; const ok = await refresh(cur, team, true); rerender(); } }, Icon("refresh", 18), "Mettre à jour maintenant"),
        h("button", { class: "small ghost", onclick: async () => { if (await save(true)) rerender(); } }, "Enregistrer"),
        ts.standings_url ? h("a", { class: "btnlink", href: ts.standings_url, target: "_blank", rel: "noopener noreferrer" }, "Ouvrir sur la FFBB") : null,
        h("button", { class: "small ghost", onclick: async () => { const t = JSON.stringify(window.__standingsRaw || "aucune réponse reçue").slice(0, 1500); try { await navigator.clipboard.writeText(t); U().toast("Diagnostic copié : colle-le dans le chat."); } catch (e) { U().toast(t.slice(0, 200)); } } }, "Copier le diagnostic")));
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
  window.Standings = { card, refresh, parse, pouleId, auto, stored };
})();
