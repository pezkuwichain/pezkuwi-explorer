import { expect, test, type Page } from '@playwright/test';
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';

// A public Zagros address that holds HEZ. Reads only; nothing here signs or sends.
const SMOKE_ADDRESS = process.env.SMOKE_ADDRESS;
if (!SMOKE_ADDRESS) throw new Error('SMOKE_ADDRESS is required');
// The same account written with the Polkadot prefix, as a user copying from another wallet would paste it.
const POLKADOT_FORM = encodeAddress(decodeAddress(SMOKE_ADDRESS), 0);

const useLanguage = (page: Page, lang: string) =>
  page.addInitScript((l) => localStorage.setItem('pezkuwi-explorer:lang', l), lang);

async function pasteAndOpen(page: Page, address: string) {
  await page.goto('/account/open');
  await page.getByRole('button', { name: 'Paste address' }).click();
  await page.getByPlaceholder('Paste your address here').fill(address);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(/\bHEZ\b/).first()).toBeVisible({ timeout: 30_000 });
}

// SMOKE_ADDRESS is a Zagros account and the checks below read Zagros, so the page is pinned to it (a first visit
// would read mainnet, src/config/network.ts).
const useZagros = (page: Page) => page.addInitScript(() => localStorage.setItem('pezkuwi-explorer:network', 'zagros'));

test.beforeEach(async ({ page }) => { await useLanguage(page, 'en'); await useZagros(page); });

test('home shows the four tiles, the way in, the tabs and the experts link, and the network light resolves', async ({ page }) => {
  await page.goto('/');
  const main = page.getByRole('main');
  for (const name of ['Did my payment arrive?', 'Citizenship', 'Network', 'Recent activity']) {
    await expect(main.getByRole('link', { name })).toBeVisible();
  }
  await expect(main.getByRole('button', { name: 'Open with my wallet' })).toBeVisible();
  for (const name of ['Home', 'Account', 'Citizenship', 'Network']) {
    await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name })).toBeVisible();
  }
  // At the default 1280 px viewport the desktop shell adds its own experts link in the header.
  await expect(page.locator('footer.experts').getByRole('link', { name: /For experts/ })).toBeVisible();
  await expect(page.locator('.desk-experts')).toBeVisible();
  const light = page.getByRole('status');
  await expect(light).not.toHaveText(/Checking/, { timeout: 30_000 });
  await expect(light).toHaveText(/The network is working/);
  // The pin took: this page reads Zagros (so every check here is about Zagros).
  await expect(page.locator('header.brand .net-chip-zagros')).toHaveText('Testnet (Zagros)');
});

test('a first visit reads mainnet and the live mainnet network answers', async ({ page }) => {
  // Runs after the Zagros pin of beforeEach: removes it again, as on a first visit.
  await page.addInitScript(() => localStorage.removeItem('pezkuwi-explorer:network'));
  await page.goto('/network');
  await expect(page.locator('.page-header .net-chip-mainnet')).toHaveText('Mainnet (Pezkuwi)');
  await expect(page.getByRole('radio', { name: 'Mainnet (Pezkuwi)' })).toHaveAttribute('aria-checked', 'true');
  const light = page.locator('section.live');
  await expect(light).not.toHaveText(/Checking/, { timeout: 30_000 });
  await expect(light).toHaveText(/The network is working/);
});

test('the wallet way opens the wallet dialog; Escape closes it and gives focus back', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('main').getByRole('button', { name: 'Open with my wallet' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Mobile Wallet' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('a pasted Zagros address shows a HEZ balance', async ({ page }) => {
  await pasteAndOpen(page, SMOKE_ADDRESS!);
});

test('a pasted Polkadot-prefix address of the same account works in a real browser', async ({ page }) => {
  expect(POLKADOT_FORM).not.toBe(SMOKE_ADDRESS);
  await pasteAndOpen(page, POLKADOT_FORM);
});

test('mobile viewport has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: 'Network' })).toBeVisible();
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(360);
});

test('Sorani is right-to-left with no horizontal scroll at 360px', async ({ page }) => {
  await useLanguage(page, 'ckb');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: 'تۆڕ' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(360);
});
