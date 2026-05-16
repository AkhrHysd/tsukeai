import { expect, test } from "@playwright/test";

type StorybookIndex = {
  entries: Record<
    string,
    {
      id: string;
      type: string;
      title: string;
      name: string;
    }
  >;
};

test("storybook stories match visual baselines", async ({ page, request }) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);

  const index = (await response.json()) as StorybookIndex;
  const stories = Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .sort((a, b) => a.id.localeCompare(b.id));

  expect(stories.length).toBeGreaterThan(0);

  for (const story of stories) {
    await test.step(`${story.title}: ${story.name}`, async () => {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.locator("#storybook-root").waitFor({ state: "visible" });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            caret-color: transparent !important;
            transition-duration: 0s !important;
          }
        `,
      });

      await expect(page.locator("#storybook-root")).toHaveScreenshot(`${story.id}.png`, {
        animations: "disabled",
      });
    });
  }
});
