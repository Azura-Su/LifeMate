# Lịch sử sửa/xóa — lọc thao tác chủ phòng và sửa cuộn

- Chỉ đổi trình bày CardScoreAuditDialog. Sự kiện hệ thống có actorUid:null bị
  ẩn cả từ audit cache lẫn dữ liệu server. Giữ thao tác của các chủ phòng trước;
  không dùng actorName để lọc vì người dùng có thể đặt tên Hệ thống.
- Giữ toàn bộ audit gốc, API, pagination, server authorization và dữ liệu điểm.
  Khi trang hiện tại chỉ có hệ thống nhưng còn cursor, thông báo rõ chỉ chưa có
  thao tác trong phần đã tải, vẫn hiện nút tải trước; không kết luận toàn bộ rỗng.
- Popup có height=min(windowHeight*0.85,640), maxHeight100% vùng chứa, list flex1
  minHeight0, heading/close nằm ngoài scroll. Có test với40 events ở320 và844px.
- Test mới bao gồm system/manual, chủ cũ, người có tên Hệ thống, pagination qua
  trang toàn system và cấu trúc viewport cuộn. Typecheck/lint/diff-check đạt.
- Simulator đang ở bàn game khi quan sát; chưa kiểm tra thao tác cuộn thật trong
  popup sau sửa. Không tác động điểm hoặc tạo/xóa dữ liệu thật.
- Kết quả:68/68 tests của AuditDialog+CardScoreScreen đạt ở lượt chạy lại. Lượt
  đầu có1 timeout test xóa bàn thủ công; chạy riêng nhóm xóa13/13 đạt rồi chạy lại
  cả2 suite68/68 đạt. Không sửa/giảm timeout hoặc thay đổi test xóa có sẵn.
