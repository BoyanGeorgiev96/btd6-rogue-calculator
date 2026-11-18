import {configure,openTool,previewArtifact} from './helpers.js';
import {test,expect} from '@playwright/test';
async function ready(page){await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText('Loading catalog…');await expect(page.locator('#result-count')).not.toHaveText('Catalog unavailable');}

for(const size of [{width:1440,height:900},{width:1366,height:768}])test(`desktop ${size.width}: stats start above the fold and remain visible while browsing`,async({page},testInfo)=>{
 await page.setViewportSize(size);await ready(page);await expect(page.locator('#tower-settings')).toHaveAttribute('open','');
 const box=await page.locator('.dps-highlight').boundingBox();expect(box.y).toBeGreaterThan(0);expect(box.y+box.height).toBeLessThan(size.height);
 await page.screenshot({path:testInfo.outputPath('desktop.png')});
 await page.evaluate(()=>window.scrollTo(0,1300));const sticky=await page.locator('.workspace-shell').boundingBox();expect(sticky.y).toBe(0);
 const dps=await page.locator('.dps-highlight').boundingBox();expect(dps.y).toBeGreaterThanOrEqual(0);expect(dps.y+dps.height).toBeLessThan(size.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.locator('#edit-settings').click();await expect(page.locator('#tower')).toBeFocused();await expect(page.locator('#tower-settings')).toHaveAttribute('open','');
});
test('ranking, applicability, target changes, explanation, and preview work together',async({page})=>{
 await ready(page);await page.locator('#only-applicable').check();await page.locator('#artifact-sort').selectOption('dps');
 await expect(page.locator('[data-id="GrandMagicPrecision"]')).toHaveCount(0);
 await page.locator('#target-type').selectOption('ceramic');await expect(page.locator('[data-id="CeramicChunker"]')).toHaveCount(1);
 await previewArtifact(page,'CeramicChunker');await expect(page.locator('#comparison-title')).toContainText('Ceramic Chunker');
 await expect(page.locator('[data-select="CeramicChunker"]')).not.toBeChecked();await page.locator('#apply-preview').click();await expect(page.locator('[data-select="CeramicChunker"]')).toBeChecked();
 await page.locator('#advanced-settings>summary').click();await page.locator('.calculation-explanation>summary').click();await expect(page.locator('#calculation-trace')).toContainText('Flat artifact target bonuses');
 await expect(page.locator('[data-id="CeramicChunker"] .effect-evidence')).toContainText('Description estimate');
});
test('downloads and file imports retain named builds and manual stats',async({page})=>{
 await ready(page);await configure(page);await page.locator('#base-damage').fill('19');
 await page.locator('.saved-builds>summary').click();await page.locator('#build-name').fill('Desktop run');await page.locator('#save-build').click();
 await page.locator('.build-transfer>summary').click();const downloadEvent=page.waitForEvent('download');await page.locator('#export-builds').click();const download=await downloadEvent;expect(download.suggestedFilename()).toBe('rogue-lab-builds.json');
 const path=await download.path();await page.locator('#build-file').setInputFiles(path);await expect(page.locator('#app-message')).toContainText('File ready');await page.locator('#import-builds').click();
 await expect(page.locator('#saved-build option')).toHaveCount(3);await page.locator('#base-damage').fill('3');await page.locator('#load-build').click();await expect(page.locator('#base-damage')).toHaveValue('19');
});
test('storage failure leaves calculator usable and sharing has a clipboard fallback',async({page,context})=>{
 await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('blocked');}}});});
 await ready(page);await expect(page.locator('#app-message')).toContainText('storage is unavailable');
 await page.locator('[data-select="SlowerIsHarder"]').check();await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();
 await page.locator('#share').click();await expect(page).toHaveURL(/#build=/);await expect(page.locator('#app-message')).toContainText('address bar');
});
test('keyboard search shortcut and selection retain usable focus',async({page})=>{
 await ready(page);await page.keyboard.press('/');await expect(page.locator('#search')).toBeFocused();await page.keyboard.type('Slower');
 const check=page.locator('[data-select="SlowerIsHarder"]');await check.focus();await page.keyboard.press('Space');await expect(check).toBeChecked();await expect(check).toBeFocused();
});

