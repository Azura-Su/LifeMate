# Xóa dữ liệu lịch sử bàn chơi — 22/10/2026

Yêu cầu: xóa dữ liệu lịch sử bàn chơi trong database cho tất cả người chơi.
Thực hiện trực tiếp trên Supabase LifeMate `xbhelntqytleiduzicuj`.

## Phạm vi và kết quả

Đã hard-delete trong một transaction đã commit:

| Dữ liệu | Số bản ghi xóa |
| --- | ---: |
| Bảng điểm lịch sử (đều đã có `deleted_at`) | 6 |
| Các ván điểm nằm trong sáu bảng trên | 6 |
| Lịch sử chỉnh sửa bảng điểm | 15 |
| Receipt sửa/xóa bảng điểm | 12 |
| Phòng cũ liên quan, không còn người/người chơi đang đánh | 6 |
| Receipt thao tác của các phòng trên | 112 |
| Kết quả ván cũ, không thuộc bảng/phòng được giữ | 20 |

Database còn **0 bảng có status finished hoặc deleted_at**, **0 score event**, **0 score receipt**.
Giữ một bảng điểm đang active, một phòng nguồn và một kết quả ván của bảng đó.
Hash toàn bộ dòng bảng điểm/phòng được giữ khớp trước và sau thao tác.

Giữ sáu marker xóa phòng tối thiểu theo cơ chế retry hiện có (ID, UID, action và
fingerprint; không có tên, điểm, kết quả hoặc nội dung audit). Marker ngăn request
tạo phòng cũ gửi lại làm sống lại dữ liệu. Xóa phòng nguồn cũng ngăn trigger tạo
lại bảng điểm vừa xóa. Không thay schema, quyền, tài khoản hoặc dữ liệu tính năng khác.

## Kiểm chứng

- Review độc lập kế hoạch và SQL cụ thể trước khi thực hiện.
- Kiểm tra schema, FK cascade và hàm đang deploy trên production.
- Scope cố định theo UUID tại `2026-10-22T04:52:07.495797Z`; kiểm tra lại số bản ghi,
  trạng thái, người đang ngồi và liên kết kết quả trước khi xóa.
- Lock phòng trước bảng điểm; `lock_timeout=3s`, `statement_timeout=20s`.
- Chạy cùng transaction với `ROLLBACK` trước: các hậu điều kiện trong transaction đạt;
  query sau rollback xác nhận toàn bộ dữ liệu gốc và hash được giữ nguyên.
- Chạy lại với `COMMIT`: mọi hậu điều kiện đạt. Một query độc lập sau commit xác nhận
  các đối tượng trong scope đều còn 0 bản ghi; dữ liệu active giữ nguyên.
- `git diff --check` đạt. Không sửa app/backend code, không deploy hoặc chạy migration.

[SQL rehearsal](card-history-purge-2026-10-22.sql) cố ý kết thúc bằng `ROLLBACK`,
không nằm trong thư mục migration. Lần thực hiện thật chỉ thay kết thúc transaction
thành `COMMIT` sau khi rehearsal và review đạt. Không dùng script để xóa dữ liệu mới.

## Giới hạn trên thiết bị

Đã xóa sáu bảng điểm lịch sử trong phạm vi xác định khỏi server; giữ nguyên một
bảng active cùng dữ liệu của bảng đó. Bảng active này vẫn có thể nằm trong lịch sử
cục bộ của người đã đặt `localFinished`; server không biết cờ riêng trên máy đó.
Client đang kết nối sẽ bỏ các cache `sharedVersion` đã mất khi `score-list` đồng bộ thành công
(thường mỗi 10 giây khi màn đang focus/foreground, hoặc khi quay lại màn).
Không khẳng định đã quan sát từng điện thoại hoặc gọi API bằng phiên đăng nhập từng người.

Bàn thủ công, bản online legacy không có `sharedVersion`, cờ `localFinished`, cùng
cache trên thiết bị offline nằm trong vùng lưu trữ riêng của từng máy. Thao tác DB
không thể xóa vật lý các bản này từ xa; ứng dụng hiện chưa có cơ chế purge toàn bộ
lịch sử cục bộ trên mọi thiết bị. Giới hạn này đã được thông báo trước khi xóa.

Final review đã được xử lý: thu hẹp tuyên bố hoàn thành theo đúng scope sáu bảng
được xóa và dữ liệu active được giữ; không khẳng định đã xóa mọi bản offline.

## Cập nhật tiếp theo — 2026-10-22 05:25 UTC

Kiểm tra lại lịch sử người dùng còn nhìn thấy phát hiện một bảng điểm online mang
trạng thái `active`, nhưng phòng `5BBZAX9K` đã `closed`, không còn thành viên hay ghế.
Xóa thêm đúng một bảng điểm, một phòng, một kết quả và 17 receipt của phòng; không
có score event hoặc score receipt. Transaction có khóa, kiểm tra hash và phạm vi
cố định, đã rehearsal với `ROLLBACK`, xác nhận dữ liệu không đổi rồi mới chạy lại
và `COMMIT`. Giữ một marker xóa phòng để request trễ không tạo lại phòng.

Sau follow-up, các ID của bảy bảng/phòng cũ và 21 kết quả đã xóa đều không còn.
Không có bảng điểm `finished` hoặc đã xóa trên Supabase lúc xác minh. Một client
khác tạo phòng mới lúc 05:32 UTC sau lần dọn này; phòng mới có hai ghế, một ván và
đang nằm ngoài phạm vi dọn lịch sử cũ nên được giữ nguyên.

Đã kiểm tra Firestore project `baseapp-dd227`: các collection của app không có
collection lịch sử trò chơi hoặc tính điểm. Dữ liệu lịch sử còn lại trên điện thoại
nằm trong AsyncStorage mã hóa theo tài khoản. App nay xóa bản lưu lịch sử cũ và
cache của các phòng đã purge khi màn Tính điểm đọc dữ liệu; bảng đang chơi và bảng
được sửa sau thời điểm dọn được giữ. Mỗi thiết bị phải chạy bản app có thay đổi này
để cache offline riêng trên thiết bị đó được xóa.

Kiểm tra code: typecheck đạt; 98 test storage, đồng bộ và màn Tính điểm đạt; ESLint
cho các file thay đổi đạt. Independent reviewer không khởi chạy được trên host này
vì tài khoản ChatGPT không hỗ trợ model `gpt-6.1-sol`; đã tự review SQL cố định và
chạy rehearsal rollback trước commit.
