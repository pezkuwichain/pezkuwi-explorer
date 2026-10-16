// Optional biometric unlock (spec §4): the keystore password is wrapped with an AES-GCM key
// derived from the WebAuthn PRF extension output. Only { credentialId, iv, ciphertext } is
// stored; the password and the PRF output never touch storage or logs.
import { indexedDbStore, type KvStore } from './idb';

const FACEID_KEY = 'faceid';

// sha256('pezkuwi-iwallet-faceid-v1'), asserted equal to the runtime hash in the tests.
export const SALT: Uint8Array = Uint8Array.from(
  'c78226cdb8202f62816ee7fb57494bf93a5bf4a6d42b88ddbab0b3907dc5fe78'.match(/../g)!.map((h) => parseInt(h, 16)),
);

interface StoredFaceId { credentialId: string; iv: string; ciphertext: string }

const toB64u = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

interface PrfExt { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | ArrayBufferView } } }
const prfFirst = (cred: PublicKeyCredential | null): Uint8Array | null => {
  const first = (cred?.getClientExtensionResults() as PrfExt | undefined)?.prf?.results?.first;
  if (!first) return null;
  return first instanceof ArrayBuffer
    ? new Uint8Array(first)
    : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
};

const aesKey = (prf: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', prf as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

const prfEval = { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs;

export async function faceIdSupported(): Promise<boolean> {
  try {
    if (typeof PublicKeyCredential === 'undefined') return false;
    if (!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) return false;
    const caps = (PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    }).getClientCapabilities;
    if (typeof caps !== 'function') return true; // optimistic; confirmed at enrolment
    const c = await caps.call(PublicKeyCredential);
    return c['extension:prf'] === true;
  } catch { return false; }
}

async function getPrf(credentialId: Uint8Array): Promise<Uint8Array | null> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: credentialId as BufferSource }],
      userVerification: 'required',
      extensions: prfEval,
    },
  })) as PublicKeyCredential | null;
  return prfFirst(cred);
}

export async function enrolFaceId(password: string, store: KvStore = indexedDbStore): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: { id: location.hostname, name: 'i-Wallet' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'i-Wallet', displayName: 'i-Wallet' },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        extensions: prfEval,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    const rawId = new Uint8Array(cred.rawId);
    // Some platforms (Safari) only return the PRF output from get(), not create().
    const prf = prfFirst(cred) ?? (await getPrf(rawId));
    if (!prf) return false;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(prf), new TextEncoder().encode(password));
    const rec: StoredFaceId = { credentialId: toB64u(rawId), iv: toB64u(iv), ciphertext: toB64u(ct) };
    await store.set(FACEID_KEY, rec);
    return true;
  } catch { return false; }
}

export async function hasFaceId(store: KvStore = indexedDbStore): Promise<boolean> {
  try { return !!(await store.get(FACEID_KEY)); } catch { return false; }
}

export async function unlockWithFaceId(store: KvStore = indexedDbStore): Promise<string | null> {
  try {
    const rec = (await store.get(FACEID_KEY)) as StoredFaceId | undefined;
    if (!rec) return null;
    const prf = await getPrf(fromB64u(rec.credentialId));
    if (!prf) return null;
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64u(rec.iv) as BufferSource }, await aesKey(prf), fromB64u(rec.ciphertext) as BufferSource);
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

export async function forgetFaceId(store: KvStore = indexedDbStore): Promise<void> {
  await store.delete(FACEID_KEY);
}
