import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  createKeystore: vi.fn(), sealWords: vi.fn(), storeWalletAtomic: vi.fn(), requestPersistence: vi.fn(), enrolFaceId: vi.fn(),
  work: [] as string[],
}));
vi.mock('./keystore', () => ({
  createKeystore: m.createKeystore, sealWords: m.sealWords, storeWalletAtomic: m.storeWalletAtomic, requestPersistence: m.requestPersistence,
}));
// Records whether each step ran under the overlay.
vi.mock('./progress', () => ({
  withKeyProgress: async (reason: string, work: () => Promise<unknown>) => {
    m.work.push(`start:${reason}`);
    try { return await work(); } finally { m.work.push(`end:${reason}`); }
  },
}));
vi.mock('./faceid', () => ({ enrolFaceId: m.enrolFaceId }));
import { NotSavedError, enableFaceId, saveWallet } from './saveWallet';

describe('saveWallet', () => {
  beforeEach(() => {
    [m.createKeystore, m.sealWords, m.storeWalletAtomic, m.requestPersistence, m.enrolFaceId].forEach((f) => f.mockReset());
    m.work = [];
    m.createKeystore.mockImplementation(() => { m.work.push('keystore'); return Promise.resolve({ address: 'a', json: { address: 'a' } }); });
    m.sealWords.mockImplementation(() => { m.work.push('seal'); return Promise.resolve('sealed'); });
    m.storeWalletAtomic.mockImplementation(() => { m.work.push('store'); return Promise.resolve(true); });
    m.requestPersistence.mockResolvedValue(true);
  });

  it('saves keystore and words in one call, then asks for persistence; no decrypted pair is returned', async () => {
    const r = await saveWallet('w w', 'pw123456', { replacing: false });
    expect(m.sealWords).toHaveBeenCalledWith('w w', 'pw123456');
    expect(m.storeWalletAtomic).toHaveBeenCalledWith({ address: 'a' }, 'sealed', false);
    expect(m.requestPersistence).toHaveBeenCalled();
    expect(r).toEqual({ json: { address: 'a' } });
  });

  it('passes the replace flag so the old Face ID record goes in the same transaction', async () => {
    await saveWallet('w w', 'pw123456', { replacing: true });
    expect(m.storeWalletAtomic).toHaveBeenCalledWith({ address: 'a' }, 'sealed', true);
  });

  it('a failed save throws NotSavedError and goes no further', async () => {
    m.storeWalletAtomic.mockResolvedValue(false);
    await expect(saveWallet('w w', 'pw123456', { replacing: true })).rejects.toBeInstanceOf(NotSavedError);
    expect(m.requestPersistence).not.toHaveBeenCalled();
  });
});

describe('saveWallet progress', () => {
  it('shows the "saving" overlay for the two scrypt steps only; the IndexedDB write runs after it', async () => {
    m.createKeystore.mockImplementation(() => { m.work.push('keystore'); return Promise.resolve({ address: 'a', json: { address: 'a' } }); });
    m.sealWords.mockImplementation(() => { m.work.push('seal'); return Promise.resolve('sealed'); });
    m.storeWalletAtomic.mockImplementation(() => { m.work.push('store'); return Promise.resolve(true); });
    m.requestPersistence.mockResolvedValue(true);
    m.work = [];
    await saveWallet('w w', 'pw123456', { replacing: false });
    expect(m.work).toEqual(['start:save', 'keystore', 'seal', 'end:save', 'store']);
  });

  it('a failed sealing is a NotSavedError and stores nothing', async () => {
    m.sealWords.mockRejectedValueOnce(new Error('scrypt'));
    m.storeWalletAtomic.mockReset();
    await expect(saveWallet('w w', 'pw123456', { replacing: false })).rejects.toBeInstanceOf(NotSavedError);
    expect(m.storeWalletAtomic).not.toHaveBeenCalled();
  });
});

describe('enableFaceId', () => {
  it('maps each enrolment result to a note', async () => {
    m.enrolFaceId.mockResolvedValueOnce({ ok: true });
    expect(await enableFaceId('p')).toEqual({ ok: true });
    m.enrolFaceId.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    expect(await enableFaceId('p')).toEqual({ ok: false, note: 'iwallet.faceid.cancelled', retry: true });
    m.enrolFaceId.mockResolvedValueOnce({ ok: false, reason: 'unsupported' });
    expect(await enableFaceId('p')).toEqual({ ok: false, note: 'iwallet.faceid.unavailable', retry: false });
    m.enrolFaceId.mockResolvedValueOnce({ ok: false, reason: 'storage' });
    expect(await enableFaceId('p')).toEqual({ ok: false, note: 'iwallet.faceid.storage', retry: false });
  });
});
