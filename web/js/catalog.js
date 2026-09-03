(function () {
  const PAGE = 40;
  const R = window.LvfeRules;
  const W = window.LvfeCatalogWallet;
  const Ledger = window.LvfePlaceLedger;
  const D = window.LvfeDossier;
  const PLACES_KEY = "lvfe.places.v1";
  const SEC_KEY = "lvfe.catalog.tabs.v1";
  const FACTION_NAMES = (D && D.FACTION_NAMES) || {};

  const state = {
    all: [],
    view: [],
    page: 0,
    sort: "name",
    dir: "asc",
    tab: "place",
    openId: null,
    userPos: null,
    visible: { place: true, mission: true, land: true, money: true, wallet: true },
  };

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function loadSecs() {
    try {
      const o = JSON.parse(localStorage.getItem(SEC_KEY) || "null");
      if (o && typeof o === "object") state.visible = Object.assign(state.visible, o);
    } catch (err) { /* */ }
    document.querySelectorAll("[data-sec]").forEach((box) => {
      const id = box.getAttribute("data-sec");
      box.checked = state.visible[id] !== false;
      box.setAttribute("aria-checked", box.checked ? "true" : "false");
    });
  }

  function saveSecs() {
    document.querySelectorAll("[data-sec]").forEach((box) => {
      state.visible[box.getAttribute("data-sec")] = box.checked;
    });
    try { localStorage.setItem(SEC_KEY, JSON.stringify(state.visible)); } catch (err) { /* */ }
  }

  function identity() {
    const pk = W.playerKey();
    try {
      const o = JSON.parse(localStorage.getItem("lvfe.identity." + pk) || "null");
      if (o && o.playerName) return { playerName: String(o.playerName).slice(0, 32), factionId: o.factionId || "" };
    } catch (err) { /* */ }
    return null;
  }

  function placeRec(id) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(PLACES_KEY) || "{}") || {}; } catch (err) { all = {}; }
    const rec = all[id];
    if (!rec || typeof rec !== "object") {
      return { value: 0, ownerId: "", ownerName: "", factionId: "", hasPhoto: false, quality: "", stakes: {} };
    }
    return {
      value: Number(rec.value) || 0,
      ownerId: rec.ownerId || "",
      ownerName: rec.ownerName || "",
      factionId: rec.factionId || "",
      hasPhoto: Boolean(rec.hasPhoto),
      quality: rec.quality || "",
      stakes: rec.stakes && typeof rec.stakes === "object" ? rec.stakes : {},
    };
  }

  function placeById(id) {
    return state.all.find((p) => String(p.id) === String(id));
  }

  function distTo(p) {
    if (!state.userPos || !p) return Infinity;
    return R.haversineM(state.userPos.lat, state.userPos.lon, p.lat, p.lon);
  }

  function fillSelect(id, values, blank) {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">${R.esc(blank)}</option>` +
      values.map((v) => `<option value="${R.esc(v)}">${R.esc(v)}</option>`).join("");
  }

  function apply() {
    const q = document.getElementById("qSearch").value.trim().toLowerCase();
    const type = document.getElementById("qType").value;
    const quality = document.getElementById("qQuality").value;
    const terr = document.getElementById("qTerr").value;
    const claimed = document.getElementById("qClaimed").value;
    const view = document.getElementById("qView") ? document.getElementById("qView").value : "mine";
    let rows = state.all.filter((p) => {
      if (type && p.catalog_type !== type && p.catalog_label !== type) return false;
      if (quality && p.quality !== quality) return false;
      if (terr && R.areaLabel(p) !== terr) return false;
      const mine = W.iOwn(p.id) || W.myStake(p.id) > 0;
      if (view === "mine" && !mine) return false;
      if (claimed === "yes" && !W.iOwn(p.id)) return false;
      if (claimed === "no" && W.iOwn(p.id)) return false;
      if (q) {
        const blob = `${R.placeTitle(p)} ${R.typeLabel(p)} ${R.areaLabel(p)}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    const dir = state.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => R.placeTitle(a).localeCompare(R.placeTitle(b)) * dir);
    state.view = rows;
    const maxPage = Math.max(0, Math.ceil(rows.length / PAGE) - 1);
    if (state.page > maxPage) state.page = maxPage;
    render();
  }

  function renderBal() {
    document.getElementById("ncBal").textContent = W.balanceLabel();
    const note = document.getElementById("ncNote");
    if (note) note.textContent = W.faucetNote();
  }

  function render() {
    renderBal();
    const start = state.page * PAGE;
    const slice = state.view.slice(start, start + PAGE);
    const box = document.getElementById("catList");
    box.innerHTML = slice.map((p) => {
      const owned = W.iOwn(p.id);
      const farm = !W.ownable(p.catalog_type);
      const stake = W.myStake(p.id);
      const rec = placeRec(p.id);
      const C = window.LvfeConquest;
      const counts = C ? C.get() : null;
      const shown = (!farm && C) ? C.displayValue(rec, p, counts) : 0;
      const note = farm ? "cannot be owned" : (owned ? "owner" : (stake ? "backed" : "No owner yet"));
      let money = "";
      if (!farm && C) {
        if (shown > 0) money = " · " + shown + " NairaCoin";
        else {
          const cost = C.costToBack(W.minStake(p.claim_nairacoin || p.claim_points, p.catalog_type), p, counts);
          if (cost > 0) money = " · " + cost + " to back";
        }
      }
      return `<button type="button" class="cat-row" data-open="${R.esc(p.id)}">` +
        `<strong>${R.esc(R.placeTitle(p))}</strong>` +
        `<span>${R.esc(R.typeLabel(p))} · ${R.esc(R.qualityWords(p.quality))} · ${R.esc(R.areaLabel(p))} · ${note}${money}</span>` +
        `</button>`;
    }).join("") || `<p class="meta">No places match.</p>`;
    document.getElementById("meta").textContent =
      `${state.view.length} places` +
      (state.view.length !== state.all.length ? ` (of ${state.all.length})` : "") +
      ` · showing ${state.view.length ? start + 1 : 0}–${Math.min(start + PAGE, state.view.length)}` +
      ` · Unclaimed is outside named neighbourhoods · on this phone`;
    document.getElementById("pageLabel").textContent =
      `Page ${state.page + 1} / ${Math.max(1, Math.ceil(state.view.length / PAGE))}`;
    document.getElementById("prev").disabled = state.page <= 0;
    document.getElementById("next").disabled = start + PAGE >= state.view.length;
    if (state.openId) renderFile();
  }

  function renderFile() {
    const p = placeById(state.openId);
    const card = document.getElementById("catCard");
    const file = document.getElementById("catFile");
    if (!p || !card || !D) return;
    const rec = placeRec(p.id);
    const dist = distTo(p);
    const T = window.LvfeTrack;
    card.innerHTML = D.html({
      p: p,
      rec: rec,
      dist: dist,
      userPos: state.userPos,
      walletWhole: W.getBalance(),
      tracking: T && T.isTracking(p.id),
      tab: state.tab,
      visibleTabs: state.visible,
      playerKey: W.playerKey(),
      walkLine: T && T.isTracking(p.id) ? T.chipLine() : "",
    });
    file.hidden = false;
    D.bindNav(card, () => state.tab, (name) => {
      state.tab = name;
      renderFile();
    });
  }

  function closeFile() {
    state.openId = null;
    const file = document.getElementById("catFile");
    const card = document.getElementById("catCard");
    if (file) file.hidden = true;
    if (card) card.innerHTML = "";
  }

  function openFile(id) {
    state.openId = id;
    state.tab = "place";
    renderFile();
  }

  function visitPlace(id, opts) {
    const p = placeById(id);
    if (!p) return;
    const idn = identity();
    if (!idn) {
      toast("Set your name on the map first.");
      return;
    }
    const dist = distTo(p);
    if (!state.userPos || dist > R.CLAIM_RADIUS_M) {
      toast("Walk within 80 m to pay.");
      return;
    }
    if (!W.ownable(p.catalog_type)) {
      toast(R.farmMsg());
      return;
    }
    const rec = placeRec(id);
    const pk = W.playerKey();
    const mine = rec.stakes[pk] || null;
    const first = !(mine && mine.amount > 0);
    const needPhoto = !(mine && mine.photo);
    const file = opts && opts.file;
    if (needPhoto && !(file && file.size > 0)) {
      toast("Take a photo of this place.");
      return;
    }
    const amount = Math.floor(Number(opts && opts.amount));
    let need = first ? W.minStake(p.claim_nairacoin, p.catalog_type) : 1;
    if (first && window.LvfeConquest && need > 0) {
      need = window.LvfeConquest.costToBack(need, p, window.LvfeConquest.get());
    }
    if (!Number.isFinite(amount) || amount < need) {
      toast("Need " + need + " NairaCoin to back this place.");
      return;
    }
    if (!W.debit(pk, amount)) {
      toast("Need " + amount + " NairaCoin · you have " + W.getBalance() + ".");
      return;
    }
    Ledger.applyIncomingStake(rec, {
      visitorId: pk,
      visitorName: idn.playerName,
      amount: amount,
      photo: file
        ? (window.LvfePhotoStore
          ? (window.LvfePhotoStore.confirm(id, pk, file), window.LvfePhotoStore.metaOf(file))
          : { name: file.name || "photo", size: file.size || 0, type: file.type || "image/*", at: new Date().toISOString() })
        : null,
    });
    if (file) rec.hasPhoto = true;
    let all = {};
    try { all = JSON.parse(localStorage.getItem(PLACES_KEY) || "{}") || {}; } catch (err) { all = {}; }
    all[id] = rec;
    localStorage.setItem(PLACES_KEY, JSON.stringify(all));
    if (window.LvfeConquest) window.LvfeConquest.refresh(state.all, all);
    render();
    toast("Put " + amount + " NairaCoin into this place");
  }

  function loadCatalog(data) {
    const places = data.places || data.features?.map((f) => {
      const p = f.properties;
      return {
        id: p.id,
        name: p.name,
        catalog_type: p.catalog_type,
        catalog_label: R.typeLabel(p),
        quality: p.quality,
        territory_id: p.territory_id,
        territory_name: p.territory_name || "Unclaimed",
        territory_role: p.territory_role,
        claim_nairacoin: p.claim_nairacoin != null ? p.claim_nairacoin : p.claim_points,
        claim_points: p.claim_points != null ? p.claim_points : p.claim_nairacoin,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    }) || [];
    state.all = places.map((p) => {
      p.catalog_label = R.typeLabel(p);
      return p;
    });
    const types = [...new Set(places.map((p) => R.typeLabel(p)))].sort();
    const terrs = [...new Set(places.map((p) => R.areaLabel(p)))].sort();
    fillSelect("qType", types, "All types");
    fillSelect("qTerr", terrs, "All neighbourhoods");
    if (window.LvfeConquest) {
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem(PLACES_KEY) || "{}") || {}; } catch (err) { stored = {}; }
      window.LvfeConquest.refresh(state.all, stored);
    }
    apply();
  }

  loadSecs();
  document.querySelectorAll("[data-sec]").forEach((box) => {
    box.addEventListener("change", () => {
      box.setAttribute("aria-checked", box.checked ? "true" : "false");
      saveSecs();
      if (state.openId) renderFile();
    });
  });
  ["qSearch", "qType", "qQuality", "qTerr", "qClaimed", "qView"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => { state.page = 0; apply(); });
    el.addEventListener("change", () => { state.page = 0; apply(); });
  });
  document.getElementById("prev").addEventListener("click", () => { state.page -= 1; render(); });
  document.getElementById("next").addEventListener("click", () => { state.page += 1; render(); });
  document.getElementById("catFileClose").addEventListener("click", closeFile);
  document.getElementById("catList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (!btn) return;
    openFile(btn.getAttribute("data-open"));
  });
  document.addEventListener("click", (e) => {
    const track = e.target.closest("[data-track]");
    if (track) {
      e.preventDefault();
      const p = placeById(track.getAttribute("data-track"));
      if (p && window.LvfeTrack) {
        window.LvfeTrack.unlockAudio();
        window.LvfeTrack.toggle({
          properties: p,
          geometry: { coordinates: [p.lon, p.lat] },
        });
        if (!state.userPos && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            state.userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            window.lvfeUserPos = state.userPos;
            if (window.LvfeTrack) window.LvfeTrack.onUserPos(state.userPos);
            renderFile();
          }, () => {}, { enableHighAccuracy: true });
        }
        renderFile();
      }
      return;
    }
    const walk = e.target.closest("[data-walk-closer]");
    if (walk) {
      e.preventDefault();
      const p = placeById(walk.getAttribute("data-walk-closer"));
      if (p) location.href = "index.html?lat=" + encodeURIComponent(p.lat) + "&lon=" + encodeURIComponent(p.lon) + "&open=" + encodeURIComponent(p.id);
    }
  });
  document.addEventListener("submit", (e) => {
    const form = e.target.closest(".visit-form");
    if (!form) return;
    e.preventDefault();
    const fileInput = form.querySelector('input[type="file"]');
    const amtInput = form.querySelector('input[name="amount"]');
    visitPlace(form.getAttribute("data-place"), {
      amount: amtInput ? amtInput.value : 0,
      file: fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null,
    });
  });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((pos) => {
      state.userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      window.lvfeUserPos = state.userPos;
      if (window.LvfeTrack) window.LvfeTrack.onUserPos(state.userPos);
      if (state.openId) renderFile();
    }, () => {}, { enableHighAccuracy: true, maximumAge: 4000 });
  }

  window.lvfeOnTrackChange = function () {
    if (state.openId) renderFile();
  };

  const params = new URLSearchParams(location.search);
  const qLat = parseFloat(params.get("lat"));
  const qLon = parseFloat(params.get("lon"));
  if (Number.isFinite(qLat) && Number.isFinite(qLon)) {
    state.userPos = { lat: qLat, lon: qLon };
    window.lvfeUserPos = state.userPos;
  }

  Promise.all([
    fetch(lvfeAsset("data/catalog.json")).then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch(lvfeAsset("data/places.geojson")).then((r) => r.ok ? r.json() : null).catch(() => null),
  ]).then(([cat, geo]) => {
    if (cat && cat.places) {
      cat.places = cat.places.map((p) => {
        p.catalog_label = R.typeLabel(p);
        p.claim_points = p.claim_nairacoin;
        return p;
      });
      loadCatalog(cat);
    } else if (geo) loadCatalog(geo);
    else document.getElementById("meta").textContent = "Places didn’t load. Open this from the Lvfe site.";
    const open = params.get("open");
    if (open) openFile(open);
  });
})();
