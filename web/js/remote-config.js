/* Load public game config from save host and apply to live modules.
   Secrets never included. Falls soft if offline. */
(function (global) {
  const state = {
    loaded: false,
    config: null,
    error: null,
  };

  function base() {
    const C = global.LvfeSaveApiConfig;
    if (C && typeof C.resolveBase === "function") return C.resolveBase();
    return "https://iconiaglobal.com/lvfe-save";
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function apply(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    state.config = cfg;
    state.loaded = true;
    const eco = cfg.economy || {};
    const client = cfg.client || {};
    const features = cfg.features || {};
    const copy = cfg.copy || {};

    if (global.LvfeRules && typeof global.LvfeRules.applyConfig === "function") {
      global.LvfeRules.applyConfig({ claimRadiusM: eco.claimRadiusM });
    }
    if (global.LvfeClaimRules && typeof global.LvfeClaimRules.applyConfig === "function") {
      global.LvfeClaimRules.applyConfig({ claimRadiusM: eco.claimRadiusM });
    }
    if (global.LvfePlaceLedger && typeof global.LvfePlaceLedger.applyConfig === "function") {
      global.LvfePlaceLedger.applyConfig({
        yieldRate: eco.yieldRate != null ? eco.yieldRate : 0,
        factionCut: eco.factionCut != null ? eco.factionCut : 0,
      });
    }
    if (global.LvfePassToll && typeof global.LvfePassToll.applyConfig === "function") {
      global.LvfePassToll.applyConfig({
        radiusM: eco.claimRadiusM,
        floorNcn: eco.tollFloorNcn,
        stakePct: eco.tollStakePct,
        escapePct: eco.tollEscapePct,
        cooldownMin: eco.tollCooldownMin,
        enabled: features.passToll === true,
      });
    }
    if (global.LvfeProgression && typeof global.LvfeProgression.applyConfig === "function") {
      global.LvfeProgression.applyConfig({
        baseXp: eco.baseVisitXp,
        ownerReferralRate: eco.ownerReferralXp,
        hoodPinGoal: eco.hoodPinGoal,
        hoodNcnBonus: eco.hoodNcnBonus,
      });
    }
    if (global.LvfeConquest && typeof global.LvfeConquest.applyConfig === "function") {
      global.LvfeConquest.applyConfig({
        maxBonus: eco.maxNeighbourhoodBonus,
        unknownFloor: eco.unknownValueFloor,
      });
    }
    if (global.LvfeCatalogWallet && typeof global.LvfeCatalogWallet.applyConfig === "function") {
      global.LvfeCatalogWallet.applyConfig({ minStakeFloor: eco.minStakeFloor });
    }
    if (global.LvfeNairaCoin && typeof global.LvfeNairaCoin.applyConfig === "function") {
      global.LvfeNairaCoin.applyConfig({ faucetWhole: eco.faucetWhole });
    }
    if (global.LvfeBuyNcnConfig && typeof global.LvfeBuyNcnConfig.applyConfig === "function") {
      global.LvfeBuyNcnConfig.applyConfig({
        paystackPublicKey: client.paystackPublicKey,
        flwPublicKey: client.flwPublicKey,
        buyApiBase: client.buyApiBase,
        defaultProvider: eco.defaultBuyProvider,
        minNcn: eco.buyMinNcn,
        maxNcn: eco.buyMaxNcn,
        presets: eco.buyPresets,
        ncnPerUsd: eco.ncnPerUsd,
        blockerTitle: copy.buyBlockerTitle,
        features: features,
      });
    }
    if (global.LvfeGoogleAuthConfig && typeof global.LvfeGoogleAuthConfig.applyConfig === "function") {
      global.LvfeGoogleAuthConfig.applyConfig({
        webClientId: client.googleWebClientId,
        blockerTitle: copy.oauthBlockerTitle,
      });
    }
    if (global.LvfeTrack && typeof global.LvfeTrack.applyConfig === "function") {
      global.LvfeTrack.applyConfig({ walkKmh: eco.walkKmh });
    }
    if (global.LvfeTrackGuide && typeof global.LvfeTrackGuide.applyConfig === "function") {
      global.LvfeTrackGuide.applyConfig({ walkKmh: eco.walkKmh });
    }
    if (global.LvfeGameNotify && typeof global.LvfeGameNotify.applyConfig === "function") {
      global.LvfeGameNotify.applyConfig({
        nearbyRadiusM: eco.nearbyNotifyRadiusM,
        approachRadiusM: eco.approachRadiusM,
      });
    }
    if (global.LvfeSaveApiConfig && client.saveApiBase) {
      try {
        if (!localStorage.getItem("lvfe.saveApiBase")) {
          // Do not override explicit local override; only hint via config object.
          global.LvfeSaveApiConfig.SAVE_API_BASE = String(client.saveApiBase).replace(/\/+$/, "");
        }
      } catch (err) { /* */ }
    }
    if (typeof global.lvfeOnRemoteConfig === "function") {
      try { global.lvfeOnRemoteConfig(cfg); } catch (err) { /* */ }
    }
  }

  function load(cb) {
    const done = typeof cb === "function" ? cb : function () {};
    const url = base().replace(/\/+$/, "") + "/v1/game-config";
    fetch(url, { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok && data.config) {
          apply(data.config);
          done(null, data.config);
        } else {
          state.error = (data && data.error) || "bad_config";
          done(state.error);
        }
      })
      .catch(function (err) {
        state.error = String(err && err.message || err || "network");
        done(state.error);
      });
  }

  const api = {
    state,
    load,
    apply,
    get: function () { return state.config; },
    num,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LvfeRemoteConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
