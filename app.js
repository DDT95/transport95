const map = L.map("map", { zoomControl: false, maxBoundsViscosity: 0.8 });
map.createPane("roadsPane");
map.getPane("roadsPane").style.zIndex = 330;
map.createPane("cyclePane");
map.getPane("cyclePane").style.zIndex = 360;
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);
const wmts = (l) =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${l}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`;
function roadColor(p) {
  const n = p.numero || "";
  return n.startsWith("A")
    ? "#e1000f"
    : n.startsWith("N")
      ? "#f28e2b"
      : n.startsWith("D")
        ? "#d6a600"
        : "#667085";
}
function cycleColor(p) {
  const a = `${p.ame_d || ""} ${p.ame_g || ""}`;
  return a.includes("PISTE")
    ? "#18753c"
    : a.includes("BANDE")
      ? "#009081"
      : a.includes("VOIE VERTE")
        ? "#6a6af4"
        : "#008941";
}
const D = window.MOBILITY95 || { stops: [], hubs: [], routes: {} },
  routes = D.routes,
  stopsById = Object.fromEntries(D.stops.map((s) => [s.id, s])),
  layers = {
    stations: L.layerGroup(),
    stops: L.layerGroup(),
    rail: L.tileLayer(wmts("TRANSPORTNETWORKS.RAILWAYS"), {
      opacity: 0.7,
      zIndex: 340,
      attribution: "BD TOPO · IGN",
    }),
    roads: L.geoJSON(
      window.ROADS95 || { type: "FeatureCollection", features: [] },
      {
        pane: "roadsPane",
        style: (f) => ({
          color: roadColor(f.properties),
          weight: (f.properties.numero || "").startsWith("A") ? 4 : 3,
          opacity: 0.88,
        }),
        onEachFeature: roadFeature,
        attribution: "BD TOPO · IGN",
      },
    ),
    cycle: L.geoJSON(
      window.CYCLE95 || { type: "FeatureCollection", features: [] },
      {
        pane: "cyclePane",
        style: (f) => ({
          color: cycleColor(f.properties),
          weight: 3,
          opacity: 0.9,
        }),
        onEachFeature: cycleFeature,
        attribution: "BNAC · Geovelo · OpenStreetMap",
      },
    ),
    route: null,
    access: null,
    iso: null,
  };
layers.stations.addTo(map);
layers.rail.addTo(map);
document.querySelector('[data-layer="stops"]').checked = false;
const drawer = document.querySelector("#drawer"),
  body = document.querySelector("#detail-body"),
  backBtn = document.querySelector("#back"),
  esc = (s) =>
    String(s || "Non renseigné").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let currentDetail = null,
  detailHistory = [];
function renderDetail(v) {
  currentDetail = v;
  document.querySelector("#detail-title").textContent = v.title;
  document.querySelector("#detail-type").textContent = v.type;
  document.querySelector("#detail-sub").textContent = v.sub;
  body.innerHTML = v.html;
  drawer.classList.toggle("line-detail", Boolean(v.color));
  drawer.dataset.lineKind = v.kind || "";
  if (v.color) {
    drawer.style.setProperty("--active-line", v.color);
    drawer.style.setProperty("--active-line-text", v.textColor || "#fff");
  }
  backBtn.hidden = !detailHistory.length;
  drawer.classList.add("open");
}
function openDetail(title, type, sub, html, appearance = {}) {
  if (currentDetail && drawer.classList.contains("open"))
    detailHistory.push(currentDetail);
  renderDetail({
    title,
    type,
    sub,
    html,
    center: map.getCenter(),
    zoom: map.getZoom(),
    ...appearance,
  });
}
function roadFeature(f, layer) {
  const p = f.properties;
  const name =
    [p.numero, p.toponyme].filter(Boolean).join(" · ") ||
    p.type_de_route ||
    "Route";
  layer.bindTooltip(name, { sticky: true });
  layer.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    openDetail(
      p.numero || p.toponyme || "Route",
      "RÉSEAU ROUTIER",
      p.type_de_route || "BD TOPO",
      `<section class="summary"><h3>Identification</h3><p><b>${esc(name)}</b><br>${esc(p.type_de_route || "Type non renseigné")}</p></section><section class="summary"><h3>Gestion</h3><p>Gestionnaire : <b>${esc(p.gestionnaire || "non renseigné")}</b><br>Source : ${esc(p.sources || "BD TOPO · IGN")}<br>Mise à jour : ${esc((p.date_modification || "").slice(0, 10) || "non renseignée")}</p></section><section class="summary"><h3>Circulation</h3><p>La vitesse en temps réel n’est pas publiée sur ce tronçon. Aucun niveau de trafic n’est inventé.</p><a href="https://www.sytadin.fr/" target="_blank" rel="noopener">Consulter Sytadin ↗</a></section>`,
    );
  });
}
function cycleFeature(f, layer) {
  const p = f.properties;
  const amenagement =
    [p.ame_d, p.ame_g].find(Boolean) || "Aménagement cyclable";
  const width = [p.largeur_d, p.largeur_g].find(Boolean);
  layer.bindTooltip(amenagement, { sticky: true });
  layer.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    openDetail(
      amenagement,
      "MOBILITÉ CYCLABLE",
      p.source || "Base nationale",
      `<section class="summary"><h3>Caractéristiques</h3><p><b>${esc(amenagement)}</b><br>Statut : ${esc(p.statut_d || p.statut_g || "non renseigné")}<br>Sens : ${esc(p.sens_d || p.sens_g || "non renseigné")}${width ? `<br>Largeur : ${width} m` : ""}<br>Revêtement : ${esc(p.revet_d || p.revet_g || "non renseigné")}</p></section><section class="summary"><h3>Données</h3><p>Source : ${esc(p.source || "Base nationale des aménagements cyclables")}<br>Mise à jour : ${esc((p.date_maj || "").slice(0, 10) || "non renseignée")}</p></section>`,
    );
  });
}
backBtn.onclick = () => {
  const v = detailHistory.pop();
  if (!v) return;
  renderDetail(v);
  map.setView(v.center, v.zoom, { animate: true });
};
function resetNavigation() {
  ["route", "access", "iso"].forEach((k) => {
    if (layers[k]) {
      map.removeLayer(layers[k]);
      layers[k] = null;
    }
  });
  detailHistory = [];
  currentDetail = null;
  document.querySelector("#line-filter").value = "";
  document.querySelector("#line-result").textContent =
    `${Object.keys(routes).length} lignes IDFM dans le département`;
  if (!map.hasLayer(layers.stations)) layers.stations.addTo(map);
  if (map.hasLayer(layers.stops)) map.removeLayer(layers.stops);
  document.querySelector('[data-layer="stations"]').checked = true;
  document.querySelector('[data-layer="stops"]').checked = false;
  hubMarkers.forEach((m) => {
    m.setIcon(hubIcon(m.hubData));
    const g = isRail(m.hubData) ? layers.stations : layers.stops;
    if (!g.hasLayer(m)) g.addLayer(m);
  });
}
document.querySelector("#close").onclick = () => {
  drawer.classList.remove("open");
  resetNavigation();
};
function isRail(h) {
  return h.routes.some((id) => [0, 1, 2, 7].includes(Number(routes[id]?.type)));
}
function hubIcon(h, color) {
  const rail = isRail(h),
    size = rail ? 12 : Math.min(10, 5 + Math.log2(h.n + 1));
  return L.divIcon({
    className: "hub-icon",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color || (rail ? "#e1000f" : "#000091")};border:2px solid #fff;box-shadow:0 1px 6px #0007"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
function routeChip(id) {
  const r = routes[id];
  if (!r) return "";
  const short = r.short || r.long;
  const kind = ["A", "B", "C", "D", "E"].includes(short)
    ? "rer"
    : [0, 1, 2, 7].includes(Number(r.type))
      ? "rail"
      : "bus";
  return `<button class="route-chip ${kind}" title="Ligne ${esc(short)}" onclick='selectRoute(${JSON.stringify(id)})' style="--line:#${r.color};--line-text:#${r.text || "FFFFFF"}">${esc(short)}</button>`;
}
function hubTimes(h, id) {
  const times = h.stops.flatMap((s) => stopsById[s]?.times?.[id] || []).sort();
  return times.length
    ? { first: times[0], last: times[times.length - 1], count: times.length }
    : null;
}
function nextPassages(h, id) {
  const all = h.stops.flatMap((s) => stopsById[s]?.times?.[id] || []).sort();
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next = all.filter((t) => t >= current).slice(0, 4);
  return (next.length ? next : all.slice(0, 4)).join(" · ");
}
function hubCard(h) {
  return `<section class="summary"><h3>${h.n > 1 ? "Pôle de correspondance" : "Point d’arrêt"}</h3><p>${h.n} quai${h.n > 1 ? "s" : ""} regroupé${h.n > 1 ? "s" : ""} · ${h.routes.length} ligne${h.routes.length > 1 ? "s" : ""}</p><div class="route-list">${h.routes.map(routeChip).join("")}</div></section><section class="summary"><h3>Services aujourd’hui</h3>${h.routes
    .slice(0, 8)
    .map((id) => {
      const r = routes[id],
        t = hubTimes(h, id);
      const upcoming = nextPassages(h, id);
      return `<div class="service-row"><span class="mini-line" style="--line:#${r?.color || "000091"};--line-text:#${r?.text || "FFFFFF"}">${esc(r?.short)}</span><span>${esc((r?.destinations || []).join(" · ") || r?.long)}</span><small>${upcoming ? `Prochains passages théoriques : ${upcoming}` : "horaires à confirmer"}${t ? ` · service ${t.first}–${t.last}` : ""}</small></div>`;
    })
    .join("")}</section>${isoBlock()}`;
}
const hubMarkers = [];
D.hubs.forEach((h) => {
  const m = L.marker([h.lat, h.lon], { icon: hubIcon(h) });
  m.hubData = h;
  const names = h.routes
    .map((id) => routes[id]?.short || routes[id]?.long)
    .filter(Boolean);
  m.bindTooltip(
    `<b>${esc(h.name)}</b><br>${esc(names.join(" · ") || "Aucune ligne renseignée")}`,
    { direction: "top", offset: [0, -6] },
  );
  m.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    selectedPoint = e.latlng || m.getLatLng();
    openDetail(
      h.name,
      isRail(h) ? "GARE / PÔLE D’ÉCHANGES" : "ZONE DE CORRESPONDANCE",
      `${h.routes.length} ligne${h.routes.length > 1 ? "s" : ""} · ${h.n} quai${h.n > 1 ? "s" : ""}`,
      hubCard(h),
    );
  });
  m.addTo(isRail(h) ? layers.stations : layers.stops);
  hubMarkers.push(m);
});
function lineCard(id) {
  const r = routes[id],
    dest = (r.destinations || []).join(" ↔ ") || r.long;
  return `<section class="summary"><h3>Direction</h3><p>${esc(dest)}</p></section><section class="summary"><h3>Desserte dans le Val-d’Oise</h3><p>${r.stops.length} arrêts sur le tracé sélectionné. Clique sur un arrêt pour le localiser.</p><div class="stop-sequence">${r.stops.map((s, i) => `<button onclick='focusStop(${JSON.stringify(s.id)})'><i></i><span><small>${String(i + 1).padStart(2, "0")}</small>${esc(s.name)}</span><b>›</b></button>`).join("")}</div></section><section class="summary"><h3>Données de service</h3><p>Horaires théoriques GTFS du ${D.date.slice(6, 8)}/${D.date.slice(4, 6)}/${D.date.slice(0, 4)}. Ouvre un arrêt pour voir les premiers, derniers passages et le nombre de courses.</p></section>`;
}
function focusStop(stopId) {
  const marker = hubMarkers.find((m) => m.hubData.stops.includes(stopId));
  if (!marker) return;
  const group = isRail(marker.hubData) ? layers.stations : layers.stops;
  if (!map.hasLayer(group)) group.addTo(map);
  if (!group.hasLayer(marker)) group.addLayer(marker);
  map.setView(marker.getLatLng(), 16, { animate: true });
  marker.fire("click");
}
window.focusStop = focusStop;
function selectRoute(id) {
  const r = routes[id];
  if (!r) return;
  if (layers.route) map.removeLayer(layers.route);
  if (r.geometry?.length) {
    layers.route = L.polyline(r.geometry, {
      color: `#${r.color}`,
      weight: 5,
      opacity: 0.9,
    })
      .addTo(map)
      .bindTooltip(
        `<b>${esc(r.short || r.long)}</b><br>${esc((r.destinations || []).join(" ↔ ") || r.long)}`,
        { sticky: true },
      );
    layers.route.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openDetail(r.short || r.long, "LIGNE IDFM", r.long, lineCard(id), {
        color: `#${r.color}`,
        textColor: `#${r.text || "FFFFFF"}`,
        kind: ["A", "B", "C", "D", "E"].includes(r.short)
          ? "rer"
          : [0, 1, 2, 7].includes(Number(r.type))
            ? "rail"
            : "bus",
      });
    });
    map.fitBounds(layers.route.getBounds(), { padding: [40, 40] });
  }
  const matching = hubMarkers.filter((m) => m.hubData.routes.includes(id));
  layers.stops.addTo(map);
  document.querySelector('[data-layer="stops"]').checked = true;
  hubMarkers.forEach((m) => {
    const g = isRail(m.hubData) ? layers.stations : layers.stops;
    m.setIcon(hubIcon(m.hubData, matching.includes(m) ? `#${r.color}` : null));
    if (matching.includes(m)) {
      if (!g.hasLayer(m)) g.addLayer(m);
    } else if (g.hasLayer(m)) g.removeLayer(m);
  });
  openDetail(r.short || r.long, "LIGNE IDFM", r.long, lineCard(id), {
    color: `#${r.color}`,
    textColor: `#${r.text || "FFFFFF"}`,
    kind: ["A", "B", "C", "D", "E"].includes(r.short)
      ? "rer"
      : [0, 1, 2, 7].includes(Number(r.type))
        ? "rail"
        : "bus",
  });
  document.querySelector("#line-result").textContent =
    `${matching.length} zones desservies · ${r.destinations?.join(" / ") || ""}`;
}
window.selectRoute = selectRoute;
document.querySelector("#line-filter").oninput = (e) => {
  const q = e.target.value.trim().toLowerCase(),
    ids = Object.keys(routes).filter((id) =>
      `${routes[id].short} ${routes[id].long}`.toLowerCase().includes(q),
    );
  if (!q) {
    if (layers.route) {
      map.removeLayer(layers.route);
      layers.route = null;
    }
    layers.stops.remove();
    document.querySelector('[data-layer="stops"]').checked = false;
    hubMarkers.forEach((m) => {
      const g = isRail(m.hubData) ? layers.stations : layers.stops;
      if (!g.hasLayer(m)) g.addLayer(m);
    });
    document.querySelector("#line-result").textContent =
      `${Object.keys(routes).length} lignes IDFM dans le département`;
    return;
  }
  if (ids.length) {
    selectRoute(ids[0]);
    document.querySelector("#line-result").textContent =
      ids.length === 1
        ? `${routes[ids[0]].long}`
        : `${ids.length} lignes correspondantes`;
  } else
    document.querySelector("#line-result").textContent = "Aucune ligne trouvée";
};
document
  .querySelectorAll("[data-layer]")
  .forEach(
    (i) =>
      (i.onchange = () =>
        i.checked
          ? layers[i.dataset.layer].addTo(map)
          : map.removeLayer(layers[i.dataset.layer])),
  );
