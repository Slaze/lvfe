(function () {
  const R = window.LvfeRules;
  const W = window.LvfeCatalogWallet;
  const params = new URLSearchParams(location.search);
  const qLat = parseFloat(params.get("lat"));
  const qLon = parseFloat(params.get("lon"));
  const forcedPos = Number.isFinite(qLat) && Number.isFinite(qLon)
    ? { lat: qLat, lon: qLon, acc: Number.isFinite(parseFloat(params.get("acc"))) ? parseFloat(params.get("acc")) : 12 }
    : null;

  const video = document.getElementById("cam");
  const canvas = document.getElementById("overlay");
  const ctx = canvas.getContext("2d");
  const banner = document.getElementById("banner");
  const listEl = document.getElementById("nearbyList");

  let places = [];
  let userPos = forcedPos;
  let heading = null;
  let toastTimer = 0;

  function isPhone() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function renderBal() {
    document.getElementById("ncBal").textContent = W.balanceLabel();
    const note = document.getElementById("ncNote");
    if (note) note.textContent = W.faucetNote();
  }

  function setGpsLabel() {
    const el = document.getElementById("gpsLabel");
    if (!userPos) {
      el.textContent = "Location off";
      return;
    }
    const acc = Math.round(userPos.acc || 0);
    el.textContent = forcedPos ? `Test location ±${acc} m` : `Location ±${acc} m`;
  }

  function asPlace(f) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return {
      id: p.id,
      name: p.name,
      catalog_type: p.catalog_type,
      quality: p.quality,
      territory_name: p.territory_name || "Unclaimed",
      territory_role: p.territory_role,
      claim_nairacoin: p.claim_nairacoin != null ? p.claim_nairacoin : p.claim_points,
      lat,
      lon,
    };
  }

  function nearby() {
    if (!userPos) return [];
    const out = [];
    for (const p of places) {
      const dist = R.haversineM(userPos.lat, userPos.lon, p.lat, p.lon);
      if (dist <= R.CLAIM_RADIUS_M) out.push({ p, dist });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  function mapHref() {
    const q = new URLSearchParams(location.search);
    if (userPos) {
      q.set("lat", String(userPos.lat));
      q.set("lon", String(userPos.lon));
    }
    const s = q.toString();
    return s ? "index.html?" + s : "index.html";
  }

  function refreshList() {
    setGpsLabel();
    renderBal();
    const near = nearby();
    if (!userPos) {
      listEl.textContent = "Turn on location to see nearby places. Photo + NairaCoin still happen on the map.";
      return;
    }
    if (!near.length) {
      listEl.textContent = "Walk closer.";
      return;
    }
    listEl.innerHTML = near.map(({ p, dist }) => {
      const farm = !W.ownable(p.catalog_type);
      const min = W.minStake(p.claim_nairacoin, p.catalog_type);
      const action = farm
        ? `<span class="sub">0 NairaCoin · cannot be owned.</span>`
        : `<a class="claim" style="display:inline-block;text-decoration:none" href="${R.esc(mapHref())}">Put coins in on the map · ${min} NairaCoin to back</a>`;
      return `<div class="near-item"><strong>${R.esc(R.placeTitle(p))}</strong>` +
        `<span class="sub">${Math.round(dist)} m · ${R.esc(R.typeLabel(p))} · ${R.esc(R.qualityLabel(p.quality))} · ${R.esc(R.areaLabel(p))} · ${farm ? "0 NairaCoin · cannot be owned" : min + " NairaCoin to back"}</span>` +
        action + `</div>`;
    }).join("");
  }

  function sizeCanvas() {
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const near = nearby();
    if (!near.length) {
      requestAnimationFrame(draw);
      return;
    }
    ctx.font = `${Math.round(14 * (window.devicePixelRatio || 1))}px system-ui, sans-serif`;
    near.forEach(({ p, dist }, i) => {
      let x = w * 0.5;
      let y = h * (0.28 + Math.min(dist / R.CLAIM_RADIUS_M, 1) * 0.35);
      if (heading != null && userPos) {
        const brg = R.bearingDeg(userPos.lat, userPos.lon, p.lat, p.lon);
        let delta = ((brg - heading + 540) % 360) - 180;
        const halfFov = 35;
        x = w * (0.5 + (delta / halfFov) * 0.5);
        if (Math.abs(delta) > halfFov + 8) return;
      } else {
        x = w * (0.18 + (i % 3) * 0.28);
        y = h * (0.22 + Math.floor(i / 3) * 0.12);
      }
      const min = W.minStake(p.claim_nairacoin, p.catalog_type);
      const label = W.ownable(p.catalog_type)
        ? `${R.placeTitle(p)}  ${min} to back  ${Math.round(dist)}m`
        : `${R.placeTitle(p)}  0 NairaCoin  ${Math.round(dist)}m`;
      const pad = 8 * (window.devicePixelRatio || 1);
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(14,17,22,0.72)";
      ctx.fillRect(x - tw / 2 - pad, y - 18, tw + pad * 2, 28);
      ctx.fillStyle = W.owned(p.id) ? "#8b98a8" : "#2ecc71";
      ctx.fillText(label, x - tw / 2, y);
    });
    requestAnimationFrame(draw);
  }

  function onOrient(e) {
    if (typeof e.webkitCompassHeading === "number") {
      heading = e.webkitCompassHeading;
      return;
    }
    if (typeof e.alpha === "number") {
      heading = (360 - e.alpha) % 360;
    }
  }

  async function startHeading() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== "granted") return;
      }
      window.addEventListener("deviceorientationabsolute", onOrient, true);
      window.addEventListener("deviceorientation", onOrient, true);
    } catch (err) { /* heading is optional */ }
  }

  async function startCamera() {
    const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!isPhone()) {
      banner.hidden = false;
      banner.textContent = "AR needs a phone with a camera. Use the map on a computer. On a phone, use HTTPS or http://127.0.0.1.";
    }
    if (!secure) {
      banner.hidden = false;
      banner.textContent = "Camera needs HTTPS or http://127.0.0.1. This page is not a trusted address, so the camera may stay off.";
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      banner.hidden = false;
      if (!banner.textContent.includes("phone")) {
        banner.textContent = "This browser has no camera. Use a phone (HTTPS or http://127.0.0.1). Map and Catalog still work.";
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      if (isPhone() && secure) banner.hidden = true;
      await startHeading();
    } catch (err) {
      banner.hidden = false;
      banner.textContent = "Camera is off. Nearby places still work with location. Try HTTPS or http://127.0.0.1 on a phone.";
      toast("Camera blocked — nearby list still works.");
    }
  }

  function startGps() {
    if (forcedPos) {
      userPos = forcedPos;
      refreshList();
      return;
    }
    if (!navigator.geolocation) {
      listEl.textContent = "Location is off on this device.";
      return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        userPos = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy || 0,
        };
        refreshList();
      },
      () => {
        if (!forcedPos) {
          userPos = null;
          setGpsLabel();
          listEl.textContent = "Location blocked. Allow location, or walk with a phone.";
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 4000 }
    );
  }

  renderBal();
  setGpsLabel();
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);
  startGps();
  startCamera();
  requestAnimationFrame(draw);

  fetch(lvfeAsset("data/places.geojson"))
    .then((r) => r.json())
    .then((fc) => {
      places = (fc.features || []).map(asPlace);
      refreshList();
    })
    .catch(() => {
      listEl.textContent = "Places didn’t load. Open this from the Lvfe site.";
    });
})();
