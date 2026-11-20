// Scores en direct (API FFBB non officielle). N'affiche que les matchs de tes équipes ou de leurs poules. Rien n'est écrit dans tes données.
(function () {
  const h = (...a) => window.UI.h(...a), U = () => window.UI;
  const BASE = "https://ffbb-api.desimone.fr/api/v1/";
  const state = { at: 0, list: [], err: null };
  let timer = null;

  async function fetchLives() {
    let last = null;
    for (const p of ["lives", "live"]) {
      try { const r = await fetch(BASE + p, { headers: { accept: "application/json" } }); if (!r.ok) { last = new Error("HTTP " + r.status); continue; } const json = await r.json(); try { window.__livesRaw = json; } catch (e) {} return json; }
      catch (e) { last = e; }
    }
    throw last || new Error("indisponible");
  }
  async function keys() {
    const [ts, teams] = await Promise.all([DB.live("team_seasons"), DB.live("teams")]), S = window.Standings, set = new Set();
    for (const x of ts) {
      const t = teams.find(q => q.id === x.team_id), me = S.norm(S.meOf(x, t)); if (me) set.add(me);
      if (S.pouleId(x.standings_poule)) { const st = await S.stored(x); for (const r of st.rows || []) { const w = S.norm(r.name); if (w) set.add(w); } }
    }
    return { set, ts };
  }
  async function refresh() {
    const json = await fetchLives(), all = window.Standings.findMatches(json, 0) || [];
    const { set } = await keys(), N = window.Standings.norm;
    const mine = all.filter(m => { const a = N(m.home), b = N(m.away); return [...set].some(k => k && (a.includes(k) || k.includes(a) || b.includes(k) || k.includes(b))); });
    state.list = mine.filter(m => m.hs != null || m.as != null || m.live); state.at = Date.now(); state.err = null;
    return { total: all.length, mine: state.list.length };
  }
  async function test() {
    try { const r = await refresh(); changed(); return r.total ? r.total + " matchs en direct sur la FFBB, dont " + r.mine + " dans tes poules." : "Aucun match en direct trouvé pour l'instant (ou format non reconnu : touche « Copier le diagnostic »)."; }
    catch (e) { return "Scores en direct indisponibles (" + (e.message || e) + ")."; }
  }
  function changed() { const v = U().current && U().current(); if (v && v.name === "accueil" && !document.querySelector("#app input:focus, #app textarea:focus")) U().setView(v); }
  // On n'interroge l'API que le jour d'un match (de 1 h avant à 3 h après le coup d'envoi).
  async function matchWindow() { const now = Date.now(), ev = await DB.live("events"); return ev.some(e => e.kind === "match" && !e.deleted_at && e.status !== "annule" && e.starts_at && now > new Date(e.starts_at) - 3600e3 && now < +new Date(e.starts_at) + 3 * 3600e3); }
  async function tick() {
    if (document.hidden || !navigator.onLine) return;
    try { if (!(await matchWindow())) { if (state.list.length) { state.list = []; changed(); } return; } await refresh(); changed(); } catch (e) { state.err = e; }
  }
  function card() {
    if (!state.list.length || Date.now() - state.at > 5 * 60e3) return null;
    return [h("h3", {}, "En direct"), h("section", { class: "card" }, state.list.map(m => h("div", { class: "item" }, h("div", { style: "flex:1;min-width:0" }, h("strong", {}, m.home + "  " + (m.hs ?? "–") + " – " + (m.as ?? "–") + "  " + m.away)), h("span", { class: "pill ok" }, "direct"))),
      h("p", { class: "sub" }, "Source FFBB, indicatif : le score n'apparaît que si la table de marque l'envoie en direct."))];
  }
  timer = setInterval(tick, 45000); setTimeout(tick, 8000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(tick, 1500); });
  window.Live = { card, test, refresh, state };
})();
