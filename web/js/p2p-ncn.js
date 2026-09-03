/* P2P NCN transfer: debit sender, credit receiver (server-authoritative when cloud). */
(function (global) {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function authHeader(playerKey) {
    const Sync = global.LvfeSaveSync;
    if (Sync && typeof Sync.authHeader === "function") {
      try { return Sync.authHeader(playerKey); } catch (err) { /* */ }
    }
    const prefix = (global.LvfeSaveApiConfig && global.LvfeSaveApiConfig.DEV_AUTH_PREFIX) || "lvfe-dev:";
    return "Bearer " + prefix + String(playerKey || "default").slice(0, 32);
  }

  function saveBase() {
    const C = global.LvfeSaveApiConfig;
    return (C && C.resolveBase && C.resolveBase()) || "";
  }

  function localDebitCredit(fromPk, toPk, amount) {
    const W = global.LvfeCatalogWallet || global.NairaCoinIou;
    if (!W || !W.debitWhole || !W.creditWhole) {
      return { ok: false, error: "Wallet unavailable" };
    }
    const n = Math.floor(Number(amount));
    if (!(n > 0)) return { ok: false, error: "Amount must be at least 1 NCN" };
    const bal = typeof W.getBalance === "function" ? W.getBalance(fromPk) : 0;
    if (bal < n) return { ok: false, error: "Not enough NCN" };
    const deb = W.debitWhole(fromPk, n);
    if (deb === false || (deb && deb.ok === false)) {
      return { ok: false, error: "Couldn't debit wallet" };
    }
    W.creditWhole(toPk, n);
    const Earn = global.LvfeWalletEarn;
    if (Earn && Earn.appendActivity) {
      Earn.appendActivity({
        kind: "p2p_send",
        text: "Sent " + n + " NCN to " + toPk,
        amount: -n,
        to: toPk,
      });
      /* Receiver activity only if same device storage (rare). */
    }
    return { ok: true, ncnAmount: n, to: toPk, local: true };
  }

  async function transfer(opts) {
    const o = opts || {};
    const fromPk = String(o.fromPlayerKey || o.playerKey || "").slice(0, 32);
    const toRaw = String(o.to || o.toUsername || o.toPlayerKey || "").trim();
    const amount = Math.floor(Number(o.amount));
    if (!fromPk) return { ok: false, error: "Sign in required" };
    if (!toRaw) return { ok: false, error: "Enter a handle or player id" };
    if (!(amount > 0)) return { ok: false, error: "Amount must be at least 1 NCN" };
    if (toRaw === fromPk) return { ok: false, error: "Can't send to yourself" };

    const base = saveBase();
    if (base) {
      try {
        const url = base.replace(/\/+$/, "") + "/v1/p2p/transfer";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(fromPk),
            "X-Lvfe-Player-Key": fromPk,
          },
          body: JSON.stringify({
            fromPlayerKey: fromPk,
            to: toRaw,
            ncnAmount: amount,
          }),
        });
        const json = await resp.json().catch(function () { return null; });
        if (json && json.ok) {
          /* Mirror local debit/credit to match cloud. */
          const W = global.LvfeCatalogWallet || global.NairaCoinIou;
          const toPk = String(json.toPlayerKey || toRaw).slice(0, 32);
          if (W && W.debitWhole && W.creditWhole) {
            try {
              W.debitWhole(fromPk, amount);
              W.creditWhole(toPk, amount);
            } catch (err) { /* cloud won */ }
          }
          const Earn = global.LvfeWalletEarn;
          if (Earn && Earn.appendActivity) {
            Earn.appendActivity({
              kind: "p2p_send",
              text: "Sent " + amount + " NCN to " + (json.toName || toPk),
              amount: -amount,
              to: toPk,
              ref: json.ref || "",
            });
          }
          return json;
        }
        if (json && json.code === "receiver_offline") {
          /* Fall soft: local-only if both packs not on server */
          return Object.assign({ ok: false }, json);
        }
        if (json) return json;
        return { ok: false, error: "Transfer failed (" + resp.status + ")" };
      } catch (err) {
        return { ok: false, error: "Couldn't reach cloud — try again" };
      }
    }
    return localDebitCredit(fromPk, toRaw, amount);
  }

  function formHtml() {
    return [
      `<div class="hub-p2p">`,
      `<h4>Send NCN</h4>`,
      `<p class="hub-meta">Send to another handle (or signed-in id). Debits you, credits them.</p>`,
      `<label class="hub-buy-custom">To <input type="text" id="hubP2pTo" maxlength="32" placeholder="handle" autocomplete="off" /></label>`,
      `<label class="hub-buy-custom">Amount <input type="number" id="hubP2pAmt" min="1" step="1" value="10" inputmode="numeric" /></label>`,
      `<button type="button" class="hub-cta" id="hubP2pGo"><span class="mark">→</span> Send NCN</button>`,
      `</div>`,
    ].join("");
  }

  global.LvfeP2pNcn = {
    transfer: transfer,
    formHtml: formHtml,
    esc: esc,
  };
})(typeof window !== "undefined" ? window : globalThis);
