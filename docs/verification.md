# Kiểm chứng LifeMate — 07/10/2026

## Bộ phiên bản

Expo 55.0.31, React Native 0.83.10, React 19.2.0, Firebase native modules 26.4.0, Zustand 5. Node 24.12.0; máy hiện tại Xcode 26.3, JDK 17, Android SDK 36.

SDK 55 được chọn để tương thích Xcode hiện có. Không sửa file vendor để vượt qua yêu cầu compiler của SDK 57. Native folders được sinh từ app.json, hai Firebase config lấy từ file người dùng cung cấp; ID hai nền tảng khớp `vn.mobifone.vnsteel`.

## Đã kiểm chứng

- TypeScript strict: pass.
- ESLint: pass, không có cảnh báo trong source.
- Jest: 27 tests / 9 suites pass. Bao gồm parser Remote Config, fallback offline, normalization, validate/error Auth, chống gửi login lặp, gate khôi phục session, logout, từ chối push và kết quả token đến muộn sau logout. Integration test render màn hình và navigator thật xác nhận tên Asher, ba tab và logout trở về Login; Firebase services và native font được mock.
- Expo Doctor: 20/20 pass.
- Prebuild: Android/iOS pass.
- Hermes bundle: xuất được cho Android/iOS.
- CocoaPods install: pass với môi trường không kế thừa GEM_HOME/GEM_PATH của RVM.
- Server push utility: `node --check` pass. Không gửi push thật.

- iOS Release Simulator build: **BUILD SUCCEEDED**, Xcode 26.3, arm64. App chạy trên iPad Pro 13-inch (M5), hiển thị đúng logo/Login; kiểm tra trực tiếp email không hợp lệ và mật khẩu trống qua UI. Ảnh tại `screenshots/login-ios.png`.
- Android Debug arm64 APK: **BUILD SUCCESSFUL**, 442 tasks; file `android/app/build/outputs/apk/debug/app-debug.apk`. Bản debug cần Metro, không phải APK release độc lập.
- Android Release preview arm64 APK: **BUILD SUCCESSFUL**, 761 tasks, với hai worker để giới hạn RAM. File bàn giao `.build/artifacts/LifeMate-preview-arm64.apk` (~29 MB), dùng debug signing key, không phải bản phát hành lên cửa hàng. SHA-256: `d407b6d334c8c2b8e0190c1ccff08a6cd17b5856889d869af70f3b4052345c74`.

Android Debug đã cài và chạy trên emulator API 36.1 với Metro; màn Login hiển thị đúng, không có lỗi JS khi mở app.

Android Release preview đã cài và mở thành công trên cùng emulator, **không chạy Metro**. Màn Login hiển thị đầy đủ logo, hai trường nhập, nút đăng nhập; logcat không ghi lỗi ReactNativeJS/AndroidRuntime khi mở. Ảnh thật tại `screenshots/login-android.png`. Đây là kiểm chứng khởi động/render, chưa phải đăng nhập Firebase thật.

Build trên ổ hệ thống ban đầu hết dung lượng; output cuối đã chuyển vào `.build/` trên ổ pmnb. Chỉ xóa hai thư mục DerivedData tạm do chính lượt triển khai này tạo; không dọn cache/dữ liệu dự án khác.

CocoaPods trên máy hiện tại cần bỏ môi trường RVM xung đột: trong `ios/`, chạy `env -u GEM_HOME -u GEM_PATH /opt/homebrew/bin/pod install`. Android có thể đặt `GRADLE_USER_HOME` và `TMPDIR` vào `.build/gradle` và `.build/tmp`, cùng `-Djava.io.tmpdir` trỏ đến đường dẫn tuyệt đối của `.build/tmp`. iOS dùng `xcodebuild -derivedDataPath .build/ios`.

## Cần kiểm thử với quyền chủ dự án

- Login/logout thật với tài khoản Firebase hợp lệ; chưa được cung cấp mật khẩu thử nghiệm.
- Publish và thay đổi Remote Config `users` trên Firebase Console; test fetch production sau publish.
- Gửi FCM trên thiết bị thật ở foreground/background/quit, token rotation, từ chối/cấp lại quyền. iOS cần APNs key và provisioning.
- Bản ký cho thiết bị/App Store/Play Store; chưa cấu hình Apple team, release keystore hay phân phối.
- Dynamic Type/VoiceOver/TalkBack trên thiết bị thật.

## Dependency audit

`npm audit` ngày 07/10/2026: 0 critical; 49 high và 12 moderate (số dependency bị ảnh hưởng, không phải số lỗi độc lập). Nguồn gốc còn lại: `braces` (Jest/Metro patterns), `node-forge` (Expo CLI signing), `sprintf-js` (test tooling), `uuid` (Xcode project tooling). Registry hiện trả bản mới nhất lần lượt 3.0.3, 1.4.0, 1.1.3 cho ba package đầu, vẫn nằm trong advisory; không dùng `audit fix --force` vì đề xuất phá bộ SDK/Jest.

`@grpc/grpc-js` gián tiếp đã override sang nhánh vá 1.14.x. Các đường dẫn có high còn lại là tooling local, không xử lý dữ liệu users/push của ứng dụng; vẫn cần cập nhật upstream và audit lại trước phát hành. Không coi bản dựng này là bản đã qua kiểm định phát hành.

Remote Config kéo theo peer Analytics. `firebase.json` tắt auto collection/Ad ID/IDFV; iOS dùng Analytics without Ad ID. Không đưa Admin credentials, password hay token vào source/log. Hai file Firebase client local không được commit.
