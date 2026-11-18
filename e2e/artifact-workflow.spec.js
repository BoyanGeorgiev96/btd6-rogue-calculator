import {test,expect} from '@playwright/test';
import {configure,openTool} from './helpers.js';
async function ready(page){await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-workspace','calculator');await page.locator('#tower-category').selectOption('Hero');await page.locator('#hero-level').fill('20');}
async function expandStats(page){await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);if(!await page.locator('#stat-details').evaluate(el=>el.open))await page.locator('#stat-details>summary').click();}
async function openDuration(page,id){await expandStats(page);const input=page.locator(`[data-duration-for="${id}"]`);const detail=input.locator('xpath=ancestor::details[1]');if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();return input;}
async function collapseStats(page){if(await page.locator('#stat-details').evaluate(el=>el.open))await page.locator('#stat-details>summary').click();}

for(const width of [1440,390])test(`artifact workflow ${width}: multiplier explanations and uptime previews leave state unchanged until applied`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await ready(page);
 await page.locator('[data-select="DivineQuickening"]').check();await page.locator('[data-select="AbsoluteAbility"]').check();
 const original=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
 const speed=page.locator('[data-explain-stat="speed"]');await speed.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#multiplier-explanation-title')).toBeFocused();
 await expect(page.locator('#multiplier-explanation-rows')).toContainText('Absolute Ability');await expect(page.locator('#multiplier-explanation-rows')).toContainText('Divine Quickening');
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(original);
 await page.locator('#close-multiplier-explanation').click();await expect(speed).toBeFocused();
 await page.locator('#clear').click();await expandStats(page);
 const duration=await openDuration(page,'RapidShotAbility');await duration.fill('35');await duration.press('Tab');
 await expect(page.locator('[data-ability-timer="RapidShotAbility"]')).toContainText('manual override');await collapseStats(page);
 await expect(page.locator('#uptime-finder>summary')).not.toBeVisible();
 await page.locator('#advanced-settings>summary').click();
 await expect(page.locator('#find-uptime')).not.toBeVisible();
 await page.locator('#uptime-finder>summary').focus();await page.keyboard.press('Enter');const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
 await page.locator('#find-uptime').click();await expect(page.locator('#uptime-status')).toContainText('candidates tested');
 await expect(page.locator('#uptime-results .uptime-choice').first()).toContainText('Potential continuous uptime');
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
 await page.locator('[data-preview-uptime]').first().click();await expect(page.locator('#comparison-title')).toHaveText('Ability uptime candidate');
 await expect(page.locator('#comparison-multiplier-rows')).toContainText('×');await expect(page.locator('#comparison-rows')).not.toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
 await page.screenshot({path:testInfo.outputPath('uptime-preview.png')});
 await page.locator('#apply-preview').click();expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).not.toBe(before);
 await page.locator('#undo-build').click();expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
 await expect(page.locator('#uptime-results .uptime-choice')).toHaveCount(0);
});

for(const width of [1440,390])test(`ability overrides ${width}: Churchill source duration, saved report, pinned timings, reload and reset`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await ready(page);await page.locator('#tower').selectOption('Captain Churchill');await expandStats(page);
 const armor=page.locator('[data-ability-timer="ArmorPiercingShells"]'),barrage=page.locator('[data-ability-timer="MOABBarrage"]');
 await expect(armor).toContainText('Duration 17.5s');await expect(barrage).toContainText('Duration 8.8s');
 const input=await openDuration(page,'ArmorPiercingShells');await input.fill('25');await input.press('Tab');await expect(armor).toContainText('Duration 25s · manual override');
 if(width<800)await page.locator('#stat-modifiers').evaluate(el=>el.scrollLeft=el.scrollWidth);
 await page.screenshot({path:testInfo.outputPath('churchill-durations.png')});
 await collapseStats(page);await page.locator('.saved-builds>summary').click();await page.locator('#build-name').fill('Churchill duration');await page.locator('#save-build').click();
 await page.locator('#pin-build').click();await page.locator('[data-select="AbsoluteAbility"]').check();
 await expect(page.locator('#comparison-multiplier-rows')).toContainText('×0.8');
 const timings=page.locator('#comparison-abilities .all-ability-timings');await timings.first().locator('summary').click();await timings.last().locator('summary').click();
 await expect(timings.first()).toContainText('MOAB Barrage');await expect(timings.last()).toContainText('manual');
 await page.locator('#build-report-panel>summary').click();await expect(page.locator('#build-report-text')).toHaveValue(/## Artifact multipliers[\s\S]*## All ability timings[\s\S]*Armor Piercing Shells[\s\S]*MOAB Barrage/);
 await expect(page.locator('#build-report-text')).toHaveValue(/25 \(manual override\)/);
 const shared=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-v1')));await page.goto('/#build='+encodeURIComponent(JSON.stringify(shared)));await expandStats(page);await expect(armor).toContainText('Duration 25s · manual override');await page.reload();await expandStats(page);await expect(armor).toContainText('Duration 25s · manual override');
 await openDuration(page,'ArmorPiercingShells');await page.locator('[data-reset-duration="ArmorPiercingShells"]').click();await expect(armor).toContainText('Duration 17.5s · pinned source');
 await page.locator('#undo-build').click();await expect(armor).toContainText('Duration 25s · manual override');
 await collapseStats(page);await configure(page);await page.locator('#ability').selectOption('');await expandStats(page);
 const manual=page.locator('[data-ability-timer="manual"]');await expect(manual).toContainText('Duration unknown');
 await openDuration(page,'__manual__');await page.locator('[data-duration-for="__manual__"]').fill('40');await page.locator('[data-duration-for="__manual__"]').press('Tab');
 await expect(manual).toContainText('Duration 40s · manual override');await expect(manual).toContainText('Potential continuous uptime');
});

test('comparison tools lead with factors while absolute stats and every ability remain expandable',async({page})=>{
 await ready(page);await page.locator('[data-select="AbsoluteAbility"]').check();await openTool(page,'open-tower-comparison');
 await expect(page.locator('#tower-comparison-rows tr').first().locator('td').nth(1)).toContainText('×');
 const row=page.locator('[data-comparison-index="0"]');await row.locator('[data-comparison-field="tower"]').selectOption('Quincy');await row.locator('[data-comparison-field="heroLevel"]').fill('20');await row.locator('[data-comparison-field="heroLevel"]').dispatchEvent('change');await expect(row.locator('.absolute-stats p')).not.toBeVisible();
 await row.locator('.all-ability-timings>summary').click();await expect(row.locator('.all-ability-timings')).toContainText('Rapid Shot');await expect(row.locator('.all-ability-timings')).toContainText('Storm of Arrows');
 await openTool(page,'open-offers');await page.locator('[data-offer-index="0"] [data-offer-field="id"]').selectOption('DivineQuickening');
 await expect(page.locator('[data-offer-index="0"] td').nth(1)).toContainText('×');
 await openTool(page,'open-target-matrix');await expect(page.locator('#matrix-values')).toContainText('×0.8');await expect(page.locator('#matrix-absolute-values')).not.toBeVisible();
});