test('tower comparison uses the run for each source preset without changing the current tower',async({page})=>{
 await ready(page);await page.locator('[data-select="GreaterPrimaryPrecision"]').check();await openTool(page,'open-tower-comparison');
 await expect(page.locator('#tower-comparison-rows tr')).toHaveCount(2);await expect(page.locator('#tower-comparison-context')).toContainText('1 selected artifacts');
 const sniper=page.locator('tr[data-comparison-index="1"]');await sniper.locator('[data-comparison-field="path"]').fill('300');await sniper.locator('[data-comparison-field="path"]').dispatchEvent('change');
 await expect(page.locator('#live-stat-context')).toContainText('Dart Monkey');await expect(page.locator('#tower-comparison-rows')).toContainText('Sniper');
 await page.locator('#add-tower-preset').click();await expect(page.locator('#tower-comparison-rows tr')).toHaveCount(3);
 const extra=page.locator('tr[data-comparison-index="2"]');await extra.locator('[data-comparison-field="tower"]').selectOption('Quincy');await page.locator('tr[data-comparison-index="2"] [data-comparison-field="heroLevel"]').fill('20');await page.locator('tr[data-comparison-index="2"] [data-comparison-field="heroLevel"]').dispatchEvent('change');
 await page.locator('[data-remove-preset="2"]').click();await expect(page.locator('#tower-comparison-rows tr')).toHaveCount(2);
});
test('compact artifact-list import previews errors and replaces or merges without changing tower settings',async({page})=>{
 await ready(page);await configure(page);await page.locator('#base-damage').fill('17');await page.locator('[data-select="SlowerIsHarder"]').check();
 await page.locator('.saved-builds>summary').click();await page.locator('.run-transfer>summary').click();await page.locator('#run-text').fill('Ceramic Chunker | Rare\nOne Monkey Army | Common');await page.locator('#preview-run').click();await expect(page.locator('#run-preview')).toContainText('has no Common rarity');await expect(page.locator('#apply-run')).toBeDisabled();
 await page.locator('#run-text').fill('Ceramic Chunker | Rare');await page.locator('#preview-run').click();await expect(page.locator('#apply-run')).toBeEnabled();await page.locator('#apply-run').click();await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();await expect(page.locator('#rarity-CeramicChunker')).toHaveValue('Rare');await expect(page.locator('#base-damage')).toHaveValue('17');
 await page.locator('#run-mode').selectOption('replace');await page.locator('#preview-run').click();await page.locator('#apply-run').click();await expect(page.locator('[data-select="SlowerIsHarder"]')).not.toBeChecked();
 const event=page.waitForEvent('download');await page.locator('#export-run').click();expect((await event).suggestedFilename()).toBe('rogue-lab-run.txt');
 await page.locator('#preview-run').click();await page.locator('#run-text').fill('unknown | Rare');await expect(page.locator('#apply-run')).toBeDisabled();
});