document.querySelector("#progress").style.width = "100%";
document.querySelector("#live-dot").classList.add("ok");
const C = window.COMMUNES95;
if (C) {
  const holes = [];
  C.features.forEach((f) =>
    f.geometry.type === "Polygon"
      ? holes.push(f.geometry.coordinates[0])
      : f.geometry.coordinates.forEach((p) => holes.push(p[0])),
  );
  L.geoJSON(
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-180, -85],
            [180, -85],
            [180, 85],
            [-180, 85],
            [-180, -85],
          ],
          ...holes,
        ],
      },
    },
    {
      interactive: false,
      style: {
        stroke: false,
        fillColor: "#e7ebf2",
        fillOpacity: 0.88,
        fillRule: "evenodd",
      },
    },
  ).addTo(map);
  const b = L.geoJSON(C, {
    interactive: false,
    style: { color: "#565b6c", weight: 0.7, opacity: 0.65, fillOpacity: 0 },
  })
    .addTo(map)
    .getBounds();
  map.fitBounds(b, { padding: [24, 24] });
  map.setMaxBounds(b.pad(0.35));
  document.querySelector("#home").onclick = () =>
    map.fitBounds(b, { padding: [24, 24] });
}
document.querySelector("#locate").onclick = () =>
  map.locate({ setView: true, maxZoom: 15 });
