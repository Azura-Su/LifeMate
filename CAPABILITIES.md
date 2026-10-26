# LifeMate — phạm vi

| Module              | Trách nhiệm                                                                                                               | Phụ thuộc                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| identity            | Firebase Auth, phiên đăng nhập, logout                                                                                    | foundation                                                                                |
| profile             | Remote Config `users`, ánh xạ tên theo email                                                                              | identity                                                                                  |
| notifications       | Quyền nhận push, FCM token, nhận/mở thông báo                                                                             | identity                                                                                  |
| shell               | Login, tab Home/Tài chính/Ký ức/MP3, menu Home (Ghi chú, Danh sách chuẩn bị, Ghi điểm bài, Cài đặt, Đăng xuất), nhận diện | identity, profile, notifications, finance-ledger, memories, notes, card-score, checklists |
| memories            | Camera nhanh, ảnh/chữ/ngày, sửa/xóa; riêng tư mặc định, chia sẻ bạn bè qua email                                          | identity, profile                                                                         |
| finance-ledger      | Giao dịch theo UID, Firestore/cache, tổng tháng và báo cáo thu/chi theo năm hoặc khoảng tháng                             | identity                                                                                  |
| finance-privacy     | Khóa tab Tài chính bằng xác thực hệ điều hành, chặn chụp màn hình; thiết lập SecureStore riêng UID/thiết bị               | identity, finance-ledger                                                                  |
| finance-quick-entry | Sửa/tìm giao dịch, danh mục tùy chỉnh và mẫu nhập theo UID trên Firestore, có cache mã hóa trên thiết bị                  | identity, finance-ledger                                                                  |
| finance-loan-ledger | Khoản cho vay, số còn phải thu, nhắc hạn cục bộ và các lần nhận lại liên kết với Tài chính                                | identity, finance-ledger, notifications                                                   |
| audio-media         | Đọc media, tách tiếng, cắt và nối audio trên thiết bị                                                                     | foundation                                                                                |
| audio-library       | Thư viện riêng, bản local bền vững, Storage/Firestore                                                                     | identity, audio-media                                                                     |
| audio-editor        | Chọn file, nghe, chọn đoạn và thứ tự ghép trong tab MP3                                                                   | audio-library                                                                             |
| audio-learning      | Hẹn giờ dừng, nhớ vị trí, đánh dấu đoạn và tốc độ phát                                                                    | identity, audio-library                                                                   |
| notes               | Ghi chú riêng theo UID, Firestore/cache, tìm và sửa                                                                       | identity                                                                                  |
| agenda              | Việc có ngày đến hạn, nhắc cục bộ, mở trình tạo sự kiện của lịch hệ thống                                                 | identity, notifications                                                                   |
| home-today          | Thẻ Lịch/Việc trên Home; sheet lịch âm–dương, ngày lễ, ghi chú theo ngày và việc trong ngày                               | agenda, shell                                                                             |
| card-score          | Bảng điểm chung cho mọi trò: ma trận theo ván/người chơi, nhập điểm nhanh, bốc thăm và lịch sử mã hóa theo UID            | identity, shell                                                                           |
| card-games          | Tiến lên miền Nam online 2–4 người qua mã phòng; đang kiểm chứng, mặc định tắt. Miền Bắc và Phỏm ở giai đoạn sau          | identity, shell, Supabase Postgres/Edge/Realtime                                             |
| checklists          | Danh sách mua sắm/chuẩn bị theo mẫu, số lượng, đánh dấu hoàn tất, dùng lại và lưu mã hóa offline theo UID                 | identity, shell                                                                           |

Thứ tự: foundation → identity → profile → notifications → shell → kiểm thử.
Người dùng yêu cầu lập plan rồi thực hiện trong cùng lượt. Tiến hành theo phạm vi này, không chờ duyệt lại.

Mở rộng 07/10/2026: audio-media → audio-library → audio-editor. Người dùng xác nhận thư viện riêng và nối âm thanh lần lượt.

Mở rộng 08/10/2026: finance-ledger → tổng tháng trên Home và ba chế độ Tài chính. Hook account chung chặn dữ liệu khác UID ngay khi render.

Mở rộng 08/10/2026: finance-quick-entry → audio-learning → notes → agenda → home-today. Đặc tả và kế hoạch chi tiết trong [SPEC-life-utilities.md](SPEC-life-utilities.md) và [tasks/lifemate-utilities-plan.md](tasks/lifemate-utilities-plan.md).

Cập nhật 09/10/2026: bỏ tổng tháng Tài chính khỏi Home; Home chỉ còn lời chào, ngày âm–dương và hai thẻ Lịch/Việc. Tổng quan tài chính chỉ có trong tab Tài chính.

Cập nhật 10/10/2026: thêm tiện ích Bảng điểm bài dùng chung trong menu bên Home. Điểm từng ván được nhập thủ công theo luật bàn; dữ liệu lưu mã hóa cục bộ theo UID. Đặc tả và kế hoạch ở [SPEC-card-score.md](SPEC-card-score.md) và [tasks/card-score-plan-2026-10-10.md](tasks/card-score-plan-2026-10-10.md).

Cập nhật 11/10/2026: thêm Danh sách chuẩn bị trong menu bên Home, có mẫu Mua sắm/Đi du lịch/Về quê, số lượng, tiến độ, sửa/xóa mục và tạo bản dùng lại. Danh sách được mã hóa và lưu trên thiết bị theo UID để dùng offline; hiện chưa đồng bộ giữa các thiết bị. Đặc tả và kế hoạch ở [SPEC-checklists.md](SPEC-checklists.md) và [tasks/checklists-plan-2026-10-11.md](tasks/checklists-plan-2026-10-11.md).

Cập nhật 13/10/2026: mục Cho vay trong Tài chính theo dõi khoản phải thu, từng lần cho vay thêm và từng lần nhận lại; các khoản liên kết với giao dịch Tài chính, nhắc hạn tùy chọn trên thiết bị. Mỗi mục lịch sử có thao tác sửa/xóa. Thiết kế ban đầu ở [tasks/loan-ledger-plan-2026-10-11.md](tasks/loan-ledger-plan-2026-10-11.md) và [tasks/loan-ledger-todo-2026-10-11.md](tasks/loan-ledger-todo-2026-10-11.md).

Cập nhật26/10/2026: pet-catalog → pet-genetics → pet-presentation → pet-collection → pet-experience. Tạo pet lai chibi3D từ1–3 loài, DNA có version/seed, animation và kỹ năng; một pet mỗi tài khoản, đổi tên/xóa, Firestore singleton + cache mã hóa offline. Đặc tả [SPEC-pets.md](SPEC-pets.md); phạm vi kiểm chứng [tasks/chibi-hybrid-pets-todo-2026-10-26.md](tasks/chibi-hybrid-pets-todo-2026-10-26.md).