for(const size of [{width:390,height:844},{width:768,height:1024}])test(`responsive ${size.width}: stats scroll independently and controls stay usable`,async({page},testInfo)=>{
 await page.setViewportSize(size);await ready(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const bar=await page.locator('.live-stat-bar').boundingBox();expect(bar.height).toBeLessThan(size.height/3);
 await page.locator('#stats').evaluate(el=>el.scrollLeft=el.scrollWidth);await expect(page.locator('#stats .stat-row').last()).toBeInViewport();
 await page.screenshot({path:testInfo.outputPath('responsive.png')});
 await page.locator('#edit-settings').click();await expect(page.locator('#tower')).toBeFocused();await page.locator('#tower-category').selectOption('Military');await expect(page.locator('#live-stat-context')).toContainText('Sniper Monkey');
 await page.locator('#browse-artifacts').click();await expect(page.locator('#search')).toBeFocused();await page.locator('#search').fill('One Shot');await page.locator('[data-select="OneShot"]').check();await expect(page.locator('[data-select="OneShot"]')).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('overlapping crit mechanics are flagged in the persistent stats bar',async({page})=>{
 await ready(page);await configure(page);await page.locator('#tower-category').selectOption('Hero');await page.locator('#tower').selectOption('Adora');await page.locator('#critical-mode').selectOption('expected');
 for(const id of ['OneMonkeyArmy','CriticalSuccess','DivineIntervention'])await page.locator(`[data-select="${id}"]`).check();
 await expect(page.locator('#live-stat-warning')).toBeVisible();await expect(page.locator('#live-stat-warning')).toContainText('critical damage is excluded');
});

test('ability cooldown presets, artifact reductions, manual overrides, and shared builds stay independent of attack stats',async({page})=>{
 await ready(page);await configure(page);await page.locator('#path-middle').selectOption('4');await expect(page.locator('#base-ability-cooldown')).toHaveValue('50');
 await page.locator('#stat-details>summary').click();
 const cooldown=page.locator('[data-stat=ability]');await expect(cooldown).toContainText('50s');
 await page.locator('[data-select="AbsoluteAbility"]').check();await expect(cooldown).toContainText('40s');await expect(page.locator('[data-stat=ability]')).toContainText('-20%');
 await page.locator('#base-ability-cooldown').fill('60');await expect(cooldown).toContainText('48s');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('rogue-lab-v1')));expect(stored.context.statMode).toBe('preset');expect(stored.context.abilityMode).toBe('manual');
 await page.goto('/#build='+encodeURIComponent(JSON.stringify(stored)));await expect(page.locator('#base-ability-cooldown')).toHaveValue('60');await expect(cooldown).toContainText('48s');
 await configure(page);await page.locator('#ability').selectOption('Ability');await expect(page.locator('#base-ability-cooldown')).toHaveValue('50');await expect(cooldown).toContainText('40s');
 await page.locator('#clear').click();await page.locator('#tower-category').selectOption('Hero');await page.locator('#hero-level').fill('20');await page.locator('#ability').selectOption('StormOfArrowsAbility');await expect(page.locator('#base-ability-cooldown')).toHaveValue('55');
 await page.locator('[data-select="DivineQuickening"]').check();await expect(cooldown).toContainText('50.93s');await expect(cooldown).toContainText('Storm of Arrows');
 await openTool(page,'open-tower-comparison');await page.locator('#add-tower-preset').click();const row=page.locator('[data-comparison-index="2"]');await expect(row.locator('[data-comparison-field="abilityId"]')).toHaveValue('StormOfArrowsAbility');await row.locator('[data-comparison-field="abilityId"]').selectOption('RapidShotAbility');await expect(row).toContainText('41.67s');await expect(cooldown).toContainText('50.93s');
});

test('current build undo/redo restores cleared artifacts and applied previews',async({page})=>{
 await ready(page);await expect(page.locator('#undo-build')).toBeDisabled();
 await page.locator('[data-select="SlowerIsHarder"]').check();await page.locator('#clear').click();await expect(page.locator('[data-select="SlowerIsHarder"]')).not.toBeChecked();
 await page.locator('#undo-build').click();await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();await page.locator('#redo-build').click();await expect(page.locator('[data-select="SlowerIsHarder"]')).not.toBeChecked();
 await previewArtifact(page,'AbsoluteAbility');await page.locator('#apply-preview').click();await expect(page.locator('[data-select="AbsoluteAbility"]')).toBeChecked();await page.locator('#undo-build').click();await expect(page.locator('[data-select="AbsoluteAbility"]')).not.toBeChecked();
 await page.locator('[data-select="InnateAbility"]').check();await expect(page.locator('#redo-build')).toBeDisabled();
});
test('history groups numeric typing, preserves native editing shortcuts, and restores full presets',async({page})=>{
 await ready(page);await configure(page);await page.locator('#base-damage').fill('120');await page.locator('#undo-build').click();await expect(page.locator('#base-damage')).toHaveValue('1');await page.locator('#redo-build').click();await expect(page.locator('#base-damage')).toHaveValue('120');
 await page.locator('#base-damage').focus();await page.keyboard.press('Control+z');await expect(page.locator('#undo-build')).toBeEnabled();
 await page.locator('#tower-category').selectOption('Military');await expect(page.locator('#tower')).toHaveValue('Sniper Monkey');await page.locator('#undo-build').click();await expect(page.locator('#tower')).toHaveValue('Dart Monkey');await expect(page.locator('#base-damage')).toHaveValue('120');
 await page.locator('#undo-build').focus();await page.keyboard.press('Control+Shift+z');await expect(page.locator('#tower')).toHaveValue('Sniper Monkey');
});
test('undoing a compact import retains the original selections and manual ability timer',async({page})=>{
 await ready(page);await configure(page);await page.locator('#base-ability-cooldown').fill('77');await page.locator('[data-select="SlowerIsHarder"]').check();
 await page.locator('.saved-builds>summary').click();await page.locator('.run-transfer>summary').click();await page.locator('#run-text').fill('Absolute Ability | Rare');await page.locator('#run-mode').selectOption('replace');await page.locator('#preview-run').click();await page.locator('#apply-run').click();
 await expect(page.locator('[data-select="SlowerIsHarder"]')).not.toBeChecked();await page.locator('#undo-build').click();await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();await expect(page.locator('[data-select="AbsoluteAbility"]')).not.toBeChecked();await expect(page.locator('#base-ability-cooldown')).toHaveValue('77');
});
test('editing a shared build clears its stale hash so reload keeps the autosaved edit',async({page})=>{
 await ready(page);const stored=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));await page.goto('/#build='+encodeURIComponent(stored));
 await page.locator('[data-select="SlowerIsHarder"]').check();await expect(page).not.toHaveURL(/#build=/);await page.reload();await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();await expect(page.locator('#undo-build')).toBeDisabled();
});

