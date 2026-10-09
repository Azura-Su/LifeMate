# Kế hoạch sửa lỗi đồng bộ offline — 09/10/2026

Ưu tiên các đường đi có thể làm mất dữ liệu, làm sống lại bản ghi đã xóa, hoặc để lại hành vi không nhất quán giữa thiết bị.

1. **Tài chính:** giữ nguyên mốc cloud khi gộp nhiều thay đổi tùy chọn offline; nhập giao dịch cũ đã sửa trong lần migration đầu; để lần ghi sau thử cloud lại sau lỗi tạm thời.
2. **Ghi chú và Lịch:** lưu thao tác pending trước khi gọi cloud, đặt timeout, tuần tự hóa thao tác theo tài khoản, và lưu tombstone bất biến ở collection riêng để một lần ghi offline cũ không thể ghi đè dấu xóa.
3. **Nhắc việc:** sau lần tải cloud thành công, so sánh toàn bộ nhắc cục bộ với danh sách việc còn mở và hủy nhắc đã hoàn thành, đổi giờ hoặc xóa.
4. **MP3:** bỏ metadata đã xóa khỏi cloud khỏi thư viện; đổi tên bản đã đồng bộ bằng update-only; giữ bài hiện tại nếu thao tác chuẩn bị bài kế tiếp thất bại; khóa lượt phát mới khi hẹn giờ đã hết.
5. **Các lỗi nhỏ cùng miền:** đưa giao dịch có danh mục đã xóa vào báo cáo thu, cho đặt tên dấu mốc, và dọn vị trí/dấu mốc của file đã xóa.
6. **Rà soát cấu hình:** kiểm tra quyền Lịch theo đúng API đang dùng; chỉ thay cấu hình khi SDK yêu cầu.

## Tiêu chí hoàn tất

- Offline save/edit/delete luôn hiện ngay trên thiết bị và được giữ để đồng bộ lại.
- Xóa đã đồng bộ không bị tái tạo bởi cache cũ; các ghi chú/công việc mới trên phiên bản cũ vẫn được nhập trong lần migration đầu khi cloud chưa có bản ghi tương ứng.
- Tác vụ cloud có thời hạn chờ để giao diện luôn thoát trạng thái đang lưu.
- Reminder và player phản ánh trạng thái mới nhất sau khi tải/đổi bài.
- Kiểm tra kiểu và lint; rà lại diff trước khi bàn giao.
