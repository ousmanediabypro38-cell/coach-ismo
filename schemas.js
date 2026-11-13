// Schémas du playbook : demi-terrain dessiné au doigt (joueurs, déplacements, dribbles, passes, écrans, textes).
// Un schéma est enregistré sous forme de dessin vectoriel : léger, net à toutes les tailles, modifiable à tout moment.
(function () {
  const DB = window.DB, U = () => window.UI;
  const h = (...a) => U().h(...a);
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#1d2b23", GREEN = "#23b574", RED = "#c23b2e", BALL = "#e08a3c", COURT = "#f1ecdf", LINE = "#4a5a50";
  const VB = { x: -12, y: -12, w: 524, h: 491 };            // demi-terrain FIBA : 15 m × 14 m, 1 m ≈ 33 unités, panier en haut
  const sv = (tag, attrs, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  const pts = a => a.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  // ---------- terrain ----------
  function court() {
    const st = { fill: "none", stroke: LINE, "stroke-width": 3, "stroke-linejoin": "round" };
    return sv("g", {},
      sv("rect", { x: VB.x, y: VB.y, width: VB.w, height: VB.h, fill: COURT, rx: 10 }),
      sv("rect", { x: 0, y: 0, width: 500, height: 467, ...st }),
      sv("rect", { x: 168.5, y: 0, width: 163, height: 193, ...st }),                                        // raquette
      sv("path", { d: "M190 193 A60 60 0 0 0 310 193", ...st }),                                              // lancer franc (partie extérieure)
      sv("path", { d: "M190 193 A60 60 0 0 1 310 193", ...st, "stroke-dasharray": "9 8" }),                   // (partie dans la raquette)
      sv("path", { d: "M208 0 V52 A42 42 0 0 0 292 52 V0", ...st }),                                          // zone restrictive
      sv("path", { d: "M30 0 V99 A225 225 0 0 0 470 99 V0", ...st }),                                         // ligne à 3 points
      sv("path", { d: "M190 467 A60 60 0 0 1 310 467", ...st }),                                              // rond central
      sv("line", { x1: 220, y1: 40, x2: 280, y2: 40, stroke: LINE, "stroke-width": 5, "stroke-linecap": "round" }),
      sv("line", { x1: 250, y1: 40, x2: 250, y2: 44.5, stroke: LINE, "stroke-width": 3 }),
      sv("circle", { cx: 250, cy: 52, r: 7.5, fill: "none", stroke: BALL, "stroke-width": 3 }));
  }

  // ---------- éléments ----------
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function dirAt(p) {            // direction de la fin du tracé, calculée sur ~14 unités pour rester stable
    const e = p[p.length - 1]; let i = p.length - 2;
    while (i > 0 && dist(p[i], e) < 14) i--;
    const d = dist(p[i], e) || 1; return [(e[0] - p[i][0]) / d, (e[1] - p[i][1]) / d];
  }
  function arrow(p) {
    const e = p[p.length - 1], d = dirAt(p), n = [-d[1], d[0]];
    return sv("polygon", { points: pts([e, [e[0] - d[0] * 18 + n[0] * 8, e[1] - d[1] * 18 + n[1] * 8], [e[0] - d[0] * 18 - n[0] * 8, e[1] - d[1] * 18 - n[1] * 8]]), fill: INK });
  }
  function zigzag(p) {
    const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + dist(p[i - 1], p[i]));
    const total = cum[cum.length - 1], out = [p[0]]; let seg = 1;
    for (let k = 1; k * 11 < total - 14; k++) {
      const s = k * 11; while (seg < p.length - 1 && cum[seg] < s) seg++;
      const t = (s - cum[seg - 1]) / ((cum[seg] - cum[seg - 1]) || 1), a = p[seg - 1], b = p[seg];
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, d = dist(a, b) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, o = (k % 2 ? 7 : -7);
      out.push([x + nx * o, y + ny * o]);
    }
    out.push(p[p.length - 1]); return out;
  }
  function node(it, i) {
    const a = { "data-i": i };
    if (it.t === "o") return sv("g", a, sv("circle", { cx: it.x, cy: it.y, r: 19, fill: GREEN, stroke: INK, "stroke-width": 3 }),
      sv("text", { x: it.x, y: it.y + 7, "text-anchor": "middle", "font-size": 21, "font-weight": 700, fill: "#03160c", "font-family": "system-ui, sans-serif" }, it.n));
    if (it.t === "x") return sv("g", a, sv("circle", { cx: it.x, cy: it.y, r: 21, fill: "transparent" }),
      sv("path", { d: "M" + (it.x - 14) + " " + (it.y - 14) + "L" + (it.x + 14) + " " + (it.y + 14) + "M" + (it.x + 14) + " " + (it.y - 14) + "L" + (it.x - 14) + " " + (it.y + 14), stroke: RED, "stroke-width": 5, "stroke-linecap": "round" }),
      sv("text", { x: it.x + 19, y: it.y - 13, "font-size": 16, "font-weight": 700, fill: RED, "font-family": "system-ui, sans-serif" }, it.n));
    if (it.t === "b") return sv("g", a, sv("circle", { cx: it.x, cy: it.y, r: 11, fill: BALL, stroke: INK, "stroke-width": 2 }),
      sv("path", { d: "M" + (it.x - 11) + " " + it.y + "H" + (it.x + 11) + "M" + it.x + " " + (it.y - 11) + "V" + (it.y + 11), stroke: INK, "stroke-width": 1.5 }));
    if (it.t === "txt") return sv("text", { ...a, x: it.x, y: it.y, "font-size": 24, "font-weight": 700, fill: INK, stroke: COURT, "stroke-width": 5, "paint-order": "stroke", "font-family": "system-ui, sans-serif" }, it.s);
    const p = it.p; if (!p || p.length < 2) return sv("g", a);
    const line = (points, extra) => sv("polyline", { points: pts(points), fill: "none", stroke: INK, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round", ...extra });
    const hit = sv("polyline", { points: pts(p), fill: "none", stroke: "transparent", "stroke-width": 26, "stroke-linecap": "round", "stroke-linejoin": "round" });
    if (it.t === "dribble") return sv("g", a, hit, line(zigzag(p)), arrow(p));
    if (it.t === "pass") return sv("g", a, hit, line(p, { "stroke-dasharray": "10 9" }), arrow(p));
    if (it.t === "screen") { const e = p[p.length - 1], d = dirAt(p), n = [-d[1], d[0]];
      return sv("g", a, hit, line(p), sv("line", { x1: e[0] + n[0] * 22, y1: e[1] + n[1] * 22, x2: e[0] - n[0] * 22, y2: e[1] - n[1] * 22, stroke: INK, "stroke-width": 7, "stroke-linecap": "round" })); }
    return sv("g", a, hit, line(p), arrow(p));          // déplacement
  }
  // Dessin complet (lecture seule) : utilisé dans la fiche, l'éditeur et l'export image
  function render(data, opts) {
    const svg = sv("svg", { viewBox: [VB.x, VB.y, VB.w, VB.h].join(" "), class: "dsvg", role: "img", "aria-label": (opts && opts.label) || "Schéma" });
    svg.append(court());
    const g = sv("g", { class: "items" }); svg.append(g);
    ((data && data.items) || []).map((it, i) => [it, i]).sort((x, y) => (x[0].p ? 0 : 1) - (y[0].p ? 0 : 1)).forEach(([it, i]) => g.append(node(it, i)));   // flèches sous les joueurs
    return svg;
  }

  // ---------- éditeur ----------
  const TOOLS = [["select", "Déplacer"], ["o", "Attaquant"], ["x", "Défenseur"], ["b", "Ballon"], ["move", "Déplacement"], ["dribble", "Dribble"], ["pass", "Passe"], ["screen", "Écran"], ["txt", "Texte"], ["erase", "Gomme"]];
  const LINES = ["move", "dribble", "pass", "screen"];
  let ed = { id: null, items: [], hist: [], tool: "select", timer: null };

  function simplify(p, eps) {   // Ramer–Douglas–Peucker : garde la forme avec peu de points
    if (p.length < 3) return p;
    const a = p[0], b = p[p.length - 1]; let m = 0, k = 0;
    for (let i = 1; i < p.length - 1; i++) {
      const d = Math.abs((b[1] - a[1]) * p[i][0] - (b[0] - a[0]) * p[i][1] + b[0] * a[1] - b[1] * a[0]) / (dist(a, b) || 1);
      if (d > m) { m = d; k = i; }
    }
    return m > eps ? simplify(p.slice(0, k + 1), eps).slice(0, -1).concat(simplify(p.slice(k), eps)) : [a, b];
  }
  async function flush() {
    clearTimeout(ed.timer); ed.timer = null; if (!ed.id) return;
    const d = await DB.get("playbook_diagrams", ed.id); if (!d) return;
    d.data = { items: ed.items }; await DB.save("playbook_diagrams", d);
  }
  const later = () => { clearTimeout(ed.timer); ed.timer = setTimeout(flush, 500); };
  const snap = () => { ed.hist.push(JSON.stringify(ed.items)); if (ed.hist.length > 40) ed.hist.shift(); };

  async function editorView(v) {
    const d = await DB.get("playbook_diagrams", v.id);
    const e = d ? await DB.get("playbook_entries", d.entry_id) : null;
    if (!d || d.deleted_at || !e) { U().setView({ name: "playbook" }); return []; }
    if (ed.id !== d.id) ed = { id: d.id, items: JSON.parse(JSON.stringify((d.data && d.data.items) || [])), hist: [], tool: "select", timer: null };
    const rerender = () => U().setView({ name: "playDiagram", id: d.id });
    const svg = sv("svg", { viewBox: [VB.x, VB.y, VB.w, VB.h].join(" "), class: "dsvg edit" });
    svg.append(court()); const layer = sv("g"); svg.append(layer);
    const paint = (extra) => { layer.replaceChildren(); ed.items.map((it, i) => [it, i]).sort((x, y) => (x[0].p ? 0 : 1) - (y[0].p ? 0 : 1)).forEach(([it, i]) => layer.append(node(it, i))); if (extra) layer.append(extra); };
    paint();
    const pos = ev => { const m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(m); return [Math.max(0, Math.min(500, q.x)), Math.max(0, Math.min(467, q.y))]; };
    const hitIdx = ev => { const g = ev.target.closest && ev.target.closest("[data-i]"); return g ? +g.getAttribute("data-i") : -1; };
    const nextNum = t => { for (let n = 1; n <= 5; n++) if (!ed.items.some(i => i.t === t && i.n === n)) return n; return 0; };
    let drag = null;

    svg.addEventListener("pointerdown", ev => {
      ev.preventDefault(); svg.setPointerCapture(ev.pointerId);
      const p = pos(ev), i = hitIdx(ev), tool = ed.tool, it = i >= 0 ? ed.items[i] : null;
      if (tool === "erase") { if (it) { snap(); ed.items.splice(i, 1); paint(); later(); } return; }
      if (LINES.includes(tool)) { drag = { kind: "draw", pts: [p] }; return; }
      if (it && (tool === "select" || !it.p)) { drag = { kind: "move", i, from: p, moved: false, orig: JSON.parse(JSON.stringify(it)) }; snap(); return; }
      if (tool === "o" || tool === "x") { const n = nextNum(tool); if (!n) { U().toast("5 joueurs maximum de ce côté."); return; } snap(); ed.items.push({ t: tool, n, x: p[0], y: p[1] }); paint(); later(); }
      else if (tool === "b") { snap(); ed.items.push({ t: "b", x: p[0], y: p[1] }); paint(); later(); }
      else if (tool === "txt") { const s = (prompt("Texte à écrire sur le schéma :") || "").trim(); if (s) { snap(); ed.items.push({ t: "txt", x: p[0], y: p[1], s }); paint(); later(); } }
    });
    svg.addEventListener("pointermove", ev => {
      if (!drag) return; const p = pos(ev);
      if (drag.kind === "draw") { if (dist(p, drag.pts[drag.pts.length - 1]) > 4) drag.pts.push(p); paint(node({ t: ed.tool, p: drag.pts.length > 1 ? drag.pts : [p, p] }, -1)); return; }
      const it = ed.items[drag.i], dx = p[0] - drag.from[0], dy = p[1] - drag.from[1];
      if (!drag.moved && Math.hypot(dx, dy) < 5) return; drag.moved = true;
      const o = drag.orig;
      if (it.p) it.p = o.p.map(q => [Math.max(0, Math.min(500, q[0] + dx)), Math.max(0, Math.min(467, q[1] + dy))]);
      else { it.x = Math.max(0, Math.min(500, o.x + dx)); it.y = Math.max(0, Math.min(467, o.y + dy)); }
      paint();
    });
    const end = ev => {
      if (!drag) return; const d0 = drag; drag = null;
      if (d0.kind === "draw") {
        const p = simplify(d0.pts, 7);
        if (p.length >= 2 && dist(p[0], p[p.length - 1]) > 18) { snap(); ed.items.push({ t: ed.tool, p: p.slice(0, 40).map(q => [Math.round(q[0]), Math.round(q[1])]) }); later(); }
        paint(); return;
      }
      const it = ed.items[d0.i];
      if (!d0.moved) {          // simple touche : change le numéro d'un joueur, modifie un texte
        ed.hist.pop();
        if (it && (it.t === "o" || it.t === "x")) { snap(); it.n = it.n % 5 + 1; while (ed.items.some((o, k) => k !== d0.i && o.t === it.t && o.n === it.n)) it.n = it.n % 5 + 1; later(); }
        else if (it && it.t === "txt") { const s = prompt("Texte :", it.s); if (s !== null) { snap(); if (s.trim()) it.s = s.trim(); else ed.items.splice(d0.i, 1); later(); } }
        paint();
      } else later();
    };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);

    const toolBtn = ([k, l]) => h("button", { type: "button", class: "chip dtool" + (ed.tool === k ? " on" : ""), onclick: () => { ed.tool = k; rerender(); } }, l);
    const title = h("input", { value: d.title || "", placeholder: "Titre (ex. Phase 1)" });
    title.addEventListener("change", async () => { const c = await DB.get("playbook_diagrams", d.id); c.title = title.value.trim() || null; await DB.save("playbook_diagrams", c); });
    const note = h("textarea", { rows: 3, placeholder: "Ce qui se passe sur ce schéma : qui passe, qui coupe, qui écrane…" }, d.note || "");
    note.addEventListener("change", async () => { const c = await DB.get("playbook_diagrams", d.id); c.note = note.value.trim() || null; await DB.save("playbook_diagrams", c); });
    const hint = { select: "Fais glisser un élément. Touche un joueur pour changer son numéro.", o: "Touche le terrain pour poser un attaquant (1 à 5).", x: "Touche le terrain pour poser un défenseur.", b: "Touche pour poser le ballon.",
      move: "Trace d'un geste le déplacement : une flèche pleine.", dribble: "Trace le dribble : flèche en zigzag.", pass: "Trace la passe : flèche en pointillés.", screen: "Trace jusqu'à l'écran : la barre se pose au bout.", txt: "Touche pour écrire un texte. Touche un texte pour le modifier.", erase: "Touche un élément pour l'effacer." }[ed.tool];
    const back = async () => { await flush(); U().setView({ name: "playEntry", id: e.id }); };
    return [
      h("button", { class: "small ghost back", onclick: back }, Icon("chevL", 18), e.title),
      h("h2", {}, "Schéma"),
      h("div", { class: "dtools" }, TOOLS.map(toolBtn)),
      h("p", { class: "sub dhint" }, hint),
      h("div", { class: "diagwrap" }, svg),
      h("div", { class: "btns wrap" },
        h("button", { class: "small ghost", onclick: () => { if (!ed.hist.length) return; ed.items = JSON.parse(ed.hist.pop()); paint(); later(); } }, "Annuler le dernier geste"),
        h("button", { class: "small ghost danger", onclick: () => { if (!ed.items.length || !confirm("Tout effacer sur ce schéma ?")) return; snap(); ed.items = []; paint(); later(); } }, "Tout effacer"),
        h("button", { class: "small ghost", onclick: async () => { await flush(); await exportPng(render({ items: ed.items }), (e.title + "-" + (title.value || "schema")).replace(/[^\w-]+/g, "_")); } }, Icon("upload", 16), "Exporter en image"),
        h("button", { class: "small ghost", onclick: async () => {
          await flush(); const all = (await DB.live("playbook_diagrams")).filter(x => x.entry_id === e.id);
          const m = (title.value || "").match(/^(.*?)(\d+)\s*$/), t2 = m ? m[1] + (+m[2] + 1) : (title.value || "Schéma") + " (suite)";
          const n = await DB.save("playbook_diagrams", { entry_id: e.id, title: t2, note: null, court: "half", data: { items: JSON.parse(JSON.stringify(ed.items)) }, position: all.length });
          ed = { id: null, items: [], hist: [], tool: "select", timer: null }; U().setView({ name: "playDiagram", id: n.id });
        } }, Icon("copy", 16), "Dupliquer en phase suivante")),
      h("section", { class: "card" }, U().field("Titre", title), U().field("Légende", note)),
      h("div", { class: "btns wrap" }, h("button", { onclick: back }, Icon("check", 18), "Terminé"),
        h("button", { class: "ghost danger", onclick: async () => { if (!confirm("Supprimer ce schéma ?")) return; clearTimeout(ed.timer); const c = await DB.get("playbook_diagrams", d.id); await DB.remove("playbook_diagrams", c); ed = { id: null, items: [], hist: [], tool: "select", timer: null }; U().setView({ name: "playEntry", id: e.id }); } }, Icon("trash", 18), "Supprimer le schéma")),
    ];
  }

  // ---------- export image (PNG) ----------
  async function exportPng(svg, name) {
    try {
      const c = svg.cloneNode(true); c.setAttribute("xmlns", NS); c.setAttribute("width", VB.w * 2); c.setAttribute("height", VB.h * 2);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const cv = document.createElement("canvas"); cv.width = VB.w * 2; cv.height = VB.h * 2; cv.getContext("2d").drawImage(img, 0, 0); URL.revokeObjectURL(url);
      const blob = await new Promise(r => cv.toBlob(r, "image/png"));
      const file = new File([blob], name + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".png"; document.body.append(a); a.click(); a.remove(); U().toast("Image enregistrée.");
    } catch (err) { U().toast("Export impossible sur cet appareil."); }
  }

  // ---------- section « Schémas » dans une fiche du playbook ----------
  async function entrySection(e) {
    const list = (await DB.live("playbook_diagrams")).filter(x => x.entry_id === e.id).sort((a, b) => (a.position || 0) - (b.position || 0) || (a.created_at || a.updated_at_local || "").localeCompare(b.created_at || b.updated_at_local || ""));
    const add = h("button", { class: "small", onclick: async () => {
      const n = await DB.save("playbook_diagrams", { entry_id: e.id, title: list.length ? "Phase " + (list.length + 1) : "Phase 1", note: null, court: "half", data: { items: [] }, position: list.length });
      ed = { id: null, items: [], hist: [], tool: "select", timer: null }; U().setView({ name: "playDiagram", id: n.id });
    } }, Icon("plus", 16), "Nouveau schéma");
    return h("section", { class: "card" }, h("div", { class: "row tight" }, h("h3", { class: "tight" }, "Schémas"), add),
      list.length ? h("div", { class: "thumbs" }, list.map(d => h("button", { type: "button", class: "thumb", onclick: () => { ed = { id: null, items: [], hist: [], tool: "select", timer: null }; U().setView({ name: "playDiagram", id: d.id }); } },
        render(d.data, { label: d.title || "Schéma" }), h("strong", {}, d.title || "Schéma"), d.note ? h("span", { class: "sub" }, d.note) : null)))
        : h("p", { class: "sub" }, "Dessine le système au doigt sur un demi-terrain : joueurs, déplacements, dribbles, passes, écrans. Ajoute un schéma par phase."));
  }

  window.DiagramUtil = { entrySection, render, exportPng };
  Object.assign(window.Views, { playDiagram: editorView });
})();
