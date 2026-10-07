# Sao lưu âm thanh miễn phí

## Quyết định (07/10/2026)

Giữ Firebase Spark cho Auth, Remote Config, FCM và Firestore Native. Không nâng Blaze. Audio mới sẽ sao lưu vào bucket **private** `lifemate-audio` của Supabase Free; metadata/tên ở Firestore. Thư viện trên máy và thao tác nghe, đặt tên, cắt, nối vẫn dùng được khi cloud chưa cấu hình hoặc mất mạng.

Supabase Free hiện có 1 GB lưu trữ, tối đa 50 MB/file, 5 GB egress; project có thể tạm dừng sau một tuần không hoạt động. Đây là dung lượng chung của project, không phải mỗi tài khoản. Không bật add-on/trả phí. File lớn hơn 50 MB vẫn giữ trên máy.

## Contract

`POST /functions/v1/audio-access`, Authorization: Bearer Firebase ID token. Body `{ action: 'upload' | 'download', id, fileName, mimeType, sizeBytes }`. Trả `{ url }` là signed URL. Function xác minh chữ ký RS256, issuer/audience đúng `baseapp-dd227`, hạn dùng và UID. Đường dẫn được dựng bằng UID đã xác minh; không nhận ownerId/path/bucket/URL từ client.

Bucket không public, không có policy cho anon/authenticated. Chỉ function giữ service-role secret; app không chứa khóa quản trị. Signed upload của Supabase hết hạn sau 2 giờ, signed download sau 5 phút. Không ghi URL/token vào Firestore, local index hay log. Firebase token bị thu hồi có thể còn hiệu lực tới khi hết hạn (tối đa khoảng 1 giờ); kiểm tra revocation cần tích hợp thêm Admin API.

Metadata thêm `storageProvider: 'supabase'`; bản cũ thiếu field tiếp tục dùng Firebase để tải (nếu bucket cũ còn truy cập được). Không tự di chuyển hoặc xóa dữ liệu cũ. Chỉ đánh dấu đã sao lưu sau khi cả upload và ghi metadata thành công. Thử lại ghi cùng đường dẫn của chính tài khoản.

## Các bước

- [ ] Function xác thực + signed URL, bucket private giới hạn MIME/50 MB, test phân quyền.
- [ ] App upload/download có progress/hủy; local fallback, giới hạn và trạng thái rõ ràng.
- [ ] Typecheck/lint/tests/bundle; kiểm tra UI thực tế.
- [ ] Đăng nhập/tạo Supabase Free, deploy và thử cloud thật bằng fixture. Bước này chờ chủ tài khoản hoàn tất đăng nhập/điều khoản.
- [ ] Publish Firestore rules private theo UID và provider, kiểm chứng cloud thật.

## Nguồn

- https://supabase.com/pricing
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
