import { expect, test } from "@playwright/test";

test.describe("auth flow", () => {
  test("로그인 없이 캘린더 진입 시 로그인 페이지로 이동", async ({ page }) => {
    await page.goto("/#/calendar");

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  });

  test("로그인 버튼 링크가 OAuth 시작 경로를 가리킴", async ({ page }) => {
    await page.goto("/#/login");

    const kakaoLink = page.getByRole("link", { name: "카카오로 로그인" });
    const naverLink = page.getByRole("link", { name: "네이버로 로그인" });

    await expect(kakaoLink).toBeVisible();
    await expect(naverLink).toBeVisible();

    const kakaoHref = await kakaoLink.getAttribute("href");
    const naverHref = await naverLink.getAttribute("href");

    expect(kakaoHref).toBeTruthy();
    expect(naverHref).toBeTruthy();

    const kakaoUrl = new URL(kakaoHref!);
    const naverUrl = new URL(naverHref!);

    expect(kakaoUrl.pathname).toBe("/auth/kakao/start");
    expect(naverUrl.pathname).toBe("/auth/naver/start");
    expect(kakaoUrl.searchParams.get("redirectTo")).toBe("http://127.0.0.1:4173/#/auth/callback");
    expect(naverUrl.searchParams.get("redirectTo")).toBe("http://127.0.0.1:4173/#/auth/callback");
  });

  test("auth callback token 처리 후 캘린더 화면 진입", async ({ page }) => {
    await page.goto("/#/auth/callback?token=e2e-token");

    await expect(page).not.toHaveURL(/#\/auth\/callback/);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.location.hash);
      })
      .toMatch(/^#\/(calendar|login)$/);
  });
});
