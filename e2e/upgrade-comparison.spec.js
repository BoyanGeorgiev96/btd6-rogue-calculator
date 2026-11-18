import {configure,openTool} from './helpers.js';
import {test,expect} from '@playwright/test';
const row = (page,path) => page.locator(`[data-upgrade-path="${path}"]`);
async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
}

for (const width of [1440,1366,390]) test(`upgrade comparison ${width}: source paths, reference, and independent controls`,async ({page},testInfo) => {
  await page.setViewportSize({width,height:900});
  await ready(page);
  await configure(page);
  await page.locator('#base-damage').fill('999');
  const before = await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  const undoDisabled = await page.locator('#undo-build').isDisabled();
  await openTool(page,'open-upgrade-comparison');
  await expect(page.locator('#workspace-title')).toBeFocused();
  await expect(page.locator('#upgrade-rows tr')).toHaveCount(64);
  await expect(row(page,'000').locator('[data-upgrade-metric="dps"]')).not.toContainText('999');
  await page.locator('#upgrade-reference').selectOption('300');
  await expect(row(page,'300').locator('[data-upgrade-metric="change"]')).toHaveText('0');
  await page.locator('#upgrade-tier').selectOption('5');
  await expect(page.locator('#upgrade-baseline')).toContainText('Reference 300');
  await expect(row(page,'300')).toHaveCount(0);
  await page.locator('#upgrade-sort').selectOption('dps');
  await expect(page.locator('#upgrade-rows tr')).toHaveCount(15);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('upgrades.png')});
  const table=page.locator('#upgrade-comparison .comparison-table');
  await page.locator('#upgrade-rows tr').first().scrollIntoViewIfNeeded();
  await table.focus();
  if(width===390) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(()=>table.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  }
  const bar=await page.locator('.workspace-shell').boundingBox();
  expect(bar.y).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
  expect(await page.locator('#undo-build').isDisabled()).toBe(undoDisabled);
  await page.locator('#upgrade-tower').selectOption('Sniper Monkey');
  await page.locator('#upgrade-tier').selectOption('all');
  await page.locator('#upgrade-reference').selectOption('320');
  await row(page,'320').locator('[data-upgrade-field="component"]').selectOption('attack-0/weapon-0/child-0');
  await expect(page.locator('#upgrade-baseline')).toContainText('Shrapnel');
  await expect(row(page,'320').locator('[data-upgrade-metric="dps"]')).toHaveText('0Artifacts 0');
  await expect(row(page,'000')).toContainText('Unlimited');
});

test('open upgrade results refresh with artifacts and undo while preserving planning selections',async ({page}) => {
  await ready(page);
  await openTool(page,'open-upgrade-comparison');
  await page.locator('#upgrade-tower').selectOption('Dart Monkey');
  await page.locator('#upgrade-reference').selectOption('040');
  await page.locator('#upgrade-tier').selectOption('4');
  await expect(row(page,'040')).toContainText('50s');
  await page.locator('[data-select="AbsoluteAbility"]').check();
  await expect(row(page,'040')).toContainText('40s');
  await page.locator('#undo-build').click();
  await expect(row(page,'040')).toContainText('50s');
  await expect(page.locator('#upgrade-reference')).toHaveValue('040');
  await page.locator('#upgrade-tower').selectOption('Banana Farm');
  await expect(row(page,'400')).toContainText('No direct attack');
  await expect(row(page,'400').locator('[data-upgrade-metric="interval"]')).toContainText('No attacks');
});
