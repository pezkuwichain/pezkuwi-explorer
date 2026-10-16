import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// i-Wallet end to end against the built site, in Chromium and WebKit (Safari's engine): the real IndexedDB path,
// the real crypto WASM, the production CSP. Nothing here signs or submits; balances may fail to load (the flow
// does not depend on them).

// The production CSP from the nginx config, as deployed except for upgrade-insecure-requests, which would turn
// the http preview origin's own requests into https. A blocked WASM instance or socket shows up as a CSP console
// message and fails the test.
const CSP = (/Content-Security-Policy "([^"]+)"/.exec(readFileSync('deploy/nginx-explorer.conf', 'utf8')) ?? [])[1]!
  .replace('; upgrade-insecure-requests', '');
const PASSWORD = 'e2e-Password-2026';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

// WebKit logs one "Refused to apply a stylesheet" message under this CSP. Its cause, measured with a
// securitypolicyviolation listener: directive style-src-attr, target a <select> (the language picker). WebKit's own
// built-in shadow tree for <select> sets a style attribute that it then checks against the page CSP; app code sets no
// inline style. Nothing is unstyled (screenshots with and without the CSP are identical), and on iOS the select renders
// as the native menu control. So exactly that violation, and only when it was recorded, is not a failure; any other
// CSP message still fails WebKit.
const WEBKIT_SELECT_NOISE = /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear/;

async function setUp(page: Page) {
  await page.addInitScript(() => localStorage.setItem('pezkuwi-explorer:lang', 'en'));
  await page.route((url) => url.hostname === 'localhost' && !/\.[a-z0-9]+$/i.test(url.pathname), async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
  });
  // Every CSP violation the page sees (across reloads), with the element it hit.
  const violations: Array<{ directive: string; target: string }> = [];
  let selects = 0;
  await page.exposeFunction('__cspReport', (directive: string, target: string) => { violations.push({ directive, target }); });
  await page.exposeFunction('__selectCreated', () => { selects++; });
  await page.addInitScript(() => {
    // Count every <select> the page creates: each one makes WebKit report its built-in style attribute once.
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (this: Document, tag: string, options?: ElementCreationOptions) {
      if (String(tag).toLowerCase() === 'select') void (window as unknown as { __selectCreated: () => Promise<void> }).__selectCreated();
      return create.call(this, tag, options);
    } as typeof Document.prototype.createElement;
    document.addEventListener('securitypolicyviolation', (e) => {
      const report = (window as unknown as { __cspReport: (d: string, t: string) => Promise<void> }).__cspReport;
      void report(e.violatedDirective, (e.target as Element | null)?.nodeName ?? '');
    }, true);
  });
  const messages: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|wasm-crypto|Refused to/i.test(m.text())) messages.push(m.text()); });
  page.on('pageerror', (e) => messages.push(String(e)));
  // Read at the end of the test. The select-internals message is dropped only when every violation recorded is
  // style-src-attr on a <select> (the target reads #document while the select is not yet attached) and there are no
  // more of them than <select> elements created; then at most that many messages are dropped.
  return async (): Promise<string[]> => {
    await page.waitForTimeout(100); // let the last reports arrive
    const selectOnly = violations.every((v) => v.directive === 'style-src-attr' && (v.target === 'SELECT' || v.target === '#document'))
      && violations.length <= selects;
    let allowance = selectOnly ? violations.length : 0;
    return messages.filter((m) => !(allowance > 0 && WEBKIT_SELECT_NOISE.test(m) && allowance-- > 0));
  };
}

test('create a wallet, prove the backup, lock on reload and unlock with the password', async ({ page }) => {
  const problems = await setUp(page);
  await page.goto('/');

  // The fifth tab opens the landing page.
  const tabs = page.getByRole('navigation', { name: 'Sections' }).getByRole('link');
  await expect(tabs).toHaveCount(5);
  await tabs.nth(4).click();
  await expect(page).toHaveURL(/\/i-wallet$/);
  await expect(page.getByRole('link', { name: 'Get an i-Wallet' })).toBeVisible();

  // Step 1: the twelve words.
  await page.getByRole('link', { name: 'Get an i-Wallet' }).click();
  const items = page.getByRole('list', { name: 'Backup words' }).getByRole('listitem');
  await expect(items).toHaveCount(12);
  const words = (await items.allTextContents()).map((t) => t.replace(/^\d+/, '').trim());
  expect(words.every((w) => /^[a-z]+$/.test(w))).toBe(true);
  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();
  await page.getByRole('checkbox').check();
  await next.click();

  // Step 2: the quiz asks for words 3, 7 and 11 and refuses a wrong one.
  const verify = page.getByRole('button', { name: 'Verify', exact: true });
  await expect(verify).toBeDisabled();
  const slots = [3, 7, 11];
  const group = (n: number) => page.getByRole('group', { name: `Word ${n}` });
  const wrongOption = (await group(3).getByRole('button').allTextContents()).find((w) => w !== words[2])!;
  await group(3).getByRole('button', { name: wrongOption, exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Wrong word' })).toBeVisible();
  // One wrong pick keeps Verify closed even with the other two right.
  await group(7).getByRole('button', { name: words[6], exact: true }).click();
  await group(11).getByRole('button', { name: words[10], exact: true }).click();
  await expect(verify).toBeDisabled();
  for (const n of slots) await group(n).getByRole('button', { name: words[n - 1], exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Wrong word' })).toHaveCount(0);
  await expect(verify).toBeEnabled();
  await verify.click();

  // Step 3: the password creates the wallet in the real IndexedDB.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Type the password again').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create the wallet' }).click();
  // Face ID is not offered here (no platform authenticator), so the wallet opens straight on its home.
  await expect(page.getByRole('heading', { name: 'Your i-Wallet' })).toBeVisible({ timeout: 30_000 });

  // Home shows the address (balances may or may not load: not awaited).
  const addr = page.locator('.iw-addr-text').first();
  const full = await addr.getAttribute('title');
  expect(full).toMatch(/^[1-9A-HJ-NP-Za-km-z]{47,48}$/);
  await expect(addr).toContainText(full!.slice(0, 6));

  // A reload drops the unlocked state: the wallet is locked, and the password opens the same wallet.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'i-Wallet is locked' })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Password', { exact: true }).fill('not-the-password-1');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('alert')).toContainText('Wrong password');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Your i-Wallet' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.iw-addr-text').first()).toHaveAttribute('title', full!);

  expect(await problems()).toEqual([]);
});
