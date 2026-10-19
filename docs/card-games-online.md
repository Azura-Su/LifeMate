# Tiến lên miền Nam online

Triển khai theo [SPEC](../SPEC-card-games.md) và [bộ luật cố định](../SPEC-rules-tien-len-south.md). Miền Bắc và Phỏm chưa triển khai. Bảng điểm thủ công giữ storage và lịch sử riêng.

## Kiến trúc và vận hành

Firebase JWT xác thực UID; Edge `game-access` kiểm tra input, tính engine và gọi RPC service-only. PostgreSQL giữ trạng thái, khóa phòng/CAS version, kiểm tra cutoff tài khoản và lưu receipt theo UID/actionId. Lệnh phòng gắn roomId/matchId/version để lệnh trễ không tác động phòng mới. API chỉ trả tay bài của người gọi, số lá của người khác và thông tin chung; không publish row chứa bài.

Realtime private chỉ gửi hint version/epoch. Bootstrap kiểm tra tài khoản Firebase đang sống, bảo toàn custom claims rồi thêm `role: authenticated` nếu chưa có. Client refresh JWT sau khi thêm claim; chờ SUBSCRIBED rồi sync. Cần tích hợp Firebase project `baseapp-dd227` ở Authentication → Third-party Auth của Supabase. [Hướng dẫn chính thức](https://supabase.com/docs/guides/auth/third-party/firebase-auth).

Client hủy socket/request/timer khi blur/background/đổi UID. Pending command giữ actionId để xác nhận lại sau mất ack. Không dùng audio hoặc keep-awake. Lease 90 giây; lượt 30 giây. Cron chung `lifemate-game-deadlines` mỗi 5 giây chỉ gọi Edge khi có việc đến hạn; batch tối đa 8 phòng, lease worker 15 giây và CAS chống xử lý lặp.

Private state của ván kết thúc được xóa trong lần worker đầu tiên sau mốc 24 giờ, độc lập với việc ready/gia hạn/đóng phòng sau đó. Receipt giữ ít nhất 24 giờ sau đóng phòng; summary giữ 30 ngày. Xóa tài khoản dọn phòng có bài của UID, receipt và summary trước khi hoàn tất dọn dữ liệu. Bảng điểm thủ công không bị chạm.

Giới hạn hiện tại theo UID: tìm mã 15/phút, tạo phòng 5/phút, takeover 6/phút, read 240/phút. Chưa triển khai giới hạn theo IP vì chưa xác nhận header IP đáng tin ở gateway; chưa đo tải nhiều phòng hay battery native. Không coi đây là tiêu chí phát hành đã đạt.

## Bật và tắt

- Client: `EXPO_PUBLIC_CARD_GAMES_ENABLED=true` trong build thử; mặc định false. Route import lười, SDK game không khởi tạo ở Home.
- Server: `public.lifemate_game_config.mode`: `closed` chặn game, `drain` không cho tạo/join/start mới, `open` mở. `test_uids` cho phép UID thử khi closed. Không dùng tài khoản thật làm fixture.
- Để dừng sự cố, đặt mode closed và test_uids rỗng. Không xóa bảng hay rollback migration phá dữ liệu. Cron vẫn dọn dữ liệu đến hạn.

## Triển khai

Project hiện tại `xbhelntqytleiduzicuj`, Singapore, PostgreSQL 17.11. Ngày 19/10/2026 đã áp dụng riêng `202610190003_card_game_rooms.sql` và `202610190004_card_game_deadlines.sql` trong một transaction, deploy `game-access` và `user-admin`. Không chạy `db push` toàn bộ: project dùng lịch sử migration thủ công, chưa có schema_migrations. Xem [migration history](supabase-migration-history.md).

Thứ tự dựng lại: hai migration game → secret ngẫu nhiên riêng `GAME_WORKER_SECRET` ở Edge và cùng giá trị trong Vault `lifemate_game_worker_secret` → deploy game-access/user-admin với config verify_jwt=false (handler tự xác minh Firebase) → chạy `supabase/operations/card-games-schedule.sql`. Không commit/in log secret; không thay secret cleanup tài khoản hiện có. Cron chứa lời gọi function, không chứa bearer.

`npm audit`: 64 advisory (52 high, 12 moderate, 0 critical); đối chiếu lockfile với commit gốc 2dbe2e8 không có advisory thuộc dependency game mới. Không thay dependency ngoài phạm vi.

CLI 2.121.0 `config pull/diff` đọc được cấu hình hosted, nhưng diff bỏ qua `auth.third_party.firebase`; chưa có bằng chứng CLI push hỗ trợ mục này. Không push defaults thay cấu hình Auth đang chạy. Quyền trình duyệt Work hiện báo bị tắt, nên tích hợp Firebase Realtime còn cần dashboard.

## Bằng chứng và việc còn lại

- `npm run typecheck`: đạt. ESLint các file TS thay đổi: đạt.
- Jest toàn project: 110 suite, 749 ca đạt. Một lần chạy đầu có lỗi đếm hidden route (đã cập nhật từ 5 sang 6) và ca Finance StrictMode trượt thời gian; rerun targeted và toàn bộ đều đạt, không sửa logic Finance.
- `npm run test:functions`: 133 ca đạt, gồm engine/invariant, API, quyền, xóa tài khoản và 12 ca PostgreSQL/RLS qua PGlite. PGlite không thay thế kiểm thử khóa giữa nhiều kết nối.
- `npm run bundle`: xuất thành công iOS và Android. iOS simulator kiểm tra Home → Ghi điểm bài → Home hoạt động, cờ tắt ẩn nút online. Chưa thử bàn online native/font lớn hay battery.
- Supabase cloud: thử 4 người chia 52 lá duy nhất, snapshot chỉ tay mình; create retry giữ nguyên phòng; hai lệnh cùng version trả 200/409; worker/cron tự xử timeout khi không có listener. Cả 6 bảng game RLS bật, role authenticated không có quyền bảng. [Báo cáo đã loại danh tính](card-games-cloud-check-2026-10-19.json).
- Handshake thật với hai thành viên và một người ngoài đều CHANNEL_ERROR; Data API trả 401/PGRST301 với Firebase JWT đã có role authenticated. Chưa qua lớp xác thực Firebase ở gateway nên chưa chứng minh được quyền kênh hay broadcast native. Cần bật Third-party Firebase integration trước khi thử lại.
- Chưa đạt gate phát hành: Firebase/Realtime thật, native 2–4 thiết bị, ngắt mạng/đổi tài khoản/thu hồi quyền khi đang kết nối, tải nhiều phòng, latency/battery và thử TestFlight/Android release. Giữ cả client flag và server mode tắt cho đến khi có bằng chứng.

Đã dọn 8 tài khoản Firebase tổng hợp, phòng/seat/receipt/result và allowlist của các fixture; secret worker chỉ giữ tại Edge/Vault. Sau khi người dùng báo đã bật trình duyệt, cả lần mở mới và reset phiên CUA vẫn trả “Local browser use is disabled in Work settings”; chưa thao tác dashboard hay thêm integration.
