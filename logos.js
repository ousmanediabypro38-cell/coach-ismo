// Logos : celui de l'équipe (Eybens par défaut, SMHEP pour l'U18F-2) et celui des clubs adverses.
(function () {
  const DB = window.DB, U = () => window.UI;
  const h = (...a) => U().h(...a);
  const PRESETS = { eybens: { src: "logo-eybens.png", name: "Eybens" }, smhep: { src: "logo-smhep.png", name: "SMHEP (entente Saint-Martin-d'Hères / Eybens)" } };
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  async function sha(key) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key));
    const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32);
  }
  // Logo de l'équipe : choix manuel, sinon automatique (l'équipe de l'entente = U18F-2 → SMHEP, toutes les autres → Eybens)
  const isEntente = t => /u\s*18\s*f?\s*[-_ ]?\s*2\b/i.test((t && t.name) || "");
  function teamLogoKey(team) { const v = team && team.logo; if (v && v !== "auto") return v; return isEntente(team) ? "smhep" : "eybens"; }
  function teamLogoSrc(team) { const k = teamLogoKey(team); return PRESETS[k] ? PRESETS[k].src : k; }
  async function dataUrl(src) {              // pour l'export en image : tout doit être embarqué dans le dessin
    if (!src || src.startsWith("data:")) return src;
    const r = await fetch(src); const b = await r.blob();
    return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
  }
  async function pickImage(file, max) {      // réduit l'image choisie (logo léger, fond transparent conservé)
    max = max || 300;
    const url = URL.createObjectURL(file), img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    const w = cv.toDataURL("image/webp", 0.92); return w.startsWith("data:image/webp") ? w : cv.toDataURL("image/png");
  }
  // Clubs adverses : un logo par nom de club, retrouvé à chaque match contre lui
  async function clubFor(name) {
    if (!name || !norm(name)) return null;
    const c = await DB.get("clubs", await sha("club:" + norm(name)));
    return c && !c.deleted_at ? c : null;
  }
  async function setClub(name, logo) {
    const id = await sha("club:" + norm(name)), old = await DB.get("clubs", id);
    const row = { id, name: name.trim(), logo: logo || null, deleted_at: null };
    return DB.save("clubs", old ? { ...old, ...row } : row);
  }
  const img = (src, cls, alt) => h("img", { src, class: cls || "tlogo", alt: alt || "", loading: "lazy" });

  // ---------- écran : logo d'une équipe ----------
  async function teamLogoView(v) {
    const ts = await DB.get("team_seasons", v.id), team = ts ? await DB.get("teams", ts.team_id) : null;
    if (!team) { U().setView({ name: "home" }); return []; }
    const rerender = () => U().setView({ name: "teamLogo", id: v.id });
    const cur = team.logo || "auto", custom = cur.startsWith("data:");
    const save = async val => { const t = await DB.get("teams", team.id); t.logo = val; await DB.save("teams", t); rerender(); };
    const file = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async e => {
      const f = e.target.files[0]; if (!f) return; e.target.value = "";
      try { await save(await pickImage(f)); } catch (x) { U().toast("Cette image n'est pas lisible."); }
    } });
    const opt = (key, label, src) => h("button", { type: "button", class: "logoopt" + (cur === key ? " on" : ""), onclick: () => save(key) }, src ? img(src, "logoprev") : h("span", { class: "logoprev auto" }, "A"), h("span", {}, label));
    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "team", id: v.id }) }, Icon("chevL", 18), team.name),
      h("h2", {}, "Logo de l'équipe"),
      h("p", { class: "sub" }, "Le logo apparaît sur les convocations. Par défaut : Eybens pour toutes tes équipes, et SMHEP pour l'U18F-2 (l'équipe de l'entente)."),
      h("div", { class: "logoopts" },
        opt("auto", "Automatique (" + PRESETS[teamLogoKey({ ...team, logo: "auto" })].name + ")", PRESETS[teamLogoKey({ ...team, logo: "auto" })].src),
        opt("eybens", "Eybens", PRESETS.eybens.src), opt("smhep", "SMHEP", PRESETS.smhep.src),
        h("button", { type: "button", class: "logoopt" + (custom ? " on" : ""), onclick: () => file.click() }, custom ? img(cur, "logoprev") : h("span", { class: "logoprev auto" }, "+"), h("span", {}, "Une autre image…"))),
      file,
    ];
  }

  window.LogoUtil = { teamLogoSrc, teamLogoKey, dataUrl, pickImage, clubFor, setClub, img };
  Object.assign(window.Views, { teamLogo: teamLogoView });
})();
