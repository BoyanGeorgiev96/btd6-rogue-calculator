import {test,expect} from '@playwright/test';
import {configure,openTool} from './helpers.js';

for(const width of [1440,390])test(`power presets ${width}: artifact factors, transformation and saved/shared state`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
 await configure(page);await page.locator('#tower-category').selectOption('Powers');
 await expect(page.locator('#tower')).toHaveValue('Battle Cat');
 await expect(page.locator('#upgrade-paths')).toBeHidden();await expect(page.locator('#hero-level-label')).toBeHidden();
 await expect(page.locator('#base-damage')).toHaveValue('2');
 await page.locator('[data-select="PowerNexus"]').check();
 await expect(page.locator('[data-modifier="damage"]')).toContainText('×1.5');
 await expect(page.locator('[data-modifier="speed"]')).toContainText('×1.11');
 await page.locator('[data-select="DivinePrecision"]').check();
 await expect(page.locator('[data-modifier="damage"]')).toContainText('×1.74');
 const transformed=await page.locator('#component option').last().getAttribute('value');
 await page.locator('#component').selectOption(transformed);await expect(page.locator('#base-damage')).toHaveValue('20');
 await expect(page.locator('#component-warnings')).toContainText('expires after 4 rounds');
 await expect(page.locator('#live-stat-context')).toContainText('Transformed Battle Cat (4 rounds)');
 await page.locator('.saved-builds > summary').click();await page.locator('#build-name').fill('Power cat');await page.locator('#save-build').click();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-v1')));
 await page.goto('/#build='+encodeURIComponent(JSON.stringify(state)));await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
 await configure(page);await expect(page.locator('#tower-category')).toHaveValue('Powers');await expect(page.locator('#component')).toHaveValue(transformed);
 await expect(page.locator('#base-damage')).toHaveValue('20');await page.reload();await configure(page);await expect(page.locator('#component')).toHaveValue(transformed);
 await page.locator('#tower').selectOption('Cave Monkey');await expect(page.locator('#base-damage')).toHaveValue('1');
 await page.locator('#undo-build').click();await expect(page.locator('#tower')).toHaveValue('Battle Cat');await expect(page.locator('#component')).toHaveValue(transformed);
 await page.locator('#redo-build').click();await expect(page.locator('#tower')).toHaveValue('Cave Monkey');
 await page.locator('.live-stat-bar').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:testInfo.outputPath('powers.png')});
});

test('Beacon paths and cooldowns stay separate from storm damage and work in preset/upgrade comparisons',async({page})=>{
 await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);await configure(page);
 await page.locator('#tower-category').selectOption('Powers');await page.locator('#tower').selectOption('Super Monkey Beacon');
 await expect(page.locator('#upgrade-paths')).toBeVisible();await expect(page.locator('#base-ability-cooldown')).toHaveValue('120');
 await expect(page.locator('#base-rate')).toHaveValue('0');
 await page.locator('#path-middle').selectOption('3');await expect(page.locator('#base-ability-cooldown')).toHaveValue('45');
 await expect(page.locator('#base-damage')).toHaveValue('1');await expect(page.locator('#path-top option[value="1"]')).toBeDisabled();
 await expect(page.locator('#path-middle option[value="4"]')).toBeDisabled();
 await page.locator('[data-select="PowerNexus"]').check();await page.locator('[data-select="DivineQuickening"]').check();
 await expect(page.locator('#component-warnings')).toContainText('Storm ability damage');
 await expect(page.locator('[data-modifier="damage"]')).toContainText('×1.5');
 await openTool(page,'open-upgrade-comparison');await page.locator('#upgrade-tower').selectOption('Super Monkey Beacon');
 await expect(page.locator('#upgrade-rows tr')).toHaveCount(10);await expect(page.locator('[data-upgrade-path="030"]')).toContainText('Main shot');
 await openTool(page,'open-tower-comparison');
 const first=page.locator('[data-comparison-index="0"]');await first.locator('[data-comparison-field="tower"]').selectOption('Super Monkey Beacon');await first.locator('[data-comparison-field="path"]').fill('030');await first.locator('[data-comparison-field="path"]').dispatchEvent('change');
 await expect(first.locator('[data-comparison-field="path"]')).toHaveValue('030');
});
