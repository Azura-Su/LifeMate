# Lưu ảnh Ký ức đã chia sẻ trên Cloudflare R2

Ảnh gốc **Của tôi** được giữ trên thiết bị và sao lưu vào R2 private theo tài khoản (tối đa 15 MiB, giữ định dạng gốc); metadata đồng bộ qua Firestore. Xem `SPEC-private-memory-sync.md`. Ảnh được chọn chia sẻ với bạn bè được
nén JPEG tối đa 2 MB rồi tải trực tiếp lên bucket R2 **private**. Supabase
Postgres vẫn lưu metadata, lời mời và quan hệ bạn bè. Edge Function
`memory-access` xác minh Firebase ID token, kiểm tra quan hệ bạn bè, rồi
cấp URL PUT/GET ký ngắn hạn cho đúng object. Khóa R2 chỉ nằm trong secrets
của Edge Function.

Lịch sử version và baseline database cũ: xem `supabase-migration-history.md`.

## Cấu hình

1. Trong Cloudflare account `aa5f3e989b671a1f9dfb339887565dc7`, bật
   R2 và tạo bucket **Standard** tên `lifemate-memories`. Giữ bucket private;
   không bật public `r2.dev` hay custom domain. Ứng dụng native không cần CORS.
2. Tạo R2 API token giới hạn **Object Read & Write** cho đúng bucket này. Lưu
   Access Key ID và Secret Access Key vào nơi quản lý secrets; không đặt trong
   `.env` của Expo hoặc Git.
3. Áp dụng hai migration `202610140001_memory_r2.sql` và
   `202610140002_memory_r2_cleanup.sql` theo thứ tự trong
   `supabase/migrations/`. Chúng thêm cột và giữ ảnh cũ ở Supabase Storage
   cho đến khi bản R2 được xác minh.
4. Đặt các secret cho Supabase Edge Function `memory-access`:

   | Secret                 | Giá trị                     |
   | ---------------------- | --------------------------- |
   | `R2_ACCOUNT_ID`        | Account ID ở bước 1         |
   | `R2_BUCKET`            | `lifemate-memories`         |
   | `R2_ACCESS_KEY_ID`     | Access Key ID của token     |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key của token |

5. Deploy `memory-access` với `verify_jwt = false` như
   `supabase/config.toml`. Firebase token được xác minh trong function; không
   thay bằng Supabase JWT.
6. Phát hành phiên bản app chứa cấu hình R2. Client vẫn hiểu URL Supabase
   Storage để app và function cũ có thể chạy trong giai đoạn chuyển tiếp.

## Chuyển ảnh cũ

Các hàng đã chia sẻ trước đây có `photo_backend = 'supabase'`. Khi chủ sở hữu
mở dòng ký ức, app yêu cầu function xử lý tối đa 10 ảnh cũ mỗi lần và xoay
vòng qua danh sách để một ảnh lỗi không chặn các ảnh sau. Function
đọc bản cũ, kiểm tra JPEG và kích thước, ghi sang R2, xác minh bản R2, đổi
`photo_backend`, sau đó mới xóa bản Supabase. Cột `supabase_cleanup_pending`
giữ dấu dọn ảnh gốc cho tới khi xóa thành công; nếu xóa lỗi, lần mở sau sẽ
thử lại. Migration `202610140002_memory_r2_cleanup.sql` đánh dấu kiểm tra
lại cả ảnh R2 đã được chuyển trong lần triển khai đầu. Cho đến khi chuyển
xong, ảnh cũ tiếp tục được đọc từ Supabase. Không xóa bucket cũ trước khi
truy vấn `photo_backend = 'supabase'` và `supabase_cleanup_pending = true`
đều trả về 0, đồng thời đã kiểm tra các object còn sót.

## Quyền truy cập và giới hạn

- URL PUT hết hạn sau 120 giây; URL GET hết hạn sau 600 giây. URL là bearer
  token, không ghi vào log hoặc gửi qua tin nhắn.
- Function chỉ ký PUT cho đường dẫn của UID trong Firebase token và chỉ kích
  hoạt bản chia sẻ sau khi `HeadObject` khớp MIME và kích thước đã khai báo.
- Feed và URL ảnh bạn bè chỉ cấp cho quan hệ đã chấp nhận. Gỡ chia sẻ ẩn hàng
  trước khi xóa object.
- Bucket là private. Không có secret nào được đưa vào ứng dụng di động.
- Chế độ R2 Standard có hạn mức miễn phí theo tài khoản; Cloudflare có thể
  tính phí sau khi vượt hạn mức. Theo dõi dung lượng và số operation trong
  dashboard.

## Ảnh riêng Của tôi — 17/10/2026

