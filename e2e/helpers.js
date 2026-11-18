// Existing feature suites exercise editing and comparison together. Explicitly
// open the shared editor; workspace tests separately cover its collapsed default.
export async function editBuild(page) {
  const editor=page.locator('#compare-build-editor');
  if(await page.locator('body').getAttribute('data-workspace')==='compare' && !await editor.evaluate(el=>el.open))await editor.locator(':scope > summary').click();
}
export async function configure(page) {
  await editBuild(page);
  for(const id of ['tower-settings','advanced-settings','attack-settings','manual-settings','critical-settings']) {
    const detail=page.locator('#'+id);
    if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
  }
}
export async function openTool(page,id) {
  await page.locator('#nav-compare').click();
  await editBuild(page);
  await page.locator('#'+id).click();
}

export async function previewArtifact(page,id) {
  const details=page.locator(`[data-id="${id}"] .artifact-details`);
  if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
  await details.locator(`[data-preview="${id}"]`).first().click();
}
