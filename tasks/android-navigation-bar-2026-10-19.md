# Android navigation bar — 19/10/2026

- Added SDK55-compatible `expo-navigation-bar`55.0.17 and its config plugin with
  `visibility: hidden`; generated Android resources contain the hidden setting.
- The foreground app hides navigation again on return, Android focus and keyboard
  dismissal. Listeners are removed on unmount; iOS and headless launches do not
  attach this behavior. No timer or continuous visibility listener is used.
- Verification: 19 targeted hook/bootstrap/navigation tests, TypeScript,
  affected-file ESLint and Android arm64 debug build passed.
- Native smoke on API36.1 emulator in three-button mode: navigation bar visibility
  was false after returning from Home and after opening/dismissing the keyboard;
  the status bar remained visible. No login data was entered and the connected
  physical phone was not modified.
- Applying this change requires a new Android binary, not only a JS reload.
  Native folders remain generated and ignored by Git.

Reference: [Expo SDK55 navigation bar](https://docs.expo.dev/versions/v55.0.0/sdk/navigation-bar/).
