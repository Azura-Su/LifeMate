# LifeMate v0.1

Yêu cầu và kiến trúc: [tasks/plan.md](tasks/plan.md). Ranh giới module: [CAPABILITIES.md](CAPABILITIES.md). Theo dõi thực hiện: [tasks/todo.md](tasks/todo.md).

## Tiêu chí chấp nhận

- iOS/Android đều có config Firebase đúng ID và ảnh nhận diện được cung cấp.
- Login Firebase email/password và phiên lưu native, không có demo bypass.
- Sau login có đúng ba tab Home, MP3, Setting. Logout chặn quay lại tab.
- Home hiển thị tên lấy từ Remote Config `users` theo email, với defaults và fallback.
- Tích hợp push permissions, FCM token, token refresh, foreground/background/open.
- UI tiếng Việt, có trạng thái loading/error/empty; logic nằm ngoài file màn hình.
- Thư viện audio riêng, nhập video/audio, nghe/cắt/ghép nối tuần tự và đồng bộ: [SPEC-audio.md](SPEC-audio.md).

## Quy ước

Component PascalCase, hook `useX`, service exports hàm, store `useXStore`. Ví dụ: `const displayName = resolveUserName(user, users);`. Không giữ Firebase SDK object trong Zustand; chỉ giữ `{uid,email,displayName}`.

## Kiểm thử

Jest + React Native Testing Library; tests cạnh logic và trong `__tests__`. Ưu tiên auth gate, dữ liệu Remote Config lỗi, permission bị từ chối. Lệnh và tiêu chí build trong plan; README sẽ ghi cách chạy và các bước Firebase Console còn cần chủ tài khoản thực hiện.
