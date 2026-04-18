import { expect, test } from "@playwright/test";

async function readWord(page: any) {
  const letters = page.getByTestId("letters");
  await expect(letters).toBeVisible();
  const t = (await letters.innerText()).trim();
  return t;
}

async function typeCurrentWord(page: any) {
  const word = await readWord(page);
  const input = page.getByTestId("typing-input");
  await expect(input).toBeVisible();
  await input.fill(word);
  // Input handler trims; ensure a stable event.
  await input.type(" ");
}

test("create room, join, start, and register a success", async ({ browser, baseURL }) => {
  const a = await browser.newPage();
  const b = await browser.newPage();

  await a.goto(`${baseURL}/?dev=1`);
  await b.goto(`${baseURL}/`);

  // Create room (A).
  await a.getByTestId("username-input").fill("A");
  await a.getByTestId("create-room-btn").click();
  const roomCode = (await a.getByTestId("lobby-code-display").innerText()).trim().replace(/\s/g, "");
  expect(roomCode.length).toBeGreaterThanOrEqual(4);

  // Join (B).
  await b.getByTestId("username-input").fill("B");
  await b.getByTestId("join-code-input").fill(roomCode);
  await b.getByTestId("join-room-btn").click();

  await a.getByTestId("ready-toggle-btn").click();
  await b.getByTestId("ready-toggle-btn").click();
  await expect(a.getByTestId("start-game-btn")).toBeEnabled();

  // Start game (A is creator).
  await a.getByTestId("start-game-btn").click();

  // Both should be in game (typing input visible).
  await expect(a.getByTestId("typing-input")).toBeVisible();
  await expect(b.getByTestId("typing-input")).toBeVisible();

  // A completes one word and UI advances.
  const beforeWord = await readWord(a);
  const beforeScore = await a.locator("#score").innerText();
  await typeCurrentWord(a);
  await expect.poll(async () => readWord(a)).not.toBe(beforeWord);
  await expect.poll(async () => a.locator("#score").innerText()).not.toBe(beforeScore);

  await a.close();
  await b.close();
});

