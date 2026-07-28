(() => {
  const BLUE = [0, 0, 145], DEEP = [7, 0, 71], MUTED = [94, 102, 120];

  const safeFile = (value) =>
    String(value || "synthese")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  function logoData() {
    const image = document.querySelector(".brand-logo");
    if (!image?.complete || !image.naturalWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return { data: canvas.toDataURL("image/png"), ratio: image.naturalWidth / image.naturalHeight };
  }

  function drawIcon(doc, x, y, kind, color = BLUE) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, 8, 8, 2, 2, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setTextColor(255, 255, 255);
    doc.setLineWidth(0.6);
    if (kind === "clock") {
      doc.circle(x + 4, y + 4, 2.2, "S");
      doc.line(x + 4, y + 4, x + 4, y + 2.6);
      doc.line(x + 4, y + 4, x + 5.3, y + 4.7);
    } else if (kind === "pin") {
      doc.circle(x + 4, y + 3.2, 1.4, "S");
      doc.line(x + 2.8, y + 4.4, x + 4, y + 6.5);
      doc.line(x + 5.2, y + 4.4, x + 4, y + 6.5);
    } else if (kind === "network") {
      doc.circle(x + 2.4, y + 2.6, 0.7, "F");
      doc.circle(x + 5.8, y + 2.6, 0.7, "F");
      doc.circle(x + 4, y + 5.8, 0.7, "F");
      doc.line(x + 2.9, y + 3, x + 3.7, y + 5.1);
      doc.line(x + 5.3, y + 3, x + 4.3, y + 5.1);
      doc.line(x + 3.1, y + 2.6, x + 5.1, y + 2.6);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.text(kind.slice(0, 2).toUpperCase(), x + 4, y + 5.3, { align: "center" });
    }
  }

  function flattenCoordinates(value, out = []) {
    if (!Array.isArray(value)) return out;
    if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      out.push(value);
      return out;
    }
    value.forEach((item) => flattenCoordinates(item, out));
    return out;
  }

  function routeMapCanvas(route) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    canvas.width = 1600; canvas.height = 650;
    const allTerritoryPoints = flattenCoordinates(C.features.map((f) => f.geometry.coordinates)),
      xs = allTerritoryPoints.map((p) => p[0]), ys = allTerritoryPoints.map((p) => p[1]),
      minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys),
      pad = 55, scale = Math.min((canvas.width - pad * 2) / (maxX - minX), (canvas.height - pad * 2) / (maxY - minY)),
      ox = (canvas.width - (maxX - minX) * scale) / 2,
      oy = (canvas.height - (maxY - minY) * scale) / 2,
      project = ([lon, lat]) => [ox + (lon - minX) * scale, canvas.height - oy - (lat - minY) * scale];
    ctx.fillStyle = "#f5f6fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#c5cad6"; ctx.lineWidth = 1.2;
    C.features.forEach((feature) => {
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      polygons.forEach((polygon) => polygon.forEach((ring) => {
        ctx.beginPath(); ring.forEach((point, index) => { const [x, y] = project(point); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }));
    });
    const points = (route.geometry || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 22; ctx.beginPath();
    points.forEach(([lat, lon], index) => { const [x, y] = project([lon, lat]); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.strokeStyle = `#${route.color || "000091"}`; ctx.lineWidth = 13; ctx.beginPath();
    points.forEach(([lat, lon], index) => { const [x, y] = project([lon, lat]); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    const routeStops = (route.stops || []).map((stop) => stopsById[stop.id] || stop).filter((stop) => Number.isFinite(stop.lon) && Number.isFinite(stop.lat));
    routeStops.forEach((stop) => { const [x, y] = project([stop.lon, stop.lat]); ctx.fillStyle = "#fff"; ctx.strokeStyle = `#${route.color || "000091"}`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = "#070047"; ctx.font = "600 25px Arial";
    const endpoints = routeStops.length > 1 ? [routeStops[0], routeStops[routeStops.length - 1]] : [];
    endpoints.forEach((stop, index) => { const [x, y] = project([stop.lon, stop.lat]); const label = stop.name; const width = ctx.measureText(label).width; const lx = Math.min(Math.max(x + (index ? -width - 24 : 24), 18), canvas.width - width - 18); const ly = Math.min(Math.max(y - 18, 32), canvas.height - 18); ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.fillRect(lx - 9, ly - 24, width + 18, 34); ctx.fillStyle = "#070047"; ctx.fillText(label, lx, ly); });
    ctx.fillStyle = "#000091"; ctx.font = "700 22px Arial"; ctx.fillText("VAL-D’OISE", 28, 38);
    ctx.strokeStyle = "#000091"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(canvas.width - 55, 55); ctx.lineTo(canvas.width - 55, 20); ctx.stroke(); ctx.fillStyle = "#000091"; ctx.beginPath(); ctx.moveTo(canvas.width - 55, 14); ctx.lineTo(canvas.width - 63, 29); ctx.lineTo(canvas.width - 47, 29); ctx.closePath(); ctx.fill(); ctx.font = "700 18px Arial"; ctx.fillText("N", canvas.width - 62, 75);
    return canvas;
  }

  function sectionTitle(doc, y, icon, title, subtitle) {
    drawIcon(doc, 14, y - 6, icon);
    doc.setTextColor(...DEEP); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(title, 26, y);
    if (subtitle) { doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(subtitle, 26, y + 4.5); }
    return y + (subtitle ? 10 : 6);
  }

  function addPageHeader(doc, logo, pageTitle) {
    if (logo) { const h = 18; doc.addImage(logo.data, "PNG", 14, 8, h * logo.ratio, h, undefined, "FAST"); }
    doc.setTextColor(...BLUE); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("MOBILITÉS · VAL-D’OISE", 61, 12);
    doc.setTextColor(...DEEP); doc.setFontSize(15); doc.text("Observatoire des transports", 61, 19);
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(pageTitle, 61, 24);
    doc.setDrawColor(...BLUE); doc.setLineWidth(0.8); doc.line(14, 30, 196, 30);
  }

  function addFooters(doc, label) {
    const total = doc.getNumberOfPages(), issued = new Date().toLocaleDateString("fr-FR");
    for (let page = 1; page <= total; page++) {
      doc.setPage(page); doc.setDrawColor(210, 215, 226); doc.setLineWidth(0.3); doc.line(14, 286, 196, 286);
      doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
      doc.text(`DDT du Val-d’Oise · ${issued}`, 14, 291);
      doc.text(`${label} · ${page}/${total}`, 196, 291, { align: "right" });
    }
  }

  function metricCard(doc, x, y, w, value, label, icon) {
    doc.setFillColor(247, 248, 252); doc.setDrawColor(219, 224, 235); doc.roundedRect(x, y, w, 18, 2.5, 2.5, "FD");
    drawIcon(doc, x + 4, y + 5, icon, [106, 106, 244]);
    doc.setTextColor(...DEEP); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(String(value), x + 15, y + 8.5);
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.text(label, x + 15, y + 13.5, { maxWidth: w - 18 });
  }

  function selectedRoute() { return activeRouteId ? routes[activeRouteId] : null; }

  function lineScheduleRows(route) {
    const scheduleId = scheduleSourceForRoute(activeRouteId);
    return route.stops.flatMap((stop) => {
      const directions = Object.entries(directionsForLineStop(stop.name, scheduleId)).filter(([destination]) => destination.toLowerCase() !== stop.name.toLowerCase());
      if (!directions.length) return [[stop.name, "Aucun passage théorique", "-"]];
      return directions.map(([destination, times], index) => [index ? "" : stop.name, `Vers ${displayedScheduleDirection(route, destination, scheduleId !== activeRouteId)}`, futureTimes(times).join(" · ") || "Service terminé"]);
    });
  }

  function addLineContent(doc, logo, route) {
    const lineColor = route.color || "000091", rgb = lineColor.match(/.{2}/g).map((v) => parseInt(v, 16)), textRgb = (route.text || "FFFFFF").match(/.{2}/g).map((v) => parseInt(v, 16));
    addPageHeader(doc, logo, "Fiche de connaissance territoriale");
    doc.setFillColor(...rgb); doc.roundedRect(14, 38, 25, 15, 3, 3, "F"); doc.setTextColor(...textRgb); doc.setFont("helvetica", "bold"); doc.setFontSize(route.short.length > 4 ? 11 : 15); doc.text(route.short, 26.5, 48, { align: "center" });
    doc.setTextColor(...DEEP); doc.setFontSize(19); doc.text("Ligne de transport", 45, 45);
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text((route.destinations || []).join(" / ") || route.long, 45, 51, { maxWidth: 145 });
    metricCard(doc, 14, 58, 42, route.stops.length, "arrêts dans le Val-d’Oise", "pin");
    metricCard(doc, 60, 58, 42, (route.destinations || []).length || 2, "terminus / directions", "network");
    metricCard(doc, 106, 58, 42, Object.keys(routes).length, "lignes IDFM recensées", "bus");
    metricCard(doc, 152, 58, 44, LIVE.sales?.points?.length || 0, "points de vente", "€");
    let y = sectionTitle(doc, 86, "pin", "Carte de situation", "Tracé dans le Val-d’Oise · arrêts et terminus");
    const mapCanvas = routeMapCanvas(route); doc.addImage(mapCanvas.toDataURL("image/jpeg", .92), "JPEG", 14, y, 182, 74, undefined, "FAST");
    y += 80;
    y = sectionTitle(doc, y, "network", "Lecture territoriale", "Caractéristiques essentielles de la desserte");
    const serviceStart = route.stops
      .flatMap((stop) => Object.values(directionsForLineStop(stop.name, scheduleSourceForRoute(activeRouteId))).flat())
      .sort()[0] || "-";
    doc.autoTable({ startY: y, margin: { left: 14, right: 14 }, theme: "plain", tableWidth: 182,
      body: [["Ligne", route.long || route.short], ["Terminus", (route.destinations || []).join(" / ") || "Non renseignés"], ["Premier horaire GTFS observé", serviceStart], ["Données", `GTFS IDFM du ${D.date.slice(6,8)}/${D.date.slice(4,6)}/${D.date.slice(0,4)}`]],
      styles: { fontSize: 7.5, cellPadding: 2, textColor: DEEP, lineColor: [229,232,240], lineWidth: { bottom: .2 } }, columnStyles: { 0: { fontStyle: "bold", textColor: MUTED, cellWidth: 48 } } });
    doc.addPage(); addPageHeader(doc, logo, `Ligne ${route.short} · horaires et desserte`);
    y = sectionTitle(doc, 40, "clock", "Prochains passages théoriques", "Horaires GTFS dans les deux sens · quatre prochains passages disponibles");
    doc.autoTable({ startY: y, margin: { left: 14, right: 14, bottom: 20 }, head: [["Arrêt", "Direction", "Prochains passages"]], body: lineScheduleRows(route), repeatHeaders: true,
      headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: "bold", fontSize: 7.5 },
      styles: { fontSize: 7, cellPadding: 1.8, lineColor: [226,230,238], lineWidth: { bottom: .18 }, valign: "middle" },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 46 }, 1: { cellWidth: 72 }, 2: { textColor: BLUE, fontStyle: "bold", cellWidth: 58 } },
      didDrawPage: (data) => { if (data.pageNumber > 1) addPageHeader(doc, logo, `Ligne ${route.short} · horaires et desserte`); } });
    let after = doc.lastAutoTable.finalY + 9;
    if (after > 244) { doc.addPage(); addPageHeader(doc, logo, `Ligne ${route.short} · arrêts et sources`); after = 40; }
    after = sectionTitle(doc, after, "pin", "Séquence des arrêts", `${route.stops.length} arrêts recensés sur le tracé sélectionné`);
    const stopRows = []; for (let i = 0; i < route.stops.length; i += 2) stopRows.push([`${String(i+1).padStart(2,"0")}  ${route.stops[i].name}`, route.stops[i+1] ? `${String(i+2).padStart(2,"0")}  ${route.stops[i+1].name}` : ""]);
    doc.autoTable({ startY: after, margin: { left: 14, right: 14, bottom: 20 }, body: stopRows, theme: "grid", styles: { fontSize: 7.2, cellPadding: 2, lineColor: [225,229,238], textColor: DEEP }, columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } } });
    after = doc.lastAutoTable.finalY + 8;
    if (after > 250) { doc.addPage(); addPageHeader(doc, logo, `Ligne ${route.short} · sources`); after = 40; }
    sectionTitle(doc, after, "i", "Sources et limites", "Traçabilité des informations de la fiche");
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`Île-de-France Mobilités · GTFS théorique du ${D.date.slice(6,8)}/${D.date.slice(4,6)}/${D.date.slice(0,4)}. Référentiels territoriaux : IGN - BD TOPO et Géoplateforme. Circulation : Sytadin / DIRIF, dernière actualisation ${LIVE.traffic?.updated ? new Date(LIVE.traffic.updated).toLocaleString("fr-FR") : "indisponible"}. Les horaires théoriques ne remplacent pas l’information voyageurs en temps réel.`, 14, after + 12, { maxWidth: 182, lineHeightFactor: 1.45 });
  }

  function addGenericContent(doc, logo) {
    addPageHeader(doc, logo, "Fiche de connaissance territoriale");
    doc.setFillColor(245, 246, 251); doc.setDrawColor(220, 224, 234); doc.roundedRect(14, 38, 182, 30, 3, 3, "FD");
    drawIcon(doc, 20, 47, currentDetail.type.includes("ROUTE") ? "R" : currentDetail.type.includes("CYCL") ? "V" : "pin");
    doc.setTextColor(...BLUE); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text(currentDetail.type, 32, 49);
    doc.setTextColor(...DEEP); doc.setFontSize(18); doc.text(currentDetail.title, 32, 59, { maxWidth: 155 });
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(currentDetail.sub || "", 32, 64, { maxWidth: 155 });
    metricCard(doc, 14, 74, 42, Object.keys(routes).length, "lignes IDFM", "network"); metricCard(doc, 60, 74, 42, D.hubs.length, "zones et pôles", "pin"); metricCard(doc, 106, 74, 42, LIVE.sales?.points?.length || 0, "points de vente", "€"); metricCard(doc, 152, 74, 44, 184, "communes", "i");
    const wrapper = document.createElement("div"); wrapper.innerHTML = currentDetail.html || "";
    const rows = [...wrapper.querySelectorAll(".summary")].map((section) => [section.querySelector("h3")?.textContent.trim() || "Information", section.textContent.replace(section.querySelector("h3")?.textContent || "", "").replace(/\s+/g, " ").trim()]).filter((row) => row[1]);
    const y = sectionTitle(doc, 104, "i", "Synthèse des informations", "Données disponibles pour l’élément sélectionné");
    doc.autoTable({ startY: y, margin: { left: 14, right: 14, bottom: 24 }, body: rows, theme: "grid", styles: { fontSize: 8, cellPadding: 3, lineColor: [224,228,237], valign: "top" }, columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", textColor: BLUE, fillColor: [247,248,252] }, 1: { cellWidth: 137, textColor: DEEP } }, didDrawPage: (data) => { if (data.pageNumber > 1) addPageHeader(doc, logo, currentDetail.title); } });
    let after = doc.lastAutoTable.finalY + 8; if (after > 245) { doc.addPage(); addPageHeader(doc, logo, currentDetail.title); after = 40; }
    sectionTitle(doc, after, "i", "Sources et fraîcheur", "Référentiels mobilisés"); doc.setTextColor(...MUTED); doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text("Île-de-France Mobilités · transport.data.gouv.fr · IGN BD TOPO · Géoplateforme · Base nationale des aménagements cyclables · Geovelo · Sytadin / DIRIF. Cette fiche restitue les données ouvertes disponibles au moment de l’édition.", 14, after + 12, { maxWidth: 182, lineHeightFactor: 1.45 });
  }

  function buildTerritorialPdf() {
    if (!currentDetail || !window.jspdf?.jsPDF) return null;
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true }), logo = logoData(), route = selectedRoute();
    if (route) addLineContent(doc, logo, route); else addGenericContent(doc, logo);
    addFooters(doc, currentDetail.title);
    doc.setProperties({ title: `Synthèse territoriale - ${currentDetail.title}`, subject: "Observatoire des transports du Val-d’Oise", author: "DDT du Val-d’Oise", creator: "Observatoire des transports" });
    return doc;
  }

  async function downloadTerritorialPdf() {
    const doc = buildTerritorialPdf();
    if (!doc) return;
    doc.save(`synthese-transport-${safeFile(currentDetail.title)}.pdf`);
  }

  window.buildTerritorialPdf = buildTerritorialPdf;
  window.downloadTerritorialPdf = downloadTerritorialPdf;
  document.querySelector("#export-pdf").onclick = downloadTerritorialPdf;
})();
