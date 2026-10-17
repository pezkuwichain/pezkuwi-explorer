import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blake2AsHex, decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { u8aToHex } from '@pezkuwi/util';
import type { ApiPromise } from '@pezkuwi/api';
import { normaliseAddress } from '../lib/address';
import {
  EMPTY_FORM, buildApply, buildApprove, buildCancel, buildConfirm, buildTeleportToPeople, formKey, formProblems, identityHash, loadForm, newSalt,
  loadStatus, myReferrals, needsFunding, orderReferrals, parseReferrer, referralLink, saveForm, stageOf, teleportAmount, toKycStatus, type CitizenForm,
} from './citizen';

const ADDR = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const CHARLIE = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y';
const SALT = `0x${'11'.repeat(32)}`;
const FORM: CitizenForm = { fullName: 'Berzê Ronahî', referrer: BOB, salt: SALT };
const KEY = `pezkuwi-explorer:iwallet-citizen:${ADDR}`;
const stored = () => JSON.parse(localStorage.getItem(KEY)!) as Record<string, unknown>;

describe('identityHash', () => {
  it('hashes { fullName, walletAddress, salt }, for a fixed vector', () => {
    const json = `{"fullName":"Berzê Ronahî","walletAddress":"${ADDR}","salt":"${SALT}"}`;
    expect(identityHash(FORM, ADDR)).toBe(blake2AsHex(json, 256));
    expect(identityHash(FORM, ADDR)).toBe('0x319a72f1684218bdc8fe6d579e413ddea9f4ddeb8d1167e99b2aba02e64ef7b1');
  });

  it('gives different hashes for the same name and address with two salts, so a guessed name cannot be checked', () => {
    const a = newSalt(); const b = newSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(identityHash({ ...FORM, salt: a }, ADDR)).not.toBe(identityHash({ ...FORM, salt: b }, ADDR));
    // A guess without the salt does not reproduce it.
    expect(identityHash(FORM, ADDR)).not.toBe(blake2AsHex(JSON.stringify({ fullName: FORM.fullName, walletAddress: ADDR }), 256));
  });

  it('ignores the referrer and changes with the name or the wallet', () => {
    expect(identityHash({ ...FORM, referrer: '' }, ADDR)).toBe(identityHash(FORM, ADDR));
    expect(identityHash({ ...FORM, fullName: 'Rojîn' }, ADDR)).not.toBe(identityHash(FORM, ADDR));
    expect(identityHash(FORM, BOB)).not.toBe(identityHash(FORM, ADDR));
  });
});