let selectedPoint;
async function reverse(p) {
  try {
    const r = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${p.lng}&lat=${p.lat}`,
      ),
      d = await r.json();
    return d.features?.[0]?.properties;
  } catch {
    return null;
  }
}
function nearby(layer, p, r) {
  let n = 0;
  layer.eachLayer((m) => {
    if (m.getLatLng && p.distanceTo(m.getLatLng()) <= r) n++;
  });
  return n;
}
function isoBlock() {
  return `<section class="summary"><h3>Accès au réseau</h3><p>Calcule la zone accessible et les cheminements vers les transports proches.</p><div class="iso-tools" style="display:grid;grid-template-columns:1fr 1fr;gap:9px"><select id="iso-mode"><option value="pedestrian">À pied</option><option value="car">En voiture</option></select><select id="iso-time"><option value="5">5 minutes</option><option value="10" selected>10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select><button style="grid-column:1/-1" onclick="showIsochrone()">Afficher l’accès</button></div><p id="iso-status" class="iso-status">Réseau BD TOPO</p></section>`;
}
async function showIsochrone() {
  const mode = document.querySelector("#iso-mode").value,
    min = document.querySelector("#iso-time").value,
    status = document.querySelector("#iso-status"),
    qs = new URLSearchParams({
      resource: "bdtopo-pgr",
      point: `${selectedPoint.lng},${selectedPoint.lat}`,
      costType: "time",
      costValue: min,
      profile: mode,
      direction: "departure",
      geometryFormat: "geojson",
      timeUnit: "minute",
    });
  status.textContent = "Calcul en cours…";
  try {
    const r = await fetch(`https://data.geopf.fr/navigation/isochrone?${qs}`),
      d = await r.json();
    if (layers.iso) map.removeLayer(layers.iso);
    layers.iso = L.geoJSON(d.geometry, {
      style: {
        color: "#000091",
        weight: 2,
        fillColor: "#4fd1ff",
        fillOpacity: 0.14,
      },
    }).addTo(map);
    const near = hubMarkers
      .filter(
        (m) =>
          selectedPoint.distanceTo(m.getLatLng()) <
          Number(min) * (mode === "pedestrian" ? 90 : 700),
      )
      .sort(
        (a, b) =>
          selectedPoint.distanceTo(a.getLatLng()) -
          selectedPoint.distanceTo(b.getLatLng()),
      )
      .slice(0, 3);
    if (layers.access) map.removeLayer(layers.access);
    layers.access = null;
    map.fitBounds(layers.iso.getBounds(), { padding: [35, 35] });
    status.textContent = `Zone accessible en ${min} min · ${near.length} transport${near.length > 1 ? "s" : ""} proche${near.length > 1 ? "s" : ""}.`;
  } catch {
    status.textContent = "Calcul disponible sur la version en ligne.";
  }
}
window.showIsochrone = showIsochrone;
async function analyze(p) {
  selectedPoint = p;
  const a = await reverse(p),
    s = nearby(layers.stations, p, 3000),
    n = nearby(layers.stops, p, 800);
  openDetail(
    a?.city || "Point sélectionné",
    "ACCESSIBILITÉ AUX TRANSPORTS",
    a?.label || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
    `<section class="summary"><h3>Desserte de proximité</h3><div class="metrics"><div class="metric"><b>${s}</b><span>pôles à 3 km</span></div><div class="metric"><b>${n}</b><span>zones à 800 m</span></div><div class="metric"><b>${s + n}</b><span>correspondances</span></div></div></section>${isoBlock()}<section class="summary"><h3>Réseau routier</h3><p>Active la couche BD TOPO puis clique à proximité d’une voie pour analyser son accessibilité. L’enrichissement trafic et accidents est en préparation à partir des sources routières ouvertes.</p></section>`,
  );
}
map.on("click", (e) => analyze(e.latlng));
map.on("locationfound", (e) => analyze(e.latlng));
document.querySelector("#search-form").onsubmit = async (e) => {
  e.preventDefault();
  const q = document.querySelector("#search-input").value.trim();
  if (!q) return;
  const h = D.hubs.find((x) => x.name.toLowerCase().includes(q.toLowerCase()));
  if (h) {
    map.setView([h.lat, h.lon], 15);
    hubMarkers.find((m) => m.hubData === h).fire("click");
    return;
  }
  const d = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1&postcode=95`,
    ).then((r) => r.json()),
    f = d.features?.[0];
  if (f) {
    const [lng, lat] = f.geometry.coordinates;
    map.setView([lat, lng], 15);
    analyze(L.latLng(lat, lng));
  }
};
