# Lưu ảnh Ký ức đã chia sẻ trên Cloudflare R2

Ảnh riêng tư vẫn nằm trên thiết bị. Ảnh được chọn chia sẻ với bạn bè được
nén JPEG tối đa 2 MB rồi tải trực tiếp lên bucket R2 **private**. Supabase
Postgres vẫn lưu metadata, lời mời và quan hệ bạn bè. Edge Function
`memory-access` xác minh Firebase ID token, kiểm tra quan hệ bạn bè, rồi
cấp URL PUT/GET ký ngắn hạn cho đúng object. Khóa R2 chỉ nằm trong secrets
của Edge Function.

## Cấu hình

1. Trong Cloudflare account `aa5f3e989b671a1f9dfb339887565dc7`, bật
   R2 và tạo bucket **Standard** tên `lifemate-memories`. Giữ bucket private;
   không bật public `r2.dev` hay custom domain. Ứng dụng native không cần CORS.
2. Tạo R2 API token giới hạn **Object Read & Write** cho đúng bucket này. Lưu
   Access Key ID và Secret Access Key vào nơi quản lý secrets; không đặt trong
   `.env` của Expo hoặc Git.
3. Áp dụng migration
   `supabase/migrations/202610140001_memory_r2.sql` vào project Supabase.
   Migration chỉ thêm cột và giữ ảnh cũ ở Supabase Storage.
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
mở tab Ký ức, app yêu cầu function chuyển tối đa 10 ảnh cũ mỗi lần. Function
đọc bản cũ, kiểm tra JPEG và kích thước, ghi sang R2, xác minh bản R2, đổi
`photo_backend`, sau đó mới xóa bản Supabase. Cho đến khi chuyển xong, ảnh
cũ tiếp tục được đọc từ Supabase. Không xóa bucket cũ trước khi truy vấn
`photo_backend = 'supabase'` trả về 0 và đã kiểm tra các object còn sót.

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
