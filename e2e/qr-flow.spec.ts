import { test, expect, type Page } from "@playwright/test";

const REGISTER_EMAIL = "register@example.com";
const REGISTER_PASSWORD = "Register123!";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin123!";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/(admin|assets)/, { timeout: 20_000 });
}

test.describe("QR 현장 플로우", () => {
  test("카메라 URL 플로우: 로그인 복귀 후 등록", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.getByRole("link", { name: "QR생성" }).click();
    await page.locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: "배치 생성" }).click();
    await page.waitForTimeout(2500);

    const res = await page.request.get("/api/admin/qr/latest-unused");
    expect(res.ok()).toBeTruthy();
    const { token } = (await res.json()) as { token: string };
    expect(token).toBeTruthy();

    await page.goto("/logout");
    await page.goto(`/q/${token}`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toMatch(/redirect=/);

    await page.getByLabel("이메일").fill(REGISTER_EMAIL);
    await page.getByLabel("비밀번호").fill(REGISTER_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL(new RegExp(`/q/${token}`), { timeout: 20_000 });

    const assetNo = `E2E-${Date.now()}`;
    await page.locator("#asset_no, input[name='asset_no']").first().fill(assetNo);
    await page.locator("#name, input[name='name']").first().fill("E2E 스모크 자산");
    await page.locator("#category, input[name='category']").first().fill("테스트");
    await page.getByRole("button", { name: /저장|등록/ }).click();

    await expect(page).toHaveURL(/\/assets\//, { timeout: 20_000 });
  });
});
