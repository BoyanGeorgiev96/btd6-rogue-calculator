import {test,expect} from '@playwright/test';

const nav=(page,name)=>page.locator(`.workspace-nav [data-workspace="${name}"]`);
async function ready(page,path='/') {
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-workspace',/calculator|planner|compare|reference/);
}
for(const width of [1440,1366,390])test(`workspaces ${width}: task routes retain planner drafts, comparison choices and undo`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await ready(page);
  await expect(nav(page,'calculator')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#tower')).toBeVisible();
  await expect(page.locator('#target-type')).toBeVisible();
  await expect(page.locator('#base-damage')).not.toBeVisible();
  await expect(page.locator('#open-offers')).not.toBeVisible();
  await page.locator('[data-select="SlowerIsHarder"]').check();
  const current=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  await nav(page,'planner').click();
  await page.locator('#plan-tower').selectOption('Ninja Monkey');
  await page.locator('#plan-artifact').selectOption('SwiftestToBusiness');
  await page.locator('#plan-rarity').selectOption('Rare');
  await page.locator('#plan-pick-mid').click();
  await nav(page,'compare').click();
  await expect(page.locator('#search')).not.toBeVisible();
  await page.locator('#open-offers').click();
  await page.locator('[data-offer-index="0"] [data-offer-field="id"]').selectOption('AbsoluteAbility');
  await page.locator('[data-offer-index="0"] [data-offer-field="rarity"]').selectOption('Rare');
  await page.locator('[data-preview-offer="0"]').click();
  await expect(page.locator('#comparison-title')).toContainText('Absolute Ability');
  await nav(page,'reference').click();
  await expect(page.locator('.live-stat-bar')).not.toBeVisible();
  await page.locator('#reference-artifact').selectOption('AbsoluteAbility');
  await expect(page.locator('#reference-evidence')).toContainText('Description estimate');
  await page.goBack();
  await expect(page.locator('#comparison-panel')).toBeVisible();
  await expect(page.locator('[data-offer-index="0"] [data-offer-field="rarity"]')).toHaveValue('Rare');
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','compare');
  await page.goBack();
  await expect(page.locator('#plan-tower')).toHaveValue('Ninja Monkey');
  await expect(page.locator('#plan-rarity')).toHaveValue('Rare');
  await expect(page.locator('#plan-chosen')).toContainText('Swiftest To Business');
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(current);
  await page.goForward();
  await expect(nav(page,'compare')).toHaveAttribute('aria-current','page');
  await nav(page,'calculator').click();
  await page.locator('#undo-build').click();
  await expect(page.locator('[data-select="SlowerIsHarder"]')).not.toBeChecked();
  await expect(page.locator('#redo-build')).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('calculator.png')});
});

test('advanced disclosures preserve calculation state and remember only display preferences',async({page})=>{
  await ready(page);
  const current=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  for(const id of ['advanced-settings','attack-settings','manual-settings','critical-settings'])await page.locator(`#${id}>summary`).click();
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(current);
  await expect(page.locator('#undo-build')).toBeDisabled();
  await page.locator('#base-damage').fill('19');
  await page.locator('#manual-settings>summary').click();
  await expect(page.locator('#active-settings')).toContainText('Manual stats');
  await page.locator('.conditions>summary').click();
  await page.locator('[data-condition="close"]').check();
  await page.locator('.conditions>summary').click();
  await page.locator('#critical-mode').selectOption('expected');
  await page.locator('#critical-settings>summary').click();
  await expect(page.locator('#active-settings')).toContainText('Close targeting');
  await expect(page.locator('#active-settings')).toContainText('Critical estimates enabled');
  const result=await page.locator('#stats').innerText();
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-workspace','calculator');
  await expect(page.locator('#base-damage')).not.toBeVisible();
  await expect(page.locator('#component')).toBeVisible();
  await expect(page.locator('#stats')).toHaveText(result,{useInnerText:true});
  await expect(page.locator('#undo-build')).toBeDisabled();
});

test('direct tool links refresh safely; shared-build URLs and browser history keep the current build',async({page})=>{
  await ready(page,'/?workspace=compare&tool=target-matrix');
  await expect(page.locator('#matrix-values')).toBeVisible();
  await page.reload();await expect(page.locator('#matrix-values')).toBeVisible();
  await nav(page,'calculator').click();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-v1')));
  state.selected={SlowerIsHarder:'Rare'};
  await ready(page,'/#build='+encodeURIComponent(JSON.stringify(state)));
  await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();
  await nav(page,'compare').click();await nav(page,'calculator').click();
  await page.locator('[data-select="SlowerIsHarder"]').uncheck();
  await page.goBack();await page.goBack();
  await expect(page.locator('[data-select="SlowerIsHarder"]')).not.toBeChecked();
  await page.locator('#undo-build').click();
  await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();
});

