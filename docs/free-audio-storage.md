# Sao lưu âm thanh miễn phí

## Quyết định (07/10/2026)

Giữ Firebase Spark cho Auth, Remote Config, FCM và Firestore Native. Không nâng Blaze. Audio mới sẽ sao lưu vào bucket **private** `lifemate-audio` của Supabase Free; metadata/tên ở Firestore. Thư viện trên máy và thao tác nghe, đặt tên, cắt, nối vẫn dùng được khi cloud chưa cấu hình hoặc mất mạng.

Supabase Free hiện có $0/tháng, 1 GB file storage, giới hạn 50 MB/file, 5 GB egress và 5 GB cached egress; project có thể tạm dừng sau một tuần không hoạt động. Function có 500.000 lượt gọi trong quota Free. Hạn mức dùng chung trong project, không phải cho từng tài khoản. Không bật add-on/trả phí. File lớn hơn 50 MB vẫn giữ trên máy. [Hạn mức hiện hành](https://supabase.com/pricing).

Project đã tạo trong organization **LifeMate FREE**, region **Singapore** (`ap-southeast-1`), ref `xbhelntqytleiduzicuj`. Firebase tiếp tục ở Spark. Supabase Data API được bật để Edge Function gọi các RPC quota qua `/rest/v1`; app không gọi Data API trực tiếp. Bảng quota bật RLS, quyền bảng/RPC chỉ cấp cho `service_role`, và khóa này chỉ nằm trong Edge Function.

## Contract

`POST /functions/v1/audio-access`, header `apikey` là Supabase publishable key và `Authorization: Bearer` là Firebase ID token. Body `{ action: 'upload' | 'download' | 'delete' | 'confirm', id, fileName, mimeType, sizeBytes }`. Upload xin signed URL sau khi giữ chỗ trong hạn mức, gửi file lên Storage rồi gọi `confirm`; download trả signed URL; xóa trả `{ deleted: true }` sau khi Storage API xác nhận (hoặc file đã không còn). `confirm` trả `{ confirmed: true }` khi file có thật và đúng giới hạn. Function xác minh chữ ký RS256, issuer/audience đúng `baseapp-dd227`, hạn dùng và UID. Đường dẫn được dựng bằng UID đã xác minh; không nhận ownerId/path/bucket/URL từ client. Chỉ function dùng service-role key để thao tác object riêng tư.

Bản sửa quota ngày 21/10/2026 trong migration `20261021055132_audio_upload_reservation_retention.sql` giữ chỗ tối đa 50 MiB/path tới hết TTL 24 giờ hiện có, kể cả sau `confirm`, xóa hoặc lỗi xin URL. Signed upload vẫn dùng được 2 giờ và cho phép ghi đè, nên giảm/nhả quota ngay sẽ cho phép upload muộn vượt hạn mức. Khi chỗ dự phòng hết hạn, lần kiểm tra tiếp theo thu hồi nó và vẫn tính dung lượng object thực tế. Đổi lại, sau nhiều lần upload/xóa có thể phải chờ chỗ dự phòng hết hạn để sao lưu thêm (khoảng 20 chỗ 50 MiB trong hạn mức 1 GiB); bản local vẫn được giữ.

Migration này mới được kiểm thử cục bộ, **chưa deploy**. Khi rollout, cần ngừng cấp URL upload qua phiên bản cũ và đợi các URL đã cấp trước bản sửa hết hạn (2 giờ sau lần cấp cuối); các reservation đã bị bản cũ xóa/giảm không thể được phục hồi đầy đủ chỉ từ metadata. Không rollback RPC về cách nhả quota ngay khi vẫn có signed URL hợp lệ.

Bucket đã tạo và truy vấn xác nhận `public=false`, giới hạn `52428800` byte, chỉ nhận các MIME audio bên dưới; không có policy đọc/ghi cho anon/authenticated. Function `audio-access` đã deploy tại `https://xbhelntqytleiduzicuj.supabase.co/functions/v1/audio-access`. Gateway option **Verify JWT with legacy secret** tắt để nhận Firebase token; function tự xác minh Firebase RS256, issuer, audience, thời hạn và UID trước mọi thao tác. Tắt tùy chọn gateway này không bỏ xác thực của handler. Chỉ function giữ service-role secret; app không chứa khóa quản trị. Signed upload hết hạn sau 2 giờ, signed download sau 5 phút. Không ghi URL/token vào Firestore, local index hay log. Firebase token bị thu hồi có thể còn hiệu lực tới khi hết hạn (tối đa khoảng 1 giờ); kiểm tra revocation cần tích hợp thêm Admin API.

Metadata thêm `storageProvider: 'supabase'`; bản cũ thiếu field tiếp tục dùng Firebase để tải (nếu bucket cũ còn truy cập được). Không tự động di chuyển hoặc xóa dữ liệu cũ; người dùng có thể chủ động xóa file trong thư viện. Chỉ đánh dấu đã sao lưu sau khi cả upload và ghi metadata thành công. Thử lại ghi cùng đường dẫn của chính tài khoản.

## Các bước

- [x] Function xác thực + signed URL/xóa object, SQL bucket private giới hạn MIME/50 MB, test phân quyền.
- [x] App upload/download có progress/hủy; local fallback, giới hạn và trạng thái rõ ràng.
- [x] Typecheck/lint/tests/bundle; kiểm tra UI Simulator thực tế.
- [x] Tạo Supabase Free tại Singapore; tạo bucket private `lifemate-audio`, giới hạn 50 MB và MIME audio.
- [x] Deploy phiên bản đầu của `audio-access`, bật xác minh Firebase JWT trong handler, cấu hình `.env` local (file bị Git ignore).
- [x] Apply migration `202610090001_audio_account_quota.sql` trong Supabase SQL Editor và deploy function `audio-access` có action `confirm` cùng hạn mức 1 GB/200 bài cho mỗi UID (09/10/2026). Đã xác minh bảng/RPC, RLS bật, service role có quyền và anon bị từ chối.
- [x] Bật Supabase Data API để RPC quota dùng được qua `/rest/v1` (09/10/2026); giữ nguyên quyền chỉ dành cho `service_role`.
- [x] Smoke test endpoint trên dashboard: request không có thông tin xác thực nhận `401 unauthenticated`.
- [x] Publish Firestore rules private theo UID và provider vào 22:48 ngày 07/10/2026.
- [ ] Đăng nhập bằng tài khoản Firebase thật, rồi kiểm tra upload/download audio tổng hợp và cách ly hai tài khoản. Chưa đưa audio riêng tư lên cloud để thử.

## Triển khai khi tài khoản Supabase đã sẵn sàng

1. Project Free đã tồn tại; nếu dựng môi trường mới, chọn organization **Free** và region Singapore, giữ Firebase ở Spark. Không chọn upgrade hoặc add-on.
2. Bucket hiện tại đã được tạo qua Storage Dashboard và xác minh `public=false`, `52428800` byte, các MIME audio, 0 policy. Khi dựng lại, chạy `supabase/migrations/202610070001_audio_bucket.sql`; không thêm policy đọc/ghi cho anon/authenticated.
3. Migration `202610090001_audio_account_quota.sql` đã apply qua SQL Editor ngày 09/10/2026. Project chưa có bảng migration history; đã xác minh bảng quota và ba RPC tồn tại, RLS bật, chỉ `service_role` được gọi.
4. Function hiện tại đã deploy qua Dashboard Editor ngày 09/10/2026. Với các lần cập nhật sau, deploy bằng Supabase CLI:

   ```sh
   supabase functions deploy audio-access --project-ref xbhelntqytleiduzicuj
   ```

   Bật Data API vì function quota gọi PostgREST RPC qua `/rest/v1`. `supabase/config.toml` tắt kiểm tra JWT Supabase tại gateway vì đây là Firebase JWT. **Không được bỏ bước xác minh Firebase trong handler.** Runtime tự cung cấp `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`; không copy khóa server sang client. Giữ quyền bảng/RPC quota ở `service_role`; không cấp cho `anon` hoặc `authenticated`.

5. Firestore rules private theo UID đã publish lên `baseapp-dd227`; chỉ deploy lại khi rules đổi. Với Firebase CLI đã đăng nhập, deploy riêng Firestore rules:

   ```sh
   firebase deploy --project baseapp-dd227 --config firebase/audio.firebase.json --only firestore:rules
   ```

6. `.env` của checkout hiện tại đã có project URL và publishable key, file được Git ignore. Với checkout mới, copy `.env.example`, lấy URL và publishable key từ Settings → API Keys. Key này gửi ở `apikey`; Firebase ID token gửi ở `Authorization`. Khởi động Metro lại và rebuild JS release; không cần native module mới. Không đặt `sb_secret_` hoặc service-role key trong app.
7. Thử với audio tổng hợp trong `tests/fixtures/audio/`: nhập → đặt tên → sao lưu → mở trên thiết bị thứ hai → nghe/cắt/ghép. Kiểm tra tài khoản B không đọc được metadata hoặc lấy URL của A, request thiếu/giả token bị 401, file trên 50 MB chỉ giữ local. Không dùng file riêng của người dùng để test cloud.

Kiểm thử function độc lập: `npm ci --ignore-scripts --prefix supabase/functions`, sau đó `npm test --prefix supabase/functions`. Dependency jose được pin và có lockfile riêng. Endpoint cloud đã được smoke test với token giả; upload/download bằng Firebase user thật vẫn cần chạy sau khi đăng nhập app. Lệnh `npm run typecheck`, `npm run lint` và Android/iOS bundle đã pass với `.env` hiện tại.

## Khôi phục / giới hạn

Để dừng upload mới, bỏ URL khỏi `.env` rồi rebuild bundle. Không xóa bucket, index local hoặc metadata; các file đã tải trên máy vẫn dùng được. Nếu metadata ghi lỗi sau khi upload, thử lại sẽ ghi cùng path của chủ tài khoản. Chưa có tác vụ dọn object không có metadata; kiểm tra usage trong dashboard khi gần 1 GB. Hết hạn mức hoặc project bị pause sẽ làm sao lưu thất bại, bản trên máy vẫn được giữ. Không tự nâng gói.

## Nguồn

- https://supabase.com/pricing
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
