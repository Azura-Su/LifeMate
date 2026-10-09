# LifeMate

Yêu cầu và kiến trúc: [tasks/plan.md](tasks/plan.md). Ranh giới module: [CAPABILITIES.md](CAPABILITIES.md). Theo dõi thực hiện: [tasks/todo.md](tasks/todo.md).

## Tiêu chí chấp nhận

- iOS/Android đều có config Firebase đúng ID và ảnh nhận diện được cung cấp.
- Login Firebase email/password và phiên lưu native, không có demo bypass.
- Sau login có ba tab Home, Tài chính, MP3. Menu (drawer) mở từ Home chứa Ghi chú, Cài đặt (thông báo, khóa Tài chính) và Đăng xuất; Lịch và việc mở từ thẻ “Hôm nay” ở Home; logout chặn quay lại tab.
- Home hiển thị tên lấy từ Remote Config `users` theo email, với defaults và fallback; tổng thu/chi/còn lại tháng hiện tại và lối vào Tài chính; MP3 mở từ tab dưới.
- Số tiền ở Home mặc định là `***`; con mắt bật/tắt cả ba số tiền, trạng thái ẩn áp dụng cho cả nội dung đọc màn hình và được đặt lại khi đổi tài khoản.
- Home, MP3 và Tài chính giữ header cố định; menu Cài đặt có header riêng. MP3 chỉ cuộn danh sách file; các màn thư viện/editor có header back và tiêu đề giữa.
- Tích hợp push permissions, FCM token, token refresh, foreground/background/open.
- UI tiếng Việt, có trạng thái loading/error/empty; logic nằm ngoài file màn hình.
- Thư viện audio riêng, nhập video/audio, nghe/cắt/ghép nối tuần tự và đồng bộ: [SPEC-audio.md](SPEC-audio.md).
- Sổ thu chi theo UID, báo cáo thu nhập/chi tiêu theo năm hoặc khoảng tháng nhiều năm: [SPEC-finance.md](SPEC-finance.md).
- Tiện ích tài chính, nghe MP3, ghi chú và lịch/việc: [SPEC-life-utilities.md](SPEC-life-utilities.md).

## Quy ước

Component PascalCase, hook `useX`, service exports hàm, store `useXStore`. Ví dụ: `const displayName = resolveUserName(user, users);`. Không giữ Firebase SDK object trong Zustand; chỉ giữ `{uid,email,displayName}`.

## Kiểm thử

Jest + React Native Testing Library; tests cạnh logic và trong `__tests__`. Ưu tiên auth gate, dữ liệu Remote Config lỗi, permission bị từ chối. Lệnh và tiêu chí build trong plan; README sẽ ghi cách chạy và các bước Firebase Console còn cần chủ tài khoản thực hiện.
