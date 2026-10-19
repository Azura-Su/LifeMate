# Review toàn ứng dụng: logic và UI — 19/10/2026

Phạm vi: mã hiện tại trong working tree, gồm các sửa đổi chưa commit. Review và kiểm chứng; không sửa production code, không deploy, không thay dữ liệu tài khoản thật. Kết quả không khẳng định bản TestFlight hiện tại chứa đúng cùng mã.

## Các lỗi cần sửa

### 1. P1 — Gỡ chia sẻ có thể báo thành công nhưng nội dung vẫn hiện với bạn bè

- Vị trí: `supabase/functions/memory-access/handler.mjs:300–329`, đặc biệt DELETE tại322–329.
- Unshare chuyển row ảnh từ `active` sang `pending`, chờ xóa object, rồi DELETE chỉ row có status `pending`. Trong khoảng chờ, request `confirm` đồng thời có thể xác nhận ảnh còn tồn tại và chuyển row đó về `active`. DELETE sau đó không khớp row nhưng vẫn trả200 `{shared:false}`.
- Hậu quả: người dùng tưởng đã chuyển về riêng tư trong khi row vẫn active, feed vẫn có thể trả nội dung/ngày. Object ảnh có thể đã bị xóa; không khẳng định ảnh luôn còn truy cập được.
- Reviewer chạy handler thật với adapter PostgREST/R2 trong bộ nhớ, điều khiển đúng thứ tự trên: cả hai request200, row còn active. Không gọi backend thật.
- Hướng sửa: trạng thái/ý định thu hồi tách khỏi upload-pending, confirm không được kích hoạt lại; claim thu hồi và kiểm tra kết quả DB trước khi báo hoàn tất. Thêm regression cho confirm/unshare đồng thời.

### 2. P2 — Form sửa cũ có thể ghi đè dữ liệu mới vừa tải về

- Tài chính: `src/services/finance/financeStorage.ts:813–819`; caller `src/screens/Finance/useFinanceScreen.ts:155–168`.
- Ghi chú: `src/services/notes/noteStorage.ts:353–359`.
- Công việc: `src/services/agenda/agendaStorage.ts:386–392`.
- Tình huống: bắt đầu tải lại, mở sửa bảnA trong khi tải chưa xong; thiết bị khác đã sửa thànhB, lượt tải cập nhật cacheB; người dùng lưu draftC được tạo từA. Các service dùng cacheB tại thời điểm lưu làm expected/base, nên so sánh với cloudB thành công và ghiC, không nhận ra draft dựa trênA.
- Kiểm chứng main: transpile chính các module thật bằng TypeScript, thực thi VM với Firestore/cache giả lập trong bộ nhớ. Với Notes và Agenda: kết quả `synced:true`, chỉ1 record,0 bản xung đột; nội dungB bị thay bằngC. Với Finance: amount100→remote200→lưu draft cũ sửa note; cloud trở lại amount100, `synced:true`,0 conflict.
- Hướng sửa: đưa snapshot/revision lúc mở form xuyên suốt UI/store/service; phát hiện bản đã đổi trước khi ghi, giữ draft để người dùng xử lý. Kiểm tra cả hoàn thành tác vụ vì nó cũng ghi lại toàn bộ item.

### 3. P2 — Hết thời gian xác nhận email khi app ở nền có thể làm hỏng màn Hồ sơ

- Vị trí: `src/screens/Profile/ProfileEmailVerification.tsx:121–124`.
- Gửi email xác nhận, đưa app xuống nền quá60 giây rồi trở lại. `seconds` còn dương nên effect khởi động lại; gọi `tick()` ngay, tính left=0, rồi dùng `timer` trước dòng `const timer = ...` được thực thi.
- Reviewer thực thi chính effect body với đồng hồ đã hết hạn: `ReferenceError: Cannot access 'timer' before initialization`, interval chưa được tạo. Không cần giả định lỗi mạng.
- Hướng sửa: khởi tạo timer trước lần tick đầu hoặc xử lý tick đầu riêng không tham chiếu timer chưa tồn tại; thêm test background→expired→active.

