# Checklist: chủ phòng chuyển quyền, mở lại và xóa phòng

Kế hoạch: [card-room-reopen-plan-2026-10-21.md](card-room-reopen-plan-2026-10-21.md)

## 1. Hợp đồng quyền
- [x] Tách chủ phòng hiện tại khỏi creator ban đầu và thành viên đang ngồi.
- [x] Thêm action chuyển chủ phòng, mở lại, xóa; kiểm tra current owner ở reducer và RPC.
- [x] Giữ quyền owner ổn định qua leave, lease expiry và ownership transfer.

## 2. Vòng đời server
- [x] Hạn hoạt động chỉ gia hạn từ các thao tác hợp lệ đã thống nhất.
- [x] Không gia hạn khi read/heartbeat/viewing/timeout/worker cleanup.
- [x] Expiry ẩn rejoin cho người khác, giữ record cho owner; owner mở lại cùng room ID/code.
- [x] Người chơi cũ được vào lại sau khi owner mở; người ngoài không được coi là member cũ.
- [x] Không cho command thường vượt hạn; xử lý reopen/delete race và idempotency.
- [x] Room tồn tại cho đến khi owner xóa sau khi match kết thúc; tách privacy cleanup.

## 3. UI và đồng bộ trạng thái
- [x] Thêm status lookup theo room ID cho chủ phòng/thành viên cũ.
- [x] Lịch sử hiển thị đúng nút Vào lại / Tạo lại phòng / không có action.
- [x] Trạng thái refresh khi màn lịch sử được mở; người chơi khác nhận trạng thái mới sau khi owner mở phòng.
- [x] Có luồng chuyển chủ và xác nhận xóa phòng.

## 4. Kiểm chứng
- [x] Function unit + SQL integration tests cho transfer, expiry, reopen, delete, worker và dữ liệu riêng tư.
- [x] Jest UI/service tests cho trạng thái nút và owner actions.
- [x] Typecheck, lint, function tests, targeted Jest, diff check.
- [ ] Chưa triển khai lên Supabase thật; migration và Edge Function cần rollout review riêng.
