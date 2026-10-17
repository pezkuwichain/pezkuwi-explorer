## Summary

<!-- What does this PR change and why? -->

## Type

- [ ] feat — new screen / feature
- [ ] i18n — copy / translations
- [ ] fix — bug fix
- [ ] chore / docs

## Checklist

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` pass locally
- [ ] Every user-facing string is in all six locales (kmr default; Kurmancî checked against the Ferheng)
- [ ] Theme tokens only; touch targets ≥ 44 px; checked at 360 px and in RTL
- [ ] i-Wallet changes: no secret (words, password, key) logged, stored in clear or sent anywhere
- [ ] CSP: any new origin added to `deploy/nginx-explorer.conf` in the same PR
- [ ] No secrets committed
