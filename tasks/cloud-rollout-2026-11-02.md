# Triển khai backend còn thiếu — 02/11/2026

Người dùng đã yêu cầu tiếp tục deploy sau đối chiếu trực tiếp Supabase
LifeMate `xbhelntqytleiduzicuj`. Giữ nguyên thay đổi UI đang làm song song.

## Trạng thái trước triển khai

- game-access v20: thiếu protocol13, Sâm5/Tấn6 và helper capacity.
- pet-access v4, user-admin v14: expConfig bundle còn10level, local20level;
  SQL appearance đã có và tính4650EXP=Lv20.
- memory-access v13: thiếu revocation/migration lease và quota transaction.
- audio-access v10: runtime source chỉ khác comment, không cần redeploy; SQL
  confirm/release chưa giữ reservation tối đa khi signed URL còn hiệu lực.
- profile-access v3 khớp source. Firebase rules không đổi từ bản đã xác minh
  deploy30/10; không deploy lại.

## Kế hoạch đã review

1. Backup source6Edge và SQL definitions/ACL/constraints/history. Chạy lại
   functions tests; xác nhận0playing và lưu mode/cron hiện tại.
2. Maintenance503 toàn bộ memory-access/game-access/user-admin (kể cả game
   worker cron); giữ verify_jwt=false vì Firebase auth nằm trong handler.
   Xác nhận source/503, đợi>=460s từ stub cuối cùng được xác nhận.
3. Áp riêng các migration, có guard fingerprint và lock timeout trong transaction:
   memory revocation→migration lease→invite quota, audio retention, game capacity.
   Không db push toàn bộ lịch sử deployment thủ công.
4. Deploy pet-access/game-access/memory-access từ source local đã test; mở
   user-admin cuối cùng khi memory mới sẵn sàng. Giữ nguyên secrets/config.
5. Đọc lại source và SQL, kiểm tra grants service-only, cron, authnegative,
   trạng thái route/log/advisors và review cuối. Không dùng dữ liệu thật làm fixture.

Reviewer đã rà trước thay đổi: yêu cầu gate+drain old workers được đưa vào plan;
không còn blocker khi các điều kiện này đạt. Official Edge limit tối đa400s;
460s gồm khoảng đệm, theo [giới hạn Edge chính thức](https://supabase.com/docs/guides/functions/limits).
Chỉ chờ mỗi lần tối đa60s để tiếp tục báo tiến độ.

## Rollback

Source đang chạy và SQL trước thay đổi lưu tại
`/private/tmp/lifemate-deploy-check-20261102-functions.json` và
`/private/tmp/lifemate-cloud-rollout-sql-before.json`; payload cuối lưu tại
`/private/tmp/lifemate-cloud-rollout-payloads.json`.
Nếu lỗi, giữ route maintenance và forward-fix. Không bỏ cột lease sau khi có
request mới, không phục hồi CHECK4ghế/enginecũ khi đã có bàn>4; giữ audio retention.
Không khôi phục handler memory cũ khi có lease mới đang chạy.

## Kết quả

Đã hoàn tất deploy và mở lại dịch vụ lúc **12:33 ngày02/11/2026 (UTC+7)**.

| Function | Trước | Sau | Source đọc lại |
| --- | --- | --- | --- |
| pet-access | v4 | **v5** | 8/8 file khớp |
| memory-access | v13 | **v15** | 7/7 file khớp |
| game-access | v20 | **v22** | 23/23 file khớp |
| user-admin | v14 | **v16** | 15/15 file khớp |

Các version trung gian memory14/game21/admin15 là maintenance stub đã được thay
bằng handler thật. Cả bốn function ACTIVE, giữ JWT mode hiện có, không đổi secrets.
audio-access v10/profile-access v3 giữ nguyên.

### Migration đã áp riêng

Connector tạo timestamp thực; bảng dưới ánh xạ về file SQL được review. Không
đánh dấu các migration lịch sử khác là đã chạy, không chạy db push toàn repo.

| Version thực | SQL source local |
| --- | --- |
| 20261102052559 | 20261021055132_audio_upload_reservation_retention.sql |
| 20261102053301 | 202610190001_memory_revocation_lease.sql |
| 20261102053309 | 202610190002_memory_migration_lease.sql |
| 20261102053310 | 20261022185328_memory_invite_quota_transactions.sql |
| 20261102053311 | 20261102120000_card_game_large_tables.sql |

History name giữ dạng `rollout_<version-source>_<name>`. Các file source giữ tên
gốc để không làm xáo trộn chuỗi/test local; mapping này phải được xử lý khi
chuẩn hóa toàn bộ baseline thủ công trước khi dùng CLI push.

### Kiểm chứng sau triển khai

- Backup source/SQL/ACL/constraints/history trước thay đổi đã lưu ngoài repo.
- Ba stub được xác nhận source và503; mốc xác nhận cuối05:25:06UTC, migration
  memory đầu05:33:01UTC, **474giây** sau mốc đó. Đã đủ khoảng drain400s+buffer.
  Audio retention độc lập được áp trong lúc chờ; không cần đổi Edge audio.
- 0ván đang chơi trước maintenance và trước mở game; không đổi modeopen hoặc cron.
- Chạy lại **417 functions tests đạt** trước deploy, không skip. Không sửa source
  backend trong lúc chờ hoặc triển khai.
- **18/18 SQL bodies** đọc từ catalog khớp chính xác source; cả20overload kiểm tra
  không có EXECUTE cho anon/authenticated, service_role có EXECUTE. Overload game
  commit10tham số vẫn có và đi qua guard mới; takeover4tham số giữ fingerprint cũ.
- Pure SQL probe: capacitySâm5/Tấn6/South4; roster5người còn trong game dù members
  rỗng vẫn yêu cầuv13. CHECKcapacity mới có,5cộtlease memory có, hàm EXP4650=Lv20.
- POST chưa xác thực với action hợp lệ tới cả4function trả401. Probe admin`{}`
  ban đầu trả400 vì schema input; đổi sang actionlist để kiểm auth, không đổi code.
- Log theo deployment ID sau mở lại có response200 của game/pet/admin và401 của
  negative smoke; không thấy5xx trong khoảng05:33:30–05:37UTC đã truy vấn. Memory
  chỉ có negative smoke trong khoảng này; chưa xác minh lại mọi luồng có session thật.
- Security advisor không đổi:27INFO bảngbackend RLSkhôngpolicy và1WARN RPC
  `lifemate_game_can_subscribe` cho authenticated phục vụRealtime. Không mở thêm
  quyền để xóa cảnh báo. Cron deadline vẫnactive1job, game modeopen.
- Firebase rules/server/native source không đổi so với release đã xác minh30/10;
  không redeploy. Không gửi thư, tạo/xóa user hoặc ghi fixture lên dữ liệu thật.

Giới hạn: đây là triển khai backend, không phải phát hành binary iOS/Android.
QR cần build mới có barcode scanner; UI/atlas cùng các sửa app phải được đưa vào
bản ứng dụng người dùng cài. Repo chưa có luồng Expo Updates OTA để tự phân phối.

Reviewer cuối không còn actionable finding sau rà artifacts source/catalog,
drain và quyền RPC. Reviewer không có Supabase connector ở context của agent;
main thực hiện các live readback và smoke nêu trên. Luồng memory có xác thực,
quét QR và thao tác giữa thiết bị thật chưa được smoke-test sau deploy.
