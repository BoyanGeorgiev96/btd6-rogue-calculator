import {test,expect} from '@playwright/test';
import {configure} from './helpers.js';
for(const width of [1440,390])test(`Druid excluded vine scope ${width}: old preset reloads, flat bonuses and crits stay excluded, ability timing remains`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  await page.addInitScript(()=>localStorage.setItem('rogue-lab-v1',JSON.stringify({
    context:{category:'Magic',tower:'Druid',upgradePath:'040',componentId:'attack-1/weapon-0',statMode:'preset',baseDamage:9999999,baseBossDamage:0,baseRate:1/2.6,basePierce:9999999,criticalMode:'expected',targetType:'ceramic',abilityMode:'preset',abilityId:'VineCrushAbility'},
    selected:{EssenceOfDreadbloon:'Legendary',CriticalSuccess:'Rare',CeramicChunker:'Rare',PureDamage:'Rare',AbsoluteAbility:'Common'}
  })));
  await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
  await configure(page);
  await expect(page.locator('#component')).toHaveValue('attack-1/weapon-0');
  await expect(page.locator('#base-damage')).toHaveValue('0');await expect(page.locator('#base-rate')).toHaveValue('0');await expect(page.locator('#base-pierce')).toHaveValue('');
  await expect(page.locator('#base-ability-cooldown')).toHaveValue('30');
  await expect(page.locator('#live-stat-warning')).toContainText('excluded from ordinary hit damage');
  await expect(page.locator('#preset-info')).toContainText('Vine destruction and spawned ground vines');
  await expect(page.locator('#preset-info')).not.toContainText('9,999,999');
  await page.locator('#stat-details > summary').click();
  await expect(page.locator('[data-stat="ability"]')).toContainText('48s');
  await expect(page.locator('#stat-details')).not.toContainText('9,999,999');
  await page.locator('#stat-details > summary').click();
  await page.locator('#component').selectOption('attack-1/weapon-0/child-0');
  await expect(page.locator('#base-damage')).toHaveValue('0');await expect(page.locator('#live-stat-warning')).toContainText('excluded');
  await page.locator('.saved-builds > summary').click();await page.locator('#build-name').fill('Excluded ground vines');await page.locator('#save-build').click();
  await page.locator('#build-report-panel > summary').click();
  await expect(page.locator('#build-report-text')).toHaveValue(/Ground vines/);await expect(page.locator('#build-report-text')).toHaveValue(/Hit eligibility: Excluded/);await expect(page.locator('#build-report-text')).not.toHaveValue(/9,999,999|9999999/);
  await page.locator('#component').selectOption('attack-0/weapon-0');
  await expect(page.locator('#base-damage')).toHaveValue('1');
  await expect(page.locator('#live-stat-warning')).not.toContainText('Selected component is excluded');
  await page.locator('#load-build').click();await expect(page.locator('#component')).toHaveValue('attack-1/weapon-0/child-0');
  await expect(page.locator('#base-damage')).toHaveValue('0');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-builds-v1')).builds[0]);expect(saved.state.context.baseDamageExcluded).toBe(true);
  await page.locator('#component').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('druid-vine-exclusion.png')});
});
