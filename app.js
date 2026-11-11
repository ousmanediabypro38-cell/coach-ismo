(function () {
  const $ = id => document.getElementById(id);
  const { SUPABASE_URL, SUPABASE_KEY } = window.COACH_CONFIG;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  function showNet() {
    const on = navigator.onLine;
    $("net").textContent = on ? "en ligne" : "hors ligne";
    $("net").className = "pill" + (on ? " ok" : "");
  }
  window.addEventListener("online", showNet);
  window.addEventListener("offline", showNet);
  showNet();

  async function testDb() {
    const el = $("db");
    if (!navigator.onLine) { el.textContent = "hors ligne"; return; }
    // Lecture protégée par RLS : réussit seulement si le script SQL a été exécuté.
    const { error } = await sb.from("teams").select("id", { head: true, count: "exact" });
    if (error) { el.textContent = "tables absentes (exécuter schema.sql)"; return; }
    el.textContent = "OK"; el.className = "pill ok";
  }

  async function render() {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    $("login").classList.toggle("hidden", !!session);
    $("home").classList.toggle("hidden", !session);
    if (session) { $("who").textContent = session.user.email; testDb(); }
  }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("loginMsg"); msg.className = "msg"; msg.textContent = "Connexion…";
    const { error } = await sb.auth.signInWithPassword({
      email: $("email").value.trim(), password: $("password").value
    });
    if (error) { msg.className = "msg err"; msg.textContent = "Connexion refusée : " + error.message; return; }
    $("password").value = ""; msg.textContent = ""; render();
  });

  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); render(); });
  sb.auth.onAuthStateChange(() => render());
  render();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
