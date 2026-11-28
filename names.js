// Noms des joueurs : majuscules automatiques, écritures reconnues (prénom, nom complet, surnoms).
(function () {
  const PART = new Set(["de", "du", "des", "la", "le", "van", "von", "der", "den", "da", "di", "del", "dos"]);
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function cap(s) {
    const t = String(s || "").replace(/\s+/g, " ").trim(); if (!t) return "";
    return t.toLowerCase().split(" ").map((w, i) => (i > 0 && PART.has(w)) ? w : w.replace(/(^|[-'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())).join(" ");
  }
  const aliasesOf = p => Array.isArray(p && p.aliases) ? p.aliases.filter(Boolean) : [];
  const full = p => [p.first_name, p.last_name].filter(Boolean).join(" ");
  // toutes les écritures connues d'un joueur (normalisées)
  const writings = p => [...new Set([norm(p.first_name), norm(full(p)), ...aliasesOf(p).map(norm)].filter(Boolean))];
  window.Names = { cap, norm, aliasesOf, full, writings };
})();
