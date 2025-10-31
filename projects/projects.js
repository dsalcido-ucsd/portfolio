import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let query = '';
let selectedIndex = -1;

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
  const container = document.querySelector('.projects');
  if (!container) {
    console.warn('No .projects container found on page');
    return;
  }

  if (!projects || !Array.isArray(projects) || projects.length === 0) {
    container.innerHTML = '<p>No projects available yet. Check <code>lib/projects.json</code>.</p>';
    return;
  }

  function updateProjects(projectsToShow) {
    const count = projectsToShow.length;
    if (titleEl) {
      const label = count === 1 ? 'project' : 'projects';
      titleEl.textContent = `Projects (${count} ${label})`;
    }

    if (typeof renderProjects === 'function') {
      try {
        renderProjects(projectsToShow, container, 'h2');
      } catch (err) {
        console.error('renderProjects threw an error, falling back to basic renderer', err);
        container.innerHTML = projectsToShow.map(p => `
          <article>
            <h2>${escapeHtml(p.title)}</h2>
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">
            <p>${escapeHtml(p.description)}</p>
          </article>
        `).join('\n');
      }
    }

    drawPieChart(projectsToShow, projects, container, titleEl);
  }

  updateProjects(projects);

  const searchInput = document.querySelector('.searchBar');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      query = event.target.value;
      const filteredProjects = projects.filter((project) => {
        const values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
      });
      updateProjects(filteredProjects);
    });
  }
})();

function drawPieChart(projectsGiven, allProjects, container, titleEl) {
  const svg = d3.select('#projects-pie-plot');
  if (svg.empty()) return;

  svg.selectAll('path').remove();

  const legend = d3.select('.legend');
  legend.selectAll('li').remove();

  const rolledData = d3.rollups(
    projectsGiven,
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
    .attr('fill', (_, idx) => colors(idx))
    .attr('class', (_, idx) => idx === selectedIndex ? 'selected' : '')
    .on('click', (event, d) => {
      const idx = arcData.indexOf(d);
      selectedIndex = selectedIndex === idx ? -1 : idx;

      svg.selectAll('path')
        .attr('class', (_, i) => i === selectedIndex ? 'selected' : '');

      legend.selectAll('li')
        .attr('class', (_, i) => i === selectedIndex ? 'legend-item selected' : 'legend-item');

      if (selectedIndex === -1) {
        const count = projectsGiven.length;
        if (titleEl) {
          const label = count === 1 ? 'project' : 'projects';
          titleEl.textContent = `Projects (${count} ${label})`;
        }
        if (typeof renderProjects === 'function') {
          renderProjects(projectsGiven, container, 'h2');
        }
      } else {
        const selectedYear = data[selectedIndex].label;
        const filteredByYear = allProjects.filter((project) => project.year == selectedYear);
        const count = filteredByYear.length;
        if (titleEl) {
          const label = count === 1 ? 'project' : 'projects';
          titleEl.textContent = `Projects (${count} ${label})`;
        }
        if (typeof renderProjects === 'function') {
          renderProjects(filteredByYear, container, 'h2');
        }
      }
    });

  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', idx === selectedIndex ? 'legend-item selected' : 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}
