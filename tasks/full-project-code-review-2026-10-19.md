# Review lại toàn project: logic và UI — 19/10/2026

Cập nhật sau review: năm finding đã được sửa trong mã nguồn; xem
`project-review-fixes-2026-10-19.md` cho kiểm chứng và giới hạn triển khai. Phần
finding bên dưới giữ nguyên bối cảnh tại thời điểm review.

## Phạm vi và cách kiểm chứng

Review mã hiện tại của working tree, bao gồm thay đổi chưa commit. Không sửa
production code, không deploy, không ghi dữ liệu cloud thật. Các bản sửa ở
`full-app-review-fixes-2026-10-19.md` đã được kiểm tra lại; không lặp nguyên finding
đã xử lý. Phần dưới là lỗi bổ sung hoặc nhánh còn thiếu.

Main rà low-level audio operations/index/cloud/transfers/queue/native engine,
persistence và các nhánh Finance/Agenda/Notes; hai reviewer độc lập rà backend/
auth/rules/migrations/memory và UI/navigation/forms/callers toàn app. Đối chiếu
SPEC và tests liên quan. Harness thực thi TypeScript transpiled hoặc handler thật
với dữ liệu tổng hợp, adapter/hooks trong bộ nhớ; không thay file source để tạo
kết quả kiểm chứng.

## Findings

### 1. P2 — Migration ảnh cũ có thể ghi đè object vừa chia sẻ lại

- Vị trí: `supabase/functions/memory-access/handler.mjs:716–718`, thao tác copy tại
  `supabase/functions/memory-access/r2.mjs:111–116`.
- Nhánh migrate đọc row Supabase active, cấp URL nguồn và copy vào R2 fixed path
  trước khi PATCH có điều kiện vào SQL. Nó không tham gia lease của unshare/reserve.
- Reviewer tái hiện bằng handler thật: tạm dừng copy → unshare thành công →
  republish/upload/confirm thành công → cho copy cũ tiếp tục. Migration trả
  `migrated:false`, row vẫn thuộc reservation mới nhưng object R2 đã bị thay bằng
  bytes ảnh legacy. Nếu bytes/kích thước khác, metadata của lần upload vừa xác
  nhận không còn khớp; ảnh hiển thị có thể là bản cũ. Không khẳng định mọi lần
  republish đều tạo ảnh có nội dung nhìn thấy khác nhau.
- Kiểm tra DB sau PUT không hoàn tác được overwrite đã xảy ra. Fence toàn bộ copy
  bằng lease cùng unshare/publish hoặc dùng object key theo generation; thêm test
  interleaving trên. Không coi reservation token hiện tại là hàng rào cho object
  write chưa dùng token đó.

### 2. P2 — Sửa lần nhận tiền chi chung vẫn ghi đè bản đã thay đổi

- Vị trí: `src/screens/Finance/SharedExpenseModal.tsx:114–123,153` và
  `src/screens/Finance/useFinanceScreen.ts:209–211,228–239,255`.
- Refresh giữ rows đang có và rows vẫn mở được khi loading. Mở form sửa receipt
  trước khi refresh kết thúc, draft giữ amount/date/note cũ; modal chỉ reset khi
  visible đổi. Sau refresh, submit chỉ gửi id và draft cũ. Hook lấy giao dịch mới
  nhất làm expected rồi thay receipt bằng draft, nên service không thấy stale edit.
- Main thực thi hook và financeStorage thật trong VM với React/Firestore/cache
  giả lập: receipt lúc mở form=10, bản server/cache sau refresh=20, lưu form cũ sửa
  note đưa server về10 mà không báo lỗi. UI reviewer kiểm tra đường mở form và xác
  nhận không có reset/snapshot guard.
- Bản sửa trước đã bảo vệ form giao dịch chính, nhưng chưa mang snapshot receipt
  lúc mở qua nhánh này. Truyền bản receipt/transaction gốc, kiểm tra trước thay đổi
  và giữ draft khi có xung đột; rà tương tự callback xác nhận xóa receipt.

### 3. P2 — Cập nhật Hồ sơ có thể khiến sổ Cho vay kẹt loading

- Vị trí: `src/hooks/useLoanLedger.ts:48–53,104–109`; caller thay user object tại
  `src/screens/Profile/useProfileEditor.ts:303`.
