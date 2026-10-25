# Kế hoạch LifeMate

## Sửa vòng đời Face ID của Tài chính — 08/10/2026

Theo [thiết kế khóa Tài chính](../docs/finance-lock.md): thẻ tổng quan Home luôn hiển thị và không gọi Face ID; công tắc riêng quyết định tab Tài chính có cần xác thực hay không. Khi khóa tab bật, app mới hoặc quay lại từ background tại tab Tài chính yêu cầu Face ID. Hủy prompt giữ khóa. Thiết lập vẫn riêng theo UID/thiết bị.

1. Thêm revision phiên tăng khi background hoặc thiết lập tài khoản đổi, không tăng khi Finance mất focus hay iOS inactive.
2. Chuyển xác thực tự động về coordinator cấp app; gate Finance chỉ kiểm tra phiên và cho phép thử lại thủ công sau khi hủy.
3. Giữ quyền mở khóa cho tab Tài chính; không gắn khả năng hiển thị tổng quan Home với phiên Face ID.
4. Đối chiếu startup, hủy, chuyển tab lặp, Home eye, background/resume và account switch theo tiêu chí trong `docs/finance-lock.md`.

## Rà toàn app và cải thiện — 08/10/2026

Theo [báo cáo rà soát](../docs/app-audit.md), triển khai trong cùng lượt theo các lát cắt sau; giữ checklist kiểm chứng cloud còn mở bên dưới.

1. **Dữ liệu Tài chính (3–4 file):** dùng hook chung bind UID và chặn dữ liệu cũ ngay khi render; báo cáo chi cộng mọi khoản chi và nhóm danh mục cũ vào Khác. Chấp nhận: không xuất hiện số liệu sai tài khoản, tổng chi khớp các giao dịch hợp lệ. Kiểm chứng: hook/component và utility regression tests.
2. **Chọn kỳ (2–3 file):** draft năm/tháng trong picker; chỉ cập nhật báo cáo sau chọn tháng. Chấp nhận: đóng/hủy không đổi kỳ; chọn xuyên năm vẫn đúng. Kiểm chứng: component tests đóng và áp dụng.
3. **Tài chính dễ dùng (4–5 file):** header gồm title, nút thêm, tabs cố định; bộ lọc gọn; ẩn danh mục 0; mở/thu gọn tháng, bố cục giao dịch và form dễ đọc. Chấp nhận: thêm luôn trong tầm tay và đúng kỳ/loại; thấy tổng năm và từng khoản khi mở tháng; form đóng được khi bàn phím mở. Kiểm chứng: screen/form tests, Simulator. Phụ thuộc 1–2.
4. **Home là điểm bắt đầu (3–4 file):** tổng tháng hiện tại theo UID với loading/local/error rõ ràng, lối vào Tài chính và MP3, giảm hero. Chấp nhận: dữ liệu tháng tự nạp và điều hướng đúng. Kiểm chứng: Home tests + navigation integration + Simulator. Phụ thuộc 1.
5. **Thư viện MP3 (3–5 file):** tìm theo tên có/không dấu, xóa tìm kiếm, báo không có kết quả, bỏ chọn ghép nhanh; giữ thứ tự và selection khi lọc. Chấp nhận: tìm đúng file và không làm mất file/chọn ghép; header/player/list scrolling theo yêu cầu cũ. Kiểm chứng: library/search tests + Simulator.
6. **Checkpoint:** kiểm thử toàn bộ, typecheck, lint, bundle hai nền tảng, rà diff và cập nhật README/SPEC/CAPABILITIES theo bốn tab hiện tại. Không thay schema hay publish dịch vụ ngoài trong đợt này.

Không dùng dependency mới. Các thay đổi giao diện bám màu hiện có; hành vi dữ liệu được test trước khi sửa. Dữ liệu người dùng và các thay đổi đang có được giữ trong workspace.

## Hệ màu nâu đất, mây trời và nắng nhạt — 08/10/2026

Rà soát giao diện toàn app theo bảng màu nâu đất nhạt, trắng mây/xanh trời và vàng nắng nhạt. Dùng token ngữ nghĩa thống nhất cho nền, mặt thẻ, chữ, CTA, trạng thái, đường viền, lớp phủ và điều khiển; đặt vàng nắng làm điểm nhấn nhỏ, giữ diện tích nâu/be và xanh cân bằng; thay các màu hardcode còn sót ở component, màn hình và cấu hình splash/adaptive icon/notification. Giữ tương phản chữ và nút đủ dùng, kiểm chứng bằng test tương phản, Jest, typecheck, lint và bundle Android/iOS.

## Mở rộng danh sách nghe — 08/10/2026

