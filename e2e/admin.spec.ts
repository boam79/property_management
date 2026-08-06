import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin123!";
const OUT_DIR = path.join(process.cwd(), "e2e-results");

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(ADMIN_EMAIL);
  await page.getByLabel("비밀번호").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/(admin|assets)/, { timeout: 20_000 });
}

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe("관리자 E2E", () => {
  test("로그인 후 관리자 메뉴·페이지 접근", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await loginAsAdmin(page);
    await page.screenshot({
      path: path.join(OUT_DIR, "01-after-login.png"),
      fullPage: true,
    });

    const url = page.url();
    const navTexts = await page.locator("header nav a").allTextContents();
    const bodyText = await page.locator("body").innerText();

    fs.writeFileSync(
      path.join(OUT_DIR, "01-after-login.json"),
      JSON.stringify({ url, navTexts, bodySnippet: bodyText.slice(0, 800), consoleErrors }, null, 2),
      "utf8"
    );

    // 관리자 메뉴가 보여야 함
    await expect(page.getByRole("link", { name: "대시보드" })).toBeVisible();
    await expect(page.getByRole("link", { name: "QR생성" })).toBeVisible();
    await expect(page.getByRole("link", { name: "임포트" })).toBeVisible();
    await expect(page.getByRole("link", { name: "QR연결" })).toBeVisible();
    await expect(page.getByRole("link", { name: "감사로그" })).toBeVisible();
  });

  test("대시보드 로드", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "대시보드" }).click();
    await page.waitForURL(/\/admin$/);
    await page.screenshot({
      path: path.join(OUT_DIR, "02-dashboard.png"),
      fullPage: true,
    });

    await expect(page.getByRole("link", { name: /전체 자산/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /일반 비품/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /IT 자산/ })).toBeVisible();

    const text = await page.locator("body").innerText();
    fs.writeFileSync(
      path.join(OUT_DIR, "02-dashboard.txt"),
      text,
      "utf8"
    );
  });

  test("QR 생성 페이지·배치 생성", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "QR생성" }).click();
    await page.waitForURL(/\/admin\/qr/);
    await page.screenshot({
      path: path.join(OUT_DIR, "03-qr-page.png"),
      fullPage: true,
    });

    await expect(page.getByText("빈 QR 생성")).toBeVisible();

    const qty = page.getByLabel(/수량|개수|생성/).first();
    if (await qty.count()) {
      await qty.fill("2");
    } else {
      // fallback: number input
      const numberInput = page.locator('input[type="number"]').first();
      await numberInput.fill("2");
    }

    const createBtn = page.getByRole("button", { name: /생성|만들기|배치/ });
    await createBtn.first().click();

    // wait for success or table update
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT_DIR, "03-qr-after-create.png"),
      fullPage: true,
    });

    const body = await page.locator("body").innerText();
    fs.writeFileSync(path.join(OUT_DIR, "03-qr.txt"), body, "utf8");

    // Should not show forbidden / redirect to assets
    expect(page.url()).toContain("/admin/qr");
    expect(body).not.toMatch(/FORBIDDEN|권한 오류/);
  });

  test("임포트·QR연결 페이지 접근", async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole("link", { name: "임포트" }).click();
    await page.waitForURL(/\/admin\/import/);
    await page.screenshot({
      path: path.join(OUT_DIR, "04-import.png"),
      fullPage: true,
    });
    await expect(page.locator("body")).toContainText(/임포트|템플릿|업로드/);

    await page.getByRole("link", { name: "QR연결" }).click();
    await page.waitForURL(/\/admin\/link-qr/);
    await page.screenshot({
      path: path.join(OUT_DIR, "05-link-qr.png"),
      fullPage: true,
    });
    expect(page.url()).toContain("/admin/link-qr");
  });

  test("자산목록 접근·페이지네이션 UI", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "자산목록" }).click();
    await page.waitForURL(/\/assets/);
    await page.screenshot({
      path: path.join(OUT_DIR, "06-assets.png"),
      fullPage: true,
    });
    await expect(page.getByRole("link", { name: "대시보드" })).toBeVisible();
    await expect(page.getByTestId("assets-total")).toBeVisible();
    await expect(page.getByTestId("assets-pagination")).toBeVisible();
    await expect(page.getByTestId("assets-page-label")).toBeVisible();

    const totalText = await page.getByTestId("assets-total").innerText();
    const next = page.getByTestId("assets-next");
    if (await next.count()) {
      await next.click();
      await page.waitForURL(/page=2/);
      await expect(page.getByTestId("assets-page-label")).toContainText("2 /");
      await expect(page.getByTestId("assets-prev")).toBeVisible();
    } else {
      await expect(page.getByTestId("assets-next-disabled")).toBeVisible();
      await expect(page.getByTestId("assets-prev-disabled")).toBeVisible();
    }

    fs.writeFileSync(
      path.join(OUT_DIR, "06-assets-pagination.json"),
      JSON.stringify({ totalText, url: page.url() }, null, 2),
      "utf8"
    );
  });
});
