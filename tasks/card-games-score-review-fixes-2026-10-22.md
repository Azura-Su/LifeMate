# Sửa lỗi sau review trò chơi và tính điểm — 22/10/2026

Theo [review toàn bộ logic](card-games-score-full-review-2026-10-22.md), sửa đúng bốn lỗi P2:

1. Back Android và nút header dùng cùng một handler xác nhận. Listener chỉ tồn tại khi
   màn đang active, dọn khi blur/background/unmount. Chờ snapshot mới vẫn khóa thao tác;
   lỗi nối lại và cache dùng luồng quay lại cục bộ, không giả báo đã gửi leave.
2. Status phòng trống còn hạn chỉ cho chủ phòng vào trước. Thành viên nhận thông báo chờ
   chủ phòng, không điều hướng sang game hoặc tự reopen. Chủ vào lại xong thì thành viên
   có thể vào bình thường; hết hạn 30 phút vẫn chỉ chủ phòng được mở lại.
3. Quản lý bảng chung có `sharedVersion` dùng tối thiểu một người; có thể sửa tên chủ phòng
   khi đang một mình hoặc xóa người thứ hai. Xóa điểm đã ghi vẫn cần xác nhận.
4. Hai ô tên của bảng chung giới hạn 30 ký tự; validator kiểm tra độ dài và ký tự điều khiển/ẩn
   trước khi gửi. Giới hạn hai người và ô tên 32 ký tự của bàn thủ công/legacy giữ nguyên.

Không thay engine, cách tính tiền/điểm, receipt, owner authority, luật ready/start,
xóa bảng điểm hoặc dữ liệu phòng đang có. Giữ các thay đổi working tree có sẵn.
Baseline riêng để review phần thay đổi được lưu tại `/private/tmp/lifemate-card-review-fixes-20261022/before/`.

## Migration và triển khai

CLI tạo `20261022040203_card_game_empty_room_rejoin_status.sql`; không sửa migration đã phát hành.
Chỉ thay hàm đọc trạng thái cùng signature, giữ `SECURITY DEFINER`, search_path rỗng và
quyền gọi service-only như cũ. Không đụng dữ liệu hoặc nới điều kiện find/join/reopen.

Migration **chưa áp dụng lên production**; chưa deploy Firebase/Supabase trong lượt fix này.
App cần bản JS mới; phần status phòng cần migration này trên server để hoạt động đầy đủ.
Không chạy `db push` toàn repo vì lịch sử triển khai thủ công còn cần đối chiếu.

## Kiểm chứng

- Đã thấy RED trước sửa: 3 ca Back Android; 6 ca về số người/tên chung;
  2 ca SQL phòng trống lobby/finished; 1 ca UI chờ chủ phòng.
- SQL chạy tự nhiên create → join → leave hết → status/find, sau đó chủ join rồi thành viên join.
  Kiểm tra cả outsider; các test cũ tiếp tục kiểm tra hết hạn, xóa, quyền và RLS.
- UI bao phủ back lobby/playing, cache, lỗi nối lại, loading và dọn listener;
  sửa tên một người, xóa người thứ hai có xác nhận, giới hạn tên 30/31 và ký tự ẩn,
  giữ 32 ký tự/tối thiểu hai người cho manual/legacy.
- Plan review và final diff review độc lập đã hoàn tất, không còn phát hiện cần xử lý.
- Jest toàn bộ vùng trò chơi/tính điểm, hooks, config và utils: **21 suite / 217 ca đạt**.
- `npm run test:functions`: **195 ca đạt**, gồm hai regression SQL mới cho phòng trống
  lobby/finished, quyền truy cập và các luồng backend hiện có.
- `npm run typecheck`, ESLint các file code/test bị sửa và `git diff --check`: đạt.
- `npm run bundle`: xuất bundle iOS và Android thành công.

Một lượt Jest chạy cùng typecheck/lint có timeout ở một số ca UI cũ. Chạy lại riêng
CardScore rồi chạy toàn bộ phạm vi trên đều đạt; không tăng timeout hay nới kiểm tra.

ADB có sẵn nhưng không có thiết bị/emulator đang kết nối; chưa kiểm tra Back bằng thao tác
trên thiết bị Android thật. Bridge handler được kiểm tra bằng Jest; kiểm tra bundle hai nền tảng riêng.
