(function () {
  const PAGE = 40;
  const R = window.LvfeRules;
  const W = window.LvfeCatalogWallet;

  const state = {
    all: [],
    view: [],
    page: 0,
    sort: "stake",
    dir: "desc",
  };

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
      if (terr && p.territory_name !== terr) return false;
      const mine = W.iOwn(p.id) || W.myStake(p.id) > 0;
      if (view === "mine" && !mine) return false;
      if (claimed === "yes" && !W.iOwn(p.id)) return false;
      if (claimed === "no" && W.iOwn(p.id)) return false;
      if (q) {
        const blob = `${p.name} ${p.catalog_label} ${p.territory_name}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    const dir = state.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (state.sort === "stake") return (a.claim_nairacoin - b.claim_nairacoin) * dir;
      if (state.sort === "quality") return a.quality.localeCompare(b.quality) * dir;
      if (state.sort === "type") return a.catalog_label.localeCompare(b.catalog_label) * dir;
      if (state.sort === "territory") return a.territory_name.localeCompare(b.territory_name) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
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
    const tb = document.getElementById("catBody");
    tb.innerHTML = slice.map((p) => {
      const owned = W.iOwn(p.id);
      const farm = !W.ownable(p.catalog_type);
      const mapHref = `index.html?lat=${encodeURIComponent(p.lat)}&lon=${encodeURIComponent(p.lon)}`;
      const stake = W.myStake(p.id);
      const note = farm ? " <span class=\"sub\">cannot be owned</span>" : (owned ? " <span class=\"sub\">owner</span>" : (stake ? " <span class=\"sub\">backed</span>" : ""));
      const min = W.minStake(p.claim_nairacoin, p.catalog_type);
      const cell = farm
        ? "0 NairaCoin · cannot be owned"
        : (stake ? `${min} NairaCoin to back · you put in ${stake} · ${W.placeValue(p.id)} in this place` : `${min} NairaCoin to back`);
      return `<tr>
        <td>${R.esc(p.name)}${note}</td>
        <td>${R.esc(p.catalog_label)}</td>
        <td class="q${R.esc(p.quality)}">${R.esc(p.quality)} — ${R.esc(R.qualityLabel(p.quality))}</td>
        <td>${R.esc(R.areaLabel(p))}</td>
        <td class="nc">${cell}</td>
        <td><a href="${mapHref}">Map</a></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6">No places match.</td></tr>`;
    document.getElementById("meta").textContent =
      `${state.view.length} places` +
      (state.view.length !== state.all.length ? ` (of ${state.all.length})` : "") +
      ` · showing ${state.view.length ? start + 1 : 0}–${Math.min(start + PAGE, state.view.length)}` +
      ` · Unclaimed is outside named neighbourhoods · on this phone`;
    document.getElementById("pageLabel").textContent =
      `Page ${state.page + 1} / ${Math.max(1, Math.ceil(state.view.length / PAGE))}`;
    document.getElementById("prev").disabled = state.page <= 0;
    document.getElementById("next").disabled = start + PAGE >= state.view.length;
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted", th.getAttribute("data-sort") === state.sort);
    });
  }

  function loadCatalog(data) {
    const places = data.places || data.features?.map((f) => {
      const p = f.properties;
      return {
        id: p.id,
        name: p.name,
        catalog_type: p.catalog_type,
        catalog_label: p.catalog_type,
        quality: p.quality,
        territory_id: p.territory_id,
        territory_name: p.territory_name || "Unclaimed",
        territory_role: p.territory_role,
        claim_nairacoin: p.claim_nairacoin != null ? p.claim_nairacoin : p.claim_points,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    }) || [];
    state.all = places;
    const types = [...new Set(places.map((p) => p.catalog_label))].sort();
    const terrs = [...new Set(places.map((p) => p.territory_name))].sort();
    fillSelect("qType", types, "All types");
    fillSelect("qTerr", terrs, "All neighbourhoods");
    apply();
  }

  ["qSearch", "qType", "qQuality", "qTerr", "qClaimed", "qView"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => { state.page = 0; apply(); });
    el.addEventListener("change", () => { state.page = 0; apply(); });
  });
  document.getElementById("prev").addEventListener("click", () => { state.page -= 1; render(); });
  document.getElementById("next").addEventListener("click", () => { state.page += 1; render(); });
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      if (state.sort === key) state.dir = state.dir === "asc" ? "desc" : "asc";
      else { state.sort = key; state.dir = key === "stake" ? "desc" : "asc"; }
      apply();
    });
  });

  Promise.all([
    fetch("/data/catalog.json").then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch("/data/places.geojson").then((r) => r.ok ? r.json() : null).catch(() => null),
  ]).then(([cat, geo]) => {
    if (cat && cat.places) loadCatalog(cat);
    else if (geo) loadCatalog(geo);
    else document.getElementById("meta").textContent = "Places didn’t load. Open this from the Lvfe site.";
  });
})();
