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
    injectNav();
    markCurrentNavLink();
  });
} else {
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

  const REPO_NAME = 'portfolio';
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const BASE_PATH = isLocal ? '/' : `/${REPO_NAME}/`;

  const nav = document.createElement('nav');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');
  document.body.prepend(nav);

  for (const p of pages) {
    let url = p.url;
    const title = p.title;
    const href = !url.startsWith('http') && !url.startsWith('/') ? BASE_PATH + url : url;

    // Create anchor element and set properties
    const a = document.createElement('a');
    a.href = href;
    a.textContent = title;

    // External links: open in new tab safely
    if (p.external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }

    // Mark current link during creation
    if (a.host === location.host && normalizePath(a.pathname) === normalizePath(location.pathname)) {
      a.classList.add('current');
      a.setAttribute('aria-current', 'page');
    }

    nav.append(a);
  }
}