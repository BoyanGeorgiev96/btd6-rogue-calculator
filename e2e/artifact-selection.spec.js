import {test,expect} from '@playwright/test';

async function ready(page){await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);}
async function loadSelection(page,count){
 await page.goto('/');await ready(page);
 const selected=await page.evaluate(async count=>{
  const {artifacts}=await(await fetch('./data/artifacts.json')).json();
  return Object.fromEntries(artifacts.filter(a=>!['AbsoluteAbility','SlowerIsHarder'].includes(a.id)).slice(0,count).map(a=>[a.id,a.variants[0].rarity]));
 },count);
 await page.goto('/#build='+encodeURIComponent(JSON.stringify({context:{},selected})));await page.reload();await ready(page);
 return selected;
}

for(const width of [1440,390])test(`artifact rows and capacity ${width}: controls stay independent and the last slot can be reused`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await loadSelection(page,49);
 const card=id=>page.locator(`[data-id="${id}"]`), check=id=>page.locator(`[data-select="${id}"]`);
 const a=card('AbsoluteAbility'), b=card('SlowerIsHarder');
 await b.locator('select').selectOption('Rare');await expect(check('SlowerIsHarder')).not.toBeChecked();
 await expect(page.locator('#selected-count')).toHaveText('49');
 await a.locator('h3').click();await expect(check('AbsoluteAbility')).toBeChecked();
 await expect(page.locator('#selected-count')).toHaveText('50');
 await expect(page.locator('#artifact-capacity-status')).toContainText('50 / 50 selected');
 await expect(check('SlowerIsHarder')).toHaveAttribute('aria-disabled','true');
 await expect(b.locator('.card-main')).toHaveAttribute('title',/50-artifact limit/);
 await b.locator('h3').click();await expect(check('SlowerIsHarder')).not.toBeChecked();
 await check('SlowerIsHarder').focus();await page.keyboard.press('Space');await expect(check('SlowerIsHarder')).not.toBeChecked();
 await b.locator('select').selectOption('Legendary');await expect(check('SlowerIsHarder')).not.toBeChecked();
 await a.locator('select').selectOption('Rare');await expect(check('AbsoluteAbility')).toBeChecked();
 await a.locator('.artifact-details>summary').click();await expect(check('AbsoluteAbility')).toBeChecked();
 await b.locator('.artifact-details>summary').click();await expect(check('SlowerIsHarder')).not.toBeChecked();
 await b.locator('[data-preview]').first().click();await expect(page.locator('#apply-preview')).toBeDisabled();
 await expect(page.locator('#comparison-warning')).toContainText('51 / 50');
 await page.locator('#cancel-preview').click();
 await page.locator('#artifact-capacity-status').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('artifact-capacity.png')});
 await a.locator('.artifact-info>p').click();await expect(check('AbsoluteAbility')).not.toBeChecked();
 await expect(page.locator('#artifact-capacity-status')).toBeHidden();await expect(check('SlowerIsHarder')).not.toHaveAttribute('aria-disabled','true');
 await b.locator('h3').click();await expect(check('SlowerIsHarder')).toBeChecked();
 await expect(b.locator('select')).toHaveValue('Legendary');await expect(page.locator('#selected-count')).toHaveText('50');
 await page.locator('#undo-build').click();await expect(page.locator('#selected-count')).toHaveText('49');
 await page.locator('#redo-build').click();await expect(page.locator('#selected-count')).toHaveText('50');
 await page.reload();await ready(page);await expect(page.locator('#selected-count')).toHaveText('50');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('shared over-cap builds are preserved and warned about; removals and rarity edits stay available',async({page})=>{
 const selected=await loadSelection(page,51);
 await expect(page.locator('#selected-count')).toHaveText('51');
 await expect(page.locator('#artifact-capacity-status')).toContainText('hypothetical build');
 await expect(page.locator('#live-stat-warning')).toContainText('51 / 50');
 expect(Object.keys(JSON.parse(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).selected)).toHaveLength(51);
 await page.locator('[data-view="all"]').click();
 const [first,second]=Object.keys(selected);
 await page.locator(`[data-id="${first}"] h3`).click();await expect(page.locator('#selected-count')).toHaveText('50');
 await expect(page.locator('[data-select="AbsoluteAbility"]')).toHaveAttribute('aria-disabled','true');
 await page.locator(`[data-id="${second}"] h3`).click();await expect(page.locator('#selected-count')).toHaveText('49');
 await page.locator('[data-select="AbsoluteAbility"]').focus();await page.keyboard.press('Space');
 await expect(page.locator('[data-select="AbsoluteAbility"]')).toBeChecked();
 await expect(page.locator('#live-stat-warning')).not.toContainText('hypothetical build');
});