- Bắt đầu đọc/refresh loan, chuyển sang Hồ sơ và lưu tên trước khi read xong.
  Hồ sơ thay SessionUser object dù UID không đổi. captureSession so object identity
  khiến read bị loại bỏ, đồng thời finally không clear loading. UID không đổi nên
  effect không tự load lại. Modal Cho vay cũng chặn refresh khi loading tại294.
- Reviewer chạy hook thật với deferred read và user object mới cùng UID: sau khi
  read resolve, `loading:true`, loans rỗng. Người dùng có thể phục hồi bằng refresh
  từ màn Finance ngoài modal, nhưng chính sổ Cho vay tiếp tục chờ và khóa thêm mới.
- Dùng session generation tách khỏi metadata Hồ sơ và luôn giải phóng loading của
  request mình sở hữu. Giữ bảo vệ logout→login/account switch thực sự.

### 4. P2 — Thông báo chia sẻ ký ức mới thất bại bị load tự xóa

- Vị trí: `src/screens/Memories/MemoryScreen.tsx:738–743`, effect601–607,
  `load()` tại371.
- Chụp mới → chọn Bạn bè → lưu riêng thành công nhưng publish lỗi. save đặt cảnh
  báo “Đã lưu riêng trên máy…” rồi chuyển capture→timeline. Effect timeline gọi
  load, load xóa error ngay; editor đóng mà lỗi chia sẻ không còn được thông báo.
- Reviewer thực thi component thật bằng hook/service stubs trong bộ nhớ:
  shareMemory reject, cuối luồng timeline mở nhưng không còn feedback lỗi.
- Giữ phản hồi publish riêng với lỗi load hoặc không clear nó khi auto-refresh.
  Thêm regression cho create/capture→Friends publish failure; test đổi quyền đang
  có không bao phủ đường này.

### 5. P2 — Avatar vẫn thiếu deadline cho bước đọc response body

- Vị trí: `src/services/profile/avatarService.ts:64–74`,
  `src/store/profileStore.ts:50`.
- Timer20 giây chỉ abort transport; sau khi fetch trả về, `response.text()` có thể
  không settle nếu bước đọc body native bị kẹt. Fetch polyfill đã cài tháo abort
  listener khi XHR hoàn tất, trước FileReader đọc text, nên abort không bảo đảm
  giải phóng promise. Đây là nhánh riêng với private-photo đã được sửa trước đó.
- Reviewer thực thi avatarService thật trong VM với text decoder không settle:
  kích hoạt deadline làm signal aborted nhưng readAvatar vẫn pending. profileStore
  dùng lại pending promise nên các lần refresh không thoát. Avatar edit bao read
  trong accountTask cũng có thể giữ bước drain khi dọn tài khoản.
- Race cả fetch/body với deadline reject rõ ràng, xử lý đổi session và dọn listener/
  timer; thêm stalled-text regression. Chưa có trace FileReader bị treo trên thiết
  bị thật trong đợt review, nên không khẳng định đây là lỗi luôn xảy ra trên máy.

## Kiểm tra đã chạy trên mã hiện tại

- Typecheck: qua.
- ESLint toàn repository: qua.
- Jest:99 suites /628 tests qua.
- Backend functions:94 tests qua với Node runtime phù hợp.
- `git diff --check`: qua.
- Lượt export iOS/Android gần nhất ở bước sửa trước đã qua; đợt review này không
  đổi source nên không export lặp lại.
- Không chạy lại Firestore emulator: công cụ chưa có sẵn, lượt trước npx tải bị
  ENOTFOUND. PostgreSQL/psql/Docker không có sẵn; migration/SQL regression vẫn chưa
  được thực thi trên database thật. Không coi adapter DB giả lập là SQL validation.

## Giới hạn

Không thử thủ công toàn UI trên thiết bị thật/kích thước/font scale khác nhau,
không chạy native archive/instrumentation lần này, không đo nhiệt/CPU, không gọi
production. Review bao quát các nhóm chức năng nhưng không phải chứng minh mọi
trạng thái/chạy đồng thời đều đúng. Không đưa các nghi ngờ chưa tái hiện hoặc sở
thích giao diện thành finding. Chưa sửa các finding mới trong lần review này.
