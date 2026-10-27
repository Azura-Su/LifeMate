# LifeMate

Yêu cầu và kiến trúc: [tasks/plan.md](tasks/plan.md). Ranh giới module: [CAPABILITIES.md](CAPABILITIES.md). Theo dõi thực hiện: [tasks/todo.md](tasks/todo.md).

## Tiêu chí chấp nhận

- iOS/Android đều có config Firebase đúng ID và ảnh nhận diện được cung cấp.
- Login Firebase email/password và phiên lưu native, không có demo bypass. Khi Firebase Remote Config `registration_enabled` là `true`, người chưa đăng nhập có thể tự tạo tài khoản bằng tên, email và mật khẩu; giá trị mặc định trong app là `false`. Tạo tài khoản tự đăng nhập, sau đó thử lưu tên vào Firebase Auth và gửi thư xác nhận email. Tài khoản mới dùng các tính năng riêng ngay; kết bạn và chia sẻ Ký ức yêu cầu email đã xác nhận.
- Sau login có bốn tab Home, Tài chính, Ký ức, MP3. Menu (drawer) mở từ Home chứa Ghi chú, Cài đặt (thông báo, khóa Tài chính) và Đăng xuất; Lịch và Việc mở từ hai thẻ trên Home; logout chặn quay lại tab.
- Home hiển thị lời chào với tên tự đặt trong Firebase Auth, dự phòng Remote Config `users` theo email, ngày dương kèm ngày âm, và hai thẻ: **Lịch** (số dịp lễ/ghi chú hôm nay) và **Việc cần làm** (số việc hôm nay). Mỗi thẻ mở bottom sheet tương ứng. Home có tóm tắt Thu/Chi theo ngày, không tính khoản nhận lại từ cho mượn/đóng hộ vào thu hoặc bù trừ Chi mới; Tài chính, Ký ức và MP3 nằm ở tab dưới.
- Loading trên Home giữ bố cục gọn: Tài chính dùng placeholder trong hai ô Thu/Chi; Lịch và Việc cần làm dùng một nét placeholder ngay dòng số lượng. Không hiện số 0 thay dữ liệu đang tải; trình đọc màn hình nhận biết trạng thái đang tải và các nút mở nội dung vẫn dùng được.
- Sheet Lịch: lịch tháng tuần bắt đầu Chủ nhật, mỗi ô có ngày dương và ngày âm (UTC+7), đánh dấu hôm nay, ngày chọn, ngày lễ/Tết và ngày có ghi chú; dưới lưới là chi tiết ngày chọn với tên dịp lễ và các ghi chú theo ngày (thêm, đọc, sửa, xóa). Sheet Việc: việc hôm nay, thêm/sửa/hoàn tất, nhắc và mở màn Lịch việc đầy đủ.
- Home, MP3, Ký ức và Tài chính giữ header cố định; menu Cài đặt có header riêng. MP3 chỉ cuộn danh sách file; các màn thư viện/editor có nút X để đóng và tiêu đề giữa.
- Tích hợp push permissions, FCM token, token refresh, foreground/background/open.
- UI tiếng Việt, có trạng thái loading/error/empty; logic nằm ngoài file màn hình.
- Android ẩn thanh điều hướng hệ thống phía dưới khi vào app, quay lại foreground, lấy lại focus hoặc đóng bàn phím; vẫn gọi lại được bằng cử chỉ hệ thống. Không ẩn thanh trạng thái phía trên hoặc thay đổi iOS. Dùng expo-navigation-bar đúng SDK55 và config plugin visibility hidden; cần build Android mới.
- Thanh tab Android có khoảng đệm dưới tối thiểu12pt khi thanh điều hướng hệ thống ẩn để icon/chữ không sát mép; vùng an toàn lớn hơn vẫn được giữ nguyên.
- Thư viện audio riêng, nhập video/audio, nghe/cắt/ghép nối tuần tự và đồng bộ: [SPEC-audio.md](SPEC-audio.md).
- Sổ thu chi theo UID, báo cáo thu nhập/chi tiêu theo năm hoặc khoảng tháng nhiều năm: [SPEC-finance.md](SPEC-finance.md).
- Cho vay theo UID, ghi nhận các lần nhận lại vào Tài chính với nguồn riêng: [tasks/loan-ledger-plan-2026-10-11.md](tasks/loan-ledger-plan-2026-10-11.md).
- Tiện ích tài chính, nghe MP3, ghi chú và lịch/việc: [SPEC-life-utilities.md](SPEC-life-utilities.md).
- Linh thú pixel: 15 cá thể duy nhất, nhận nuôi qua backend, EXP theo thói quen ghi chép (không theo số tiền): [SPEC-pixel-pet.md](SPEC-pixel-pet.md).

## Quy ước

Component PascalCase, hook `useX`, service exports hàm, store `useXStore`. Ví dụ: `const displayName = resolveUserName(user, users);`. Không giữ Firebase SDK object trong Zustand; chỉ giữ `{uid,email,displayName}`. Hồ sơ cá nhân và ảnh đại diện: [SPEC-profile.md](SPEC-profile.md); tên tự đặt trong Auth ưu tiên hơn tên dự phòng Remote Config.

## Kiểm thử

Jest + React Native Testing Library; tests cạnh logic và trong `__tests__`. Ưu tiên auth gate, dữ liệu Remote Config lỗi, permission bị từ chối. Lệnh và tiêu chí build trong plan; README sẽ ghi cách chạy và các bước Firebase Console còn cần chủ tài khoản thực hiện.
