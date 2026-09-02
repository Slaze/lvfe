#!/usr/bin/env node
/* Desk-test Ada/Chidi endowment in headless Chrome. Not player-facing. */
import { spawn } from "child_process";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9223;
const ORIGIN = "http://127.0.0.1:8765";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return res.json();
    } catch (err) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error("chrome debug port did not open");
}

async function cdp(ws, method, params) {
  const id = cdp.n = (cdp.n || 0) + 1;
  return new Promise((resolve, reject) => {
    const onmsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener("message", onmsg);
      if (msg.error) reject(new Error(method + " " + JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onmsg);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function evalPage(ws, expr, awaitPromise = false) {
  const r = await cdp(ws, "Runtime.evaluate", {
    expression: expr,
    awaitPromise,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

async function waitReady(ws) {
  for (let i = 0; i < 80; i++) {
    try {
      const ok = await evalPage(ws, `typeof visitPlace==="function" && !!(document.getElementById("nearbyList") && document.getElementById("nearbyList").innerHTML.includes("Chukky"))`);
      if (ok) return;
    } catch (err) { /* nav / context */ }
    await sleep(250);
  }
  throw new Error("page never ready");
}

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/lvfe-desk-chrome",
    `${ORIGIN}/web/?lat=6.4578996&lon=7.5143211&player=ada&faction=independence_layout`,
  ], { stdio: "ignore" });
  try {
    await waitWs();
    const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = tabs.find((t) => t.type === "page") || tabs[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    await cdp(ws, "Runtime.enable");
    await cdp(ws, "Page.enable");
    await waitReady(ws);
    const ada = await evalPage(ws, `
      (async () => {
        const bytes = Uint8Array.from(atob("${PNG.toString("base64")}"), c => c.charCodeAt(0));
        const file = new File([bytes], "stub.png", { type: "image/png" });
        visitPlace("n_8752997542", { amount: 42, file });
        await new Promise(r => setTimeout(r, 200));
        const rec = JSON.parse(localStorage.getItem("lvfe.places.v1")||"{}")["n_8752997542"];
        return {
          hud: document.getElementById("ncTotal").textContent,
          note: document.getElementById("iouNote").textContent,
          crumbs: document.body.innerText.includes("Explorer"),
          bankVisit: document.body.innerText.includes("Visit ·"),
          rec,
        };
      })()
    `, true);
    await Promise.all([
      new Promise((res) => {
        const onmsg = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.method === "Page.loadEventFired") {
            ws.removeEventListener("message", onmsg);
            res();
          }
        };
        ws.addEventListener("message", onmsg);
      }),
      cdp(ws, "Page.navigate", { url: `${ORIGIN}/web/?lat=6.4578996&lon=7.5143211&player=chidi&faction=coal_camp` }),
    ]);
    await sleep(400);
    await waitReady(ws);
    const chidi = await evalPage(ws, `
      (async () => {
        const bytes = Uint8Array.from(atob("${PNG.toString("base64")}"), c => c.charCodeAt(0));
        const file = new File([bytes], "stub.png", { type: "image/png" });
        visitPlace("n_8752997542", { amount: 50, file });
        await new Promise(r => setTimeout(r, 250));
        const rec = JSON.parse(localStorage.getItem("lvfe.places.v1")||"{}")["n_8752997542"];
        const adaW = JSON.parse(localStorage.getItem("lvfe.nc.iou.v1.ada")||"{}");
        const chidiW = JSON.parse(localStorage.getItem("lvfe.nc.iou.v1.chidi")||"{}");
        const pool = JSON.parse(localStorage.getItem("lvfe.factionpool.v1")||"{}");
        const ATOMIC = 100000000;
        return {
          rec,
          adaWhole: Math.floor((adaW.atomic||0)/ATOMIC),
          chidiWhole: Math.floor((chidiW.atomic||0)/ATOMIC),
          pool,
          hud: document.getElementById("ncTotal").textContent,
          factionLine: document.getElementById("factionLine").textContent,
          bankBtn: document.body.innerText.includes("Visit · +1"),
          ar: !!document.getElementById("toggleAr"),
          d3: !!document.getElementById("toggle3d") || document.body.innerText.includes("3D buildings"),
        };
      })()
    `, true);
    console.log(JSON.stringify({ ada, chidi }, null, 2));
    const rec = chidi.rec;
    const sum = Object.values(rec.stakes||{}).reduce((n,s)=>n+(Number(s.amount)||0),0);
    if (rec.value !== sum) throw new Error("value !== sum(stakes) " + rec.value + " vs " + sum);
    if (rec.ownerId !== "chidi") throw new Error("expected chidi owner, got " + rec.ownerId);
    if (chidi.adaWhole !== 62) throw new Error("ada wallet " + chidi.adaWhole);
    if (chidi.chidiWhole !== 50) throw new Error("chidi wallet " + chidi.chidiWhole);
    if ((chidi.pool.independence_layout||0) !== 1) throw new Error("faction pool " + JSON.stringify(chidi.pool));
    if (ada.crumbs || chidi.bankBtn) throw new Error("crumbs/bank visit still present");
    if (!chidi.ar) throw new Error("missing AR toggle");
    console.log("desk contest ok: value", rec.value, "owner", rec.ownerId, "ada", chidi.adaWhole, "chidi", chidi.chidiWhole);
    ws.close();
  } finally {
    chrome.kill("SIGKILL");
  }
})().catch((err) => { console.error(err); process.exit(1); });
