# Kiểm chứng LifeMate — 07/10/2026

## Chuyển sang kho âm thanh miễn phí

- Firebase Console: database `(default)` đã chuyển thành Firestore Native (database trống); project vẫn Spark $0. Firestore rules private theo UID đã publish lúc 22:48 ngày 07/10/2026. Rules Playground xác nhận guest bị từ chối và owner UID được đọc; emulator cũng đạt 18 kiểm tra. Firebase Storage cũ bị chặn vì yêu cầu nâng gói; không thay đổi billing.
- App upload mới qua Supabase signed URL, metadata Firestore có provider; legacy backup giữ đường tải Firebase. Chưa có URL Supabase cấu hình nên app dùng thư viện trên máy và hiển thị hướng dẫn đúng trạng thái.
- **69 Jest tests / 19 suites**, typecheck và lint đạt. Tests mới kiểm tra tắt cloud khi thiếu config, giới hạn 50 MB, đổi tài khoản trong lúc lấy token, chặn URL khác host/path, hủy native upload, tải private file, upload thất bại không ghi metadata và giữ provider khi đọc index.
- **16 Node server tests** đạt, dùng chữ ký RS256 thật với khóa thử: sai audience/issuer/hết hạn/auth_time/UID/chữ ký bị chặn, path chỉ dựng từ UID xác minh; thử contract signed URL và upstream failure. Dependency server jose audit 0 vulnerabilities khi cài. Cùng code JS dùng trong Edge Function; Deno runtime/deployment chưa được xác minh trên Supabase thật.
- Firebase emulators: **18 assertions** đạt, gồm quyền chủ tài khoản, từ chối khách/UID khác, provider và giới hạn file miễn phí. Log `.build/free-audio-rules.log`; emulator đã dừng.
- Hermes bundles Android/iOS export thành công, log `.build/free-audio-bundle.log`. Không thêm native dependency; chưa dựng lại APK release preview cũ.
- iPhone 17 Pro Max Simulator đang chạy bundle mới: thư viện vẫn giữ bản M4A 0,9 MB của người dùng; trạng thái chỉ trên máy, nút Sao lưu miễn phí disabled cùng lý do chưa kết nối. Làm mới không hiện banner Firebase cũ. Không đổi tên hoặc xóa file của người dùng.
- Chưa tạo/deploy Supabase project: trang dashboard đang chờ chủ tài khoản đăng nhập/chấp nhận điều khoản. Chưa thử upload/download thực tế hoặc đồng bộ thiết bị thứ hai; không coi tích hợp cloud là đã hoạt động. Các bước còn lại ở [free-audio-storage.md](free-audio-storage.md).

## Bổ sung đặt tên âm thanh

- TypeScript, ESLint và **58 tests / 18 suites** đều đạt. Tests xác minh tên tự đặt cho audio/video, từ chối tên rỗng/quá dài, đổi tên offline còn sau reload/refresh, chỉ ghi metadata cho audio đã sao lưu, giữ tên khi Firebase lỗi, cách ly tài khoản và dọn bản sao picker khi hủy/rời màn hình.
- Hermes export cho Android và iOS thành công, log `.build/audio-names-bundle.log`. Không thay đổi native dependencies; APK preview ở phần kiểm chứng trước chưa được dựng lại cho thay đổi đặt tên này.
- iPhone 17 Pro Max Simulator: reload bundle mới vẫn còn bản audio cũ; có nút **Đổi tên**, **Sao lưu lên Firebase** và hướng dẫn sao lưu. Đã mở hộp đổi tên, xác nhận tên rỗng bị chặn, trường nhập nhận tiếng Việt; hủy để giữ nguyên tên của người dùng. Chọn video bằng Files mở hộp **Đặt tên âm thanh** trước khi xử lý; hủy không nhập thêm audio. Các thao tác lưu/sync được kiểm thử tự động với I/O cloud mock, chưa thực hiện đồng bộ thật.
- Chẩn đoán banner bằng log Xcode: Firestore trả `Permission denied: Cloud Firestore API has not been used in project baseapp-dd227 before or it is disabled`. Chưa thay đổi cấu hình cloud. Banner cụ thể được dùng khi SDK trả chi tiết này; `unavailable`/timeout vẫn báo chưa kết nối để không đoán sai nguyên nhân.

