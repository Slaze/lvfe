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
    return has ? "Has a photo" : "No photo yet";
  }

  function missionCopy(p, rec, dist, ok, userPos) {
    const rules = R();
    if (!rules.isOwnable(p)) return rules.farmMsg();
    if (!userPos) return "Walk closer — get within 80 m, then take a photo and put NairaCoin in to back it.";
    if (!ok) {
      const away = Number.isFinite(dist) ? Math.round(dist) + " m away. " : "";
      return away + "Walk closer — within 80 m — then take a photo and put NairaCoin in to back it.";
    }
    if (optsPhotoRequired(p, rec)) return "Take a photo, then put NairaCoin in to back this place.";
    return "Put NairaCoin in to back this place.";
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
    return { min: first ? min : 1, first: first, mine: mine, needPhoto: optsPhotoRequired(p, rec) };
  }

  function moneyValue(rec, p, counts) {
    if (!R().isOwnable(p)) return "Cannot be owned";
    const C = global.LvfeConquest;
    const ledger = rec ? Number(rec.value) || 0 : 0;
    const v = C ? C.displayValue(rec, p, counts) : ledger;
    if (v > 0 && ledger <= 0) return v + " NairaCoin · no one has backed this yet";
    return v > 0 ? v + " NairaCoin" : "No one has backed this yet";
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
    return who + " " + n + " NairaCoin from visits when someone else backs (10% of what they put in).";
  }

  /** Pay is the gated button. Label is always Pay. Disabled unless GPS and dist <= 80. */
  function payHtml(p, rec, ok, playerKey, counts) {
    if (!R().isOwnable(p)) {
      return `<button type="button" class="claim" disabled>Cannot be owned</button>`;
    }
    if (!ok) {
      return `<button type="button" class="claim" data-pay="1" disabled>Pay</button>` +
        `<p class="note pay-wait">Walk within 80 m to pay.</p>`;
    }
    const need = minNeed(p, rec, playerKey, counts);
    const bits = [`<form class="visit-form" data-place="${esc(p.id)}" data-kind="stake">`];
    if (need.needPhoto) {
      bits.push(`<input type="file" accept="image/*" capture="environment" class="photo-in" name="photo" />`);
    } else if (need.mine && need.mine.photo) {
      bits.push(`<span class="meta">Photo already in</span>`);
    }
    bits.push(
      `<div class="stake-row">` +
      `<input type="number" name="amount" min="${need.min}" step="1" value="${need.min}" />` +
      `<button type="submit" class="claim" data-pay="1">Pay</button>` +
      `</div></form>`
    );
    return bits.join("");
  }

  function missionCta(p, rec, ok, playerKey, counts) {
    if (!R().isOwnable(p)) {
      return `<button type="button" class="claim" disabled>Cannot be owned</button>`;
    }
    if (!ok) {
      return `<button type="button" class="claim" data-walk-closer="${esc(p.id)}">Walk closer</button>`;
    }
    return payHtml(p, rec, true, playerKey, counts);
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
    const cost = ownable ? (costN + " NairaCoin") : "Cannot be owned";
    const walkLine = (opts && opts.walkLine) || "";

    const bits = [
      `<div class="dossier">`,
      `<div class="dossier-head">`,
      `<span class="dossier-mark">File</span>`,
      `<h2>${esc(title)}</h2>`,
      `<button type="button" class="track-toggle sw-ctl ghost" data-track="${esc(p.id)}" role="switch" aria-checked="${tracking ? "true" : "false"}" aria-label="Track">`,
      `<span class="sw-ctl-name">Track</span>`,
      `<span class="sw-ui" aria-hidden="true"></span>`,
      `</button>`,
      `</div>`,
      tabsHtml(tab, visible),
      `<div class="dossier-pages">`,
    ];

    if (!visible || visible.place !== false) {
      bits.push(
        `<section class="${pageClass("place", tab)}" data-page="place" role="tabpanel">`,
        `<div class="dossier-photo">${esc(photoLine(p, rec))}</div>`,
        `<p class="row-label">Name</p><p class="row-value">${esc(title)}</p>`,
        `<p class="row-label">Type</p><p class="row-value">${esc(type)}</p>`,
        `<p class="row-label">Quality</p><p class="row-value">${esc(rules.qualityWords(p.quality))}</p>`,
        `</section>`
      );
    }
    if (!visible || visible.mission !== false) {
      bits.push(
        `<section class="${pageClass("mission", tab)}" data-page="mission" role="tabpanel">`,
        `<p class="note">${esc(missionCopy(p, rec, dist, ok, userPos))}</p>`,
        missionCta(p, rec, ok, playerKey, counts),
        `</section>`
      );
    }
    if (!visible || visible.land !== false) {
      bits.push(
        `<section class="${pageClass("land", tab)}" data-page="land" role="tabpanel">`,
        `<p class="row-label">Neighbourhood</p><p class="row-value">${esc(rules.wordOr(rules.areaLabel(p), "Unclaimed"))}</p>`,
        `<p class="row-label">Side</p><p class="row-value">${esc(landSide(rec))}</p>`,
        `<p class="row-label">Who owns it</p><p class="row-value">${esc(ownerWords(rec))}</p>`,
        `<p class="row-label">Status</p><p class="row-value">${esc(conqueredText(rec))}</p>`,
        `</section>`
      );
    }
    if (!visible || visible.money !== false) {
      bits.push(`<section class="${pageClass("money", tab)}" data-page="money" role="tabpanel">`);
      if (ownable) {
        bits.push(
          `<p class="row-label">Cost to back</p><p class="row-value">${esc(cost)}</p>`,
          `<p class="row-label">Place value</p><p class="row-value">${esc(moneyValue(rec, p, counts))}</p>`,
          `<p class="note">${esc(moneyInterest(p, rec, playerKey, counts))}</p>`
        );
      } else {
        bits.push(`<p class="note">${esc(rules.farmMsg())}</p>`);
      }
      bits.push(`</section>`);
    }
    if (!visible || visible.wallet !== false) {
      bits.push(
        `<section class="${pageClass("wallet", tab)}" data-page="wallet" role="tabpanel">`,
        `<p class="row-label">Wallet</p><p class="row-value">${wallet} NairaCoin</p>`,
        `<p class="row-label">This place</p><p class="row-value">${esc(title)}</p>`
      );
      if (walkLine) bits.push(`<p class="note">${esc(walkLine)}</p>`);
      bits.push(payHtml(p, rec, ok, playerKey, counts), `</section>`);
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
  };
})(typeof window !== "undefined" ? window : globalThis);
