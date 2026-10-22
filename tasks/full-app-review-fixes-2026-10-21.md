# Review và sửa lỗi toàn ứng dụng — 21/10/2026

## Phạm vi

Review trên working tree hiện tại, bao gồm thay đổi có sẵn chưa commit. Giữ
nguyên các thay đổi đó; không commit, deploy, phát hành hay ghi dữ liệu production.
Dùng Agent Skills cho code review, debug, regression tests và quản lý thay đổi;
áp dụng Supabase skill cho phần backend. Hai reviewer chỉ đọc, chia phạm vi UI/
navigation/hooks và backend/auth/rules; main rà service/store/persistence, thực
thi test và sửa mã. Reviewer đã kiểm tra kế hoạch cụ thể trước các bản sửa và
kiểm tra delta cuối, không còn finding cần sửa trong phạm vi delta.

Các nhóm đã rà: Home/Agenda/Notes/Checklists, Finance/Cho vay/Đóng hộ/chi chung,
MP3/audio/native engine, Ký ức/private/share, Hồ sơ/đăng nhập/quản lý tài khoản,
CardScore/CardGames, navigation/component chung, cache mã hóa, Firebase rules,
Edge handlers và các migration liên quan. Đọc các review ngày 19–20/10 để không
lặp lại finding đã được xử lý. Đây là review theo luồng và rủi ro, không phải
chứng minh mọi trạng thái của mọi dòng mã đều đúng.

## Bốn lỗi đã sửa

