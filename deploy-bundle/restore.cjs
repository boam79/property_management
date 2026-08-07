const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const root = __dirname;
const url =
  process.env.APP_SRC_URL ||
  "https://raw.githubusercontent.com/boam79/property_management/8496cc2ac17c9eee157929ac9fda7464a196804a/deploy-bundle/app-src.tgz";
function download(u) {
  return new Promise((resolve, reject) => {
    const follow = (addr, n) => {
      https
        .get(addr, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 5) {
            return follow(res.headers.location, n + 1);
          }
          if (res.statusCode !== 200) {
            reject(new Error("download failed " + res.statusCode + " " + addr));
            return;
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        })
        .on("error", reject);
    };
    follow(u, 0);
  });
}
(async () => {
  console.log("downloading", url);
  const buf = await download(url);
  const tgz = path.join(root, "app-src.tgz");
  fs.writeFileSync(tgz, buf);
  execSync("tar -xzf app-src.tgz", { stdio: "inherit", cwd: root });
  console.log("restored source tree", buf.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
