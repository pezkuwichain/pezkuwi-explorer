import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Visual pass: each screen at 390×844, dark (mockup direction A) and light (direction B), in Kurmanji as the
// mockup is. Chain reads are live Zagros; the history indexer is answered from the fixtures below. Writes
// test-results/screens/<screen>-<theme>.png. Reads only; nothing here signs or sends.

const ME = process.env.SMOKE_ADDRESS ?? '5F3ydAf91e1kcSW5NWXgBamHowmJbjSz8b1Gvd41MyzLCNpd';
const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const CODE = '0x9a3f' + 'c41e'.repeat(15);
const HISTORY = 'https://explorer.pezkuwichain.io/history/assethub';

// The production CSP from the nginx config, with the indexer's origin added to connect-src: the preview runs
// on localhost, so the same-origin history endpoint is cross-origin here. Everything else is as deployed,
// so a blocked font, image or inline style shows up as a console error and fails the pass.
const CSP = (/Content-Security-Policy "([^"]+)"/.exec(readFileSync('deploy/nginx-explorer.conf', 'utf8')) ?? [])[1]!
  .replace("connect-src 'self'", "connect-src 'self' https://explorer.pezkuwichain.io");

const ago = (s: number) => String(Math.floor(Date.now() / 1000) - s);
const node = (id: string, ts: string, t: object | null, asset: object | null = null) =>
  ({ id, extrinsicHash: CODE, timestamp: ts, address: ME, transfer: t, assetTransfer: asset, extrinsic: null });
const ACTIVITY = [
  node('900-2-to', ago(2 * 3600), { from: ALICE, to: ME, amount: '2000000000000', fee: '1200000000', success: true }),
  node('880-4-from', ago(5 * 3600), null, { assetId: 1000, from: ME, to: BOB, amount: '20000000', fee: '1200000000', success: true }),
  node('700-1-from', ago(26 * 3600), { from: ME, to: BOB, amount: '5000000000000', fee: '1200000000', success: false }),
];
const PAYMENT = [node('900-2-from', ago(2 * 3600), { from: ALICE, to: BOB, amount: '2000000000000', fee: '1200000000', success: true })];

async function setUp(page: Page, opts: { account: boolean; lang?: string }) {
  await page.addInitScript(([account, me, lang]) => {
    localStorage.setItem('pezkuwi-explorer:lang', lang);
    if (account) localStorage.setItem('pezkuwi-explorer:account', me);
    else localStorage.removeItem('pezkuwi-explorer:account');
  }, [opts.account, ME, opts.lang ?? 'kmr'] as const);
  await page.route(HISTORY, async (route) => {
    const q = JSON.parse(route.request().postData() ?? '{}').query as string;
    const nodes = q.includes('extrinsicHash:{') ? PAYMENT : ACTIVITY;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ data: { historyElements: { nodes } } }) });
  });
  await page.route((url) => url.hostname === 'localhost' && !/\.[a-z0-9]+$/i.test(url.pathname), async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
  });
  const blocked: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) blocked.push(m.text()); });
  return blocked;
}

const shot = async (page: Page, name: string, scheme: string) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/screens/${name}-${scheme}.png` });
};
const settled = (page: Page) => expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 45_000 });

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('home without an account', async ({ page }) => {
      const blocked = await setUp(page, { account: false });
      await page.goto('/');
      await expect(page.getByRole('status')).not.toHaveText(/kontrol/, { timeout: 45_000 });
      await shot(page, 'home-open', scheme);
      expect(blocked).toEqual([]);
    });

    test('home with an account', async ({ page }) => {
      const blocked = await setUp(page, { account: true });
      await page.goto('/');
      await settled(page);
      await expect(page.getByRole('status')).not.toHaveText(/kontrol/, { timeout: 45_000 });
      await shot(page, 'home', scheme);
      expect(blocked).toEqual([]);
    });

    test('account', async ({ page }) => {
      const blocked = await setUp(page, { account: true });
      await page.goto('/account');
      await settled(page);
      await expect(page.getByText('Te wergirt')).toBeVisible();
      await shot(page, 'account', scheme);
      await page.getByRole('link', { name: /Te wergirt/ }).click();
      await expect(page.getByRole('heading', { name: 'Qediya' })).toBeVisible();
      await shot(page, 'activity-detail', scheme);
      expect(blocked).toEqual([]);
    });

    test('payment', async ({ page }) => {
      const blocked = await setUp(page, { account: true });
      await page.goto('/payment');
      await shot(page, 'payment-form', scheme);
      await page.getByPlaceholder('Koda dayînê an navnîşanekê bixe vir').fill(CODE);
      await page.getByRole('button', { name: 'Veke' }).click();
      await expect(page.getByRole('heading', { name: 'Gihîşt', exact: true })).toBeVisible();
      await shot(page, 'payment-arrived', scheme);
      expect(blocked).toEqual([]);
    });

    test('citizenship', async ({ page }) => {
      const blocked = await setUp(page, { account: true });
      await page.goto('/citizenship');
      await settled(page);
      await shot(page, 'citizenship', scheme);
      expect(blocked).toEqual([]);
    });

    test('network', async ({ page }) => {
      const blocked = await setUp(page, { account: false });
      await page.goto('/network');
      await settled(page);
      await shot(page, 'network', scheme);
      expect(blocked).toEqual([]);
    });

    test('home and account right to left (Sorani)', async ({ page }) => {
      const blocked = await setUp(page, { account: true, lang: 'ckb' });
      await page.goto('/');
      await settled(page);
      await shot(page, 'home-ckb', scheme);
      await page.goto('/account');
      await settled(page);
      await shot(page, 'account-ckb', scheme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      expect(blocked).toEqual([]);
    });

    test('open account', async ({ page }) => {
      const blocked = await setUp(page, { account: false });
      await page.goto('/account/open');
      await shot(page, 'open-account', scheme);
      expect(blocked).toEqual([]);
    });
  });
}
