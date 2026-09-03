/* Shared player voice: punchy briefings, CTA verbs, smart How-it-works.
   Mission tab remodel (sibling) should reuse these helpers so tone stays one game. */
(function (global) {
  function esc(s) {
    if (global.LvfeRules && global.LvfeRules.esc) return global.LvfeRules.esc(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const CTA = {
    track: "Track",
    bid: "Bid",
    claim: "Claim",
    sync: "Sync",
    buy: "Buy NCN",
    watch: "Watch",
    takeover: "Plan takeover",
  };

  function briefHead(title, status) {
    const bits = [`<p class="brief-head">${esc(title)}</p>`];
    if (status) bits.push(`<p class="brief-status">${esc(status)}</p>`);
    return bits.join("");
  }

  function howWorks(body, summary) {
    const sum = summary || "How it works";
    return (
      `<details class="brief-how"><summary>${esc(sum)}</summary>` +
      `<p>${esc(body)}</p></details>`
    );
  }

  function placeBrief() {
    return {
      head: "Place file",
      status: "Ground truth — photo, type, quality. Confirm what you’re claiming.",
      how:
        "Pins are real map places. Red X = open named asset. Black X = unknown building (high value). Circles = owned. Your visit photo beats any map photo when you’ve been there.",
    };
  }

  function landBrief() {
    return {
      head: "Land hold",
      status: "Neighbourhood colour + who owns the pin. Marks keep pressure on rivals.",
      how:
        "Owning a pin under your faction flies their colour. More owned pins in a neighbourhood raise display value / cost-to-back (up to +50%). Watchlist, threats, and takeover plans live here.",
    };
  }

  function moneyBrief(ownable) {
    if (!ownable) {
      return {
        head: "Money desk",
        status: "Banks and ATMs are landmarks only — no NCN stake.",
        how: "Find them on the map; you cannot Claim or Bid here.",
      };
    }
    return {
      head: "Money desk",
      status: "Cost to Claim · place value · visit yield (~10% to owner).",
      how:
        "Highest NCN stake owns. Visitors fund the pin; ~10% of their stake pays as yield (mostly to the owner, a cut to the neighbourhood). Enemy-held? Bid enough to beat their total.",
    };
  }

  function walletBrief() {
    return {
      head: "Field wallet",
      status: "Your NCN on this phone. Claim / Bid only inside the 80 m ring.",
      how:
        "Track the asset, walk the green line, photo on first stake, then Claim. Short on coin? Buy NCN from Account → Wallet. Sync keeps APK and PWA on one pack.",
    };
  }

  /** Mission sibling may replace the full briefing; this is the shared tone seed. */
  function missionBriefSeed() {
    return {
      head: "Property Asset sighted !!!",
      status: "Briefing · distance · cost · Track or Claim.",
      how:
        "Track paints the walk + 80 m pay ring. Inside the ring: photo (first time) + Claim / Bid with NCN. Rank sigils (Initiate→Sovereign) and faction roles (Banner Lord / Vanguard / Kin) update from stakes + owned pins.",
    };
  }

  function hubBrief(which) {
    if (which === "wallet") {
      return {
        head: "Wallet hub",
        status: "Balance, Buy NCN, stakes out, watchlist & takeovers.",
      };
    }
    if (which === "earn") {
      return {
        head: "Earn board",
        status: "Assets near you — Claim open pins or Bid on enemy holds.",
      };
    }
    if (which === "rankings") {
      return {
        head: "Rankings",
        status: "Leaders by NCN staked · faction score · named sigils.",
      };
    }
    if (which === "analytics") {
      return {
        head: "Field analytics",
        status: "Territory control, claims, threats, toll prefs.",
      };
    }
    return { head: "Play", status: "" };
  }

  const EMPTY = {
    noStakes: "No stakes yet — scout the map, Track a pin, Claim with NCN.",
    noWatch: "No assets marked — open a place file and Watch.",
    noTakeover: "No takeover planned — Mark an enemy pin and Plan takeover.",
    noMissionsGps: "GPS off — turn it on to list Claim / Bid missions near you.",
    noMissions: "No ownable assets in range — walk the city or widen the hunt.",
    noLeaders: "Ledger quiet — first Claims write the rankings.",
    noFactions: "No faction pools yet — own pins under a neighbourhood colour.",
    noTerritory: "No neighbourhood stats yet — Claim pins to paint the map.",
    noClaims: "No assets marked as yours — scout, Track, Claim.",
    noThreats: "No threats tagged — Mark rival owners from a place file.",
    noRivalsGps: "GPS off — rivals only show when you’re on the street.",
    noRivals: "No rival-held assets nearby — keep scouting.",
    catalogNone: "No places match — clear filters or scout the map.",
    assetsNone: "No assets marked — scout the map, photo + Claim with NCN.",
    arNoGps: "GPS off — turn on location to paint nearby assets.",
    arEmpty: "No assets in view — walk closer or Track a pin on the map.",
    buyKeys: "Buy NCN isn’t available yet — try again later.",
  };

  global.LvfeVoice = {
    CTA,
    esc,
    briefHead,
    howWorks,
    placeBrief,
    landBrief,
    moneyBrief,
    walletBrief,
    missionBriefSeed,
    hubBrief,
    EMPTY,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.LvfeVoice;
  }
})(typeof window !== "undefined" ? window : globalThis);
