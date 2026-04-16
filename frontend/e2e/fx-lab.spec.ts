import { expect, test } from "@playwright/test";

test.describe("FX lab (dev page)", () => {
  test("jammed defer vs fake word and flow obscure toggle", async ({ page }) => {
    await page.goto("/fx-lab.html");

    await expect(page.getByTestId("fx-lab-panel")).toBeVisible();

    await page.getByTestId("fx-lab-btn-decoy-defer").click();
    await expect(page.locator("#effect-banner")).toBeVisible();
    await expect(page.getByTestId("letters")).toContainText("SURVIVE");

    await page.getByTestId("fx-lab-btn-decoy-typing").click();
    await expect(page.getByTestId("letters")).toContainText("FAKEWRD");

    await page.getByTestId("fx-lab-btn-flow-heavy").click();
    await expect(page.locator("body.flow-obscured")).toHaveCount(1);

    await page.getByTestId("fx-lab-btn-flow-end").click();
    await expect(page.locator("body.flow-obscured")).toHaveCount(0);

    await page.getByTestId("fx-lab-btn-clear").click();
    await expect(page.locator("#effect-banner")).toBeHidden();
  });
});
