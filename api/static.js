const fs = require("fs");
const path = require("path");

module.exports = function handler(req, res) {
  const url = new URL(req.url, "https://" + (req.headers.host || "localhost"));
  const requested = url.searchParams.get("file") || "index.html";
  if (requested.includes("..")) return res.status(403).send("Forbidden");

  const publicRoot = path.join(process.cwd(), "public");
  const filePath = path.join(publicRoot, path.normalize(requested));

  if (!filePath.startsWith(publicRoot)) return res.status(403).send("Forbidden");

  fs.readFile(filePath, (error, data) => {
    if (error) return res.status(404).send("Not found");
    res.setHeader("Content-Type", contentType(filePath));
    res.status(200).send(data);
  });
};

function contentType(filePath) {
  const ext = path.extname(filePath);
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  })[ext] || "application/octet-stream";
}
