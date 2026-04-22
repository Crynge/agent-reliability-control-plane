const state = {
  runs: [],
  selectedRunId: null,
  summary: null,
  policies: [],
  scenarios: []
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function statusClass(status) {
  return `status-${status || "running"}`;
}

function renderSummary() {
  const container = document.getElementById("summary-cards");
  if (!state.summary) {
    container.innerHTML = "";
    return;
  }

  const cards = [
    ["Completion Rate", `${state.summary.completionRate}%`],
    ["Recovery Rate", `${state.summary.recoveryRate}%`],
    ["Avg Token Burn", `${state.summary.avgTokenBurn}`],
    ["Human Override", `${state.summary.humanOverrideRate}%`]
  ];

  container.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <span class="summary-label">${label}</span>
      <strong class="summary-value">${value}</strong>
    </article>
  `).join("");
}

function renderRuns() {
  const container = document.getElementById("runs-list");
  container.innerHTML = state.runs.map((run) => `
    <article class="run-card ${run.id === state.selectedRunId ? "active" : ""}" data-run-id="${run.id}">
      <div class="run-topline">
        <span class="run-id">${run.id}</span>
        <span class="status-pill ${statusClass(run.status)}">${run.status}</span>
      </div>
      <p class="run-title">${run.workflowId}</p>
      <div class="run-meta">
        <span>${run.metadata.customer || "Unknown customer"}</span>
        <span>${run.checkpoints.length} checkpoints</span>
      </div>
    </article>
  `).join("");

  for (const card of container.querySelectorAll(".run-card")) {
    card.addEventListener("click", () => {
      state.selectedRunId = card.dataset.runId;
      renderRuns();
      renderRunDetail();
    });
  }
}

function renderRunDetail() {
  const status = document.getElementById("selected-run-status");
  const container = document.getElementById("run-detail");
  const run = state.runs.find((item) => item.id === state.selectedRunId);

  if (!run) {
    status.textContent = "Select a run";
    status.className = "status-pill";
    container.className = "timeline empty-state";
    container.textContent = "Choose a run to inspect its checkpoints, failures, approvals, and replays.";
    return;
  }

  status.textContent = run.status;
  status.className = `status-pill ${statusClass(run.status)}`;
  container.className = "timeline";

  const checkpointMarkup = run.checkpoints.map((checkpoint) => `
    <article class="timeline-card">
      <div class="timeline-meta">
        <strong>${checkpoint.stepName}</strong>
        <span class="timeline-badge">${checkpoint.id}</span>
      </div>
      <p class="metric-copy">Tool events: ${checkpoint.toolEvents.length} | Idempotent: ${checkpoint.idempotent ? "yes" : "no"}</p>
      <p class="metric-copy">Output: ${escapeHtml(JSON.stringify(checkpoint.output))}</p>
    </article>
  `).join("");

  const failureMarkup = run.failures.map((failure) => `
    <article class="timeline-card failure">
      <div class="timeline-meta">
        <strong>${failure.type}</strong>
        <span class="timeline-badge">${failure.severity}</span>
      </div>
      <p class="metric-copy">${failure.message}</p>
    </article>
  `).join("");

  const approvalMarkup = run.approvals.map((approval) => `
    <article class="timeline-card approval">
      <div class="timeline-meta">
        <strong>Approval for ${approval.stepId}</strong>
        <span class="timeline-badge">${approval.status}</span>
      </div>
      <p class="metric-copy">Action: ${escapeHtml(JSON.stringify(approval.action))}</p>
    </article>
  `).join("");

  const replayMarkup = run.replays.map((replay) => `
    <article class="timeline-card replay">
      <div class="timeline-meta">
        <strong>${replay.scenario}</strong>
        <span class="timeline-badge">${replay.fromCheckpointId || "latest"}</span>
      </div>
      <p class="metric-copy">Replay recorded at ${new Date(replay.createdAt).toLocaleString()}</p>
    </article>
  `).join("");

  container.innerHTML = checkpointMarkup + failureMarkup + approvalMarkup + replayMarkup;
}

function renderFailureTaxonomy() {
  const container = document.getElementById("failure-taxonomy");
  const entries = Object.entries(state.summary?.failureTypes || {});
  container.innerHTML = entries.map(([type, count]) => `
    <article class="metric-item">
      <div class="metric-name">${type}</div>
      <div class="metric-copy">${count} observed production failures across tracked runs.</div>
    </article>
  `).join("") || `<div class="muted">No failures recorded.</div>`;
}

function renderPolicies() {
  const container = document.getElementById("policy-list");
  container.innerHTML = state.policies.map((policy) => `
    <article class="metric-item">
      <div class="metric-name">${policy.name}</div>
      <div class="metric-tag">${policy.type} • ${policy.action}</div>
      <div class="metric-copy">${policy.description}</div>
    </article>
  `).join("");
}

function renderScenarios() {
  const container = document.getElementById("scenario-list");
  container.innerHTML = state.scenarios.map((scenario) => `
    <article class="metric-item">
      <div class="metric-name">${scenario.name}</div>
      <div class="metric-tag">${scenario.expectedOutcome}</div>
      <div class="metric-copy">${scenario.description}</div>
    </article>
  `).join("");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function startDemoRun() {
  const body = {
    workflowId: "ops-reconciliation",
    input: {
      batchId: `batch_${Date.now()}`
    },
    metadata: {
      customer: "Demo Workspace",
      environment: "sandbox",
      framework: "custom"
    }
  };

  await fetchJson("/api/runs/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  await load();
}

async function load() {
  const [{ runs }, { summary }, { policies }, { scenarios }] = await Promise.all([
    fetchJson("/api/runs"),
    fetchJson("/api/analytics/summary"),
    fetchJson("/api/policies"),
    fetchJson("/api/evals/scenarios")
  ]);

  state.runs = runs;
  state.summary = summary;
  state.policies = policies;
  state.scenarios = scenarios;
  state.selectedRunId = state.selectedRunId || runs[0]?.id || null;

  renderSummary();
  renderRuns();
  renderRunDetail();
  renderFailureTaxonomy();
  renderPolicies();
  renderScenarios();
}

document.getElementById("seed-run-button").addEventListener("click", () => {
  startDemoRun().catch((error) => {
    window.alert(error.message);
  });
});

load().catch((error) => {
  document.getElementById("run-detail").textContent = error.message;
});

