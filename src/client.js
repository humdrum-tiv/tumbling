(function () {
  'use strict';

  var openEntry = null;
  var openPanel = null;

  function closePanel() {
    if (!openEntry) return;
    openEntry.classList.remove('is-expanded');
    openEntry.setAttribute('aria-expanded', 'false');
    if (openPanel && openPanel.parentNode) {
      openPanel.parentNode.removeChild(openPanel);
    }
    openEntry = null;
    openPanel = null;
  }

  function buildExpandPanel(entry) {
    var expandHtml = entry.dataset.expand;
    var date = entry.dataset.date || '';
    var panel = document.createElement('div');
    panel.className = 'expand-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Expanded content');
    panel.innerHTML =
      '<div class="expand-panel-header">' +
        '<span class="expand-date">' + escapeHtml(date) + '</span>' +
        '<button class="expand-close" aria-label="Close">&#x2715;&ensp;Close</button>' +
      '</div>' +
      expandHtml;
    panel.querySelector('.expand-close').addEventListener('click', function (e) {
      e.stopPropagation();
      closePanel();
    });
    return panel;
  }

  function openEntryPanel(entry) {
    if (openEntry === entry) {
      closePanel();
      return;
    }
    closePanel();

    entry.classList.add('is-expanded');
    entry.setAttribute('aria-expanded', 'true');

    var panel = buildExpandPanel(entry);
    entry.insertAdjacentElement('afterend', panel);

    openEntry = entry;
    openPanel = panel;

    // Scroll so expand panel is visible
    requestAnimationFrame(function () {
      var rect = panel.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initEntries() {
    var entries = document.querySelectorAll('.entry[data-expand]');
    entries.forEach(function (entry) {
      entry.setAttribute('tabindex', '0');
      entry.setAttribute('role', 'button');
      entry.setAttribute('aria-expanded', 'false');

      entry.addEventListener('click', function (e) {
        // Don't intercept clicks on links inside entries
        if (e.target.closest('a')) return;
        openEntryPanel(entry);
      });

      entry.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEntryPanel(entry);
        }
      });
    });

    // Also handle page-block entries (on static pages)
    var pageBlocks = document.querySelectorAll('.page-block[data-expand]');
    pageBlocks.forEach(function (block) {
      block.setAttribute('tabindex', '0');
      block.setAttribute('role', 'button');
      block.setAttribute('aria-expanded', 'false');

      block.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        openEntryPanel(block);
      });

      block.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEntryPanel(block);
        }
      });
    });
  }

  // Global keyboard listener
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePanel();
  });

  // In-place image expansion (only when natural height exceeds preview cap)
  var IMAGE_MAX_H = 420;

  function initImageExpansion() {
    document.querySelectorAll('.entry--image').forEach(function (entry) {
      var img = entry.querySelector('.entry-image-preview');
      var wrap = entry.querySelector('.entry-image-wrap');
      if (!img || !wrap) return;

      function setup() {
        var containerW = wrap.offsetWidth || img.offsetWidth;
        var naturalH = img.naturalHeight;
        var naturalW = img.naturalWidth;
        if (!naturalH || !naturalW || !containerW) return;

        // How tall would the image render at full width?
        var renderedH = (naturalH / naturalW) * containerW;
        if (renderedH <= IMAGE_MAX_H * 1.15) return; // fits within ~15% of cap — no expand needed

        // Add the expand/collapse hint
        var hintWrap = document.createElement('div');
        hintWrap.className = 'entry-inner';
        hintWrap.style.paddingTop = '0';
        var hint = document.createElement('div');
        hint.className = 'entry-more-hint';
        hint.textContent = 'Expand';
        hintWrap.appendChild(hint);
        entry.appendChild(hintWrap);

        entry.setAttribute('tabindex', '0');
        entry.setAttribute('role', 'button');
        entry.setAttribute('aria-expanded', 'false');

        function toggle(e) {
          if (e.target.closest('a')) return;
          var expanded = entry.classList.toggle('is-image-expanded');
          entry.setAttribute('aria-expanded', String(expanded));
          hint.textContent = expanded ? 'Collapse' : 'Expand';
        }

        entry.addEventListener('click', toggle);
        entry.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
        });
      }

      if (img.complete && img.naturalHeight > 0) {
        setup();
      } else {
        img.addEventListener('load', setup);
      }
    });
  }

  // Handle favicon load errors gracefully
  function initFavicons() {
    var favicons = document.querySelectorAll('.link-favicon');
    favicons.forEach(function (img) {
      img.addEventListener('error', function () {
        var fallback = document.createElement('span');
        fallback.className = 'link-favicon-fallback';
        fallback.textContent = '↗';
        img.parentNode.replaceChild(fallback, img);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initEntries();
      initImageExpansion();
      initFavicons();
    });
  } else {
    initEntries();
    initImageExpansion();
    initFavicons();
  }
})();