## Bộ phiên bản

Expo 55.0.31, React Native 0.83.10, React 19.2.0, Firebase native modules 26.4.0, Zustand 5. Node 24.12.0; máy hiện tại Xcode 26.3, JDK 17, Android SDK 36.

SDK 55 được chọn để tương thích Xcode hiện có. Không sửa file vendor để vượt qua yêu cầu compiler của SDK 57. Native folders được sinh từ app.json, hai Firebase config lấy từ file người dùng cung cấp; ID hai nền tảng khớp `vn.mobifone.vnsteel`.

## Đã kiểm chứng

- TypeScript strict: pass.
- ESLint: pass, không có cảnh báo trong source.
- Jest: 43 tests / 14 suites pass. Bao gồm parser Remote Config, fallback offline, normalization, validate/error Auth, chống gửi login lặp, gate khôi phục session, logout, từ chối push và kết quả token đến muộn sau logout; audio validation, persistence theo UID, cloud failure và editor. Integration test render màn hình và navigator thật xác nhận tên Asher, ba tab và logout trở về Login; Firebase services và native I/O được mock.
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

`npm audit` sau bổ sung audio ngày 07/10/2026: 0 critical; 51 high và 12 moderate (63 dependency bị ảnh hưởng, không phải số lỗi độc lập). Nguồn gốc còn lại: `braces` (Jest/Metro patterns), `node-forge` (Expo CLI signing), `sprintf-js` (test tooling), `uuid` (Xcode project tooling). Registry hiện trả bản mới nhất lần lượt 3.0.3, 1.4.0, 1.1.3 cho ba package đầu, vẫn nằm trong advisory; không dùng `audit fix --force` vì đề xuất phá bộ SDK/Jest. Kết quả local: `.build/audio-audit.json`.

`@grpc/grpc-js` gián tiếp đã override sang nhánh vá 1.14.x. Các đường dẫn có high còn lại là tooling local, không xử lý dữ liệu users/push của ứng dụng; vẫn cần cập nhật upstream và audit lại trước phát hành. Không coi bản dựng này là bản đã qua kiểm định phát hành.

Remote Config kéo theo peer Analytics. `firebase.json` tắt auto collection/Ad ID/IDFV; iOS dùng Analytics without Ad ID. Không đưa Admin credentials, password hay token vào source/log. Hai file Firebase client local không được commit.

## Bổ sung thư viện audio

- Native module `LifeMateAudio`: AVFoundation trên iOS, Media3 1.8.0 trên Android. Không đưa binary FFmpeg vào ứng dụng. `ffmpeg-static` chỉ là công cụ local tạo fixture tổng hợp.
- Android instrumentation: **5/5 tests pass** trên emulator API 36.1. Kiểm tra tách tiếng từ video không giữ track hình, cắt đúng thời lượng, nối WAV/MP3 khác codec/sample rate/kênh, reject khoảng cắt sai và video im lặng. XML kết quả nằm trong `modules/lifemate-audio/android/build/outputs/androidTest-results/connected/debug/`; log `.build/audio-android-tests.log`.
- AVFoundation: chạy source `AudioEngine.swift` thật bằng `scripts/AudioEngineSmoke.swift` trên macOS. Pass extraction, trim, concat khác định dạng, kiểm tra duration/no-video; giải mã PCM xác nhận tần số 880 → 440 Hz theo thứ tự chọn, reject no-audio/bounds sai. Đây là kiểm thử engine dùng chung, chưa phải thao tác media end-to-end trên điện thoại iOS.
- Firebase Emulator: **15 assertions pass** bằng `scripts/test-audio-rules.cjs`: owner được đọc/ghi; UID khác và guest bị chặn; metadata thiếu/sai/local URI, MIME video và đuôi `.mp4` bị từ chối. Dùng project demo, không đọc/ghi cloud thật. Log `.build/audio-rules.log`. Emulator đã dừng sau kiểm thử.
- Jest mới kiểm tra audio được giữ nguyên, video chỉ lưu output audio, kết quả còn local khi upload lỗi, đổi tài khoản trong lúc xử lý, persistence riêng theo UID, merge metadata cloud không mất bản local, khoảng cắt hợp lệ và thứ tự ghép. Editor component test thao tác trường thời gian, đổi thứ tự, tên và nút lưu; native player/I/O được mock trong test UI.
- Expo Doctor phát hiện peer `expo-asset` tự kéo SDK 57; đã thêm trực tiếp `expo-asset ~55.0.20`, loại dependencies native trùng phiên bản. Doctor cuối đạt **20/20**. CocoaPods cuối: 112 dependencies, 140 pods; prebuild Android/iOS thành công. Typecheck/lint/Jest cuối đều đạt sau sửa dependency.
- Build cuối: Android release arm64 **BUILD SUCCESSFUL** (942 tasks, 1m45s); iOS Release Simulator arm64 **BUILD SUCCEEDED**. Hermes export Android/iOS thành công. Log `.build/audio-android-release.log`, `.build/audio-ios-build.log`, `.build/audio-bundle.log`.
- APK audio: `.build/artifacts/LifeMate-audio-preview-arm64.apk`, khoảng 34 MiB, debug signing cho preview. SHA-256: `a6dd2bd1f0222d32fa320cf1204f5667eea2d201329fc75487c9a8fa9f7d7a0b`. Đã cài thành công lên Android emulator API 36.1, hiển thị Login độc lập không cần Metro; logcat không có ReactNativeJS/AndroidRuntime error khi mở. Lần `am start -W` đầu timeout trong lúc build iOS song song; sau đó process vẫn chạy và screenshot xác nhận render hoàn chỉnh: `.build/screenshots/audio-login-android.png`.
- iOS audio build đã cài và mở trên iPhone 17 Pro Max Simulator (iOS 26.3), hiển thị Login hoàn chỉnh. Screenshot `.build/screenshots/audio-login-ios.png`. Không reset hoặc xóa dữ liệu simulator. Android mở lại trả `Status: ok`.

