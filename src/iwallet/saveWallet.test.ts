import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  createKeystore: vi.fn(), saveWalletAtomic: vi.fn(), requestPersistence: vi.fn(), enrolFaceId: vi.fn(),
}));
vi.mock('./keystore', () => ({
  createKeystore: m.createKeystore, saveWalletAtomic: m.saveWalletAtomic, requestPersistence: m.requestPersistence,
}));
vi.mock('./faceid', () => ({ enrolFaceId: m.enrolFaceId }));
import { NotSavedError, enableFaceId, saveWallet } from './saveWallet';

describe('saveWallet', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.createKeystore.mockResolvedValue({ address: 'a', json: { address: 'a' } });
    m.saveWalletAtomic.mockResolvedValue(true);
    m.requestPersistence.mockResolvedValue(true);
  });

  it('saves keystore and words in one call, then asks for persistence; no decrypted pair is returned', async () => {
    const r = await saveWallet('w w', 'pw123456', { replacing: false });
    expect(m.saveWalletAtomic).toHaveBeenCalledWith({ address: 'a' }, 'w w', 'pw123456', false);
    expect(m.requestPersistence).toHaveBeenCalled();
    expect(r).toEqual({ json: { address: 'a' } });
  });

  it('passes the replace flag so the old Face ID record goes in the same transaction', async () => {
    await saveWallet('w w', 'pw123456', { replacing: true });
    expect(m.saveWalletAtomic).toHaveBeenCalledWith({ address: 'a' }, 'w w', 'pw123456', true);
  });

  it('a failed save throws NotSavedError and goes no further', async () => {
    m.saveWalletAtomic.mockResolvedValue(false);
    await expect(saveWallet('w w', 'pw123456', { replacing: true })).rejects.toBeInstanceOf(NotSavedError);
    expect(m.requestPersistence).not.toHaveBeenCalled();
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
