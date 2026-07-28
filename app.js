const map = L.map("map", { zoomControl: false, maxBoundsViscosity: 0.8 });
map.createPane("roadsPane");
map.getPane("roadsPane").style.zIndex = 330;
map.createPane("cyclePane");
map.getPane("cyclePane").style.zIndex = 360;
map.createPane("trafficPane");
map.getPane("trafficPane").style.zIndex = 355;
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
  LIVE = window.LIVE95 || { traffic: {}, sales: { points: [] } },
  routes = D.routes,
  stopsById = Object.fromEntries(D.stops.map((s) => [s.id, s])),
  layers = {
    stations: L.layerGroup(),
    stops: L.layerGroup(),
    selectedStops: L.layerGroup(),
    busRoutes: L.layerGroup(),
    sales: L.layerGroup(),
    traffic: L.geoJSON(
      LIVE.traffic?.features || { type: "FeatureCollection", features: [] },
      {
        pane: "trafficPane",
        style: trafficStyle,
        onEachFeature: trafficFeature,
        attribution: "Sytadin · DIRIF",
      },
    ),
    rail: L.tileLayer(wmts("TRANSPORTNETWORKS.RAILWAYS"), {
      opacity: 0.22,
      zIndex: 340,
      className: "rail-reference-layer",
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
  detailHistory = [],
  activeRouteId = null;

function styleBusRouteLayers(selectedId = null) {
  layers.busRoutes.eachLayer((line) => {
    const selected = selectedId && line.routeId === selectedId;
    line.setStyle({
      weight: selected ? 4 : selectedId ? 1.2 : 2.4,
      opacity: selected ? 0.95 : selectedId ? 0.12 : 0.68,
    });
    if (selected) line.bringToFront();
  });
}
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
function trafficStyle(f) {
  const p = f.properties;
  return {
    color: p.events?.length
      ? "#e1000f"
      : p.state === "Bouchon"
        ? "#ff3b30"
        : "#16a34a",
    weight: p.events?.length ? 6 : 5,
    opacity: 0.9,
  };
}
function safeText(value) {
  return String(value || "Non renseigné").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
function trafficFeature(f, layer) {
  const p = f.properties,
    event = p.events?.[0],
    updated = LIVE.traffic?.updated
      ? new Date(LIVE.traffic.updated).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "heure inconnue";
  layer.bindTooltip(
    `<div class="tooltip-card"><b>${safeText(p.road)}</b><span><i>Trafic</i>${safeText(p.state)}${event ? ` · ${safeText(event.type)}` : ""}</span></div>`,
    { sticky: true, className: "mobility-tooltip", opacity: 1 },
  );
  layer.options.bubblingMouseEvents = false;
  layer.on("mouseover", () => layer.setStyle({ weight: 8, opacity: 1 }));
  layer.on("mouseout", () => layer.setStyle(trafficStyle(f)));
  layer.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    openDetail(
      p.road,
      "CIRCULATION EN DIRECT",
      `${p.state} · actualisé à ${updated}`,
      `<section class="summary live-summary"><div class="live-status ${p.state === "Bouchon" ? "blocked" : "fluid"}"><img src="icons/gauge.svg" alt=""><div><small>État observé</small><b>${safeText(p.state)}</b></div><span>${updated}</span></div></section>${event ? `<section class="summary alert-summary"><h3>${safeText(event.type)}</h3><p>${safeText(event.detail)}</p><small>Du ${formatLiveDate(event.start)}${event.end ? ` au ${formatLiveDate(event.end)}` : ""}</small></section>` : ""}<section class="summary"><h3>Gestion du tronçon</h3><p>Exploitant : <b>${safeText(p.operator)}</b><br>Fermeture : ${safeText(p.closure)}<br>Voies fermées : ${p.closed_lanes || 0}</p><p class="data-freshness">Source Sytadin · DIRIF · actualisation automatique toutes les 5 minutes.</p></section>`,
    );
  });
}
function formatLiveDate(value) {
  if (!value) return "date inconnue";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
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
  ["route", "access", "iso", "selectedStops"].forEach((k) => {
    if (layers[k]) {
      map.removeLayer(layers[k]);
      if (k === "selectedStops") layers[k] = L.layerGroup();
      else layers[k] = null;
    }
  });
  detailHistory = [];
  currentDetail = null;
  activeRouteId = null;
  styleBusRouteLayers();
  document.querySelector("#line-filter").value = "";
  document.querySelector("#line-result").textContent =
    `${Object.keys(routes).length} lignes IDFM dans le département`;
  hubMarkers.forEach((m) => {
    m.setIcon(hubIcon(m.hubData));
    const g = isRail(m.hubData) ? layers.stations : layers.stops;
    if (!g.hasLayer(m)) g.addLayer(m);
  });
  ["stations", "stops"].forEach((key) => {
    const checked = document.querySelector(`[data-layer="${key}"]`).checked;
    if (key === "stops" && checked) refreshBusStops();
    if (checked && !map.hasLayer(layers[key])) layers[key].addTo(map);
    if (!checked && map.hasLayer(layers[key])) map.removeLayer(layers[key]);
  });
}
document.querySelector("#close").onclick = () => {
  drawer.classList.remove("open");
  resetNavigation();
};
function isRail(h) {
  return h.routes.some(isRailRoute);
}
function isRailRoute(id) {
  return [0, 1, 2, 7].includes(Number(routes[id]?.type));
}
function hubIcon(h, color) {
  const rail = isRail(h),
    zoom = map.getZoom(),
    compact = zoom < 13,
    marker = color || (rail ? "#e1000f" : "#000091"),
    size = rail
      ? compact
        ? 12
        : 20
      : compact
        ? 9
        : Math.min(17, 13 + Math.log2(h.n + 1)),
    icon = rail ? "rer-train-map" : "bus-map";
  return L.divIcon({
    className: `hub-icon hub-icon-marker ${compact ? "compact" : "pictogram"}`,
    html: compact
      ? `<span class="mobility-dot ${rail ? "rail" : "bus"}" style="--marker:${marker};width:${size}px;height:${size}px"></span>`
      : `<span class="${rail ? "rail" : "bus"}" style="--marker:${marker};width:${size}px;height:${size}px"><img src="./icons/idfm/${icon}.jpg" alt=""></span>`,
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
function uniqueRoutes(ids) {
  const seen = new Set();
  return ids
    .filter((id) => {
      const key = routes[id]?.short || routes[id]?.long || id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      (routes[a]?.short || "").localeCompare(routes[b]?.short || "", "fr", {
        numeric: true,
      }),
    );
}
function routeGroups(h) {
  const groups = { rail: [], urban: [], intercity: [], night: [] };
  uniqueRoutes(h.routes).forEach((id) => {
    const short = routes[id]?.short || "";
    if (isRailRoute(id)) groups.rail.push(id);
    else if (/^N/i.test(short)) groups.night.push(id);
    else if (/^95[- ]?\d/i.test(short)) groups.intercity.push(id);
    else groups.urban.push(id);
  });
  return groups;
}
function hubSubtitle(h) {
  const groups = routeGroups(h),
    count = Object.values(groups).reduce((sum, ids) => sum + ids.length, 0),
    modes = Object.values(groups).filter((ids) => ids.length).length;
  return `${count} ligne${count > 1 ? "s" : ""} · ${modes} mode${modes > 1 ? "s" : ""} · ${h.n} quai${h.n > 1 ? "s" : ""}`;
}
const groupMeta = {
  rail: ["RER & trains", "Correspondances ferroviaires"],
  urban: ["Bus urbains", "Desserte locale"],
  intercity: ["Bus interurbains", "Liaisons départementales et express"],
  night: ["Bus de nuit", "Noctilien"],
};
function routeGroupBlock(key, ids) {
  if (!ids.length) return "";
  return `<div class="mode-group ${key}"><div class="mode-group-title"><div><b>${groupMeta[key][0]}</b><small>${groupMeta[key][1]}</small></div><span>${ids.length}</span></div><div class="route-list">${ids.map(routeChip).join("")}</div></div>`;
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
function futureTimes(times, limit = 4) {
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next = times.filter((t) => t >= current).slice(0, limit);
  return next;
}
function directionsAtHub(h, id) {
  const grouped = {};
  h.stops.forEach((sid) => {
    const stop = stopsById[sid];
    Object.entries(stop?.directions?.[id] || {}).forEach(
      ([destination, times]) => {
        if (destination.toLowerCase() === h.name.toLowerCase()) return;
        grouped[destination] = [
          ...new Set([...(grouped[destination] || []), ...times]),
        ].sort();
      },
    );
  });
  return grouped;
}
function directionLabel(id, destination) {
  return routes[id]?.short === "A" && destination !== "Cergy le Haut"
    ? `Paris · ${destination}`
    : destination;
}
function nextMinute(h, id) {
  const times = h.stops.flatMap((sid) => stopsById[sid]?.times?.[id] || []);
  const now = new Date(),
    current = now.getHours() * 60 + now.getMinutes();
  const values = times
    .map((t) => {
      const [hour, minute] = t.split(":").map(Number);
      return hour * 60 + minute;
    })
    .filter((v) => v >= current);
  return values.length ? Math.min(...values) : 9999;
}
function serviceLine(h, id) {
  const r = routes[id],
    t = hubTimes(h, id);
  const directional = Object.entries(directionsAtHub(h, id))
    .map(
      ([destination, times]) =>
        `<div class="departure-direction"><span>Vers ${esc(directionLabel(id, destination))}</span><b>${futureTimes(times).join(" · ") || "Terminé"}</b></div>`,
    )
    .join("");
  return `<article class="departure-card"><div class="departure-main">${routeChip(id)}<div><strong>${esc(r?.long && r.long !== r.short ? r.long : (r?.destinations || []).join(" · "))}</strong>${directional || `<div class="departure-direction"><span>Prochains passages</span><b>${nextPassages(h, id) || "À confirmer"}</b></div>`}</div></div>${t ? `<footer>Service théorique · ${t.first}–${t.last}</footer>` : ""}</article>`;
}
function scheduleGroup(h, key, ids) {
  if (!ids.length) return "";
  const sorted = [...ids].sort((a, b) => nextMinute(h, a) - nextMinute(h, b));
  return `<details class="schedule-group" ${key === "rail" ? "open" : ""}><summary><span>${groupMeta[key][0]}</span><b>${ids.length} ligne${ids.length > 1 ? "s" : ""}</b><i>⌄</i></summary><div>${sorted.map((id) => serviceLine(h, id)).join("")}</div></details>`;
}
function hubCard(h) {
  const groups = routeGroups(h),
    total = Object.values(groups).reduce((sum, ids) => sum + ids.length, 0);
  return `<section class="summary network-summary"><div class="summary-title"><div><h3>Correspondances</h3><p>${h.n} quai${h.n > 1 ? "s" : ""} · ${total} ligne${total > 1 ? "s" : ""}</p></div><span class="mode-count">${Object.values(groups).filter((ids) => ids.length).length} modes</span></div>${Object.entries(
    groups,
  )
    .map(([key, ids]) => routeGroupBlock(key, ids))
    .join(
      "",
    )}</section><section class="summary departures"><div class="summary-title"><div><h3>Prochains départs</h3><p>Triés par mode puis par heure de passage.</p></div><span class="theoretical">GTFS</span></div>${Object.entries(
    groups,
  )
    .map(([key, ids]) => scheduleGroup(h, key, ids))
    .join("")}</section>${isoBlock()}`;
}
const hubMarkers = [];
D.hubs.forEach((h) => {
  const m = L.marker([h.lat, h.lon], { icon: hubIcon(h) });
  m.hubData = h;
  const groups = routeGroups(h),
    railNames = groups.rail.map((id) => routes[id]?.short).filter(Boolean),
    busNames = [...groups.urban, ...groups.intercity, ...groups.night]
      .map((id) => routes[id]?.short)
      .filter(Boolean),
    shownBus = busNames.slice(0, 8),
    hiddenBus = busNames.length - shownBus.length;
  m.bindTooltip(
    `<div class="tooltip-card"><b>${esc(h.name)}</b>${railNames.length ? `<span><i>RER · Train</i>${esc(railNames.join(" · "))}</span>` : ""}${shownBus.length ? `<span><i>Bus</i>${esc(shownBus.join(" · "))}${hiddenBus > 0 ? ` <em>+${hiddenBus}</em>` : ""}</span>` : ""}</div>`,
    {
      direction: "top",
      offset: [0, -10],
      className: "mobility-tooltip",
      opacity: 1,
    },
  );
  m.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    selectedPoint = e.latlng || m.getLatLng();
    openDetail(
      h.name,
      isRail(h) ? "GARE / PÔLE D’ÉCHANGES" : "ZONE DE CORRESPONDANCE",
      hubSubtitle(h),
      hubCard(h),
    );
  });
  m.addTo(isRail(h) ? layers.stations : layers.stops);
  hubMarkers.push(m);
});
function saleIcon() {
  const compact = map.getZoom() < 13,
    size = compact ? 8 : 22;
  return L.divIcon({
    className: `sale-marker ${compact ? "compact" : "pictogram"}`,
    html: compact
      ? "<span></span>"
      : '<span><img src="icons/ticket.svg" alt=""></span>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
const salesMarkers = [];
(LIVE.sales?.points || []).forEach((point) => {
  const marker = L.marker([point.lat, point.lon], { icon: saleIcon() });
  marker.bindTooltip(
    `<div class="tooltip-card"><b>${esc(point.name)}</b><span><i>${esc(point.type)}</i>${esc(point.service)}</span></div>`,
    { direction: "top", className: "mobility-tooltip", opacity: 1 },
  );
  marker.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
    openDetail(
      point.name,
      "POINT DE VENTE",
      point.type || "Titres de transport",
      `<section class="summary sale-card"><div class="sale-heading"><img src="icons/ticket.svg" alt=""><div><h3>${esc(point.service)}</h3><p>${esc(point.address)}</p></div></div><dl><div><dt>Horaires</dt><dd>${esc(point.hours || "Non communiqués")}</dd></div><div><dt>Services</dt><dd>${esc(point.type)}${point.easy ? " · Navigo Easy disponible" : ""}</dd></div></dl></section><section class="summary fares"><div class="summary-title"><div><h3>Tarifs 2026</h3><p>Tarifs publics Île-de-France Mobilités.</p></div><span>Officiel</span></div><div class="fare-grid"><div><span>Bus · Tram</span><b>2,05 €</b><small>Réduit 1,05 €</small></div><div><span>Métro · Train · RER</span><b>2,55 €</b><small>Réduit 1,30 €</small></div><div><span>Navigo Liberté+</span><b>dès 1,64 €</b><small>par trajet</small></div><div><span>Navigo semaine</span><b>32,40 €</b><small>zones 1 à 5</small></div></div><a href="https://www.iledefrance-mobilites.fr/tarifs-titre-de-transport-en-commun-2026" target="_blank" rel="noopener">Voir tous les tarifs IDFM ↗</a></section>`,
    );
  });
  marker.addTo(layers.sales);
  salesMarkers.push(marker);
});
function refreshBusStops() {
  const zoom = map.getZoom();
  layers.stops.clearLayers();
  hubMarkers.forEach((marker) => {
    const hub = marker.hubData;
    if (isRail(hub)) return;
    const visible =
      zoom >= 14 || (zoom >= 12 && hub.n >= 2) || (zoom < 12 && hub.n >= 5);
    if (visible) layers.stops.addLayer(marker);
  });
}
map.on("zoomend", () => {
  hubMarkers.forEach((marker) => marker.setIcon(hubIcon(marker.hubData)));
  salesMarkers.forEach((marker) => marker.setIcon(saleIcon()));
  const toggle = document.querySelector('[data-layer="stops"]');
  if (!toggle?.checked) return;
  refreshBusStops();
  if (!map.hasLayer(layers.stops)) layers.stops.addTo(map);
});
function lineCard(id) {
  const r = routes[id],
    dest = (r.destinations || []).join(" ↔ ") || r.long;
  const schedules = r.stops
    .map((s) => {
      const stop = stopsById[s.id];
      const directions = Object.entries(stop?.directions?.[id] || {}).filter(
        ([destination]) => destination.toLowerCase() !== s.name.toLowerCase(),
      );
      return `<div class="station-schedule"><button onclick='focusStop(${JSON.stringify(s.id)})'><b>${esc(s.name)}</b><span>Voir sur la carte ›</span></button>${directions.map(([destination, times]) => `<p><b>Vers ${esc(directionLabel(id, destination))}</b><span>${futureTimes(times).join(" · ") || "Service terminé"}</span></p>`).join("")}</div>`;
    })
    .join("");
  return `<section class="summary"><h3>Terminus et directions</h3><p>${esc(dest)}</p></section><section class="summary"><h3>Prochains départs</h3><p>Horaires théoriques GTFS dans les deux sens.</p><div class="line-schedules">${schedules}</div></section><section class="summary"><h3>Desserte dans le Val-d’Oise</h3><p>${r.stops.length} arrêts sur le tracé sélectionné.</p><div class="stop-sequence">${r.stops.map((s, i) => `<button onclick='focusStop(${JSON.stringify(s.id)})'><i></i><span><small>${String(i + 1).padStart(2, "0")}</small>${esc(s.name)}</span><b>›</b></button>`).join("")}</div></section><section class="summary"><h3>Données de service</h3><p>Horaires théoriques GTFS du ${D.date.slice(6, 8)}/${D.date.slice(4, 6)}/${D.date.slice(0, 4)}.</p></section>`;
}
function routeSubtitle(r) {
  return r.long && r.long !== r.short
    ? r.long
    : (r.destinations || []).join(" ↔ ");
}
function focusStop(stopId) {
  const marker = hubMarkers.find((m) => m.hubData.stops.includes(stopId));
  if (!marker) return;
  if (!layers.selectedStops.hasLayer(marker))
    layers.selectedStops.addLayer(marker);
  if (!map.hasLayer(layers.selectedStops)) layers.selectedStops.addTo(map);
  map.setView(marker.getLatLng(), 16, { animate: true });
  marker.fire("click");
}
window.focusStop = focusStop;
function selectRoute(id) {
  const r = routes[id];
  if (!r) return;
  activeRouteId = id;
  styleBusRouteLayers(id);
  if (layers.route) map.removeLayer(layers.route);
  if (r.geometry?.length) {
    const routeHalo = L.polyline(r.geometry, {
        color: "#fff",
        weight: 12,
        opacity: 0.92,
        interactive: false,
      }),
      routeLine = L.polyline(r.geometry, {
      color: `#${r.color}`,
      weight: 7,
      opacity: 1,
    }).bindTooltip(
        `<b>${esc(r.short || r.long)}</b><br>${esc((r.destinations || []).join(" ↔ ") || r.long)}`,
        { sticky: true },
      );
    layers.route = L.featureGroup([routeHalo, routeLine]).addTo(map);
    routeLine.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openDetail(
        r.short || r.long,
        "LIGNE IDFM",
        routeSubtitle(r),
        lineCard(id),
        {
          color: `#${r.color}`,
          textColor: `#${r.text || "FFFFFF"}`,
          kind: ["A", "B", "C", "D", "E"].includes(r.short)
            ? "rer"
            : [0, 1, 2, 7].includes(Number(r.type))
              ? "rail"
              : "bus",
        },
      );
    });
    map.fitBounds(layers.route.getBounds(), { padding: [40, 40] });
  }
  const matching = hubMarkers.filter((m) => m.hubData.routes.includes(id));
  layers.selectedStops.clearLayers();
  layers.selectedStops.addTo(map);
  matching.forEach((m) => {
    const selected = L.marker(m.getLatLng(), {
      icon: hubIcon(m.hubData, `#${r.color}`),
    });
    selected.bindTooltip(m.getTooltip()?.getContent() || esc(m.hubData.name), {
      direction: "top",
      offset: [0, -10],
      className: "mobility-tooltip",
    });
    selected.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      selectedPoint = e.latlng;
      openDetail(
        m.hubData.name,
        isRail(m.hubData) ? "GARE / PÔLE D’ÉCHANGES" : "ZONE DE CORRESPONDANCE",
        hubSubtitle(m.hubData),
        hubCard(m.hubData),
      );
    });
    selected.addTo(layers.selectedStops);
  });
  openDetail(r.short || r.long, "LIGNE IDFM", routeSubtitle(r), lineCard(id), {
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
Object.entries(routes).forEach(([id, r]) => {
  if (isRailRoute(id) || !r.geometry?.length) return;
  const line = L.polyline(r.geometry, {
    color: `#${r.color}`,
    weight: 2.4,
    opacity: 0.68,
  });
  line.routeId = id;
  line.bindTooltip(
    `<div class="tooltip-card route"><b>Bus ${esc(r.short || r.long)}</b><span>${esc((r.destinations || []).slice(0, 2).join(" ↔ ") || r.long)}</span></div>`,
    { sticky: true, className: "mobility-tooltip", opacity: 1 },
  );
  line.on("mouseover", () => line.setStyle({ weight: 5, opacity: 1 }));
  line.on("mouseout", () =>
    line.setStyle({
      weight: activeRouteId === id ? 4 : activeRouteId ? 1.2 : 2.4,
      opacity: activeRouteId === id ? 0.95 : activeRouteId ? 0.12 : 0.68,
    }),
  );
  line.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    selectRoute(id);
  });
  line.addTo(layers.busRoutes);
});
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
    if (map.hasLayer(layers.selectedStops))
      map.removeLayer(layers.selectedStops);
    layers.selectedStops.clearLayers();
    activeRouteId = null;
    styleBusRouteLayers();
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
document.querySelectorAll("[data-layer]").forEach(
  (i) =>
    (i.onchange = () => {
      if (["stations", "stops"].includes(i.dataset.layer))
        hubMarkers.forEach((marker) => marker.setIcon(hubIcon(marker.hubData)));
      if (i.dataset.layer === "stops" && i.checked) refreshBusStops();
      i.checked
        ? layers[i.dataset.layer].addTo(map)
        : map.removeLayer(layers[i.dataset.layer]);
    }),
);
document.querySelector("#progress").style.width = "100%";
document.querySelector("#live-dot").classList.add("ok");
if (LIVE.traffic?.updated) {
  const trafficTime = new Date(LIVE.traffic.updated).toLocaleTimeString(
    "fr-FR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
  document.querySelector("#live-text").textContent =
    `Trafic actualisé à ${trafficTime}`;
  document.querySelector(".live-sub").textContent =
    `Sytadin · ${LIVE.sales?.points?.length || 0} points de vente IDFM`;
}
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
  return `<section class="summary iso-card"><div class="iso-heading"><span><img src="./icons/clock.svg" alt=""></span><div><h3>Jusqu’où peux-tu aller ?</h3><p>Zone accessible depuis ce point, calculée sur le réseau réel.</p></div></div><input id="iso-mode" type="hidden" value="pedestrian"><input id="iso-time" type="hidden" value="10"><div class="iso-label">Mode de déplacement</div><div class="iso-segments mode"><button class="active" data-iso-mode="pedestrian" onclick="setIsoOption('mode','pedestrian',this)"><img src="./icons/person-standing.svg" alt="">À pied</button><button data-iso-mode="car" onclick="setIsoOption('mode','car',this)"><img src="./icons/car-front.svg" alt="">Voiture</button></div><div class="iso-label">Temps de trajet</div><div class="iso-segments time"><button data-iso-time="5" onclick="setIsoOption('time','5',this)">5 min</button><button class="active" data-iso-time="10" onclick="setIsoOption('time','10',this)">10 min</button><button data-iso-time="15" onclick="setIsoOption('time','15',this)">15 min</button><button data-iso-time="30" onclick="setIsoOption('time','30',this)">30 min</button></div><button class="iso-submit" onclick="showIsochrone()"><span>Calculer la zone accessible</span><b>→</b></button><p id="iso-status" class="iso-status"><i></i> Calcul IGN · réseau BD TOPO</p></section>`;
}
function setIsoOption(kind, value, button) {
  document.querySelector(`#iso-${kind}`).value = value;
  button.parentElement
    .querySelectorAll("button")
    .forEach((item) => item.classList.toggle("active", item === button));
}
window.setIsoOption = setIsoOption;
async function showIsochrone() {
  const mode = document.querySelector("#iso-mode").value,
    min = document.querySelector("#iso-time").value,
    status = document.querySelector("#iso-status"),
    submit = document.querySelector(".iso-submit"),
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
  status.innerHTML = "<i></i> Calcul en cours…";
  status.className = "iso-status loading";
  submit.disabled = true;
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
    status.className = "iso-status success";
  } catch {
    status.textContent = "Calcul disponible sur la version en ligne.";
    status.className = "iso-status error";
  } finally {
    submit.disabled = false;
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
