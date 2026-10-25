# Công việc

## Khóa Tài chính bằng Face ID — 08/10/2026

- [x] Review xác định lỗi khóa khi Finance blur và Home eye bị reset khi iOS prompt chuyển inactive.
- [x] Store phiên Tài chính dùng chung, hết hạn tại background hoặc account change; chặn kết quả xác thực cũ.
- [x] Coordinator gọi Face ID một lần tại startup/resume; hủy prompt cho phép thử lại thủ công.
- [x] Bỏ khóa tại Finance blur; Home eye dùng lại phiên và chỉ quên trạng thái hiện số khi app xuống background.
- [x] Điều chỉnh regression đã có để theo chính sách phiên dùng chung, iOS inactive, chuyển tab và background/resume.
- [x] Cập nhật kế hoạch và tài liệu theo chính sách đã sửa.
- [ ] Chưa chạy Jest/TypeScript/lint hoặc build trong lượt sửa này.

## Rà thiết kế và tính năng toàn app — 08/10/2026

- [x] Rà mã/test và giao diện runtime; lưu bằng chứng, mức ưu tiên và kế hoạch trong docs/app-audit.md và tasks/plan.md.
- [x] Chặn dữ liệu tài khoản cũ trong Tài chính và sửa tổng chi với danh mục cũ; regression tests.
- [x] Chọn kỳ qua draft: hủy không đổi năm/tháng, áp dụng xuyên năm đúng; regression tests.
- [x] Ghim tabs/nút thêm Tài chính, thu gọn báo cáo, mở/đóng chi tiết tháng, cải thiện dòng giao dịch và form.
- [x] Home có tổng tháng theo tài khoản và lối vào Tài chính/MP3; trạng thái tải/lỗi và navigation.
- [x] Thư viện tìm tên file có/không dấu, bỏ chọn ghép nhanh và trạng thái không có kết quả; regression tests.
- [ ] Chạy lại Jest/TypeScript/lint/build và Simulator sau thay đổi vòng đời Face ID; kết quả trước đó chưa bao phủ chính sách phiên mới.
- [x] Lỗi Tài chính được dịch rõ ràng, version theo app config; Login có phím Next sang mật khẩu và lời dẫn gọn.

## Hệ màu nâu đất, mây trời và nắng nhạt — 08/10/2026

- [x] Xây bảng màu token nâu đất, trắng mây, xanh trời và vàng nắng nhạt; thêm kiểm tra độ tương phản cho chữ, nút và trạng thái.
- [x] Áp dụng xuyên suốt nền, chữ, nút, cards, tabs, player, dialogs, trạng thái, splash/adaptive icon/notification; gom màu giao diện về theme.
- [x] Chạy Jest (35 suites / 120 tests), typecheck, lint, Prettier và bundle iOS/Android.

## Nhiều danh sách nghe — 08/10/2026

- [x] Thêm mô hình playlist theo UID, migration playlist cũ và kiểm thử tạo/chọn/thêm một file vào nhiều playlist.
- [x] Thêm bộ chọn/tạo danh sách trên tab MP3; playlist đang chọn quyết định queue được phát.
- [x] Cho phép mở bộ chọn membership ở mỗi file thư viện; xóa file sẽ gỡ khỏi mọi playlist.
- [x] Chạy kiểm thử liên quan, typecheck, lint và kiểm tra diff: 34 suites / 111 tests, typecheck, lint, Prettier đều pass.

## Xóa danh sách nghe — 08/10/2026

- [x] Đặt thùng rác bên trong chip đang chọn; xác nhận xóa hẳn playlist và tên, giữ file gốc.
- [x] Cho phép trạng thái không còn playlist, giữ trạng thái đó sau khi mở lại và hiển thị hướng dẫn tạo mới.
- [x] Kiểm thử xác nhận/migration/xóa danh sách cuối; 34 suites / 116 tests, typecheck, lint, Prettier và bundle Android/iOS đều pass.

## Đổi tên danh sách nghe — 08/10/2026

- [x] Thêm đổi tên playlist đã chọn và kiểm tra tên trùng không phân biệt chữ hoa/thường khi tạo hoặc đổi tên.
- [x] Báo “Tên này đã có rồi” khi trùng; 34 suites / 119 tests, typecheck, lint, Prettier và bundle Android/iOS đều pass.

## Đặt tên âm thanh — 07/10/2026

- [x] Đặt tên trước khi nhập audio/video; đổi tên audio đã lưu, không thay đổi file gốc.
- [x] Giữ tên mới khi offline/làm mới thư viện; đổi tên bản đã sao lưu chỉ cập nhật metadata.
- [x] Làm rõ sao lưu Firebase và kiểm thử nhập, hủy, đổi tên, tải lại dữ liệu.
- Lịch sử chẩn đoán Xcode: Firestore từng trả `Cloud Firestore API has not been used in project baseapp-dd227 before or it is disabled`. Hiện database Native và rules riêng theo UID đã được cấu hình; vẫn còn kiểm thử đồng bộ bằng tài khoản thật.

