/**
 * Lightweight in-process stats tracker for the demo dashboard.
 *
 * NOTE: this is per-instance and resets on restart.
 * Redis remains the source of truth for rate limiting.
 */
const state = {
  allowed: 0,
  blocked: 0,
  recent: [],
  perClient: {},
};

const MAX_RECENT = 50;

function recordAllowed(clientId) {
  state.allowed += 1;
  bumpClient(clientId, 'allowed');
  pushRecent({
    clientId,
    result: 'allowed',
    ts: Date.now(),
  });
}

function recordBlocked(clientId) {
  state.blocked += 1;
  bumpClient(clientId, 'blocked');
  pushRecent({
    clientId,
    result: 'blocked',
    ts: Date.now(),
  });
}

function bumpClient(clientId, field) {
  if (!state.perClient[clientId]) {
    state.perClient[clientId] = {
      allowed: 0,
      blocked: 0,
    };
  }

  state.perClient[clientId][field] += 1;
}

function pushRecent(event) {
  state.recent.unshift(event);

  if (state.recent.length > MAX_RECENT) {
    state.recent.pop();
  }
}

function snapshot() {
  return {
    totals: {
      allowed: state.allowed,
      blocked: state.blocked,
    },

    // Return copies so consumers cannot modify internal state.
    perClient: Object.fromEntries(
      Object.entries(state.perClient).map(([clientId, counts]) => [
        clientId,
        { ...counts },
      ])
    ),

    recent: state.recent.map((event) => ({ ...event })),
  };
}

function reset() {
  state.allowed = 0;
  state.blocked = 0;
  state.recent = [];
  state.perClient = {};
}

module.exports = {
  recordAllowed,
  recordBlocked,
  snapshot,
  reset,
};