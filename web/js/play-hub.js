/* Play hub: Wallet / Earn / Rankings / Analytics panels (Nord glass). */
(function (global) {
  function esc(s) {
    if (global.LvfeRules && global.LvfeRules.esc) return global.LvfeRules.esc(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ncn(n) {
    const E = global.LvfeWalletEarn;
    if (E && E.ncn) return E.ncn(n);
    return Math.round(Number(n) || 0) + " NCN";
  }

  function distLabel(d) {
    if (!Number.isFinite(d)) return "";
    if (d < 1000) return Math.round(d) + " m";
    return (d / 1000).toFixed(1) + " km";
  }

  function walletHtml(ctx) {
    const c = ctx || {};
    const bal = Number(c.balance) || 0;
    const so = c.stakesOut || { total: 0, owned: 0, backed: 0, rows: [] };
    const activity = Array.isArray(c.activity) ? c.activity : [];
    const copy = (global.LvfeWalletEarn && global.LvfeWalletEarn.howEarnCopy()) || { short: "", long: "" };
    const bits = [
      `<div class="hub-pane" data-hub="wallet">`,
      `<p class="hub-bal">${ncn(bal)}</p>`,
      `<p class="hub-meta">Stakes out ${ncn(so.total)} · ${so.owned} owned · ${so.backed} backed</p>`,
      `<p class="hub-note">${esc(copy.short)}</p>`,
      `<button type="button" class="hub-cta" data-hub-tab="earn"><span class="mark">◎</span> Earn more</button>`,
      `<details class="hub-details"><summary>How the system works</summary><p>${esc(copy.long)}</p></details>`,
      `<h4>Recent activity</h4>`,
    ];
    if (!activity.length) {
      bits.push(`<p class="hub-empty">No stakes yet on this phone.</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      activity.slice(0, 12).forEach(function (a) {
        bits.push(
          `<li><strong>${esc(a.text || a.kind || "update")}</strong>` +
          (a.amount != null ? ` · ${ncn(a.amount)}` : "") +
          (a.at ? `<span class="hub-time">${esc(String(a.at).slice(0, 16).replace("T", " "))}</span>` : "") +
          `</li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`</div>`);
    return bits.join("");
  }

  function earnHtml(missions, ctx) {
    const list = Array.isArray(missions) ? missions : [];
    const bits = [
      `<div class="hub-pane" data-hub="earn">`,
      `<p class="hub-note">Claimable and contestable places near you. Estimated visit yield uses the 10% owner rule.</p>`,
      `<button type="button" class="hub-cta ghost" data-hub-tab="wallet"><span class="mark">←</span> Back to Wallet</button>`,
    ];
    if (!list.length) {
      bits.push(`<p class="hub-empty">${(ctx && ctx.noGps) ? "Turn on GPS to list missions near you." : "No ownable places in range."}</p>`);
    } else {
      bits.push(`<ul class="hub-list hub-missions">`);
      list.slice(0, 20).forEach(function (m) {
        const tag = m.overturn ? "Bid to overturn" : "Claim";
        bits.push(
          `<li>` +
          `<button type="button" class="hub-mission" data-open-place="${esc(m.placeId)}" data-bid="${m.overturn ? "1" : "0"}">` +
          `<strong>${esc(m.name)}</strong>` +
          `<span>${distLabel(m.dist)} · ${tag} · cost ${ncn(m.cost)}` +
          (m.estOwnerEarnOnVisit ? ` · earn ~${ncn(m.estOwnerEarnOnVisit)} / visit` : "") +
          `</span></button></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`</div>`);
    return bits.join("");
  }

  function rankingsHtml(ctx) {
    const c = ctx || {};
    const global = Array.isArray(c.global) ? c.global : [];
    const factions = Array.isArray(c.factions) ? c.factions : [];
    const who = c.who || null;
    const bits = [
      `<div class="hub-pane" data-hub="rankings">`,
      `<h4>Leaders by NCN staked</h4>`,
    ];
    if (!global.length) {
      bits.push(`<p class="hub-empty">No stakes on the ledger yet.</p>`);
    } else {
      bits.push(`<ol class="hub-rank">`);
      global.slice(0, 15).forEach(function (r) {
        bits.push(
          `<li><span class="hub-pos">${r.rank}</span>` +
          `<strong>${esc(r.playerName)}</strong>` +
          `<span>${ncn(r.staked)} · ${r.owned} places</span></li>`
        );
      });
      bits.push(`</ol>`);
    }
    bits.push(`<h4>Faction score</h4>`);
    if (!factions.length) {
      bits.push(`<p class="hub-empty">No faction pools yet.</p>`);
    } else {
      bits.push(`<ol class="hub-rank">`);
      factions.forEach(function (f) {
        bits.push(
          `<li><span class="hub-pos">${f.rank}</span>` +
          `<strong>${esc(f.name)}</strong>` +
          `<span>${f.score} pts · pool ${ncn(f.pool)} · ${f.owned} owned</span></li>`
        );
      });
      bits.push(`</ol>`);
    }
    if (who && who.leader) {
      bits.push(
        `<h4>Your faction who’s who</h4>`,
        `<p class="hub-note">Leader <strong>${esc(who.leader.playerName)}</strong> · ${who.leader.points} pts</p>`,
        `<ol class="hub-rank">`
      );
      who.members.slice(0, 12).forEach(function (m) {
        bits.push(
          `<li><span class="hub-pos">${m.rank}</span>` +
          `<strong>${esc(m.playerName)}</strong>` +
          `<span>${ncn(m.staked)} · ${m.owned} owned</span></li>`
        );
      });
      bits.push(`</ol>`);
    }
    bits.push(`</div>`);
    return bits.join("");
  }

  function analyticsHtml(ctx) {
    const c = ctx || {};
    const terr = Array.isArray(c.territory) ? c.territory : [];
    const claims = Array.isArray(c.claims) ? c.claims : [];
    const rivals = Array.isArray(c.rivals) ? c.rivals : [];
    const prefs = c.prefs || {};
    const bits = [
      `<div class="hub-pane" data-hub="analytics">`,
      `<h4>Territory control</h4>`,
    ];
    if (!terr.length) {
      bits.push(`<p class="hub-empty">No neighbourhood stats yet.</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      terr.filter(function (t) { return t.territoryId !== "unclaimed"; }).slice(0, 12).forEach(function (t) {
        const pct = t.total ? Math.round((t.owned / t.total) * 100) : 0;
        bits.push(
          `<li><strong>${esc(t.name)}</strong>` +
          `<span>${t.owned}/${t.total} owned (${pct}%)</span></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`<h4>Your claims</h4>`);
    if (!claims.length) {
      bits.push(`<p class="hub-empty">None yet.</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      claims.slice(0, 15).forEach(function (r) {
        bits.push(
          `<li><button type="button" class="hub-mission" data-open-place="${esc(r.placeId)}">` +
          `<strong>${esc(r.name)}</strong>` +
          `<span>${r.owned ? "owner" : "backed"} · ${ncn(r.amount)}</span></button></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`<h4>Rival pressure nearby</h4>`);
    if (!rivals.length) {
      bits.push(`<p class="hub-empty">${(c.noGps) ? "GPS off." : "No rival-owned places nearby."}</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      rivals.slice(0, 12).forEach(function (r) {
        bits.push(
          `<li><button type="button" class="hub-mission" data-open-place="${esc(r.placeId)}" data-bid="1">` +
          `<strong>${esc(r.name)}</strong>` +
          `<span>${distLabel(r.dist)} · ${esc(r.ownerName)} · ${ncn(r.value)}</span></button></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(
      `<h4>Notifications</h4>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteAll" ${prefs.muted ? "checked" : ""}/> Mute all</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteClaims" ${prefs.allowClaims === false ? "checked" : ""}/> Mute claims</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteNearby" ${prefs.allowNearby === false ? "checked" : ""}/> Mute nearby opens</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteEnemy" ${prefs.allowEnemy === false ? "checked" : ""}/> Mute enemy assets</label>`,
      `<button type="button" class="hub-cta ghost" id="hubTestNotify"><span class="mark">⌁</span> Test notification</button>`,
      `</div>`
    );
    return bits.join("");
  }

  global.LvfePlayHub = {
    walletHtml: walletHtml,
    earnHtml: earnHtml,
    rankingsHtml: rankingsHtml,
    analyticsHtml: analyticsHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
