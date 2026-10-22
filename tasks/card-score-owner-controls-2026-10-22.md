# Ẩn thao tác bảng điểm với thành viên — 22/10/2026

- Chỉ chủ phòng thấy Bốc thăm, Thêm ván, xóa ván (`×`), quản lý/thêm người chơi và Kết thúc. Thành viên vẫn xem điểm, lịch sử sửa/xóa và vào lại phòng.
- Bảng chung tiếp tục dùng grant server hiện có. Bản online cũ mở lại trên thiết bị phải xác nhận chủ phòng bằng room-status; cờ localScoreEditable không tự cấp quyền qua giao diện. Các thao tác mở lại/xóa/khôi phục trong lịch sử cũng theo cùng điều kiện.
- Xóa quyền cũ khi rời màn hình hoặc đưa app về nền, tải lại khi quay về. Giữ busy trước lần kiểm tra quyền ngay trước ghi local; từ chối khi đổi tài khoản, rời màn hình, mất quyền hoặc lookup lỗi. Thu hồi grant ngay khi bị từ chối hoặc lỗi, ẩn nút và cho kiểm tra lại.
- Giữ cách thao tác bàn thủ công. Không sửa schema, API, storage service hoặc dữ liệu thật; không triển khai/cài app.

## Kiểm chứng

- Test tái hiện trước sửa: 3 trường hợp thất bại (nút vẫn hiện với thành viên bảng chung, bản cũ không phải chủ phòng và bản cũ offline).
- 41 test / 2 suite tập trung đạt: giao diện owner/member, mở lại/sửa/xóa/khôi phục bản cũ bởi chủ phòng, chặn xác nhận cũ sau đổi chủ, thu hồi nút khi lookup từ chối/offline, clear grant blur/background và kiểm tra lại khi trở về.
- Reviewer chỉ đọc duyệt plan và diff; đã xử lý hai góp ý về vòng đời quyền và thu hồi quyền ngay sau lookup lỗi. Reviewer xác nhận không còn phát hiện cần sửa trong phần đã review; không tự chạy test.
- Toàn bộ Jest: **127 suite / 916 test đạt**. TypeScript, ESLint các file bị ảnh hưởng và whitespace check đạt.
- Chưa kiểm tra trực tiếp trên thiết bị thật/Simulator với bản sửa này; xác nhận giao diện bằng component tests. Snapshot trước sửa và diff riêng nằm tại `/private/tmp/lifemate-owner-controls-20261022-v1` và `/private/tmp/lifemate-owner-controls-delta.patch`.
