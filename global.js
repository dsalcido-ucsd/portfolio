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

// Fetch a JSON file and return the parsed object.
export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    // Inspect response in browser devtools
    console.log('fetchJSON response for', url, response);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    return null;
  }
}

function injectNav() {
  const pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact Me' },
    { url: 'resume/', title: 'Resume' },
    { url: 'meta/', title: 'Meta' },
    { url: 'https://github.com/dsalcido-ucsd', title: 'GitHub Profile', external: true },
  ];
  const scriptEl = document.currentScript || document.querySelector('script[type="module"][src$="global.js"], script[type="module"][src*="/global.js"], script[type="module"][src*="global.js"]');
  let scriptBase = new URL('.', location.href).href;
  if (scriptEl) {
    try {
      const resolved = new URL(scriptEl.src, location.href).href;
      scriptBase = new URL('.', resolved).href;
    } catch (e) {
    }
  }

  const nav = document.createElement('nav');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');
  document.body.prepend(nav);

  for (const p of pages) {
    let url = p.url;
    const title = p.title;
    if (!url.startsWith('http') && !url.startsWith('/')) {
      try {
        url = new URL(url, scriptBase).href;
      } catch (e) {
      }
    }
    const href = url;
    const a = document.createElement('a');
    a.href = href;
    a.textContent = title;
    const isExternal = (a.protocol === 'http:' || a.protocol === 'https:') && a.host && a.host !== location.host;
    if (isExternal) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
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

  function applyTheme(v) {
    try { document.documentElement.style.setProperty('color-scheme', v); } catch (err) { }
    if (v === 'light dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
    ensureLightOverrides();
  }

  function ensureLightOverrides() {
    if (document.getElementById('global-light-overrides')) return;
    const css = `
      :root { --color-text-deep-blue: #264c7a; --color-highlight-blue: #5b8fd6; }
      html[data-theme="light"] { background: #ffffff !important; color: #0b0b0b !important; }
      html[data-theme="light"] body { background: #ffffff !important; }
      html[data-theme="light"] h1, html[data-theme="light"] h2, html[data-theme="light"] h3, html[data-theme="light"] h4 { color: var(--color-text-deep-blue) !important; }
      html[data-theme="light"] .projects article { background: #ffffff !important; color: inherit !important; box-shadow: 0 6px 18px rgba(15,23,42,0.06) !important; border: none !important; }
  html[data-theme="light"] .color-scheme { background: rgba(255,255,255,0.98) !important; color: canvastext !important; border: 1px solid rgba(0,0,0,0.06) !important; }
  html[data-theme="light"] a { color: var(--color-text-deep-blue) !important; }
      html[data-theme="light"] section > article { background: transparent !important; border-left-color: rgba(0,0,0,0.06) !important; }

  html[data-theme="light"] time { color: #0b0b0b !important; }

      html[data-theme="light"] p,
      html[data-theme="light"] a,
      html[data-theme="light"] li,
      html[data-theme="light"] small,
      html[data-theme="light"] label,
      html[data-theme="light"] dt,
      html[data-theme="light"] dd,
      html[data-theme="light"] th,
      html[data-theme="light"] td,
      html[data-theme="light"] code,
      html[data-theme="light"] pre,
      html[data-theme="light"] blockquote {
        color: #0b0b0b !important;
      }

      @media (prefers-color-scheme: light) {
        html:not([data-theme]) { background: #ffffff !important; color: #0b0b0b !important; }
        html:not([data-theme]) body { background: #ffffff !important; }
  html:not([data-theme]) h1, html:not([data-theme]) h2, html:not([data-theme]) h3, html:not([data-theme]) h4 { color: var(--color-text-deep-blue) !important; }
  html:not([data-theme]) .projects article { background: #ffffff !important; color: inherit !important; box-shadow: 0 6px 18px rgba(15,23,42,0.06) !important; border: none !important; }
        html:not([data-theme]) .color-scheme { background: rgba(255,255,255,0.98) !important; color: canvastext !important; border: 1px solid rgba(0,0,0,0.06) !important; }
        html:not([data-theme]) section > article { background: transparent !important; border-left-color: rgba(0,0,0,0.06) !important; }
  html:not([data-theme]) p,
  html:not([data-theme]) a,
        html:not([data-theme]) li,
        html:not([data-theme]) small,
        html:not([data-theme]) label,
        html:not([data-theme]) dt,
        html:not([data-theme]) dd,
        html:not([data-theme]) th,
        html:not([data-theme]) td,
        html:not([data-theme]) code,
        html:not([data-theme]) pre,
        html:not([data-theme]) blockquote {
          color: #0b0b0b !important;
        }
        html:not([data-theme]) time { color: #0b0b0b !important; }
      }

    `;

    const st = document.createElement('style');
    st.id = 'global-light-overrides';
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  }

  let stored = null;
  try { stored = localStorage.getItem('color-scheme'); } catch (err) { }
  if (stored) { select.value = stored; applyTheme(stored); }

  select.addEventListener('input', (e) => {
    const v = e.target.value;
    try { localStorage.setItem('color-scheme', v); } catch (err) { }
    applyTheme(v);
  });
}

// Render a list of projects into a container element.
// projects: Array of { title, image, description, url? }
// containerElement: DOM element to receive the generated <article> elements
// headingLevel: 'h2' (default) or any of h1..h6
export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!containerElement || !(containerElement instanceof Element)) {
    console.error('renderProjects: invalid containerElement', containerElement);
    return;
  }

  // Clear existing contents
  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No projects to display.';
    containerElement.appendChild(msg);
    return;
  }

  // Validate heading level
  const validHeadings = ['h1','h2','h3','h4','h5','h6'];
  let headingTag = String(headingLevel || 'h2').toLowerCase();
  if (!validHeadings.includes(headingTag)) headingTag = 'h2';

  for (const p of projects) {
    const article = document.createElement('article');

    // Title
    const h = document.createElement(headingTag);
    h.textContent = p && p.title ? p.title : 'Untitled Project';

    // Image (optional)
    if (p && p.image) {
      const img = document.createElement('img');
      img.src = p.image;
      img.alt = p.title || '';
      article.appendChild(img);
    }

    // Description + Year container (prevents grid overlap)
    const summary = document.createElement('div');
    summary.className = 'project-summary';

    const desc = document.createElement('p');
    desc.className = 'project-desc';
    desc.textContent = p && p.description ? p.description : '';
    summary.appendChild(desc);

    if (p && p.year) {
      const yearEl = document.createElement('time');
      yearEl.className = 'project-year';
      const y = String(p.year);
      // If year parses to a 4-digit number, set datetime; else just text
      const yNum = y.replace(/[^0-9]/g, '');
      if (yNum && yNum.length === 4) yearEl.setAttribute('datetime', `${yNum}`);
      yearEl.textContent = y;
      summary.appendChild(yearEl);
    }

    // If a url is provided, wrap title (and optionally image) in a link
    if (p && p.url) {
      const a = document.createElement('a');
      a.href = p.url;
      a.appendChild(h);
      article.appendChild(a);
    } else {
      article.appendChild(h);
    }

    article.appendChild(summary);

    containerElement.appendChild(article);
  }
}

// Fetch GitHub user data via the public API. Uses fetchJSON for consistency.
export async function fetchGitHubData(username) {
  if (!username) return null;
  try {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}`;
    return await fetchJSON(url);
  } catch (err) {
    console.error('fetchGitHubData error', err);
    return null;
  }
}