<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Lvfe Admin</title>
  <link rel="stylesheet" href="admin.css?v=3" />
</head>
<body>
  <div id="app">
    <section id="loginView" class="login-view">
      <div class="login-card">
        <img class="mark" src="https://iconiaglobal.com/lvfe/assets/brand/lvfe-mark-512.png" alt="Lvfe" width="64" height="64" />
        <h1>Lvfe Admin</h1>
        <p class="muted">CMS for host keys, economy, and player ops</p>
        <form id="loginForm">
          <label>Email <input type="email" id="loginEmail" required autocomplete="username" value="ugigentity@yahoo.com" /></label>
          <label>Password <input type="password" id="loginPass" required autocomplete="current-password" /></label>
          <button type="submit" class="btn primary">Sign in</button>
          <p id="loginErr" class="err" hidden></p>
        </form>
      </div>
    </section>

    <section id="cmsView" class="cms" hidden>
      <header class="top">
        <div class="brand">
          <img src="https://iconiaglobal.com/lvfe/assets/brand/lvfe-mark-512.png" alt="" width="36" height="36" />
          <div>
            <strong>Lvfe Admin</strong>
            <span id="adminEmail" class="muted"></span>
          </div>
        </div>
        <button type="button" class="btn ghost" id="btnLogout">Sign out</button>
      </header>

      <nav class="tabs" role="tablist" id="tabNav">
        <button type="button" class="tab on" data-tab="overview" role="tab">Overview</button>
        <button type="button" class="tab" data-tab="host" role="tab">Host &amp; Auth</button>
        <button type="button" class="tab" data-tab="payments" role="tab">Payments</button>
        <button type="button" class="tab" data-tab="economy" role="tab">Economy</button>
        <button type="button" class="tab" data-tab="client" role="tab">Client &amp; Map</button>
        <button type="button" class="tab" data-tab="features" role="tab">Features</button>
        <button type="button" class="tab" data-tab="players" role="tab">Players</button>
      </nav>

      <main class="panes">
        <div class="pane on" data-pane="overview" id="paneOverview"></div>
        <div class="pane" data-pane="host" id="paneHost"></div>
        <div class="pane" data-pane="payments" id="panePayments"></div>
        <div class="pane" data-pane="economy" id="paneEconomy"></div>
        <div class="pane" data-pane="client" id="paneClient"></div>
        <div class="pane" data-pane="features" id="paneFeatures"></div>
        <div class="pane" data-pane="players" id="panePlayers"></div>
      </main>

      <footer class="foot">
        <span id="statusMsg" class="muted"></span>
        <a href="https://iconiaglobal.com/lvfe/" target="_blank" rel="noopener">Open PWA</a>
      </footer>
    </section>
  </div>
  <script src="admin.js?v=3"></script>
</body>
</html>
