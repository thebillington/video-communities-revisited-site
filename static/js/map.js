/* Interactive map for /map/.
   Progressive enhancement: the table below the map contains every entry and
   works with this file absent. */
(function () {
  "use strict";

  var container = document.getElementById("map");
  if (!container || typeof L === "undefined") return;

  var dataUrl = container.getAttribute("data-data") || "locations.json";
  var centre = (container.getAttribute("data-centre") || "54.4,-3.2").split(",");
  var zoom = parseInt(container.getAttribute("data-zoom") || "5", 10);
  var tiles = container.getAttribute("data-tiles") || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var attribution = container.getAttribute("data-attribution") || '&copy; OpenStreetMap contributors';

  var filters = {
    type: document.getElementById("filter-type"),
    region: document.getElementById("filter-region"),
    status: document.getElementById("filter-status"),
    search: document.getElementById("filter-search")
  };
  var counter = document.getElementById("map-count");
  var rows = Array.prototype.slice.call(document.querySelectorAll(".location-table tbody tr[data-id]"));

  var map = L.map(container, { scrollWheelZoom: false }).setView([parseFloat(centre[0]), parseFloat(centre[1])], zoom);
  L.tileLayer(tiles, { attribution: attribution, maxZoom: 18 }).addTo(map);

  var cluster = L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup();
  var markers = {};
  var entries = [];

  function iconFor(entry) {
    var dim = entry.status === "closed" ? " is-dim" : "";
    return L.divIcon({
      className: "",
      html: '<span class="marker-dot' + dim + '"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function popupFor(entry) {
    var html = '<p class="popup-name">' + escapeHtml(entry.name) + "</p>";
    html += '<p class="popup-meta">' + escapeHtml(entry.type.replace(/-/g, " "));
    if (entry.years) html += " &middot; " + escapeHtml(entry.years);
    if (entry.town) html += " &middot; " + escapeHtml(entry.town);
    html += "</p>";
    if (entry.description) html += '<p class="popup-text">' + escapeHtml(entry.description) + "</p>";
    if (entry.url) html += '<p class="popup-text"><a href="' + escapeHtml(entry.url) + '">Visit website</a></p>';
    if (entry.sample) html += '<p class="popup-sample">Sample entry</p>';
    return html;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function matches(entry) {
    if (filters.type && filters.type.value && entry.type !== filters.type.value) return false;
    if (filters.region && filters.region.value && entry.region !== filters.region.value) return false;
    if (filters.status && filters.status.value && entry.status !== filters.status.value) return false;
    var query = (filters.search && filters.search.value ? filters.search.value : "").trim().toLowerCase();
    if (query) {
      var haystack = [entry.name, entry.town, entry.region, entry.type, entry.years, entry.description]
        .join(" ").toLowerCase();
      if (haystack.indexOf(query) === -1) return false;
    }
    return true;
  }

  function apply() {
    var visible = 0;
    cluster.clearLayers();
    var shown = [];

    entries.forEach(function (entry) {
      var row = document.getElementById("place-" + entry.id);
      var note = row ? row.nextElementSibling : null;
      if (matches(entry)) {
        visible += 1;
        shown.push(entry);
        var marker = markers[entry.id];
        if (marker) {
          marker.setIcon(iconFor(entry));
          marker.bindPopup(popupFor(entry));
          cluster.addLayer(marker);
        }
        if (row) row.hidden = false;
        if (note && note.classList.contains("location-note")) note.hidden = false;
      } else {
        if (row) row.hidden = true;
        if (note && note.classList.contains("location-note")) note.hidden = true;
      }
    });

    map.addLayer(cluster);
    if (counter) {
      counter.textContent = visible === 1 ? "1 entry" : visible + " entries";
    }
    return shown;
  }

  function focusEntry(id) {
    var marker = markers[id];
    if (!marker) return;
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 12));
    cluster.zoomToShowLayer(marker, function () {
      marker.openPopup();
    });
    var row = document.getElementById("place-" + id);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  fetch(dataUrl)
    .then(function (response) { return response.json(); })
    .then(function (data) {
      entries = data;
      entries.forEach(function (entry) {
        var marker = L.marker([entry.lat, entry.lng], {
          icon: iconFor(entry),
          title: entry.name,
          alt: entry.name + ", " + entry.town
        });
        marker.bindPopup(popupFor(entry));
        markers[entry.id] = marker;
      });
      apply();

      rows.forEach(function (row) {
        row.addEventListener("click", function () {
          focusEntry(row.getAttribute("data-id"));
        });
      });

      if (window.location.hash) {
        var wanted = window.location.hash.replace("#place-", "");
        if (markers[wanted]) focusEntry(wanted);
      }
    })
    .catch(function (error) {
      var counter = document.getElementById("map-count");
      if (counter) counter.textContent = "Map data could not be loaded; use the list below.";
      console.error("Could not load map data:", error);
    });

  Object.keys(filters).forEach(function (key) {
    var element = filters[key];
    if (!element) return;
    element.addEventListener("input", apply);
    element.addEventListener("change", apply);
  });
})();
