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

  function V() {
    return global.LvfeVoice;
  }

  function empty(key, fallback) {
    const e = V() && V().EMPTY;
    return (e && e[key]) || fallback;
  }

  function hubHead(which) {
    const voice = V();
    if (!voice || !voice.hubBrief) return "";
    const b = voice.hubBrief(which);
    return voice.briefHead(b.head, b.status);
  }

  function walletHtml(ctx) {
    const c = ctx || {};
    const bal = Number(c.balance) || 0;
    const so = c.stakesOut || { total: 0, owned: 0, backed: 0, rows: [] };
    const activity = Array.isArray(c.activity) ? c.activity : [];
    const copy = (global.LvfeWalletEarn && global.LvfeWalletEarn.howEarnCopy()) || { short: "", long: "" };
    const tollCopy = (global.LvfePassToll && global.LvfePassToll.formulaCopy()) || null;
    const buyCfg = global.LvfeBuyNcnConfig;
    const buyReady = Boolean(global.LvfeBuyNcn && buyCfg && buyCfg.isConfigured && buyCfg.isConfigured());
    const psReady = Boolean(buyCfg && buyCfg.isPaystackConfigured && buyCfg.isPaystackConfigured());
    const flwReady = Boolean(buyCfg && buyCfg.isFlutterwaveConfigured && buyCfg.isFlutterwaveConfigured());
    const defaultProvider = psReady ? "paystack" : (flwReady ? "flutterwave" : "paystack");
    const presets = (buyCfg && buyCfg.PRESETS) || [5, 10, 25, 50];
    const watch = Array.isArray(c.watchList) ? c.watchList : [];
    const takeovers = Array.isArray(c.takeovers) ? c.takeovers : [];
    const bits = [
      `<div class="hub-pane" data-hub="wallet">`,
      hubHead("wallet"),
      `<p class="hub-bal">${ncn(bal)}</p>`,
      `<p class="hub-meta">Stakes out ${ncn(so.total)} · ${so.owned} owned · ${so.backed} backed</p>`,
      `<p class="hub-note">${esc(copy.short)}</p>`,
    ];
    if (tollCopy) {
      bits.push(`<p class="hub-meta">${esc(tollCopy.short)}</p>`);
    }
    bits.push(
      `<div class="hub-buy">`,
      `<h4>Buy NCN</h4>`,
      `<p class="hub-meta">1 NCN = USD $1 · fuel for Claim / Bid</p>`,
    );
    if (!buyReady) {
      bits.push(
        `<p class="hub-empty">${esc(empty("buyKeys", "Buy NCN isn’t available yet — try again later."))}</p>`
      );
      if (typeof global.lvfeDebug === "function" && global.lvfeDebug()) {
        bits.push(
          `<button type="button" class="hub-cta ghost" id="hubBuyBlocker"><span class="mark">!</span> Show setup steps</button>`
        );
      }
    } else {
      if (psReady || flwReady) {
        bits.push(`<div class="hub-buy-providers" role="radiogroup" aria-label="Checkout provider">`);
        if (psReady) {
          bits.push(
            `<label class="hub-buy-provider"><input type="radio" name="hubBuyProvider" value="paystack"` +
            (defaultProvider === "paystack" ? " checked" : "") +
            ` /> Paystack</label>`
          );
        }
        if (flwReady) {
          bits.push(
            `<label class="hub-buy-provider"><input type="radio" name="hubBuyProvider" value="flutterwave"` +
            (defaultProvider === "flutterwave" ? " checked" : "") +
            ` /> Flutterwave</label>`
          );
        }
        bits.push(`</div>`);
      }
      bits.push(`<div class="hub-buy-row">`);
      presets.forEach(function (p) {
        bits.push(`<button type="button" class="hub-cta ghost hub-buy-amt" data-buy-ncn="${p}">${p} NCN</button>`);
      });
      bits.push(
        `</div>`,
        `<label class="hub-buy-custom">Custom <input type="number" id="hubBuyCustom" min="1" max="500" step="1" value="10" inputmode="numeric" /></label>`,
        `<button type="button" class="hub-cta" id="hubBuyGo"><span class="mark">◎</span> Buy NCN</button>`
      );
      if (buyCfg.isTestKey && buyCfg.isTestKey(defaultProvider) && typeof global.lvfeDebug === "function" && global.lvfeDebug()) {
        bits.push(`<p class="hub-meta">Test checkout</p>`);
      }
    }
    bits.push(
      `</div>`,
      (global.LvfeP2pNcn && global.LvfeP2pNcn.formHtml) ? global.LvfeP2pNcn.formHtml() : "",
      `<button type="button" class="hub-cta" data-hub-tab="earn"><span class="mark">◎</span> Earn more</button>`,
      `<details class="hub-details"><summary>How it works</summary><p>${esc(copy.long)}</p></details>`,
      `<h4>Recent activity</h4>`
    );
    if (!activity.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noStakes", "No stakes yet — scout the map."))}</p>`);
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
    bits.push(`<h4>Watchlist</h4>`);
    if (!watch.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noWatch", "No assets marked — Watch from a place file."))}</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      watch.slice(0, 10).forEach(function (w) {
        bits.push(
          `<li><button type="button" class="hub-mission" data-open-place="${esc(w.placeId)}">` +
          `<strong>${esc(w.name || w.placeId)}</strong>` +
          `<span>watching` +
          (w.lastValue != null ? ` · ${ncn(w.lastValue)}` : "") +
          (w.lastOwnerName ? ` · ${esc(w.lastOwnerName)}` : "") +
          `</span></button></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`<h4>Takeover plan</h4>`);
    if (!takeovers.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noTakeover", "No takeover planned — Mark an enemy pin."))}</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      takeovers.slice(0, 10).forEach(function (t) {
        bits.push(
          `<li><button type="button" class="hub-mission" data-open-place="${esc(t.placeId)}" data-bid="1">` +
          `<strong>${esc(t.name || t.placeId)}</strong>` +
          `<span>${distLabel(t.dist)} · Bid` +
          (t.ownerName ? ` · ${esc(t.ownerName)}` : "") +
          `</span></button></li>`
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
      hubHead("earn"),
      `<p class="hub-note">Open assets and enemy holds near you. Check in for XP (you 100%, owner 20% referral).</p>`,
      `<button type="button" class="hub-cta ghost" data-hub-tab="wallet"><span class="mark">←</span> Back to Wallet</button>`,
    ];
    if (!list.length) {
      bits.push(
        `<p class="hub-empty">${esc(
          (ctx && ctx.noGps)
            ? empty("noMissionsGps", "GPS off — turn it on to list missions.")
            : empty("noMissions", "No ownable assets in range — keep walking.")
        )}</p>`
      );
    } else {
      bits.push(`<ul class="hub-list hub-missions">`);
      list.slice(0, 20).forEach(function (m) {
        const tag = m.overturn ? "Bid" : "Claim";
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
    const globalRows = Array.isArray(c.global) ? c.global : [];
    const factions = Array.isArray(c.factions) ? c.factions : [];
    const who = c.who || null;
    const Sig = global.LvfeRankSigils;
    const bits = [
      `<div class="hub-pane" data-hub="rankings">`,
      hubHead("rankings"),
      `<h4>Leaders (places × 10 + XP + 30-day check-ins × 5)</h4>`,
    ];
    if (!globalRows.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noLeaders", "Ledger quiet — first Claims write the rankings."))}</p>`);
    } else {
      bits.push(`<ol class="hub-rank">`);
      globalRows.slice(0, 15).forEach(function (r) {
        const meta = Sig ? Sig.compactMeta(r, { factionRank: r.rank }) : null;
        bits.push(
          `<li>` +
          (meta ? meta.html : `<span class="hub-pos">${r.rank}</span>`) +
          `<strong>${esc(r.playerName)}</strong>` +
          `<span>${r.placesClaimed != null ? r.placesClaimed : r.owned} places · ${r.totalXp != null ? r.totalXp : r.points || 0} XP · ${r.checkIns30d != null ? r.checkIns30d : 0} check-ins (30d) · score ${r.score != null ? r.score : ncn(r.staked)}` +
          (meta ? ` · ${esc(meta.tierLabel)}` : "") +
          `</span></li>`
        );
      });
      bits.push(`</ol>`);
    }
    bits.push(`<h4>Faction score</h4>`);
    if (!factions.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noFactions", "No faction pools yet — Claim under a colour."))}</p>`);
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
        `<p class="hub-note">Banner Lord <strong>${esc(who.leader.playerName)}</strong> · ${who.leader.points} pts · roles: Banner Lord / Vanguard / Kin</p>`,
        `<ol class="hub-rank">`
      );
      who.members.slice(0, 12).forEach(function (m) {
        const meta = Sig ? Sig.compactMeta(m, { factionRank: m.rank }) : null;
        bits.push(
          `<li>` +
          (meta ? meta.html : `<span class="hub-pos">${m.rank}</span>`) +
          `<strong>${esc(m.playerName)}</strong>` +
          `<span>${ncn(m.staked)} · ${m.owned} owned` +
          (meta ? ` · ${esc(meta.roleLabel)}` : "") +
          `</span></li>`
        );
      });
      bits.push(`</ol>`);
    }
    bits.push(
      `<details class="hub-details"><summary>How ranks work</summary>` +
      `<p>Rank score = places claimed × 10 + total XP + check-ins in the last 30 days × 5. Tie: most recent check-in. Sigils: Initiate → Scout → Pathfinder → Warden → Marshal → Sovereign. Unlocks: Scout bookmark, Pathfinder tips, Warden challenges, Marshal+ sponsorships. Faction roles: Banner Lord (#1), Vanguard (#2–3), Kin.</p></details>`,
      `</div>`
    );
    return bits.join("");
  }

  function analyticsHtml(ctx) {
    const c = ctx || {};
    const terr = Array.isArray(c.territory) ? c.territory : [];
    const claims = Array.isArray(c.claims) ? c.claims : [];
    const rivals = Array.isArray(c.rivals) ? c.rivals : [];
    const watch = Array.isArray(c.watchList) ? c.watchList : [];
    const threats = Array.isArray(c.threats) ? c.threats : [];
    const takeovers = Array.isArray(c.takeovers) ? c.takeovers : [];
    const prefs = c.prefs || {};
    const tollCopy = (global.LvfePassToll && global.LvfePassToll.formulaCopy()) || null;
    const bits = [
      `<div class="hub-pane" data-hub="analytics">`,
      hubHead("analytics"),
      `<h4>Territory control</h4>`,
    ];
    if (!terr.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noTerritory", "No neighbourhood stats yet — Claim to paint."))}</p>`);
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
      bits.push(`<p class="hub-empty">${esc(empty("noClaims", "No assets marked as yours — scout & Claim."))}</p>`);
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
    bits.push(`<h4>Watchlist</h4>`);
    if (!watch.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noWatch", "No assets marked — Watch from a place file."))}</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      watch.slice(0, 12).forEach(function (w) {
        bits.push(
          `<li><button type="button" class="hub-mission" data-open-place="${esc(w.placeId)}">` +
          `<strong>${esc(w.name || w.placeId)}</strong>` +
          `<span>value watch</span></button></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`<h4>Threats</h4>`);
    if (!threats.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noThreats", "No threats tagged — Mark rivals from Land."))}</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      threats.slice(0, 12).forEach(function (t) {
        bits.push(
          `<li><strong>${esc(t.name || t.playerId)}</strong>` +
          `<span>watching stakes</span></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`<h4>Takeover plan</h4>`);
    if (!takeovers.length) {
      bits.push(`<p class="hub-empty">${esc(empty("noTakeover", "None planned — Plan takeover on an enemy pin."))}</p>`);
    } else {
      bits.push(`<ul class="hub-list">`);
      takeovers.slice(0, 12).forEach(function (t) {
        bits.push(
          `<li><button type="button" class="hub-mission" data-open-place="${esc(t.placeId)}" data-bid="1">` +
          `<strong>${esc(t.name || t.placeId)}</strong>` +
          `<span>${distLabel(t.dist)} · Bid</span></button></li>`
        );
      });
      bits.push(`</ul>`);
    }
    bits.push(`<h4>Rival pressure nearby</h4>`);
    if (!rivals.length) {
      bits.push(
        `<p class="hub-empty">${esc(
          (c.noGps)
            ? empty("noRivalsGps", "GPS off — rivals only show on the street.")
            : empty("noRivals", "No rival-held assets nearby — keep scouting.")
        )}</p>`
      );
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
    if (tollCopy) {
      bits.push(
        `<h4>Pass-by toll</h4>`,
        `<p class="hub-note">${esc(tollCopy.short)}</p>`,
        `<details class="hub-details"><summary>How tolls work</summary>` +
        `<p>${esc(tollCopy.escape)} ${esc(tollCopy.empty)}</p></details>`
      );
    }
    bits.push(
      `<h4>Notifications</h4>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteAll" ${prefs.muted ? "checked" : ""}/> Mute all</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteClaims" ${prefs.allowClaims === false ? "checked" : ""}/> Mute claims</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteNearby" ${prefs.allowNearby === false ? "checked" : ""}/> Mute asset sightings</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteEnemy" ${prefs.allowEnemy === false ? "checked" : ""}/> Mute enemy assets</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteTrack" ${prefs.allowTrack === false ? "checked" : ""}/> Mute track / approach</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteWatch" ${prefs.allowWatch === false ? "checked" : ""}/> Mute watchlist</label>`,
      `<label class="hub-check"><input type="checkbox" id="hubMuteThreat" ${prefs.allowThreat === false ? "checked" : ""}/> Mute threats</label>`,
      `<button type="button" class="hub-cta ghost" id="hubTestNotify"><span class="mark">⌁</span> Test notification</button>`,
      (global.LvfePassToll && global.LvfePassToll.isEnabled && global.LvfePassToll.isEnabled()
        ? `<button type="button" class="hub-cta ghost" id="hubSimToll"><span class="mark">⌖</span> Simulate pass-by toll</button>`
        : ""),
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