## Audio — 07/10/2026

- [x] A1. Types và validation (types/audio, utils/audio, tests): reject bounds, limits, remote paths; verify focused Jest.
- [x] A2. Native engine iOS (module config + Swift): inspect, audio-only export, trim/ordered concat/cancel; verify build + synthetic media.
- [x] A3. Native engine Android (Gradle + Kotlin): cùng contract, AAC output; verify build + synthetic media. Depends A1.
- [x] A4. Local library (file service/store/tests): persistence per UID, no data loss on errors; verify reopen/isolation. Depends A1.
- [x] A5. Cloud library (Firebase service/rules/tests): owner-only, upload audio, retry/download; verify rules/service. Depends A4.
- [x] A6. Import flow (hook/screen/styles/tests): picker cancel, audio unchanged, video export and cleanup, progress/cancel. Depends A2–A5.
- [x] A7. Player + clip editor (component/hook/tests): preview, bounds, title, save new; verify UI/state. Depends A6.
- [x] A8. Ordered merge (editor/logic/tests): 2–10 segments, reorder, save output; verify duration/order. Depends A7.
- [x] A9. Checkpoint: lint/typecheck/Jest/bundle, native builds/runtime, Firebase setup docs, APK preview. Ghi đúng giới hạn cloud thật.

## Kho âm thanh miễn phí — 07/10/2026

- [x] Đã vào Firebase Console, đối chiếu database và bucket; project Spark ($0).
- [x] Chuyển database trống sang Firestore Native theo xác nhận của chủ tài khoản; Console xác nhận database sẵn sàng.
- [x] Chuẩn bị Supabase Edge Function xác minh Firebase JWT, private bucket, giới hạn 50 MB/file; tests bảo vệ UID và token.
- [x] App chuyển upload mới sang Supabase, download theo provider, metadata Firestore; local fallback không mất file/tên.
- [x] Typecheck/lint, 69 Jest tests, 16 server tests, 18 emulator assertions, Hermes Android/iOS; UI Simulator hiển thị đúng local-only và giữ bản đã lưu.
- [x] Firestore rules private theo UID xuất bản thành công lúc 22:48 theo xác nhận của chủ tài khoản.
- [x] Tạo organization/project Supabase Free ở Singapore; Firebase giữ Spark.
- [x] Tạo bucket private 50 MB, audio-only; deploy function xác minh Firebase JWT; cấu hình `.env` local bị Git ignore.
- [x] Smoke test function trên dashboard: token giả nhận 401; Android/iOS bundle build với cấu hình Supabase.
- [ ] Đăng nhập app bằng tài khoản Firebase thật, thử upload/download fixture tổng hợp và phân quyền hai tài khoản. Chưa upload audio cá nhân.
- [x] Push triển khai audio lên GitHub trước đó; ghi chú triển khai lần này sẽ được commit/push riêng.

## Nền tảng đã hoàn tất

- [x] 1. Nền tảng: package/config/assets, strict TypeScript. Verify: install + Expo config.
- [x] 2. Logic users: types/defaults/parser/tests. Verify: malformed JSON, email normalization, fallback.
- [x] 3. Auth: service/store/login hook. Verify: validation + auth transition tests.
- [x] 4. Remote Config: service/store/lifecycle. Verify: fetch fail/cache/malformed payload tests.
- [x] 5. Notification: service/store/lifecycle/entrypoint. Verify: permission/token/error tests.
- [x] 6. UI dùng chung: theme/button/screen/avatar. Verify: typecheck/accessibility review.
- [x] 7. Login + auth gate. Verify: component tests.
- [x] 8. Home + MP3. Verify: name location/empty state/navigation.
- [x] 9. Setting + bottom tabs. Verify: logout and session reset.
- [x] 10. Server push tool + setup docs. Verify: syntax/no client Admin credentials.
- [x] 11. Checkpoint: lint/test/typecheck/bundle/doctor/prebuild; native build/runtime nếu khả dụng. Ghi rõ giới hạn chưa kiểm chứng.

## Giới hạn kiểm chứng

Native builds Android/iOS đã pass. Chưa có tài khoản Auth thử nghiệm hoặc APNs credentials để xác minh login thành công/push thật. Chi tiết trong `docs/verification.md`.

## Avatar: bottom sheet và kéo cắt ảnh — 17/10/2026

- [x] Hình học crop + tests ảnh ngang/dọc, zoom/pan biên.
- [x] Hook chọn/chỉnh/cắt ảnh, giữ draft khi hủy/lỗi, cleanup và UID guards + regression tests.
- [x] Badge camera nhỏ, sheet hai lựa chọn và crop tương tác + component tests.
- [x] Typecheck/lint/Jest/export và kiểm tra UI khả dụng; final reviewer; SPEC và ghi nhận kết quả.

