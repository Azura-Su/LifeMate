# Kế hoạch LifeMate

## Mục tiêu

Ứng dụng React Native Android/iOS, tên LifeMate, ảnh người dùng cung cấp làm avatar/icon, bundle ID iOS và Android package `vn.mobifone.vnsteel`. Firebase project lấy từ hai file cấu hình được cung cấp: `baseapp-dd227`.

## Kiến trúc

- React Native 0.83 + TypeScript strict, Expo SDK 55 development build/prebuild (native Firebase, không dùng Expo Go). SDK 55 tương thích Xcode 26.3 hiện có; SDK 57 cần Xcode 26.4+.
- React Navigation: auth gate và bottom tabs Home / MP3 / Setting.
- Zustand: auth session, cấu hình users, trạng thái push. Không lưu password/token Auth vào store persist; Firebase quản lý phiên.
- `src/screens/<Screen>/`: `<Screen>Screen.tsx`, `use<Screen>Screen.ts`, styles khi cần.
- `src/hooks/`: lifecycle dùng chung; `src/utils/`: hàm thuần validate/parse/mapping.
- `src/services/firebase/`: adapter Auth, Remote Config, Messaging; `src/store/`: Zustand.
- `src/components/`, `src/theme/`, `src/navigation/`, `src/types/`, `assets/`.
- `server/`: công cụ gửi push bằng Firebase Admin chạy riêng, không import vào app; credentials qua Application Default Credentials.
- Cấu hình native từ `app.json`; thư mục `ios/`, `android/` được sinh bởi prebuild.

## Hành vi

1. Login email/mật khẩu; validate, loading, lỗi tiếng Việt; khôi phục session; logout trả về login và không quay lại tab bằng Back.
2. Home có tên phía trên bên trái. `users` là tham số JSON Remote Config, không phải collection database. Mẫu `[{"mail":"su.azura99@gmail.com","name":"Asher"}]`. Chuẩn hóa email; fallback displayName/email nếu chưa khớp. JSON lỗi không làm crash hoặc làm mất cấu hình tốt trước đó.
3. MP3 hiển thị trạng thái thư viện trống; chưa thêm player/nguồn nhạc vì chưa được yêu cầu.
4. Setting: tài khoản, trạng thái push, bật thông báo, logout.
5. FCM: xin quyền theo thao tác người dùng, xử lý token refresh, foreground, background và notification-open. Không chặn login khi APNs/FCM chưa sẵn sàng.
6. Logo gốc được giữ; icon dùng chính ảnh cung cấp. Màu kem/vàng từ ảnh, chữ tối, safe area, scroll và bàn phím phù hợp mobile.

## Kiểm chứng

`npm run typecheck`, `npm run lint`, `npm test`, `npm run bundle`, `npx expo-doctor`, `npm run prebuild`; thử native build nếu môi trường cho phép.
Unit/integration tests cho parser, tên, login validation, auth gate/logout, lỗi fetch và push permission. Kiểm thử Firebase thật cần tài khoản thử nghiệm; push iOS cần APNs key và signing của chủ dự án.

## Ranh giới

Luôn tách UI/logic/service/store, validate remote data, dùng API Firebase modular. Không chứa Admin key trong app hoặc log password/token. Không tự publish Remote Config, tạo user hoặc gửi push khi chưa có yêu cầu. Danh sách Remote Config chỉ là metadata hiển thị công khai, không làm authorization.

## Rủi ro và cấu hình bên ngoài

- Firebase Console: bật Email/Password; tạo tài khoản thử; publish `users`.
- iOS push: upload APNs key trong Firebase, provisioning có push entitlement.
- MP3 player cần yêu cầu nguồn nhạc, playlist, background playback ở bước sau.

## Nguồn

- https://docs.expo.dev/guides/using-firebase/
- https://rnfirebase.io/
- https://rnfirebase.io/remote-config/usage
- https://rnfirebase.io/messaging/usage
