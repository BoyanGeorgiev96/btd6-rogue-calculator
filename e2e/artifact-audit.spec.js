import {test,expect} from '@playwright/test';
import {configure,previewArtifact} from './helpers.js';
async function ready(page){await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);await configure(page);}
async function conditions(page){const d=page.locator('.conditions');if(!await d.evaluate(e=>e.open))await d.locator(':scope > summary').click();}
for(const width of [1440,390])test(`artifact audit ${width}: conversions, penalties, previews, source count persistence and reference reasons`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await ready(page);await page.locator('#tower-category').selectOption('Military');
 await page.locator('[data-select="Conscription"]').check();await page.locator('[data-select="GreaterPrimaryPrecision"]').check();
 await expect(page.locator('[data-modifier="dps"]')).toContainText('×1.16');await expect(page.locator('[data-modifier="range"]')).toContainText('×0.85');
 await previewArtifact(page,'MonkeyAcademy');await expect(page.locator('[data-modifier="dps"]')).toContainText('×1.16');
 await page.locator('#apply-preview').click();await expect(page.locator('[data-modifier="dps"]')).toContainText('×0.58');await expect(page.locator('[data-modifier="range"]')).toContainText('×0.72');
 await page.locator('#undo-build').click();await expect(page.locator('[data-select="MonkeyAcademy"]')).not.toBeChecked();
 await page.locator('[data-select="TooManyCooks"]').check();await conditions(page);await page.locator('#other-military-count').fill('2');
 await expect(page.locator('#active-settings')).toContainText('Too Many Cooks: 2 other aura sources');await expect(page.locator('#live-stat-warning')).toBeHidden();
 await page.locator('.saved-builds > summary').click();await page.locator('#build-name').fill('Converted Military');await page.locator('#save-build').click();
 await page.locator('#other-military-count').fill('3');await page.locator('#undo-build').click();await expect(page.locator('#other-military-count')).toHaveValue('2');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-v1')));
 await page.goto('/#build='+encodeURIComponent(JSON.stringify(state)));await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);await configure(page);await conditions(page);
 await expect(page.locator('#other-military-count')).toHaveValue('2');await expect(page.locator('[data-select="Conscription"]')).toBeChecked();
 await page.locator('#other-military-count').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:testInfo.outputPath('artifact-audit.png')});
 await page.locator('.workspace-nav [data-workspace="reference"]').click();await page.locator('#reference-artifact').selectOption('AbundantChoices');await expect(page.locator('#reference-evidence')).toContainText('Reward choices; offer availability is not simulated');
 await page.locator('#reference-artifact').selectOption('Conscription');await expect(page.locator('#reference-evidence')).toContainText('Category conversion');await expect(page.locator('#reference-evidence')).toContainText('Upgrade price penalties');
});
test('Rubber Bullets caps damage without inventing crit stacking and partial artifact benefits stay labeled',async({page})=>{
 await ready(page);await page.locator('#tower-category').selectOption('Military');await page.locator('#path-top').selectOption('4');await page.locator('#target-type').selectOption('bloon');
 await page.locator('[data-select="RubberBullets"]').check();await page.locator('[data-select="SlowerIsHarder"]').check();await page.locator('[data-select="OneShot"]').check();await page.locator('#critical-mode').selectOption('expected');
 await expect(page.locator('#live-stat-warning')).toContainText('critical interactions are excluded');await expect(page.locator('[data-modifier="damage"]')).toContainText('×0.03');
 await page.locator('[data-explain-stat="damage"]').click();await expect(page.locator('#multiplier-explanation-note')).toContainText('replacements/caps');
 await page.locator('#close-multiplier-explanation').click();
 await page.locator('#tower-category').selectOption('Magic');await page.locator('#tower').selectOption('Druid');await page.locator('[data-select="GrowingSteady"]').check();await expect(page.locator('#live-stat-warning')).toContainText('round-dependent damage growth is excluded');
 await page.locator('#tower-category').selectOption('Primary');await page.locator('#tower').selectOption('Glue Gunner');await page.locator('[data-select="HighImpactGlue"]').check();await expect(page.locator('#live-stat-warning')).toContainText('density-dependent extra damage is excluded');
});
