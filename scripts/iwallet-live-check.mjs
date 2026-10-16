// Live pin for i-Wallet citizenship calls against MAINNET metadata (spec §10 "Live (no submission)").
// Builds every citizenship extrinsic and the Asset Hub -> People teleport for a throwaway account generated in
// memory, prints each call's hex and paymentInfo, and dry-runs the teleport. It never signs or submits anything.
// Run from the repo root: node scripts/iwallet-live-check.mjs
import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { Keyring } from '@pezkuwi/keyring';
import { cryptoWaitReady, mnemonicGenerate, blake2AsHex } from '@pezkuwi/util-crypto';
import { u8aToHex } from '@pezkuwi/util';

const AH = 'wss://asset-hub-rpc.pezkuwichain.io';
const PEOPLE = 'wss://people-rpc.pezkuwichain.io';
const PEOPLE_PARA = 1004;
const SIGNED_EXTENSIONS = { AuthorizeCall: { extrinsic: {}, payload: {} }, StorageWeightReclaim: { extrinsic: {}, payload: {} } };
// A referrer-shaped address for the call encodings (the founder account).
const REFERRER = '5CyuFfbF95rzBxru7c9yEsX4XmQXUxpLUcbj9RLg9K1cGiiF';

const connect = (url) => ApiPromise.create({ provider: new WsProvider(url), noInitWarn: true, signedExtensions: SIGNED_EXTENSIONS });
const j = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));

async function show(label, tx, payer) {
  console.log(`\n## ${label}`);
  console.log('  method:', `${tx.method.section}.${tx.method.method}`);
  console.log('  hex   :', tx.method.toHex());
  try {
    const info = await tx.paymentInfo(payer);
    console.log('  paymentInfo:', j(info.toHuman()), 'partialFee TYR =', info.partialFee.toBigInt().toString());
  } catch (e) {
    console.log('  paymentInfo FAILED:', e.message);
  }
}

await cryptoWaitReady();
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const pair = keyring.addFromMnemonic(mnemonicGenerate(12));
const me = pair.address;
const pk = u8aToHex(pair.publicKey);
console.log('throwaway account:', me, pk);

