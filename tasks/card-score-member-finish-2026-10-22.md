# Giữ Kết thúc cho thành viên — 22/10/2026

- Thành viên vẫn thấy Kết thúc. Bốc thăm, Thêm ván, xóa ván và quản lý người chơi tiếp tục chỉ dành cho chủ phòng.
- Với thành viên hoặc bảng online chưa xác nhận quyền sửa, Kết thúc chỉ đưa bảng vào lịch sử của UID trên thiết bị. Không sửa status/điểm/audit/revision cloud, không gửi score-write và không kết thúc phòng.
- Cờ localFinished lưu trong cache mã hóa UID, được giữ qua tải lại/đồng bộ; không nhận cờ này từ dữ liệu server. Mở lại bàn chỉ bỏ cờ local và không cấp quyền sửa.
- Ý định kết thúc local/chung cùng UID+epoch được cố định khi mở xác nhận. Chủ phòng giữ luồng kết thúc bảng chung và kiểm tra quyền hiện có.
- Khi chủ phòng mở lại/khôi phục bảng đã kết thúc hoặc xóa từ server, bỏ cờ local để bảng được hiển thị đang chơi. Bàn thủ công giữ hành vi hiện có.

## Kiểm chứng

- 3 test tái hiện trước sửa thất bại, sau sửa đạt. Regression bao gồm thành viên bảng chung/bản cũ kết thúc → reload → mở lại chỉ xem; cache và UID isolation; remote finish/delete → owner resume/restore; lỗi ghi local có thể thử lại.
- Reviewer chỉ đọc duyệt plan và diff. Góp ý về bỏ cờ local sau owner restore đã được sửa và kiểm tra; reviewer xác nhận không còn phát hiện cần xử lý, không tự chạy test.
- TypeScript, ESLint các file bị ảnh hưởng và whitespace check đạt.
- Không thay đổi/deploy server hoặc cài app; chưa kiểm tra bản sửa trên thiết bị thật.
- Snapshot: `/private/tmp/lifemate-member-finish-20261022-v1`; diff riêng: `/private/tmp/lifemate-member-finish-delta.patch`.
- Toàn bộ Jest: **127 suite / 922 test đạt**.