- Cùng bucket private hiện có, prefix `private/{uid}/{memoryId}/{filename}` tách khỏi `shared/`. Không mở public bucket hay đổi quyền bạn bè.
- `memory-access` bổ sung `private-upload` (id, fileName, sizeBytes), `private-head` và `private-download` (id, fileName). UID chỉ lấy từ token đã xác minh, account gate giữ nguyên; không yêu cầu email xác nhận hoặc tạo social profile.
- Ảnh mới chỉ upload lên R2. Conditional PUT ký cả MIME, Content-Length và If-None-Match bảo vệ tên bất biến; HTTP 412 phải xác nhận lại HEAD. HEAD trả cỡ trước khi Firestore CAS xác nhận metadata.
- Ảnh trên máy đã đồng bộ Firebase cũng được sao lưu sang R2 khi mở Ký ức. Ảnh chưa có trên máy được tìm trên R2 trước, chỉ đọc Firebase cũ khi HEAD R2 trả thiếu object, sau đó sao lưu R2. Lỗi dịch vụ không được coi là thiếu object. Giữ Firebase originals tới khi xóa tài khoản.
- Deploy `memory-access` và `user-admin` trước JS mới; không đổi secrets, rules hay schema. Cleanup tài khoản dọn cả hai prefix R2, lặp trang đầu khi chưa xong.
- Tất cả thiết bị cần JS mới để đọc ảnh mới trên R2; app Firebase-only cũ không đọc được ảnh tải lên sau cutover. Nếu Firebase cũ bị khóa và ảnh cũng không còn trên máy, phải khôi phục quyền đọc Firebase mới chuyển được bản đó.

## Deno Edge HTTP — sửa lỗi đồng bộ 17/10/2026

Adapter R2 dùng `FetchHttpHandler` (Web Fetch), không dùng Node HTTP mặc định của AWS SDK trong Deno Edge. Log production lúc 01:18:36–01:18:44 có `IncomingMessageForClient._read` / `unexpected end of file` khi đồng bộ ảnh riêng; phản hồi rỗng làm bản app cũ báo JSON Parse error. Mọi lệnh R2 thực dùng cùng deadline15 giây và chặn redirect; ký URL vẫn giữ nguyên chính sách MIME/cỡ/tên bất biến. Ghim `@smithy/fetch-http-handler@5.8.0` trong deno.json (đã là transitive dependency của SDK), không đổi auth/secrets/schema.

Regression SDK thực chạy offline bao gồm HEAD200 với Content-Length>0 nhưng không body, HEAD404,503, shared copy/DELETE và chữ ký PUT. Client kiểm tra HTTP trước decode JSON; phản hồi rỗng/sai không được coi là thiếu ảnh hoặc đã đồng bộ.

## Thu hồi chia sẻ an toàn — 19/10/2026

Áp dụng migration `202610190001_memory_revocation_lease.sql` trước khi deploy
`memory-access` mới. Migration mở rộng schema, giữ đường dẫn ảnh và request của
client cũ: thêm `revoking`, lease dọn ảnh5 phút và token riêng cho mỗi reservation.
Không sửa các migration đã chạy trước đó. Kiểm tra SQL regression trong
`supabase/tests/private-memory-deletions.sql` ở transaction rollback trên database
thử nghiệm trước khi áp dụng production.

Unshare claim lease dưới cùng khóa owner với reserve/delete-own, ẩn metadata ngay,
rồi xóa ảnh với lease còn hiệu lực và xóa row theo token. Confirm chỉ kích hoạt
pending đúng reservation; publish bị chặn khi revoking. Lỗi cleanup giữ con trỏ và
lease, có thể retry unshare sau khi lease hết hạn; không báo hoàn tất giả. Pending
publish retry không xóa ảnh dựa trên GET cũ; R2 PUT thay bản pending cùng đường dẫn.
Cờ cleanup Supabase cũ được giữ trong RPC; chuyển pending có ảnh sang text-only
phải gỡ bản pending trước. Quota vẫn tính cả pending/revoking.

Thứ tự rollout: chạy SQL regression trên database thử nghiệm → migration schema →
deploy function → phát hành client. Không rollback schema về status chỉ có
pending/active khi vẫn còn revoking; giữ schema mở rộng khi cần rollback client.
Các signed upload/download đã cấp vẫn giữ giới hạn hết hạn hiện có.

## Chuyển ảnh legacy đồng thời — 19/10/2026

Áp dụng thêm `202610190002_memory_migration_lease.sql` sau migration revocation và
trước handler mới. RPC claim migration chỉ service_role gọi, khóa cùng owner và
kiểm tra reservation gốc. Lease5 phút giữ row active/Supabase cho feed, chặn unshare
và delete-own bằng409; handler mới xử lý busy trước khi báo đã gỡ/xóa.

Copy R2 dùng PUT `If-None-Match: *`, metadata `lifemate-reservation` chứa reservation
gốc. Retry sau copy thành công nhưng SQL chưa xác nhận chỉ nhận object có proof
đúng và size/MIME đúng; bản copy trước rollout chưa có proof phải tải có If-Match
ETag rồi so từng byte với nguồn Supabase. Không xóa/ghi đè destination khác nguồn.
CAS SQL cuối kiểm tra reservation, migration token và lease còn hạn, đồng thời
đổi backend và xóa lease. Lỗi mơ hồ giữ lease tới5 phút; retry có thể dùng lại bản
copy của cùng reservation. Conditional PUT bảo vệ ảnh mới kể cả PUT cũ đến muộn
sau hết lease. Giữ fixed path/request client hiện tại.

Chạy SQL regression ở database thử nghiệm trong transaction rollback trước rollout;
offline adapter tests không xác nhận việc thực thi SQL hay dịch vụ R2 thật.
