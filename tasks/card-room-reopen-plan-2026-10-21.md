# Kế hoạch: Chủ phòng chuyển quyền, mở lại và xóa phòng

## Mục tiêu

Thay vòng đời phòng cũ bằng trạng thái phòng có thể hết hạn chờ mở lại. Người tạo ban đầu là chủ phòng đầu tiên; chủ phòng hiện tại có thể chuyển quyền. Sau 30 phút không có hoạt động hợp lệ, người chơi khác mất nút vào lại, còn chủ phòng thấy nút tạo lại để khôi phục chính phòng cũ. Phòng chỉ bị xóa vĩnh viễn theo lệnh xóa hợp lệ của chủ phòng sau khi ván đã kết thúc.

## Quyết định triển khai

- Giữ riêng chủ phòng hiện tại khỏi danh sách ghế và danh tính người tạo ban đầu; quyền chủ chỉ đổi qua thao tác chuyển quyền được server xác thực.
- Dùng hạn hoạt động phía server làm nguồn trạng thái. Heartbeat, đọc snapshot, xem màn hình, timeout tự động và dọn lease không kéo dài hạn.
- Hết hạn không đóng/xóa phòng: dọn ghế/lease cũ, giữ mã, chủ phòng, người chơi từng tham gia, số dư và kết quả. Chủ phòng mở lại cùng room ID/code; các thành viên cũ được phép vào lại sau khi mở.
- Trạng thái nút trong lịch sử lấy từ truy vấn server đã lọc theo tài khoản, không suy ra từ cache cục bộ. Tải/cập nhật khi mở lịch sử; không cần polling khi chỉ xem màn hình.
- Phòng đã xóa không thể tái tạo từ receipt, cache, snapshot cũ hoặc mã cũ. Việc xóa không xóa các bảng điểm lịch sử cục bộ của từng người.
- Giữ riêng hạn lưu bài riêng tư/kết quả với hạn hoạt động của phòng; bảo toàn quy tắc dọn dữ liệu tài khoản hiện có.

## Các lát cắt và tiêu chí nghiệm thu

### 1. Hợp đồng vòng đời và quyền
- [x] Bổ sung owner hiện tại, transfer, reopen, delete và room-status vào hợp đồng server/client.
- [x] Chủ phòng hiện tại có thể chuyển quyền cho thành viên; người cũ mất quyền quản trị ngay sau commit.
- [x] Owner không tự đổi khi chủ phòng rời/ghế hết lease; creator ban đầu chỉ còn là lịch sử sau khi đã chuyển quyền.

### 2. Thời hạn và khôi phục phía server
- [x] Chỉ join/rejoin, ready/unready, play/pass, transfer và reopen gia hạn 30 phút; leave không gia hạn.
- [x] Heartbeat/read, viewing, timeout/worker cleanup không gia hạn.
- [x] Worker giữ phòng hết hạn, không xử lý lặp vô hạn; không cho mutation thường vượt qua hạn.
- [x] Chỉ current owner được reopen cùng room ID/code; reactivation khôi phục khả năng rejoin cho thành viên cũ và giữ score/balance.
- [x] Xử lý idempotency và race giữa hết hạn, reopen, transfer, worker, delete; xóa không thể bị snapshot/action cũ hồi sinh.

### 3. Lịch sử và giao diện
- [x] Status lookup xác nhận quan hệ người chơi/phòng và trả đúng `canRejoin`, `canReopen`, `canDelete`, trạng thái/version; không trả bài riêng hoặc dữ liệu nhạy cảm.
- [x] Lịch sử chỉ hiện “Vào lại” cho người chơi cũ khi phòng hoạt động; khi hết hạn ẩn nút với họ và hiện “Tạo lại phòng” cho chủ hiện tại.
- [x] Sau khi chủ mở lại, làm mới status để người chơi cũ thấy “Vào lại”; sau xóa thì mọi người không còn action vào phòng.
- [x] Có UI chuyển chủ phòng và xác nhận xóa; xóa chỉ khả dụng sau khi ván kết thúc.

### 4. Migration và tương thích
- [x] Migration sửa RPC/worker/scheduling và backfill owner hiện tại từ `ownerUid`, rồi `host`, rồi người tạo cũ theo thứ tự an toàn.
- [x] Room hết hạn/đóng theo schema cũ được khôi phục tương thích khi còn dữ liệu.
- [x] Xóa tài khoản vẫn xóa phòng/dữ liệu theo chính sách tài khoản hiện tại, không trao quyền cho người khác ngoài transfer đã commit.

## Kiểm chứng

- Function tests cho quyền transfer/reopen/delete, thao tác hợp lệ và TTL, worker idempotency, room status.
- PostgreSQL integration tests cho 30 phút, stale lease, owner transfer/reopen/delete, retention riêng tư và room tồn tại sau 24 giờ.
- Client tests cho status button, refresh sau reopen, transfer confirmation, delete confirmation.
- `npm run test:functions`, test Jest liên quan, `npm run typecheck`, ESLint các file đổi và `git diff --check`.
- Không triển khai migration/Edge Function lên project thật trong bước code này; cần một bước triển khai riêng và kiểm tra sau triển khai.

## Tương thích khi rollout

- Snapshot mở rộng chỉ gửi khi client khai báo protocol v2; client cũ tiếp tục nhận projection cũ. Client mới thử request cũ nếu Edge Function chưa hỗ trợ v2.

## Rủi ro

- `expires_at` hiện đồng thời điều khiển hoạt động và cleanup; phải tách việc ẩn rejoin khỏi việc xóa room và giữ lịch cleanup dữ liệu riêng tư.
- Worker hiện có thể loại thành viên/đóng ván khi lease hết; bảo đảm room status và cách khôi phục không làm sống lại ván đang chơi hoặc settle kết quả hai lần.
- Bảng điểm online trên mỗi thiết bị là bản sao cục bộ; xóa room dùng chung chỉ ẩn các action phòng, không được xóa nhầm điểm cục bộ của người khác.
