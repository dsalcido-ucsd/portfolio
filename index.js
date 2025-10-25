import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

async function initHomeProjects() {
  const projects = await fetchJSON('./lib/projects.json');
  if (!projects || !Array.isArray(projects)) return;

  const latestProjects = projects.slice(0, 3);
  const container = document.querySelector('.projects');
  if (!container) {
    console.warn('No .projects container found on home page');
    return;
  }

  renderProjects(latestProjects, container, 'h2');
}

initHomeProjects();

// Fetch and render GitHub profile stats
(async function initGitHubProfile(){
  try {
    const githubData = await fetchGitHubData('dsalcido-ucsd');
    const profileStats = document.querySelector('#profile-stats');
    if (!profileStats) return;
    if (!githubData) {
      profileStats.innerHTML = '<p>GitHub data not available.</p>';
      return;
    }

    profileStats.innerHTML = `
      <h3>GitHub Profile</h3>
      <dl>
        <dt>Public Repos:</dt><dd>${githubData.public_repos ?? 0}</dd>
        <dt>Public Gists:</dt><dd>${githubData.public_gists ?? 0}</dd>
        <dt>Followers:</dt><dd>${githubData.followers ?? 0}</dd>
        <dt>Following:</dt><dd>${githubData.following ?? 0}</dd>
      </dl>
    `;
  } catch (err) {
    console.error('initGitHubProfile error', err);
  }
})();
