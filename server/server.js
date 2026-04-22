const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { JSONStore } = require("./lib/store");
const { ControlPlaneService } = require("./lib/controlPlane");

const rootDirectory = path.resolve(__dirname, "..");
const dashboardDirectory = path.join(rootDirectory, "apps", "dashboard");
const store = new JSONStore(path.join(rootDirectory, "storage", "control-plane-db.json"));
const service = new ControlPlaneService(store);
const port = Number(process.env.PORT || 4020);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };

  try {
    const content = fs.readFileSync(filePath);
    response.writeHead(200, { "Content-Type": typeMap[extension] || "text/plain; charset=utf-8" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function parseJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

function routes(request, response) {
  const url = new URL(request.url, `http://localhost:${port}`);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && pathname === "/api/runs") {
    sendJson(response, 200, { runs: service.listRuns() });
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/runs/")) {
    const runId = pathname.split("/")[3];
    const run = service.getRun(runId);
    if (!run) {
      notFound(response);
      return;
    }
    sendJson(response, 200, { run });
    return;
  }

  if (request.method === "GET" && pathname === "/api/analytics/summary") {
    sendJson(response, 200, { summary: service.analyticsSummary() });
    return;
  }

  if (request.method === "GET" && pathname === "/api/evals/scenarios") {
    sendJson(response, 200, { scenarios: service.getEvalScenarios() });
    return;
  }

  if (request.method === "GET" && pathname === "/api/policies") {
    sendJson(response, 200, { policies: service.getPolicies() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/runs/start") {
    parseJson(request)
      .then((body) => sendJson(response, 201, { run: service.startRun(body) }))
      .catch((error) => sendJson(response, 400, { error: error.message }));
    return;
  }

  if (request.method === "POST" && /^\/api\/runs\/[^/]+\/checkpoints$/.test(pathname)) {
    const runId = pathname.split("/")[3];
    parseJson(request)
      .then((body) => sendJson(response, 201, { checkpoint: service.checkpoint(runId, body) }))
      .catch((error) => sendJson(response, error.statusCode || 400, { error: error.message }));
    return;
  }

  if (request.method === "POST" && /^\/api\/runs\/[^/]+\/resume$/.test(pathname)) {
    const runId = pathname.split("/")[3];
    parseJson(request)
      .then((body) => sendJson(response, 200, { result: service.resumeRun(runId, body) }))
      .catch((error) => sendJson(response, error.statusCode || 400, { error: error.message }));
    return;
  }

  if (request.method === "POST" && /^\/api\/runs\/[^/]+\/failures$/.test(pathname)) {
    const runId = pathname.split("/")[3];
    parseJson(request)
      .then((body) => sendJson(response, 201, { failure: service.recordFailure(runId, body) }))
      .catch((error) => sendJson(response, error.statusCode || 400, { error: error.message }));
    return;
  }

  if (request.method === "POST" && /^\/api\/runs\/[^/]+\/approvals$/.test(pathname)) {
    const runId = pathname.split("/")[3];
    parseJson(request)
      .then((body) => sendJson(response, 201, { approval: service.requestApproval(runId, body) }))
      .catch((error) => sendJson(response, error.statusCode || 400, { error: error.message }));
    return;
  }

  if (request.method === "POST" && /^\/api\/runs\/[^/]+\/replay$/.test(pathname)) {
    const runId = pathname.split("/")[3];
    parseJson(request)
      .then((body) => sendJson(response, 201, { replay: service.replayRun(runId, body) }))
      .catch((error) => sendJson(response, error.statusCode || 400, { error: error.message }));
    return;
  }

  const safePath = pathname === "/" ? "/index.html" : pathname;
  const requestedFile = path.join(dashboardDirectory, safePath);
  if (requestedFile.startsWith(dashboardDirectory)) {
    sendFile(response, requestedFile);
    return;
  }

  notFound(response);
}

const server = http.createServer(routes);

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Agent Control Plane running at http://localhost:${port}`);
  });
}

module.exports = {
  server,
  service
};

