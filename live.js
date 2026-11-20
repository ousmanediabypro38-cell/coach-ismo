// Scores en direct (API FFBB non officielle). N'affiche que les matchs de tes équipes ou de leurs poules. Rien n'est écrit dans tes données.
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI;
  const BASE = "https://ffbb-api.desimone.fr/api/v1/";
  const state = { at: 0, list: [], all: [], err: null, msg: null };
  let timer = null;

  async function fetchLives() {
    let last = null;
    for (const p of ["lives", "live"]) {
      try { const r = await fetch(BASE + p, { headers: { accept: "application/json" } }); if (!r.ok) { last = new Error("HTTP " + r.status); continue; } const json = await r.json(); try { window.__livesRaw = json; } catch (e) {} return json; }
      catch (e) { last = e; }
    }
    throw last || new Error("indisponible");
  }
  // Seuls les matchs de TES équipes (nom du club, ex. EYBENS) sont gardés : pas les matchs des autres poules ni des adversaires entre eux.
  async function keys() {
    const [ts, teams] = await Promise.all([DB.live("team_seasons"), DB.live("teams")]), S = window.Standings, set = new Set();
    for (const x of ts) { const t = teams.find(q => q.id === x.team_id), me = (S.norm(S.meOf(x, t)).trim() || S.norm((t && t.name || "").split(/[\s(]/)[0]).trim()); if (me.length >= 4) set.add(me); }
    return { set, ts };
  }
  async function refresh() {
    const json = await fetchLives(), all = window.Standings.findMatches(json, 0) || [];
    const { set } = await keys(), N = window.Standings.norm;
    const mine = all.filter(m => { const a = N(m.home), b = N(m.away); return [...set].some(k => a.includes(k) || b.includes(k)); });
    state.all = all; state.list = mine.filter(m => m.hs != null || m.as != null || m.live); state.at = Date.now(); state.err = null;
    return { total: all.length, mine: state.list.length };
  }
  async function test() {
    let msg;
    try { const r = await refresh(); msg = r.total ? r.mine ? r.mine + " match(s) de tes équipes en direct." : r.total + " matchs en direct en France, aucun de tes équipes." : "Aucun match en direct trouvé pour l'instant."; }
    catch (e) { msg = "Scores en direct indisponibles (" + (e.message || e) + ")."; }
    state.msg = msg; state.at = Date.now(); changed(); return msg;
  }
  function changed() { const v = U().current && U().current(); if (v && v.name === "accueil" && !document.querySelector("#app input:focus, #app textarea:focus")) U().setView(v); }
  // On n'interroge l'API que le jour d'un match (de 1 h avant à 3 h après le coup d'envoi).
  async function matchWindow() { const now = Date.now(), ev = await DB.live("events"); return ev.some(e => e.kind === "match" && !e.deleted_at && e.status !== "annule" && e.starts_at && now > new Date(e.starts_at) - 3600e3 && now < +new Date(e.starts_at) + 3 * 3600e3); }
  async function tick() {
    if (document.hidden || !navigator.onLine) return;
    try { if (!(await matchWindow())) { if (state.list.length) { state.list = []; changed(); } return; } await refresh(); changed(); } catch (e) { state.err = e; }
  }
  function card(anyPoule) {
    if (!state.list.length || Date.now() - state.at > 5 * 60e3) {
      if (!anyPoule) return null;
      const hh = state.at ? new Date(state.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
      return h("section", { class: "card" }, h("div", { class: "row" }, h("div", { style: "flex:1;min-width:0" }, h("strong", {}, "Scores en direct"), h("div", { class: "sub" }, state.msg ? state.msg + " (" + hh + ")" : "Se vérifie tout seul le jour d'un match.")),
        h("button", { class: "small ghost", onclick: async e => { e.currentTarget.disabled = true; const m = await test(); U().toast(m); } }, Icon("refresh", 16), "Vérifier")));
    }
    return [h("h3", {}, "En direct"), h("section", { class: "card" }, state.list.map(m => h("div", { class: "item" }, h("div", { style: "flex:1;min-width:0" }, h("strong", {}, m.home + "  " + (m.hs ?? "–") + " – " + (m.as ?? "–") + "  " + m.away)), h("span", { class: "pill ok" }, "direct"))),
      h("p", { class: "sub" }, "Source FFBB, indicatif : le score n'apparaît que si la table de marque l'envoie en direct."))];
  }
  timer = setInterval(tick, 45000); setTimeout(tick, 8000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(tick, 1500); });
  window.Live = { card, test, refresh, state };
})();
