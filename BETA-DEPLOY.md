# Beta deploy — RideCarSharingApp

EAS project: `5e652730-2e2e-4d63-aa7e-ba3891fea1a9` (already in app.json).
Profiles live in `eas.json`. Versions auto-increment on production builds
(`appVersionSource: remote`).

## One-time setup

```bash
npm i -g eas-cli
eas login                      # Expo account
eas credentials                # let EAS manage iOS certs + Android keystore
```

iOS also needs the app registered in App Store Connect (bundle id
`com.ridefleet.carsharing`), then fill `submit.production.ios.appleId`
and `ascAppId` in eas.json. Android needs a Play Console app
(`com.ridefleet.carsharing`) and a service-account JSON for submission.

## Each beta release

```bash
# iOS → TestFlight
eas build --platform ios --profile production
eas submit --platform ios --latest

# Android → Play internal track
eas build --platform android --profile production
eas submit --platform android --latest
```

TestFlight internal testers get it immediately after processing;
Play internal track is live within minutes.

## Quick device builds (no store)

```bash
# Android APK you can install directly / share by link
eas build --platform android --profile preview

# iOS simulator build
eas build --platform ios --profile preview
```

For iOS *device* installs without TestFlight you'd need ad-hoc
provisioning (register device UDIDs via `eas device:create`), or just
use TestFlight — it's less friction.

## Pre-flight checklist

- [ ] `npm run lint && npm run typecheck && npm test` green (CI enforces this)
- [ ] `EXPO_PUBLIC_API_BASE` unset (defaults to production) or pointed correctly
- [ ] Test both languages (Account → Language) on a device
- [ ] Smoke test: explore → listing → checkout → payment WebView; trip chat; inspection upload
- [ ] Bump `version` in app.json for user-visible releases (build numbers auto-increment)

## Notes

- `updates.enabled: false` in app.json — OTA updates are off; every change
  ships as a store build. Flip on later with `eas update` if wanted.
- `newArchEnabled: true` — if a native build fails mysteriously, try
  setting it to false in app.json before debugging further.
