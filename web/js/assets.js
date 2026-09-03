/* My assets: owned + backed places, visit interest, gap vs the next person. */
(function () {
  const R = window.LvfeRules;
  const W = window.LvfeCatalogWallet;
  const PLACES_KEY = "lvfe.places.v1";
  const SEC_KEY = "lvfe.assets.tabs.v1";
  const visible = { owned: true, backed: true, earn: true, race: true };

  function esc(s) {
    return R.esc(s);
  }

  function loadSecs() {
    try {
      const o = JSON.parse(localStorage.getItem(SEC_KEY) || "null");
      if (o && typeof o === "object") Object.assign(visible, o);
    } catch (err) { /* */ }
    document.querySelectorAll("[data-sec]").forEach((box) => {
      box.checked = visible[box.getAttribute("data-sec")] !== false;
      box.setAttribute("aria-checked", box.checked ? "true" : "false");
    });
  }

  function saveSecs() {
    document.querySelectorAll("[data-sec]").forEach((box) => {
      visible[box.getAttribute("data-sec")] = box.checked;
    });
    try { localStorage.setItem(SEC_KEY, JSON.stringify(visible)); } catch (err) { /* */ }
  }

  function loadPlaces() {
    try {
      const o = JSON.parse(localStorage.getItem(PLACES_KEY) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (err) {
      return {};
    }
  }

  function identity(pk) {
    try {
      const o = JSON.parse(localStorage.getItem("lvfe.identity." + pk) || "null");
      if (o && o.playerName) return { playerName: String(o.playerName).slice(0, 32), factionId: o.factionId || "" };
    } catch (err) { /* */ }
    return null;
  }

  function stakeList(rec) {
    const out = [];
    const stakes = (rec && rec.stakes) || {};
    Object.keys(stakes).forEach((pid) => {
      const st = stakes[pid];
      const amt = Number(st && st.amount) || 0;
      if (!(amt > 0)) return;
      out.push({
        pid: pid,
        amt: amt,
        name: (st && st.playerName) || pid,
        firstAt: String((st && st.firstAt) || ""),
      });
    });
    out.sort((a, b) => (b.amt - a.amt) || a.firstAt.localeCompare(b.firstAt));
    return out;
  }

  function raceCopy(rec, pk) {
    const ranks = stakeList(rec);
    const mine = ranks.find((s) => s.pid === pk);
    const myAmt = mine ? mine.amt : 0;
    const owned = rec.ownerId === pk;
    if (!ranks.length) {
      return "No one has put NairaCoin in yet.";
    }
    if (owned) {
      const second = ranks.find((s) => s.pid !== pk);
      if (!second) {
        return "You’re the only backer. Someone else would need more than " +
          myAmt + " NairaCoin to take this place.";
      }
      const gap = myAmt - second.amt;
      return "You’re ahead of " + second.name + " by " + gap +
        " NairaCoin. They need " + (gap + 1) + " more than they have now to take it.";
    }
    const leader = ranks[0];
    const gap = leader.amt - myAmt;
    if (!(myAmt > 0)) {
      return leader.name + " owns it with " + leader.amt +
        " NairaCoin. Put in more than that to take it.";
    }
    return "You need " + gap + " more NairaCoin than " + leader.name + " to own this place.";
  }

  function earnCopy(owned) {
    if (owned) {
      return "When someone else walks up and puts NairaCoin in, you earn visit interest — about 10% of what they put in.";
    }
    return "You don’t earn visit interest here. The owner does — whoever has put the most NairaCoin in.";
  }

  function rowsFrom(placesFc, stored, pk) {
    const rows = [];
    const feats = (placesFc && placesFc.features) || [];
    for (let i = 0; i < feats.length; i++) {
      const p = feats[i].properties || {};
      const rec = stored[p.id];
      if (!rec || !rec.stakes) continue;
      const st = rec.stakes[pk];
      const owned = rec.ownerId === pk;
      const stake = st ? Number(st.amount) || 0 : 0;
      if (!owned && !(stake > 0)) continue;
      rows.push({
        id: p.id,
        name: R.placeTitle(p),
        type: R.typeLabel(p),
        owned: owned,
        stake: stake,
        value: Number(rec.value) || 0,
        race: raceCopy(rec, pk),
        earn: earnCopy(owned),
      });
    }
    rows.sort((a, b) => (b.owned - a.owned) || (b.stake - a.stake) || a.name.localeCompare(b.name));
    return rows;
  }

  function render(rows, pk) {
    const idn = identity(pk);
    const who = document.getElementById("whoLine");
    if (who) {
      who.textContent = idn
        ? ("Playing as " + idn.playerName + " · places you own or have backed.")
        : "Set your name on the map to back places. Showing this phone’s coins.";
    }
    document.getElementById("ncBal").textContent = String(W.getBalance(pk));
    const ownedN = rows.filter((r) => r.owned).length;
    const backedN = rows.filter((r) => !r.owned).length;
    document.getElementById("meta").textContent =
      ownedN + " owned · " + backedN + " backed · on this phone";
    const box = document.getElementById("assetList");
    const showOwned = visible.owned;
    const showBacked = visible.backed;
    const filtered = rows.filter((r) => (r.owned && showOwned) || (!r.owned && showBacked));
    if (!filtered.length) {
      box.innerHTML = "<p class='meta'>None yet. Walk up, take a photo, and put NairaCoin into a place.</p>";
      return;
    }
    box.innerHTML = filtered.map((a) => {
      let body = "<strong>" + esc(a.name) + "</strong>";
      body += "<span class='asset-kicker'>" + esc(a.type) + " · " +
        (a.owned ? "you own this" : "you backed this") +
        " · you put in " + a.stake + " · " + a.value + " in this place</span>";
      if (visible.earn) body += "<p class='asset-earn'>" + esc(a.earn) + "</p>";
      if (visible.race) body += "<p class='asset-race'>" + esc(a.race) + "</p>";
      return "<a class='cat-row asset-row' href='index.html?open=" + encodeURIComponent(a.id) + "'>" +
        body + "</a>";
    }).join("");
  }

  loadSecs();
  document.querySelectorAll("[data-sec]").forEach((box) => {
    box.addEventListener("change", () => {
      box.setAttribute("aria-checked", box.checked ? "true" : "false");
      saveSecs();
      const pk = W.playerKey();
      const stored = loadPlaces();
      const cache = window.__lvfePlacesFc;
      render(cache ? rowsFrom(cache, stored, pk) : [], pk);
    });
  });

  const pk = W.playerKey();
  const stored = loadPlaces();
  fetch(lvfeAsset("data/places.geojson")).then((r) => r.json()).then((fc) => {
    window.__lvfePlacesFc = fc;
    render(rowsFrom(fc, stored, pk), pk);
  }).catch(() => {
    document.getElementById("meta").textContent = "Places didn’t load.";
  });
})();
