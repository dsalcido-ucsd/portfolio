import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
    } catch (err) {
      console.error('renderProjects threw an error, falling back to basic renderer', err);
      container.innerHTML = projects.map(p => `
        <article>
          <h2>${escapeHtml(p.title)}</h2>
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">
          <p>${escapeHtml(p.description)}</p>
        </article>
      `).join('\n');
    }
  }

  drawPieChart(projects);
})();

function drawPieChart(projects) {
  const svg = d3.select('#projects-pie-plot');
  if (svg.empty()) return;

  const rolledData = d3.rollups(
    projects,
    (v) => v.length,
    (d) => d.year,
  );

  const data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

  const arcData = sliceGenerator(data);
  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  svg.selectAll('path')
    .data(arcData)
    .enter()
    .append('path')
    .attr('d', arcGenerator)
    .attr('fill', (_, idx) => colors(idx));

  const legend = d3.select('.legend');
  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}
