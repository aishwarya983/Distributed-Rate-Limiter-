const API_BASE = ''; // same origin

async function fire(path) {
  try {
    const response = await fetch(API_BASE + path);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('[dashboard] request failed:', error);
  }

  await refreshStats();
}

async function fireBurst(path, count) {
  try {
    const requests = Array.from(
      { length: count },
      () => fetch(API_BASE + path)
    );

    await Promise.allSettled(requests);
  } catch (error) {
    console.error('[dashboard] burst failed:', error);
  }

  await refreshStats();
}

async function resetStats() {
  try {
    const response = await fetch(API_BASE + '/api/stats/reset', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Reset failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('[dashboard] reset failed:', error);
  }

  await refreshStats();
}

async function refreshStats() {
  try {
    const response = await fetch(API_BASE + '/api/stats');

    if (!response.ok) {
      throw new Error(`Stats request failed with status ${response.status}`);
    }

    const data = await response.json();

    const { allowed, blocked } = data.totals;
    const total = allowed + blocked;
    const blockRate =
      total > 0 ? Math.round((blocked / total) * 100) : 0;

    document.getElementById('totalAllowed').textContent = allowed;
    document.getElementById('totalBlocked').textContent = blocked;
    document.getElementById('blockRate').textContent = `${blockRate}%`;

    const updatedAt = document.getElementById('updatedAt');

    if (updatedAt && data.timestamp) {
      updatedAt.textContent = `Updated ${new Date(
        data.timestamp
      ).toLocaleTimeString()}`;
    }

    const feed = document.getElementById('feed');

    feed.innerHTML = data.recent
      .map(
        (event) => `
          <div class="feed-item">
            <span>
              ${event.clientId} —
              ${new Date(event.ts).toLocaleTimeString()}
            </span>
            <span class="tag ${event.result}">
              ${event.result.toUpperCase()}
            </span>
          </div>
        `
      )
      .join('');
  } catch (error) {
    console.error('[dashboard] unable to refresh stats:', error);
  }
}

// Poll every 1.5 seconds so the dashboard feels live
// without requiring WebSockets.
setInterval(refreshStats, 1500);

refreshStats();