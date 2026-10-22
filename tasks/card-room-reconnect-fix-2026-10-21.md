# Sửa xung đột lúc vào phòng và kết nối lại — 21/10/2026

## Lỗi người dùng báo

Chủ phòng và bạn chơi có thể thấy “Bàn vừa thay đổi. Đã yêu cầu cập nhật lại”
ngay sau vào phòng. Bấm “Kết nối lại” đưa giao diện về phần tham gia phòng.

## Nguyên nhân đã tái hiện

- Join đọc phiên bản N; chủ phòng sẵn sàng trước khi join commit, đổi thành N+1.
  CAS từ chối join với version-conflict. Ngược lại, ready của chủ phòng trên N
  cũng có thể xung đột khi join vừa tăng phiên bản. CAS thất bại không xóa ghế.
- gameSession chỉ tự xóa lỗi đọc sau sync; lỗi command version-conflict tiếp tục
  hiện ngay cả khi snapshot mới đã được nhận thành công.
- retry không còn pending gọi stop(), xóa snapshot ngay rồi bootstrap. Trong
  lúc đợi subscribe/sync, UI không còn room nên hiện lại phần tham gia.

## Bản sửa

- Kết nối lại giữ snapshot phòng hiện tại và khóa action trong lúc loading.
  SUBSCRIBED chưa đủ để mở nút: phải nhận snapshot mới sau handshake. Header rời
  phòng cũng tạm khóa để tránh navigate sau một leave chưa được gửi. Vẫn cho
  thoát bản xem cache của phòng đã kết thúc.
- stop thật khi blur/background/logout vẫn xóa snapshot, hủy request/timer và
  loại response cũ theo generation. Không đổi quy tắc quyền điều khiển. Nếu read
  có thẩm quyền trả room:null thì vẫn xóa phòng khỏi giao diện.
- Chỉ lỗi version/match/turn cần làm mới mới được xóa sau read bắt đầu sau lỗi
  và được bộ kiểm tra snapshot chấp nhận. Read cũ không xóa lỗi sớm; một command
  mới không bị mất thông báo lỗi hợp lệ bởi read phục hồi cũ. Không tự gửi lại
  ready/play/pass hoặc đổi expectedVersion của các thao tác này.
- Edge thử lại join tối đa3 lần khi commit gặp version-conflict, mỗi lần đọc và
  tính trạng thái mới với cùng actionId/fingerprint. Nếu request trùng đã join
  thành công, đọc lại receipt trước khi kết luận room-full. Không sửa SQL/schema,
  ACL, cách chia bài hoặc các phép tính điểm.

## Kiểm chứng

- Năm regression client fail trước sửa; các trường hợp bổ sung mạng chậm/header
  cũng đã chạy đỏ trước khi thêm guard. Các test kiểm tra cả nhánh host và guest,
  không phát leave/join/create khi reconnect không có command chưa xác nhận,
  giữ lỗi đánh bài không hợp lệ,
  chặn action tới khi sync xong, stop xóa room, và room:null được áp dụng.
- Ba regression PGlite fail trước sửa và qua sau: host ready chen giữa find và
  commit, request cùng actionId chen vào giữa các lần thử, cập nhật liên tiếp
  dừng ở lần thử thứ3. Có kiểm tra chỉ một ghế/receipt, retry giữ ack, và ready
  phiên bản cũ vẫn bị từ chối. Đây là interleaving điều khiển với PostgreSQL nhúng,
  không phải kiểm chứng tải/transport đồng thời trên Supabase thật.
- Command mất ACK vẫn retry với actionId cũ như trước; không tạo action mới để
  vượt qua hàng rào chống thực hiện trùng.
- Reviewer độc lập kiểm tra kế hoạch và delta cuối; lỗi mở action quá sớm khi
  subscribe đã được sửa và kiểm tra lại.
- Kết quả cuối: typecheck và ESLint sáu file thay đổi qua; Jest toàn ứng dụng
  **124 suites / 880 tests qua**; backend **176 tests qua**. Nhóm client/screen
  liên quan có48 test qua trên mã cuối. `git diff --check` qua.
- Expo export offline Android và iOS qua trên mã cuối, output riêng ở
  `/private/tmp/lifemate-room-reconnect-export-final-20261021`.

## Triển khai và giới hạn

Bản sửa nằm ở client và Edge Function `game-access`. Chưa deploy Edge, chưa build/
phát hành app mới, chưa kiểm chứng bằng hai điện thoại thật. Muốn áp dụng đầy đủ
trên bản người dùng đang chạy cần cập nhật cả hai phần. Không cần migration cho
bản sửa này. Các thay đổi working tree có sẵn được giữ nguyên.