test('exact-rarity offers show independent tradeoffs and use reversible previews',async({page},testInfo)=>{
 await ready(page);await configure(page);await page.locator('#base-ability-cooldown').fill('60');await openTool(page,'open-offers');
 const row=index=>page.locator(`[data-offer-index="${index}"]`);
 await row(0).locator('[data-offer-field="id"]').selectOption('SlowerIsHarder');await row(0).locator('[data-offer-field="rarity"]').selectOption('Legendary');
 await row(1).locator('[data-offer-field="id"]').selectOption('AbsoluteAbility');await expect(row(0).locator('.offer-best')).toContainText('DPS multiplier gain');await expect(row(1)).toContainText('48');
 await page.locator('#offer-metric').selectOption('cooldown');await expect(row(1).locator('.offer-best')).toContainText('cooldown factor reduction');await expect(page.locator('[data-select="AbsoluteAbility"]')).not.toBeChecked();await page.locator('#offer-comparison').screenshot({path:testInfo.outputPath('offers.png')});
 await row(1).locator('[data-preview-offer]').click();await expect(page.locator('#comparison-title')).toContainText('Absolute Ability');await expect(page.locator('[data-select="AbsoluteAbility"]')).not.toBeChecked();await page.locator('#cancel-preview').click();
 await row(1).locator('[data-preview-offer]').click();await page.locator('#apply-preview').click();await expect(page.locator('[data-select="AbsoluteAbility"]')).toBeChecked();await expect(row(1)).toContainText('Already owned at this rarity');await page.locator('#undo-build').click();await expect(page.locator('[data-select="AbsoluteAbility"]')).not.toBeChecked();await expect(row(1).locator('.offer-best')).toContainText('cooldown factor reduction');
});
test('offer comparison handles rarity replacement, reference-only choices, ties, and row limits',async({page})=>{
 await ready(page);await page.locator('[data-select="SlowerIsHarder"]').check();await openTool(page,'open-offers');
 const row=index=>page.locator(`[data-offer-index="${index}"]`);await row(0).locator('[data-offer-field="id"]').selectOption('SlowerIsHarder');await row(0).locator('[data-offer-field="rarity"]').selectOption('Legendary');await expect(row(0)).toContainText('Replaces your Common rarity');
 await row(1).locator('[data-offer-field="id"]').selectOption('SlowerIsHarder');await row(1).locator('[data-offer-field="rarity"]').selectOption('Legendary');await expect(page.locator('.offer-best')).toHaveCount(2);await expect(page.locator('#offer-ranking')).toContainText('tied highest');
 await page.locator('#add-offer').click();await expect(page.locator('#add-offer')).toBeDisabled();await row(2).locator('[data-offer-field="id"]').selectOption('AbundantChoices');await expect(row(2)).toContainText('Reference-only offer');await expect(row(2).locator('.offer-best')).toHaveCount(0);
 await page.locator('[data-remove-offer="2"]').click();await expect(page.locator('#add-offer')).toBeEnabled();await expect(page.locator('#offer-rows tr')).toHaveCount(2);
});
test('offer comparison stays inside a phone viewport and recomputes for target changes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await openTool(page,'open-offers');await page.locator('[data-offer-index="0"] [data-offer-field="id"]').selectOption('CeramicChunker');
 await expect(page.locator('#offer-ranking')).toContainText('No measured positive gain');await page.locator('#edit-settings').click();await page.locator('#target-type').selectOption('ceramic');await expect(page.locator('#offer-ranking')).toContainText('highest modeled DPS multiplier gain');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(page.locator('#offer-context')).toContainText('Ceramic');await expect(page.locator('#stats')).toBeVisible();
});

