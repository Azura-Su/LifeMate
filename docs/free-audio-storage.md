# Sao lưu âm thanh miễn phí

## Quyết định (07/10/2026)

Giữ Firebase Spark cho Auth, Remote Config, FCM và Firestore Native. Không nâng Blaze. Audio mới sẽ sao lưu vào bucket **private** `lifemate-audio` của Supabase Free; metadata/tên ở Firestore. Thư viện trên máy và thao tác nghe, đặt tên, cắt, nối vẫn dùng được khi cloud chưa cấu hình hoặc mất mạng.

Supabase Free hiện có $0/tháng, 1 GB file storage, giới hạn 50 MB/file, 5 GB egress và 5 GB cached egress; project có thể tạm dừng sau một tuần không hoạt động. Function có 500.000 lượt gọi trong quota Free. Hạn mức dùng chung trong project, không phải cho từng tài khoản. Không bật add-on/trả phí. File lớn hơn 50 MB vẫn giữ trên máy. [Hạn mức hiện hành](https://supabase.com/pricing).

Project đã tạo trong organization **LifeMate FREE**, region **Singapore** (`ap-southeast-1`), ref `xbhelntqytleiduzicuj`. Firebase tiếp tục ở Spark; Supabase Data API đang tắt vì app chỉ dùng Storage và Edge Function.

## Contract

`POST /functions/v1/audio-access`, header `apikey` là Supabase publishable key và `Authorization: Bearer` là Firebase ID token. Body `{ action: 'upload' | 'download', id, fileName, mimeType, sizeBytes }`. Trả `{ url }` là signed URL. Function xác minh chữ ký RS256, issuer/audience đúng `baseapp-dd227`, hạn dùng và UID. Đường dẫn được dựng bằng UID đã xác minh; không nhận ownerId/path/bucket/URL từ client.

Bucket đã tạo và truy vấn xác nhận `public=false`, giới hạn `52428800` byte, chỉ nhận các MIME audio bên dưới; không có policy đọc/ghi cho anon/authenticated. Function `audio-access` đã deploy tại `https://xbhelntqytleiduzicuj.supabase.co/functions/v1/audio-access`. Gateway option **Verify JWT with legacy secret** tắt để nhận Firebase token; function tự xác minh Firebase RS256, issuer, audience, thời hạn và UID trước khi ký URL. Tắt tùy chọn gateway này không bỏ xác thực của handler. Chỉ function giữ service-role secret; app không chứa khóa quản trị. Signed upload hết hạn sau 2 giờ, signed download sau 5 phút. Không ghi URL/token vào Firestore, local index hay log. Firebase token bị thu hồi có thể còn hiệu lực tới khi hết hạn (tối đa khoảng 1 giờ); kiểm tra revocation cần tích hợp thêm Admin API.

Metadata thêm `storageProvider: 'supabase'`; bản cũ thiếu field tiếp tục dùng Firebase để tải (nếu bucket cũ còn truy cập được). Không tự di chuyển hoặc xóa dữ liệu cũ. Chỉ đánh dấu đã sao lưu sau khi cả upload và ghi metadata thành công. Thử lại ghi cùng đường dẫn của chính tài khoản.

## Các bước

- [x] Function xác thực + signed URL, SQL bucket private giới hạn MIME/50 MB, test phân quyền.
- [x] App upload/download có progress/hủy; local fallback, giới hạn và trạng thái rõ ràng.
- [x] Typecheck/lint/tests/bundle; kiểm tra UI Simulator thực tế.
- [x] Tạo Supabase Free tại Singapore; tạo bucket private `lifemate-audio`, giới hạn 50 MB và MIME audio.
- [x] Deploy `audio-access`, bật xác minh Firebase JWT trong handler, cấu hình `.env` local (file bị Git ignore).
- [x] Smoke test endpoint trên dashboard: token giả nhận `401 unauthenticated`.
- [x] Publish Firestore rules private theo UID và provider vào 22:48 ngày 07/10/2026.
- [ ] Đăng nhập bằng tài khoản Firebase thật, rồi kiểm tra upload/download audio tổng hợp và cách ly hai tài khoản. Chưa đưa audio riêng tư lên cloud để thử.

## Triển khai khi tài khoản Supabase đã sẵn sàng

1. Project Free đã tồn tại; nếu dựng môi trường mới, chọn organization **Free** và region Singapore, giữ Firebase ở Spark. Không chọn upgrade hoặc add-on.
2. Bucket hiện tại đã được tạo qua Storage Dashboard và xác minh `public=false`, `52428800` byte, các MIME audio, 0 policy. Khi dựng lại, chạy `supabase/migrations/202610070001_audio_bucket.sql`; không thêm policy đọc/ghi cho anon/authenticated.
3. Function hiện đã deploy qua Dashboard Editor. Khi triển khai phiên bản mới, dùng Supabase CLI và project ref bên trên:

   ```sh
   supabase functions deploy audio-access --project-ref xbhelntqytleiduzicuj
   ```

   `supabase/config.toml` tắt kiểm tra JWT Supabase tại gateway vì đây là Firebase JWT. **Không được bỏ bước xác minh Firebase trong handler.** Runtime tự cung cấp `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`; không copy khóa server sang client.
4. Firestore rules private theo UID đã publish lên `baseapp-dd227`; chỉ deploy lại khi rules đổi. Với Firebase CLI đã đăng nhập, deploy riêng Firestore rules:

   ```sh
   firebase deploy --project baseapp-dd227 --config firebase/audio.firebase.json --only firestore:rules
   ```

5. `.env` của checkout hiện tại đã có project URL và publishable key, file được Git ignore. Với checkout mới, copy `.env.example`, lấy URL và publishable key từ Settings → API Keys. Key này gửi ở `apikey`; Firebase ID token gửi ở `Authorization`. Khởi động Metro lại và rebuild JS release; không cần native module mới. Không đặt `sb_secret_` hoặc service-role key trong app.
6. Thử với audio tổng hợp trong `tests/fixtures/audio/`: nhập → đặt tên → sao lưu → mở trên thiết bị thứ hai → nghe/cắt/ghép. Kiểm tra tài khoản B không đọc được metadata hoặc lấy URL của A, request thiếu/giả token bị 401, file trên 50 MB chỉ giữ local. Không dùng file riêng của người dùng để test cloud.

Kiểm thử function độc lập: `npm ci --ignore-scripts --prefix supabase/functions`, sau đó `npm test --prefix supabase/functions`. Dependency jose được pin và có lockfile riêng. Endpoint cloud đã được smoke test với token giả; upload/download bằng Firebase user thật vẫn cần chạy sau khi đăng nhập app. Lệnh `npm run typecheck`, `npm run lint` và Android/iOS bundle đã pass với `.env` hiện tại.

## Khôi phục / giới hạn

Để dừng upload mới, bỏ URL khỏi `.env` rồi rebuild bundle. Không xóa bucket, index local hoặc metadata; các file đã tải trên máy vẫn dùng được. Nếu metadata ghi lỗi sau khi upload, thử lại sẽ ghi cùng path của chủ tài khoản. Chưa có tác vụ dọn object không có metadata; kiểm tra usage trong dashboard khi gần 1 GB. Hết hạn mức hoặc project bị pause sẽ làm sao lưu thất bại, bản trên máy vẫn được giữ. Không tự nâng gói.

## Nguồn

- https://supabase.com/pricing
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
