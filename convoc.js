// Convocation de match : présences des joueurs (réponses au sondage) et visuel de convocation à envoyer.
(function () {
  const DB = window.DB, U = () => window.UI, K = () => window.CalUtil;
  const h = (...a) => U().h(...a);
  const NS = "http://www.w3.org/2000/svg";
  const ST = { present: "Présent", peut_etre: "Peut-être", absent: "Absent" };
  const GREEN = "#1b6f3c", BLUE = "#1b87d6", TAN = "#ecd2a3";
  const sv = (tag, attrs, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const pad = n => String(n).padStart(2, "0");
  async function sha(key) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key));
    const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    return x.slice(0, 8) + "-" + x.slice(8, 12) + "-4" + x.slice(13, 16) + "-8" + x.slice(17, 20) + "-" + x.slice(20, 32);
  }
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const paste = { text: "", msg: "" };           // saisie « coller la liste » gardée hors de l'écran

  // ---------- postes -> cases du terrain ----------
  // 0 haut gauche · 1 haut droite · 2 centre (raquette) · 3 bas gauche · 4 bas droite
  const POSTE_BOX = { 1: 3, 2: 4, 3: 0, 4: 1, 5: 2 };
  function posteOf(p) {
    const t = norm(p.position);
    const d = t.match(/[1-5]/); if (d) return +d[0];
    if (/meneur|point guard/.test(t)) return 1;
    if (/arriere|guard|shooteur/.test(t)) return 2;
    if (/ailier fort|ala forte|power/.test(t)) return 4;
    if (/ailier|wing/.test(t)) return 3;
    if (/pivot|interieur|center|centre/.test(t)) return 5;
    return 0;
  }
  function layout(players, boxes) {
    const out = [[], [], [], [], []];
    for (const p of players) {
      let b = boxes && boxes[p.id] != null ? boxes[p.id] : POSTE_BOX[posteOf(p)];
      if (b == null) { b = out.map((l, i) => [l.length, i]).sort((a, c) => a[0] - c[0])[0][1]; }
      out[b].push(p);
    }
    return out;
  }
  const CARPOOL = "Match à l'extérieur : anticipez le covoiturage !";
  const shortName = (p, all) => {
    const dup = all.filter(x => norm(x.first_name) === norm(p.first_name)).length > 1;
    return (p.first_name + (dup && p.last_name ? " " + p.last_name.charAt(0) + "." : "")).toUpperCase();
  };

  // ---------- visuel (1000 × 1414) ----------
  function visual(c, names, boxesNames) {
    const W = 1000, H = 1414, F = "Barlow Condensed, Barlow, system-ui, sans-serif", F2 = "Barlow, system-ui, sans-serif";
    const t = (x, y, s, size, o) => sv("text", { x, y, "text-anchor": "middle", "font-size": size, "font-weight": (o && o.w) || 700, fill: (o && o.fill) || "#111", "font-family": (o && o.f) || F }, s);
    const line = { stroke: "#fff", "stroke-width": 3, fill: "none" };
    const svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "convsvg", role: "img", "aria-label": "Convocation" });
    const add = (...n) => svg.append(...n.flat(Infinity).filter(x => x != null && x !== false));
    add(sv("rect", { width: W, height: H, fill: "#fff" }),
      t(500, 75, c.title.toUpperCase(), 46), t(500, 124, c.dateLine, 36, { fill: GREEN }),
      c.myLogo ? sv("image", { href: c.myLogo, x: 166, y: 156, width: 170, height: 170, preserveAspectRatio: "xMidYMid meet" })
        : [sv("circle", { cx: 251, cy: 241, r: 75, fill: GREEN }), t(251, 258, (c.club_short || "").toUpperCase(), 46, { fill: "#fff" })],
      t(251, 349, c.club_label1, 24), c.club_label2 ? t(251, 378, c.club_label2, 24) : null,
      t(500, 296, "VS", 70),
      c.oppLogo ? sv("image", { href: c.oppLogo, x: 664, y: 170, width: 170, height: 170, preserveAspectRatio: "xMidYMid meet" })
        : [sv("circle", { cx: 749, cy: 255, r: 78, fill: "none", stroke: "#666", "stroke-width": 4, "stroke-dasharray": "10 9" }), t(749, 267, c.oppInitials, 38, { fill: "#666" })],
      t(749, 366, c.oppName.toUpperCase(), 26),
      t(500, c.address ? 430 : 443, c.venueLine, c.address ? 38 : 40),
      c.address ? sv("text", { x: 500, y: 461, "text-anchor": "middle", "font-size": c.address.length > 62 ? 20 : 24, "font-weight": 500, fill: "#444", "font-family": F2, textLength: c.address.length * (c.address.length > 62 ? 9 : 11) > 880 ? 880 : null, lengthAdjust: "spacingAndGlyphs" }, c.address) : null,
      c.meetLine ? t(500, c.address ? 499 : 486, c.meetLine, c.address ? 30 : 32, { fill: GREEN }) : null,
      sv("rect", { x: 48, y: 517, width: 904, height: 643, fill: TAN, stroke: "#111", "stroke-width": 3 }),
      sv("rect", { x: 360, y: 518, width: 280, height: 330, fill: BLUE, stroke: "#fff", "stroke-width": 3 }),
      sv("path", { d: "M120 518 V675 A385 385 0 0 0 880 675 V518", ...line }),
      sv("path", { d: "M410 848 A90 90 0 0 1 590 848", ...line }),
      sv("path", { d: "M430 618 A70 70 0 0 0 570 618", ...line }),
      sv("line", { x1: 460, y1: 568, x2: 540, y2: 568, ...line }), sv("circle", { cx: 500, cy: 618, r: 15, ...line }),
      sv("path", { d: "M400 1160 A100 100 0 0 1 600 1160", ...line }));
    const R = [[70, 587, 267, 146], [663, 587, 268, 146], [382, 791, 236, 155], [112, 980, 266, 146], [622, 980, 267, 146]];
    R.forEach(([x, y, w, hh], i) => {
      add(sv("rect", { x, y, width: w, height: hh, fill: "#fff", stroke: "#111", "stroke-width": 7 }));
      const L = boxesNames[i], n = L.length || 1, size = n <= 2 ? 32 : n === 3 ? 30 : n === 4 ? 26 : 22, lh = n <= 3 ? 37 : n === 4 ? 31 : 26;
      const y0 = y + hh / 2 - (n - 1) * lh / 2 + size * 0.34;
      (L.length ? L : ["—"]).forEach((s, k) => add(t(x + w / 2, y0 + k * lh, s, size, { w: 600, fill: L.length ? "#111" : "#bbb" })));
    });
    add(t(500, 1207, "Responsables Goûter", 38), t(500, 1253, c.snack || "", 28, { w: 500, f: F2 }), c.tshirt ? t(500, 1314, "Prévoir Tee-Shirt " + c.tshirt.toUpperCase() + " !", 34) : null,
      c.carpool ? sv("text", { x: 500, y: c.tshirt ? 1376 : 1330, "text-anchor": "middle", "font-size": 32, "font-weight": 700, fill: GREEN, "font-family": F, textLength: c.carpool.length * 14 > 900 ? 900 : null, lengthAdjust: "spacingAndGlyphs" }, c.carpool) : null);
    return svg;
  }

  async function exportPng(svg, name) {
    try {
      const b64 = async f => { const r = await fetch(f); const a = new Uint8Array(await r.arrayBuffer()); let s = ""; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); };
      const [c7, c6, b5] = await Promise.all([b64("barlowc-700.woff2"), b64("barlowc-600.woff2"), b64("barlow-500.woff2")]);
      const copy = svg.cloneNode(true); copy.setAttribute("xmlns", NS); copy.setAttribute("width", 1000); copy.setAttribute("height", 1414);
      const css = (fam, w, b) => "@font-face{font-family:'" + fam + "';font-weight:" + w + ";src:url(data:font/woff2;base64," + b + ") format('woff2');}";
      copy.insertBefore(sv("style", {}, css("Barlow Condensed", 700, c7) + css("Barlow Condensed", 600, c6) + css("Barlow", 500, b5)), copy.firstChild);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const cv = document.createElement("canvas"); cv.width = 1000; cv.height = 1414; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 1000, 1414); g.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      const blob = await new Promise(r => cv.toBlob(r, "image/png")), file = new File([blob], name + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".png"; document.body.append(a); a.click(); a.remove(); U().toast("Image enregistrée.");
    } catch (err) { U().toast("Export impossible sur cet appareil."); }
  }

  // ---------- écran ----------
  async function view(v) {
    const e = await DB.get("events", v.id);
    if (!e || e.deleted_at) { U().setView({ name: "cal" }); return []; }
    const rerender = () => U().setView({ name: "convoc", id: e.id });
    const [teams, mem, pl, av, events] = await Promise.all([U().loadTeams(), DB.live("memberships"), DB.live("players"), DB.live("match_availability"), DB.live("events")]);
    const t = teams.find(x => x.ts.id === e.team_season_id);
    const P = Object.fromEntries(pl.map(p => [p.id, p]));
    const roster = mem.filter(m => m.team_season_id === e.team_season_id && P[m.player_id]).map(m => ({ ...P[m.player_id], jersey: m.jersey_number }))
      .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.first_name.localeCompare(b.first_name));
    const mine = Object.fromEntries(av.filter(a => a.event_id === e.id).map(a => [a.player_id, a]));
    const venue = e.venue_id ? await DB.get("venues", e.venue_id) : null;

    // valeurs de départ : on reprend la dernière convocation de la même équipe
    const prev = events.filter(x => x.team_season_id === e.team_season_id && x.id !== e.id && x.convoc).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    const base = prev ? prev.convoc : {};
    const startMs = new Date(e.starts_at).getTime();
    const C = { title: "Match de championnat", num: "", meetup: K().hm(new Date(startMs - 60 * 60000).toISOString()),
      club_short: base.club_short || "", club_label: base.club_label || (t ? t.team.name : ""), snack: base.snack || "Toute l'équipe, organisez vous !", tshirt: base.tshirt || "", ...(e.convoc || {}) };
    const boxes = C.boxes || {};
    const saveC = async patch => { const cur = await DB.get("events", e.id); cur.convoc = { ...C, ...(cur.convoc || {}), ...patch }; await DB.save("events", cur); };

    // --- disponibilités ---
    const setStatus = async (p, status) => {
      const id = await sha("avail:" + e.id + ":" + p.id), old = mine[p.id];
      if (old && !old.deleted_at && old.status === status) { await DB.remove("match_availability", old); rerender(); return; }
      const row = { id, event_id: e.id, player_id: p.id, status, convoked: status === "present", source: "coach", answered_at: new Date().toISOString(), deleted_at: null };
      await DB.save("match_availability", old ? { ...old, ...row } : row); rerender();
    };
    const toggleConvoked = async p => { const old = mine[p.id]; if (!old) return; old.convoked = !old.convoked; await DB.save("match_availability", old); rerender(); };
    const cnt = s => roster.filter(p => mine[p.id] && !mine[p.id].deleted_at && mine[p.id].status === s).length;
    const noAnswer = roster.filter(p => !mine[p.id] || mine[p.id].deleted_at);
    const convoked = roster.filter(p => mine[p.id] && !mine[p.id].deleted_at && mine[p.id].convoked);

    const ta = h("textarea", { rows: 3, placeholder: "Colle ici les prénoms de ceux qui ont voté « présent » (un par ligne ou séparés par des virgules)" }, paste.text);
    ta.addEventListener("input", () => { paste.text = ta.value; });
    const applyPaste = async () => {
      const names = paste.text.split(/[\n,;]+/).map(s => s.replace(/^[\s\-•*\d.)]+/, "").trim()).filter(Boolean);
      let ok = 0; const miss = [];
      for (const n of names) {
        const k = norm(n), first = k.split(/\s+/)[0];
        const m = roster.filter(p => norm(p.first_name) === k || norm(p.first_name + " " + (p.last_name || "")) === k);
        const c = m.length === 1 ? m : roster.filter(p => norm(p.first_name) === first).length === 1 ? roster.filter(p => norm(p.first_name) === first) : roster.filter(p => lev(norm(p.first_name), first) <= 1);
        if (c.length === 1) { const p = c[0], id = await sha("avail:" + e.id + ":" + p.id), old = mine[p.id];
          const row = { id, event_id: e.id, player_id: p.id, status: "present", convoked: true, source: "coach", answered_at: new Date().toISOString(), deleted_at: null };
          await DB.save("match_availability", old ? { ...old, ...row } : row); ok++; }
        else miss.push(n);
      }
      paste.text = ""; paste.msg = ok + " joueur(s) marqué(s) présent(s)" + (miss.length ? ". Non retrouvés : " + miss.join(", ") : "") + "."; rerender();
    };

    // --- visuel ---
    const d = new Date(e.starts_at);
    const dateLine = K().cap(K().dayFmt.format(d)) + " " + new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric" }).format(d);
    const opp = e.opponent || "Adversaire", teamLbl = C.club_label || "";
    const cut = teamLbl.indexOf(" «") > 0 ? teamLbl.indexOf(" «") : teamLbl.length > 24 ? teamLbl.lastIndexOf(" ", 24) : -1;
    const lab = cut > 0 ? [teamLbl.slice(0, cut).trim(), teamLbl.slice(cut).trim()] : [teamLbl, ""];
    const names = convoked.map(p => ({ id: p.id, p }));
    const addrDefault = venue ? [venue.address, venue.city].filter(Boolean).join(", ") : "";
    const addrNow = C.address != null ? C.address : addrDefault;
    const away = e.home_away === "exterieur", carpoolOn = C.carpool != null ? !!C.carpool : away;
    const L = layout(convoked, boxes);
    const cdata = { title: C.title + (C.num ? " N°" + C.num : ""), dateLine, club_short: C.club_short, club_label1: lab[0], club_label2: lab[1],
      oppName: opp, oppInitials: opp.split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 3).toUpperCase(),
      venueLine: [venue ? venue.name : e.venue_name, K().hm(e.starts_at)].filter(Boolean).join(" - "), address: addrNow, carpool: carpoolOn ? (C.carpool_text || CARPOOL) : "", meetLine: C.meetup ? "RDV à " + C.meetup : "", snack: C.snack, tshirt: C.tshirt };
    cdata.myLogo = await LogoUtil.dataUrl(LogoUtil.teamLogoSrc(t ? t.team : null)).catch(() => null);
    const club = await LogoUtil.clubFor(e.opponent); cdata.oppLogo = club ? club.logo : null;
    const svg = visual(cdata, null, L.map(l => l.map(p => shortName(p, convoked))));

    const oppFile = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async ev => {
      const f = ev.target.files[0]; if (!f) return; ev.target.value = "";
      try { await LogoUtil.setClub(e.opponent, await LogoUtil.pickImage(f)); rerender(); } catch (x) { U().toast("Cette image n'est pas lisible."); }
    } });
    const inp = (label, key, ph, type) => { const i = h("input", { type: type || "text", value: C[key] || "", placeholder: ph || "" }); i.addEventListener("change", async () => { await saveC({ [key]: i.value.trim() }); rerender(); }); return U().field(label, i); };


    // --- lien de réponse pour les joueurs ---
    const pollUrl = e.poll_token ? new URL("reponse.html?t=" + e.poll_token, location.href).href : null;
    const minors = t && /u\s*\d{2}|\bu1\d|cadet|minime|poussin|benjamin/i.test(t.team.name);
    const makeLink = async () => {
      if (minors && !confirm("Cette équipe est composée de mineurs. Le lien affiche les prénoms des joueurs à toute personne qui l'a. Créer quand même le lien ?")) return;
      const b = new Uint8Array(16); crypto.getRandomValues(b);
      const cur = await DB.get("events", e.id); cur.poll_token = Array.from(b, x => x.toString(16).padStart(2, "0")).join(""); await DB.save("events", cur); rerender();
    };
    const shareLink = async () => {
      const text = "Présence au match" + (e.opponent ? " contre " + e.opponent : "") + " : réponds ici (30 secondes)";
      try { if (navigator.share) { await navigator.share({ text, url: pollUrl }); return; } } catch (x) { if (x && x.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(text + "\n" + pollUrl); U().toast("Lien copié : colle-le dans ton groupe."); } catch (x) { U().toast("Copie impossible : " + pollUrl); }
    };
    const linkCard = h("section", { class: "card" }, h("h3", { class: "tight" }, "Lien de réponse pour les joueurs"),
      !pollUrl ? [h("p", { class: "sub" }, "Crée un lien à envoyer dans ton groupe. Chaque joueur choisit son prénom et répond « Je viens / Peut-être / Je ne viens pas ». Les réponses arrivent ici toutes seules (bouton Actualiser)."),
          h("div", { class: "btns wrap" }, h("button", { onclick: makeLink }, "Créer le lien"))]
        : [h("p", { class: "sub" }, e._dirty ? "Le lien sera actif dès que l'appli aura synchronisé (pastille verte en haut). Attends avant de l'envoyer." : "Lien prêt. Il se ferme tout seul 1 jour après le match."),
          h("input", { readonly: "true", value: pollUrl, onfocus: ev => ev.target.select() }),
          h("div", { class: "btns wrap" },
            h("button", { onclick: shareLink }, Icon("upload", 16), "Envoyer le lien"),
            h("button", { class: "small", onclick: async () => { if (window.AppSync) await window.AppSync(true); rerender(); } }, "Actualiser les réponses"),
            h("button", { class: "small ghost danger", onclick: async () => { if (!confirm("Désactiver ce lien ? Les joueurs ne pourront plus répondre avec.")) return; const cur = await DB.get("events", e.id); cur.poll_token = null; await DB.save("events", cur); rerender(); } }, "Désactiver"))]);

    return [
      h("button", { class: "small ghost back", onclick: () => U().setView({ name: "event", id: e.id }) }, Icon("chevL", 18), "Fiche de la rencontre"),
      h("h2", {}, "Convocation et présences"),
      h("p", { class: "big" }, (t ? t.team.name : "") + " — " + (e.opponent || "match") + " · " + K().cap(K().dayFmt.format(d))),

      linkCard,
      h("h3", {}, "Présences"),
      h("section", { class: "card" },
        h("div", { class: "chips" }, h("span", { class: "pill ok" }, cnt("present") + " présents"), h("span", { class: "pill warn" }, cnt("peut_etre") + " peut-être"), h("span", { class: "pill bad" }, cnt("absent") + " absents"), h("span", { class: "pill" }, noAnswer.length + " sans réponse"), h("span", { class: "pill " + (convoked.length > 12 ? "bad" : "ok") }, convoked.length + " convoqués")),
        h("p", { class: "sub" }, "Note la réponse de chaque joueur. Un « Présent » est convoqué d'office : appuie sur « Convoqué ✓ » pour le mettre de côté (il n'apparaît plus dans les cases). Un « Peut-être » se convoque de la même façon."),
        convoked.length > 12 ? h("p", { class: "sub", style: "color:#ef5b50" }, "Attention : une feuille de match accepte 12 joueurs au maximum, tu en as " + convoked.length + " de convoqués.") : null,
        roster.length ? roster.map(p => { const a = mine[p.id] && !mine[p.id].deleted_at ? mine[p.id] : null;
          return h("div", { class: "att-row sheet" },
            h("div", { class: "att-name" }, h("span", { class: "num" }, p.jersey != null ? p.jersey : ""), h("span", {}, p.first_name + (p.last_name ? " " + p.last_name : "")), a && a.source === "lien" ? h("span", { class: "pill ok" }, "lien") : null, p.position ? h("span", { class: "sub" }, p.position) : null),
            h("div", { class: "btns" },
              a && (a.status === "peut_etre" || a.status === "present") ? h("button", { type: "button", class: "small " + (a.convoked ? "" : "ghost"), title: "Apparaît (ou non) dans les cases de la convocation", onclick: () => toggleConvoked(p) }, a.convoked ? "Convoqué ✓" : "Non convoqué") : null,
              h("div", { class: "seg" }, Object.entries(ST).map(([k, l]) => h("button", { type: "button", class: "segb " + (k === "absent" ? "absent" : "") + (a && a.status === k ? " on" : ""), onclick: () => setStatus(p, k) }, l)))));
        }) : h("p", { class: "sub" }, "Aucun joueur dans cette équipe."),
        h("h3", {}, "Coller la liste des présents"), ta,
        h("div", { class: "btns wrap" }, h("button", { class: "small", onclick: applyPaste }, "Marquer ces joueurs présents"),
          noAnswer.length ? h("button", { class: "small ghost", onclick: async () => { for (const p of noAnswer) { const id = await sha("avail:" + e.id + ":" + p.id), old = mine[p.id];
            await DB.save("match_availability", old ? { ...old, status: "absent", convoked: false, deleted_at: null } : { id, event_id: e.id, player_id: p.id, status: "absent", convoked: false, source: "coach", answered_at: new Date().toISOString() }); } rerender(); } }, "Le reste : absents") : null),
        paste.msg ? h("p", { class: "sub" }, paste.msg) : null),

      h("h3", {}, "Convocation"),
      h("section", { class: "card" },
        h("div", { class: "two" }, inp("Titre", "title", "Match de championnat"), inp("Numéro du match (facultatif)", "num", "ex. 6")),
        h("div", { class: "two" }, inp("Rendez-vous à", "meetup", "", "time"), inp("Tee-shirt (facultatif)", "tshirt", "ex. blanc")),
        inp("Équipe affichée sous le logo", "club_label", "ex. Eybens · Seniors DM3 « Pré D2 »"),
        (() => { const i = h("input", { value: addrNow, placeholder: addrDefault || "ex. Gymnase des Ovalistes, 12 rue du Stade, 38320 Eybens" }); i.addEventListener("change", async () => { await saveC({ address: i.value.trim() }); rerender(); });
          return U().field("Adresse du gymnase" + (addrDefault && C.address == null ? " (reprise de la fiche du lieu)" : ""), i); })(),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: carpoolOn, onchange: async ev => { await saveC({ carpool: ev.target.checked }); rerender(); } }), "Message covoiturage" + (away ? " (match à l'extérieur : activé d'office)" : "")),
        carpoolOn ? inp("Texte du message covoiturage", "carpool_text", CARPOOL) : null,
        inp("Message du bas", "snack", "Toute l'équipe, organisez vous !"),
        h("p", { class: "sub" }, "Les noms se rangent par poste : 1 en bas à gauche, 2 en bas à droite, 3 en haut à gauche, 4 en haut à droite, 5 dans la raquette. Un joueur sans poste reconnu va dans la case la moins remplie. Le poste se règle dans la fiche du joueur.")),
      h("section", { class: "card" }, h("h3", { class: "tight" }, "Logo de l'adversaire"),
        h("div", { class: "oppbox" }, cdata.oppLogo ? LogoUtil.img(cdata.oppLogo, "logoprev") : h("span", { class: "logoprev auto" }, "?"),
          h("div", {}, h("p", { class: "sub" }, e.opponent ? (cdata.oppLogo ? "Logo de " + e.opponent + " enregistré : il sera repris à chaque match contre ce club." : "Choisis le logo de " + e.opponent + " (image de ta galerie ou d'une capture). Il sera retenu pour les prochains matchs contre ce club.") : "Indique d'abord le nom de l'adversaire dans la fiche de la rencontre."),
            h("div", { class: "btns wrap" },
              e.opponent ? h("button", { class: "small", onclick: () => oppFile.click() }, Icon("upload", 16), cdata.oppLogo ? "Changer le logo" : "Choisir le logo") : null,
              cdata.oppLogo ? h("button", { class: "small ghost danger", onclick: async () => { await LogoUtil.setClub(e.opponent, null); rerender(); } }, "Retirer") : null))), oppFile),
      convoked.length ? h("section", { class: "card" }, h("h3", { class: "tight" }, "Changer la case d'un joueur"),
        h("div", { class: "boxfix" }, convoked.map(p => { const cur = boxes[p.id] != null ? boxes[p.id] : (POSTE_BOX[posteOf(p)] ?? ""); const sel = h("select", {}, h("option", { value: "" }, "Selon le poste"),
          ["Haut gauche", "Haut droite", "Raquette", "Bas gauche", "Bas droite"].map((n, i) => h("option", { value: i, selected: boxes[p.id] === i }, n)));
          sel.addEventListener("change", async () => { const nb = { ...boxes }; if (sel.value === "") delete nb[p.id]; else nb[p.id] = +sel.value; await saveC({ boxes: nb }); rerender(); });
          return h("label", { class: "inline" }, p.first_name, sel); }))) : null,
      h("div", { class: "convwrap" }, svg),
      !convoked.length ? h("p", { class: "sub" }, "Aucun joueur convoqué pour l'instant : marque des présents ci-dessus, ils apparaissent dans les cases.") : null,
      h("div", { class: "btns wrap" },
        h("button", { onclick: async () => { await exportPng(svg, ("convocation-" + (e.opponent || "match") + "-" + K().dkey(e.starts_at)).replace(/[^\w-]+/g, "_")); } }, Icon("upload", 18), "Exporter la convocation en image")),
    ];
  }

  Object.assign(window.Views, { convoc: view });
})();