const [ah, people] = await Promise.all([connect(AH), connect(PEOPLE)]);
try {
  console.log('\n# Asset Hub', (await ah.rpc.system.chain()).toString(), 'spec', ah.runtimeVersion.specVersion.toNumber(), 'genesis', ah.genesisHash.toHex());
  console.log('# People   ', (await people.rpc.system.chain()).toString(), 'spec', people.runtimeVersion.specVersion.toNumber(), 'genesis', people.genesisHash.toHex());

  // --- identityKyc on People ---
  const kyc = people.tx.identityKyc;
  console.log('\n# identityKyc calls:', Object.keys(kyc).join(', '));
  for (const m of ['applyForCitizenship', 'approveReferral', 'confirmCitizenship', 'cancelApplication']) {
    console.log(`  ${m}(${kyc[m].meta.args.map((a) => `${a.name}: ${a.type}`).join(', ')})`);
  }
  const deposit = people.consts.identityKyc.kycApplicationDeposit.toBigInt();
  console.log('  kycApplicationDeposit TYR =', deposit.toString());
  console.log('  storage:', Object.keys(people.query.identityKyc).join(', '));
  const statusType = people.query.identityKyc.kycStatuses.creator.meta.type;
  const statusTypeName = statusType.isMap ? statusType.asMap.value : statusType.asPlain;
  console.log('  kycStatuses value type:', people.registry.lookup.getTypeDef(statusTypeName).type);
  const appType = people.query.identityKyc.applications.creator.meta.type;
  console.log('  applications value type:', people.registry.lookup.getTypeDef(appType.isMap ? appType.asMap.value : appType.asPlain).type);
  console.log('  applications modifier:', people.query.identityKyc.applications.creator.meta.modifier.toString());
  console.log('  kycStatuses modifier:', people.query.identityKyc.kycStatuses.creator.meta.modifier.toString());
  const apps = await people.query.identityKyc.applications.entries();
  console.log('  applications entries on chain:', apps.length);
  for (const [k, v] of apps) {
    // The value shape pendingReferrals() in src/iwallet/citizen.ts relies on.
    const st = await people.query.identityKyc.kycStatuses(k.args[0]);
    console.log(`   applicant ${k.args[0].toString()} value isOption=${typeof v.isSome === 'boolean'} isSome=${v.isSome} referrer=${(v.isSome ? v.unwrap() : v).referrer.toString()} status=${st.type}`);
  }
  if (people.query.identityKyc.pendingKycApplications) console.log('  pendingKycApplications present');
  const st = await people.query.identityKyc.kycStatuses(me);
  console.log('  kycStatuses(throwaway) =', st.type ?? st.toString());
  const tikis = await people.query.tiki.userTikis(me);
  console.log('  userTikis(throwaway) =', j(tikis.toJSON()));
  console.log('  citizenNft(throwaway) isSome =', (await people.query.tiki.citizenNft(me)).isSome);

  const hash = blake2AsHex(JSON.stringify({ fullName: 'Test', fatherName: 'F', grandfatherName: 'G', motherName: 'M', tribe: 'T', region: 'bakur', email: 'a@b.c', profession: 'P', walletAddress: me }), 256);
  await show('identityKyc.applyForCitizenship(hash, None)', kyc.applyForCitizenship(hash, null), me);
  await show('identityKyc.applyForCitizenship(hash, Some(referrer))', kyc.applyForCitizenship(hash, REFERRER), me);
  await show('identityKyc.confirmCitizenship()', kyc.confirmCitizenship(), me);
  await show('identityKyc.cancelApplication()', kyc.cancelApplication(), me);
  await show('identityKyc.approveReferral(applicant)', kyc.approveReferral(REFERRER), me);

  // --- XCM on Asset Hub ---
  const xcmPallet = ah.tx.pezkuwiXcm ? 'pezkuwiXcm' : ah.tx.polkadotXcm ? 'polkadotXcm' : null;
  console.log('\n# XCM pallet on Asset Hub:', xcmPallet);
  const lta = ah.tx[xcmPallet].limitedTeleportAssets;
  console.log('  limitedTeleportAssets(', lta.meta.args.map((a) => `${a.name}: ${a.type}`).join(', '), ')');
  const destDef = ah.registry.lookup.getTypeDef(lta.meta.fields[0].type);
  const versions = destDef.sub.map((s) => s.name);
  console.log('  VersionedLocation variants:', versions.join(', '));
  const top = versions.filter((v) => /^V\d+$/.test(v)).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0];
  console.log('  highest version:', top);
  const safe = ah.query[xcmPallet].safeXcmVersion ? (await ah.query[xcmPallet].safeXcmVersion()).toString() : 'n/a';
  console.log('  safeXcmVersion:', safe);
  // Junction spelling: list the variants of the top version's Junction type.
  const vDef = destDef.sub.find((s) => s.name === top);
  const locDef = ah.registry.lookup.getTypeDef(vDef.lookupIndex ?? vDef.type);
  const interiorField = (locDef.sub ?? []).find((s) => s.name === 'interior');
  const junctionsDef = ah.registry.lookup.getTypeDef(interiorField.lookupIndex ?? interiorField.type);
  console.log('  Junctions variants:', junctionsDef.sub.map((s) => s.name).join(', '));
  const x1 = junctionsDef.sub.find((s) => s.name === 'X1');
  const x1Def = ah.registry.lookup.getTypeDef(x1.lookupIndex ?? x1.type);
  const junctionDef = x1Def.sub && !Array.isArray(x1Def.sub) ? ah.registry.lookup.getTypeDef(x1Def.sub.lookupIndex ?? x1Def.sub.type) : x1Def;
  console.log('  X1 shape:', x1Def.type);
  console.log('  Junction variants:', (junctionDef.sub ?? []).map((s) => s.name).join(', '));

  const amount = deposit + 500_000_000_000n;
  const build = (account) => lta(
    { [top]: { parents: 1, interior: { X1: [{ Teyrchain: PEOPLE_PARA }] } } },
    { [top]: { parents: 0, interior: { X1: [{ AccountId32: { id: account, network: null } }] } } },
    { [top]: [{ id: { parents: 1, interior: 'Here' }, fun: { Fungible: amount } }] },
    // Pezkuwi's pallet takes the fee asset as a VersionedAssetId here, not a u32 index into `assets`:
    // a bare 0 encodes as variant __Unused0 and the runtime traps while decoding the call.
    { [top]: { parents: 1, interior: 'Here' } },
    'Unlimited',
  );
  const teleport = build(pk);
  console.log('  dest  :', j(teleport.method.args[0].toJSON()));
  console.log('  benef :', j(teleport.method.args[1].toJSON()));
  console.log('  assets:', j(teleport.method.args[2].toJSON()));
  console.log('  feeId :', j(teleport.method.args[3].toJSON()));
  console.log('  weight:', j(teleport.method.args[4].toJSON()));
  await show(`${xcmPallet}.limitedTeleportAssets(AH -> People ${PEOPLE_PARA}, ${amount} TYR)`, teleport, me);

  // The dry-run origin for a funded run: DRY_RUN_ORIGIN, or the account with the most spendable HEZ among the
  // first 1000 Asset Hub accounts. A dry run needs no signature; nothing is signed or sent.
  let FUNDED = process.env.DRY_RUN_ORIGIN;
  if (!FUNDED) {
    const page = await ah.query.system.account.entriesPaged({ args: [], pageSize: 1000 });
    let best = 0n;
    for (const [k, v] of page) {
      const free = v.data.free.toBigInt() - (v.data.frozen.toBigInt() > v.data.reserved.toBigInt() ? v.data.frozen.toBigInt() - v.data.reserved.toBigInt() : 0n);
      if (free > best) { best = free; FUNDED = k.args[0].toString(); }
    }
    console.log(`\n# dry-run origin: ${FUNDED} (spendable ${best} TYR, picked from ${page.length} accounts)`);
  }

  if (ah.call.dryRunApi?.dryRunCall) {
    const params = ah.call.dryRunApi.dryRunCall.meta.params.map((p) => `${p.name}: ${p.type}`).join(', ');
    console.log('\n# dryRunApi.dryRunCall(', params, ')');
    const xcmVer = Number(top.slice(1));
    const args = (origin, tx) => (ah.call.dryRunApi.dryRunCall.meta.params.length === 3
      ? [{ system: { Signed: origin } }, tx.method, xcmVer]
      : [{ system: { Signed: origin } }, tx.method]);
    for (const [label, origin] of [['throwaway (empty) origin', me], [`funded origin ${FUNDED}`, FUNDED]]) {
      try {
        const r = await ah.call.dryRunApi.dryRunCall(...args(origin, teleport));
        const h = r.toHuman();
        const ok = h.Ok;
        console.log(`\n  [${label}]`);
        if (!ok) { console.log('   Err:', j(h)); continue; }
        console.log('   executionResult:', j(ok.executionResult));
        const evs = (ok.emittedEvents ?? []).map((e) => `${e.section}.${e.method}${e.section === 'balances' ? j(e.data) : ''}`);
        console.log('   events:', evs.join(', '));
        console.log('   forwardedXcms:', j(ok.forwardedXcms).slice(0, 1500));
        // Hand the forwarded program to People's own dry run to see it land.
        const fwd = r.asOk.forwardedXcms;
        if (fwd.length && people.call.dryRunApi?.dryRunXcm && label.startsWith('funded')) {
          const [dest, msgs] = fwd[0];
          const pr = await people.call.dryRunApi.dryRunXcm({ [top]: { parents: 1, interior: 'Here' } }, msgs[0]);
          const ph = pr.toHuman();
          console.log('   People dryRunXcm executionResult:', j(ph.Ok?.executionResult ?? ph));
          console.log('   People events:', (ph.Ok?.emittedEvents ?? []).map((e) => `${e.section}.${e.method}${e.section === 'balances' ? j(e.data) : ''}`).join(', '));
          void dest;
        }
      } catch (e) {
        console.log(`  [${label}] dryRunCall FAILED:`, e.message);
      }
    }
  } else {
    console.log('\n# dryRunApi not present on Asset Hub');
  }
} finally {
  await Promise.all([ah.disconnect(), people.disconnect()]);
}
