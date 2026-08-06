/**
 * Unit checks for QR token extraction.
 * Run: npm run test:qr-token
 */
import assert from "node:assert/strict";

function extractQrToken(raw) {
  const text = raw.trim();
  if (!text) return null;
  try {
    const u = new URL(text);
    const m = u.pathname.match(/\/q\/([0-9a-fA-F-]{36})/);
    if (m) return m[1];
  } catch {
    /* not url */
  }
  const pathMatch = text.match(/\/q\/([0-9a-fA-F-]{36})/);
  if (pathMatch) return pathMatch[1];
  if (/^[0-9a-fA-F-]{36}$/.test(text)) return text;
  return null;
}

const uuid = "550e8400-e29b-41d4-a716-446655440000";
assert.equal(extractQrToken(uuid), uuid);
assert.equal(
  extractQrToken(`https://example.com/q/${uuid}?x=1`),
  uuid
);
assert.equal(extractQrToken(`/q/${uuid}`), uuid);
assert.equal(extractQrToken("not-a-token"), null);
assert.equal(extractQrToken(""), null);

console.log("PASS: qr token extract");
