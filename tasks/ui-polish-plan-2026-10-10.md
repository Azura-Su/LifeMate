# Kế hoạch rà soát và hoàn thiện UI LifeMate — 10/10/2026

## Mục tiêu

Rà lại toàn bộ giao diện người dùng đang có và sửa các điểm nhất quán rõ ràng mà không đổi luồng nghiệp vụ hay thiết kế chủ đạo. Giữ bảng màu mây trời, nâu đất và nắng nhạt; ưu tiên lề màn hình, nền/trạng thái và thao tác chạm.

## Phạm vi rà soát

- Shell dùng chung: `Screen`, `ModalScreen`, `DialogModal`, `ModalHeader`, `Button`, notification banner và thanh tab.
- Các màn/luồng: Login, Home, Tài chính (khóa, báo cáo, form), MP3 (danh sách, thư viện, player/editor), Lịch/việc, Ghi chú và menu Cài đặt.
- Trạng thái: loading, empty, error, đồng bộ cục bộ/cloud, modal và hành động nguy hiểm.

## Phát hiện ưu tiên

1. Lề ngang shell đang lệch nhẹ: mặc định 24 pt, một số màn 20 pt, màn Lịch 18 pt. Điều này làm các tiêu đề và nội dung cạnh nhau không thẳng hàng.
2. Home/Tài chính còn ba màu cùng ngữ nghĩa viết trực tiếp trong styles: đường phân cách header, nền trạng thái thành công và bóng đổ đám mây.
3. Các phần khác đã có token màu, header cố định, trạng thái rỗng/lỗi và vùng bấm; cần giữ cách xử lý riêng khi hình dạng hoặc mật độ nội dung có chủ đích.
4. Simulator accessibility tree mặc định tính hai route ẩn Ghi chú/Lịch vào số lượng tab, khiến VoiceOver đọc “1 of 5” dù thanh chỉ hiện ba mục. Gán nhãn theo ba tab đang nhìn thấy giữ nguyên đường mở Ghi chú/Lịch.

## Quyết định thiết kế

- Dùng lề màn hình 20 pt trên mọi shell cuộn/toàn trang; giữ padding bên trong thẻ, dialog và bottom sheet độc lập.
- Đưa màu còn hardcode vào token ngữ nghĩa, giữ nguyên sắc độ hiện tại để tránh đổi palette ngoài ý muốn.
- Không thay đổi dữ liệu, luồng màn hình, kiểu chữ hoặc kích thước điều khiển nếu chưa có bằng chứng về lỗi trải nghiệm.

## Công việc và tiêu chí hoàn thành

### Task 1 — Đồng nhất lề ngang shell

- [x] Tạo token dùng chung cho lề màn hình và chiều rộng tối đa.
- [x] Áp dụng cho Screen, ModalScreen, Home, Tài chính, MP3, Lịch/việc, Ghi chú và Login.
- [x] Kiểm tra header, vùng cố định và vùng cuộn dùng chung một trục ngang.

**Kiểm chứng:** component tests cho Screen/ModalScreen; Jest màn hình liên quan; typecheck/lint/Prettier.

### Task 2 — Hoàn thiện token màu còn thiếu

- [x] Đặt tên ngữ nghĩa cho màu nền thành công, đường phân cách vàng nhạt và bóng đám mây.
- [x] Thay các giá trị màu trực tiếp tại Home/Tài chính bằng token.
- [x] Đảm bảo màu render cuối giữ nguyên palette đang dùng.

**Kiểm chứng:** palette test, tìm màu hardcode ngoài theme và chạy Jest.

### Task 3 — Sửa nhãn truy cập của thanh tab

- [x] Nêu đúng thứ tự ba tab hiển thị với VoiceOver: Home 1/3, Tài chính 2/3, MP3 3/3.
- [x] Giữ nguyên điều hướng tới Ghi chú và Lịch qua các lối vào hiện tại.

**Kiểm chứng:** integration test đọc nhãn ba tab và vẫn mở được Notes từ menu.

### Task 4 — Kiểm tra tổng thể và xác nhận

- [x] Chạy toàn bộ Jest, typecheck, lint, format check và bundle iOS/Android.
- [x] Rà diff các file thuộc kế hoạch; giữ nguyên các thay đổi chưa commit khác trong workspace.
- [x] Thử kiểm tra Simulator; ghi nhận CoreSimulatorService đang mất kết nối.

**Kết quả:** Jest 59 suites / 277 tests, typecheck, lint, Prettier, `git diff --check` và Expo bundle Android/iOS đều đạt. Ảnh runtime chưa kiểm chứng được vì CoreSimulatorService từ chối kết nối.

**Tiêu chí hoàn thành:** mọi kiểm tra khả dụng đạt; ghi rõ giới hạn runtime nếu Simulator chưa kết nối lại.

## Rủi ro và giới hạn

- Thư mục đang chứa nhiều thay đổi chưa commit và `tasks/plan.md`/`tasks/todo.md` còn checklist mở. Kế hoạch này dùng file riêng để giữ nguyên công việc hiện hữu.
- Thay đổi lề có thể đổi độ rộng nội dung vài điểm trên mỗi cạnh; test sẽ khóa trục căn chỉnh, còn layout trong từng card giữ nguyên.
- Thay đổi cấu trúc navigation có thể ảnh hưởng back stack; chỉ đưa vào phạm vi nếu giữ được hành vi đang có và có kiểm thử.
