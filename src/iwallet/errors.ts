// Chain error -> i18n key, ported from pwap shared/lib/error-handler.ts (balances, assets, identityKyc and tiki entries).
// pwap keys some errors by names this chain does not have; here every key is a name the runtime really defines
// (checked against the pezpallet sources), with the pwap wording carried over where the meaning is the same.
// Keys are `pallet.Error` exactly as `api.registry.findMetaError` reports them (pallet in camelCase).
export const ERROR_KEYS: Readonly<Record<string, string>> = Object.fromEntries([
  'balances.InsufficientBalance', 'balances.ExistentialDeposit', 'balances.Expendability', 'balances.LiquidityRestrictions',
  'assets.BalanceLow', 'assets.NoAccount', 'assets.NoPermission', 'assets.Frozen', 'assets.BelowMinimum', 'assets.Unknown',
  'identityKyc.ApplicationAlreadyExists', 'identityKyc.ApplicationNotFound', 'identityKyc.ReferrerNotCitizen',
  'identityKyc.SelfReferral', 'identityKyc.CannotApproveInCurrentState', 'identityKyc.CannotConfirmInCurrentState',
  'identityKyc.NotTheReferrer', 'identityKyc.IdentityHashAlreadyUsed', 'identityKyc.AlreadyACitizen',
  'identityKyc.NotACitizen', 'identityKyc.CannotCancelInCurrentState',
  'tiki.KycNotCompleted', 'tiki.UserAlreadyHasRole', 'tiki.RoleAlreadyTaken',
  // Citizenship (Task 8): measured on mainnet People / Asset Hub metadata 2026-10-16.
  'tiki.CitizenNftAlreadyExists', 'tiki.CitizenNftNotFound',
  'pezkuwiXcm.LocalExecutionIncompleteWithError', 'pezkuwiXcm.FeesNotMet', 'pezkuwiXcm.Filtered',
].map((k) => [k, `iwallet.err.${k}`]));