Mở rộng danh sách nghe đơn hiện tại thành nhiều playlist riêng theo tài khoản, lưu metadata trên thiết bị và giữ khả năng đọc dữ liệu cũ. Người dùng có thể tạo/chọn/đổi tên/xóa playlist để phát; tên playlist phải duy nhất, kiểm tra không phân biệt chữ hoa/thường và báo rõ khi tên đã có. Từ thư viện, chọn nhiều playlist cho cùng một file. Xóa file âm thanh sẽ gỡ file khỏi mọi playlist; xóa playlist bỏ toàn bộ playlist và tên đó nhưng giữ các file âm thanh trong thư viện. Xóa playlist cuối cùng để lại trạng thái rỗng để người dùng tự tạo danh sách mới.

Các bước: (1) thêm schema và migration từ key playlist cũ, kiểm thử hook với nhiều danh sách và membership độc lập; (2) thêm chọn/tạo playlist trên tab MP3 và kiểm thử điều hướng trạng thái; (3) thêm bộ chọn nhiều playlist trong thư viện, kiểm thử truy cập và membership; (4) chạy typecheck, lint, Jest và kiểm tra diff.

## Mở rộng đang thực hiện: audio (07/10/2026)

Theo [SPEC-audio.md](../SPEC-audio.md): thư viện riêng theo UID; nối lần lượt đã được người dùng xác nhận. Thứ tự triển khai: validate/types → native inspect/export → local library và cloud rules → import/sync → player/editor → kiểm chứng và tài liệu. Cắt/ghép tạo file mới; audio gốc giữ nguyên, video chỉ được xử lý local. Lưu local trước upload để tránh mất kết quả khi mạng/billing chưa sẵn sàng. iOS AVFoundation và Android Media3 xuất AAC/M4A; audio nhập sẵn không chuyển mã.

Điểm kiểm chứng chính: native export thật với fixture, test sync lỗi vẫn giữ local, test đổi UID/hủy job, rules owner isolation, UI import → list → cắt/ghép → mở lại. Firebase production còn phụ thuộc quyền truy cập Console và gói Blaze; không tự nâng gói.

## Mục tiêu

Ứng dụng React Native Android/iOS, tên LifeMate, ảnh người dùng cung cấp làm avatar/icon, bundle ID iOS và Android package `vn.mobifone.vnsteel`. Firebase project lấy từ hai file cấu hình được cung cấp: `baseapp-dd227`.

## Kiến trúc

- React Native 0.83 + TypeScript strict, Expo SDK 55 development build/prebuild (native Firebase, không dùng Expo Go). SDK 55 tương thích Xcode 26.3 hiện có; SDK 57 cần Xcode 26.4+.
- React Navigation: auth gate và bottom tabs Home / Tài chính / MP3 / Cài đặt.
- Zustand: auth session, cấu hình users, trạng thái push. Không lưu password/token Auth vào store persist; Firebase quản lý phiên.
- `src/screens/<Screen>/`: `<Screen>Screen.tsx`, `use<Screen>Screen.ts`, styles khi cần.
- `src/hooks/`: lifecycle dùng chung; `src/utils/`: hàm thuần validate/parse/mapping.
- `src/services/firebase/`: adapter Auth, Remote Config, Messaging; `src/store/`: Zustand.
- `src/components/`, `src/theme/`, `src/navigation/`, `src/types/`, `assets/`.
- `server/`: công cụ gửi push bằng Firebase Admin chạy riêng, không import vào app; credentials qua Application Default Credentials.
- Cấu hình native từ `app.json`; thư mục `ios/`, `android/` được sinh bởi prebuild.

## Hành vi

1. Login email/mật khẩu; validate, loading, lỗi tiếng Việt; khôi phục session; logout trả về login và không quay lại tab bằng Back.
2. Home có tên phía trên bên trái. `users` là tham số JSON Remote Config, không phải collection database. Mẫu `[{"mail":"su.azura99@gmail.com","name":"Asher"}]`. Chuẩn hóa email; fallback displayName/email nếu chưa khớp. JSON lỗi không làm crash hoặc làm mất cấu hình tốt trước đó.
3. MP3 hiển thị trạng thái thư viện trống; chưa thêm player/nguồn nhạc vì chưa được yêu cầu.
4. Setting: tài khoản, trạng thái push, bật thông báo, logout.
5. FCM: xin quyền theo thao tác người dùng, xử lý token refresh, foreground, background và notification-open. Không chặn login khi APNs/FCM chưa sẵn sàng.
6. Logo gốc được giữ; icon dùng chính ảnh cung cấp. Màu kem/vàng từ ảnh, chữ tối, safe area, scroll và bàn phím phù hợp mobile.

## Kiểm chứng

