// Détection des conflits de calendrier : logique pure (sans écran), testable seule.
//
// Règles (différentes de l'ancien Excel, qui signalait tout ce qui tombait le même jour) :
//  1. Deux rencontres de la MÊME équipe ne sont jamais en conflit (ex. triangulaire : un seul engagement).
//  2. « Impossible »  : les deux rencontres se chevauchent (début -> fin).
//  3. « Trop juste »  : elles ne se chevauchent pas, mais il manque le temps de trajet (aller et retour
//     pour les matchs à l'extérieur) + 15 minutes de marge entre les deux.
//  4. Une rencontre annulée ou supprimée ne crée aucun conflit.
//  5. Un conflit est « résolu » quand chaque rencontre du groupe a une décision (je suis présent / je me
//     fais remplacer) et que deux rencontres « Impossible » ne sont pas toutes deux marquées « présent ».
(function () {
  const MIN = 60000, BUFFER = 15 * MIN;
  const DEFAULT_DURATION = { match: 120, entrainement: 90, reunion: 60, formation: 120, autre: 60 };

  const startMs = e => Date.parse(e.starts_at);
  const durationMin = e => e.ends_at ? Math.round((Date.parse(e.ends_at) - startMs(e)) / MIN) : (DEFAULT_DURATION[e.kind] || 60);
  const endMs = e => startMs(e) + durationMin(e) * MIN;
  const travelMin = e => e.home_away === "exterieur" ? (+e.travel_minutes || 0) : 0;
  const active = e => !e.deleted_at && e.status !== "annule" && !!e.starts_at;

  // null = pas de conflit, sinon "overlap" (impossible) ou "tight" (trop juste)
  function relation(a, b) {
    if (a.team_season_id && a.team_season_id === b.team_season_id) return null;
    const as = startMs(a), ae = endMs(a), bs = startMs(b), be = endMs(b);
    if (as < be && bs < ae) return "overlap";
    const aFrom = as - travelMin(a) * MIN, aTo = ae + travelMin(a) * MIN;
    const bFrom = bs - travelMin(b) * MIN, bTo = be + travelMin(b) * MIN;
    if (aFrom < bTo + BUFFER && bFrom < aTo + BUFFER) return "tight";
    return null;
  }

  function groupStatus(g) {
    if (g.events.some(e => !e.conflict_decision)) return "todo";
    if (g.pairs.some(p => p.rel === "overlap" && p.a.conflict_decision === "present" && p.b.conflict_decision === "present")) return "blocked";
    return "done";
  }

  // Suggestion = la rencontre de l'équipe la plus prioritaire (P1 > P6) est gardée, les autres sont à déléguer.
  function suggestion(e, others, prioOf) {
    if (!others.length) return null;
    const mine = prioOf(e), best = Math.min(...others.map(o => prioOf(o.event)));
    return mine < best ? "present" : mine > best ? "delegue" : null;
  }

  // events : toutes les rencontres ; prioOf(e) : priorité de l'équipe (1 = la plus haute, 99 = inconnue)
  function analyse(events, prioOf) {
    const evs = events.filter(active).sort((x, y) => startMs(x) - startMs(y));
    const parent = new Map(evs.map(e => [e.id, e.id]));
    const find = id => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id); } return id; };
    const links = new Map(evs.map(e => [e.id, []]));
    const pairs = [];
    for (let i = 0; i < evs.length; i++) for (let j = i + 1; j < evs.length; j++) {
      const rel = relation(evs[i], evs[j]);
      if (!rel) continue;
      pairs.push({ a: evs[i], b: evs[j], rel });
      links.get(evs[i].id).push({ event: evs[j], rel });
      links.get(evs[j].id).push({ event: evs[i], rel });
      parent.set(find(evs[i].id), find(evs[j].id));
    }
    const byRoot = new Map();
    for (const e of evs) if (links.get(e.id).length) {
      const r = find(e.id); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(e);
    }
    const groups = [], info = new Map();
    for (const list of byRoot.values()) {
      const ids = new Set(list.map(e => e.id));
      const g = { id: list[0].id, events: list, pairs: pairs.filter(p => ids.has(p.a.id)), start: startMs(list[0]) };
      g.status = groupStatus(g);
      groups.push(g);
      for (const e of list) info.set(e.id, { group: g, others: links.get(e.id), suggestion: suggestion(e, links.get(e.id), prioOf) });
    }
    groups.sort((x, y) => x.start - y.start);
    return { groups, info };
  }

  const API = { analyse, relation, groupStatus, startMs, endMs, durationMin, travelMin, DEFAULT_DURATION, BUFFER_MIN: 15 };
  if (typeof window !== "undefined") window.Conflicts = API;
  if (typeof module !== "undefined") module.exports = API;
})();
