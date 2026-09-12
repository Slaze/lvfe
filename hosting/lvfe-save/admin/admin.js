/* Lvfe Admin CMS — tabs for host, payments, economy, client, features, players. */
(function () {
  // Absolute base — never use ".." (breaks when URL is /admin without trailing slash).
  const API = (function () {
    try {
      const p = location.pathname || "";
      const i = p.indexOf("/lvfe-save");
      if (i >= 0) return p.slice(0, i) + "/lvfe-save";
    } catch (err) { /* */ }
    return "/lvfe-save";
  })();
  let csrf = "";
  let authed = false;
  let bootDone = false;
  let hostCfg = null;
  let gameCfg = null;
  let players = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function status(msg, ok) {
    const el = $("statusMsg");
    if (!el) return;
    el.textContent = msg || "";
    el.className = ok === false ? "err" : (ok ? "ok" : "muted");
  }

  async function api(path, opts) {
    const o = opts || {};
    const headers = Object.assign({ "Content-Type": "application/json" }, o.headers || {});
    if (o.auth !== false && csrf) headers["X-Lvfe-Admin-Csrf"] = csrf;
    const res = await fetch(API.replace(/\/+$/, "") + path, {
      method: o.method || "GET",
      credentials: "same-origin",
      headers,
      body: o.body != null ? JSON.stringify(o.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = { ok: false, error: "bad_json" }; }
    return { status: res.status, data: data || {} };
  }

  function showLogin() {
    authed = false;
    document.body.classList.remove("is-authed");
    $("loginView").hidden = false;
    $("cmsView").hidden = true;
    try {
      if (location.hash === "#dashboard") {
        history.replaceState(null, "", location.pathname + location.search);
      }
    } catch (err) { /* */ }
  }

  function showCms(email) {
    authed = true;
    document.body.classList.add("is-authed");
    $("loginView").hidden = true;
    $("cmsView").hidden = false;
    $("adminEmail").textContent = email || "";
    try {
      if (location.hash !== "#dashboard") {
        history.replaceState(null, "", location.pathname + location.search + "#dashboard");
      }
    } catch (err) { /* */ }
    // Ensure login card cannot paint over CMS (CSS display:grid can fight [hidden]).
    $("loginView").setAttribute("aria-hidden", "true");
    $("cmsView").removeAttribute("aria-hidden");
  }

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("on", t.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".pane").forEach(function (p) {
      p.classList.toggle("on", p.getAttribute("data-pane") === name);
    });
    if (name === "overview") renderOverview();
    if (name === "host") renderHost();
    if (name === "payments") renderPayments();
    if (name === "economy") renderEconomy();
    if (name === "client") renderClient();
    if (name === "features") renderFeatures();
    if (name === "players") renderPlayers();
  }

  async function loadAll() {
    const [ov, host, game, pl] = await Promise.all([
      api("/v1/admin/overview"),
      api("/v1/admin/host-config"),
      api("/v1/admin/game-config"),
      api("/v1/admin/players"),
    ]);
    if (ov.status === 401 || host.status === 401) {
      // Session missing — only bounce to login if we are not mid-login paint.
      if (authed) {
        status("Session expired — sign in again.", false);
        showLogin();
      }
      return false;
    }
    window.__overview = ov.data;
    hostCfg = (host.data && host.data.config) || {};
    gameCfg = (game.data && game.data.config) || {};
    players = (pl.data && pl.data.players) || [];
    return true;
  }

  function field(key, label, value, opts) {
    const o = opts || {};
    const type = o.type || "text";
    if (type === "checkbox") {
      return `<label class="check"><input type="checkbox" data-key="${esc(key)}" ${value ? "checked" : ""} /> ${esc(label)}</label>`;
    }
    if (type === "select") {
      const optsHtml = (o.options || []).map(function (opt) {
        const v = typeof opt === "string" ? opt : opt.value;
        const t = typeof opt === "string" ? opt : opt.label;
        return `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(t)}</option>`;
      }).join("");
      return `<label class="field">${esc(label)}<select data-key="${esc(key)}">${optsHtml}</select></label>`;
    }
    if (type === "textarea") {
      return `<label class="field">${esc(label)}<textarea data-key="${esc(key)}">${esc(value)}</textarea></label>`;
    }
    const ph = o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : "";
    const step = o.step != null ? ` step="${esc(o.step)}"` : "";
    return `<label class="field">${esc(label)}<input type="${esc(type)}" data-key="${esc(key)}" value="${esc(value)}"${ph}${step} /></label>`;
  }

  function secretField(key, label, meta) {
    const m = meta || {};
    const hint = m.set ? (`Set · ${m.hint || "••••"}`) : "Not set";
    return `<label class="field">${esc(label)}
      <span class="secret-hint">${esc(hint)}</span>
      <input type="password" data-key="${esc(key)}" data-secret="1" autocomplete="new-password" placeholder="Leave blank to keep · __CLEAR__ to wipe" />
    </label>`;
  }

  function collect(root, secretMode) {
    const out = {};
    root.querySelectorAll("[data-key]").forEach(function (el) {
      const k = el.getAttribute("data-key");
      if (el.type === "checkbox") {
        out[k] = el.checked;
        return;
      }
      let v = el.value;
      if (el.getAttribute("data-secret") === "1") {
        if (!String(v).trim()) return; // keep unchanged
        out[k] = v;
        return;
      }
      if (el.type === "number") {
        out[k] = v === "" ? "" : Number(v);
        return;
      }
      out[k] = v;
    });
    return out;
  }

  function renderOverview() {
    const d = window.__overview || {};
    const h = d.health || {};
    const buy = h.buyNcn || {};
    $("paneOverview").innerHTML = `
      <div class="card">
        <h2>Overview</h2>
        <p class="hint">Live save host health. Edit other tabs, then Save. Clients pull public game config from <code>/v1/game-config</code>.</p>
        <div class="grid">
          <div><div class="muted">Players</div><div class="stat">${esc(d.playerCount || 0)}</div></div>
          <div><div class="muted">Dev auth</div><div class="stat">${h.devAuth ? "ON" : "off"}</div></div>
          <div><div class="muted">Google</div><div class="stat">${h.googleConfigured ? "ready" : "—"}</div></div>
          <div><div class="muted">Buy NCN</div><div class="stat">${buy.configured ? (buy.provider || "ok") : "keys?"}</div></div>
        </div>
        <p class="muted" style="margin-top:12px">Game config updated: ${esc(d.gameConfigUpdatedAt || "never")}</p>
        <div class="row">
          <span class="badge ${buy.paystack && buy.paystack.configured ? "" : "off"}">Paystack ${buy.paystack && buy.paystack.configured ? "on" : "off"}</span>
          <span class="badge ${buy.flutterwave && buy.flutterwave.configured ? "" : "off"}">Flutterwave ${buy.flutterwave && buy.flutterwave.configured ? "on" : "off"}</span>
          <span class="badge ${(h.opayNcn && h.opayNcn.configured) ? "" : "off"}">OPay ${(h.opayNcn && h.opayNcn.configured) ? "on" : "off"}</span>
        </div>
      </div>`;
  }

  function renderHost() {
    const c = hostCfg || {};
    $("paneHost").innerHTML = `
      <div class="card" id="hostForm">
        <h2>Host &amp; Auth</h2>
        <p class="hint">Writes <code>config.local.php</code> on this server. Secrets stay masked; blank = keep.</p>
        <div class="grid">
          ${field("ADMIN_EMAIL", "Admin email", c.ADMIN_EMAIL || "")}
          ${field("ADMIN_PASSWORD", "New admin password", "", { type: "password", placeholder: "Leave blank to keep" })}
          ${field("GOOGLE_WEB_CLIENT_ID", "Google Web client ID", c.GOOGLE_WEB_CLIENT_ID || "")}
          ${field("LVFE_ALLOW_DEV_AUTH", "Allow dev auth (lvfe-dev:)", c.LVFE_ALLOW_DEV_AUTH || "1", {
            type: "select", options: [{ value: "1", label: "1 — allow" }, { value: "0", label: "0 — production" }]
          })}
          ${secretField("SAVE_SECRET", "SAVE_SECRET", c.SAVE_SECRET)}
        </div>
        <div class="row">
          <button type="button" class="btn primary" id="saveHost">Save host &amp; auth</button>
        </div>
      </div>`;
    $("saveHost").onclick = async function () {
      const patch = collect($("hostForm"));
      status("Saving…");
      const res = await api("/v1/admin/host-config", { method: "PUT", body: { config: patch } });
      if (!res.data.ok) { status(res.data.error || "Save failed", false); return; }
      hostCfg = res.data.config;
      status("Host config saved", true);
      await loadAll();
      renderHost();
    };
  }

  function renderPayments() {
    const c = hostCfg || {};
    $("panePayments").innerHTML = `
      <div class="card" id="payForm">
        <h2>Payments</h2>
        <p class="hint">1 NCN = USD $1. Public keys also flow to clients via <code>/v1/game-config</code>.</p>
        <h3>Paystack (primary)</h3>
        <div class="grid">
          ${field("PAYSTACK_PUBLIC_KEY", "Public key", c.PAYSTACK_PUBLIC_KEY || "")}
          ${secretField("PAYSTACK_SECRET_KEY", "Secret key", c.PAYSTACK_SECRET_KEY)}
          ${secretField("PAYSTACK_WEBHOOK_SECRET", "Webhook secret (optional)", c.PAYSTACK_WEBHOOK_SECRET)}
          ${field("PAYSTACK_CURRENCY", "Currency", c.PAYSTACK_CURRENCY || "NGN", { type: "select", options: ["NGN", "USD"] })}
        </div>
        <h3>Flutterwave (alternate)</h3>
        <div class="grid">
          ${field("FLW_PUBLIC_KEY", "Public key", c.FLW_PUBLIC_KEY || "")}
          ${secretField("FLW_SECRET_KEY", "Secret key", c.FLW_SECRET_KEY)}
          ${secretField("FLW_SECRET_HASH", "Secret hash (verif-hash)", c.FLW_SECRET_HASH)}
          ${field("FLW_CURRENCY", "Currency", c.FLW_CURRENCY || "NGN", { type: "select", options: ["NGN", "USD"] })}
        </div>
        <h3>FX &amp; receipts</h3>
        <div class="grid">
          ${field("NGN_PER_USD", "NGN per USD", c.NGN_PER_USD || "1500", { type: "number", step: "1" })}
          ${field("BUY_MERCHANT_EMAIL", "Receipt BCC email", c.BUY_MERCHANT_EMAIL || "")}
        </div>
        <h3>OPay (optional / hidden in Buy UI)</h3>
        <div class="grid">
          ${field("OPAY_MERCHANT_ID", "Merchant ID", c.OPAY_MERCHANT_ID || "")}
          ${field("OPAY_PUBLIC_KEY", "Public key", c.OPAY_PUBLIC_KEY || "")}
          ${secretField("OPAY_SECRET_KEY", "Secret key", c.OPAY_SECRET_KEY)}
          ${field("OPAY_SANDBOX", "Sandbox", c.OPAY_SANDBOX || "1", { type: "select", options: ["1", "0"] })}
          ${field("OPAY_CURRENCY", "Currency", c.OPAY_CURRENCY || "NGN")}
          ${field("OPAY_PAYOUT_ACCOUNT", "Payout account", c.OPAY_PAYOUT_ACCOUNT || "")}
          ${field("OPAY_PAYOUT_NAME", "Payout name", c.OPAY_PAYOUT_NAME || "")}
          ${field("OPAY_MERCHANT_EMAIL", "Merchant email", c.OPAY_MERCHANT_EMAIL || "")}
        </div>
        <p class="hint">Webhooks: <code>…/v1/buy/webhook</code> · <code>…/v1/buy/flw-webhook</code></p>
        <div class="row">
          <button type="button" class="btn primary" id="savePay">Save payments</button>
        </div>
      </div>`;
    $("savePay").onclick = async function () {
      const patch = collect($("payForm"));
      status("Saving…");
      const res = await api("/v1/admin/host-config", { method: "PUT", body: { config: patch } });
      if (!res.data.ok) { status(res.data.error || "Save failed", false); return; }
      hostCfg = res.data.config;
      status("Payments saved", true);
    };
  }

  function eco() { return (gameCfg && gameCfg.economy) || {}; }
  function cli() { return (gameCfg && gameCfg.client) || {}; }
  function feat() { return (gameCfg && gameCfg.features) || {}; }
  function copy() { return (gameCfg && gameCfg.copy) || {}; }

  function renderEconomy() {
    const e = eco();
    $("paneEconomy").innerHTML = `
      <div class="card" id="ecoForm">
        <h2>Economy</h2>
        <p class="hint">Pushed to PWA/APK via public game config. Clients apply on boot.</p>
        <div class="grid">
          ${field("claimRadiusM", "Claim radius (m)", e.claimRadiusM, { type: "number" })}
          ${field("yieldRate", "Visit yield rate", e.yieldRate, { type: "number", step: "0.01" })}
          ${field("factionCut", "Faction cut of yield", e.factionCut, { type: "number", step: "0.01" })}
          ${field("minStakeFloor", "Min stake floor (NCN)", e.minStakeFloor, { type: "number" })}
          ${field("faucetWhole", "Demo faucet (NCN)", e.faucetWhole, { type: "number" })}
          ${field("maxNeighbourhoodBonus", "Max neighbourhood bonus", e.maxNeighbourhoodBonus, { type: "number", step: "0.01" })}
          ${field("unknownValueFloor", "Unknown pin value floor", e.unknownValueFloor, { type: "number" })}
          ${field("tollFloorNcn", "Toll floor (NCN)", e.tollFloorNcn, { type: "number" })}
          ${field("tollStakePct", "Toll % of owner stake", e.tollStakePct, { type: "number", step: "0.01" })}
          ${field("tollEscapePct", "Toll escape refund %", e.tollEscapePct, { type: "number", step: "0.01" })}
          ${field("tollCooldownMin", "Toll cooldown (min)", e.tollCooldownMin, { type: "number" })}
          ${field("walkKmh", "Walk speed (km/h)", e.walkKmh, { type: "number", step: "0.1" })}
          ${field("nearbyNotifyRadiusM", "Nearby notify radius (m)", e.nearbyNotifyRadiusM, { type: "number" })}
          ${field("approachRadiusM", "Approach radius (m)", e.approachRadiusM, { type: "number" })}
          ${field("arPinRangeM", "AR pin range (m)", e.arPinRangeM, { type: "number" })}
          ${field("buyMinNcn", "Buy min NCN", e.buyMinNcn, { type: "number" })}
          ${field("buyMaxNcn", "Buy max NCN", e.buyMaxNcn, { type: "number" })}
          ${field("buyPresets", "Buy presets (comma)", Array.isArray(e.buyPresets) ? e.buyPresets.join(",") : "5,10,25,50")}
          ${field("defaultBuyProvider", "Default buy provider", e.defaultBuyProvider || "paystack", {
            type: "select", options: ["paystack", "flutterwave"]
          })}
          ${field("ownedPinPoints", "Points per owned pin", e.ownedPinPoints, { type: "number" })}
          ${field("ncnPerUsd", "NCN per USD", e.ncnPerUsd, { type: "number" })}
          ${field("ngnPerUsd", "NGN per USD (display)", e.ngnPerUsd, { type: "number" })}
        </div>
        <div class="row">
          <button type="button" class="btn primary" id="saveEco">Save economy</button>
        </div>
      </div>`;
    $("saveEco").onclick = async function () {
      const raw = collect($("ecoForm"));
      const presets = String(raw.buyPresets || "").split(/[,\s]+/).map(Number).filter(function (n) { return n > 0; });
      const next = Object.assign({}, gameCfg, {
        economy: Object.assign({}, eco(), raw, { buyPresets: presets.length ? presets : [5, 10, 25, 50] }),
      });
      status("Saving…");
      const res = await api("/v1/admin/game-config", { method: "PUT", body: { config: next } });
      if (!res.data.ok) { status(res.data.error || "Save failed", false); return; }
      gameCfg = res.data.config;
      status("Economy saved", true);
    };
  }

  function renderClient() {
    const c = cli();
    const cp = copy();
    $("paneClient").innerHTML = `
      <div class="card" id="cliForm">
        <h2>Client &amp; Map</h2>
        <p class="hint">Public client defaults. Payment public keys still prefer live host values.</p>
        <div class="grid">
          ${field("saveApiBase", "Save API base", c.saveApiBase || "")}
          ${field("buyApiBase", "Buy API base (optional)", c.buyApiBase || "")}
          ${field("googleWebClientId", "Google Web client ID (client override)", c.googleWebClientId || "")}
          ${field("paystackPublicKey", "Paystack public (client override)", c.paystackPublicKey || "")}
          ${field("flwPublicKey", "Flutterwave public (client override)", c.flwPublicKey || "")}
          ${field("mapStyleUrl", "Map style URL", c.mapStyleUrl || "")}
          ${field("satDefaultOn", "SAT default on", !!c.satDefaultOn, { type: "checkbox" })}
          ${field("buyBlockerTitle", "Buy blocker title", cp.buyBlockerTitle || "")}
          ${field("oauthBlockerTitle", "OAuth blocker title", cp.oauthBlockerTitle || "")}
        </div>
        <div class="row">
          <button type="button" class="btn primary" id="saveCli">Save client</button>
        </div>
      </div>`;
    $("saveCli").onclick = async function () {
      const raw = collect($("cliForm"));
      const next = Object.assign({}, gameCfg, {
        client: Object.assign({}, cli(), {
          saveApiBase: raw.saveApiBase,
          buyApiBase: raw.buyApiBase,
          googleWebClientId: raw.googleWebClientId,
          paystackPublicKey: raw.paystackPublicKey,
          flwPublicKey: raw.flwPublicKey,
          mapStyleUrl: raw.mapStyleUrl,
          satDefaultOn: !!raw.satDefaultOn,
        }),
        copy: Object.assign({}, copy(), {
          buyBlockerTitle: raw.buyBlockerTitle,
          oauthBlockerTitle: raw.oauthBlockerTitle,
        }),
      });
      status("Saving…");
      const res = await api("/v1/admin/game-config", { method: "PUT", body: { config: next } });
      if (!res.data.ok) { status(res.data.error || "Save failed", false); return; }
      gameCfg = res.data.config;
      status("Client config saved", true);
    };
  }

  function renderFeatures() {
    const f = feat();
    $("paneFeatures").innerHTML = `
      <div class="card" id="featForm">
        <h2>Features</h2>
        <p class="hint">Toggles for client feature flags (soft UI gates).</p>
        <div class="grid">
          ${field("buyNcn", "Buy NCN", !!f.buyNcn, { type: "checkbox" })}
          ${field("flutterwave", "Flutterwave option", !!f.flutterwave, { type: "checkbox" })}
          ${field("opay", "Show OPay", !!f.opay, { type: "checkbox" })}
          ${field("p2p", "P2P Send NCN", !!f.p2p, { type: "checkbox" })}
          ${field("travelMode", "Travel mode", !!f.travelMode, { type: "checkbox" })}
          ${field("passToll", "Pass-by toll", !!f.passToll, { type: "checkbox" })}
          ${field("worldOverpass", "World Overpass catalog", !!f.worldOverpass, { type: "checkbox" })}
        </div>
        <div class="row">
          <button type="button" class="btn primary" id="saveFeat">Save features</button>
        </div>
      </div>`;
    $("saveFeat").onclick = async function () {
      const raw = collect($("featForm"));
      const next = Object.assign({}, gameCfg, { features: Object.assign({}, feat(), raw) });
      status("Saving…");
      const res = await api("/v1/admin/game-config", { method: "PUT", body: { config: next } });
      if (!res.data.ok) { status(res.data.error || "Save failed", false); return; }
      gameCfg = res.data.config;
      status("Features saved", true);
    };
  }

  function renderPlayers() {
    const rows = players.map(function (p) {
      return `<tr>
        <td><code>${esc(p.playerKey)}</code></td>
        <td>${esc(p.name || "—")}</td>
        <td>${esc(p.email || "—")}</td>
        <td>${esc(p.ncnWhole)} NCN</td>
        <td>${esc(String(p.updatedAt || "").slice(0, 19).replace("T", " "))}</td>
        <td><button type="button" class="btn ghost" data-credit="${esc(p.playerKey)}">Credit</button></td>
      </tr>`;
    }).join("");
    $("panePlayers").innerHTML = `
      <div class="card">
        <h2>Players</h2>
        <p class="hint">Cloud save packs on this host. Ops credit writes an idempotent purchase + ledger activity.</p>
        <div class="row">
          ${field("opsKey", "Player key", "", { placeholder: "g… or handle key" })}
          ${field("opsNcn", "NCN amount", "100", { type: "number" })}
          ${field("opsNote", "Note", "", { placeholder: "ops credit" })}
          <button type="button" class="btn primary" id="opsCredit">Credit NCN</button>
          <button type="button" class="btn ghost" id="refreshPlayers">Refresh</button>
        </div>
        <div style="overflow:auto;margin-top:12px">
          <table class="table">
            <thead><tr><th>Key</th><th>Name</th><th>Email</th><th>Balance</th><th>Updated</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" class="muted">No saves yet</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    $("refreshPlayers").onclick = async function () {
      const pl = await api("/v1/admin/players");
      players = (pl.data && pl.data.players) || [];
      renderPlayers();
    };
    $("opsCredit").onclick = function () { doCredit(); };
    $("panePlayers").querySelectorAll("[data-credit]").forEach(function (btn) {
      btn.onclick = function () {
        const key = btn.getAttribute("data-credit");
        const input = $("panePlayers").querySelector('[data-key="opsKey"]');
        if (input) input.value = key;
      };
    });
  }

  async function doCredit() {
    const root = $("panePlayers");
    const key = root.querySelector('[data-key="opsKey"]').value.trim();
    const ncn = Number(root.querySelector('[data-key="opsNcn"]').value);
    const note = root.querySelector('[data-key="opsNote"]').value.trim();
    if (!key || !(ncn > 0)) { status("Player key and NCN required", false); return; }
    status("Crediting…");
    const res = await api("/v1/admin/ops/credit", {
      method: "POST",
      body: { playerKey: key, ncnAmount: ncn, note: note },
    });
    if (!res.data.ok) { status(res.data.error || "Credit failed", false); return; }
    status("Credited " + ncn + " NCN to " + key, true);
    const pl = await api("/v1/admin/players");
    players = (pl.data && pl.data.players) || [];
    renderPlayers();
  }

  $("loginForm").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const btn = $("loginForm").querySelector('button[type="submit"]');
    $("loginErr").hidden = true;
    if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
    try {
      const res = await api("/v1/admin/login", {
        method: "POST",
        auth: false,
        body: {
          email: $("loginEmail").value.trim(),
          password: $("loginPass").value.trim(),
        },
      });
      if (!res.data.ok) {
        $("loginErr").hidden = false;
        $("loginErr").textContent = res.data.error || ("Sign in failed (" + res.status + ")");
        return;
      }
      csrf = res.data.csrf || "";
      // Enter dashboard immediately — do not wait on data fetches.
      showCms(res.data.email);
      const ok = await loadAll();
      if (!ok) {
        status("Signed in, but could not load dashboard data. Try refresh.", false);
      }
      switchTab("overview");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Sign in"; }
    }
  });

  $("btnLogout").onclick = async function () {
    await api("/v1/admin/logout", { method: "POST" });
    csrf = "";
    showLogin();
  };

  $("tabNav").addEventListener("click", function (ev) {
    const t = ev.target.closest(".tab");
    if (!t) return;
    switchTab(t.getAttribute("data-tab"));
  });

  (async function boot() {
    try {
      const me = await api("/v1/admin/me");
      // If user already signed in while /me was in flight, keep CMS.
      if (authed) return;
      if (me.data && me.data.ok) {
        csrf = me.data.csrf || "";
        showCms(me.data.email);
        await loadAll();
        switchTab("overview");
      } else if (!authed) {
        showLogin();
      }
    } finally {
      bootDone = true;
    }
  })();
})();
