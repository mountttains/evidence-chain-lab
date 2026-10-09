const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  port = Number(process.env.PORT || 4173);
const files = new Set([
  "index.html",
  "styles.css",
  "engine.js",
  "workspace.js",
  "app.js",
  "data/case.js",
  "data/case.json",
]);
http
  .createServer((req, res) => {
    const name =
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(
        /^\//,
        "",
      ) || "index.html";
    if (!files.has(name)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const type = name.endsWith(".html")
      ? "text/html"
      : name.endsWith(".css")
        ? "text/css"
        : name.endsWith(".json")
          ? "application/json"
          : "text/javascript";
    res.writeHead(200, {
      "Content-Type": type + "; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(path.join(root, name)).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log("Trace Lab http://127.0.0.1:" + port),
  );
