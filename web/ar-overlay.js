/* Camera world (Pokémon GO): visible <video id="arCam"> is the viewfinder.
   Do not cover it with WebGL — Nord WebView VideoTexture samples #000 and a
   full-bleed GL canvas lids the camera Surface. HTML pins sit above the video.
   Optional canvas2d drawImage (same #arThree, 2d only) if the video element
   itself will not paint. Pin labels never touch LvfeCatalogWallet (`W`). */
(function (global) {
  let stream = null;
  let orientHandler = null;
  let heading = 0;
  let drawId = 0;
  let getNearbyFn = null;
  let onFailFn = null;
  let htmlIds = "";
  let running = false;
  let canvasView = false;
  let ctx2d = null;

  function $(id) {
    return document.getElementById(id);
  }

  function hasCameraApi() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function nativePreview() {
    try {
      if (global.LvfeNative && typeof global.LvfeNative.hasNativePreview === "function") {
        const v = global.LvfeNative.hasNativePreview();
        if (v === true || v === 1 || v === "1" || v === "true") return true;
      }
    } catch (err) { /* desktop */ }
    return false;
  }

  function isSecureOrigin() {
    const host = location.hostname || "";
    return location.protocol === "https:" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "appassets.androidplatform.net";
  }

  function setHeading(deg) {
    if (!Number.isFinite(deg)) return;
    heading = (deg + 360) % 360;
  }

  function onOrient(e) {
    if (typeof e.webkitCompassHeading === "number") {
      setHeading(e.webkitCompassHeading);
    } else if (typeof e.alpha === "number") {
      setHeading(360 - e.alpha);
    }
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
  }

  function nearby() {
    return typeof getNearbyFn === "function" ? getNearbyFn() : [];
  }

  function hideFail() {
    const el = $("arFail");
    if (el) el.hidden = true;
  }

  function showFail(msg) {
    leaveWorld();
    const el = $("arFail");
    const t = $("arFailMsg");
    if (t) t.textContent = msg || "Camera couldn’t start";
    if (el) el.hidden = false;
    const box = $("toggleAr");
    if (box) box.checked = false;
    const btn = $("btnAr");
    if (btn) btn.setAttribute("aria-pressed", "false");
    if (onFailFn) onFailFn(msg || "Camera couldn’t start");
  }

  function setChrome(on) {
    const box = $("toggleAr");
    const btn = $("btnAr");
    if (box) box.checked = on;
    if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function dismissSheet() {
    const btn = $("sheetClose");
    if (btn) btn.click();
  }

  function setCanvasView(on) {
    canvasView = Boolean(on);
    document.body.classList.toggle("ar-canvas", canvasView);
    if (!canvasView) ctx2d = null;
  }

  function sizeCanvas(viewW, viewH) {
    const canvas = $("arThree");
    if (!canvas) return null;
    if (!ctx2d) {
      ctx2d = canvas.getContext("2d", { alpha: false });
      if (!ctx2d) return null;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.max(1, Math.round(viewW * dpr));
    const ph = Math.max(1, Math.round(viewH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    return ctx2d;
  }

  function drawCover(ctx, video, viewW, viewH) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw < 2 || vh < 2) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, viewW, viewH);
      return;
    }
    const va = vw / vh;
    const fa = viewW / Math.max(viewH, 1);
    let dw = viewW;
    let dh = viewH;
    let dx = 0;
    let dy = 0;
    if (va > fa) {
      dw = viewH * va;
      dx = (viewW - dw) / 2;
    } else {
      dh = viewW / va;
      dy = (viewH - dh) / 2;
    }
    ctx.drawImage(video, dx, dy, dw, dh);
  }

  function drawOrb(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r);
    g.addColorStop(0, "#8ec5ff");
    g.addColorStop(0.45, "#1a73e8");
    g.addColorStop(1, "rgba(26,115,232,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  function compassXY(f, dist, i, w, h, pos) {
    const R = global.LvfeRules;
    let x = w * 0.5;
    let y = h * (0.36 + Math.min(dist / 80, 1) * 0.28);
    if (pos && R && typeof R.bearingDeg === "function") {
      const [lon, lat] = f.geometry.coordinates;
      const brg = R.bearingDeg(pos.lat, pos.lon, lat, lon);
      const delta = ((brg - heading + 540) % 360) - 180;
      const halfFov = 30;
      if (Math.abs(delta) > halfFov + 10) return null;
      x = w * (0.5 + (delta / halfFov) * 0.48);
    } else {
      x = w * (0.22 + (i % 3) * 0.28);
      y = h * (0.28 + Math.floor(i / 3) * 0.14);
    }
    return { x: x, y: y };
  }

  function paintCanvas(video, near, viewW, viewH) {
    const ctx = sizeCanvas(viewW, viewH);
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, viewW, viewH);
    drawCover(ctx, video, viewW, viewH);
    const pos = global.lvfeUserPos;
    if (!pos) return;
    near.forEach(({ f, dist }, i) => {
      const xy = compassXY(f, dist, i, viewW, viewH, pos);
      if (!xy) return;
      const r = Math.max(14, Math.min(28, 220 / Math.max(dist, 8)));
      drawOrb(ctx, xy.x, xy.y, r);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
    }[c]));
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }

  function markedTarget() {
    if (global.lvfeTracked) return global.lvfeTracked;
    if (global.LvfeTrack && typeof global.LvfeTrack.get === "function") return global.LvfeTrack.get();
    return null;
  }

  function titleOf(p) {
    const R = global.LvfeRules;
    return R && typeof R.placeTitle === "function" ? R.placeTitle(p) : String((p && p.name) || "This place");
  }

  function typeOf(p) {
    const R = global.LvfeRules;
    return R && typeof R.typeLabel === "function" ? R.typeLabel(p) : "Place";
  }

  function paintTrackHud(w, h) {
    const hud = $("arTrackHud");
    const mEl = $("arTrackM");
    const hEl = $("arTrackHead");
    const t = markedTarget();
    const pos = global.lvfeUserPos;
    const R = global.LvfeRules;
    global.lvfeArHeading = heading;
    if (!hud) return;
    if (!t) {
      hud.hidden = true;
      return;
    }
    hud.hidden = false;
    if (!pos || !R) {
      if (mEl) mEl.textContent = "Waiting for GPS";
      if (hEl) hEl.textContent = "Turn on location";
      return;
    }
    const dist = R.haversineM(pos.lat, pos.lon, t.lat, t.lon);
    const brg = R.bearingDeg(pos.lat, pos.lon, t.lat, t.lon);
    const head = R.headingWords(heading, brg);
    const eta = R.walkEtaText(dist);
    if (mEl) mEl.textContent = Math.round(dist) + " m";
    if (hEl) hEl.textContent = head + " · " + eta;
    const live = document.querySelector("[data-ar-live]");
    if (live) live.textContent = Math.round(dist) + " m · " + head;
    const pin = document.querySelector(".ar-pin[data-ar-marked='1']");
    if (pin) {
      const fake = { geometry: { coordinates: [t.lon, t.lat] } };
      const xy = compassXY(fake, dist, 0, w, h, pos);
      if (!xy) {
        pin.style.visibility = "hidden";
      } else {
        pin.style.visibility = "visible";
        pin.style.left = xy.x + "px";
        pin.style.top = xy.y + "px";
      }
    }
  }

  function paintHtml(near, w, h) {
    const box = $("arPins");
    const hint = $("arHint");
    const pos = global.lvfeUserPos;
    const marked = markedTarget();
    paintTrackHud(w, h);
    if (!box) return;
    if (!pos) {
      box.innerHTML = "";
      htmlIds = "";
      if (hint && !marked) {
        hint.hidden = false;
        hint.textContent = "Turn on GPS to see nearby places.";
      } else if (hint) hint.hidden = true;
      return;
    }
    if (!near.length && !marked) {
      box.innerHTML = "";
      htmlIds = "";
      if (hint) {
        hint.hidden = false;
        hint.textContent = "No places within 80 m";
      }
      return;
    }
    if (hint) hint.hidden = true;
    const markId = marked ? String(marked.id) : "";
    const ids = near.map(({ f }) => String((f.properties || {}).id || "")).join("|") + "|m:" + markId;
    if (ids !== htmlIds) {
      htmlIds = ids;
      const pins = near.map(({ f }) => {
        const p = f.properties || {};
        return `<button type="button" class="ar-pin" data-ar-place="${escAttr(p.id)}">` +
          `<strong>${esc(titleOf(p))}</strong>` +
          `<span>${esc(typeOf(p))} · <em data-ar-near="${escAttr(p.id)}"></em></span></button>`;
      });
      if (marked && !near.some(({ f }) => String((f.properties || {}).id) === markId)) {
        pins.push(
          `<button type="button" class="ar-pin" data-ar-place="${escAttr(marked.id)}" data-ar-marked="1">` +
          `<strong>${esc(titleOf({ name: marked.name }))}</strong>` +
          `<span><em data-ar-live>0 m</em></span></button>`
        );
      } else if (marked) {
        /* marked is already in nearby — live metres still go on HUD + data-ar-near */
      }
      box.innerHTML = pins.join("");
    }
    const btns = box.querySelectorAll(".ar-pin:not([data-ar-marked])");
    near.forEach(({ f, dist }, i) => {
      const el = btns[i];
      if (!el) return;
      const live = el.querySelector("[data-ar-near]");
      if (live) live.textContent = Math.round(dist) + " m";
      const xy = compassXY(f, dist, i, w, h, pos);
      if (!xy) {
        el.style.visibility = "hidden";
        return;
      }
      el.style.visibility = "visible";
      el.style.left = xy.x + "px";
      el.style.top = xy.y + "px";
    });
    paintTrackHud(w, h);
  }

  function tick() {
    if (!running) {
      drawId = 0;
      return;
    }
    const stage = $("arStage");
    const video = $("arCam");
    if (!stage || stage.hidden || !video) {
      drawId = 0;
      return;
    }
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    const near = nearby();
    if (canvasView) paintCanvas(video, near, w, h);
    try {
      paintHtml(near, w, h);
    } catch (err) { /* pin labels must not kill the viewfinder */ }
    drawId = requestAnimationFrame(tick);
  }

  function leaveWorld() {
    running = false;
    if (drawId) {
      cancelAnimationFrame(drawId);
      drawId = 0;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    const video = $("arCam");
    if (video) {
      video.srcObject = null;
    }
    const stage = $("arStage");
    if (stage) stage.hidden = true;
    const pins = $("arPins");
    if (pins) pins.innerHTML = "";
    const hint = $("arHint");
    if (hint) hint.hidden = true;
    const hud = $("arTrackHud");
    if (hud) hud.hidden = true;
    document.body.classList.remove("ar-on");
    document.body.classList.remove("ar-native");
    document.documentElement.classList.remove("ar-native");
    try {
      if (global.LvfeNative && typeof global.LvfeNative.stopArCamera === "function") {
        global.LvfeNative.stopArCamera();
      }
    } catch (err) { /* desktop */ }
    setCanvasView(false);
    stopCompass();
    htmlIds = "";
    try { window.dispatchEvent(new Event("resize")); } catch (err) { /* */ }
  }

  function enterWorld() {
    hideFail();
    dismissSheet();
    const stage = $("arStage");
    if (stage) stage.hidden = false;
    document.body.classList.add("ar-on");
    startCompass();
    running = true;
    if (!drawId) drawId = requestAnimationFrame(tick);
  }

  function waitPlaying(video, ms) {
    if (!video.paused && video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      const ok = () => { clearTimeout(t); resolve(); };
      const bad = () => { clearTimeout(t); reject(new Error("error")); };
      video.addEventListener("playing", ok, { once: true });
      video.addEventListener("error", bad, { once: true });
    });
  }

  function waitVideoSize(video, ms) {
    if (video.videoWidth >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const id = setInterval(() => {
        if (video.videoWidth >= 2) {
          clearInterval(id);
          resolve();
        } else if (Date.now() - t0 > ms) {
          clearInterval(id);
          reject(new Error("timeout"));
        }
      }, 50);
    });
  }

  function playVideo(video) {
    try {
      const p = video.play();
      if (p && typeof p.then === "function") {
        return p.catch((err) => {
          showFail("Camera couldn’t start");
          throw err;
        });
      }
    } catch (err) {
      showFail("Camera couldn’t start");
      return Promise.reject(err);
    }
    return Promise.resolve();
  }

  function gum(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  function startStream() {
    return gum({ audio: false, video: { facingMode: { ideal: "environment" } } })
      .catch(() => gum({ audio: false, video: { facingMode: "environment" } }))
      .catch(() => gum({ audio: false, video: true }));
  }

  function startNativePreview() {
    try {
      global.LvfeNative.startArCamera();
    } catch (err) {
      showFail("Camera couldn’t start");
      return Promise.resolve(false);
    }
    document.documentElement.classList.add("ar-native");
    document.body.classList.add("ar-native");
    enterWorld();
    return Promise.resolve(true);
  }

  function startCamera() {
    hideFail();
    if (nativePreview()) {
      return startNativePreview();
    }
    if (!isSecureOrigin()) {
      showFail("Camera couldn’t start");
      return Promise.resolve(false);
    }
    if (!hasCameraApi()) {
      showFail("Camera couldn’t start");
      return Promise.resolve(false);
    }
    return startStream().then((s) => {
      stream = s;
      const video = $("arCam");
      if (!video) {
        showFail("Camera couldn’t start");
        return false;
      }
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("muted", "");
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.controls = false;
      video.srcObject = s;
      enterWorld();
      return playVideo(video)
        .then(() => waitPlaying(video, 8000))
        .then(() => waitVideoSize(video, 4000))
        .then(() => {
          if (!video.srcObject || video.videoWidth < 2) {
            showFail("Camera couldn’t start");
            return false;
          }
          return true;
        });
    }).catch(() => {
      showFail("Camera couldn’t start");
      return false;
    });
  }

  function stopCamera() {
    hideFail();
    leaveWorld();
    setChrome(false);
  }

  function selectPlace(id) {
    if (!id) return;
    const feat = typeof global.placeById === "function" ? global.placeById(id) : null;
    if (feat && typeof global.openPlacePopup === "function") {
      global.openPlacePopup(feat);
    }
  }

  function lvfeEnableAr(opts) {
    const box = $("toggleAr");
    if (!box || box.dataset.lvfeArBound === "1") return;
    box.dataset.lvfeArBound = "1";
    getNearbyFn = opts && opts.getNearby;
    onFailFn = opts && opts.onFail;
    global.lvfeArNativeFail = function () {
      showFail("Camera couldn’t start");
    };
    box.addEventListener("change", () => {
      if (!box.checked) {
        leaveWorld();
        const btn = $("btnAr");
        if (btn) btn.setAttribute("aria-pressed", "false");
        return;
      }
      startCamera();
    });
    const exit = $("arExit");
    if (exit) {
      exit.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopCamera();
      });
    }
    const failClose = $("arFailClose");
    if (failClose) {
      failClose.addEventListener("click", (e) => {
        e.preventDefault();
        hideFail();
        stopCamera();
      });
    }
    const pins = $("arPins");
    if (pins && pins.dataset.lvfeTap !== "1") {
      pins.dataset.lvfeTap = "1";
      pins.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-ar-place]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        selectPlace(btn.getAttribute("data-ar-place"));
      });
    }
    const params = new URLSearchParams(location.search);
    if (params.get("ar") === "1") {
      box.checked = true;
      box.dispatchEvent(new Event("change"));
    }
  }

  global.lvfeEnableAr = lvfeEnableAr;
  global.lvfeArStop = stopCamera;
  global.lvfeArUseCanvas = setCanvasView;
})(typeof window !== "undefined" ? window : globalThis);
