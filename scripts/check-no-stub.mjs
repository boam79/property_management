import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/** Stub page body used in bad MCP deploys — must never appear in app source. */
const MARKER = "<p>간소화 배포본</p>";
const roots = ["src"];
const hits = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      const text = readFileSync(p, "utf8");
      if (text.includes(MARKER) || text.includes("간소화 배포본")) hits.push(p);
    }
  }
}

for (const r of roots) walk(join(process.cwd(), r));
if (hits.length) {
  console.error("FAIL: stub marker found in:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("PASS: no stub marker in src");
