// Lieux (salles) et trajets : une fiche par salle, réutilisée par les rencontres et les séances.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);
  const state = { q: "" };

  const mapsUrl = v => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent([v.address || v.name, v.address ? "" : v.city].filter(Boolean).join(", ") || v.name);
  const openMaps = v => window.open(mapsUrl(v), "_blank", "noopener");
  window.VenueUtil = { mapsUrl, openMaps };
  const place = v => [v.address, v.city].filter(Boolean).join(", ");

  async function listView() {
    const [venues, events] = await Promise.all([DB.live("venues"), DB.live("events")]);
    const now = new Date().toISOString();
    const q = state.q.trim().toLowerCase();
    const list = venues.filter(v => !q || [v.name, v.city, v.address].some(t => (t || "").toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    const search = h("input", { type: "search", placeholder: "Chercher une salle ou une ville…", value: state.q });
    search.addEventListener("change", () => { state.q = search.value; U().setView({ name: "venues" }); });
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "cal" }) }, Icon("chevL", 18), "Calendrier"),
      h("div", { class: "row" }, h("h2", {}, "Lieux"), h("button", { onclick: () => U().setView({ name: "venueForm" }) }, Icon("plus", 18), "Nouveau lieu")),
      h("p", { class: "sub" }, "Tes salles, avec l'adresse et le temps de trajet. Choisis-en une dans une rencontre : le trajet se remplit tout seul."),
      venues.length > 4 ? search : null,
      list.length ? list.map(v => {
        const n = events.filter(e => e.venue_id === v.id && e.starts_at >= now && e.status !== "annule").length;
        return h("button", { class: "item btnitem", onclick: () => U().setView({ name: "venue", id: v.id }) },
          h("div", { style: "flex:1;min-width:0" }, h("strong", {}, v.name), h("div", { class: "sub" }, place(v) || "Adresse à compléter")),
          h("div", { class: "chips" }, v.is_home ? h("span", { class: "pill ok" }, "Domicile") : v.travel_minutes != null ? h("span", { class: "pill" }, v.travel_minutes + " min") : null,
            n ? h("span", { class: "pill warn" }, n + " à venir") : null));
      }) : U().empty("pin", venues.length ? "Aucun résultat" : "Aucun lieu enregistré",
        "Ajoute tes salles une fois : adresse, trajet depuis Grenoble, accès. Elles seront proposées quand tu crées une rencontre ou une séance.",
        venues.length ? null : h("button", { onclick: () => U().setView({ name: "venueForm" }) }, Icon("plus", 18), "Ajouter un lieu")),
    ];
  }

  async function venueView(v) {
    const x = await DB.get("venues", v.id);
    if (!x || x.deleted_at) { U().setView({ name: "venues" }); return []; }
    const [events, sessions, teams] = await Promise.all([DB.live("events"), DB.live("sessions"), U().loadTeams()]);
    const info = Object.fromEntries(teams.map(t => [t.ts.id, t.team.name]));
    const mine = events.filter(e => e.venue_id === x.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const trains = sessions.filter(s => s.venue_id === x.id && s.starts_at >= new Date().toISOString()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const now = new Date().toISOString();
    const row = e => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "event", id: e.id }) },
      h("div", { style: "flex:1" }, h("strong", {}, (info[e.team_season_id] || "Rencontre") + (e.opponent ? " – " + e.opponent : "")),
        h("div", { class: "sub" }, K().cap(K().shortFmt.format(new Date(e.starts_at))) + " · " + K().hm(e.starts_at))));
    const facts = [["Adresse", place(x)], ["Trajet depuis Grenoble", x.is_home ? "Salle à domicile" : x.travel_minutes != null ? x.travel_minutes + " min (aller simple)" : null]].filter(r => r[1]);
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "venues" }) }, Icon("chevL", 18), "Lieux"),
      h("h2", {}, x.name),
      facts.length ? h("div", { class: "card facts" }, facts.map(r => h("div", { class: "fact" }, h("span", { class: "sub" }, r[0]), h("strong", {}, r[1])))) : null,
      x.notes ? h("section", { class: "card" }, h("h3", { class: "tight" }, "Accès et infos pratiques"), h("p", { style: "margin:8px 0 0;white-space:pre-wrap" }, x.notes)) : null,
      h("div", { class: "btns wrap" },
        h("button", { class: "small", onclick: () => openMaps(x) }, Icon("pin", 18), "Itinéraire"),
        h("button", { class: "small ghost", onclick: () => U().setView({ name: "venueForm", id: x.id }) }, Icon("edit", 18), "Modifier"),
        h("button", { class: "small ghost danger", onclick: async () => {
          if (!confirm("Supprimer ce lieu ? Les rencontres gardent le nom de la salle.")) return; await DB.remove("venues", x); U().setView({ name: "venues" });
        } }, Icon("trash", 18), "Supprimer")),
      h("h3", {}, "Rencontres à venir ici"),
      mine.filter(e => e.starts_at >= now).length ? mine.filter(e => e.starts_at >= now).map(row) : h("p", { class: "sub" }, "Aucune rencontre à venir dans cette salle."),
      trains.length ? [h("h3", {}, "Séances à venir ici"), trains.map(s => h("button", { class: "item btnitem", onclick: () => U().setView({ name: "session", id: s.id }) },
        h("div", { style: "flex:1" }, h("strong", {}, s.title || "Séance"), h("div", { class: "sub" }, (info[s.team_season_id] || "") + " — " + K().cap(K().shortFmt.format(new Date(s.starts_at))) + " · " + K().hm(s.starts_at)))))] : null,
      mine.filter(e => e.starts_at < now).length ? [h("h3", {}, "Déjà jouées ici"), mine.filter(e => e.starts_at < now).reverse().slice(0, 8).map(row)] : null,
    ];
  }

  async function venueForm(v) {
    const old = v.id ? await DB.get("venues", v.id) : null, f = old || {};
    const name = h("input", { required: true, value: f.name || "", placeholder: "ex. Gymnase des Ovalistes" });
    const addr = h("input", { value: f.address || "", placeholder: "N° et rue" });
    const city = h("input", { value: f.city || "", placeholder: "Ville" });
    const mins = h("input", { type: "number", min: 0, step: 5, value: f.travel_minutes != null ? f.travel_minutes : "", placeholder: "minutes, aller simple" });
    const home = h("input", { type: "checkbox", checked: !!f.is_home });
    const notes = h("textarea", { rows: 4, placeholder: "Parking, accès, contact du club, clé…" }, f.notes || "");
    const check = async () => { const url = mapsUrl({ name: name.value, address: addr.value, city: city.value }); window.open(url, "_blank", "noopener"); };
    return h("form", { class: "card", onsubmit: async e => {
      e.preventDefault();
      const data = { name: name.value.trim(), address: addr.value.trim() || null, city: city.value.trim() || null,
        travel_minutes: mins.value === "" ? null : +mins.value, is_home: home.checked, notes: notes.value.trim() || null };
      const saved = await DB.save("venues", old ? { ...old, ...data } : data);
      if (old && (old.travel_minutes ?? null) !== data.travel_minutes) {
        const now = new Date().toISOString();
        const evs = (await DB.live("events")).filter(ev => ev.venue_id === saved.id && ev.home_away === "exterieur" && ev.starts_at >= now && (ev.travel_minutes ?? null) !== data.travel_minutes);
        if (evs.length && confirm("Mettre à jour le trajet de " + evs.length + " rencontre(s) à venir dans cette salle ? Les conflits seront recalculés.")) {
          for (const ev of evs) await DB.save("events", { ...ev, travel_minutes: data.travel_minutes });
        }
      }
      U().setView({ name: "venue", id: saved.id });
    } },
      h("h2", {}, old ? "Modifier le lieu" : "Nouveau lieu"), U().field("Nom de la salle", name), U().field("Adresse", addr), U().field("Ville", city),
      U().field("Trajet depuis Grenoble (minutes)", mins),
      h("p", { class: "sub", style: "margin-top:-6px" }, "Vérifie le temps dans Google Maps (à l'heure habituelle du match), puis note-le ici une fois pour toutes."),
      h("button", { type: "button", class: "small ghost", onclick: check }, Icon("pin", 16), "Voir dans Google Maps"),
      h("label", { class: "check" }, home, "Salle à domicile (pas de trajet)"),
      U().field("Accès et infos pratiques", notes),
      h("button", { type: "submit" }, "Enregistrer"),
      h("button", { type: "button", class: "ghost", onclick: () => U().setView(old ? { name: "venue", id: old.id } : { name: "venues" }) }, "Annuler"));
  }

  Object.assign(window.Views, { venues: listView, venue: venueView, venueForm });
})();
