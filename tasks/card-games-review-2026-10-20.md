# Review game và tính điểm — 20/10/2026

## Phạm vi

Rà luật Tiến lên miền Nam, vòng đời phòng, session/retry/Realtime, UI thao tác,
bảng điểm cục bộ, đồng bộ kết quả và dữ liệu tài khoản. Hai reviewer độc lập
rà backend và client; main agent kiểm tra bảng điểm, thực hiện sửa và xác minh.
Giữ các thay đổi game/UI đang có trong working tree.

## Lỗi đã sửa

- Hết lease của mọi ghế làm đóng phòng đã kết thúc quá sớm. Giữ phòng để vào lại
  đến hạn phòng; vẫn đóng khi thực sự hết hạn. Test cả worker và lookup SQL.
- Đồng bộ tự chuyển bảng điểm đã kết thúc về active và ghi lại cache dù không có
  thay đổi. Giữ trạng thái do người dùng chọn và tránh ghi cache giống hệt.
- Rời phòng kết thúc bảng cục bộ trước khi biết request leave có được gửi/chấp nhận
  hay không. Bảng chỉ kết thúc qua thao tác Kết thúc của người dùng.
- Trùng tên và trùng đuôi UID làm đồng bộ bảng điểm thất bại. Sinh tên phân biệt
  bằng vòng kiểm tra va chạm.
- Hơn tám người từng tham gia một phòng làm các ván sau bị bỏ qua. Giữ đầy đủ
  cột lịch sử của bảng online; bàn thủ công vẫn tối đa tám người.
- Native Alert cũ có thể xóa dữ liệu sau khi đã đổi tài khoản. Kiểm tra UID và
  sessionEpoch trước thao tác và sau await; bỏ thông báo đồng bộ của phiên cũ.
- Xóa tài khoản sót định danh trong scoreMembers sau khi người đó rời phòng và
  có ván mới. Migration mới dọn bản ghi lịch sử và giữ ván hiện tại của người khác.
  Tăng room.version, hủy worker claim và phát hint để request cũ không ghi lại dữ liệu.
- Test màn chọn trò dùng API truy vấn không hợp lệ và kỳ vọng UI/payload cũ.

## Kiểm chứng

- Test hồi quy đã thất bại trước sửa: finished sync, duplicate name, ninth historical
  participant, stale native delete confirmation, premature finish-on-leave,
  lease expiry, historical score erasure, stale member/worker write fencing.
- 73 test Jest thuộc 11 suite game/score/navigation: pass.
- npm run test:functions: 140/140 pass, gồm kiểm thử SQL bằng PGlite.
- npm run typecheck: pass. ESLint các module game/score: pass.
- npm run bundle: xuất iOS và Android thành công.
- Simulator iOS: mở/đóng popup Thêm ván và xác nhận trở lại bảng điểm; không lưu
  điểm hoặc thay đổi dữ liệu phòng đang có.
- Review cuối: không còn phát hiện cần sửa từ hai reviewer.

## Giới hạn và triển khai

Chưa deploy các sửa backend trong lượt review này. Cần áp dụng
20261020092913_card_game_score_erasure.sql và deploy game-access để thay đổi server
có hiệu lực. Chưa kiểm chứng nhiều thiết bị thật, runtime Android hoặc concurrency
trên PostgreSQL production. Suite navigation pass nhưng vẫn phát cảnh báo Expo Go
notification và React act từ quá trình chạy test.
