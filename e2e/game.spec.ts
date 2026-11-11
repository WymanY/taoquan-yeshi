import { expect, test, type Page } from "@playwright/test";

const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("/?debug=1");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: "套圈夜市" })).toBeVisible();
  await expect(page.locator(".lede")).toContainText("圈影套住木桩");
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test("starts, aims with a mouse, and scores the aimed prize", async ({ page }) => {
  await start(page);
  await expect(page.getByTestId("timer")).toHaveText("00:45");
  await expect(page.getByTestId("score")).toHaveText("0");
  const tanghulu = await prize(page, "tanghulu");
  await dragThrow(page, tanghulu.x, tanghulu.z);
  await expect.poll(async () => snapshot(page)).toMatchObject({ throws: 1, score: tanghulu.points, ringed: 1 });
});

test("touch release throws, and pointercancel does not", async ({ page }) => {
  await start(page);
  await dispatchGesture(page, "pointercancel");
  await page.waitForTimeout(250);
  await expect.poll(async () => snapshot(page)).toMatchObject({ throws: 0, score: 0, aiming: false, flying: false });

  await dispatchGesture(page, "pointerup");
  await expect.poll(async () => (await snapshot(page)).throws).toBe(1);
});

test("pauses the clock, survives resize, and stays playable on a desktop window", async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__RING_TOSS__?.setPaused(true));
  const frozen = (await snapshot(page)).timeLeft;
  await page.waitForTimeout(350);
  expect((await snapshot(page)).timeLeft).toBe(frozen);
  await page.evaluate(() => window.__RING_TOSS__?.setPaused(false));

  await page.setViewportSize({ width: 320, height: 700 });
  await expect.poll(async () => (await frameBox(page)).width).toBeLessThan(340);
  const narrow = await frameBox(page);
  expect(narrow.playing).toBe(true);
  expect(Math.abs(narrow.width / narrow.height - 9 / 19.5)).toBeLessThan(0.04);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(async () => (await frameBox(page)).width).toBeLessThan(520);
  const desktop = await frameBox(page);
  expect(desktop.width).toBeGreaterThan(300);
  const panda = await prize(page, "panda");
  await dragThrow(page, panda.x, panda.z);
  await expect.poll(async () => (await snapshot(page)).score).toBe(panda.points);
});

test("ends the round, shows a result, and restarts", async ({ page }) => {
  await start(page);
  const ingot = await prize(page, "ingot");
  await dragThrow(page, ingot.x, ingot.z);
  await expect.poll(async () => (await snapshot(page)).score).toBe(ingot.points);
  await page.evaluate(() => window.__RING_TOSS__?.setTimeLeft(0.2));
  await expect(page.getByTestId("results")).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText(String(ingot.points));
  await expect(page.getByTestId("rank")).toHaveText("初窥门道");
  await page.getByTestId("restart").click();
  await expect.poll(async () => snapshot(page)).toMatchObject({ phase: "playing", score: 0 });
  expect((await snapshot(page)).timeLeft).toBeGreaterThan(40);
  await page.evaluate(() => window.__RING_TOSS__?.setTimeLeft(0.15));
  await expect(page.getByTestId("results")).toBeVisible();
  await page.getByTestId("help").click();
  await expect(page.getByRole("heading", { name: "套圈夜市" })).toBeVisible();
  await page.getByTestId("start").click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe("playing");
});

test("fits a short phone and still explains the throw", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.getByTestId("start")).toBeVisible();
  await start(page);
  await expect(page.getByText("上拖瞄准，圈影套住木桩后松手")).toBeVisible();
});

async function start(page: Page): Promise<void> {
  await page.getByTestId("start").click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe("playing");
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const api = window.__RING_TOSS__;
    if (!api) throw new Error("debug api missing");
    return api.snapshot();
  });
}

async function prize(page: Page, id: string) {
  return page.evaluate((prizeId) => {
    const found = window.__RING_TOSS__?.prizes().find((item) => item.id === prizeId);
    if (!found) throw new Error(prizeId);
    return found;
  }, id);
}

async function dragThrow(page: Page, x: number, z: number): Promise<void> {
  const box = await page.locator("#game").boundingBox();
  if (!box) throw new Error("canvas missing");
  const delta = await page.evaluate(({ x, z }) => {
    const api = window.__RING_TOSS__;
    if (!api) throw new Error("debug api missing");
    return api.dragDeltaFor(x, z);
  }, { x, z });
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height * 0.8;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.dx, startY + delta.dy, { steps: 12 });
  await page.mouse.up();
}

async function dispatchGesture(page: Page, finish: "pointerup" | "pointercancel"): Promise<void> {
  await page.evaluate((endType) => {
    const canvas = document.querySelector("#game");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas missing");
    const rect = canvas.getBoundingClientRect();
    const pointerId = 7;
    const fire = (type: string, x: number, y: number) => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        clientX: x,
        clientY: y,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      }));
    };
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.78;
    fire("pointerdown", x, y);
    fire("pointermove", x + 30, y - rect.height * 0.28);
    fire(endType, x + 30, y - rect.height * 0.28);
  }, finish);
}

async function frameBox(page: Page): Promise<{ width: number; height: number; playing: boolean }> {
  return page.evaluate(() => {
    const frame = document.querySelector("#frame");
    if (!(frame instanceof HTMLElement)) throw new Error("frame missing");
    const rect = frame.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      playing: window.__RING_TOSS__?.snapshot().phase === "playing",
    };
  });
}
