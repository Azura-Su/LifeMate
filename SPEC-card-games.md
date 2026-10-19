# Chơi bài online

Người dùng đã chấp thuận kế hoạch ngày 19/10/2026. Triển khai miền Nam trước, sau đó miền Bắc và Phỏm. Mọi tài khoản LifeMate có mã phòng đều vào được phòng còn chỗ; không yêu cầu kết bạn. Giữ công cụ Ghi điểm bài thủ công và dữ liệu cũ.

## Trải nghiệm

Home → Ghi điểm bài → Chơi online → Tạo phòng / Nhập mã → Sẵn sàng → Bắt đầu → Chơi → Kết quả / Ván tiếp. Phòng 2–4 người, mã 8 ký tự dễ đọc. Không có khán giả, bot, tiền cược hoặc giao dịch Tài chính. Trò chưa triển khai không được tạo phòng.

Mỗi người thấy bài mình, số lá của đối thủ, bộ trên bàn, lượt và thời gian còn lại. Chọn lá rồi Đánh hoặc Bỏ lượt. Thao tác chờ máy chủ không xóa lá sớm, không loading lại cả bàn. Nút và lá chạm được có nhãn trợ năng; màn dọc, chữ lớn, bàn phím và safe area được kiểm tra.

## Hợp đồng máy chủ

- Firebase xác thực người chơi. Postgres là nguồn trạng thái duy nhất. Edge xác thực hành động và gọi engine thuần; RPC service-only commit bằng compare-and-swap version trong transaction.
- Mỗi command có actionId UUID ổn định khi retry, payload fingerprint; lệnh tác động phòng và takeover bắt buộc roomId. Các lệnh đổi trạng thái còn có expectedVersion và matchId. UID/authTime lấy từ JWT đã xác minh; không nhận từ client. Receipt trả ack ban đầu, còn snapshot luôn được kiểm tra quyền và lọc theo người đang gọi.
- Commit khóa phòng và kiểm tra tài khoản hiện tại, `valid_since <= authTime`, thành viên, phiên điều khiển và deadline; khóa dòng tài khoản đồng bộ với thao tác khóa/mở tài khoản. RLS Realtime cũng kiểm tra issuer/audience/sub/auth_time và cutoff thu hồi token.
- Một ghế/UID, một phòng đang tham gia/UID, một phiên điều khiển/UID. Thiết bị khác chỉ tiếp quản sau thao tác rõ ràng; phiên trước không được gửi action nữa.
- Không expose row chứa tay bài/nọc/entropy. Snapshot allowlist gồm người chơi trong phòng, số lá, lượt, bộ đang đánh, kết quả và tay của người gọi. Không log bài, email, mã phòng hay token.
- Realtime private chỉ gửi version/epoch; client mở listener, chờ SUBSCRIBED rồi sync. Lease foreground phát hiện event thất lạc. Khi xoay epoch, thành viên còn quyền handshake lại qua metadata kiểm tra membership; người mất quyền không đọc được snapshot.
- Khi blur/inactive/background/logout: hủy request, kết nối và timer render. Logout/UID đổi xóa cả tay bài và bỏ response phiên cũ. Server vẫn xử lý timeout khi không có client.
- Lượt 30 giây, lease kết nối 90 giây, phòng chờ hết hạn sau 30 phút không có hoạt động hợp lệ. Timeout có vòng đang đánh thì bỏ lượt; mở vòng thì đánh lá nhỏ nhất hợp lệ. Bỏ cuộc đứng sau người còn chơi, theo thứ tự bỏ cuộc ngược lại; không được tính thắng vì tự thoát.
- Feature flag client/server mặc định tắt. Chỉ bật sau kiểm tra SQL thật, Firebase/Realtime thật, native và review. Không tạo dữ liệu tài khoản thật làm fixture.
- Xóa tài khoản đóng/xóa phòng tạm có bài của tài khoản đó và xóa summary/receipt liên quan trước khi báo hoàn tất dọn dữ liệu; người khác trong phòng được báo phòng đã đóng. Khóa tài khoản chỉ thu hồi quyền và xử bỏ cuộc, không xóa dữ liệu bảng điểm thủ công.

## Module và kiểm chứng

Các module và dependency theo `tasks/card-games-plan-2026-10-19.md`; bộ luật miền Nam chi tiết ở `SPEC-rules-tien-len-south.md`. Engine server nằm dưới `supabase/functions/game-access/`, test Node bên `supabase/functions/tests/`; client types/service/hook/UI dưới `src/`. Engine không phụ thuộc React, database hay token.

Lệnh: `npm run test:functions`; `npm run typecheck`; `npx eslint <file thay đổi>`; `npm test -- --watchman=false --runTestsByPath <test liên quan>`; `npm run bundle`. Migration có test PostgreSQL/RLS/concurrency thật trước khi bật cờ. Kiểm tra iOS/Android với 2–4 người, retry/mất ack, mất mạng/đổi mạng, vào nền, logout và khóa tài khoản.

Nguồn: [Supabase Firebase Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).