`npm run typecheck`, `npm run lint`, `npm test`, `npm run bundle`, `npx expo-doctor`, `npm run prebuild`; thử native build nếu môi trường cho phép.
Unit/integration tests cho parser, tên, login validation, auth gate/logout, lỗi fetch và push permission. Kiểm thử Firebase thật cần tài khoản thử nghiệm; push iOS cần APNs key và signing của chủ dự án.

## Ranh giới

Luôn tách UI/logic/service/store, validate remote data, dùng API Firebase modular. Không chứa Admin key trong app hoặc log password/token. Không tự publish Remote Config, tạo user hoặc gửi push khi chưa có yêu cầu. Danh sách Remote Config chỉ là metadata hiển thị công khai, không làm authorization.

## Rủi ro và cấu hình bên ngoài

- Firebase Console: bật Email/Password; tạo tài khoản thử; publish `users`.
- iOS push: upload APNs key trong Firebase, provisioning có push entitlement.
- MP3 player cần yêu cầu nguồn nhạc, playlist, background playback ở bước sau.

## Nguồn

- https://docs.expo.dev/guides/using-firebase/
- https://rnfirebase.io/
- https://rnfirebase.io/remote-config/usage
- https://rnfirebase.io/messaging/usage

## Avatar: bottom sheet và kéo cắt ảnh — 17/10/2026

Theo yêu cầu người dùng “lên plan và làm”; giữ nguyên các công việc cũ còn mở. Không thay backend hoặc hợp đồng lưu ảnh.

1. Hình học crop: hàm thuần tính ảnh cover trong khung vuông, zoom 1–3x, giới hạn pan và quy đổi sang pixel nguồn. Regression tests ảnh ngang/dọc, zoom và kéo quá biên.
2. Chuẩn bị ảnh: picker không dùng native crop, trả ảnh vào preview; chỉnh avatar hiện tại dùng draft hoặc tải URL riêng còn hiệu lực về cache. Xác nhận crop mới tạo JPEG384×384<=512KiB; hủy giữ draft cũ. Dọn file tự tạo và chặn kết quả trễ khi UID/unmount thay đổi; giữ Save hiện có. Kiểm thử hook trước/sau thay đổi, review độc lập vì xử lý ảnh riêng.
3. Giao diện: camera badge20/icon12 trên avatar64. Sheet 2 lựa chọn, crop kéo ảnh/zoom/reset/hủy/dùng ảnh, safe area và vùng chạm >=44. Đóng sheet trước native picker; không đổi tên/ảnh khi hủy. Kiểm thử component và Simulator nếu có phiên phù hợp.
4. Checkpoint: targeted Jest, npm run typecheck, ESLint file thay đổi, export iOS/Android khi phù hợp; final review/diff và cập nhật SPEC-profile.md. Không lưu ảnh thử vào tài khoản thật.

Phụ thuộc: 1 -> 2 -> 3 -> 4. Không thêm dependency. Ảnh avatar đã lưu chỉ còn bản crop hiện có; chỉnh lại ảnh đó không khôi phục phần ảnh gốc đã cắt mất, người dùng có thể chọn lại ảnh thư viện.


## Audit fixes — 17/10/2026

1. Rename preserve-memory-invites to version 202610140003; regression check unique prefixes and dependency order. Read-only production query confirms schema_migrations absent; document safe baseline/repair rather than guessing applied history.
2. CardScore: four default rows on every setup, retain 2–8 via remove; finish-save errors inside confirmation, retry remains available.
3. Held money: propagate suspension, close all dialogs including native Android dates and replace native delete alerts; invalidate callbacks on lock/UID change/unmount.
4. Memory: isolate photo transfer failures, persist successful items incrementally, retain failed intents; prune only unreferenced validated photo filenames within UID queue after durable cache reads, retry cleanup.
5. Targeted regression tests, typecheck, affected lint, functions tests, full Jest, final read-only review. Prior work preserved.

Plan reviewed by r2_review before implementation; native dialogs and interaction-generation safeguards incorporated.

Completed all audit steps; full Jest547, functions84, typecheck/lint/export passed. Database reset and physical-device cleanup remain unverified; production history baseline prerequisite documented. Result: tasks/audit-fixes-result-2026-10-17.md.

## Memory latency/loading — 17/10/2026

