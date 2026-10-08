# Kế hoạch LifeMate

## Hệ màu nâu đất, mây trời và nắng nhạt — 08/10/2026

Rà soát giao diện toàn app theo bảng màu nâu đất nhạt, trắng mây/xanh trời và vàng nắng nhạt. Dùng token ngữ nghĩa thống nhất cho nền, mặt thẻ, chữ, CTA, trạng thái, đường viền, lớp phủ và điều khiển; đặt vàng nắng làm điểm nhấn nhỏ, giữ diện tích nâu/be và xanh cân bằng; thay các màu hardcode còn sót ở component, màn hình và cấu hình splash/adaptive icon/notification. Giữ tương phản chữ và nút đủ dùng, kiểm chứng bằng test tương phản, Jest, typecheck, lint và bundle Android/iOS.

## Mở rộng danh sách nghe — 08/10/2026

Mở rộng danh sách nghe đơn hiện tại thành nhiều playlist riêng theo tài khoản, lưu metadata trên thiết bị và giữ khả năng đọc dữ liệu cũ. Người dùng có thể tạo/chọn/đổi tên/xóa playlist để phát; tên playlist phải duy nhất, kiểm tra không phân biệt chữ hoa/thường và báo rõ khi tên đã có. Từ thư viện, chọn nhiều playlist cho cùng một file. Xóa file âm thanh sẽ gỡ file khỏi mọi playlist; xóa playlist bỏ toàn bộ playlist và tên đó nhưng giữ các file âm thanh trong thư viện. Xóa playlist cuối cùng để lại trạng thái rỗng để người dùng tự tạo danh sách mới.

Các bước: (1) thêm schema và migration từ key playlist cũ, kiểm thử hook với nhiều danh sách và membership độc lập; (2) thêm chọn/tạo playlist trên tab MP3 và kiểm thử điều hướng trạng thái; (3) thêm bộ chọn nhiều playlist trong thư viện, kiểm thử truy cập và membership; (4) chạy typecheck, lint, Jest và kiểm tra diff.

## Mở rộng đang thực hiện: audio (07/10/2026)

Theo [SPEC-audio.md](../SPEC-audio.md): thư viện riêng theo UID; nối lần lượt đã được người dùng xác nhận. Thứ tự triển khai: validate/types → native inspect/export → local library và cloud rules → import/sync → player/editor → kiểm chứng và tài liệu. Cắt/ghép tạo file mới; audio gốc giữ nguyên, video chỉ được xử lý local. Lưu local trước upload để tránh mất kết quả khi mạng/billing chưa sẵn sàng. iOS AVFoundation và Android Media3 xuất AAC/M4A; audio nhập sẵn không chuyển mã.

Điểm kiểm chứng chính: native export thật với fixture, test sync lỗi vẫn giữ local, test đổi UID/hủy job, rules owner isolation, UI import → list → cắt/ghép → mở lại. Firebase production còn phụ thuộc quyền truy cập Console và gói Blaze; không tự nâng gói.

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