test('keyboard navigation and corrupt display preferences leave every workspace accessible',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('rogue-lab-display-v1','42'));
  await ready(page,'/?workspace=unknown');
  await nav(page,'compare').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#workspace-title')).toBeFocused();
  await page.locator('#open-target-matrix').click();
  await expect(page.locator('#workspace-title')).toBeFocused();
  await page.locator('#edit-settings').click();
  await expect(page.locator('#tower')).toBeFocused();
  await expect(page.locator('#compare-build-editor')).toHaveAttribute('open','');
  await page.locator('#advanced-settings>summary').click();
  await page.locator('#manual-settings>summary').click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-display-v1')).manual)).toBe(true);
  await nav(page,'reference').click();await page.keyboard.press('/');
  await expect(nav(page,'calculator')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#search')).toBeFocused();
});

test('repository-relative workspace routes load assets and refresh under a Pages prefix',async({page})=>{
  await page.route('**/private-calculator/**',async route=>{
    const url=new URL(route.request().url());url.pathname=url.pathname.replace('/private-calculator/','/');
    await route.fulfill({response:await route.fetch({url:url.href})});
  });
  await ready(page,'/private-calculator/?workspace=compare&tool=upgrade-comparison');
  await expect(page.locator('#upgrade-rows tr')).toHaveCount(64);
  await expect(page.locator('#offer-comparison')).not.toBeVisible();
  await page.reload();await expect(page.locator('#upgrade-rows tr')).toHaveCount(64);
  await nav(page,'planner').click();
  await expect(page).toHaveURL(/\/private-calculator\/\?workspace=planner$/);
  await expect(page.locator('#plan-baselines tr')).toHaveCount(3);
  await page.goBack();await expect(page.locator('#upgrade-rows')).toBeVisible();
});

test('sharing from Compare uses a Calculator link and keeps the fallback route consistent',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('blocked');}}}));
  await ready(page,'/?workspace=compare&tool=target-matrix');
  await page.locator('#edit-settings').click();
  await page.locator('#share').click();
  await expect(page).toHaveURL(/\/#build=/);
  await expect(nav(page,'calculator')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#app-message')).toContainText('address bar');
  await page.reload();await expect(nav(page,'calculator')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#live-stat-context')).toContainText('Calculator build');
});

for(const [width,height] of [[1440,900],[1366,768],[390,844]])test(`comparison tools ${width}: single titles, direct links, methodology and sources`,async({page},testInfo)=>{
  const tools=[
    ['offer-comparison','open-offers','Compare artifact offers'],
    ['target-matrix','open-target-matrix','Target matrix'],
    ['synergy-finder','open-synergy','Synergy finder'],
    ['party-overview','open-party','Party overview'],
    ['upgrade-comparison','open-upgrade-comparison','Compare upgrades'],
    ['tower-comparison','open-tower-comparison','Compare tower presets']
  ];
  await page.setViewportSize({width,height});
  for(const [id,button,title] of tools) {
    await ready(page,`/?workspace=compare&tool=${id}`);
    await page.reload();
    const panel=page.locator('#'+id),heading=page.locator('#workspace-title');
    await expect(heading).toHaveText(title);
    await expect(page).toHaveTitle(`${title} · Rogue Lab`);
    await expect(panel).toBeVisible();
    await expect(panel.locator(':scope > summary')).not.toBeVisible();
    await expect(page.locator('#compare-workspace > .tower-comparison:visible')).toHaveCount(1);
    await page.locator('#'+button).focus();await page.keyboard.press('Enter');
    await expect(heading).toBeFocused();
    const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
    const method=panel.locator('.comparison-methodology');
    await expect(method).not.toHaveAttribute('open','');
    await method.locator('summary').click();
    await expect(method).toHaveAttribute('open','');
    expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
    await method.locator('summary').click();
    const source=page.locator('#compare-workspace > .comparison-source a');
    await source.click();await expect(nav(page,'reference')).toHaveAttribute('aria-current','page');
    await page.goBack();await expect(heading).toHaveText(title);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await expect(page.locator('.live-stat-bar')).toBeInViewport();
    await heading.evaluate(el=>el.scrollIntoView({block:'start'}));
    await page.screenshot({path:testInfo.outputPath(`${id}.png`)});
  }
});
