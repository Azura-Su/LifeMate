# Sửa luật Phỏm trong phòng

## Yêu cầu và plan

- Chủ phòng sửa riêng10 mức điểm tại menu phòng → Sửa luật ván tới, như Tiến lên.
- Tái dùng form Phỏm hiện có và dialog chung; thành viên xem luật hiện tại/ván tới.
- `nextPhomConfig` lưu riêng, chỉ promote khi chia match mới; không đổi game.config,
  phí ăn/chốt, deadline, bài hoặc điểm của ván hiện tại. Lưu ngoài ván xóa ready.
- Protocol6; thành viên client3/4/5 hiện có được chơi hết ván/lease/rời phòng,
  phải cập nhật trước thao tác quản lý/tham gia/sẵn sàng. Phòng South giữ floor5.
- RPC owner/controller/account/session/CAS/receipt; trigger pending/current config
  và promotion ở mọi match mới. Ready không rebase qua edit. SQL takeover kiểm
  tra capability dưới room lock, giữ signature cũ và chặn pending rooms an toàn.
- Regression engine/API/SQL/parser/session/UI, typecheck/lint/functions/Jest/export;
  review độc lập trước/sau. Nếu có quyền cloud: Edge trước migration và barrier
  phiên cũ; fixture PostgreSQL rollback. Không sửa dữ liệu tài khoản thật.

## Review plan

Reviewer chỉ đọc yêu cầu capability takeover phải kiểm tra trong transaction,
không chỉ preflight vì edit có thể chen vào. Áp dụng cho cả South và Phỏm.
Snapshot trước thay đổi `/private/tmp/lifemate-inroom-phom-before-20261023`.

## Checklist

- [x] Engine/pending promotion và invariants SQL/RPC.
- [x] Form và dialog dùng chung, protocol6/fallback/session fences.
- [x] Regression, typecheck/lint/export và review cuối.
- [x] Triển khai backend qua kết nốiSupabase người dùng bật lại.

## Kế hoạch triển khai sau review

1. Migration prerequisite20261023151401 chỉ thêm overload takeover5tham số;
   giữ nguyên4tham số đang chạy để v12 không bị gián đoạn.
2. Deploy Edge v13 (backend/handler/rooms) với dependency source đã đọc lại và
   so sánh cloud; Firebase auth/verify_jwt giữ nguyên. Chờ isolate cũ400s cộng
   biên10s, đối chiếu log phiên cũ và khởi động lại barrier nếu cần.
3. Migration20261023152105 bật pendingPhỏm và thắt overload4tham số. Guard
   fingerprint schema hiện tại và migration history trước DDL; không dbpush
   chuỗi migration cũ không đầy đủ. Localfilename phải khớp timestamp server
   thật nếu apply qua connector tạo version khác.
4. Fixture rollback Postgres với engine local+RPC thật, owner/controller/CAS,
   ván đang chơi bất biến và nextmatch/delta idempotent, không dữ liệu thật.

CLI đã kiểm tra nhưng không trả kết nối. Người dùng bật lại plugin Supabase;
đã xác nhận40 function/v12/13 migration trước triển khai. Prerequisite thực
20261023151401 đã apply, local đổi tên khớp lịch sử; Edge v13 ACTIVE lúc
15:14:07 UTC và18 file đọc lại khớp. Chờbarrier410s trước migration cuối.

## Kiểm chứng local và UI

- 251 backend tests đạt; rehearsal theo40 function PostgreSQL đã đọc lại từ
  production đạt4 ca South/Phỏm/takeover, thêm3 fixture2/3/4 người đạt46bước.
- 133 suites/1.053 Jest đạt trước khi thêm2 ca stale draft/account; chạy lại
  toàn bộ sau bổ sung. Typecheck/lint và export iOS/Android đạt.
- Simulator local source thật: mở đủ10 mức, cuộn đến Đền ở cuối, nhập123 bằng
  bàn phím số, lưu ngay khi bàn phím mở và thấy giá trị123. Không tạo phòng
  hoặc gameplay bằng tài khoản thật. Bàn phím ngang/đa thiết bị thật chưa xác minh.
- Reviewer backend/client chỉ đọc không còn finding; rollback/sourcebackup
  tại `/private/tmp/lifemate-inroom-phom-deploy-20261023`.

## Đã triển khai

- Edge v13 ACTIVE,18 file khớp bundle. Prerequisite thực20261023151401 giữ
  takeover 4 tham số hoạt động và bổ sung 5 tham số (đã thử PostgreSQL thật).
- Sau414 giây từ deploy completion15:14:07 UTC mới apply migration cuối lúc
 15:21:05 UTC: phiên bản thực 20261023152105; local đã đổi tên, không đổi SQLbody.
  Log trong khoảngchờ ghi nhậnv13, không cóv12 mới.
- Fixture RPC PostgreSQL thật đạt3 bàn 2/3/4 người, 46 bước và 6 kết quả, có lần
  lưu trước ván và trong ván, config hiện tại giữ nguyên, ván mới tất cả mức 0,
  CAS/owner/receipt và takeover capability. Transaction rollback; không còn
  phòng/ghế/receipt/bảng điểm thử. Mode open và cron vẫn active; RPC chỉ service_role.
- Advisory giữ 2 nhóm INFO/WARN có sẵn. Request không token vẫn 401 invalid-session.
- FullJest sau thêm2ca gặp1lần waitFor timeout ở test xóa lịch sử CardScore cósẵn;
  diagnostic riêng đạt. Chạy lại toàn bộ tuần tự, không bỏ assertion/test hoặc
  tăng timeout. Chưa kết luận nguyên nhân từ việc chạy song song.
- Không phát hành OTA/bản cài và chưa thử bàn phím ngang/đồng bộ nhiều máy thật.

## Hoàn tất

- Lần chạy cuối: **133 suites / 1.055 Jest tests**, **251 backend tests** đạt;
  kiểm tra SQL theo tên migration thực cũng đạt. Không thay timeout/assertion
  hoặc bỏ test để đạt. Typecheck, lint và export iOS/Android đạt.
- Cả hai migration local khớp lịch sử thực (15 migration). Phần source/backend
  đã review, không còn finding. Không còn tài khoản/phòng/ghế/dữ liệu fixture.
- Trước migration cuối có thể quay về Edge cũ khi chưa có pending Phỏm. Sau
  khi bật pending, cần bản backend hiểu protocol6/pending; ưu tiên sửa tiếp
  trên v13, không quay về v12 hoặc xóa pending config đã lưu của người dùng.
- Đã trả Simulator về máy chủ chính8081 và dừng preview8082.
