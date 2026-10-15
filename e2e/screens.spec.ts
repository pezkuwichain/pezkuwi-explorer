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
      await page.getByRole('button', { name: 'Rûyê paşîn nîşan bide' }).click();
      await page.waitForTimeout(900); // the turn takes .8 s
      await shot(page, 'citizenship-back', scheme);
      // A name typed on this device appears on the card (and in its MRZ) and stays in this browser.
      await page.getByRole('button', { name: 'Rûyê pêşîn nîşan bide' }).click();
      await page.getByRole('button', { name: /Wêne û nav/ }).click();
      await page.getByLabel('Nav', { exact: true }).fill('Rêber');
      await page.getByLabel('Paşnav').fill('Çiyayî');
      await page.getByRole('button', { name: 'Tomar bike' }).click();
      await page.waitForTimeout(900);
      await shot(page, 'citizenship-named', scheme);
      expect(blocked).toEqual([]);
    });

    test('network', async ({ page }) => {
      const blocked = await setUp(page, { account: false });
      await page.goto('/network');
      await settled(page);
      await shot(page, 'network', scheme);
      expect(blocked).toEqual([]);
    });

    test('home, account, network and citizenship right to left (Sorani)', async ({ page }) => {
      const blocked = await setUp(page, { account: true, lang: 'ckb' });
      await page.goto('/');
      await settled(page);
      await shot(page, 'home-ckb', scheme);
      await page.goto('/account');
      await settled(page);
      await shot(page, 'account-ckb', scheme);
      await page.goto('/network');
      await settled(page);
      await shot(page, 'network-ckb', scheme);
      await page.goto('/citizenship');
      await settled(page);
      await shot(page, 'citizenship-ckb', scheme);
      // The card's header line fits in Sorani too: the Sorani title ends before the chip, the chip inside the card.
      const ckbTitle = (await page.locator('.cid-front .cid-title-ckb').boundingBox())!;
      const chip = (await page.locator('.cid-front .cid-chip').boundingBox())!;
      const card = (await page.locator('.cid-front').boundingBox())!;
      expect(ckbTitle.x + ckbTitle.width).toBeLessThanOrEqual(chip.x + 0.5);
      expect(chip.x + chip.width).toBeLessThanOrEqual(card.x + card.width);
      await page.locator('.cid-flip').click();
      await page.waitForTimeout(900);
      await shot(page, 'citizenship-back-ckb', scheme);
      // Figure and unit of each stat stay on one line.
      for (const v of await page.locator('.stat-value').all()) expect((await v.boundingBox())!.height).toBeLessThan(40);
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

// Desktop (approved layout E): the app in a phone frame with the mascots around it, at two window sizes.
for (const scheme of ['dark', 'light'] as const) {
  test.describe(`desktop, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme, deviceScaleFactor: 1 });
    for (const [w, h] of [[1440, 960], [1180, 800]] as const) {
      test(`${w}×${h}: frame, mascots, tab bar inside the frame`, async ({ page }) => {
        const blocked = await setUp(page, { account: true });
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        await settled(page);
        await expect(page.locator('.mascot img').first()).toBeVisible();
        await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.mascot img')].filter((i) => i.offsetParent).every((i) => i.complete));
        const frame = (await page.locator('.phone-screen').boundingBox())!;
        const tabs = (await page.locator('.tabbar').boundingBox())!;
        expect(tabs.x).toBeGreaterThanOrEqual(frame.x - 1);
        expect(tabs.x + tabs.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
        expect(tabs.y + tabs.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
        expect(tabs.y).toBeGreaterThan(frame.y + frame.height / 2);
        // No visible mascot card overlaps the phone.
        for (const m of await page.locator('.mascot').all()) {
          const b = await m.boundingBox();
          if (!b) continue;
          expect(b.x + b.width <= (await page.locator('.phone').boundingBox())!.x + 1 || b.x >= (await page.locator('.phone').boundingBox())!.x + (await page.locator('.phone').boundingBox())!.width - 1).toBe(true);
        }
        await page.screenshot({ path: `test-results/screens/desktop-${w}x${h}-${scheme}.png` });
        expect(blocked).toEqual([]);
      });
    }
    test('1440×960 right to left (Sorani): the mascot sides mirror', async ({ page }) => {
      await setUp(page, { account: true, lang: 'ckb' });
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto('/');
      await settled(page);
      const start = (await page.locator('.desk-start').boundingBox())!;
      expect(start.x).toBeGreaterThan(720);
      await page.screenshot({ path: `test-results/screens/desktop-1440x960-ckb-${scheme}.png` });
    });
  });
}

test('at phone width there is no frame and no mascot picture is requested', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/mascots/')) asked.push(r.url()); });
  await setUp(page, { account: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.phone')).toHaveCount(0);
  expect(asked).toEqual([]);
  await page.screenshot({ path: 'test-results/screens/phone-width-proof.png' });
});
