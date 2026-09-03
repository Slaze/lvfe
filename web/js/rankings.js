/* Live rankings from place stakes + faction pools. No hardcoded demo names
   unless the ledger is empty (optional faucet empty-state). */
(function (global) {
  function rowProps(row) {
    if (!row) return {};
    if (row.properties && typeof row.properties === "object") return row.properties;
    return row;
  }

  function listOf(rows) {
    if (!rows) return [];
    if (Array.isArray(rows.features)) return rows.features;
    if (Array.isArray(rows)) return rows;
    return [];
  }

  function ncnLabel(n) {
    const R = global.LvfeRules;
    if (R && typeof R.ncn === "function") return R.ncn(n);
    const v = Math.round(Number(n));
    return (Number.isFinite(v) ? v : 0) + " NCN";
  }

  /**
   * Aggregate player stats from places ledger.
   * places: { [placeId]: { ownerId, ownerName, factionId, stakes: { pid: { amount, playerName } } } }
   * features: optional catalog rows for place count context
   */
  function playerStats(places, opts) {
    const o = opts || {};
    const all = places && typeof places === "object" ? places : {};
    const byPlayer = {};

    function ensure(pid, name, factionId) {
      const id = String(pid || "");
      if (!id) return null;
      if (!byPlayer[id]) {
        byPlayer[id] = {
          playerKey: id,
          playerName: name || id,
          factionId: factionId || "",
          staked: 0,
          owned: 0,
          backed: 0,
        };
      }
      const row = byPlayer[id];
      if (name && row.playerName === id) row.playerName = name;
      if (factionId && !row.factionId) row.factionId = factionId;
      return row;
    }

    Object.keys(all).forEach(function (placeId) {
      const rec = all[placeId];
      if (!rec) return;
      const stakes = rec.stakes || {};
      Object.keys(stakes).forEach(function (pid) {
        const st = stakes[pid];
        const amt = Number(st && st.amount) || 0;
        if (!(amt > 0)) return;
        const row = ensure(pid, st.playerName, "");
        if (!row) return;
        row.staked += amt;
        row.backed += 1;
      });
      if (rec.ownerId) {
        const row = ensure(rec.ownerId, rec.ownerName, rec.factionId);
        if (row) row.owned += 1;
      }
    });

    if (o.identities && typeof o.identities === "object") {
      Object.keys(o.identities).forEach(function (pid) {
        const idn = o.identities[pid];
        if (!idn) return;
        const row = ensure(pid, idn.playerName || idn.name, idn.factionId);
        if (row && idn.factionId) row.factionId = idn.factionId;
      });
    }

    return byPlayer;
  }

  function sortPlayers(map, metric) {
    const list = Object.keys(map || {}).map(function (k) { return map[k]; });
    const key = metric === "owned" ? "owned" : metric === "backed" ? "backed" : "staked";
    list.sort(function (a, b) {
      const d = (Number(b[key]) || 0) - (Number(a[key]) || 0);
      if (d) return d;
      return String(a.playerName || "").localeCompare(String(b.playerName || ""));
    });
    return list.map(function (row, i) {
      return Object.assign({}, row, { rank: i + 1, score: Number(row[key]) || 0, metric: key });
    });
  }

  function globalLeaders(places, opts) {
    const stats = playerStats(places, opts);
    const metric = (opts && opts.metric) || "staked";
    const ranked = sortPlayers(stats, metric);
    if (!ranked.length && opts && opts.emptyDemo) {
      return [{
        rank: 1,
        playerKey: "demo",
        playerName: "No stakes yet — claim a place",
        factionId: "",
        staked: 0,
        owned: 0,
        backed: 0,
        score: 0,
        metric: metric,
        demo: true,
      }];
    }
    return ranked;
  }

  function factionScore(factionId, places, factionPools, opts) {
    const fid = String(factionId || "");
    const pool = factionPools && Number(factionPools[fid]) || 0;
    const stats = playerStats(places, opts);
    let owned = 0;
    let staked = 0;
    let members = 0;
    Object.keys(stats).forEach(function (pid) {
      const row = stats[pid];
      if (row.factionId !== fid) return;
      members += 1;
      owned += row.owned;
      staked += row.staked;
    });
    /* Faction score: pool NCN + owned places * 10 + staked * 0.1 (whole coins). */
    const score = pool + owned * 10 + Math.round(staked * 0.1);
    return { factionId: fid, pool: pool, owned: owned, staked: staked, members: members, score: score };
  }

  function factionLeaders(places, factionPools, factionNames, opts) {
    const names = factionNames || {};
    const ids = Object.keys(names).length
      ? Object.keys(names)
      : Object.keys(factionPools || {});
    const rows = ids.map(function (fid) {
      const s = factionScore(fid, places, factionPools, opts);
      return Object.assign({}, s, { name: names[fid] || fid });
    });
    rows.sort(function (a, b) {
      const d = b.score - a.score;
      if (d) return d;
      return String(a.name).localeCompare(String(b.name));
    });
    return rows.map(function (r, i) {
      return Object.assign({}, r, { rank: i + 1 });
    });
  }

  /** Who leads a faction and members ordered by staked then owned. */
  function factionWhoIsWho(factionId, places, opts) {
    const fid = String(factionId || "");
    const stats = playerStats(places, opts);
    const members = Object.keys(stats)
      .map(function (k) { return stats[k]; })
      .filter(function (r) { return r.factionId === fid; });
    members.sort(function (a, b) {
      const d = (b.staked - a.staked) || (b.owned - a.owned);
      if (d) return d;
      return String(a.playerName).localeCompare(String(b.playerName));
    });
    const ranked = members.map(function (r, i) {
      return Object.assign({}, r, { rank: i + 1, points: r.staked + r.owned * 10 });
    });
    return {
      factionId: fid,
      leader: ranked[0] || null,
      members: ranked,
    };
  }

  /** City/neighbourhood board: owned counts by territory from features + places. */
  function cityByTerritory(features, places, territoryNames) {
    const all = places && typeof places === "object" ? places : {};
    const names = territoryNames || {};
    const byTid = {};
    const list = listOf(features);
    for (let i = 0; i < list.length; i++) {
      const p = rowProps(list[i]);
      const tid = String(p.territory_id || "unclaimed");
      if (!byTid[tid]) {
        byTid[tid] = { territoryId: tid, name: names[tid] || tid, total: 0, owned: 0, byFaction: {} };
      }
      byTid[tid].total += 1;
      const rec = all[p.id];
      if (rec && rec.ownerId) {
        byTid[tid].owned += 1;
        const fac = rec.factionId || "none";
        byTid[tid].byFaction[fac] = (byTid[tid].byFaction[fac] || 0) + 1;
      }
    }
    return Object.keys(byTid).map(function (k) { return byTid[k]; })
      .sort(function (a, b) { return (b.owned - a.owned) || (b.total - a.total); });
  }

  const api = {
    ncnLabel,
    playerStats,
    sortPlayers,
    globalLeaders,
    factionScore,
    factionLeaders,
    factionWhoIsWho,
    cityByTerritory,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeRankings = api;
})(typeof window !== "undefined" ? window : globalThis);