for(const width of [1440,390])test(`party overview ${width}: saved components use the run without changing saved builds`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await ready(page);
 await openTool(page,'open-party');await expect(page.locator('#party-builds')).toContainText('Save a tower or hero');
 await configure(page);await page.locator('#base-damage').fill('19');
 await page.locator('.saved-builds>summary').click();await page.locator('#build-name').fill('<Dart party>');await page.locator('#save-build').click();
 await page.locator('#tower-category').selectOption('Hero');await page.locator('#build-name').fill('Hero party');await page.locator('#save-build').click();
 const original=await page.evaluate(()=>localStorage.getItem('rogue-lab-builds-v1'));
 await openTool(page,'open-party');await page.locator('[data-party-build]').nth(0).check();await page.locator('[data-party-build]').nth(1).check();
 await expect(page.locator('#party-rows tr')).toHaveCount(2);await expect(page.locator('#party-rows')).toContainText('<Dart party>');await expect(page.locator('#party-rows')).toContainText('Quincy');
 const before=await page.locator('#party-rows').innerText();await page.locator('[data-select="GreaterPrimaryPrecision"]').check();
 await expect(page.locator('#party-context')).toContainText('1 selected artifacts');await expect(page.locator('#party-rows')).not.toHaveText(before);
 await page.locator('#target-type').selectOption('ceramic');await expect(page.locator('#party-context')).toContainText('Ceramic');
 expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-builds-v1'))).toBe(original);
 await page.locator('#party-sort').selectOption('dps');await page.locator('#party-overview').scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:testInfo.outputPath('party.png')});
 await page.locator('#saved-build').selectOption({label:'Hero party'});await page.locator('#delete-build').click();await expect(page.locator('#party-rows tr')).toHaveCount(1);
 await page.locator('#undo-delete').click();await expect(page.locator('[data-party-build]')).toHaveCount(2);
 await page.locator('#load-build').click();await expect(page.locator('#live-stat-context')).toContainText('Quincy');
});

for (const width of [1440,390]) test(`synergy finder ${width}: gates, penalties, overlap, and previews preserve the build`, async ({page}, testInfo) => {
 await page.setViewportSize({width,height:900});await ready(page);
 await openTool(page,'open-synergy');await page.locator('#synergy-conversion').selectOption('EssenceOfDreadbloon');
 await expect(page.locator('#synergy-categories')).toContainText('Requires tower tier 4');
 await configure(page);await page.locator('#path-top').selectOption('4');
 await page.locator('[data-select="GrandMagicPrecision"]').check();
 await expect(page.locator('#synergy-effects')).toContainText('Selected');await expect(page.locator('#synergy-effects')).toContainText('penalty');
 await page.locator('#synergy-finder').evaluate(el => el.scrollIntoView({block:'start'}));
 await page.screenshot({path:testInfo.outputPath('synergy-header.png')});
 await page.getByText('Towers with newly unlocked bonuses', {exact:true}).click();await expect(page.locator('#synergy-beneficiaries')).toContainText('Sniper Monkey');
 const before = await page.evaluate(() => localStorage.getItem('rogue-lab-v1'));
 await page.locator('#synergy-conversion').selectOption('HeroicSpecialty');await page.locator('#synergy-conversion').selectOption('EssenceOfDreadbloon');
 expect(await page.evaluate(() => localStorage.getItem('rogue-lab-v1'))).toBe(before);
 await page.locator('#synergy-finder').scrollIntoViewIfNeeded();expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 await page.screenshot({path:testInfo.outputPath('synergy.png')});
 await page.locator('#preview-synergy').click();await expect(page.locator('#comparison-panel')).toBeVisible();
 await expect(page.locator('[data-select="EssenceOfDreadbloon"]')).not.toBeChecked();await page.locator('#apply-preview').click();
 await expect(page.locator('[data-select="EssenceOfDreadbloon"]')).toBeChecked();await expect(page.locator('#preview-synergy')).toBeDisabled();
 await page.locator('#undo-build').click();await expect(page.locator('[data-select="EssenceOfDreadbloon"]')).not.toBeChecked();
 await page.locator('#tower-category').selectOption('Hero');await page.locator('[data-select="OneMonkeyArmy"]').check();
 await expect(page.locator('#synergy-categories')).toContainText('No additional categories');await expect(page.locator('#synergy-effects')).toContainText('No newly activated');
});
