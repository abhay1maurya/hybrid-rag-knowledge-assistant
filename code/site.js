(function () {
  function ensureToastRoot() {
    let root = document.getElementById("app-toast-root");
    if (root) return root;

    root = document.createElement("div");
    root.id = "app-toast-root";
    root.style.position = "fixed";
    root.style.top = "16px";
    root.style.right = "16px";
    root.style.zIndex = "9999";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "8px";
    root.style.maxWidth = "320px";
    document.body.appendChild(root);
    return root;
  }

  function toast(message, kind) {
    const root = ensureToastRoot();
    const el = document.createElement("div");
    const borderColor = kind === "error" ? "rgba(248, 113, 113, 0.55)" : "rgba(249, 115, 22, 0.55)";

    el.textContent = message;
    el.style.border = "1px solid " + borderColor;
    el.style.background = "rgba(12, 12, 12, 0.92)";
    el.style.color = "#f5f5f4";
    el.style.borderRadius = "10px";
    el.style.padding = "10px 12px";
    el.style.fontSize = "12px";
    el.style.lineHeight = "1.4";
    el.style.boxShadow = "0 16px 30px rgba(0,0,0,0.4)";
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    el.style.transition = "opacity 180ms ease, transform 180ms ease";

    root.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });

    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      setTimeout(function () {
        el.remove();
      }, 200);
    }, 1800);
  }

  function markActiveNavLink() {
    const path = location.pathname.split("/").pop();
    if (!path) return;

    const links = document.querySelectorAll("a[href]");
    links.forEach(function (link) {
      const href = link.getAttribute("href") || "";
      if (!href.endsWith(path)) return;
      if (!/code\d?\.html$/.test(href) && href !== "chat.html") return;

      if (!link.classList.contains("text-brand")) {
        link.classList.add("text-brand");
      }
      if (link.classList.contains("border") && !link.classList.contains("bg-brand/20")) {
        link.classList.add("border-brand/40");
      }
    });
  }

  function setupRevealAnimations() {
    const candidates = document.querySelectorAll("section, article, form, .rounded-xl, .rounded-2xl");
    candidates.forEach(function (el, i) {
      if (i > 24) return;
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i * 18, 180) + "ms";
    });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06 });

    document.querySelectorAll(".reveal").forEach(function (el) {
      observer.observe(el);
    });
  }

  function setupCommandFocus() {
    document.addEventListener("keydown", function (event) {
      const isHotkey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isHotkey) return;
      event.preventDefault();

      const target = document.querySelector('input[type="search"], textarea, input[type="text"], input[type="email"]');
      if (!target) return;

      target.focus();
      if (typeof target.select === "function") target.select();
    });
  }

  function setupFormFeedback() {
    const forms = document.querySelectorAll("form");
    forms.forEach(function (form) {
      if (form.hasAttribute("data-no-auto-feedback")) return;
      form.addEventListener("submit", function () {
        const submit = form.querySelector('button[type="submit"]');
        if (!submit) return;
        submit.dataset.originalLabel = submit.textContent || "";
        submit.textContent = "Working...";
        submit.disabled = true;
        setTimeout(function () {
          submit.disabled = false;
          submit.textContent = submit.dataset.originalLabel || "Submit";
        }, 700);
      });
    });
  }

  window.toast = window.toast || toast;
  window.appToast = toast;

  document.addEventListener("DOMContentLoaded", function () {
    markActiveNavLink();
    setupRevealAnimations();
    setupCommandFocus();
    setupFormFeedback();

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput && searchInput.previousElementSibling) {
      searchInput.previousElementSibling.classList.add("kbd-hint");
    }
  });
})();
