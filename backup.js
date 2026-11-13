// Sauvegarde hebdomadaire : export complet en un fichier + restauration + rappel.
(function () {
  const h = (...a) => window.UI.h(...a), DAYS = 7, META = "last_backup";
  const pad = n => String(n).padStart(2, "0");
  const stamp = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const STRIP = ["_dirty", "_rev", "_base", "updated_at_local"];
  const ago = iso => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : "il y a " + d + " jours"; };

  async function build() {
    const stores = {}; let n = 0;
    for (const s of DB.STORES) { const rows = (await DB.all(s)).map(r => { const c = { ...r }; STRIP.forEach(k => delete c[k]); return c; }); stores[s] = rows; n += rows.length; }
    return { app: "coach-ismo", format: 1, exported_at: new Date().toISOString(), count: n, stores };
  }
  async function lastInfo() { const iso = await DB.getMeta(META); return iso || null; }
  async function hasData() { return (await DB.live("teams")).length > 0; }

  async function exportNow() {
    const data = await build(), name = "coach-ismo-sauvegarde-" + stamp(new Date()) + ".json";
    const file = new File([JSON.stringify(data)], name, { type: "application/json" });
    let done = false;
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); done = true; } } catch (e) { if (e && e.name === "AbortError") return false; }
    if (!done) { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    await DB.setMeta(META, new Date().toISOString());
    return true;
  }

  async function restore(file) {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "coach-ismo" || !data.stores) throw new Error("Ce fichier n'est pas une sauvegarde COACH ISMO.");
    let added = 0, updated = 0;
    for (const s of DB.STORES) {
      for (const r of data.stores[s] || []) {
        if (!r || !r.id) continue;
        const cur = await DB.get(s, r.id), t = x => x.updated_at_local || x.updated_at || "";
        if (cur && t(cur) >= t(r)) continue;
        const row = { ...r }; STRIP.forEach(k => delete row[k]);
        if (cur) { row._rev = cur._rev; row._base = cur._base; }
        await DB.save(s, row); cur ? updated++ : added++;
      }
    }
    return { added, updated };
  }

  const state = { msg: "" };
  async function card(rerender) {
    const last = await lastInfo();
    const pick = h("input", { type: "file", accept: ".json,application/json", class: "hidden", onchange: async ev => {
      const f = ev.target.files[0]; if (!f) return; ev.target.value = "";
      try {
        if (!confirm("Restaurer cette sauvegarde ? Elle ajoute ce qui manque et remplace ce qui est plus ancien ici. Rien n'est supprimé.")) return;
        const r = await restore(f); state.msg = "Restauration faite : " + r.added + " ajouté(s), " + r.updated + " mis à jour."; 
      } catch (e) { state.msg = "Impossible : " + (e.message || e); }
      rerender();
    } });
    return h("section", { class: "card" }, h("h3", { class: "tight" }, "Sauvegarde"),
      h("p", { class: "sub" }, last ? "Dernière sauvegarde : " + ago(last) + "." : "Aucune sauvegarde faite pour l'instant."),
      h("p", { class: "sub" }, "Un seul fichier avec tout ton travail. À l'envoi, choisis Drive, Mail ou ton téléphone : garde-le hors de la tablette."),
      h("div", { class: "btns wrap" },
        h("button", { onclick: async () => { if (await exportNow()) { state.msg = "Sauvegarde faite."; rerender(); } } }, Icon("upload", 18), "Sauvegarder maintenant"),
        h("button", { class: "small ghost", onclick: () => pick.click() }, "Restaurer un fichier")),
      state.msg ? h("p", { class: "sub" }, state.msg) : null, pick);
  }

  async function banner(rerender) {
    if (!(await hasData())) return null;
    const last = await lastInfo();
    if (last && Date.now() - new Date(last).getTime() < DAYS * 86400000) return null;
    return h("section", { class: "card" }, h("strong", {}, "Sauvegarde de la semaine"),
      h("p", { class: "sub" }, last ? "Dernière sauvegarde : " + ago(last) + "." : "Tu n'as encore jamais sauvegardé."),
      h("button", { onclick: async () => { if (await exportNow()) rerender(); } }, Icon("upload", 18), "Sauvegarder maintenant"));
  }

  window.Backup = { card, banner, build, restore, exportNow };
})();
