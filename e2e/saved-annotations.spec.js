import {test,expect} from '@playwright/test';
const planKey='rogue-lab-run-plans-v1';
async function planner(page){
  await page.goto('/?workspace=planner');
  await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
  await page.locator('#run-planner details').filter({has:page.locator('#plan-save')}).locator(':scope > summary').click();
}
for(const width of [1440,390])test(`plan library ${width}: independent plans, annotations, dirty switching and transfers`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await planner(page);
  const calculator=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  await page.locator('#plan-name').fill('Dart plan');await page.locator('#plan-notes').fill('First line\nSecond line');await page.locator('#plan-tags').fill('boss, Boss, testing');await page.locator('#plan-save').click();
  const first=await page.locator('#saved-plan').inputValue();
  await page.locator('#plan-tower').selectOption('Ninja Monkey');
  await page.locator('#plan-name').fill('Ninja plan');await page.locator('#plan-duplicate').click();
  const second=await page.locator('#saved-plan').inputValue();expect(second).not.toBe(first);
  await page.locator('#plan-notes').fill('Unsaved edit');await page.locator('#saved-plan').selectOption(first);await page.locator('#plan-load').click();
  await expect(page.locator('#plan-discard-load')).toBeVisible();await expect(page.locator('#plan-tower')).toHaveValue('Ninja Monkey');
  await page.locator('#plan-discard-load').click();await expect(page.locator('#plan-tower')).toHaveValue('Dart Monkey');
  await expect(page.locator('#plan-notes')).toHaveValue('First line\nSecond line');await expect(page.locator('#plan-tags')).toHaveValue('boss, testing');
  await page.locator('#plan-notes').fill('Updated first');await page.locator('#plan-update').click();
  await page.reload();await page.locator('#run-planner details').filter({has:page.locator('#plan-save')}).locator(':scope > summary').click();
  await expect(page.locator('#plan-notes')).toHaveValue('Updated first');
  await page.locator('#saved-plan').selectOption(second);await page.locator('#plan-load').click();
  await expect(page.locator('#plan-tower')).toHaveValue('Ninja Monkey');await expect(page.locator('#plan-notes')).toHaveValue('First line\nSecond line');
  const downloadPromise=page.waitForEvent('download');await page.locator('#plans-export').click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('rogue-lab-run-plans.json');
  const json=await page.locator('#plan-json').inputValue();
  await page.locator('#plans-import').click();await expect(page.locator('#saved-plan option')).toHaveCount(5);
  await expect(page.locator('#plan-tower')).toHaveValue('Ninja Monkey');
  await page.locator('#plan-delete').click();await expect(page.locator('#saved-plan option')).toHaveCount(4);
  await page.locator('#plan-undo-delete').click();await expect(page.locator('#saved-plan option')).toHaveCount(5);
  const stored=await page.evaluate(key=>localStorage.getItem(key),planKey);
  const bad=JSON.parse(json);bad.plans[1].snapshot.setup.tower='Fake tower';
  await page.locator('#plan-json').fill(JSON.stringify(bad));await page.locator('#plans-import').click();
  await expect(page.locator('#plan-storage-status')).toContainText('Saved plans unchanged');expect(await page.evaluate(key=>localStorage.getItem(key),planKey)).toBe(stored);
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(calculator);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.locator('#plan-name').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('saved-plans.png')});
});
test('legacy saved plan is retained when adding a second plan',async({page})=>{
  await planner(page);const download=page.waitForEvent('download');await page.locator('#plan-export').click();await download;
  const legacy=JSON.parse(await page.locator('#plan-json').inputValue());delete legacy.notes;delete legacy.tags;
  await page.evaluate(value=>localStorage.setItem('rogue-lab-run-plan-v1',JSON.stringify(value)),legacy);
  await page.reload();await page.locator('#run-planner details').filter({has:page.locator('#plan-save')}).locator(':scope > summary').click();
  await expect(page.locator('#saved-plan option')).toHaveCount(2);await expect(page.locator('#plan-notes')).toHaveValue('');
  await page.locator('#plan-name').fill('Another plan');await page.locator('#plan-save').click();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).plans.length,planKey)).toBe(2);
});
test('build annotations survive reload, duplication, JSON transfer and readable report',async({page},testInfo)=>{
  await page.goto('/');await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);
  await page.locator('.saved-builds > summary').click();
  await page.locator('#build-name').fill('Annotated build');await page.locator('#build-notes').fill('Line one\n<script>literal</script>');await page.locator('#build-tags').fill('boss, Boss, test');await page.locator('#save-build').click();
  await page.reload();await page.locator('.saved-builds > summary').click();await page.locator('#saved-build').selectOption({label:'Annotated build'});await page.locator('#load-build').click();
  await expect(page.locator('#build-notes')).toHaveValue('Line one\n<script>literal</script>');await expect(page.locator('#build-tags')).toHaveValue('boss, test');
  await page.locator('#duplicate-build').click();await expect(page.locator('#saved-build option')).toHaveCount(3);
  await page.locator('.build-transfer > summary').click();const download=page.waitForEvent('download');await page.locator('#export-builds').click();await download;
  const builds=JSON.parse(await page.locator('#build-json').inputValue()).builds;expect(builds[1].notes).toBe(builds[0].notes);expect(builds[1].tags).toEqual(['boss','test']);
  await page.locator('#import-builds').click();await expect(page.locator('#saved-build option')).toHaveCount(5);
  await page.locator('#build-report-panel > summary').click();await expect(page.locator('#build-report-text')).toHaveValue(/Tags: boss, test/);
  await expect(page.locator('#build-report-text')).toHaveValue(/\\<script\\>literal/);
  await page.screenshot({path:testInfo.outputPath('build-notes.png')});
});

test('importing a collection while editing an unsaved imported plan preserves the last saved reload target',async({page})=>{
  await planner(page);await page.locator('#plan-name').fill('Saved baseline');await page.locator('#plan-save').click();
  const collectionDownload=page.waitForEvent('download');await page.locator('#plans-export').click();await collectionDownload;
  const collection=await page.locator('#plan-json').inputValue();
  const singleDownload=page.waitForEvent('download');await page.locator('#plan-export').click();await singleDownload;
  const imported=JSON.parse(await page.locator('#plan-json').inputValue());imported.name='Unsaved import';imported.notes='Keep this draft';
  await page.locator('#plan-json').fill(JSON.stringify(imported));await page.locator('#plan-import').click();
  await page.locator('#plan-json').fill(collection);await page.locator('#plans-import').click();
  await expect(page.locator('#plan-name')).toHaveValue('Unsaved import');await expect(page.locator('#plan-notes')).toHaveValue('Keep this draft');
  await page.reload();await page.locator('#run-planner details').filter({has:page.locator('#plan-save')}).locator(':scope > summary').click();
  await expect(page.locator('#plan-name')).toHaveValue('Saved baseline');await expect(page.locator('#plan-notes')).toHaveValue('');
});
