# Checklist sửa lỗi đồng bộ offline

- [x] Sửa migration giao dịch cũ đã chỉnh trước lần cloud sync đầu.
- [x] Giữ base snapshot của tùy chọn Tài chính qua nhiều lần sửa offline.
- [x] Cho phép thử lại cloud sau một lỗi ghi Tài chính tạm thời.
- [x] Thêm timeout, pending upsert và tombstone cloud cho Ghi chú.
- [x] Thêm timeout, pending upsert và tombstone cloud cho Lịch/việc.
- [x] Đồng bộ trạng thái reminder sau lần tải cloud thành công.
- [x] Loại MP3 đã xóa trên cloud khỏi thư viện và chặn rename tạo lại metadata.
- [x] Bảo toàn lượt đang phát khi chuẩn bị bài kế thất bại; hẹn giờ chặn lượt chuyển bài đang chờ.
- [x] Hiện giao dịch có danh mục tự tạo đã xóa trong báo cáo thu.
- [x] Cho đặt tên dấu mốc và dọn checkpoint của file không còn trong thư viện sau sync.
- [x] Đối chiếu cấu hình quyền Lịch với SDK đang dùng.
- [x] Chạy kiểm tra kiểu và lint; rà diff.
