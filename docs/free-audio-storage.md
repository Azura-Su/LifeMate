# Sao lưu âm thanh miễn phí

## Quyết định (07/10/2026)

Giữ Firebase Spark cho Auth, Remote Config, FCM và Firestore Native. Không nâng Blaze. Audio mới sẽ sao lưu vào bucket **private** `lifemate-audio` của Supabase Free; metadata/tên ở Firestore. Thư viện trên máy và thao tác nghe, đặt tên, cắt, nối vẫn dùng được khi cloud chưa cấu hình hoặc mất mạng.

Supabase Free hiện có 1 GB lưu trữ, tối đa 50 MB/file, 5 GB egress; project có thể tạm dừng sau một tuần không hoạt động. Đây là dung lượng chung của project, không phải mỗi tài khoản. Không bật add-on/trả phí. File lớn hơn 50 MB vẫn giữ trên máy.

## Contract

`POST /functions/v1/audio-access`, Authorization: Bearer Firebase ID token. Body `{ action: 'upload' | 'download', id, fileName, mimeType, sizeBytes }`. Trả `{ url }` là signed URL. Function xác minh chữ ký RS256, issuer/audience đúng `baseapp-dd227`, hạn dùng và UID. Đường dẫn được dựng bằng UID đã xác minh; không nhận ownerId/path/bucket/URL từ client.

Bucket không public, không có policy cho anon/authenticated. Chỉ function giữ service-role secret; app không chứa khóa quản trị. Signed upload của Supabase hết hạn sau 2 giờ, signed download sau 5 phút. Không ghi URL/token vào Firestore, local index hay log. Firebase token bị thu hồi có thể còn hiệu lực tới khi hết hạn (tối đa khoảng 1 giờ); kiểm tra revocation cần tích hợp thêm Admin API.

Metadata thêm `storageProvider: 'supabase'`; bản cũ thiếu field tiếp tục dùng Firebase để tải (nếu bucket cũ còn truy cập được). Không tự di chuyển hoặc xóa dữ liệu cũ. Chỉ đánh dấu đã sao lưu sau khi cả upload và ghi metadata thành công. Thử lại ghi cùng đường dẫn của chính tài khoản.

## Các bước

- [x] Function xác thực + signed URL, SQL bucket private giới hạn MIME/50 MB, test phân quyền.
- [x] App upload/download có progress/hủy; local fallback, giới hạn và trạng thái rõ ràng.
- [x] Typecheck/lint/tests/bundle; kiểm tra UI Simulator thực tế.
- [ ] Đăng nhập/tạo Supabase Free, deploy và thử cloud thật bằng fixture. Bước này chờ chủ tài khoản hoàn tất đăng nhập/điều khoản.
- [x] Publish Firestore rules private theo UID và provider vào 22:48 ngày 07/10/2026.
- [ ] Kiểm chứng upload/download cloud thật sau khi Supabase sẵn sàng.

## Triển khai khi tài khoản Supabase đã sẵn sàng

1. Chủ tài khoản tạo project LifeMate trong organization **Free**, giữ project Firebase ở Spark. Không chọn upgrade hoặc add-on. Nếu form yêu cầu mật khẩu database/điều khoản, chủ tài khoản tự hoàn tất.
2. Dùng SQL Editor chạy `supabase/migrations/202610070001_audio_bucket.sql`. Đối chiếu bucket private, giới hạn 52428800 byte và các MIME audio; không thêm policy đọc/ghi cho anon hay authenticated. Kiểm tra không có policy wildcard từ app khác.
3. Đăng nhập Supabase CLI bằng tài khoản được phép triển khai, rồi:

   ```sh
   supabase functions deploy audio-access --project-ref YOUR_PROJECT_REF
   ```

   `supabase/config.toml` tắt kiểm tra JWT Supabase tại gateway vì đây là Firebase JWT. **Không được bỏ bước xác minh Firebase trong handler.** Runtime tự cung cấp `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`; không copy khóa server sang client.
4. Đối chiếu/publish `firebase/firestore.rules` cho project `baseapp-dd227`. Với CLI đã đăng nhập, chỉ deploy Firestore rules:

   ```sh
   firebase deploy --project baseapp-dd227 --config firebase/audio.firebase.json --only firestore:rules
   ```

5. Copy `.env.example` thành `.env`, đặt `EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co` và `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` từ API Keys. Publishable key được gửi ở header `apikey`; Firebase ID token ở `Authorization`. Chỉ điền sau khi backend đã deploy. Khởi động lại Metro và rebuild JS release; không cần thêm native module. Không đặt `sb_secret_` hoặc service-role key trong app.
6. Thử với audio tổng hợp trong `tests/fixtures/audio/`: nhập → đặt tên → sao lưu → mở trên thiết bị thứ hai → nghe/cắt/ghép. Kiểm tra tài khoản B không đọc được metadata hoặc lấy URL của A, request thiếu/giả token bị 401, file trên 50 MB chỉ giữ local. Không dùng file riêng của người dùng để test cloud.

Kiểm thử function độc lập (không gọi cloud): `npm ci --ignore-scripts --prefix supabase/functions`, sau đó `npm test --prefix supabase/functions`. Dependency jose được pin và có lockfile riêng. Node tests chạy cùng code JS của function; Deno deployment và Supabase thật còn cần kiểm chứng sau khi có project.

## Khôi phục / giới hạn

Để dừng upload mới, bỏ URL khỏi `.env` rồi rebuild bundle. Không xóa bucket, index local hoặc metadata; các file đã tải trên máy vẫn dùng được. Nếu metadata ghi lỗi sau khi upload, thử lại sẽ ghi cùng path của chủ tài khoản. Chưa có tác vụ dọn object không có metadata; kiểm tra usage trong dashboard khi gần 1 GB. Hết hạn mức hoặc project bị pause sẽ làm sao lưu thất bại, bản trên máy vẫn được giữ. Không tự nâng gói.

## Nguồn

- https://supabase.com/pricing
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
