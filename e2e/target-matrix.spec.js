import {configure,openTool} from './helpers.js';
import {test,expect} from '@playwright/test';
async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
  await configure(page);
}
const cell = (page, metric, target) => page.locator(`[data-matrix-metric="${metric}"] [data-matrix-target="${target}"]`);

for (const width of [1440,390]) test(`target matrix ${width}: independent targets, unchanged build, and responsive table`,async ({page},testInfo) => {
  await page.setViewportSize({width,height:900});
  await ready(page);
  await page.locator('#base-damage').fill('10');
  await page.locator('#base-rate').fill('2');
  await page.locator('#target-fortified').check();
  await page.locator('#target-camo').check();
  await page.locator('[data-select="CeramicChunker"]').check();
  const before = await page.evaluate(() => localStorage.getItem('rogue-lab-v1'));
  const undoDisabled = await page.locator('#undo-build').isDisabled();
  await openTool(page,'open-target-matrix');
  await expect(page.locator('#workspace-title')).toBeFocused();await page.locator('#matrix-absolute>summary').click();
  await expect(page.locator('#matrix-head th')).toHaveCount(6);
  await expect(cell(page,'normal-hit','bloon')).toHaveText('10');
  await expect(cell(page,'normal-hit','ceramic')).toHaveText('13');
  await expect(cell(page,'normal-hit','fortified-ceramic')).toHaveText('13');
  await expect(cell(page,'build-dps','ceramic')).toHaveText('26');
  await expect(cell(page,'build-dps','boss')).toHaveText('20');
  await expect(cell(page,'gain','ceramic')).toHaveText('+6');
  await expect(cell(page,'eligibility','bloon')).toContainText('Unknown');
  await expect(page.locator('#matrix-context')).toContainText('Camo on for every column');
  expect(await page.evaluate(() => localStorage.getItem('rogue-lab-v1'))).toBe(before);
  expect(await page.locator('#undo-build').isDisabled()).toBe(undoDisabled);
  await expect(page.locator('#target-fortified')).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('target-matrix.png')});
  const table = page.locator('#matrix-absolute .comparison-table');
  await cell(page,'build-dps','bloon').scrollIntoViewIfNeeded();
  await table.focus();
  // End scrolls the document vertically on Linux; test horizontal keyboard
  // access with an arrow key before moving to the far-right comparison.
  if (width === 390) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  }
  await table.evaluate(el => el.scrollLeft=el.scrollWidth);
  await expect(cell(page,'build-dps','boss')).toBeInViewport();
  await expect(page.locator('#stats')).toBeVisible();
  await page.locator('#base-damage').fill('20');
  await expect(cell(page,'build-dps','ceramic')).toHaveText('46');
  await page.locator('#undo-build').click();
  await expect(cell(page,'build-dps','ceramic')).toHaveText('26');
});

test('target matrix displays critical exclusions and unknown values without fabricating eligibility',async ({page}) => {
  await ready(page);
  await page.locator('#tower-category').selectOption('Hero');
  await page.locator('#tower').selectOption('Adora');
  await page.locator('#critical-mode').selectOption('expected');
  for (const id of ['OneMonkeyArmy','CriticalSuccess','DivineIntervention']) await page.locator(`[data-select="${id}"]`).check();
  await openTool(page,'open-target-matrix');await page.locator('#matrix-absolute>summary').click();
  await expect(page.locator('[data-matrix-metric="expected-hit"]')).toBeVisible();
  await page.locator('#matrix-notes>details').last().locator(':scope > summary').click();
  await expect(page.locator('#matrix-notes>details').last()).toContainText('Multiple critical-hit artifacts');
  await expect(cell(page,'normal-hit','boss')).toHaveText(await cell(page,'expected-hit','boss').innerText());
  await page.locator('#base-ability-cooldown').fill('');
  await expect(cell(page,'ability','boss')).toHaveText('Unknown');
  await page.locator('#range-global').check();
  await expect(cell(page,'range','boss')).toHaveText('Unlimited');
  await page.locator('#critical-mode').selectOption('off');
  await expect(page.locator('[data-matrix-metric="expected-hit"]')).toHaveCount(0);
  await page.locator('#tower-category').selectOption('Primary');
  await page.locator('#tower').selectOption('Ice Monkey');
  await expect(cell(page,'eligibility','boss')).toContainText('Excluded for this component');
  await expect(cell(page,'build-dps','boss')).toHaveText('0');
});
