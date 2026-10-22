# Sắp xếp bảng điểm và lịch sử — 22/10/2026

Cập nhật tiếp theo: [Vào lại phòng từ bảng điểm](card-score-room-entry-2026-10-22.md) chuyển kiểm tra trạng thái phòng của bàn đang chơi sang lúc bấm icon và bỏ khối Kiểm tra lại.

## Yêu cầu và bản sửa

- Thu gọn tạo bàn khi đã có lịch sử. Thẻ lịch sử chỉ hiển thị tên, thời gian/số ván, điểm tổng và thao tác có nhãn; không còn cụm lỗi đồng bộ, nút vào phòng và nút audit màu vàng toàn chiều ngang.
- Chạm tên/mũi tên để xem ma trận chỉ đọc ngay trong thẻ. Nút **Mở lại bàn** chuyển cùng bàn đó ra khỏi lịch sử, chọn bàn ở khu vực đang chơi và cho thêm/sửa điểm. Đồng bộ bảng điểm và kiểm tra phòng chỉ xuất hiện trong bảng đang mở. Room status chỉ truy vấn các bàn đang mở; lỗi được gắn theo room ID để không tràn sang bàn khác.
- Các bản online cũ trên thiết bị chỉ được chuyển lên đang chơi khi người dùng chủ động Mở lại bàn. Lưu cờ localScoreEditable, giữ ID/người chơi/điểm/audit và trạng thái sau khi tải lại; sửa điểm lưu trên thiết bị, không tạo bảng chung hay cho phép chỉnh điểm cloud. Kết thúc đưa bàn về lịch sử. Xóa dùng storage tombstone hiện có, giữ audit và marker chống replay; khôi phục giữ trạng thái finished và nội dung điểm trước khi người dùng mở lại. Xóa bản lưu không xóa phòng.
- Bảng chung vẫn cần grant chủ phòng còn hiệu lực để sửa/xóa/khôi phục; thao tác tiếp tục bàn thủ công và bảng chung được giữ. Không hiển thị icon bị khóa nhưng thiếu giải thích cho khách.
- Tạo lại/xóa phòng có kiểm tra quyền vẫn nằm trong chi tiết lịch sử, kể cả bảng điểm đã kết thúc hoặc đã xóa. Không yêu cầu khôi phục bảng điểm trước khi quản lý phòng. Vào lại chỉ ở bảng đang hoạt động, không ở lịch sử.
- Audit dùng link đồng hồ và dialog gọn: người thực hiện, thời gian, tiêu đề thay đổi và điểm trước/sau riêng từng dòng. Không đổi số điểm, cách tính, revision, audit hay quyền server.

## Kiểm chứng

- Reviewer độc lập duyệt plan và diff cuối. Đã xử lý góp ý giữ quản lý phòng độc lập với trạng thái bảng điểm và tombstone.
- 50 test/3 suite: CardScoreScreen, useSharedCardScores, cardScoreStorage đều đạt, không cảnh báo act. Có regression legacy mở lại → sửa ván cũ → thêm ván → tải lại → kết thúc về lịch sử; cờ sửa local không cấp quyền bảng chung; xóa/khôi phục + audit, ẩn rejoin ở lịch sử, recovery đúng vùng, khách không được xóa/mở lại bảng chung và tạo lại phòng từ bảng điểm đã xóa.
- TypeScript, ESLint các file thay đổi và diff whitespace: đạt.
- Quan sát trực tiếp Simulator iPhone 17 Pro Max: màn tổng quan thu gọn, mở ma trận, popup audit và thu lại lịch sử. Sau bản sửa Mở lại bàn, xác nhận giao diện bàn đang chơi có điểm cũ và nút Thêm ván/Sửa điểm, không còn bản đó trong lịch sử. Không thao tác xóa dữ liệu thật trong Simulator.
- Không thay đổi/deploy server, schema hoặc storage service. Các bảng chung chỉ đọc khi chưa xác nhận được quyền/kết nối; UI không tự cấp quyền khi cloud chưa hỗ trợ API.
