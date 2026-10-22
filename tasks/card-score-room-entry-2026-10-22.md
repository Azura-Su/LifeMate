# Vào lại phòng từ bảng điểm — 22/10/2026

## Yêu cầu và cách xử lý

- Bàn đang chơi không tự gọi room-status khi xem bảng điểm. Bỏ khối lỗi trạng thái phòng và nút Kiểm tra lại.
- Icon Vào lại phòng kiểm tra trạng thái khi bấm. Phòng còn hoạt động thì đi đến luồng tham gia hiện có; phòng hết hạn thì chủ phòng được mở lại bằng version/match ID mới đọc, sau đó vào phòng.
- Người khác chờ chủ phòng mở lại. Phòng đã xóa/không tồn tại báo lỗi sau thao tác; lỗi mạng có thể thử lại bằng cùng icon, không làm mất bảng điểm.
- Một phạm vi busy/controller bao trọn kiểm tra → mở lại → điều hướng; chống bấm lặp và hủy khi blur, unmount hoặc đổi phiên tài khoản.
- Chi tiết lịch sử chỉ đọc trạng thái khi người dùng chủ động mở chi tiết để giữ chức năng quản lý phòng đã kết thúc/đã xóa bảng điểm. Nút tạo lại trong đó cũng xác nhận lại trạng thái khi bấm. Quyền và đồng bộ bảng điểm chung không đổi.

## Kiểm chứng

- Tái hiện bằng test trước sửa: bàn đang chơi tự gọi room-status và chi tiết lịch sử còn nút Kiểm tra lại.
- 59 test / 3 suite (CardScoreScreen, useSharedCardScores, cardScoreStorage) đạt, không cảnh báo act. Bao phủ vào phòng đang mở, mở lại phòng hết hạn cho chủ phòng, khách/phòng mất, thử lại, bấm lặp, hủy trước và sau khi gửi mở lại.
- TypeScript, ESLint file thay đổi và Prettier đạt. Reviewer độc lập duyệt plan và diff cuối, không còn phát hiện cần xử lý.
- Simulator xác nhận bàn đang chơi còn icon vào lại, không còn dòng trạng thái hoặc nút Kiểm tra lại. Không mở lại phòng thật để kiểm thử; luồng server được kiểm tra bằng mock trong Jest. Không sửa/deploy backend hoặc dữ liệu điểm.
