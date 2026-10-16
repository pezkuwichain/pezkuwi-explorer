import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blake2AsHex, decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { u8aToHex } from '@pezkuwi/util';
import type { ApiPromise } from '@pezkuwi/api';
import { normaliseAddress } from '../lib/address';
import {
  EMPTY_FORM, buildApply, buildApprove, buildCancel, buildConfirm, buildTeleportToPeople, formKey, formProblems, identityHash, loadForm,
  loadStatus, needsFunding, parseReferrer, pendingReferrals, saveForm, teleportAmount, toKycStatus, type CitizenForm,
} from './citizen';

const ADDR = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const CHARLIE = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y';
const FORM: CitizenForm = {
  ...EMPTY_FORM,
  fullName: 'Berzê Ronahî', fatherName: 'Şêrko', grandfatherName: 'Welat', motherName: 'Gula', tribe: 'Barzanî',
  maritalStatus: 'zewici', childrenCount: '2', children: [{ name: 'Rojîn', birthYear: '2015' }],
  region: 'bakur', email: 'berze@example.com', profession: 'Mamosta', referrer: BOB,
};

describe('identityHash', () => {
  it('equals pwap NewCitizenApplication.tsx for a fixed vector', () => {
    // Verbatim from pwap web/src/components/citizenship/NewCitizenApplication.tsx:214-227.
    const citizenshipData = { ...FORM, walletAddress: ADDR, timestamp: 1, referralCode: undefined };
    const pwap = blake2AsHex(
      JSON.stringify({
        fullName: citizenshipData.fullName,
        fatherName: citizenshipData.fatherName,
        grandfatherName: citizenshipData.grandfatherName,
        motherName: citizenshipData.motherName,
        tribe: citizenshipData.tribe,
        region: citizenshipData.region,
        email: citizenshipData.email,
        profession: citizenshipData.profession,
        walletAddress: citizenshipData.walletAddress
      }),
      256
    );
    expect(identityHash(FORM, ADDR)).toBe(pwap);
    // Pinned so a change to both expressions at once still shows.
    expect(pwap).toBe('0x9c2ee01e38acdbd4f49331153e350049c6b6847a03ea136536985a07997b2886');
  });
  it('ignores the fields pwap does not hash (marital status, children, referrer)', () => {
    expect(identityHash({ ...FORM, maritalStatus: 'nezewici', children: [], referrer: '' }, ADDR)).toBe(identityHash(FORM, ADDR));
    expect(identityHash({ ...FORM, email: 'x@y.z' }, ADDR)).not.toBe(identityHash(FORM, ADDR));
    expect(identityHash(FORM, BOB)).not.toBe(identityHash(FORM, ADDR));
  });
});

describe('form', () => {
  beforeEach(() => localStorage.clear());
  it('lists missing required fields and a bad email', () => {
    expect(formProblems(FORM)).toEqual([]);
    expect(formProblems({ ...FORM, fullName: '  ', region: '', email: 'no-at-sign' })).toEqual(['fullName', 'region', 'email']);
  });
  it('is kept only in localStorage under pezkuwi-explorer:iwallet-citizen:<address>', () => {
    expect(formKey(ADDR)).toBe(`iwallet-citizen:${ADDR}`);
    expect(saveForm(ADDR, FORM)).toBe(true);
    expect(JSON.parse(localStorage.getItem(`pezkuwi-explorer:iwallet-citizen:${ADDR}`)!)).toEqual(FORM);
    expect(loadForm(ADDR)).toEqual(FORM);
    expect(loadForm(BOB)).toEqual(EMPTY_FORM);
  });
  it('falls back to an empty form when the stored text is damaged', () => {
    localStorage.setItem(`pezkuwi-explorer:iwallet-citizen:${ADDR}`, '{not json');
    expect(loadForm(ADDR)).toEqual(EMPTY_FORM);
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

describe('pendingReferrals', () => {
  const app = (referrer: string) => ({ isSome: true, unwrap: () => ({ identityHash: { toString: () => `0xhash-${referrer.slice(0, 4)}` }, referrer: { toString: () => referrer } }) });
  const key = (a: string) => ({ args: [{ toString: () => a }] });
  const status: Record<string, string> = { [BOB]: 'PendingReferral', [CHARLIE]: 'ReferrerApproved', [ADDR]: 'PendingReferral' };
  const people = {
    query: {
      identityKyc: {
        applications: { entries: () => Promise.resolve([
          [key(BOB), app(ADDR)],
          [key(CHARLIE), app(ADDR)], // already approved by us
          [key(ADDR), app(BOB)], // names someone else
        ]) },
        kycStatuses: { multi: vi.fn((as: string[]) => Promise.resolve(as.map((a) => ({ type: status[a] })))) },
      },
    },
  } as unknown as ApiPromise;
  it('lists only applications that name this account and still wait for it', async () => {
    const list = await pendingReferrals(encodeAddress(decodeAddress(ADDR), 0), { getApi: () => Promise.resolve(people) });
    expect(list).toEqual([{ applicant: BOB, identityHash: '0xhash-5Grw' }]);
    // One batched status read for the two applicants that name this account.
    const multi = (people as unknown as { query: { identityKyc: { kycStatuses: { multi: ReturnType<typeof vi.fn> } } } }).query.identityKyc.kycStatuses.multi;
    expect(multi).toHaveBeenCalledTimes(1);
    expect(multi).toHaveBeenCalledWith([BOB, CHARLIE]);
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
