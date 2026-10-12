# LifeMate — phạm vi

| Module              | Trách nhiệm                                                                                                         | Phụ thuộc                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| identity            | Firebase Auth, phiên đăng nhập, logout                                                                              | foundation                                                                      |
| profile             | Remote Config `users`, ánh xạ tên theo email                                                                        | identity                                                                        |
| notifications       | Quyền nhận push, FCM token, nhận/mở thông báo                                                                       | identity                                                                        |
| shell               | Login, tab Home/Tài chính/MP3, menu Home (Ghi chú, Danh sách chuẩn bị, Ghi điểm bài, Cài đặt, Đăng xuất), nhận diện | identity, profile, notifications, finance-ledger, notes, card-score, checklists |
| finance-ledger      | Giao dịch theo UID, Firestore/cache, tổng tháng và báo cáo thu/chi theo năm hoặc khoảng tháng                       | identity                                                                        |
| finance-privacy     | Khóa tab Tài chính bằng xác thực hệ điều hành, chặn chụp màn hình; thiết lập SecureStore riêng UID/thiết bị         | identity, finance-ledger                                                        |
| finance-quick-entry | Sửa/tìm giao dịch, danh mục tùy chỉnh và mẫu nhập theo UID trên thiết bị                                            | identity, finance-ledger                                                        |
| finance-loan-ledger | Khoản đã cho mượn, số còn phải thu, nhắc hạn cục bộ và các lần nhận tiền liên kết với Tài chính                         | identity, finance-ledger, notifications                                       |
| audio-media         | Đọc media, tách tiếng, cắt và nối audio trên thiết bị                                                               | foundation                                                                      |
| audio-library       | Thư viện riêng, bản local bền vững, Storage/Firestore                                                               | identity, audio-media                                                           |
| audio-editor        | Chọn file, nghe, chọn đoạn và thứ tự ghép trong tab MP3                                                             | audio-library                                                                   |
| audio-learning      | Hẹn giờ dừng, nhớ vị trí, đánh dấu đoạn và tốc độ phát                                                              | identity, audio-library                                                         |
| notes               | Ghi chú riêng theo UID, Firestore/cache, tìm và sửa                                                                 | identity                                                                        |
| agenda              | Việc có ngày đến hạn, nhắc cục bộ, mở trình tạo sự kiện của lịch hệ thống                                           | identity, notifications                                                         |
| home-today          | Thẻ Lịch/Việc trên Home; sheet lịch âm–dương, ngày lễ, ghi chú theo ngày và việc trong ngày                         | agenda, shell                                                                   |
| card-score          | Bảng điểm chung cho mọi trò: ma trận theo ván/người chơi, nhập điểm nhanh, bốc thăm và lịch sử mã hóa theo UID      | identity, shell                                                                 |
| checklists          | Danh sách mua sắm/chuẩn bị theo mẫu, số lượng, đánh dấu hoàn tất, dùng lại và lưu mã hóa offline theo UID           | identity, shell                                                                 |

Thứ tự: foundation → identity → profile → notifications → shell → kiểm thử.
Người dùng yêu cầu lập plan rồi thực hiện trong cùng lượt. Tiến hành theo phạm vi này, không chờ duyệt lại.

Mở rộng 07/10/2026: audio-media → audio-library → audio-editor. Người dùng xác nhận thư viện riêng và nối âm thanh lần lượt.

Mở rộng 08/10/2026: finance-ledger → tổng tháng trên Home và ba chế độ Tài chính. Hook account chung chặn dữ liệu khác UID ngay khi render.

Mở rộng 08/10/2026: finance-quick-entry → audio-learning → notes → agenda → home-today. Đặc tả và kế hoạch chi tiết trong [SPEC-life-utilities.md](SPEC-life-utilities.md) và [tasks/lifemate-utilities-plan.md](tasks/lifemate-utilities-plan.md).

Cập nhật 09/10/2026: bỏ tổng tháng Tài chính khỏi Home; Home chỉ còn lời chào, ngày âm–dương và hai thẻ Lịch/Việc. Tổng quan tài chính chỉ có trong tab Tài chính.

Cập nhật 10/10/2026: thêm tiện ích Bảng điểm bài dùng chung trong menu bên Home. Điểm từng ván được nhập thủ công theo luật bàn; dữ liệu lưu mã hóa cục bộ theo UID. Đặc tả và kế hoạch ở [SPEC-card-score.md](SPEC-card-score.md) và [tasks/card-score-plan-2026-10-10.md](tasks/card-score-plan-2026-10-10.md).

Cập nhật 11/10/2026: thêm Danh sách chuẩn bị trong menu bên Home, có mẫu Mua sắm/Đi du lịch/Về quê, số lượng, tiến độ, sửa/xóa mục và tạo bản dùng lại. Danh sách được mã hóa và lưu trên thiết bị theo UID để dùng offline; hiện chưa đồng bộ giữa các thiết bị. Đặc tả và kế hoạch ở [SPEC-checklists.md](SPEC-checklists.md) và [tasks/checklists-plan-2026-10-11.md](tasks/checklists-plan-2026-10-11.md).

Cập nhật 11/10/2026: thêm Sổ cho mượn trong Tài chính; theo dõi khoản phải thu, ghi tiền đưa đi thành khoản chi liên kết, nhận tiền từng phần thành khoản thu riêng và nhắc ngày hẹn tùy chọn trên thiết bị. Có thể sửa tiền gốc cùng khoản chi và xóa cả khoản chi khi xóa hồ sơ chưa từng nhận lại tiền. Thiết kế và checklist ở [tasks/loan-ledger-plan-2026-10-11.md](tasks/loan-ledger-plan-2026-10-11.md) và [tasks/loan-ledger-todo-2026-10-11.md](tasks/loan-ledger-todo-2026-10-11.md).
