// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KvStore } from './idb';
import { SALT, enrolFaceId, faceIdSupported, forgetFaceId, hasFaceId, unlockWithFaceId } from './faceid';

const mapStore = (): KvStore & { data: Map<string, unknown> } => {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => { data.set(k, v); },
    delete: async (k) => { data.delete(k); },
    deleteMany: async (ks) => { for (const k of ks) data.delete(k); },
    setMany: async (e, rm = []) => { for (const [k, v] of Object.entries(e)) data.set(k, v); for (const k of rm) data.delete(k); },
  };
};
const PW = 'correct horse battery';
const PRF = new Uint8Array(32).map((_, i) => i + 1);
const RAW_ID = new Uint8Array([9, 8, 7, 6]).buffer;

const cred = (prf?: Uint8Array) => ({
  rawId: RAW_ID,
  getClientExtensionResults: () => (prf ? { prf: { results: { first: prf.buffer } } } : { prf: { enabled: true } }),
});

function stubWeb(opts: { createPrf?: Uint8Array; getPrf?: Uint8Array; getReject?: boolean }) {
  const create = vi.fn(async () => cred(opts.createPrf));
  const get = vi.fn(async () => {
    if (opts.getReject) throw new DOMException('cancelled', 'NotAllowedError');
    return cred(opts.getPrf);
  });
  vi.stubGlobal('navigator', { credentials: { create, get } });
  vi.stubGlobal('location', { hostname: 'explorer.pezkuwichain.io' });
  return { create, get };
}

afterEach(() => vi.unstubAllGlobals());

describe('SALT', () => {
  it('is sha256 of the versioned label', async () => {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pezkuwi-iwallet-faceid-v1')));
    expect(SALT).toHaveLength(32);
    expect(Array.from(SALT)).toEqual(Array.from(h));
  });
});

describe('faceIdSupported', () => {
  it('is false without PublicKeyCredential', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined);
    expect(await faceIdSupported(mapStore())).toBe(false);
  });
  it('is false without a platform authenticator', async () => {
    vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => false });
    expect(await faceIdSupported(mapStore())).toBe(false);
  });
  it('is optimistic when getClientCapabilities is absent', async () => {
    vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
    expect(await faceIdSupported(mapStore())).toBe(true);
  });
  it('follows extension:prf when capabilities exist', async () => {
    const mk = (prf: boolean) => ({
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => ({ 'extension:prf': prf }),
    });
    vi.stubGlobal('PublicKeyCredential', mk(false));
    expect(await faceIdSupported(mapStore())).toBe(false);
    vi.stubGlobal('PublicKeyCredential', mk(true));
    expect(await faceIdSupported(mapStore())).toBe(true);
  });
});