- [x] Yêu cầu bổ sung: camera đổi ngay sang spinner khi mở sheet, giữ loading khi chuẩn bị ảnh, tự reset khi sheet hiện/hủy; 2 regression tests ở ProfileAvatarLoading.

## Audit fixes — 17/10/2026

- [x] Unique Supabase migration versions and verified production history state.
- [x] Four default CardScore rows and visible finish-save error/retry.
- [x] Held-money dialogs obey Finance lock; stale callbacks and Android date picker covered.
- [x] Memory orphan originals cleaned after durable cache changes; failures retry.
- [x] Failed photo isolated so other memories still synchronize.
- [x] Targeted/full checks and independent read-only review. See audit-fixes-result-2026-10-17.md.

## Memory latency/loading — 17/10/2026

- [x] Identify and reproduce repeated cached-original verification and overlapping loads.
- [x] Persist local verified-R2 proof safely; keep legacy verification, recovery and snapshot compatibility.
- [x] Coalesce loads, retain trailing server refresh, suppress unused friend feed.
- [x] Finish confirmed sharing without awaiting whole-library refresh; guard late/unknown state.
- [x] Add selected-action, timeline-sync and photo loading indicators.
- [x] Regression tests/full Jest568, typecheck/lint/export, native smoke and independent review. See memory-loading-performance-2026-10-17.md.

## Memory text-only edit — 17/10/2026

- [x] Existing edit form changes text only; new-memory controls retained.
- [x] Delete overlay on photo top-right; photoless fallback retained.
- [x] Legacy text-only save validated before revocation; unverified-owner edits remain available.
- [x] Targeted44/full576 tests, typecheck/lint, native smoke and final review completed. See memory-text-only-edit-2026-10-17.md.

## Sửa luật Phỏm trong phòng — 23/10/2026

- [x] Pending rules/RPC/SQL và takeover capability atomic.
- [x] Form/dialog/protocol6 và hiển thị luật hiện tại/ván tới.
- [x] Kiểm tra/review/rollout theo inroom-phom-rules-2026-10-23.md (1.055 Jest, 251 backend; v13).


## Phỏm tùy chọn luật — 23/10/2026
- [x] Review kế hoạch và xác nhận tái vòng hạ.
- [x] Thêm options/validation/protocol7 và migration additive.
- [x] Xử lý gửi/ù đền/tái ở server và form tạo/sửa luật.
- [x] Kiểm chứng regression, review diff, tài liệu và deploy tương thích:1.062 Jest,261 backend, v14. Xem phom-optional-rules-2026-10-23.md.

## Cuộn Luật ván tới — 23/10/2026

- [x] Tái hiện, xác định press responder của shell và sửa DialogModal.
- [x] Regression RED/GREEN,80 targeted tests, typecheck/lint, review độc lập.
- [x] Full Jest133 suites/1.063 tests, export iOS/Android và runtime đạt. Xem room-rules-scroll-2026-10-23.md.

## Chặn mất tùy chọn Phỏm — 23/10/2026

- [x] Tái hiện client6 ghi đè mất Tái/Gửi/Ù đền; guard SQL trước mutation, giữ retry/ACL/CAS.
- [x] Regression263 backend, lint/syntax/diff, review độc lập và deploy migration/Edgev15; PostgreSQL rollback probe đạt. Xem phom-rules-capability-fix-2026-10-23.md.

## Đền Phỏm bắt buộc / nguồn tái — 25/10/2026

- [x] Reviewer chỉ đọc duyệt kế hoạch và hợp đồng config/state; giữ contract cũ,
  provenance riêng theo lượt, không suy đoán từ chotEater; không cần rules marker.
- [x] RED/GREEN engine: cấp 3 cây luôn đền, đúng nguồn tái và vòng đời nguồn;
  20 test mới và 36 test engine/options đạt.
- [x] RED/GREEN UI: tùy chọn tái có điều kiện, luật bắt buộc, create/edit/view;
  156 test liên quan đạt sau 19 thất bại RED ban đầu.
- [x] Test tích hợp room/worker/serialization/privacy và toàn bộ 289 backend
  tests đạt; dependency jose được cài đúng lockfile, không đổi dependency.
- [x] TypeScript, lint, formatting/diff, bundle hai nền tảng đạt; toàn bộ Jest
  136 suites/1.229 tests đạt. Chưa xác minh native do Device Hub timeout;
  backend production v17 đã triển khai sau khi người dùng xác nhận.
- [x] Review final diff và cập nhật SPEC theo luật mới; reviewer không có
  phát hiện chặn. Kết quả Jest/bundle/runtime cuối cùng ghi trong plan chi tiết.
- [x] Người dùng cho phép deploy; game-access v17 ACTIVE, source18/18 khớp,
  probe401 và 41 test trên source read-back đạt; backup/rollback v16 sẵn sàng.
- [x] Đã chờ426 giây, log kiểm tra chỉ v17/không error, đọc lại source18/18
  và probe401 cuối đạt; mode open, cron deadline active. Rollout hoàn tất.
