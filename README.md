# LifeMate

React Native cho Android/iOS, TypeScript, Expo Development Build, Firebase Auth + Remote Config + FCM + Firestore và Supabase Storage Free và Zustand. Tên ứng dụng **LifeMate**, iOS Bundle ID/Android package **`vn.mobifone.vnsteel`**, Firebase project **`baseapp-dd227`**.

Tab MP3 có thư viện riêng theo tài khoản: nhập audio/video, tự tách tiếng của video trên máy, nghe/tua, cắt và nối nhiều đoạn theo thứ tự. Có thể đặt tên khi nhập và đổi tên file đã lưu. Xem [cách dùng](docs/audio-library.md) và [cấu hình kho miễn phí](docs/free-audio-storage.md). Code và Firestore rules đã tích hợp; sao lưu cloud thật đang chờ tạo project Supabase Free.

## Chạy ứng dụng

Cần Node theo `.nvmrc`, Xcode 26.2+/CocoaPods cho iOS, JDK 17 và Android SDK 36 cho Android. Dùng native development build, không chạy bằng Expo Go. Bộ phiên bản là Expo SDK 55 + React Native 0.83, tương thích Xcode 26.3 trên máy hiện tại.

```sh
nvm use
npm ci
npm run android
# hoặc trên macOS:
npm run ios
```

`npm run android` / `npm run ios` build native và mở Metro. Sau khi đã cài development build, chạy `npm start` để phát triển JS. Có thể dùng `npm run ios -- --device` với thiết bị thật; cần chọn Apple team/signing của bạn.

### APK cài thử trên máy hiện tại

File [LifeMate-audio-preview-arm64.apk](.build/artifacts/LifeMate-audio-preview-arm64.apk) có đầy đủ tab MP3 mới, chạy độc lập, không cần Metro, dành cho Android arm64 từ Android 7.0 (API 24). Bản này dùng cấu hình release nhưng ký bằng debug key để kiểm thử; không dùng đưa lên Play Store.

```sh
adb install -r .build/artifacts/LifeMate-audio-preview-arm64.apk
```

Để dựng lại APK sau khi prebuild:

```sh
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

APK và native output không lưu trong Git. Phát hành chính thức cần keystore/signing riêng.

Hai file Firebase đã được sao chép vào `firebase/` trên máy này và được gitignore. Khi clone sang máy khác, đặt lại:

```text
firebase/GoogleService-Info.plist
firebase/google-services.json
```

`app.json` trỏ đến hai file trên; Expo prebuild tự đưa vào native project. `ios/` và `android/` là output sinh tự động, không sửa thủ công để tránh mất thay đổi khi prebuild. Assets giữ ảnh gốc tại `assets/lifemate-original.jpg`; `assets/icon.png` là bản đóng gói vuông với nền kem, giữ toàn bộ ảnh.

## Cấu trúc

```text
App.tsx                       providers, bootstrap, navigation
index.ts                      đăng ký app và background FCM
src/
  screens/
    Login/                    LoginScreen.tsx + useLoginScreen.ts + styles
    Home/                     HomeScreen.tsx + useHomeScreen.ts + styles
    Mp3/                      màn thư viện, editor/player + các hook xử lý riêng
    Settings/                 SettingsScreen.tsx + useSettingsScreen.ts + styles
  hooks/                      lifecycle chung và profile selector
  services/firebase/          auth, remote config, push, metadata Firestore
  services/audio/             file/index local, import/edit, Supabase transfer, session guards
  store/                      auth, config, notification, audio (Zustand)
  utils/                      validate, parse JSON, chuẩn hóa email, resolve tên
  navigation/                 auth gate, tabs và route types
  components/                 button, screen, avatar, notification banner
  config/                     Remote Config defaults
  theme/                      màu và typography
  types/                      model dữ liệu
