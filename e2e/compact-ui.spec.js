import {test,expect} from '@playwright/test';
import {configure,previewArtifact} from './helpers.js';
async function ready(page){await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-workspace','calculator');}

test('artifact multipliers lead and applied tower stats are display-only',async({page})=>{
  await ready(page);
  await expect(page.locator('[data-modifier=damage] .stat-value')).toHaveText('×1');
  await expect(page.locator('[data-modifier=ability] .stat-value')).toHaveText('×1');
  await expect(page.locator('#stat-modifiers')).not.toBeVisible();
  const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  await page.locator('#stat-details>summary').click();
  await expect(page.locator('[data-stat=damage]')).toContainText('+0%');
  await expect(page.locator('[data-stat=ability]')).toContainText('No imported fixed-cooldown ability at this tier / level.');
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
  await expect(page.locator('#undo-build')).toBeDisabled();
  await configure(page);await page.locator('#base-damage').fill('19');
  await page.locator('#base-ability-cooldown').fill('60');
  await page.locator('[data-select="AbsoluteAbility"]').check();
  await expect(page.locator('[data-stat=damage] .stat-value')).toHaveText('19');
  await expect(page.locator('[data-stat=ability] .stat-value')).toHaveText('48s');
  await expect(page.locator('[data-modifier=ability] .stat-value')).toHaveText('×0.8');
  await page.locator('#advanced-settings>summary').click();
  await expect(page.locator('#base-damage')).not.toBeVisible();
  await expect(page.locator('#active-settings')).toContainText('Manual stats');
  await expect(page.locator('#live-stat-settings')).toContainText('Manual ability timer');
  // The details toggle event saves asynchronously; reload after that save.
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-display-v1')).advanced)).toBe(false);
  await page.reload();await expect(page.locator('#stat-modifiers')).toBeVisible();
  await expect(page.locator('#base-damage')).not.toBeVisible();
  await expect(page.locator('[data-stat=ability] .stat-value')).toHaveText('48s');
});

test('unknown and unlimited values stay explicit in compact results',async({page})=>{
  await ready(page);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-v1')));
  Object.assign(state.context,{category:'Hero',tower:'Hero',statMode:'manual',upgradePath:null,basePierce:null,baseRange:null,rangeMode:'finite',abilityMode:'manual',abilityId:null,baseAbilityCooldown:null});
  await page.goto('/?workspace=calculator#build='+encodeURIComponent(JSON.stringify(state)));
  await page.locator('#stat-details>summary').click();
  await expect(page.locator('[data-stat=pierce] .stat-value')).toHaveText('Unknown');
  await expect(page.locator('[data-stat=range] .stat-value')).toHaveText('Unknown');
  await expect(page.locator('[data-stat=ability] .stat-value')).toHaveText('Unknown');
  await configure(page);await page.locator('#range-global').check();
  await expect(page.locator('[data-stat=range] .stat-value')).toHaveText('Unlimited');
  await expect(page.locator('[data-stat=range]')).toContainText('range modifiers do not apply');
});

test('artifact cards expand for contributions and preview, retaining expansion through edits',async({page})=>{
  await ready(page);
  const card=page.locator('[data-id="SlowerIsHarder"]');
  await expect(card.locator('[data-preview]')).not.toBeVisible();
  const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  await card.locator('.artifact-details>summary').focus();await page.keyboard.press('Enter');
  await expect(card.locator('.artifact-tools')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
  await card.locator('[data-rarity]').selectOption('Rare');
  await expect(card.locator('.artifact-details')).toHaveAttribute('open','');
  await expect(card.locator('[data-rarity]')).toBeFocused();
  await previewArtifact(page,'SlowerIsHarder');await page.locator('#apply-preview').click();
  await expect(card.locator('[data-select]')).toBeChecked();
  await expect(card.locator('.artifact-details')).toHaveAttribute('open','');
  await expect(card.locator('.artifact-tools')).toContainText('Contribution');
  await card.locator('.artifact-details>summary').click();
  await page.locator('#undo-build').click();
  await expect(card.locator('[data-select]')).not.toBeChecked();
  await expect(card.locator('.artifact-details')).not.toHaveAttribute('open','');
});

for(const width of [390,768])test(`compact setup ${width}: explicitly finish setup, retain inputs and reopen with keyboard`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await ready(page);
  await page.locator('#tower-category').selectOption('Military');
  await page.locator('#path-top').selectOption('2');
  await page.locator('#target-type').selectOption('ceramic');
  const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  const expandedHeight=(await page.locator('.summary').boundingBox()).height;
  await page.locator('#browse-artifacts').click();
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#tower')).not.toBeVisible();
  await expect(page.locator('#setup-compact-context')).toContainText('Sniper Monkey · 200 · Ceramic');
  expect((await page.locator('.summary').boundingBox()).height).toBeLessThan(expandedHeight);
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
  const cell=page.locator('[data-modifier=damage]');
  const label=await cell.locator('.stat-label').boundingBox(), value=await cell.locator('.stat-value').boundingBox();
  expect(value.y).toBeGreaterThanOrEqual(label.y+label.height);
  await page.screenshot({path:testInfo.outputPath('compact-phone.png')});
  await page.locator('.summary').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('compact-setup.png')});
  await page.locator('#expand-setup').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#tower')).toBeFocused();
  await expect(page.locator('#path-top')).toHaveValue('2');
  await expect(page.locator('#target-type')).toHaveValue('ceramic');
  await configure(page);await page.locator('#base-damage').fill('19');
  await page.locator('#browse-artifacts').click();
  await expect(page.locator('#active-settings')).toContainText('Manual stats');
  await expect(page.locator('#active-settings')).toBeVisible();
  await page.locator('#undo-build').click();await expect(page.locator('#active-settings')).not.toContainText('Manual stats');
  await page.setViewportSize({width:1440,height:900});
  await expect(page.locator('#tower')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

for(const width of [1440,390])test(`Quincy ${width}: hero levels change applied stats, never the unmodified artifact multipliers`,async({page})=>{
  await page.setViewportSize({width,height:900});await ready(page);
  await page.locator('#tower-category').selectOption('Hero');
  await expect(page.locator('#tower')).toHaveValue('Quincy');
  await expect(page.locator('#stat-modifiers')).not.toBeVisible();
  const multipliers=await page.locator('#stats').innerText();
  await expect(page.locator('#stats .stat-value')).toHaveText(['×1','×1','×1','×1','×1','×1']);
  await page.locator('#stat-details>summary').click();
  const baseSpeed=await page.locator('[data-stat=speed] .stat-value').innerText();
  await page.locator('#hero-level').fill('20');
  await expect(page.locator('#stats')).toHaveText(multipliers,{useInnerText:true});
  await expect(page.locator('[data-stat=speed] .stat-value')).not.toHaveText(baseSpeed);
  await page.locator('[data-select="DivineQuickening"]').check();
  await expect(page.locator('[data-modifier=speed] .stat-value')).not.toHaveText('×1');
  await expect(page.locator('#stats small')).toHaveCount(0);
  await page.locator('#stat-details>summary').click();
  await expect(page.locator('#stat-modifiers')).not.toBeVisible();
});

test('expanded cooldowns include Quincy level-10 unlock and preserve per-ability manual overrides',async({page})=>{
  await ready(page);await page.locator('#tower-category').selectOption('Hero');
  await page.locator('#hero-level').fill('9');await page.locator('#stat-details>summary').click();
  await expect(page.locator('[data-ability-timer]')).toHaveCount(1);
  await page.locator('#hero-level').fill('10');
  const rapid=page.locator('[data-ability-timer="RapidShotAbility"]'),storm=page.locator('[data-ability-timer="StormOfArrowsAbility"]');
  await expect(rapid).toContainText('60s');await expect(storm).toContainText('70s');
  await page.locator('#hero-level').fill('20');await page.locator('[data-select="AbsoluteAbility"]').check();
  await expect(rapid.locator('.stat-value')).toHaveText('36s');await expect(storm.locator('.stat-value')).toHaveText('44s');
  await configure(page);await page.locator('#base-ability-cooldown').fill('100');
  await expect(rapid).toContainText('manual override');await expect(rapid.locator('.stat-value')).toHaveText('80s');
  await expect(storm.locator('.stat-value')).toHaveText('44s');
  await page.locator('#hero-level').fill('9');await expect(storm).toHaveCount(0);
});

for(const width of [1440,390])test(`all hero ability timers ${width}: expanded results list the complete imported level snapshot`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await ready(page);
  const heroes=await page.evaluate(async()=> (await (await fetch('./data/heroes.json')).json()).heroes);
  await page.locator('#tower-category').selectOption('Hero');await page.locator('#hero-level').fill('20');
  await page.locator('#stat-details>summary').click();
  for(const hero of heroes){
    await page.locator('#tower').selectOption(hero.name);
    const abilities=hero.levels['20'].abilities;
    await expect(page.locator('[data-ability-timer]')).toHaveCount(abilities.length);
    for(const ability of abilities){
      const timer=page.locator(`[data-ability-timer="${ability.id}"]`);
      await expect(timer).toContainText(ability.name);
      await expect(timer.locator('.stat-value')).toHaveText(ability.cooldownSeconds+'s');
    }
  }
  await page.locator('#tower').selectOption('Quincy');
  if(width<800)await page.locator('#stat-modifiers').evaluate(el=>el.scrollLeft=el.scrollWidth);
  await page.screenshot({path:testInfo.outputPath('all-abilities.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

for(const width of [1440,390])test(`ability duration ${width}: source duration, cooldown gaps and potential continuous uptime`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await ready(page);
  await page.locator('#tower-category').selectOption('Hero');await page.locator('#hero-level').fill('20');
  await page.locator('#stat-details>summary').click();
  const rapid=page.locator('[data-ability-timer="RapidShotAbility"]');
  const storm=page.locator('[data-ability-timer="StormOfArrowsAbility"]');
  await expect(rapid).toContainText('Duration 12s');await expect(rapid).toContainText('33s nominal gap');
  await expect(storm).toContainText('Duration 3s');await expect(storm).toContainText('52s nominal gap');
  await page.locator('[data-select="AbsoluteAbility"]').check();await expect(rapid).toContainText('24s nominal gap');
  await configure(page);await page.locator('#base-ability-cooldown').fill('10');
  await expect(rapid).toContainText('Potential continuous uptime · 0s nominal gap');
  await expect(storm).toContainText('41s nominal gap');
  await expect(page.locator('.live-stat-bar')).not.toContainText('Ability timings are nominal estimates');
  if(width<800)await page.locator('#stat-modifiers').evaluate(el=>el.scrollLeft=el.scrollWidth);
  await page.screenshot({path:testInfo.outputPath('duration-gaps.png')});
  await page.locator('#ability').selectOption('');
  await expect(page.locator('[data-ability-timer="manual"]')).toContainText('Duration unknown · gap not estimated');
  await page.locator('#tower').selectOption('Benjamin');
  await expect(page.locator('[data-ability-timer]').first()).toContainText('Gap not estimated · conditional / limited activation');
});

test('routine scope stays in source details and advanced disclosures share a style',async({page},testInfo)=>{
  await ready(page);
  await page.locator('#tower-category').selectOption('Hero');
  await expect(page.locator('#component-warnings')).not.toContainText('Ability attacks are excluded.');
  await expect(page.locator('#component-warnings')).not.toContainText('Hero ability damage');
  await expect(page.locator('.summary')).not.toContainText('one contact per attack cycle');
  await page.locator('#advanced-settings>summary').click();
  await page.locator('#source-details>summary').click();
  await expect(page.locator('#preset-info')).toContainText('Hero ability damage, summoned units, and conditional buffs are excluded.');
  await expect(page.locator('#preset-info')).not.toContainText('Ability attacks are excluded.');
  await expect(page.locator('.live-stat-bar')).not.toContainText('Ability timing estimates assume');
  await expect(page.locator('.live-stat-bar')).not.toContainText('Ability damage is excluded.');
  const styles=await page.locator('#advanced-settings>details>summary').evaluateAll(elements=>elements.map(el=>{
    const s=getComputedStyle(el);return [s.color,s.fontSize,s.display,s.padding];
  }));
  for(const style of styles)expect(style).toEqual(styles[0]);
  await page.locator('.conditions>summary').click();
  await page.locator('.conditions').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('advanced-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.conditions').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('advanced-phone.png')});
});