describe('form', () => {
  beforeEach(() => localStorage.clear());
  it('asks only for the full name', () => {
    expect(Object.keys(EMPTY_FORM).sort()).toEqual(['fullName', 'referrer', 'salt']);
    expect(formProblems(FORM)).toEqual([]);
    expect(formProblems({ ...FORM, fullName: '  ' })).toEqual(['fullName']);
    expect(formProblems({ ...FORM, referrer: '' })).toEqual([]);
  });
  it('is kept only in localStorage under pezkuwi-explorer:iwallet-citizen:<address>, with its salt', () => {
    expect(formKey(ADDR)).toBe(`iwallet-citizen:${ADDR}`);
    expect(saveForm(ADDR, FORM)).toBe(true);
    expect(stored()).toEqual(FORM);
    expect(loadForm(ADDR)).toEqual(FORM);
    expect(loadForm(ADDR).salt).toBe(SALT);
  });
  it('gives a new form a fresh salt without writing anything', () => {
    const f = loadForm(BOB);
    expect(f).toEqual({ fullName: '', referrer: '', salt: f.salt });
    expect(f.salt).toMatch(/^0x[0-9a-f]{64}$/);
    expect(localStorage.length).toBe(0);
  });
  it('rewrites a form saved in the old long shape on load: name + referrer + a new salt, nothing else left', () => {
    const old = {
      fullName: 'Berzê Ronahî', fatherName: 'Şêrko', grandfatherName: 'Welat', motherName: 'Gula', tribe: 'Barzanî',
      maritalStatus: 'zewici', childrenCount: '2', children: [{ name: 'Rojîn', birthYear: '2015' }],
      region: 'bakur', email: 'berze@example.com', profession: 'Mamosta', referrer: BOB,
    };
    localStorage.setItem(KEY, JSON.stringify(old));
    const f = loadForm(ADDR);
    expect(f).toEqual({ fullName: 'Berzê Ronahî', referrer: BOB, salt: f.salt });
    // Written back at once, with no save: none of the old fields stay in this browser.
    expect(stored()).toEqual(f);
    expect(Object.keys(stored()).sort()).toEqual(['fullName', 'referrer', 'salt']);
    expect(loadForm(ADDR).salt).toBe(f.salt);
  });
  it('falls back to empty fields when the stored text is damaged or of the wrong type', () => {
    const empty = (f: CitizenForm) => expect({ ...f, salt: '' }).toEqual(EMPTY_FORM);
    localStorage.setItem(KEY, '{not json');
    empty(loadForm(ADDR));
    localStorage.setItem(KEY, 'null');
    empty(loadForm(ADDR));
    localStorage.setItem(KEY, '{"fullName":7,"referrer":["x"],"salt":"0xnot-hex"}');
    const f = loadForm(ADDR);
    empty(f);
    expect(f.salt).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('parseReferrer', () => {
  const p = (s: string) => parseReferrer(s, ADDR, normaliseAddress);
  it('treats empty as None (the pallet default referrer)', () => {
    expect(p('')).toEqual({ ok: true, value: null });
    expect(p('   ')).toEqual({ ok: true, value: null });
  });
  it('accepts a valid address in any SS58 format and normalises it', () => {
    expect(p(` ${BOB} `)).toEqual({ ok: true, value: BOB });
    expect(p(encodeAddress(decodeAddress(BOB), 0))).toEqual({ ok: true, value: BOB });
  });
  it('rejects a bad checksum, a raw public key and junk', () => {
    expect(p(`${BOB.slice(0, -1)}z`)).toEqual({ ok: false, reason: 'invalid' });
    expect(p(u8aToHex(decodeAddress(BOB)))).toEqual({ ok: false, reason: 'invalid' });
    expect(p('hello')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('rejects the applicant as their own referrer', () => {
    expect(p(encodeAddress(decodeAddress(ADDR), 0))).toEqual({ ok: false, reason: 'self' });
  });
});

describe('status', () => {
  it('maps every known variant', () => {
    for (const s of ['NotStarted', 'PendingReferral', 'ReferrerApproved', 'Approved', 'Revoked'] as const) expect(toKycStatus(s)).toBe(s);
  });
  it('throws on a variant it does not know', () => {
    expect(() => toKycStatus('Suspended')).toThrow('unknown citizenship status: Suspended');
  });
  const peopleWith = (type: string, nft: bigint | null) => ({
    query: {
      identityKyc: { kycStatuses: vi.fn(() => Promise.resolve({ type })) },
      tiki: { citizenNft: vi.fn(() => Promise.resolve({ isSome: nft !== null, unwrap: () => ({ toBigInt: () => nft }) })) },
    },
  }) as unknown as ApiPromise;
  it('loads the status and the citizen NFT from People', async () => {
    const getApi = vi.fn(() => Promise.resolve(peopleWith('Approved', 42n)));
    await expect(loadStatus(ADDR, { getApi })).resolves.toEqual({ kyc: 'Approved', nftId: 42n });
    expect(getApi).toHaveBeenCalledWith('people');
    await expect(loadStatus(ADDR, { getApi: () => Promise.resolve(peopleWith('NotStarted', null)) })).resolves.toEqual({ kyc: 'NotStarted', nftId: null });
  });
  it('fails the load on an unknown variant instead of guessing a stage', async () => {
    await expect(loadStatus(ADDR, { getApi: () => Promise.resolve(peopleWith('Suspended', null)) })).rejects.toThrow(/unknown citizenship status/);
  });
});

describe('stageOf', () => {
  it('follows kycStatuses when there is no citizen NFT', () => {
    expect(stageOf({ kyc: 'NotStarted', nftId: null })).toBe('form');
    expect(stageOf({ kyc: 'PendingReferral', nftId: null })).toBe('pending');
    expect(stageOf({ kyc: 'ReferrerApproved', nftId: null })).toBe('sign');
    expect(stageOf({ kyc: 'Approved', nftId: null })).toBe('approvedNoNft');
    expect(stageOf({ kyc: 'Revoked', nftId: null })).toBe('revoked');
  });
  it('shows the citizen whenever a citizen NFT exists, unless the citizenship was revoked', () => {
    for (const kyc of ['NotStarted', 'PendingReferral', 'ReferrerApproved', 'Approved'] as const) {
      expect(stageOf({ kyc, nftId: 5n })).toBe('citizen');
    }
    expect(stageOf({ kyc: 'NotStarted', nftId: 0n })).toBe('citizen');
    expect(stageOf({ kyc: 'Revoked', nftId: 5n })).toBe('revoked');
  });
});

describe('myReferrals', () => {
  const DAVE = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy';
  const EVE = '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw';
  const FERDIE = '5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL';
  const GONE = encodeAddress(new Uint8Array(32).fill(7), 42);
  const OTHER = encodeAddress(new Uint8Array(32).fill(9), 42);
  // The chain may hand the referrer back in another SS58 prefix: the match is by public key.
  const me0 = encodeAddress(decodeAddress(ADDR), 0);
  const key = (a: string) => ({ args: [{ toString: () => a }] });
  const app = (referrer: string) => ({ isSome: true, unwrap: () => ({ identityHash: { toString: () => '0xh' }, referrer: { toString: () => referrer } }) });
  const ref = (referrer: string, at: number) => ({ isSome: true, unwrap: () => ({ referrer: { toString: () => referrer }, createdAt: { toNumber: () => at } }) });
  const status: Record<string, string> = {
    [BOB]: 'PendingReferral', [CHARLIE]: 'ReferrerApproved', [DAVE]: 'PendingReferral', [EVE]: 'Approved', [FERDIE]: 'Approved', [GONE]: 'Revoked', [OTHER]: 'Approved',
  };
  const nft: Record<string, bigint> = { [EVE]: 5n, [GONE]: 8n };
  const mk = (apps: unknown[], refs: unknown[]) => {
    const kycMulti = vi.fn((as: string[]) => Promise.resolve(as.map((a) => ({ type: status[a] ?? 'NotStarted' }))));
    const nftMulti = vi.fn((as: string[]) => Promise.resolve(as.map((a) => ({ isSome: a in nft, unwrap: () => ({ toBigInt: () => nft[a] }) }))));
    const api = {
      query: {
        identityKyc: { applications: { entries: () => Promise.resolve(apps) }, kycStatuses: { multi: kycMulti } },
        referral: { referrals: { entries: () => Promise.resolve(refs) } },
        tiki: { citizenNft: { multi: nftMulti } },
      },
    } as unknown as ApiPromise;
    return { deps: { getApi: () => Promise.resolve(api) }, kycMulti, nftMulti };
  };

  it('merges open applications and completed referrals that name this account, in display order', async () => {
    const { deps, kycMulti, nftMulti } = mk(
      [[key(BOB), app(me0)], [key(CHARLIE), app(me0)], [key(DAVE), app(OTHER)], [key(EVE), app(me0)]],
      [[key(EVE), ref(me0, 100)], [key(FERDIE), ref(me0, 200)], [key(GONE), ref(me0, 50)], [key(OTHER), ref(BOB, 300)]],
    );
    expect(await myReferrals(ADDR, deps)).toEqual([
      { address: BOB, state: 'waiting', createdAt: null, nftId: null },
      { address: CHARLIE, state: 'signing', createdAt: null, nftId: null },
      { address: FERDIE, state: 'citizen', createdAt: 200, nftId: null },
      { address: EVE, state: 'citizen', createdAt: 100, nftId: 5n },
      // A revoked citizen's NFT is not shown.
      { address: GONE, state: 'revoked', createdAt: 50, nftId: null },
    ]);
    // One batched status read and one batched NFT read for every candidate, each account once (EVE is in both maps).
    expect(kycMulti).toHaveBeenCalledTimes(1);
    expect(nftMulti).toHaveBeenCalledTimes(1);
    expect(kycMulti.mock.calls[0][0]).toEqual([EVE, FERDIE, GONE, BOB, CHARLIE]);
  });

  // renounce_citizenship (live on mainnet) sets NotStarted and burns the NFT but leaves the referral.referrals row.
  it('shows a citizen who renounced as no longer a citizen, with the record number', async () => {
    const { deps } = mk([], [[key(DAVE), ref(me0, 10)]]);
    status[DAVE] = 'NotStarted';
    try {
      expect(await myReferrals(ADDR, deps)).toEqual([{ address: DAVE, state: 'left', createdAt: 10, nftId: null }]);
    } finally { status[DAVE] = 'PendingReferral'; }
  });

  it('offers Approve again when someone who renounced applies again naming this account (one row, matched by public key)', async () => {
    // The application key comes back in another SS58 prefix than the referral row: still the same person.
    const { deps, kycMulti } = mk([[key(encodeAddress(decodeAddress(DAVE), 0)), app(ADDR)]], [[key(DAVE), ref(me0, 10)]]);
    expect(await myReferrals(ADDR, deps)).toEqual([{ address: DAVE, state: 'waiting', createdAt: null, nftId: null }]);
    expect(kycMulti.mock.calls[0][0]).toEqual([DAVE]);
  });

  it('shows no longer a citizen, without Approve, when someone who renounced applies again under another referrer', async () => {
    const { deps } = mk([[key(DAVE), app(OTHER)]], [[key(DAVE), ref(me0, 10)]]);
    expect(await myReferrals(ADDR, deps)).toEqual([{ address: DAVE, state: 'left', createdAt: 10, nftId: null }]);
  });

  it('lists an Approved application as a citizen without a record number and skips one that reads NotStarted', async () => {
    const fresh = encodeAddress(new Uint8Array(32).fill(3), 42); // no status entry: NotStarted
    const { deps } = mk([[key(OTHER), app(ADDR)], [key(fresh), app(ADDR)]], []);
    expect(await myReferrals(ADDR, deps)).toEqual([{ address: OTHER, state: 'citizen', createdAt: null, nftId: null }]);
  });

  it('reads no statuses when nobody named this account', async () => {
    const { deps, kycMulti } = mk([[key(DAVE), app(OTHER)]], [[key(OTHER), ref(BOB, 1)]]);
    expect(await myReferrals(ADDR, deps)).toEqual([]);
    expect(kycMulti).not.toHaveBeenCalled();
  });

  it('orders newest first within a group and puts an unknown record number last', () => {
    const r = (address: string, state: 'citizen' | 'left' | 'revoked' | 'waiting', createdAt: number | null) => ({ address, state, createdAt, nftId: null });
    expect(orderReferrals([r('a', 'revoked', 9), r('f', 'left', 99), r('b', 'citizen', null), r('c', 'citizen', 5), r('d', 'waiting', null), r('e', 'citizen', 7)]).map((x) => x.address))
      .toEqual(['d', 'e', 'c', 'b', 'f', 'a']);
  });

  it('builds the short referral link', () => {
    expect(referralLink(ADDR)).toBe(`https://cuzdan.pex.network/?ref=${ADDR}`);
  });
});

describe('builders', () => {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const rec = (name: string) => (...args: unknown[]) => { calls.push({ name, args }); return { name } as never; };
  const api = {
    tx: {
      identityKyc: {
        applyForCitizenship: rec('identityKyc.applyForCitizenship'), approveReferral: rec('identityKyc.approveReferral'),
        confirmCitizenship: rec('identityKyc.confirmCitizenship'), cancelApplication: rec('identityKyc.cancelApplication'),
      },
      pezkuwiXcm: { limitedTeleportAssets: rec('pezkuwiXcm.limitedTeleportAssets') },
    },
  } as unknown as ApiPromise;
  beforeEach(() => { calls.length = 0; });

  it('call the identityKyc methods with their arguments', () => {
    buildApply(api, '0xabc', null);
    buildApply(api, '0xabc', BOB);
    buildApprove(api, BOB);
    buildConfirm(api);
    buildCancel(api);
    expect(calls).toEqual([
      { name: 'identityKyc.applyForCitizenship', args: ['0xabc', null] },
      { name: 'identityKyc.applyForCitizenship', args: ['0xabc', BOB] },
      { name: 'identityKyc.approveReferral', args: [BOB] },
      { name: 'identityKyc.confirmCitizenship', args: [] },
      { name: 'identityKyc.cancelApplication', args: [] },
    ]);
  });

  it('teleport HEZ from Asset Hub to People (para 1004) in the shape pinned against mainnet', () => {
    const amount = teleportAmount(1_000_000_000_000n);
    expect(amount).toBe(1_500_000_000_000n);
    buildTeleportToPeople(api, ADDR, amount);
    const here = { parents: 1, interior: 'Here' };
    expect(calls).toEqual([{
      name: 'pezkuwiXcm.limitedTeleportAssets',
      args: [
        { V5: { parents: 1, interior: { X1: [{ Teyrchain: 1004 }] } } },
        { V5: { parents: 0, interior: { X1: [{ AccountId32: { network: null, id: u8aToHex(decodeAddress(ADDR)) } }] } } },
        { V5: [{ id: here, fun: { Fungible: 1_500_000_000_000n } }] },
        { V5: here },
        'Unlimited',
      ],
    }]);
  });
});

describe('needsFunding', () => {
  const dep = 1_000_000_000_000n; const fee = 10_810_528n; const ed = 3_333_333n;
  it('is true just below deposit + fee + ED and false at it', () => {
    expect(needsFunding(dep + fee + ed - 1n, dep, fee, ed)).toBe(true);
    expect(needsFunding(dep + fee + ed, dep, fee, ed)).toBe(false);
    expect(needsFunding(0n, dep, fee, ed)).toBe(true);
  });
});
