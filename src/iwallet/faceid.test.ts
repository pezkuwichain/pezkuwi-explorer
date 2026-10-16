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
    expect(await faceIdSupported()).toBe(false);
  });
  it('is false without a platform authenticator', async () => {
    vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => false });
    expect(await faceIdSupported()).toBe(false);
  });
  it('is optimistic when getClientCapabilities is absent', async () => {
    vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
    expect(await faceIdSupported()).toBe(true);
  });
  it('follows extension:prf when capabilities exist', async () => {
    const mk = (prf: boolean) => ({
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => ({ 'extension:prf': prf }),
    });
    vi.stubGlobal('PublicKeyCredential', mk(false));
    expect(await faceIdSupported()).toBe(false);
    vi.stubGlobal('PublicKeyCredential', mk(true));
    expect(await faceIdSupported()).toBe(true);
  });
});

describe('enrol and unlock', () => {
  it('enrol without any PRF output returns false and stores nothing', async () => {
    const { get } = stubWeb({});
    const store = mapStore();
    expect(await enrolFaceId(PW, store)).toBe(false);
    expect(get).toHaveBeenCalledOnce(); // the Safari fallback was tried
    expect(store.data.size).toBe(0);
  });
  it('round-trips the password when create returns PRF', async () => {
    const { create, get } = stubWeb({ createPrf: PRF, getPrf: PRF });
    const store = mapStore();
    expect(await enrolFaceId(PW, store)).toBe(true);
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
    expect(await enrolFaceId(PW, store)).toBe(true);
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
  it('unlock with nothing enrolled is null; forget removes the record', async () => {
    stubWeb({ createPrf: PRF, getPrf: PRF });
    const store = mapStore();
    expect(await unlockWithFaceId(store)).toBeNull();
    await enrolFaceId(PW, store);
    await forgetFaceId(store);
    expect(await hasFaceId(store)).toBe(false);
    expect(await unlockWithFaceId(store)).toBeNull();
  });
});
