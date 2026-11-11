import { expect, test } from "@playwright/test";

test("production build boots on a phone-sized screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "套圈夜市" })).toBeVisible();
  await expect(page.locator(".lede")).toContainText("松手投出");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("timer")).toHaveText("00:45");
  await expect(page.getByTestId("score")).toHaveText("0");
  expect(errors).toEqual([]);
});