Firebase CLI chưa có tài khoản đăng nhập. Mở Firebase Console bị bộ duyệt tự động từ chối khi chuyển sang `accounts.google.com`. Chưa thực hiện thiết lập database/bucket, triển khai rules hoặc thay đổi billing trên project thật; chưa xác nhận trạng thái hiện tại của các dịch vụ này. Chưa xác nhận đồng bộ giữa hai thiết bị hoặc import/edit qua UI sau login thật. [Hướng dẫn hoàn tất cloud và chạy lại tests](audio-library.md).

## Khôi phục phiên build Xcode bị kẹt

Ngày 07/10/2026, Xcode GUI báo `unable to initiate PIF transfer session (operation in progress?)` ngay ở bước `ComputePackagePrebuildTargetDependencyGraph`, trong khi bản Release dựng bằng CLI đã thành công. Workspace đang mở đúng `ios/LifeMate.xcworkspace`; dịch vụ `SWBBuildService` của Xcode đã chạy từ trước các lần cập nhật CocoaPods/native modules.

Sau khi xác nhận không có build đang chạy, dừng đúng process `SWBBuildService` thuộc Xcode bằng SIGTERM để Xcode tự tạo dịch vụ mới, rồi **Product → Build (⌘B)**. Lần build tiếp theo đi qua dependency graph và **Build succeeded** lúc 18:07, cấu hình Debug, iPhone 17 Pro Max Simulator, 374,7 giây. Không sửa source ứng dụng, không xóa DerivedData/Pods hoặc cache dùng chung. Bằng chứng phù hợp với một phiên build service bị kẹt; chưa xác định được tác nhân nội bộ gây kẹt trong Xcode.

Tiếp tục **Run (⌘R)**: lần build kế tiếp cũng qua dependency graph, Xcode báo **Running LifeMate on iPhone 17 Pro Max**. Sau khi tải bundle từ Metro, Simulator hiển thị tab **Thư viện MP3** với nút chọn audio/video, danh sách trống và ba tab điều hướng; không còn lỗi thiếu `ExpoDocumentPicker` của binary Debug cũ. Banner chưa kết nối được Firebase vẫn hiện; chưa kiểm chứng upload/download cloud thật.

Nếu gặp lại: kết thúc build đang chạy, đóng/mở lại workspace/Xcode trước khi thử build; nếu cần reset build service, chỉ thực hiện khi không còn build khác. Không chạy prebuild hoặc `pod install` đồng thời với build trong Xcode. Sau khi thêm dependency native, cần build và cài lại app; chỉ reload Metro sẽ không bổ sung module native vào binary cũ.
