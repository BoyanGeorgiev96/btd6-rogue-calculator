import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`stat visibility ${width}: restore, persistence and build independence`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-workspace','calculator');
  const picker=page.locator('#stat-visibility');
  const summary=picker.locator('summary');
  const ability=picker.getByRole('checkbox',{name:'Ability cooldown',exact:true});
  const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  await summary.focus();await page.keyboard.press('Enter');
  await ability.uncheck();
  await expect(page.locator('[data-modifier=ability]')).not.toBeVisible();
  await expect(page.locator('[data-modifier=damage]')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
  await expect(page.locator('#undo-build')).toBeDisabled();
  const panel=await page.locator('.stat-visibility-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(width);
  await page.screenshot({path:testInfo.outputPath(`stats-menu-${width}.png`)});
  await page.keyboard.press('Escape');
  await expect(summary).toBeFocused();
  await expect(picker).not.toHaveAttribute('open','');
  await page.locator('#stat-details>summary').click();
  await expect(page.locator('[data-stat=ability]')).toBeVisible();
  // A calculator render and workspace navigation must preserve the choice.
  await page.locator('#target-type').selectOption('ceramic');
  await expect(page.locator('[data-modifier=ability]')).not.toBeVisible();
  await page.locator('.workspace-nav [data-workspace=compare]').click();
  await expect(page.locator('[data-modifier=ability]')).not.toBeVisible();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','compare');
  await expect(page.locator('[data-modifier=ability]')).not.toBeVisible();
  await summary.click();await expect(ability).not.toBeChecked();
  await ability.check();await expect(page.locator('[data-modifier=ability]')).toBeVisible();
  // All stats may be hidden; the restore control stays available.
  for(const checkbox of await picker.getByRole('checkbox').all())await checkbox.uncheck();
  await expect(page.locator('#stats-empty')).toBeVisible();
  await expect(page.locator('#stats')).not.toBeVisible();
  await picker.getByRole('button',{name:'Show all',exact:true}).click();
  await expect(page.locator('#stats-empty')).not.toBeVisible();
  await expect(page.locator('#stats>[data-modifier]:visible')).toHaveCount(7);
  await page.locator('#live-stat-context').click();
  await expect(picker).not.toHaveAttribute('open','');
});

test('stat visibility tolerates invalid preferences and unavailable storage',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('rogue-lab-stat-visibility-v1','{"ability":true}');
    Storage.prototype.setItem=()=>{throw new Error('Unavailable');};
  });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-workspace','calculator');
  await expect(page.locator('#stats>[data-modifier]:visible')).toHaveCount(7);
  await page.locator('#stat-visibility>summary').click();
  await page.getByRole('checkbox',{name:'Ability cooldown',exact:true}).uncheck();
  await expect(page.locator('[data-modifier=ability]')).not.toBeVisible();
  await page.getByRole('button',{name:'Show all',exact:true}).click();
  await expect(page.locator('[data-modifier=ability]')).toBeVisible();
});

for(const width of [1440,390])test(`stat bar ${width}: collapse, unpin and restore without changing build`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-workspace','calculator');
  const before=await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'));
  const collapse=page.locator('#toggle-stat-bar'),pin=page.locator('#toggle-stat-pin');
  await collapse.focus();await page.keyboard.press('Enter');
  await expect(collapse).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#stats')).not.toBeVisible();
  await expect(page.locator('#stat-details')).not.toBeVisible();
  await expect(collapse).toBeFocused();
  await page.evaluate(()=>window.scrollTo(0,600));
  expect((await collapse.boundingBox()).y).toBeGreaterThanOrEqual(0);
  await page.screenshot({path:testInfo.outputPath(`collapsed-${width}.png`)});
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed','false');
  expect(await page.locator('.workspace-shell').evaluate(el=>getComputedStyle(el).position)).toBe('static');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollPaddingTop)).toBe('12px');
  await page.reload();
  await expect(collapse).toHaveText('Expand stats');
  await expect(pin).toHaveText('Pin bar');
  await expect(page.locator('#stats')).not.toBeVisible();
  await collapse.click();
  await expect(page.locator('#stats')).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,600));
  expect((await page.locator('.live-stat-bar').boundingBox()).y).toBeLessThan(0);
  await page.evaluate(()=>window.scrollTo(0,0));
  await pin.click();
  await page.evaluate(()=>window.scrollTo(0,600));
  expect((await page.locator('.live-stat-bar').boundingBox()).y).toBeGreaterThanOrEqual(0);
  await page.screenshot({path:testInfo.outputPath(`expanded-${width}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  expect(await page.evaluate(()=>localStorage.getItem('rogue-lab-v1'))).toBe(before);
  await expect(page.locator('#undo-build')).toBeDisabled();
});

test('stat bar layout controls work when storage is unavailable',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Unavailable');};Storage.prototype.setItem=()=>{throw new Error('Unavailable');};});
  await page.goto('/');
  await page.locator('#toggle-stat-bar').click();
  await expect(page.locator('#stats')).not.toBeVisible();
  await page.locator('#toggle-stat-pin').click();
  await expect(page.locator('#toggle-stat-pin')).toHaveAttribute('aria-pressed','false');
  await page.locator('#toggle-stat-bar').click();
  await expect(page.locator('#stats')).toBeVisible();
});
