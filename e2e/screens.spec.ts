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

// Zagros unless a test asks for mainnet: the fixtures and ME are Zagros (a first visit would read mainnet).
async function setUp(page: Page, opts: { account: boolean; lang?: string; network?: 'zagros' | 'mainnet' }) {
  await page.addInitScript(([account, me, lang, network]) => {
    localStorage.setItem('pezkuwi-explorer:lang', lang);
    localStorage.setItem('pezkuwi-explorer:network', network);
    if (account) localStorage.setItem('pezkuwi-explorer:account', me);
    else localStorage.removeItem('pezkuwi-explorer:account');
  }, [opts.account, ME, opts.lang ?? 'kmr', opts.network ?? 'zagros'] as const);
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

// The card's text never collides or gets cut: title, Sorani title and status chip have pairwise disjoint boxes
// inside the card, and the subtitle is whole on one line (no overflow, no ellipsis).
async function checkCardText(page: Page) {
  const box = async (sel: string) => page.locator(`.cid-front ${sel}`).boundingBox();
  const card = (await page.locator('.cid-front').boundingBox())!;
  const boxes = (await Promise.all(['.cid-title', '.cid-title-ckb', '.cid-chip', '.cid-sub'].map(box))).filter((b) => b !== null);
  expect(boxes.length).toBeGreaterThanOrEqual(3);
  const apart = (a: NonNullable<(typeof boxes)[number]>, b: NonNullable<(typeof boxes)[number]>) =>
    a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    expect(b.x >= card.x - 0.5 && b.x + b.width <= card.x + card.width + 0.5).toBe(true);
    for (let j = i + 1; j < boxes.length; j++) expect(apart(b, boxes[j]!)).toBe(true);
  }
  const sub = page.locator('.cid-front .cid-sub');
  expect(await sub.evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis')).toBe(true);
  const head = page.locator('.cid-front .cid-titles');
  expect(await head.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
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
      await checkCardText(page);
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

    test('network on mainnet, and the confirm before switching to the testnet', async ({ page }) => {
      const blocked = await setUp(page, { account: false, network: 'mainnet' });
      await page.goto('/network');
      await settled(page);
      await expect(page.locator('.page-header .net-chip-mainnet')).toBeVisible();
      await shot(page, 'network-mainnet', scheme);
      await page.getByRole('radio', { name: /Zagros/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'network-switch-confirm', scheme);
      expect(blocked).toEqual([]);
    });

    test('home on mainnet: the network chip in the brand header', async ({ page }) => {
      const blocked = await setUp(page, { account: false, network: 'mainnet' });
      await page.goto('/');
      await settled(page);
      await shot(page, 'home-mainnet', scheme);
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
      await checkCardText(page);
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

// i-Wallet: landing, the create steps, unlock, home, send and citizen at 390×844, and the five-tab bar at 360×780,
// in Kurmanji and Turkish, dark and light. The wallet is created through the real UI (real IndexedDB, real WASM) in
// the browser context; chain reads are live mainnet and may be slow or fail, so each screen is shot after a bounded
// wait. Language-independent selectors keep one script for both languages. Nothing signs or sends.
for (const lang of ['kmr', 'tr'] as const) {
  for (const scheme of ['dark', 'light'] as const) {
    test.describe(`i-Wallet ${lang}, ${scheme} theme`, () => {
      test.use({ colorScheme: scheme });

      test('landing, create steps, unlock, home, send, citizen', async ({ page }) => {
        const blocked = await setUp(page, { account: false, lang });
        const name = (n: string) => `iwallet-${n}-${lang}`;
        await page.goto('/i-wallet');
        await expect(page.locator('a.iw-hero-primary')).toBeVisible({ timeout: 30_000 });
        await shot(page, name('landing'), scheme);

        await page.locator('a.iw-hero-primary').click();
        const words = (await page.locator('.iw-words li span:nth-child(2)').allTextContents()).map((w) => w.trim());
        expect(words).toHaveLength(12);
        await shot(page, name('create-1-words'), scheme);
        await page.locator('.iw-check input[type=checkbox]').check();
        await page.locator('button.iw-primary').click();

        // Step 2: one wrong pick first (the error state), then the right words.
        const quiz = page.locator('.iw-quiz');
        await expect(quiz).toHaveCount(3);
        const first = await quiz.nth(0).locator('.iw-opt').allTextContents();
        await quiz.nth(0).locator('.iw-opt', { hasText: new RegExp(`^${first.find((w) => w !== words[2])}$`) }).click();
        await shot(page, name('create-2-quiz-wrong'), scheme);
        for (const [slot, idx] of [[0, 2], [1, 6], [2, 10]] as const) {
          await quiz.nth(slot).locator('.iw-opt', { hasText: new RegExp(`^${words[idx]}$`) }).click();
        }
        await shot(page, name('create-2-quiz-right'), scheme);
        await page.locator('button.iw-primary').click();

        // Step 3: the password.
        const pw = page.locator('input[type=password]');
        await pw.nth(0).fill('Screens-pass-2026');
        await pw.nth(1).fill('Screens-pass-2026');
        await shot(page, name('create-3-password'), scheme);
        await page.locator('button.iw-primary[type=submit]').click();
        await expect(page.locator('.iw-addr-text').first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(4_000); // let the balances settle or fail
        await shot(page, name('home'), scheme);

        // The unlocked pages by in-app navigation (a reload would lock the wallet).
        await page.locator('a.iw-act[href="/i-wallet/send"]').click();
        await page.locator('button.iw-pick').first().click(); // HEZ
        await page.waitForTimeout(2_500);
        await shot(page, name('send-network'), scheme);
        await page.locator('button.iw-pick').nth(1).click(); // Asset Hub
        await expect(page.locator('#iw-send-to')).toBeVisible();
        await page.waitForTimeout(2_500);
        await shot(page, name('send'), scheme);
        await page.goBack();
        await page.locator('a.iw-act[href="/i-wallet/citizen"]').click();
        await page.waitForTimeout(6_000);
        await shot(page, name('citizen'), scheme);

        // Locked: a reload drops the unlocked state.
        await page.goto('/i-wallet');
        await expect(page.locator('input[type=password]')).toBeVisible({ timeout: 30_000 });
        await shot(page, name('unlock'), scheme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        expect(blocked.filter((m) => !/Refused to apply a stylesheet/.test(m))).toEqual([]);
      });

      test('tab bar at 360×780: no label is cut off', async ({ page }) => {
        const blocked = await setUp(page, { account: false, lang });
        await page.setViewportSize({ width: 360, height: 780 });
        await page.goto('/');
        await expect(page.locator('nav.tabbar .tab')).toHaveCount(5);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        // A label is whole when its text fits its box with no overflow at all (an overflow of under a pixel already
        // draws the ellipsis, so there is no tolerance).
        // Every tab in turn is the active (bold, widest) one.
        const cut: { text: string | null; clipped: boolean; lines: number }[] = [];
        for (const href of ['/', '/account', '/citizenship', '/network', '/i-wallet']) {
          await page.locator(`nav.tabbar a[href="${href}"]`).click();
          await page.evaluate(() => document.fonts.ready);
          cut.push(...await page.locator('nav.tabbar .tab span').evaluateAll((els) => els.map((e) => ({
            text: e.textContent, clipped: e.scrollWidth > e.clientWidth, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
          }))));
        }
        console.log(`tabs ${lang} ${scheme}: ${JSON.stringify(cut)}`);
        await page.locator('nav.tabbar').screenshot({ path: `test-results/screens/tabbar-360-${lang}-${scheme}.png` });
        await page.screenshot({ path: `test-results/screens/tabbar-360-page-${lang}-${scheme}.png` });
        expect(cut.filter((c) => c.clipped)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
        expect(blocked.filter((m) => !/Refused to apply a stylesheet/.test(m))).toEqual([]);
      });
    });
  }
}

// Privacy and terms pages and the footer at 360 and 390 px, dark and light, left to right (Kurmanji, English) and right
// to left (Sorani, Persian, Arabic). The footer is checked at the bottom of the page: every link a 44 px target, nothing under the
// fixed tab bar (the experts link included), no horizontal scroll.
for (const scheme of ['dark', 'light'] as const) {
  test.describe(`legal pages and footer, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const width of [360, 390] as const) {
      for (const lang of ['kmr', 'en', 'ckb', 'fa', 'ar'] as const) {
        test(`${width} px ${lang}: privacy, terms, footer, i-Wallet landing`, async ({ page }) => {
          const blocked = await setUp(page, { account: false, lang });
          await page.setViewportSize({ width, height: 800 });
          const name = (n: string) => `legal-${n}-${lang}-${width}`;
          const footerClear = async () => {
            await page.locator('footer.site-foot').scrollIntoViewIfNeeded();
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            const foot = (await page.locator('footer.site-foot').boundingBox())!;
            const tabs = (await page.locator('nav.tabbar').boundingBox())!;
            expect(foot.y + foot.height).toBeLessThanOrEqual(tabs.y + 0.5);
            for (const a of await page.locator('footer.site-foot > a, footer.site-foot .foot-legal a, footer.site-foot .foot-social a').all()) {
              const b = (await a.boundingBox())!;
              expect(b.width).toBeGreaterThanOrEqual(44);
              expect(b.height).toBeGreaterThanOrEqual(44);
            }
            expect(await page.locator('footer.site-foot .foot-social a').count()).toBe(5);
            const own = (await page.locator('footer.site-foot').boundingBox())!;
            expect(own.x).toBeGreaterThanOrEqual(-0.5);
            expect(own.x + own.width).toBeLessThanOrEqual(width + 0.5);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          };
          for (const kind of ['privacy', 'terms'] as const) {
            await page.goto(`/${kind}`);
            await expect(page.locator('article.legal h2').first()).toBeVisible({ timeout: 30_000 });
            expect(await page.evaluate(() => document.documentElement.dir)).toBe(['ckb', 'fa', 'ar'].includes(lang) ? 'rtl' : 'ltr');
            await shot(page, name(kind), scheme);
            await footerClear();
            await shot(page, name(`${kind}-end`), scheme);
          }
          await page.goto('/network');
          await settled(page);
          await footerClear();
          // The stat tiles: figure and unit never run out of their tile (the unit wraps under a long figure instead).
          for (const v of await page.locator('.stat-value').all()) {
            expect(await v.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
          }
          await shot(page, name('network-footer'), scheme);
          await page.goto('/i-wallet');
          await expect(page.locator('a.iw-hero-primary')).toBeVisible({ timeout: 30_000 });
          await expect(page.locator('.iw-hero .accept-line a')).toHaveCount(2);
          await page.locator('.iw-hero .accept-line').scrollIntoViewIfNeeded();
          await shot(page, name('iwallet-landing'), scheme);
          await footerClear();
          await shot(page, name('iwallet-landing-end'), scheme);
          expect(blocked.filter((m) => !/Refused to apply a stylesheet/.test(m))).toEqual([]);
        });
      }
    }
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
