const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const root = __dirname;
const url = process.env.APP_SRC_URL || "https://raw.githubusercontent.com/boam79/property_management/9afe4f040373de8757aaf8b9de39baa9303f62b5/deploy-bundle/app-src.tgz";
function download(u) {
  return new Promise((resolve, reject) => {
    const follow = (addr, n) => {
      https.get(addr, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 5) {
          return follow(res.headers.location, n + 1);
        }
        if (res.statusCode !== 200) {
          reject(new Error("download failed " + res.statusCode));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }).on("error", reject);
    };
    follow(u, 0);
  });
}
(async () => {
  const buf = await download(url);
  fs.writeFileSync(path.join(root, "app-src.tgz"), buf);
  execSync("tar -xzf app-src.tgz", { stdio: "inherit", cwd: root });
})().catch((e) => { console.error(e); process.exit(1); });