1. **P1 — Có thể vượt quota audio bằng URL upload còn hiệu lực.**
   Xóa object làm RPC nhả reservation ngay; confirm file nhỏ cũng hạ reservation,
   trong khi signed URL cho phép upload/ghi đè thêm trong 2 giờ. Có thể tích lũy
   URL rồi upload muộn vượt 1 GiB/200 bài. Migration nối tiếp
   `20261021055132_audio_upload_reservation_retention.sql` giữ nguyên TTL 24 giờ
   hiện có, chỉ release row hết hạn, giữ mức tối đa của reservation còn hạn khi
   confirm, và dùng cùng advisory lock theo UID với reserve/confirm. Không đổi
   schema, input API hoặc quyền chỉ dành cho service role. Thêm sáu test SQL trên
   PGlite: delete trước upload muộn, confirm nhỏ rồi upsert lớn, confirm trễ sau
   reserve mới, thu hồi reservation hết hạn nhưng vẫn tính object thật, confirm
   sau expiry/missing object, và ACL/cách ly UID. Ba regression fail trên SQL cũ,
   cả sáu qua trên SQL mới. Hành vi signed URL được đối chiếu với
   [tài liệu Storage](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

2. **P2 — Mã lỗi phòng chơi bị chuyển sai thành lỗi dịch vụ 503.**
   Adapter PostgREST thiếu `room-expired`, `room-deleted`, `room-not-finished`,
   `not-owner`; handler/client đã có nhánh xử lý đúng. 503 khiến gameSession giữ
   pending và chặn thao tác mới, thay vì kết thúc thao tác thất bại. Thêm đúng bốn
   mã vào allowlist, không lộ lỗi database không biết. Sáu test adapter → handler
   kiểm tra 403/409/410 và giữ unknown error ở lỗi tổng quát; bốn test trả 503 sai
   trước sửa, cả sáu qua sau sửa.

3. **P2 — Home giữ ẩn việc đã được bỏ hoàn thành ở màn khác.**
   `HomeTodayCard` giữ ID trong `doneIds` cả sau khi lưu thành công. Tab Home vẫn
   mounted nên việc không xuất hiện lại dù Agenda đã mở lại việc đó. Chỉ giữ trạng
   thái ẩn lạc quan khi thao tác đang chạy, xóa ID trong finally; dữ liệu Agenda
   quyết định trạng thái sau lưu. Test complete → cập nhật store → undo đã fail
   trước sửa và qua sau sửa; thêm kiểm tra khôi phục hàng khi lưu thất bại.

4. **P2 — Nhắc việc không khớp dữ liệu sau xung đột đồng bộ khi đổi hoàn thành.**
   `agendaStore.complete` hủy/lập nhắc theo thay đổi đã yêu cầu. Storage có thể giữ
   bản remote và tạo conflict copy, nên ID/trạng thái/time thực tế khác bản yêu
   cầu. Dùng `reconcileAgendaReminders` trên toàn bộ `result.items`, giữ account
   guards và không xin quyền thêm. Hai regression cho cả hoàn thành/bỏ hoàn thành
   chạy storage/reminder thật với Firestore fake, kiểm tra map notification theo
   đúng ID và thời điểm đã lưu; fail trước sửa, qua sau sửa.

Ngoài ra sửa test `MemoryEditor` đã lỗi ở baseline: sau thay đổi DialogModal có
sẵn, layout center → flex-end → center nằm trên `dialog-backdrop`, không còn ở
KeyboardAvoidingView. Chuyển assertion sang container đúng, giữ kiểm tra keyboard
behavior, safe-area, khoảng cách 12pt, header và nút đóng. Không sửa layout app
để chiều theo cấu trúc test cũ.

## Kiểm chứng cuối

- Node 24.19.0; không đổi dependency hoặc lockfile.
- `npm run typecheck`: qua.
- `npm run lint`: qua toàn repository.
- `npm test -- --silent`: **124 suites / 872 tests qua**.
- `npm run test:functions`: **173 tests qua**, gồm các test SQL PGlite hiện có và
  sáu test SQL quota mới. PGlite chạy PostgreSQL nhúng với schema Storage tổng hợp;
  không thay cho kiểm chứng đồng thời trên Supabase/PostgreSQL production.
- Firestore và Storage rules: qua trên Firebase emulator, project demo, Node24/
  JDK21. Các thông báo permission-denied trong log là các trường hợp phải bị từ
  chối; cả hai script thoát 0. Không thay rules.
- Expo export offline Android + iOS: qua; output riêng trong
  `/private/tmp/lifemate-audit-export-20261021`.
- `AudioEngine.swift` + `scripts/AudioEngineSmoke.swift`: compile và smoke qua trên
  macOS với audio tổng hợp; extraction, trim, mixed-format merge, thứ tự 880Hz →
  440Hz, audio-only output, từ chối silent input/khoảng cắt sai.
- `node --check server/send-push.mjs` và `git diff --check`: qua.
- So sánh diff đầu/cuối: chỉ các file thuộc bản sửa/test/tài liệu này thay đổi;
  không mất mục dirty/untracked có sẵn.

## Dependency audit còn mở

`npm audit --omit=dev` báo theo số package bị ảnh hưởng, không phải số lỗi độc lập:
root có 29 high/12 moderate/0 critical; server có 8 moderate/0 high/0 critical;
functions có 0 advisory. Root quy về bốn advisory cho `braces`, `node-forge`,
`sprintf-js`, `uuid`; server lặp advisory `uuid`.

Đã truy dấu các package trong toolchain: braces qua micromatch/Metro/Jest;
node-forge qua Expo code-signing certificates (có gọi verify); sprintf-js qua
formatting/tooling; Xcode project dùng uuid.v4, khác nhánh v3/v5/v6 với buffer của
advisory. Không tái hiện được khai thác qua input ứng dụng trong lượt này, không
khẳng định toolchain hoàn toàn an toàn.

Registry tại lúc kiểm tra vẫn trả braces3.0.3, node-forge1.4.0 và sprintf-js1.1.3,
nằm trong khoảng advisory. uuid mới14.0.3 nhưng ép override xuyên các dependency
cũ có thể phá API/module compatibility; chưa có bản nâng cấp đã kiểm chứng. Các
đề xuất audit còn bao gồm đổi major hoặc downgrade Expo/Firebase. Giữ nguyên bộ
SDK/lockfile, không chạy forced remediation. Khi build chỉ dùng repo, glob và
certificate đáng tin cậy; chưa thêm allowlist che advisory. Theo dõi nâng cấp từng
package với test tương thích; ngày rà lại: **28/10/2026**.

## Giới hạn và rollout

- Bản sửa quota giữ tối đa50MiB/path tới hết24h hiện có, kể cả sau xóa/confirm/lỗi
  cấp URL; có thể tạm giới hạn khoảng20 chỗ trước khi hết reservation, dù file
  thật nhỏ. Đây là chi phí bảo thủ để không nhả dung lượng khi URL còn dùng được.
- **Migration audio và game Edge change chưa deploy.** Xem
  `docs/free-audio-storage.md`: ngừng cấp URL bằng phiên bản cũ và đợi URL cũ hết
  hạn2h trước khi tuyên bố quota được bảo vệ đầy đủ; reservation cũ đã bị xóa/giảm
  không thể được khôi phục hoàn toàn từ metadata. Không rollback về nhả quota ngay.
- Chưa kiểm thử Storage replay bằng dịch vụ thật, PostgreSQL concurrency thật,
  push/APNs thật, native Android instrumentation hoặc thao tác toàn bộ UI trên
  điện thoại thật. Android không có thiết bị kết nối. Bundle/smoke/component test
  không thay cho các kiểm chứng đó.