### 4. P2 — Timeout đọc phản hồi ảnh riêng không bảo đảm giải phóng hàng đợi

- Vị trí: `src/services/memories/memoryPrivatePhotos.ts:78–108`.
- Timer20 giây và listener đổi tài khoản chỉ abort fetch. Sau khi fetch trả response, `response.json()` không được race với promise reject riêng. Trong fetch polyfill đã cài, listener abort của XHR được tháo khi XHR hoàn tất, trước bước đọc body bằng FileReader.
- Nếu bước giải mã body bị treo, abort không settle promise; sync giữ hàng đợi UID và các thao tác lưu/chia sẻ/sync sau đó cùng bước chờ drain khi dọn tài khoản có thể chờ vô hạn.
- Reviewer chạy module thật trong VM với JSON decoder không settle: sau timeout và logout, signal đã aborted nhưng upload promise vẫn pending. Đây là tái hiện có kiểm soát, chưa có trace FileReader bị treo trên iPhone thật trong đợt review này.
- Hướng sửa: race cả fetch và body với deadline/session rejection rõ ràng, như `requestMemoryAction` trong memorySharing; thêm test stalled body và logout.

## Phạm vi đã rà

- Main: Finance/store/service/report/shared expenses, Loan/HeldMoney hook và privacy/dialog callers; Notes/Agenda/cache/conflict/reminder flows; Checklists/CardScore persistence và các luồng tạo/sửa/xóa; đối chiếu SPEC và tests.
- Reviewer dữ liệu: auth/profile/admin/account lifecycle, Firebase/Supabase authorization, migrations/cleanup, memory storage/private photo/sync và handler.
- Reviewer UI: navigation/shared components, Home/Settings integration, Profile editor/crop/verification/password, Memories capture/editor/timeline/gallery/gesture và MP3 library/playback/queue.
- Những lỗi cũ về library marquee chạy khi background, interval email chạy vô ích, và sync kỷ niệm ghi lại toàn cache dù không đổi đã được sửa trong mã hiện tại. Không lặp lại các finding cũ như lỗi chưa sửa. Countdown mới có lỗi khởi tạo timer nêu trên.
- Chưa xác nhận thêm lỗi bố cục cụ thể trong các đường dẫn đã đọc; không coi sở thích giao diện hoặc khoảng trống test là bug.

## Kiểm tra đã chạy

- `npm run typecheck`: qua.
- `npm run lint`: qua toàn repository.
- `npm test -- --watchman=false`:99 suites /621 tests qua.
- `npm run test:functions` với Node runtime phù hợp:84 tests qua.
- Export offline cả iOS/Android bằng Expo: qua; output `/tmp/lifemate-review-export`. Đây là JS/Hermes export, không phải native archive/TestFlight.
- `git diff --check`: qua.
- Firestore rules emulator: không khởi động được vì npx không tải được firebase-tools từ registry.npmjs.org (`ENOTFOUND`). Không khẳng định rules tests đã qua.

## Giới hạn

Không chạy các tình huống đồng thời trên hai tài khoản/thiết bị thật, không kiểm tra màn hình bằng thao tác thủ công trên toàn bộ kích thước thiết bị, không đo nhiệt/CPU, không gọi production Firebase/Supabase/R2. Các harness chỉ dùng dữ liệu tổng hợp trong bộ nhớ. Không thay secrets, dependencies, migrations hoặc production code trong review.

## Bản sửa sau review

Cả bốn finding đã được sửa trong mã nguồn và bổ sung regression; xem
[full-app-review-fixes-2026-10-19.md](full-app-review-fixes-2026-10-19.md).
Migration/backend mới chưa triển khai; PostgreSQL regression chưa được thực thi.
