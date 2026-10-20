/* Progressive enhancement only: everything works without this file. */
(function () {
  "use strict";

  /* --- mobile menu ---------------------------------------------------- */

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* --- light / dark theme ---------------------------------------------- */

  var themeToggles = document.querySelectorAll(".theme-toggle");

  if (themeToggles.length) {
    var root = document.documentElement;
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    var STORAGE_KEY = "vcr-theme";

    /* the theme in force right now */
    function current() {
      if (root.classList.contains("theme-dark")) return "dark";
      if (root.classList.contains("theme-light")) return "light";
      return query.matches ? "dark" : "light";
    }

    function describe(theme) {
      var other = theme === "dark" ? "light" : "dark";
      Array.prototype.forEach.call(themeToggles, function (button) {
        button.setAttribute("aria-label", "Switch to " + other + " theme");
        button.setAttribute("title", "Switch to " + other + " theme");
        var text = button.querySelector(".theme-toggle-text");
        if (text) text.textContent = "Use the " + other + " theme";
      });
    }

    function apply(theme) {
      root.classList.remove("theme-dark", "theme-light");
      root.classList.add("theme-" + theme);
      root.setAttribute("data-theme", theme);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", theme === "dark" ? "#0a0c0f" : "#efe8da");
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch (error) {
        /* storage is not available; the choice lasts for this page only */
      }
      describe(theme);
    }

    describe(current());

    Array.prototype.forEach.call(themeToggles, function (button) {
      button.addEventListener("click", function () {
        apply(current() === "dark" ? "light" : "dark");
      });
    });

    /* if the visitor has not chosen, keep following the operating system */
    var onSystemChange = function () {
      if (root.classList.contains("theme-dark") || root.classList.contains("theme-light")) return;
      var theme = query.matches ? "dark" : "light";
      root.setAttribute("data-theme", theme);
      describe(theme);
    };
    if (query.addEventListener) {
      query.addEventListener("change", onSystemChange);
    } else if (query.addListener) {
      query.addListener(onSystemChange);
    }
  }
})();
