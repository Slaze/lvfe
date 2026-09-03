/**
 * Permanent username ↔ Google sub binding for lvfe-save.
 * Guest/dev saves without googleSub skip cloud lock (device uniqueness only).
 */
"use strict";

const fs = require("fs");
const path = require("path");

function normalizeName(name) {
  return String(name || "").trim().slice(0, 32);
}

function nameKey(name) {
  return normalizeName(name).toLowerCase();
}

function mapPath(saveDir) {
  return path.join(path.dirname(saveDir), "username-map.json");
}

function loadMap(saveDir) {
  const p = mapPath(saveDir);
  try {
    if (!fs.existsSync(p)) return { byName: {}, bySub: {} };
    const o = JSON.parse(fs.readFileSync(p, "utf8"));
    return {
      byName: (o && o.byName && typeof o.byName === "object") ? o.byName : {},
      bySub: (o && o.bySub && typeof o.bySub === "object") ? o.bySub : {},
    };
  } catch (err) {
    return { byName: {}, bySub: {} };
  }
}

function saveMap(saveDir, map) {
  const p = mapPath(saveDir);
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2));
  fs.renameSync(tmp, p);
}

/**
 * Prefer identity row for accountKey; else first row whose googleSub matches.
 */
function extractClaim(pack, accountKey) {
  if (!pack || typeof pack !== "object") return null;
  const ident = pack.identity && typeof pack.identity === "object" ? pack.identity : {};
  const wantKey = "lvfe.identity." + String(accountKey || "");
  let row = ident[wantKey] || null;
  const packSub = String(pack.googleSub || "").trim();
  if (!row && packSub) {
    const keys = Object.keys(ident);
    for (let i = 0; i < keys.length; i++) {
      const r = ident[keys[i]];
      if (r && String(r.googleSub || "").trim() === packSub && r.playerName) {
        row = r;
        break;
      }
    }
  }
  if (!row || !row.playerName) return null;
  const name = normalizeName(row.playerName);
  if (!name) return null;
  const googleSub = String(row.googleSub || pack.googleSub || "").trim();
  return {
    name: name,
    nameKey: nameKey(name),
    googleSub: googleSub,
    playerKey: String(accountKey || "").slice(0, 32),
  };
}

/**
 * Enforce permanent username ↔ googleSub.
 * @returns {{ok:true}|{ok:false,code:string,error:string,status:number}}
 */
function enforceUsernameLock(pack, accountKey, auth, saveDir) {
  const claim = extractClaim(pack, accountKey);
  const authSub = auth && auth.sub ? String(auth.sub).trim() : "";
  const googleSub = authSub || (claim && claim.googleSub) || "";

  if (!googleSub) {
    return { ok: true, skipped: true, reason: "no_google_sub" };
  }
  if (!claim || !claim.name) {
    return { ok: true, skipped: true, reason: "no_username_yet" };
  }

  const map = loadMap(saveDir);
  const bySub = map.bySub[googleSub];
  const byName = map.byName[claim.nameKey];

  if (bySub && bySub.nameKey && bySub.nameKey !== claim.nameKey) {
    return {
      ok: false,
      status: 409,
      code: "username_locked",
      error: "Username is permanent for this Google account and cannot be changed.",
      lockedName: bySub.name || bySub.nameKey,
    };
  }
  if (byName && byName.googleSub && byName.googleSub !== googleSub) {
    return {
      ok: false,
      status: 409,
      code: "username_taken",
      error: "That username is permanently bound to another Google account.",
    };
  }

  const now = new Date().toISOString();
  map.byName[claim.nameKey] = {
    googleSub: googleSub,
    playerKey: claim.playerKey,
    name: claim.name,
    lockedAt: (byName && byName.lockedAt) || now,
  };
  map.bySub[googleSub] = {
    nameKey: claim.nameKey,
    name: claim.name,
    playerKey: claim.playerKey,
    lockedAt: (bySub && bySub.lockedAt) || now,
  };
  saveMap(saveDir, map);
  return { ok: true, locked: true, name: claim.name, googleSub: googleSub };
}

module.exports = {
  normalizeName,
  nameKey,
  mapPath,
  loadMap,
  saveMap,
  extractClaim,
  enforceUsernameLock,
};
