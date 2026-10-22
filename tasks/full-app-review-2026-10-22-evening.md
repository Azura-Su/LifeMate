# Review toàn app — lượt tiếp theo 22/10/2026

## Kế hoạch và phạm vi

Review snapshot working tree hiện tại (có dirty/untracked sẵn), không sửa source,
commit, deploy hoặc ghi dữ liệu thật. Đối chiếu các SPEC và review trước; không
nhắc lại finding đã sửa trừ khi tái hiện được trên snapshot hiện tại.

- Main: state/services/persistence; Finance/Loan/HeldMoney; Home/Agenda/Notes/
  Checklists; audio/MP3 và native contracts; Remote Config; chạy kiểm chứng.
- Reviewer độc lập chỉ đọc: Firebase rules, Edge handlers, RPC/migrations,
  auth/account deletion và các ranh giới bảo mật; đánh giá plan trước khi rà.
- Reviewer độc lập chỉ đọc: UI/navigation/components, các luồng màn hình, scroll,
  keyboard, accessibility, focus/background; đánh giá plan trước khi rà.

Mỗi finding cần trigger cụ thể, tác động, file/dòng và bằng chứng. Test có sẵn
chạy cục bộ; không dùng API production để thử lỗi. Chạy typecheck, lint, Jest,
functions; kiểm tra prerequisites rules/native để quyết định kiểm chứng khả dụng.
Không coi unit test là bằng chứng mọi layout hoặc concurrency production đúng.

## Kết quả

Có bốn finding P2 cần sửa. Không có P1 được xác nhận trong các đường đã rà;
không coi đây là chứng minh toàn app không còn lỗi. Source không được sửa trong
lượt review; chỉ ghi báo cáo này.

### 1. P2 — Nhắc việc có thể được lập lại sau khi đăng xuất

Vị trí: `src/store/agendaStore.ts:102` và
`src/services/agenda/agendaReminders.ts:138–177`.

Luồng tái hiện: lưu một việc có nhắc trong tương lai; bước lấy/xin quyền thông báo
đang chờ; đăng xuất/đổi tài khoản khiến bootstrap xếp `cancelAllAgendaReminders`
vào hàng đợi. Khi bước schedule hoàn tất, `save()` tiếp tục xếp reconcile sau lần
cancel dù account đã đổi. `saved !== item` đúng với bản dữ liệu được storage parse
lại; reconcile chỉ chặn tài khoản đang bị xóa, không kiểm tra phiên đăng nhập.
Kết quả: lần cancel xóa nhắc đầu nhưng reconcile tạo nhắc mới cho tài khoản cũ.
Người đã đăng xuất vẫn nhận nhắc; nếu chuyển tài khoản thì thông báo thuộc phiên
trước vẫn xuất hiện trên máy.

Probe cục bộ `/private/tmp/lifemate-agenda-review-probe.test.ts` dùng agendaStore,
agendaStorage và reminder service thật, Firestore fake và Expo notifications mock.
Giữ promise getPermissions, logout, xếp cancellation, resolve promise và chờ queue:
schedule được gọi hai lần, map sau cancellation vẫn có `task: n2|...`.
Không dùng cloud hoặc dữ liệu thật.

Hướng sửa: kiểm tra UID + session epoch sau await và trước reconcile; reminder
service cần guard phiên ở lúc vào hàng đợi và sau từng await như loanReminders.
Test save → permission pending → logout/account switch → cancel → resolve không
được còn notification hay map ID của tài khoản cũ.

### 2. P2 — Nút vào/mở lại phòng còn hiện khi route Chơi online đã bị gỡ

Vị trí: `src/screens/CardScore/CardScoreScreen.tsx:1064` (header bàn hiện tại),
`:1247` (lịch sử), và `enterOnlineRoom()` ở `:313–367`.

Tài khoản từng chơi online bị bỏ khỏi `usergame`: MainTabs gỡ route CardGames và
CardHubChrome ẩn mode tab, nhưng bảng điểm đang có vẫn hiện “Vào lại phòng”; lịch
sử có thể hiện “Tạo lại phòng”. CardScoreRoomActions không dùng điều kiện usergame;
status hook tiếp tục tải quyền mở lại. Handler vào phòng cũng không kiểm tra điều
kiện này. Bấm nút có thể gửi request reopen thành công rồi navigate đến route không
tồn tại; người dùng bị giữ ở màn bảng điểm dù thao tác phòng đã chạy.

Bằng chứng: reviewer độc lập và main trace các caller/điều kiện hiển thị, handler
và route đăng ký có điều kiện. Đây là lỗi UI/navigation, không kết luận backend
phải dùng Remote Config để phân quyền. Test mode visibility hiện có chưa bao phủ
bảng điểm online đã tồn tại.

Hướng sửa: dùng cùng điều kiện cho entry/reopen controls và guard live config trong
enterOnlineRoom trước request/navigation, kể cả cấu hình đổi giữa các await.

### 3. P2 — Bảng điểm tích lũy tự động có thể vượt giới hạn ghi của chính API

Vị trí: `supabase/functions/game-access/handler.mjs:215`,
`supabase/functions/game-access/scores.mjs:57`, và
`supabase/migrations/20261021130001_shared_card_scores.sql:108–116`.

