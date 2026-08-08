import { test, expect, type Page } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Set E2E credentials via env (never commit passwords).`
    );
  }
  return v;
}

const ADMIN_EMAIL = () => requireEnv("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = () => requireEnv("E2E_ADMIN_PASSWORD");
const REGISTER_EMAIL = () => requireEnv("E2E_REGISTER_EMAIL");
const REGISTER_PASSWORD = () => requireEnv("E2E_REGISTER_PASSWORD");

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/(admin|assets)/, { timeout: 20_000 });
}

test.describe("QR 현장 플로우", () => {
  test("카메라 URL 플로우: 로그인 복귀 후 등록", async ({ page }) => {
    await login(page, ADMIN_EMAIL(), ADMIN_PASSWORD());
    await page.getByRole("link", { name: "QR생성" }).click();
    await page.locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: "배치 생성" }).click();
    await page.waitForTimeout(2500);

    // 토큰 오라클 API 대신 UI 링크에서 추출 (프로덕션 안전)
    const qrLink = page
      .locator('[data-testid="qr-lifecycle-table"] a[href^="/q/"]')
      .first();
    await expect(qrLink).toBeVisible({ timeout: 15_000 });
    const href = await qrLink.getAttribute("href");
    expect(href).toMatch(/^\/q\/[0-9a-f-]{36}$/i);
    const token = href!.replace("/q/", "");

    await page.goto("/logout");
    await page.goto(`/q/${token}`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toMatch(/redirect=/);

    await page.getByLabel("이메일").fill(REGISTER_EMAIL());
    await page.getByLabel("비밀번호").fill(REGISTER_PASSWORD());
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL(new RegExp(`/q/${token}`), { timeout: 20_000 });

    const assetNo = `E2E-${Date.now()}`;
    await page.locator("#asset_no, input[name='asset_no']").first().fill(assetNo);
    await page.locator("#name, input[name='name']").first().fill("E2E Asset");
    const category = page.locator("#category, input[name='category']").first();
    if (await category.count()) await category.fill("E2E");
    await page.getByRole("button", { name: /등록|저장|생성/ }).first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toContainText(/자산|등록|상세/);
  });
});
