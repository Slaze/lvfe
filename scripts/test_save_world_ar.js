#!/usr/bin/env node
"use strict";

const assert = (cond, msg) => { if (!cond) throw new Error(msg || "assert"); };

const Acc = require("../web/js/account.js");
const Sync = require("../web/js/save-sync.js");
const Cfg = require("../web/js/save-api.config.js");
const World = require("../web/js/world-catalog.js");
const Field = require("../web/js/field-claim.js");
const Rules = require("../web/js/claim-rules.js");

// --- account pack has updatedAt ---
const pack = Acc.packSave({ playerKey: "ada" });
assert(pack.kind === "lvfe.save.v1", "pack kind");
assert(pack.updatedAt, "updatedAt present");

// --- save sync helpers ---
assert(typeof Sync.buildPack === "function", "buildPack");
assert(Cfg.DEV_AUTH_PREFIX === "lvfe-dev:", "dev auth prefix");
assert(Sync.authHeader("ada").indexOf("lvfe-dev:ada") >= 0, "dev bearer");

// --- world classify / quality / banks ---
assert(World.classify({ amenity: "bank", name: "First Bank" }) === "bank", "bank type");
assert(World.classify({ amenity: "atm" }) === "atm", "atm type");
assert(World.classify({ shop: "convenience", name: "Spar" }) === "shop", "shop");
assert(World.classify({ amenity: "place_of_worship", name: "Chapel" }) === "worship", "worship");
assert(World.qualityOf("civic_unknown", false) === "D", "unknown D");
assert(World.qualityOf("shop", true) === "B", "named B");
assert(World.qualityOf("shop", false) === "C", "unnamed C");
assert(Rules.isOwnable({ catalog_type: "bank" }) === false, "bank not ownable");
assert(Rules.isOwnable({ catalog_type: "atm" }) === false, "atm not ownable");
assert(Rules.isOwnable({ catalog_type: "shop" }) === true, "shop ownable");

const feat = World.toFeature({
  id: "world-n_1",
  lat: 6.45,
  lon: 3.39,
  name: "Test Shop",
  catalog_type: "shop",
});
assert(feat.properties.quality === "B", "feat quality");
assert(feat.properties.territory_id === "unclaimed", "hinterland territory");
assert(World.isWorldId("world-n_1"), "world id");
assert(Field.isFieldId("world-n_1"), "field id includes world");

// Enugu bbox still inside catalog → outsideCatalog false near Enugu pins
const bbox = { minLon: 7.45, minLat: 6.39, maxLon: 7.58, maxLat: 6.52 };
assert(Field.outsideCatalog(6.45, 7.50, bbox) === false, "inside Enugu");
assert(Field.outsideCatalog(6.45, 3.39, bbox) === true, "Lagos outside");

// Overpass QL contains bbox
const ql = World._test.overpassQl(World.bboxAround(6.45, 3.39));
assert(ql.indexOf("amenity") > 0 && ql.indexOf("timeout") > 0, "overpass ql");

// AR bearing math (claim-rules)
const brg = Rules.bearingDeg(6.45, 7.50, 6.4504, 7.50); // ~north
assert(brg < 5 || brg > 355, "bearing ~north got " + brg);
const words = Rules.headingWords(0, brg);
assert(typeof words === "string" && words.length > 0, "heading words");

console.log("test_save_world_ar.js ok");
