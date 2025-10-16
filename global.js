// Query helper
function $$(selector, context = document) {
  return Array.from((context || document).querySelectorAll(selector));
}

function markCurrentNavLink() {
  const navLinks = $$("nav a");
  const current = navLinks.find((a) => a.host === location.host && normalizePath(a.pathname) === normalizePath(location.pathname));

  if (current) {
    current.classList.add('current');
    current.setAttribute('aria-current', 'page');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectColorSchemeControl();
    injectNav();
    markCurrentNavLink();
  });
} else {
  injectColorSchemeControl();
  injectNav();
  markCurrentNavLink();
}

function normalizePath(p) {
  if (!p) return p;
  if (p.endsWith('/index.html')) p = p.slice(0, -11);
  if (p.endsWith('/') && p !== '/') p = p.slice(0, -1);
  return p;
}

function injectNav() {
  const pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact Me' },
    { url: 'resume/', title: 'Resume' },
    { url: 'https://github.com/dsalcido-ucsd', title: 'GitHub Profile', external: true },
  ];

  // Determine the base URL from the loaded script so links resolve relative
  // to wherever this module is served from (works with file://, localhost, or GitHub Pages)
  const scriptEl = document.currentScript || document.querySelector('script[type="module"][src$="global.js"], script[type="module"][src*="/global.js"], script[type="module"][src*="global.js"]');
  let scriptBase = new URL('.', location.href).href;
  if (scriptEl) {
    try {
      const resolved = new URL(scriptEl.src, location.href).href;
      scriptBase = new URL('.', resolved).href;
    } catch (e) {
      // fallback: keep location.href's directory
    }
  }

  const nav = document.createElement('nav');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');
  document.body.prepend(nav);

  for (const p of pages) {
    let url = p.url;
    const title = p.title;
    // Resolve relative URLs against the script base so links are correct regardless of how the page is opened
    if (!url.startsWith('http') && !url.startsWith('/')) {
      try {
        url = new URL(url, scriptBase).href;
      } catch (e) {
        // leave url as-is on failure
      }
    }
    const href = url;

    // Create anchor element and set properties (use DOM methods for flexibility)
    const a = document.createElement('a');
    a.href = href;
    a.textContent = title;

    // Detect external links: if the link's host is different from the current host
    const isExternal = (a.protocol === 'http:' || a.protocol === 'https:') && a.host && a.host !== location.host;
    if (isExternal) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }

    // Highlight current link using normalized pathnames
    const isCurrent = a.host === location.host && normalizePath(a.pathname) === normalizePath(location.pathname);
    a.classList.toggle('current', isCurrent);
    if (isCurrent) a.setAttribute('aria-current', 'page');

    nav.append(a);
  }
}

// Inject a color-scheme select at the start of the body and persist choice
function injectColorSchemeControl() {
  const html = `
    <label class="color-scheme">
      Theme:
      <select id="color-scheme-select">
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `;

  document.body.insertAdjacentHTML('afterbegin', html);

  const select = document.getElementById('color-scheme-select');
  if (!select) return;

  // Load stored preference
  let stored = null;
  try { stored = localStorage.getItem('color-scheme'); } catch (err) { /* ignore */ }
  if (stored) {
    select.value = stored;
    document.documentElement.style.setProperty('color-scheme', stored);
  }

  select.addEventListener('input', (e) => {
    const v = e.target.value;
    try { localStorage.setItem('color-scheme', v); } catch (err) { /* ignore */ }
    document.documentElement.style.setProperty('color-scheme', v);
  });
}