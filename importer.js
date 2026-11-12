// Import d'un fichier JSON préparé à partir de tes pages OneNote (séances et notes personnelles).
// Les fichiers d'import restent sur ta tablette : ils ne vont jamais sur GitHub.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);

  async function sha(key) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key));
    const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32);
  }
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // Retrouve un joueur de l'effectif à partir d'un prénom écrit à la main (fautes légères acceptées)
  function matchPlayer(name, roster) {
    const n = norm(name); if (!n) return null;
    const exact = roster.filter(p => norm(p.first_name) === n);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return exact.find(p => !norm(p.last_name || "").includes("u21")) || exact[0];
    const near = roster.filter(p => dist(norm(p.first_name), n) <= 1);
    return near.length === 1 ? near[0] : null;
  }

  async function importView() {
    const teams = await U().loadTeams();
    const box = h("div", {});
    const input = h("input", { type: "file", accept: ".json,application/json" });
    input.addEventListener("change", async () => {
      box.replaceChildren();
      const f = input.files[0]; if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); } catch (e) { box.append(h("p", { class: "msg" }, "Ce fichier n'est pas lisible.")); return; }
      if (!data || data.format !== "coach-ismo-import") { box.append(h("p", { class: "msg" }, "Ce n'est pas un fichier d'import COACH ISMO.")); return; }
      await preview(data, teams, box);
    });
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "carnet" }) }, Icon("chevL", 18), "Retour"),
      h("h2", {}, "Importer depuis OneNote"),
      h("section", { class: "card" },
        h("p", { class: "sub" }, "Choisis le fichier d'import que je t'ai préparé. Tu verras ce qui sera ajouté avant de valider. Réimporter le même fichier met à jour sans créer de doublon."),
        input, box),
    ];
  }

  async function preview(data, teams, box) {
    const sessions = data.sessions || [], notes = data.notes || [];
    let tsSel = null, time = null, plans = [];
    if (sessions.length) {
      const hint = norm(data.team_hint || "");
      const guess = teams.find(x => hint && norm(x.team.name).includes(hint)) || null;
      tsSel = h("select", {}, h("option", { value: "" }, "— choisir l'équipe —"),
        teams.map(x => h("option", { value: x.ts.id, selected: guess && guess.ts.id === x.ts.id }, x.team.name + " · " + x.season.label)));
      time = h("input", { type: "time", value: data.default_time || "19:00" });
      const out = h("div", {});
      const render = async () => {
        out.replaceChildren();
        const tsId = tsSel.value;
        const [mem, pl] = await Promise.all([DB.live("memberships"), DB.live("players")]);
        const P = Object.fromEntries(pl.map(p => [p.id, p]));
        const roster = mem.filter(m => m.team_season_id === tsId && P[m.player_id]).map(m => P[m.player_id]);
        plans = sessions.map(s => {
          const att = (s.attendance || []).map(a => ({ ...a, player: matchPlayer(a.name, roster) }));
          return { s, att };
        });
        plans.forEach(({ s, att }) => out.append(h("div", { class: "item" }, h("div", { style: "flex:1" },
          h("strong", {}, s.title), h("div", { class: "sub" }, s.date + " — " + (s.blocks || []).length + " blocs, " + att.filter(a => a.player).length + "/" + att.length + " joueurs retrouvés"
            + (att.some(a => !a.player) ? " (non retrouvés : " + att.filter(a => !a.player).map(a => a.name).join(", ") + ")" : ""))))));
      };
      tsSel.addEventListener("change", render);
      box.append(h("h3", {}, "Séances à importer"), U().field("Équipe", tsSel), U().field("Heure de début (à corriger ensuite si besoin)", time), out);
      await render();
    }
    if (notes.length) box.append(h("h3", {}, "Notes personnelles"), h("p", { class: "sub" }, notes.length + " notes seront ajoutées à Oussou Time."));
    const go = h("button", { type: "button", onclick: async () => {
      if (sessions.length && !tsSel.value) { U().toast("Choisis d'abord l'équipe."); return; }
      go.disabled = true; let ns = 0, nb = 0, na = 0, nn = 0;
      for (const { s, att } of plans) {
        const sid = await sha("session:" + s.key);
        const old = await DB.get("sessions", sid);
        const data = { id: sid, team_season_id: tsSel.value, starts_at: K().toISO(s.date, s.time || time.value), duration_min: old ? old.duration_min : 90,
          title: s.title, objective: s.objective || null, intensity: s.intensity || null, status: s.status || "prevue", deleted_at: null };
        await DB.save("sessions", old ? { ...old, ...data } : data); ns++;
        const existing = (await DB.all("session_blocks")).filter(b => b.session_id === sid && !b.deleted_at);
        const keep = new Set();
        for (let i = 0; i < (s.blocks || []).length; i++) {
          const b = s.blocks[i], bid = await sha("block:" + s.key + ":" + i); keep.add(bid);
          const ob = await DB.get("session_blocks", bid);
          const row = { id: bid, session_id: sid, position: i, kind: b.kind || null, title: b.title, duration_min: ob ? ob.duration_min : null,
            setup: b.setup || null, description: b.description || null, coaching_points: b.coaching_points || null, variants: b.variants || null,
            systems: b.systems || null, material: b.material || null, deleted_at: null };
          await DB.save("session_blocks", ob ? { ...ob, ...row } : row); nb++;
        }
        for (const b of existing) if (!keep.has(b.id)) await DB.remove("session_blocks", b);
        for (const a of att) {
          if (!a.player) continue;
          const aid = await sha(sid + ":" + a.player.id), oa = await DB.get("session_attendance", aid);
          const row = { id: aid, session_id: sid, player_id: a.player.id, status: a.status || "present", group_label: a.group || null, deleted_at: null };
          await DB.save("session_attendance", oa ? { ...oa, ...row } : row); na++;
        }
      }
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i], nid = await sha("note:" + (n.key || n.title)), on = await DB.get("notes", nid);
        const row = { id: nid, section: n.section || "oussou", title: n.title, body: n.body || null, source_date: n.date || null, position: i, deleted_at: null };
        await DB.save("notes", on ? { ...on, ...row } : row); nn++;
      }
      U().toast("Import terminé : " + ns + " séance(s), " + nb + " bloc(s), " + na + " présence(s), " + nn + " note(s).");
      if (ns && window.CarnetState) { const last = plans.map(x => x.s.date).sort().pop(); window.CarnetState.scope = last < K().todayKey() ? "past" : "future"; window.CarnetState.filter = []; }
      U().setView({ name: ns ? "carnet" : "oussou" });
    } }, Icon("check", 18), "Importer");
    box.append(go);
  }

  Object.assign(window.Views, { importJson: importView });
})();
