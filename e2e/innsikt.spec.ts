import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { addExercise, closeSummary, finishWorkout, goTab, logSet, skipRest, startEmptyWorkout, card } from './helpers';

async function squatWorkout(page: import('@playwright/test').Page): Promise<void> {
  await startEmptyWorkout(page);
  await addExercise(page, 'Knebøy (stang)');
  await logSet(page, 'Knebøy (stang)', 0, '100', '5');
  await skipRest(page);
  // RPE 8 på settet: to reps igjen.
  await card(page, 'Knebøy (stang)').locator('.rpe-btn').first().click();
  await page.locator('.sheet .rpe-choice', { hasText: /^8$/ }).click();
  await finishWorkout(page);
  await closeSummary(page);
}

test('øvelsessiden viser 1RM-anslag både uten og med RPE', async ({ page }) => {
  await squatWorkout(page);
  await goTab(page, 'Øvelser');
  await page.locator('.search').fill('Knebøy (stang)');
  await page.locator('.list-item').first().click();
  const detail = page.getByRole('dialog', { name: 'Knebøy (stang)' });
  await detail.getByRole('tab', { name: 'Rekorder' }).click();
  await expect(detail).toContainText('Estimert 1RM uten RPE');
  await expect(detail).toContainText('116,7 kg (100×5)');
  await expect(detail).toContainText('Estimert 1RM med RPE');
  await expect(detail).toContainText('123,3 kg (100×5, RPE 8)');
  await detail.getByRole('tab', { name: 'Grafer' }).click();
  await expect(detail.locator('.chart')).toHaveCount(3);
});

test('ukeoversikten i dagboka teller økta', async ({ page }) => {
  await squatWorkout(page);
  await goTab(page, 'Dagbok');
  const week = page.locator('.card', { hasText: 'Ukeoversikt' });
  await expect(week.locator('.week-readout')).toContainText('1 økt, 1 arbeidssett, 500 kg');
  await expect(week.locator('.week-bar')).toHaveCount(12);
  await week.getByRole('button', { name: 'Volum' }).click();
  await week.locator('.week-slot').first().click();
  await expect(week.locator('.week-readout')).toContainText('ingen økter');
});

test('eksport til AI-assistent: fil med økta, og «nytt siden sist» er tomt etterpå', async ({ page }) => {
  await squatWorkout(page);
  await goTab(page, 'Innstillinger');
  const ai = page.locator('.card', { hasText: 'Eksport til AI-assistent' });
  await expect(ai).toContainText('Valget gir 1 økt og 1 sett.');
  const [download] = await Promise.all([page.waitForEvent('download'), ai.getByRole('button', { name: 'Lag fil til AI-assistent' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^stige-til-ai-\d{4}-\d{2}-\d{2}\.txt$/);
  const text = await readFile(await download.path(), 'utf8');
  expect(text).toContain('# Treningsdata fra Stige');
  expect(text).toContain('Knebøy (stang)');
  expect(text).toContain('100 kg, 5 reps, RPE 8');
  await expect(ai).toContainText('Fila er laget med 1 økt.');
  await expect(ai).toContainText('Valget gir 0 økter og 0 sett.');
  await ai.getByRole('button', { name: 'Alt', exact: true }).click();
  await expect(ai).toContainText('Valget gir 1 økt og 1 sett.');
});

test('backup kan eksporteres og leses inn igjen', async ({ page }) => {
  await squatWorkout(page);
  await goTab(page, 'Innstillinger');
  const backup = page.locator('.card', { hasText: 'Eksporter backup (JSON)' });
  const [download] = await Promise.all([page.waitForEvent('download'), backup.getByRole('button', { name: 'Eksporter backup (JSON)' }).click()]);
  const path = await download.path();
  const data = JSON.parse(await readFile(path, 'utf8'));
  expect(data.app).toBe('stige');
  expect(data.workouts).toHaveLength(1);

  await backup.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('.sheet')).toContainText('1 økter');
  await page.getByRole('button', { name: 'Erstatt alle data med backupen' }).click();
  await expect(backup).toContainText('Backupen er lest inn.');
  await goTab(page, 'Dagbok');
  await expect(page.locator('.card', { hasText: 'Knebøy (stang)' }).first()).toBeVisible();
});

test('ingen sider ruller sidelengs på en smal telefon', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await squatWorkout(page);
  for (const tab of ['Rutiner', 'Dagbok', 'Økt', 'Øvelser', 'Innstillinger']) {
    await goTab(page, tab);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `fanen ${tab}`).toBeLessThanOrEqual(0);
  }
});
