// Fenêtre flottante réutilisable : window.Modal.open({ title, body, actions }) → { close }
(function () {
  const h = (...a) => window.UI.h(...a);
  function open(o) {
    const prev = document.activeElement;
    const close = () => { back.classList.add("out"); setTimeout(() => back.remove(), 180); document.removeEventListener("keydown", key); try { prev && prev.focus && prev.focus(); } catch (e) {} if (o.onclose) o.onclose(); };
    const key = e => { if (e.key === "Escape") close(); };
    const acts = (o.actions || []).map(a => h("button", { type: "button", class: a.primary ? "" : "ghost", disabled: !!a.disabled, onclick: async ev => { if (a.onclick) { const r = await a.onclick(api, ev); if (r === false) return; } if (a.close !== false) close(); } }, a.label));
    const box = h("div", { class: "mbox", role: "dialog", "aria-modal": "true", "aria-label": o.title || "Fenêtre" },
      h("div", { class: "mhead" }, h("h3", {}, o.title || ""), h("button", { type: "button", class: "ghost icononly", "aria-label": "Fermer", onclick: close }, "✕")),
      h("div", { class: "mbody" }, o.body), acts.length ? h("div", { class: "mfoot" }, acts) : null);
    const back = h("div", { class: "mback", onclick: e => { if (e.target === back) close(); } }, box);
    const api = { close, el: box };
    document.body.append(back); document.addEventListener("keydown", key);
    setTimeout(() => { const f = box.querySelector("textarea,input,select,button.primary,button"); f && f.focus && f.focus({ preventScroll: true }); }, 60);
    return api;
  }
  window.Modal = { open };
})();