describe('enrol and unlock', () => {
  it('enrol without any PRF output returns false and stores nothing', async () => {
    const { get } = stubWeb({});
    const store = mapStore();
    expect(await enrolFaceId(PW, store)).toEqual({ ok: false, reason: 'unsupported' });
    expect(get).toHaveBeenCalledOnce(); // the Safari fallback was tried
    expect(store.data.has('faceid')).toBe(false);
    expect(store.data.get('faceid-unsupported')).toBe(true);
    vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
    expect(await faceIdSupported(store)).toBe(false); // the switch disappears on this device
  });
  it('round-trips the password when create returns PRF', async () => {
    const { create, get } = stubWeb({ createPrf: PRF, getPrf: PRF });
    const store = mapStore();
    expect(await enrolFaceId(PW, store)).toEqual({ ok: true });
    expect(get).not.toHaveBeenCalled();
    const pk = (create.mock.calls[0] as unknown as [{ publicKey: Record<string, unknown> }])[0].publicKey;
    expect(pk.authenticatorSelection).toEqual({ authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' });
    expect(pk.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }]);
    expect(await hasFaceId(store)).toBe(true);
    const stored = JSON.stringify(store.data.get('faceid'));
    expect(stored).not.toContain(PW);
    expect(Object.keys(store.data.get('faceid') as object).sort()).toEqual(['ciphertext', 'credentialId', 'iv']);
    expect(await unlockWithFaceId(store)).toBe(PW);
  });
  it('gets the PRF from get() when create omits it (Safari)', async () => {
    const { get } = stubWeb({ getPrf: PRF });
    const store = mapStore();
    expect(await enrolFaceId(PW, store)).toEqual({ ok: true });
    expect(get).toHaveBeenCalledOnce();
    expect(await unlockWithFaceId(store)).toBe(PW);
  });
  it('a cancelled get() unlocks to null', async () => {
    stubWeb({ createPrf: PRF });
    const store = mapStore();
    await enrolFaceId(PW, store);
    stubWeb({ getReject: true });
    expect(await unlockWithFaceId(store)).toBeNull();
  });
  it('a different PRF output cannot decrypt', async () => {
    stubWeb({ createPrf: PRF });
    const store = mapStore();
    await enrolFaceId(PW, store);
    stubWeb({ getPrf: new Uint8Array(32).fill(5) });
    expect(await unlockWithFaceId(store)).toBeNull();
  });
  it('create cancelled or aborted reports cancelled and stores nothing', async () => {
    for (const name of ['NotAllowedError', 'AbortError']) {
      const { create } = stubWeb({});
      create.mockRejectedValueOnce(new DOMException('x', name));
      const store = mapStore();
      expect(await enrolFaceId(PW, store)).toEqual({ ok: false, reason: 'cancelled' });
      expect(store.data.size).toBe(0);
    }
  });
  it('a failing store.set reports storage', async () => {
    stubWeb({ createPrf: PRF });
    const store = mapStore();
    store.set = async () => { throw new Error('quota'); };
    expect(await enrolFaceId(PW, store)).toEqual({ ok: false, reason: 'storage' });
  });
  it('rejects a PRF output that is not 32 bytes', async () => {
    stubWeb({ createPrf: new Uint8Array(16).fill(3), getPrf: new Uint8Array(24).fill(3) });
    const store = mapStore();
    expect(await enrolFaceId(PW, store)).toEqual({ ok: false, reason: 'unsupported' });
    expect(store.data.has('faceid')).toBe(false);
  });
  it('sends the right WebAuthn arguments on create and get, with a fresh IV each time', async () => {
    const { create, get } = stubWeb({ createPrf: PRF, getPrf: PRF });
    const s1 = mapStore(); const s2 = mapStore();
    await enrolFaceId(PW, s1); await enrolFaceId(PW, s2);
    const cpk = (create.mock.calls[0] as unknown as [{ publicKey: any }])[0].publicKey;
    expect(cpk.rp.id).toBe('explorer.pezkuwichain.io');
    expect(cpk.user.id).toHaveLength(16);
    expect(cpk.authenticatorSelection.userVerification).toBe('required');
    expect(Array.from(cpk.extensions.prf.eval.first)).toEqual(Array.from(SALT));
    expect((s1.data.get('faceid') as any).iv).not.toBe((s2.data.get('faceid') as any).iv);
    await unlockWithFaceId(s1);
    const gpk = (get.mock.calls[0] as unknown as [{ publicKey: any }])[0].publicKey;
    expect(gpk.userVerification).toBe('required');
    expect(gpk.allowCredentials).toHaveLength(1);
    expect(Array.from(gpk.allowCredentials[0].id)).toEqual(Array.from(new Uint8Array(RAW_ID)));
    expect(gpk.allowCredentials[0].transports).toEqual(['internal']);
    expect(Array.from(gpk.extensions.prf.eval.first)).toEqual(Array.from(SALT));
  });
  it('forget reports false when the store fails', async () => {
    const store = mapStore();
    store.delete = async () => { throw new Error('x'); };
    expect(await forgetFaceId(store)).toBe(false);
  });
  it('unlock with nothing enrolled is null; forget removes the record', async () => {
    stubWeb({ createPrf: PRF, getPrf: PRF });
    const store = mapStore();
    expect(await unlockWithFaceId(store)).toBeNull();
    await enrolFaceId(PW, store);
    expect(await forgetFaceId(store)).toBe(true);
    expect(await hasFaceId(store)).toBe(false);
    expect(await unlockWithFaceId(store)).toBeNull();
  });
});
