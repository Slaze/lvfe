/* Shared place file (dossier). Map pin tap and catalog must render the same tabs. */
(function (global) {
  const TABS = ["place", "mission", "land", "money", "wallet"];
  const TAB_LABELS = {
    place: "Place",
    mission: "Mission",
    land: "Land",
    money: "Money",
    wallet: "Wallet",
  };
  const FACTION_NAMES = {
    independence_layout: "Independence Layout",
    coal_camp: "Coal Camp",
    abakpa: "Abakpa",
    emene: "Emene",
  };

  function R() {
    return global.LvfeRules;
  }

  function esc(s) {
    return R().esc(s);
  }

  function claimRadius() {
    return R().CLAIM_RADIUS_M;
  }

  function distOk(userPos, dist) {
    return Boolean(userPos) && Number.isFinite(dist) && dist <= claimRadius();
  }

  function ownerWords(rec) {
    if (!rec || !rec.ownerId) return R().noOwnerYet();
    return R().wordOr(rec.ownerName, R().noOwnerYet());
  }

  function landSide(rec) {
    if (rec && rec.factionId && FACTION_NAMES[rec.factionId]) return FACTION_NAMES[rec.factionId];
    return "Unclaimed";
  }

  function conqueredText(rec) {
    if (rec && rec.ownerId && rec.factionId && FACTION_NAMES[rec.factionId]) {
      return "Conquered by " + FACTION_NAMES[rec.factionId];
    }
    if (rec && rec.ownerId) return "Owned · not conquered";
    return "Not conquered";
  }

  function photoLine(p, rec) {
    const has = Boolean((rec && rec.hasPhoto) || (p && (Number(p.has_photo) || p.quality === "A")));
    if (has) return "Has a visit photo";
    if (p && (p.image || p.wikimedia_commons || p.mapillary || p.wikipedia)) {
      return "Looking up place…";
    }
    return "No photo yet — visit to confirm";
  }

  function placeCoords(p, opts) {
    let lat = Number(opts && opts.lat != null ? opts.lat : (p && p.lat));
    let lon = Number(opts && opts.lon != null ? opts.lon : (p && (p.lon != null ? p.lon : p.lng)));
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && p && p.geometry && p.geometry.coordinates) {
      lon = Number(p.geometry.coordinates[0]);
      lat = Number(p.geometry.coordinates[1]);
    }
    return { lat: lat, lon: lon };
  }

  function photoBlock(p, rec, opts) {
    const c = placeCoords(p, opts);
    const title = R().placeTitle(p);
    const latAttr = Number.isFinite(c.lat) ? String(c.lat) : "";
    const lonAttr = Number.isFinite(c.lon) ? String(c.lon) : "";
    const idAttr = p && p.id != null ? String(p.id) : "";
    return `<div class="dossier-photo" data-place-id="${esc(idAttr)}" data-lat="${esc(latAttr)}" data-lon="${esc(lonAttr)}" data-title="${esc(title)}">` +
      `<span class="dossier-photo-ph">${esc(photoLine(p, rec))}</span></div>`;
  }

  function formatDist(dist) {
    const rules = R();
    if (rules && typeof rules.formatDistM === "function") return rules.formatDistM(dist);
    const n = Number(dist);
    if (!Number.isFinite(n) || n < 0 || n === Infinity) return "—";
    if (n >= 1000) return (Math.round(n / 100) / 10) + " km";
    return Math.round(n) + " m";
  }

  function walkEtaFor(p, dist, opts) {
    const rules = R();
    const T = global.LvfeTrack;
    if (T && p && p.id && T.isTracking(p.id) && typeof T.walkParts === "function") {
      const w = T.walkParts();
      if (w && Number.isFinite(w.routeDist)) {
        return rules.walkEtaText(w.routeDist, w.mins);
      }
    }
    if (!Number.isFinite(dist) || dist === Infinity) return "GPS for ETA";
    return rules.walkEtaText(dist);
  }

  function factionNameMap(opts) {
    const out = Object.assign({}, FACTION_NAMES);
    const extra = (opts && opts.factionNames) || {};
    Object.keys(extra).forEach(function (k) {
      if (extra[k]) out[k] = extra[k];
    });
    return out;
  }

  function listFeatures(opts) {
    const f = opts && opts.features;
    if (!f) return [];
    if (Array.isArray(f.features)) return f.features;
    if (Array.isArray(f)) return f;
    return [];
  }

  function placeLedger(opts) {
    return (opts && opts.places && typeof opts.places === "object") ? opts.places : {};
  }

  function playerFactionId(opts, playerKey) {
    if (opts && opts.factionId) return String(opts.factionId);
    const idn = opts && opts.identity;
    if (idn && idn.factionId) return String(idn.factionId);
    try {
      const raw = typeof localStorage !== "undefined"
        ? localStorage.getItem("lvfe.identity." + (playerKey || "default"))
        : null;
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.factionId) return String(o.factionId);
      }
    } catch (err) { /* */ }
    return "";
  }

  /** Counts for Mission briefing: faction stock + owned in/out of faction regions. */
  function missionFactionStats(playerKey, opts) {
    const names = factionNameMap(opts);
    const regionIds = Object.keys(names);
    const regionSet = {};
    regionIds.forEach(function (id) { regionSet[id] = true; });
    const fid = playerFactionId(opts, playerKey);
    const all = placeLedger(opts);
    const feats = listFeatures(opts);
    let inFaction = 0;
    let ownedIn = 0;
    let ownedOut = 0;
    const active = {};
    for (let i = 0; i < feats.length; i++) {
      const row = feats[i];
      const p = row && row.properties ? row.properties : row;
      if (!p || !p.id) continue;
      if (!R().isOwnable(p)) continue;
      const tid = String(p.territory_id || "");
      if (fid && tid === fid) inFaction += 1;
      const rec = all[p.id];
      if (rec && rec.ownerId === playerKey) {
        if (tid && regionSet[tid]) ownedIn += 1;
        else ownedOut += 1;
      }
      if (rec && rec.ownerId && rec.factionId) active[rec.factionId] = true;
    }
    /* Fallback when features not passed: scan ledger only for owned counts. */
    if (!feats.length) {
      Object.keys(all).forEach(function (id) {
        const rec = all[id];
        if (!rec || rec.ownerId !== playerKey) return;
        ownedOut += 1;
        if (rec.factionId) active[rec.factionId] = true;
      });
    }
    const activeList = Object.keys(active).map(function (id) {
      return names[id] || id;
    }).sort();
    return {
      factionId: fid,
      factionName: (fid && names[fid]) || (fid || "None"),
      inFaction: inFaction,
      ownedIn: ownedIn,
      ownedOut: ownedOut,
      activeCount: activeList.length,
      activeList: activeList,
    };
  }

  function missionRankLine(playerKey, opts) {
    const Rank = global.LvfeRankings;
    const Sigil = global.LvfeRankSigils;
    const places = placeLedger(opts);
    const idOpts = { identities: (opts && opts.identities) || undefined };
    const fid = playerFactionId(opts, playerKey);
    let staked = 0;
    let owned = 0;
    if (Rank && typeof Rank.playerStats === "function") {
      const stats = Rank.playerStats(places, idOpts);
      const me = stats[playerKey];
      if (me) {
        staked = Number(me.staked) || 0;
        owned = Number(me.owned) || 0;
      }
    }
    const pts = Sigil
      ? Sigil.pointsFrom({ staked: staked, owned: owned })
      : staked + owned * 10;
    const tier = Sigil ? Sigil.tierForPoints(pts) : { label: "Initiate" };
    let gamePos = 0;
    let facPos = 0;
    let roleLabel = "";
    if (Rank && typeof Rank.globalLeaders === "function") {
      const g = Rank.globalLeaders(places, Object.assign({}, idOpts, { metric: "staked" }));
      for (let i = 0; i < g.length; i++) {
        if (g[i].playerKey === playerKey) {
          gamePos = g[i].rank || (i + 1);
          break;
        }
      }
    }
    if (fid && Rank && typeof Rank.factionWhoIsWho === "function") {
      const who = Rank.factionWhoIsWho(fid, places, idOpts);
      const members = (who && who.members) || [];
      for (let i = 0; i < members.length; i++) {
        if (members[i].playerKey === playerKey) {
          facPos = members[i].rank || (i + 1);
          break;
        }
      }
      if (Sigil && facPos) {
        roleLabel = Sigil.roleForFactionRank(facPos).label;
      }
    }
    const hier = facPos || "—";
    const game = gamePos || "—";
    const fac = facPos || "—";
    const rankName = roleLabel && roleLabel !== "Kin"
      ? (tier.label + " · " + roleLabel)
      : tier.label;
    return {
      text: rankName + " · hierarchy #" + hier + " · game #" + game + " · faction #" + fac,
      tierLabel: tier.label,
      roleLabel: roleLabel,
      points: pts,
      gamePos: gamePos,
      facPos: facPos,
    };
  }

  function missionCostBits(p, rec, playerKey, counts) {
    const rules = R();
    if (!rules.isOwnable(p)) {
      return { amount: 0, label: "Cannot be owned", overturn: false };
    }
    const need = minNeed(p, rec, playerKey, counts);
    const coin = rules.ncn ? rules.ncn(need.min) : (need.min + " NCN");
    if (rec && rec.ownerId === playerKey) {
      const C = global.LvfeConquest;
      const v = C ? C.displayValue(rec, p, counts) : (Number(rec.value) || 0);
      return {
        amount: need.min,
        label: (rules.ncn ? rules.ncn(v) : (v + " NCN")) + " · yours",
        overturn: false,
        yours: true,
      };
    }
    if (need.overturn) {
      return { amount: need.min, label: coin + " to overturn", overturn: true };
    }
    return { amount: need.min, label: coin, overturn: false };
  }

  function missionCopy(p, rec, dist, ok, userPos, playerKey) {
    const rules = R();
    if (!rules.isOwnable(p)) return rules.farmMsg();
    if (!userPos) return "Lock GPS, then walk in — 80 m to buy.";
    if (!ok) return "Out of range. Start tracking — gold/green line guides you in.";
    const pk = playerKey || (global.LvfeCatalogWallet && global.LvfeCatalogWallet.playerKey()) || "default";
    if (rec && rec.ownerId && rec.ownerId !== pk) {
      return "Enemy-held. Buy to bid past their stake — highest NCN owns.";
    }
    if (optsPhotoRequired(p, rec)) return "In range. Snap a photo, then Buy.";
    return "In range. Buy to back this asset.";
  }

  function optsPhotoRequired(p, rec) {
    if (!R().isOwnable(p)) return false;
    const pk = (global.LvfeCatalogWallet && global.LvfeCatalogWallet.playerKey()) || "default";
    const mine = rec && rec.stakes && rec.stakes[pk];
    if (mine && mine.photo) return false;
    return true;
  }

  function conquestCounts(opts) {
    const C = global.LvfeConquest;
    if (!C) return { byId: {}, max: 0 };
    if (opts && opts.conquest) return opts.conquest;
    return C.get();
  }

  function minNeed(p, rec, playerKey, counts) {
    const W = global.LvfeCatalogWallet;
    const t = p && p.catalog_type;
    const pts = p && (p.claim_points != null ? p.claim_points : p.claim_nairacoin);
    let min = W ? W.minStake(pts, t) : Math.max(5, Number(pts) || 5);
    const C = global.LvfeConquest;
    if (C && min > 0) min = C.costToBack(min, p, counts);
    const mine = rec && rec.stakes && rec.stakes[playerKey];
    const first = !(mine && mine.amount > 0);
    const Earn = global.LvfeWalletEarn;
    let add = first ? min : 1;
    let overturn = false;
    let ownerStake = 0;
    if (Earn && typeof Earn.bidToOwn === "function") {
      const bid = Earn.bidToOwn(rec, playerKey, min);
      add = bid.add;
      overturn = Boolean(bid.overturn);
      ownerStake = Number(bid.ownerStake) || 0;
    } else if (rec && rec.ownerId && rec.ownerId !== playerKey) {
      ownerStake = Number(rec.stakes[rec.ownerId] && rec.stakes[rec.ownerId].amount) || 0;
      const mineAmt = Number(mine && mine.amount) || 0;
      add = Math.max(first ? min : 1, ownerStake + 1 - mineAmt);
      overturn = true;
    }
    return {
      min: add,
      first: first,
      mine: mine,
      needPhoto: optsPhotoRequired(p, rec),
      overturn: overturn,
      ownerStake: ownerStake,
    };
  }

  function V() {
    return global.LvfeVoice;
  }

  function marksActionsHtml(p, rec, playerKey, opts) {
    const M = global.LvfeGameMarks;
    if (!M || !p || !p.id) return "";
    const watching = M.isWatchingPlace(p.id);
    const planned = M.isTakeover(p.id);
    const ownerId = rec && rec.ownerId ? String(rec.ownerId) : "";
    const threatOn = ownerId && ownerId !== playerKey && M.isThreat(ownerId);
    const cta = (V() && V().CTA) || {};
    const bits = [`<p class="row-label">Marks</p><div class="mark-acts">`];
    bits.push(
      `<button type="button" class="sw-ctl ghost mark-btn" data-mark-watch="${esc(p.id)}" aria-pressed="${watching ? "true" : "false"}">` +
      `<span class="sw-ctl-name">${watching ? "Unwatch" : (cta.watch || "Watch")}</span></button>`
    );
    if (ownerId && ownerId !== playerKey) {
      bits.push(
        `<button type="button" class="sw-ctl ghost mark-btn" data-mark-threat="${esc(ownerId)}" data-threat-name="${esc(ownerWords(rec))}" aria-pressed="${threatOn ? "true" : "false"}">` +
        `<span class="sw-ctl-name">${threatOn ? "Clear threat" : "Mark threat"}</span></button>`,
        `<button type="button" class="sw-ctl ghost mark-btn" data-mark-takeover="${esc(p.id)}" aria-pressed="${planned ? "true" : "false"}">` +
        `<span class="sw-ctl-name">${planned ? "Drop takeover" : (cta.takeover || "Plan takeover")}</span></button>`
      );
    }
    bits.push(`</div>`);
    const Toll = global.LvfePassToll;
    if (Toll && Toll.formulaCopy && ownerId && ownerId !== playerKey) {
      const copy = Toll.formulaCopy();
      bits.push(`<p class="note">${esc(copy.short)}</p>`);
    }
    return bits.join("");
  }

  function moneyValue(rec, p, counts) {
    if (!R().isOwnable(p)) return "Cannot be owned";
    const C = global.LvfeConquest;
    const ledger = rec ? Number(rec.value) || 0 : 0;
    const v = C ? C.displayValue(rec, p, counts) : ledger;
    const coin = R().ncn ? R().ncn(v) : (v + " NCN");
    if (v > 0 && ledger <= 0) return coin + " · no one has backed this yet";
    return v > 0 ? coin : "No one has backed this yet";
  }

  function moneyInterest(p, rec, playerKey, counts) {
    if (!R().isOwnable(p)) return "";
    const W = global.LvfeCatalogWallet;
    const L = global.LvfePlaceLedger;
    const pts = p && (p.claim_points != null ? p.claim_points : p.claim_nairacoin);
    let min = W ? W.minStake(pts, p.catalog_type) : 5;
    const C = global.LvfeConquest;
    if (C && min > 0) min = C.costToBack(min, p, counts);
    const n = L ? L.yieldFromIncoming(min) : Math.max(1, Math.round(min * 0.1));
    const who = rec && rec.ownerId === playerKey ? "You earn" : "Owner earns";
    const coin = R().ncn ? R().ncn(n) : (n + " NCN");
    return who + " " + coin + " from visits when someone else backs (10% of what they put in).";
  }

  /** Claim / Bid gated button. Disabled unless GPS and dist <= 80. */
  function payHtml(p, rec, ok, playerKey, counts) {
    const cta = (V() && V().CTA) || {};
    if (!R().isOwnable(p)) {
      return `<button type="button" class="claim" disabled>Cannot be owned</button>`;
    }
    if (!ok) {
      return `<button type="button" class="claim" data-walk-closer="${esc(p.id)}">${cta.track || "Track"}</button>` +
        `<p class="note pay-wait">Approaching claim zone — walk within 80 m, then Claim.</p>`;
    }
    const need = minNeed(p, rec, playerKey, counts);
    const label = need.overturn ? (cta.bid || "Bid") : (cta.claim || "Claim");
    const bits = [`<form class="visit-form" data-place="${esc(p.id)}" data-kind="stake">`];
    if (need.overturn) {
      const coin = R().ncn ? R().ncn(need.min) : (need.min + " NCN");
      bits.push(`<p class="note">Bid at least ${coin} to beat ${esc(ownerWords(rec))} (${need.ownerStake} NCN).</p>`);
    }
    if (need.needPhoto) {
      bits.push(`<input type="file" accept="image/*" capture="environment" class="photo-in" name="photo" />`);
    } else if (need.mine && need.mine.photo) {
      bits.push(`<span class="meta">Photo already in</span>`);
    }
    bits.push(
      `<div class="stake-row">` +
      `<input type="number" name="amount" min="${need.min}" step="1" value="${need.min}" />` +
      `<button type="submit" class="claim" data-pay="1">${label}</button>` +
      `</div></form>`
    );
    return bits.join("");
  }

  function missionActsHtml(p, rec, ok, playerKey, counts, tracking) {
    if (!R().isOwnable(p)) {
      return `<button type="button" class="claim" disabled>Cannot be owned</button>`;
    }
    const cost = missionCostBits(p, rec, playerKey, counts);
    const buyLabel = cost.yours ? "Top up" : (cost.overturn ? "Bid" : "Buy");
    const bits = [`<div class="mission-acts">`];
    bits.push(
      `<button type="button" class="claim mission-buy" data-mission-buy="${esc(p.id)}">${esc(buyLabel)}</button>`
    );
    if (!tracking) {
      bits.push(
        `<button type="button" class="claim ghost mission-track" data-mission-track="${esc(p.id)}">Start tracking</button>`
      );
    } else {
      bits.push(
        `<button type="button" class="claim ghost mission-track" data-mission-track="${esc(p.id)}" aria-pressed="true">Tracking</button>`
      );
    }
    bits.push(`</div>`);
    if (!ok) {
      bits.push(`<p class="note pay-wait">Out of range — Start tracking for the green walk line, then Buy inside 80 m.</p>`);
    }
    return bits.join("");
  }

  function missionCta(p, rec, ok, playerKey, counts) {
    return missionActsHtml(p, rec, ok, playerKey, counts, false);
  }

  function missionBriefHtml(p, rec, dist, ok, userPos, playerKey, counts, opts) {
    const rules = R();
    const title = rules.placeTitle(p);
    const tracking = Boolean(opts && opts.tracking);
    const ownable = rules.isOwnable(p);
    const cost = missionCostBits(p, rec, playerKey, counts);
    const fac = missionFactionStats(playerKey, opts);
    const rank = missionRankLine(playerKey, opts);
    const distTxt = userPos && Number.isFinite(dist) && dist !== Infinity
      ? (formatDist(dist) + " · ~" + walkEtaFor(p, dist, opts).replace(/ walk$/i, " walk"))
      : "Need GPS";
    const activeTxt = fac.activeCount
      ? (fac.activeCount + (fac.activeList.length && fac.activeList.length <= 3
        ? " · " + fac.activeList.join(", ")
        : " active"))
      : "None yet";
    const bits = [
      `<div class="mission-brief">`,
      `<p class="mission-kicker">Property Asset sighted !!!</p>`,
      `<p class="row-label">Name</p>`,
      `<p class="row-value mission-name" title="${esc(title)}">${esc(title)}</p>`,
      `<p class="row-label">Distance</p>`,
      `<p class="row-value">${esc(distTxt)}</p>`,
      `<p class="row-label">Cost of Property</p>`,
      `<p class="row-value">${esc(ownable ? cost.label : "Cannot be owned")}</p>`,
      missionActsHtml(p, rec, ok, playerKey, counts, tracking),
      `<button type="button" class="mission-stat" data-mission-faction="${esc(fac.factionId || "")}">`,
      `<div class="mission-row"><span class="row-label">No of Properties in Faction</span><span class="row-value">${fac.inFaction}</span></div>`,
      `<div class="mission-row"><span class="row-label">Owned in Faction regions</span><span class="row-value">${fac.ownedIn}</span></div>`,
      `<div class="mission-row"><span class="row-label">Owned outside Faction regions</span><span class="row-value">${fac.ownedOut}</span></div>`,
      `<div class="mission-row"><span class="row-label">Active Factions</span><span class="row-value">${esc(activeTxt)}</span></div>`,
      `</button>`,
      `<button type="button" class="mission-stat mission-rank" data-mission-rank="1">`,
      `<div class="mission-row"><span class="row-label">Current rank</span><span class="row-value">${esc(rank.text)}</span></div>`,
      `</button>`,
      `<p class="note mission-tip">${esc(missionCopy(p, rec, dist, ok, userPos, playerKey))}</p>`,
      `</div>`,
    ];
    return bits.join("");
  }

  function tabsHtml(tab, visible) {
    const shown = TABS.filter((id) => !visible || visible[id] !== false);
    const list = shown.length ? shown : TABS;
    const current = list.indexOf(tab) >= 0 ? tab : list[0];
    return `<nav class="dossier-tabs" role="tablist">` +
      list.map((id) => {
        const on = id === current ? "true" : "false";
        return `<button type="button" role="tab" data-tab="${id}" aria-selected="${on}">${TAB_LABELS[id]}</button>`;
      }).join("") +
      `</nav>`;
  }

  function pageClass(id, tab) {
    return `dossier-page${id === tab ? " active" : ""}`;
  }

  function html(opts) {
    const rules = R();
    const p = (opts && opts.p) || {};
    const rec = (opts && opts.rec) || { value: 0, ownerId: "", ownerName: "", factionId: "", stakes: {} };
    const dist = opts && Number(opts.dist);
    const userPos = opts && opts.userPos;
    const ok = distOk(userPos, dist);
    const playerKey = (opts && opts.playerKey) || (global.LvfeCatalogWallet && global.LvfeCatalogWallet.playerKey()) || "default";
    const visible = (opts && opts.visibleTabs) || null;
    const shown = TABS.filter((id) => !visible || visible[id] !== false);
    const tabList = shown.length ? shown : TABS;
    let tab = (opts && opts.tab) || "place";
    if (tabList.indexOf(tab) < 0) tab = tabList[0];
    const title = rules.placeTitle(p);
    const type = rules.typeLabel(p);
    const ownable = rules.isOwnable(p);
    const wallet = Number.isFinite(opts && opts.walletWhole) ? opts.walletWhole : 0;
    const tracking = Boolean(opts && opts.tracking);
    const W = global.LvfeCatalogWallet;
    const pts = p.claim_points != null ? p.claim_points : p.claim_nairacoin;
    const counts = conquestCounts(opts);
    let costN = ownable ? (W ? W.minStake(pts, p.catalog_type) : 5) : 0;
    if (ownable && global.LvfeConquest && costN > 0) costN = global.LvfeConquest.costToBack(costN, p, counts);
    const cost = ownable ? (rules.ncn ? rules.ncn(costN) : (costN + " NCN")) : "Cannot be owned";
    const walkLine = (opts && opts.walkLine) || "";

    const bits = [
      `<div class="dossier">`,
      `<div class="dossier-head">`,
      `<div class="dossier-head-row">`,
      `<div class="dossier-head-text">`,
      `<span class="dossier-mark">File</span>`,
      `<h2 title="${esc(title)}">${esc(title)}</h2>`,
      `</div>`,
      `<button type="button" class="track-toggle sw-ctl ghost" data-track="${esc(p.id)}" role="switch" aria-checked="${tracking ? "true" : "false"}" aria-label="Track">`,
      `<span class="sw-ctl-name">Track</span>`,
      `<span class="sw-ui" aria-hidden="true"></span>`,
      `</button>`,
      `</div>`,
      `</div>`,
      tabsHtml(tab, visible),
      `<div class="dossier-pages">`,
    ];

    const voice = V();
    if (!visible || visible.place !== false) {
      const pb = (voice && voice.placeBrief()) || { head: "Place file", status: "", how: "" };
      bits.push(
        `<section class="${pageClass("place", tab)}" data-page="place" role="tabpanel">`,
        voice ? voice.briefHead(pb.head, pb.status) : "",
        photoBlock(p, rec, opts),
        `<p class="row-label">Name</p><p class="row-value">${esc(title)}</p>`,
        `<p class="row-label">Type</p><p class="row-value">${esc(type)}</p>`,
        `<p class="row-label">Quality</p><p class="row-value">${esc(rules.qualityWords(p.quality))}</p>`,
        voice && pb.how ? voice.howWorks(pb.how) : "",
        `</section>`
      );
    }
    if (!visible || visible.mission !== false) {
      /* Sibling Mission remodel — keep briefing intact; shared voice lives in LvfeVoice. */
      bits.push(
        `<section class="${pageClass("mission", tab)}" data-page="mission" role="tabpanel">`,
        missionBriefHtml(p, rec, dist, ok, userPos, playerKey, counts, opts),
        `</section>`
      );
    }
    if (!visible || visible.land !== false) {
      const lb = (voice && voice.landBrief()) || { head: "Land hold", status: "", how: "" };
      bits.push(
        `<section class="${pageClass("land", tab)}" data-page="land" role="tabpanel">`,
        voice ? voice.briefHead(lb.head, lb.status) : "",
        `<p class="row-label">Neighbourhood</p><p class="row-value">${esc(rules.wordOr(rules.areaLabel(p), "Unclaimed"))}</p>`,
        `<p class="row-label">Side</p><p class="row-value">${esc(landSide(rec))}</p>`,
        `<p class="row-label">Who owns it</p><p class="row-value">${esc(ownerWords(rec))}</p>`,
        `<p class="row-label">Status</p><p class="row-value">${esc(conqueredText(rec))}</p>`,
        marksActionsHtml(p, rec, playerKey, opts),
        voice && lb.how ? voice.howWorks(lb.how) : "",
        `</section>`
      );
    }
    if (!visible || visible.money !== false) {
      const mb = (voice && voice.moneyBrief(ownable)) || { head: "Money desk", status: "", how: "" };
      bits.push(`<section class="${pageClass("money", tab)}" data-page="money" role="tabpanel">`);
      if (voice) bits.push(voice.briefHead(mb.head, mb.status));
      if (ownable) {
        bits.push(
          `<p class="row-label">Cost to Claim</p><p class="row-value">${esc(cost)}</p>`,
          `<p class="row-label">Place value</p><p class="row-value">${esc(moneyValue(rec, p, counts))}</p>`,
          `<p class="note">${esc(moneyInterest(p, rec, playerKey, counts))}</p>`
        );
        if (!ok) {
          bits.push(
            `<button type="button" class="claim" data-walk-closer="${esc(p.id)}">` +
            `${(voice && voice.CTA && voice.CTA.track) || "Track"}</button>`
          );
        }
      } else {
        bits.push(`<p class="note">${esc(rules.farmMsg())}</p>`);
      }
      if (voice && mb.how) bits.push(voice.howWorks(mb.how));
      bits.push(`</section>`);
    }
    if (!visible || visible.wallet !== false) {
      const wb = (voice && voice.walletBrief()) || { head: "Field wallet", status: "", how: "" };
      bits.push(
        `<section class="${pageClass("wallet", tab)}" data-page="wallet" role="tabpanel">`,
        voice ? voice.briefHead(wb.head, wb.status) : "",
        `<p class="row-label">Wallet</p><p class="row-value">${rules.ncn ? rules.ncn(wallet) : (wallet + " NCN")}</p>`,
        `<p class="row-label">This place</p><p class="row-value">${esc(title)}</p>`
      );
      if (walkLine) bits.push(`<p class="note">${esc(walkLine)}</p>`);
      bits.push(payHtml(p, rec, ok, playerKey, counts));
      if (voice && wb.how) bits.push(voice.howWorks(wb.how));
      bits.push(`</section>`);
    }
    bits.push(`</div></div>`);
    return bits.join("");
  }

  function bindNav(root, getTab, setTab) {
    if (!root || root.dataset.dossierNav === "1") return;
    root.dataset.dossierNav = "1";
    root.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (!tab || !root.contains(tab)) return;
      e.preventDefault();
      setTab(tab.getAttribute("data-tab"));
    });
    let x0 = 0;
    let y0 = 0;
    root.addEventListener("touchstart", (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      x0 = e.changedTouches[0].clientX;
      y0 = e.changedTouches[0].clientY;
    }, { passive: true });
    root.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
      const vis = [];
      root.querySelectorAll("[data-page]").forEach((el) => vis.push(el.getAttribute("data-page")));
      const list = vis.length ? vis : TABS;
      const i = list.indexOf(getTab());
      if (dx < 0 && i < list.length - 1) setTab(list[i + 1]);
      else if (dx > 0 && i > 0) setTab(list[i - 1]);
    }, { passive: true });
  }

  global.LvfeDossier = {
    TABS,
    TAB_LABELS,
    FACTION_NAMES,
    html,
    bindNav,
    distOk,
    ownerWords,
    payHtml,
    missionFactionStats,
    missionRankLine,
    missionCostBits,
    formatDist,
  };
})(typeof window !== "undefined" ? window : globalThis);