modules/lifemate-audio/        native AVFoundation iOS / Media3 Android
supabase/                     Edge Function xác thực Firebase, bucket private, tests
firebase/                     native configs, sample users, audio rules/emulators
tests/fixtures/audio/         audio/video tổng hợp cho kiểm thử native
server/                       Firebase Admin push tool độc lập
tasks/                        plan và checklist
```

## Firebase Console cần thiết lập

1. Mở project `baseapp-dd227`, **Authentication → Sign-in method → Email/Password → Enable**.
2. Trong **Authentication → Users**, tạo tài khoản thử nghiệm, ví dụ `su.azura99@gmail.com`, với mật khẩu do bạn chọn. App hiện hỗ trợ login, chưa có đăng ký/reset password/Google login.
3. **Remote Config → Add parameter**: key **`users`**, data type **JSON** (hoặc string chứa JSON), giá trị:

```json
[{ "mail": "su.azura99@gmail.com", "name": "Asher" }]
```

4. **Publish changes**. Đăng nhập bằng email tương ứng: Home hiện **Asher** ở góc trên bên trái. Ghép email không phân biệt hoa/thường, bỏ khoảng trắng hai đầu. Nếu không có tên cấu hình, dùng displayName Firebase rồi phần tên trong email.

App có defaults như dữ liệu mẫu. Khi khởi động/về foreground/kéo xuống Home, app fetch & activate. Development bỏ thời gian cache tối thiểu; production cache 1 giờ. Khi offline dùng activated cache; JSON không hợp lệ giữ dữ liệu hợp lệ đang có. Remote Config là dữ liệu tải xuống client, **không dùng chứa bí mật hoặc phân quyền**. Danh sách lớn/riêng tư nên chuyển sang database có security rules.

## Push notification

- Vào **Setting → Bật thông báo**. Từ chối quyền vẫn sử dụng app bình thường; có nút mở cài đặt thiết bị.
- Firebase Messaging nhận **FCM token trực tiếp**, không dùng Expo Push Service. Expo Notifications chỉ cung cấp permission API và Android channel.
- Module Analytics là peer dependency của Remote Config; tự động thu thập Analytics/advertising ID đã tắt trong `firebase.json`, iOS dùng biến thể không có Ad ID.
- Foreground: banner trong ứng dụng. Background/quit: notification payload do OS hiển thị. Bấm thông báo đưa app về foreground và hiển thị nội dung. Background handler đã đăng ký, chưa thực hiện tác vụ data-only.
- Token refresh được cập nhật trong Zustand; logout xóa state, tắt auto-init và thử thu hồi token. Nếu thiết bị offline, việc thu hồi từ FCM có thể chưa hoàn tất; server production cần hủy mapping UID/token riêng.
- Bản development có nút sao chép FCM token trong Setting để gửi test qua Firebase Console hoặc `server/`. Không log token, password hay Admin key.
- Android: emulator cần Google Play services hoặc dùng thiết bị thật; Android 13+ cần cấp quyền thông báo.
- iOS: bật Push Notifications capability và Background Modes/Remote notifications, dùng signing/provisioning đúng bundle ID; upload **APNs authentication key** tại Firebase → Project Settings → Cloud Messaging. `aps-environment` trong config là `development`; Xcode/export signing phải khớp provisioning của bản phát hành. Kiểm chứng push trên thiết bị thật.

## Kiểm chứng

```sh
npm run typecheck
npm run lint
npm test -- --watchman=false
npm run bundle
npx expo-doctor
npm run prebuild -- --no-install
```

Tests bao gồm Auth/Remote Config/FCM, lưu thư viện riêng, audio/video import, lỗi cloud, cắt và thứ tự ghép. Bundle command xuất Hermes JS cho cả Android/iOS, không thay cho native build. Xem [kết quả kiểm chứng](docs/verification.md) và [cách chạy native/rules tests](docs/audio-library.md).

## Tài liệu quyết định kỹ thuật

- [Kế hoạch](tasks/plan.md), [yêu cầu](SPEC.md), [checklist](tasks/todo.md).
- [Yêu cầu thư viện âm thanh](SPEC-audio.md), [sử dụng và cấu hình](docs/audio-library.md).
- [Expo với Firebase](https://docs.expo.dev/guides/using-firebase/).
- [React Native Firebase setup](https://rnfirebase.io/) và [Remote Config](https://rnfirebase.io/remote-config/usage).
- [Firebase Messaging](https://rnfirebase.io/messaging/usage), [Expo permission API](https://docs.expo.dev/versions/latest/sdk/notifications/).
- [React Navigation auth flow](https://reactnavigation.org/docs/auth-flow/).
