import { expect, test } from "@playwright/test";

async function readWord(page: any) {
  const letters = page.getByTestId("letters");
  await expect(letters).toBeVisible();
  return (await letters.innerText()).trim();
}

async function typeCurrentWord(page: any) {
  const word = await readWord(page);
  const input = page.getByTestId("typing-input");
  // `fill()` triggers the input event; no extra keystrokes (faster + more deterministic).
  await input.fill(word);
}

async function createRoom(page: any, username: string) {
  await page.getByTestId("username-input").fill(username);
  await page.getByTestId("create-room-btn").click();
  const codeEl = page.getByTestId("lobby-code-display");
  const readCode = async () => (await codeEl.innerText()).trim().replace(/\s/g, "");
  await expect.poll(readCode, { timeout: 15_000 }).toMatch(/^[A-Z0-9]{6}$/);
  return await readCode();
}

async function joinRoom(page: any, username: string, roomCode: string) {
  await page.getByTestId("username-input").fill(username);
  await page.getByTestId("join-code-input").fill(roomCode);
  await page.getByTestId("join-room-btn").click();
}

test("decoyWord: victim sees jammed banner after attacker burst", async ({ browser, baseURL }) => {
  const a = await browser.newPage();
  const b = await browser.newPage();

  await a.goto(`${baseURL}/`);
  await b.goto(`${baseURL}/`);

  const roomCode = await createRoom(a, "A");
  await joinRoom(b, "B", roomCode);
  await expect(b.getByTestId("lobby-code-display")).toContainText(roomCode);

  await a.getByTestId("start-game-btn").click();
  await expect(a.getByTestId("typing-input")).toBeVisible();
  await expect(b.getByTestId("typing-input")).toBeVisible();

  // Attacker completes 3 words quickly to trigger decoyWord.
  await typeCurrentWord(a);
  await typeCurrentWord(a);
  await typeCurrentWord(a);

  // Decoy applies to the victim's next word after the one in progress; finish at least one word so the jammed target can appear.
  const banner = b.locator("#effect-banner");
  await expect(banner).toHaveCount(1);
  await expect.poll(async () => {
    if (await banner.isVisible()) return true;
    await typeCurrentWord(b);
    return await banner.isVisible();
  }, { timeout: 25_000 }).toBe(true);

  await a.close();
  await b.close();
});

test("flowObscure: only one closest-score opponent is obscured", async ({ browser, baseURL }) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  const c = await browser.newPage();

  // A uses dev tools to add a bot (drives Flow).
  await a.goto(`${baseURL}/?dev=1`);
  await b.goto(`${baseURL}/`);
  await c.goto(`${baseURL}/`);

  const roomCode = await createRoom(a, "A");
  await joinRoom(b, "B", roomCode);
  await joinRoom(c, "C", roomCode);

  // Add one dev bot from A while still in lobby (panel is inside lobby overlay).
  await a.locator("#dev-add-bot-btn").click();

  // Start match.
  await a.getByTestId("start-game-btn").click();
  await expect(a.getByTestId("typing-input")).toBeVisible();
  await expect(b.getByTestId("typing-input")).toBeVisible();
  await expect(c.getByTestId("typing-input")).toBeVisible();

  // Make B closer to A than C by giving C extra successes.
  await typeCurrentWord(c);
  await typeCurrentWord(c);
  await typeCurrentWord(c);

  // Wait until exactly one of B/C becomes obscured (body gets flow-obscured).
  const bObscured = b.locator("body.flow-obscured");
  const cObscured = c.locator("body.flow-obscured");

  await expect.poll(async () => {
    const bOn = await bObscured.count();
    const cOn = await cObscured.count();
    return bOn + cOn;
  }, { timeout: 40_000 }).toBe(1);

  // And it should not be both.
  const bOn = await bObscured.count();
  const cOn = await cObscured.count();
  expect(bOn + cOn).toBe(1);

  await a.close();
  await b.close();
  await c.close();
});

