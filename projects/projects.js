import { fetchJSON, renderProjects } from '../global.js';

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

(async function initProjects(){
  const projects = await fetchJSON('../lib/projects.json');
  // Update header with project count (with pluralization)
  const titleEl = document.querySelector('.projects-title');
  const count = Array.isArray(projects) ? projects.length : 0;
  if (titleEl) {
    const label = count === 1 ? 'project' : 'projects';
    titleEl.textContent = `Projects (${count} ${label})`;
  }
  const container = document.querySelector('.projects');
  if (!container) {
    console.warn('No .projects container found on page');
    return;
  }

  if (!projects || !Array.isArray(projects) || projects.length === 0) {
    container.innerHTML = '<p>No projects available yet. Check <code>lib/projects.json</code>.</p>';
    return;
  }

  if (typeof renderProjects === 'function') {
    try {
      renderProjects(projects, container, 'h2');
      return;
    } catch (err) {
      console.error('renderProjects threw an error, falling back to basic renderer', err);
    }
  }

  // Fallback renderer: safe, minimal markup
  container.innerHTML = projects.map(p => `
    <article>
      <h2>${escapeHtml(p.title)}</h2>
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">
      <p>${escapeHtml(p.description)}</p>
    </article>
  `).join('\n');
})();
