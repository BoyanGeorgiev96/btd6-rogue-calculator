import {test,expect} from '@playwright/test';
async function ready(page){await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);}

for(const width of [1440,390])test(`hidden reference search recovery ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await ready(page);
 const modeled=page.locator('[data-view="modeled"]'), tooltip=page.locator('#modeled-view-tooltip');
 await expect(page.locator('#artifact-visibility-note')).toBeHidden();
 await modeled.hover();await expect(tooltip).toBeVisible();
 await expect(tooltip).toContainText('reference-only artifacts');
 await page.screenshot({path:testInfo.outputPath('modeled-effects-tooltip.png')});
 const box=await tooltip.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
 await page.keyboard.press('Escape');await expect(tooltip).toBeHidden();
 await modeled.focus();await expect(tooltip).toBeVisible();
 await page.locator('#search').focus();await expect(tooltip).toBeHidden();
 await modeled.click();await expect(tooltip).toBeVisible();
 await page.keyboard.press('Escape');await expect(tooltip).toBeHidden();
 const reference=await page.evaluate(async()=>{const {supported}=await import('./src/calculator.js');const data=await(await fetch('./data/artifacts.json')).json();return data.artifacts.find(a=>!supported.has(a.id));});
 await page.locator('[data-select="AbsoluteAbility"]').check();
 const saved=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
 await page.locator('#effect-filter').selectOption('speed');await page.locator('#only-applicable').check();
 await page.locator('#search').fill(reference.name);
 await expect(page.locator(`[data-id="${reference.id}"]`)).toHaveCount(0);
 await expect(page.locator('#artifact-visibility-message')).toContainText('matching reference-only artifact');
 await expect(page.locator('#artifact-visibility-note')).toBeVisible();
 await page.locator('#artifact-visibility-note').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('hidden-reference-search.png')});
 await page.locator('#show-reference-artifacts').click();
 await expect(page.locator('[data-view="all"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#search')).toHaveValue(reference.name);
 await expect(page.locator('#effect-filter')).toHaveValue('all');await expect(page.locator('#only-applicable')).not.toBeChecked();
 await expect(page.locator(`[data-id="${reference.id}"] .reference-tag`)).toHaveText('Reference only');
 await expect(page.locator('#artifact-visibility-note')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(saved);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.locator('[data-view="modeled"]').click();await page.locator('#search').fill('nothing matches this artifact');
 await expect(page.locator('#artifact-visibility-note')).toBeHidden();
 await expect(page.locator('.empty-state')).toBeVisible();
 await page.locator('#search').fill('');await expect(page.locator('#artifact-visibility-note')).toBeHidden();
 await ready(page);await expect(page.locator('#artifact-visibility-note')).toBeHidden();
});

for(const width of [1440,1366,390])test(`artifact filters ${width}: combine effects, impact and rarity without changing the build`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await ready(page);
 await page.locator('#effect-filter').selectOption('speed');
 await expect(page.locator('[data-id="AbsoluteAbility"]')).toHaveCount(1);await expect(page.locator('[data-id="SlowerIsHarder"]')).toHaveCount(0);
 await page.locator('#impact-filter').selectOption('penalty');await page.locator('#rarity-filter').selectOption('Common');
 await expect(page.locator('[data-id="GreaterPrimaryQuickening"]')).toHaveCount(0);await expect(page.locator('[data-id="CriticalSuccess"]')).toHaveCount(0);
 await page.locator('[data-select="AbsoluteAbility"]').check();await page.locator('[data-rarity="AbsoluteAbility"]').selectOption('Rare');
 const saved=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
 await page.locator('#artifact-sort').selectOption('cooldown');
 await page.locator('[data-view="selected"]').click();await page.locator('#impact-filter').selectOption('boost');
 await expect(page.locator('.empty-state h3')).toHaveText('No artifacts match these filters.');
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(saved);
 await page.locator('#impact-filter').selectOption('penalty');
 await page.locator('#effect-filter').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('artifact-filters.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.locator('#clear-artifact-filters').click();
 await expect(page.locator('#effect-filter')).toHaveValue('all');await expect(page.locator('#impact-filter')).toHaveValue('all');await expect(page.locator('#rarity-filter')).toHaveValue('all');
 await expect(page.locator('#artifact-sort')).toHaveValue('cooldown');await expect(page.locator('[data-view="selected"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-select="AbsoluteAbility"]')).toBeChecked();await expect(page.locator('[data-rarity="AbsoluteAbility"]')).toHaveValue('Rare');
 await expect(page.locator('#clear-artifact-filters')).toBeDisabled();expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(saved);
 await page.locator('#undo-build').click();await expect(page.locator('[data-rarity="AbsoluteAbility"]')).toHaveValue('Common');
});

test('filter impact follows current setup and composes with category, search, applicability and workspace navigation',async({page})=>{
 await ready(page);await page.locator('#effect-filter').selectOption('cooldown');await page.locator('#impact-filter').selectOption('boost');await page.locator('#category-filter').selectOption('Magic');
 await expect(page.locator('[data-id="GrandMagicQuickening"]')).toHaveCount(0);
 await page.locator('#tower-category').selectOption('Magic');const saved=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
 await page.locator('#only-applicable').check();await page.locator('#search').fill('Grand');await page.locator('#rarity-filter').selectOption('Common');
 await expect(page.locator('[data-id="GrandMagicQuickening"]')).toHaveCount(1);await expect(page.locator('[data-id="GrandMagicPrecision"]')).toHaveCount(0);
 await page.locator('.workspace-nav [data-workspace="reference"]').click();await page.locator('.workspace-nav [data-workspace="calculator"]').click();
 await expect(page.locator('#effect-filter')).toHaveValue('cooldown');await expect(page.locator('#impact-filter')).toHaveValue('boost');await expect(page.locator('#category-filter')).toHaveValue('Magic');await expect(page.locator('#search')).toHaveValue('Grand');await expect(page.locator('#only-applicable')).toBeChecked();
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(saved);
 await page.locator('#search').fill('nothing matches this query');await expect(page.locator('.empty-state')).toBeVisible();await page.locator('#reset-filters').click();
 await expect(page.locator('#effect-filter')).toHaveValue('all');await expect(page.locator('#category-filter')).toHaveValue('all');await expect(page.locator('#only-applicable')).not.toBeChecked();await expect(page.locator('#search')).toBeFocused();
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(saved);
});

test('available rarity does not switch card rarity, and specific effect filters exclude reference-only effects',async({page})=>{
 await ready(page);await page.locator('[data-view="all"]').click();
 const reference=await page.evaluate(async()=>{const {supported}=await import('./src/calculator.js');const data=await(await fetch('./data/artifacts.json')).json();return data.artifacts.find(a=>!supported.has(a.id)).id;});await expect(page.locator(`[data-id="${reference}"]`)).toHaveCount(1);
 await page.locator('#effect-filter').selectOption('conversion');await page.locator('#rarity-filter').selectOption('Common');await expect(page.locator('[data-id="OneMonkeyArmy"]')).toHaveCount(0);
 await page.locator('#rarity-filter').selectOption('Legendary');await expect(page.locator('[data-id="OneMonkeyArmy"]')).toHaveCount(1);
 await page.locator('#effect-filter').selectOption('cooldown');await expect(page.locator('[data-rarity="AbsoluteAbility"]')).toHaveValue('Common');
 await expect(page.locator(`[data-id="${reference}"]`)).toHaveCount(0);
});
