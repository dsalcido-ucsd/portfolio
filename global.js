function $$(selector, context = document) {
  return Array.from((context || document).querySelectorAll(selector));
}

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact Me' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/dsalcido-ucsd', title: 'GitHub Profile', external: true },
];


const REPO_NAME = 'portfolio';
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const isGithubPages = location.hostname.endsWith('.github.io');
const BASE_PATH = isLocal ? '/' : `/${REPO_NAME}/`;

function buildNav() {
  console.debug('buildNav running');
  const nav = document.createElement('nav');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');
  document.body.prepend(nav);

function normalizePath(p) {
  if (!p) return p;
  if (p.endsWith('/index.html')) p = p.slice(0, -11);
  if (p.endsWith('/') && p !== '/') p = p.slice(0, -1);
  return p;
}

  for (const p of pages) {
  const url = p.url;
  const title = p.title;
  const href = !url.startsWith('http') && !url.startsWith('/') ? BASE_PATH + url : url;

  nav.insertAdjacentHTML('beforeend', `<a href="${href}">${title}</a>`);

  if (p.external) {
    const a = nav.lastElementChild;
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    continue;
  }

  const a = nav.lastElementChild;
  const aPath = normalizePath(a.pathname);
  const curPath = normalizePath(location.pathname);

  if (a.host === location.host && aPath === curPath) a.classList.add('current');
}

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildNav);
} else {
  buildNav();
}