1. Measure cached-photo requests and sharing completion dependencies. Baseline: intact photos still verify R2 every sync; timeline entry/listener add overlapping refreshes; visibility confirmation awaits entire-library refresh.
2. Cache per-original verified R2 proof locally (filename/size), never in Firestore; verify legacy once and clear on replacement. Reuse only exact same file/disk size; keep account guards and missing-file recovery. Exclude local proof only from optimistic editor/conflict snapshot comparisons. Plan reviewer consulted before implementation.
3. Coalesce same-account loads, retain a trailing refresh for server listener changes; avoid unused friend feed on mine. Do not bypass UID queue or permission checks. Existing in-flight first legacy migration may still delay a cache mutation; remove the unnecessary full-library wait after confirmed sharing.
4. Show busy spinner on selected sharing option, inline sync indicator and image decode loading. Finish share UI only after server confirmation and queued local persistence; invalidate old state requests before patching confirmed result, refresh in background.
5. Regression request counts/loading/deferred publish+sync/rollback/account switches, typecheck/lint, full suite and final review; platform smoke where available. No backend deployment needed.

Memory latency/loading completed. Confirmed request count5→0 for previously verified cached originals; overlap4→1active+1trailing. All568 Jest tests, typecheck/lint and iOS/Android export passed; reviewer findings resolved and Simulator timeline smoke passed. Limits and release status: tasks/memory-loading-performance-2026-10-17.md.

## Text-only memory editing / photo delete — 17/10/2026

Implement existing-memory form with text only and keep immutable photo/date/initial visibility in submitted draft. Keep create controls. Move delete overlay to image top-right with44pt touch area and photoless fallback. Plan reviewed before implementation; include storage support for legacy photoless text, validating empty input before revocation. Targeted regressions, full suite, typecheck/lint and native smoke; final review findings resolved. Result: tasks/memory-text-only-edit-2026-10-17.md.

## Sửa luật Phỏm trong phòng — 23/10/2026

Bổ sung như Tiến lên, với10 mức điểm riêng, luật áp dụng từ match mới;
plan/acceptance/review tại [inroom-phom-rules-2026-10-23.md](inroom-phom-rules-2026-10-23.md).


## Phỏm: bật/tắt Tái, Gửi, Ù đền — 23/10/2026

- Yêu cầu: ba công tắc trước tạo phòng. Tái đã chốt là dịch lượt khi ăn ở vòng hạ. Dùng cùng form khi sửa luật ván tới.
- Hợp đồng additive: `phomConfig.options={tai,send,uDen}`; thiếu options giữ nguyên phòng cũ (false,true,true). Mỗi match giữ config riêng, pending chỉ promote khi chia match mới.
- Tái: ăn ở vòng hạ bỏ một lượt đánh đã hoàn tất của người cấp lá; nếu đã hạ được quay lại bốc/ăn, hạ thêm từ bài rác, gửi nếu bật, đánh. Giữ phỏm cũ và thứ tự hạ ban đầu. Ăn trước vòng hạ không đổi biến thể bốn lượt đang có.
- Gửi tắt: server từ chối gửi và UI bỏ action. Ù đền tắt: không gán người đền 3 cây/ăn chốt; từng người trả mức ù/ù tròn thường, khoản ăn/chốt giữ nguyên.
- Protocol7: options đang dùng yêu cầu7; options pending cho client cũ kết thúc ván cũ nhưng không ready/manage; fallback không bỏ lựa chọn. SQL validator/status/takeover kiểm tra capability dưới lock.
- Kiểm chứng: RED/GREEN engine/UI/protocol; PostgreSQL chức năng quyền/CAS/validator; functions toàn bộ, Jest, typecheck/lint/export; review plan và diff độc lập. Giữ mọi thay đổi có sẵn.

Hoàn tất Phỏm tùy chọn luật: review độc lập,1.062 Jest/261 backend, typecheck/lint,
export iOS/Android, Simulator và PostgreSQL rollback fixture đạt; backend v14
đã bật. Chi tiết tại [phom-optional-rules-2026-10-23.md](phom-optional-rules-2026-10-23.md).

## Chặn client cũ ghi đè luật Phỏm — 23/10/2026

Hoàn tất capability guard dưới room lock cho current/pending/incoming options,
RPC compatibility wrapper và Edge truyền version thật. Review độc lập,263 backend
tests và PostgreSQL rollback probe đạt; migration/Edgev15 đã deploy. Chi tiết:
[phom-rules-capability-fix-2026-10-23.md](phom-rules-capability-fix-2026-10-23.md).

## Sửa đền Phỏm theo nguồn lượt tái — 25/10/2026

Thay quy tắc tùy chọn ù đền cũ theo yêu cầu mới: cấp 3 cây cho người ù luôn
đền; `uDen` chỉ bật/tắt trách nhiệm ăn chốt tạo đúng lượt tái có người ù, và chỉ
hiện khi Tái bật. Kế hoạch/acceptance/giới hạn rollout trong
[phom-den-replay-2026-10-25.md](phom-den-replay-2026-10-25.md). Giữ toàn bộ
công việc trước đó, mức điểm và hình dạng config hiện có.
