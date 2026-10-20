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
  var showMore = document.getElementById("show-more");
  // the list is long now, so show a page of it and let people ask for more
  var LIST_LIMIT = 50;
  var listExpanded = false;

  /* the trading-year filter */
  var yearFrom = document.getElementById("year-from");
  var yearTo = document.getElementById("year-to");
  var presets = document.getElementById("year-presets");
  var yearsNote = document.getElementById("years-note");

  var map = L.map(container, { scrollWheelZoom: false }).setView([parseFloat(centre[0]), parseFloat(centre[1])], zoom);

  // The page scrolls over the map by default, which is friendlier on a long
  // page. Hold the command key (Mac) or control key (Windows, Linux) while
  // scrolling, or pinch, and the map zooms instead.
  var wheelZoomOn = false;
  function wheelZoom(enable) {
    if (wheelZoomOn === enable) return;
    wheelZoomOn = enable;
    if (enable) {
      map.scrollWheelZoom.enable();
    } else {
      map.scrollWheelZoom.disable();
    }
  }
  ["Meta", "Control"].forEach(function (key) {
    document.addEventListener("keydown", function (event) {
      if (event.key === key) wheelZoom(true);
    });
    document.addEventListener("keyup", function (event) {
      if (event.key === key) wheelZoom(false);
    });
  });
  window.addEventListener("blur", function () { wheelZoom(false); });
  // a trackpad pinch arrives as a wheel event with the control key set
  container.addEventListener("wheel", function (event) {
    if (event.ctrlKey) wheelZoom(true);
  }, { passive: true });
  L.tileLayer(tiles, { attribution: attribution, maxZoom: 18 }).addTo(map);

  window.vcrMap = map;  // a handle for debugging and for the tests
  var cluster = L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup();
  var markers = {};
  var entries = [];

  function iconFor(entry) {
    var dim = entry.status === "closed" ? " is-dim" : "";
    return L.divIcon({
      className: "",
      html: '<span class="marker-dot' + dim + '"></span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function yearRange(entry) {
    var from = entry.active_from;
    var to = entry.active_to;
    if (from === null || from === undefined || from === "") return null;
    return { from: parseInt(from, 10), to: to === null || to === undefined || to === "" ? null : parseInt(to, 10) };
  }

  function formatYears(entry) {
    var from = entry.active_from;
    var to = entry.active_to;
    if (from === null || from === undefined || from === "") {
      return entry.years ? entry.years : "dates not recorded";
    }
    if (to === null || to === undefined || to === "") {
      if (entry.date_basis === "current") return "trading as of " + from;
      return "from " + from;
    }
    return from + "\u2013" + to;
  }

  function statusWord(entry) {
    if (entry.status === "open") return "still trading";
    if (entry.status === "closed") return "closed";
    return "status unknown";
  }

  function popupFor(entry) {
    var html = '<p class="popup-name">' + escapeHtml(entry.name) + "</p>";
    html += '<p class="popup-meta">' + escapeHtml(entry.type.replace(/-/g, " "));
    if (entry.town) html += " &middot; " + escapeHtml(entry.town);
    html += "</p>";
    html += '<p class="popup-years">' + escapeHtml(formatYears(entry)) +
      ' <span class="popup-status popup-status-' + escapeHtml(entry.status) + '">' +
      escapeHtml(statusWord(entry)) + "</span></p>";
    if (entry.address) {
      var addressLabel = entry.source === "Companies House" ? "Registered office" : "Address";
      html += '<p class="popup-address"><span class="popup-label">' + addressLabel + "</span> " +
        escapeHtml(entry.address) + (entry.postcode ? ", " + escapeHtml(entry.postcode) : "") +
        (entry.town ? ", " + escapeHtml(entry.town) : "") + "</p>";
    }
    if (entry.description) html += '<p class="popup-text">' + escapeHtml(entry.description) + "</p>";
    if (entry.url) html += '<p class="popup-text"><a href="' + escapeHtml(entry.url) + '">Visit website</a></p>';
    if (entry.source) html += '<p class="popup-source">Source: ' + escapeHtml(entry.source) + "</p>";
    if (entry.sample) html += '<p class="popup-sample">Sample entry</p>';
    return html;
  }

  function currentYears() {
    var from = yearFrom && yearFrom.value !== "" ? parseInt(yearFrom.value, 10) : null;
    var to = yearTo && yearTo.value !== "" ? parseInt(yearTo.value, 10) : null;
    if (from === null && to === null) return null;
    if (from === null) from = 1900;
    if (to === null) to = 2100;
    if (from > to) { var swap = from; from = to; to = swap; }
    return { from: from, to: to };
  }

  function matchesYears(entry, range) {
    if (!range) return true;
    var years = yearRange(entry);
    if (!years) return false;
    var starts = years.from;
    var ends = years.to === null ? range.to : years.to;
    return starts <= range.to && ends >= range.from;
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
    return matchesYears(entry, currentYears());
  }

  function apply() {
    var visible = 0;
    var undated = 0;
    var range = currentYears();
    cluster.clearLayers();
    var shown = [];

    entries.forEach(function (entry) {
      var row = document.getElementById("place-" + entry.id);
      var note = row ? row.nextElementSibling : null;
      var ok = matches(entry);
      if (ok) {
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

    // the list below is the authority on how many entries there are: some
    // could not be placed on the map
    var shownRows = 0;
    var hiddenUndated = 0;
    rows.forEach(function (row) {
      if (!row.hidden) {
        shownRows += 1;
      } else if (range && !row.getAttribute("data-from")) {
        hiddenUndated += 1;
      }
    });

    // and only show a page of it at a time, on top of the filter
    if (showMore) {
      var matching = rows.filter(function (row) { return !row.hidden; });
      matching.forEach(function (row, index) {
        if (listExpanded || index < LIST_LIMIT) {
          row.removeAttribute("data-beyond");
        } else {
          row.setAttribute("data-beyond", "1");
        }
      });
      var remaining = Math.max(0, matching.length - LIST_LIMIT);
      showMore.hidden = remaining === 0 && !listExpanded;
      showMore.textContent = listExpanded
        ? "Show fewer entries"
        : "Show " + remaining + " more entr" + (remaining === 1 ? "y" : "ies");
    }
    if (counter) {
      counter.textContent = shownRows === 1 ? "1 entry" : shownRows + " entries";
    }
    if (yearsNote) {
      var onMap = visible;
      yearsNote.textContent = range
        ? "Showing " + range.from + " to " + range.to + ". " + onMap + " on the map" +
          (hiddenUndated ? ", " + hiddenUndated + " without dates hidden." : ".")
        : onMap + " of " + rows.length + " on the map";
    }
    return shown;
  }

  function focusEntry(id, scrollToMap) {
    var marker = markers[id];
    if (!marker) return;
    if (scrollToMap !== false && container.scrollIntoView) {
      // the list is below the map, so bring the map back into view
      container.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 12));
    cluster.zoomToShowLayer(marker, function () {
      marker.openPopup();
    });
    var row = document.getElementById("place-" + id);
    if (row && scrollToMap === false) row.scrollIntoView({ behavior: "smooth", block: "center" });
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
        marker.bindTooltip(
          escapeHtml(entry.name) + " \u00b7 " + escapeHtml(formatYears(entry)),
          { direction: "top", offset: [0, -18] }
        );
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
    element.addEventListener("change", function () {
      if (key === "status" && stillTrading) {
        stillTrading.setAttribute("aria-pressed", element.value === "open" ? "true" : "false");
      }
      apply();
    });
  });

  if (yearFrom && yearTo) {
    [yearFrom, yearTo].forEach(function (input) {
      input.addEventListener("input", apply);
      input.addEventListener("change", apply);
    });
  }

  var stillTrading = document.getElementById("still-trading");
  if (showMore) {
    showMore.addEventListener("click", function () {
      listExpanded = !listExpanded;
      apply();
    });
  }

  if (stillTrading && filters.status) {
    stillTrading.addEventListener("click", function () {
      var on = stillTrading.getAttribute("aria-pressed") !== "true";
      stillTrading.setAttribute("aria-pressed", on ? "true" : "false");
      filters.status.value = on ? "open" : "";
      apply();
    });
  }

  if (presets) {
    presets.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-from]");
      if (!button) return;
      yearFrom.value = button.getAttribute("data-from");
      yearTo.value = button.getAttribute("data-to");
      Array.prototype.forEach.call(presets.querySelectorAll("button"), function (other) {
        other.classList.toggle("is-active", other === button);
      });
      apply();
    });
  }
})();
