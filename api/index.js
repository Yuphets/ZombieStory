const { handleApiRequest } = require("../backend/api-handler");

module.exports = async function handler(req, res) {
  const base = `http://${req.headers.host || "127.0.0.1"}`;
  const incoming = new URL(req.url, base);
  const action = incoming.searchParams.get("action");
  const accountId = incoming.searchParams.get("accountId");

  const mappedPath = mapActionToPath(action, req.method, accountId);
  if (!mappedPath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Endpoint not found." }));
    return;
  }

  req.url = mappedPath;
  return handleApiRequest(req, res);
};

function mapActionToPath(action, method, accountId) {
  switch (action) {
    case "sign-in":
      return method === "POST" ? "/api/accounts/sign-in" : null;
    case "sign-up":
      return method === "POST" ? "/api/accounts/sign-up" : null;
    case "avatars":
      return method === "GET" || method === "PUT" ? "/api/avatars" : null;
    case "db-status":
      return method === "GET" ? "/api/db-status" : null;
    case "art-status":
      return method === "GET" ? "/api/art-status" : null;
    case "art-settings":
      return method === "GET" || method === "PUT" || method === "DELETE" ? "/api/settings/art" : null;
    case "progress":
      return accountId ? `/api/progress/${encodeURIComponent(accountId)}` : null;
    case "scene-art":
      return method === "POST" ? "/api/scene-art" : null;
    default:
      return null;
  }
}
