/* Camera overlay of nearby catalog pins. Distinct from MapLibre 3D buildings.
   Integrates the phone camera + compass overlay; stake stays on the map HUD.
   Desktop: refuse without crashing the map. HTTPS or localhost for getUserMedia. */
(function (global) {
  let stream = null;
  let orientHandler = null;
  let heading = null;
  let drawId = 0;
  let getNearbyFn = null;

  function isPhone() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 900px)").matches);
  }

  function hasCameraApi() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function isSecureOrigin() {
    return location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
  }

  function setHeading(deg) {
    if (!Number.isFinite(deg)) return;
    heading = (deg + 360) % 360;
  }

  function onOrient(e) {
    if (typeof e.webkitCompassHeading === "number") {
      setHeading(e.webkitCompassHeading);
      return;
    }
    if (typeof e.alpha === "number") setHeading(360 - e.alpha);
  }

  function startCompass() {
    if (orientHandler) return;
    orientHandler = onOrient;
    window.addEventListener("deviceorientationabsolute", orientHandler, true);
    window.addEventListener("deviceorientation", orientHandler, true);
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  function stopCompass() {
    if (!orientHandler) return;
    window.removeEventListener("deviceorientationabsolute", orientHandler, true);
    window.removeEventListener("deviceorientation", orientHandler, true);
    orientHandler = null;
    heading = null;
  }

  function sizeCanvas() {
    const canvas = document.getElementById("arCanvas");
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function drawFrame() {
    const canvas = document.getElementById("arCanvas");
    if (!canvas || canvas.hidden) {
      drawId = 0;
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      drawId = requestAnimationFrame(drawFrame);
      return;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const near = typeof getNearbyFn === "function" ? getNearbyFn() : [];
    const R = global.LvfeRules;
    const pos = global.lvfeUserPos;
    const dpr = window.devicePixelRatio || 1;
    ctx.font = `${Math.round(14 * dpr)}px system-ui, sans-serif`;
    near.forEach(({ f, dist }, i) => {
      const p = f.properties;
      let x = w * 0.5;
      let y = h * (0.28 + Math.min(dist / 80, 1) * 0.35);
      if (heading != null && pos && R && typeof R.bearingDeg === "function") {
        const [lon, lat] = f.geometry.coordinates;
        const brg = R.bearingDeg(pos.lat, pos.lon, lat, lon);
        const delta = ((brg - heading + 540) % 360) - 180;
        const halfFov = 35;
        if (Math.abs(delta) > halfFov + 8) return;
        x = w * (0.5 + (delta / halfFov) * 0.5);
      } else {
        x = w * (0.18 + (i % 3) * 0.28);
        y = h * (0.22 + Math.floor(i / 3) * 0.12);
      }
      const farm = W && typeof W.ownable === "function" ? !W.ownable(p.catalog_type) : (p.catalog_type === "bank" || p.catalog_type === "atm");
      const min = W && typeof W.minStake === "function"
        ? W.minStake(p.claim_points, p.catalog_type)
        : (farm ? 0 : Math.max(5, Number(p.claim_points) || 5));
      const label = farm
        ? `${p.name}  0 NairaCoin  ${Math.round(dist)}m`
        : `${p.name}  min ${min}  ${Math.round(dist)}m`;
      const pad = 8 * dpr;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(14,17,22,0.72)";
      ctx.fillRect(x - tw / 2 - pad, y - 18, tw + pad * 2, 28);
      ctx.fillStyle = "#e67e22";
      ctx.fillText(label, x - tw / 2, y);
    });
    drawId = requestAnimationFrame(drawFrame);
  }

  function renderPins() {
    const box = document.getElementById("arPins");
    if (!box) return;
    const near = typeof getNearbyFn === "function" ? getNearbyFn() : [];
    const R = global.LvfeRules;
    if (!near.length) {
      box.textContent = "No catalog pins within 80 m.";
      return;
    }
    box.innerHTML = near.map(({ f, dist }) => {
      const p = f.properties;
      const name = R ? R.esc(p.name) : p.name;
      const farm = p.catalog_type === "bank" || p.catalog_type === "atm";
      const min = farm ? 0 : Math.max(5, Number(p.claim_points) || 5);
      return `<button type="button" class="ar-pin" data-jump="${p.id}">` +
        `<strong>${name}</strong>` +
        `<span>${Math.round(dist)} m · ${p.catalog_type} · ${farm ? "0 NairaCoin · not ownable" : "min stake " + min + " NairaCoin"}</span></button>`;
    }).join("");
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    const video = document.getElementById("arCam");
    if (video) {
      video.srcObject = null;
      video.hidden = true;
    }
    const canvas = document.getElementById("arCanvas");
    if (canvas) canvas.hidden = true;
    const layer = document.getElementById("arLayer");
    if (layer) layer.hidden = true;
    document.body.classList.remove("ar-on");
    stopCompass();
  }

  function startCamera(onFail) {
    if (!isPhone()) {
      if (onFail) onFail("AR needs a phone camera. The map stays usable on desktop.");
      return Promise.resolve(false);
    }
    if (!isSecureOrigin()) {
      if (onFail) onFail("Camera needs HTTPS or localhost. LAN HTTP IPs often block getUserMedia.");
      return Promise.resolve(false);
    }
    if (!hasCameraApi()) {
      if (onFail) onFail("AR needs a phone camera.");
      return Promise.resolve(false);
    }
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    }).then((s) => {
      stream = s;
      const video = document.getElementById("arCam");
      const canvas = document.getElementById("arCanvas");
      const layer = document.getElementById("arLayer");
      if (video) {
        video.srcObject = s;
        video.hidden = false;
        const play = video.play();
        if (play && play.catch) play.catch(() => {});
      }
      if (canvas) {
        canvas.hidden = false;
        sizeCanvas();
      }
      if (layer) layer.hidden = false;
      document.body.classList.add("ar-on");
      startCompass();
      renderPins();
      if (!drawId) drawId = requestAnimationFrame(drawFrame);
      return true;
    }).catch(() => {
      stopCamera();
      if (onFail) onFail("AR needs a phone camera (HTTPS or localhost).");
      return false;
    });
  }

  function lvfeEnableAr(opts) {
    const box = document.getElementById("toggleAr");
    if (!box || box.dataset.lvfeArBound === "1") return;
    box.dataset.lvfeArBound = "1";
    getNearbyFn = opts && opts.getNearby;
    const onFail = opts && opts.onFail;
    box.addEventListener("change", () => {
      if (!box.checked) {
        stopCamera();
        return;
      }
      startCamera((msg) => {
        box.checked = false;
        if (onFail) onFail(msg);
      });
    });
    window.addEventListener("resize", () => {
      if (box.checked) sizeCanvas();
    });
    setInterval(() => {
      if (box.checked) renderPins();
    }, 900);
    const params = new URLSearchParams(location.search);
    if (params.get("ar") === "1") {
      box.checked = true;
      box.dispatchEvent(new Event("change"));
    }
  }

  global.lvfeEnableAr = lvfeEnableAr;
  global.lvfeArStop = stopCamera;
})(typeof window !== "undefined" ? window : globalThis);