RPC sync tự nối các ván kết thúc vào cùng document không có giới hạn tương ứng;
save của chủ phòng gửi lại toàn bộ document. Gateway từ chối body trên 262144
bytes; validator từ chối quá 2000 ván. Phòng dùng lâu ngày sẽ đến trạng thái vẫn
đọc/chơi được nhưng lưu sửa điểm/đổi tên/kết thúc bảng không được. Bớt một ván mỗi
lần cũng không giúp nếu request vẫn quá lớn.

Reviewer đã chạy handler probe trong bộ nhớ, không mạng/DB: document bốn người với
UID kích thước thực tế, 1000 ván/226699 bytes được 200 và gọi RPC; 1300 ván/294499
bytes bị 400 trước RPC dù validator nhận document; 2001 ván bị validator từ chối.
Ngưỡng thực tế tùy kích thước tên/UID/điểm; không khẳng định mọi bảng đều lỗi ở ván
1300. SQL append và client full-document write được main đối chiếu lại.

Hướng sửa: cập nhật settings/round theo operation có version check mà không gửi
lại toàn bộ lịch sử; thiết kế phân trang/giới hạn lưu trữ thống nhất với tự ghi ván.
Không đơn thuần tăng vô hạn giới hạn body. Thêm regression với bảng lớn do server
tích lũy và thao tác finish/rename/correction.

### 4. P2 — Chấp nhận lời mời đồng thời có thể vượt quota bạn bè và mất mục khỏi UI

Vị trí: `supabase/migrations/202610130001_memory_sharing.sql:103–114` và
`supabase/functions/memory-access/handler.mjs:179–183`.

RPC đếm số bạn trước insert nhưng không khóa hai UID hay profile. Khi tài khoản có
99 bạn, ba transaction chấp nhận các lời mời khác nhau có thể cùng đọc 99, cùng
qua điều kiện và ghi thành 102. Các cặp khóa khác nhau nên unique constraint không
ngăn được. Handler gọi RPC riêng, không có transaction ngoài giữ khóa chung.
Trong khi đó relationships chỉ đọc 101 cặp và không phân trang, nên ít nhất một
người đã được nhận bạn biến mất khỏi danh sách/feed.

Đây là finding concurrency suy ra từ source/transaction, chưa chạy nhiều kết nối
PostgreSQL thật. Hướng sửa: khóa hai profile/UID theo thứ tự ổn định trước khi
count+insert, và test chấp nhận đồng thời ở mốc 99/100. Không thể dùng PGlite đơn
kết nối để chứng minh bài test concurrency production này đã đạt.

## Kiểm chứng trong lượt này

- `npm run typecheck`, `npm run lint`, `git diff --check`: đạt.
- `npm test -- --watchman=false --silent`: **127 suites / 984 tests đạt**.
- `npm run test:functions`: **197 tests đạt**.
- Probe reminder ngoài repo: **1 ca tái hiện được lỗi**; assert đặc tính lỗi hiện
  tại, không phải regression xanh của một bản sửa.
- Expo export offline Android + iOS: đạt; output
  `/private/tmp/lifemate-review-export-evening-20261022`, log cùng tên `.log`.
- Log Jest/functions ở `/private/tmp/lifemate-full-review-jest-20261022.log` và
  `/private/tmp/lifemate-full-review-functions-20261022.log`.

## Phạm vi đã rà và giới hạn

| Nhóm | Nội dung rà |
| --- | --- |
| Shell/auth/config | Session gates, UID switching, remote directory/usergame parser/cache, conditional routes, headers/drawer, background/focus |
| Home/Agenda/Notes/Checklists | CRUD, ngày/giờ và nội dung preview, nhắc việc, offline/conflict, account binding, responder/scroll cấu trúc |
| Finance/Loan/HeldMoney | Tổng hợp/parse và liên kết khoản, transaction/idempotency, sửa/xóa, cache, UID guards, lock và xác nhận UI |
| Memories | Local/cloud/private/share contracts, friends, upload/revoke/delete, camera focus, viewer/editor và state UI |
| MP3/native | Queue/playlists, chuẩn bị file, import/export/cancel, sync/delete metadata, thời lượng/đường dẫn; đọc hợp đồng Swift/Kotlin |
| Cards | UI ready/result/orientation/back, room actions/config gates, session/reconnect, score growth, owner controls/RPC/worker |
| Backend | Firebase rules ownership, game RPC ACL/snapshot, memory sharing, audio quota, profile, durable account deletion |

Hai reviewer độc lập chỉ đọc đã đánh giá plan và rà phạm vi được giao. Các bản sửa
quota audio, error mapping game và empty-room status từ các review trước vẫn hiện
diện; không tái sử dụng finding đã sửa làm finding mới.

Chưa chạy trên máy iOS/Android thật, VoiceOver/TalkBack, nhiều điện thoại, network
loss/battery/load, PostgreSQL concurrency thật hoặc xác minh deployment production.
JDK đang có là 17/11; repo yêu cầu Java21+ cho rules emulator nên không chạy rules
suite trong lượt này. Đã đọc native source nhưng không chạy lại native smoke/build.
Không audit advisory dependency qua mạng. Bundle/Jest không thay các kiểm tra này.
