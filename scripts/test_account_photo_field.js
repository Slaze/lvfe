/* Auth is device-local; Google must fail loud without a real client ID;
   photos confirm vs discard; field claim is hinterland outside Enugu bbox. */
require("../web/js/google-auth.config.js");
require("../web/js/account.js");
require("../web/js/google-auth.js");
require("../web/js/photo-store.js");
require("../web/js/field-claim.js");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const C = global.LvfeGoogleAuthConfig;
const Acc = global.LvfeAccount;
const G = global.LvfeGoogleAuth;
const P = global.LvfePhotoStore;
const F = global.LvfeField;

assert(C && C.ANDROID_PACKAGE === "com.lvfe.xperience", "Android package");
assert(C.BLOCKER_CODE === "oauth_not_configured", "blocker code");
assert(C.blockerMessage().indexOf("Web application") >= 0, "blocker names Web client");
assert(C.blockerMessage().indexOf("com.lvfe.xperience") >= 0, "blocker names package");
assert(!/maps\.googleapis/i.test(C.blockerMessage()) || /do not enable Maps/i.test(C.blockerMessage()), "blocker forbids Maps SKUs");
assert(/do not enable Maps SDK/i.test(C.BLOCKER_STEPS.join(" ")), "explicit no Maps");

if (!C.isConfigured()) {
  assert(!G.configured(), "auth reports not configured");
  const loud = G.failLoud();
  assert(loud.ok === false && loud.code === "oauth_not_configured", "fail loud");
} else {
  assert(G.configured(), "Web client ID is wired");
}

global.__lvfeAccountMem = {};
assert(Acc.playerKeyFromSub("1234567890") === "g1234567890", "stable sub key");
assert(!Acc.nameTaken("Ada"), "empty store");
Acc.unpackSave({
  kind: Acc.PACK_KIND,
  identity: { "lvfe.identity.ada": { playerName: "Ada", factionId: "independence_layout" } },
  places: { p1: { value: 5, ownerId: "ada", ownerName: "Ada", stakes: { ada: { amount: 5, photo: { stored: true } } } } },
  wallets: { "lvfe.nc.iou.v1.ada": { atomic: 100, faucetGranted: true } },
  factionPool: {},
  google: {},
  field: { type: "FeatureCollection", features: [] },
});
assert(Acc.nameTaken("ada"), "unique name is case-insensitive");
assert(Acc.nameTaken("Ada", "ada") === false, "same profile can keep its name");
assert(Acc.isNameLocked({ playerName: "Ada" }), "migrate: name set → locked");
assert(Acc.assertCanSetName("ada", "Chidi").ok === false, "locked rename rejected");
const pack = Acc.packSave({ playerKey: "ada" });
assert(pack.kind === Acc.PACK_KIND && pack.places.p1.value === 5, "pack includes stakes");
assert(pack.identity["lvfe.identity.ada"].playerName === "Ada", "pack includes username");
assert(pack.identity["lvfe.identity.ada"].nameLocked === true, "unpack migrates nameLocked");
assert(pack.wallets["lvfe.nc.iou.v1.ada"].atomic === 100, "pack includes IOU wallet");
assert(/Export\/Import|cloud sync|backup/i.test(pack.note), "pack mentions backup path");
assert(pack.updatedAt, "pack has updatedAt for LWW sync");

P.useMemoryOnly();
const fake = { name: "visit.jpg", size: 1200, type: "image/jpeg" };
assert(P.validFile(fake), "jpeg ok");
assert(!P.validFile({ name: "x", size: 0, type: "image/jpeg" }), "empty discarded");
assert(!P.validFile({ name: "x.pdf", size: 10, type: "application/pdf" }), "non-image discarded");
assert(P.setPending(fake, "place-1", "ada"), "pending set");
assert(P.getPending().placeId === "place-1", "pending kept");
P.discardPending();
assert(P.getPending() === null, "sheet close discards pending");
P.confirm("place-1", "ada", fake);
assert(P._mem[P.keyOf("place-1", "ada")] && P._mem[P.keyOf("place-1", "ada")].size === 1200, "confirm keeps bytes in store");

const enugu = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [7.522, 6.427] }, properties: { id: "shop-1" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [7.51, 6.44] }, properties: { id: "shop-2" } },
    ],
  };
  const bbox = F.catalogBbox(enugu);
  assert(!F.outsideCatalog(6.427, 7.522, bbox), "Independence Layout is inside catalog");
  assert(F.outsideCatalog(51.5, -0.12, bbox), "London is outside Enugu catalog");
  assert(F.outsideCatalog(6.52, 3.38, bbox), "Lagos is outside Enugu catalog");
  const here = F.ensureHere({ lat: 51.5, lon: -0.12 }, enugu);
  assert(here.properties.id.indexOf("field-here-") === 0, "here pin id");
  assert(here.properties.territory_id === "unclaimed", "hinterland");
  assert(here.properties.claim_nairacoin === 5, "claimable min stake");
  assert(here.properties.quality === "D", "unknown quality — sibling owns pin color");
  const located = F.onLocated(null, { lat: 51.5, lon: -0.12 }, enugu);
  assert(located.away === true, "London flags away");
  assert(located.places.features.some(function (f) { return F.isFieldId(f.properties.id); }), "merged here pin");
const home = F.onLocated(null, { lat: 6.427, lon: 7.522 }, enugu);
assert(home.away === false, "Enugu GPS does not invent extra catalog");

const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
  assert(/Sign in with Google/.test(html), "Google button on identity gate");
  assert(/js\/google-auth\.config\.js/.test(html), "config script");
  assert(/js\/account\.js/.test(html), "account script");
  assert(/js\/google-auth\.js/.test(html), "google-auth script");
  assert(/js\/photo-store\.js/.test(html), "photo-store script");
  assert(/js\/field-claim\.js/.test(html), "field-claim script");
  assert(/js\/local-factions\.js/.test(html), "local-factions script");
  assert(/idNameLockNote/.test(html), "username lock note in gate");
  assert(/btnExportSave/.test(html) && /btnImportSave/.test(html), "export/import");
  assert(!/maps\.googleapis|maps\.google\.com/i.test(html), "no Google Maps SKU in index");
  const inlineStart = html.lastIndexOf("<script>");
  const inlineEnd = html.indexOf("</script>", inlineStart);
  const inline = html.slice(inlineStart + 8, inlineEnd);
  const chk = spawnSync("node", ["--check"], { input: inline, encoding: "utf8" });
  assert(chk.status === 0, "index inline still parses: " + (chk.stderr || chk.stdout || ""));
  assert(/flyToUser|LvfeField/.test(inline), "geolocate flies / field claim");
  assert(/refreshLocalFactions|LvfeLocalFactions/.test(inline), "local factions on locate");
  assert(/LvfePhotoStore/.test(inline), "visit confirms photo store");
  assert(/discardPending/.test(inline), "sheet close discards pending photo");
  assert(/username_locked|nameLocked|isNameLocked/.test(inline), "username lock wired");

  const kt = fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/lvfe/xperience/MainActivity.kt"), "utf8");
  assert(/signInWithGoogle/.test(kt), "Android Google bridge");
  assert(/google_web_client_id/.test(kt) || /googleWebClient/.test(kt) || /R\.string\.google_web_client_id/.test(kt), "placeholder string");
assert(!/maps\.googleapis|MapView|com\.google\.android\.gms\.maps/i.test(kt), "no Play Maps SDK");

console.log("account / google / photo confirm / field-claim / username lock ok");
