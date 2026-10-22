# Review source LifeMate — 23/10/2026

## Phạm vi và phương pháp

Review working tree hiện tại, gồm cả modified/untracked có sẵn; không chỉ diff
commit. HEAD tham chiếu: f59c4ee778ccc4783a0fd56c7aa7df613ca16a12. Không sửa source,
commit, deploy, xóa dữ liệu hay gọi API production để thử lỗi. Báo cáo này là file
mới của lượt review. Dùng Agent Skills code-review-and-quality, security-and-hardening
và các quy tắc Supabase liên quan. Hai reviewer độc lập chỉ đọc phụ trách backend
và UI/game; main đối chiếu finding và rà state, persistence, Finance, Memories,
MP3, Profile, cấu hình và vòng đời tài khoản.

Các kết luận gắn với code trong workspace; không xác nhận bản đã phát hành có
cùng migration/Edge/JS. Kiểm tra các đường chính của mọi nhóm chức năng; đây không
phải chứng nhận từng dòng code, mọi kích thước màn hình hay mọi lịch chạy đồng thời.

## Kết quả

**7 finding P2 cần xử lý: 3 mới, 4 tồn đọng được xác nhận lại.** Không xác nhận
thêm P1 trong các đường đã rà. Không tự sửa finding trong lượt review này.

### 1. P2 — Bảng điểm online cũ bị loại khi kết thúc hoặc lưu lịch sử hôm nay [mới]

- Vị trí: [cardScoreStorage.ts:25](/Volumes/pmnb/Asher/a-home/LifeMate/src/services/cardScore/cardScoreStorage.ts:25),
  các caller đọc/ghi ở71–111, cache shared ở207–214.
- Điều kiện: bảng online tạo trước22/10 lúc05:25 UTC, còn active và không thuộc
  các room đã chủ động purge. Người dùng kết thúc hoặc archive bảng sau mốc đó.
- Nhánh online chỉ kiểm tra createdAt rồi loại mọi finished/localFinished, bỏ qua
  updatedAt mới. Active giữ được nhưng finish hôm nay lập tức bị lọc. writeMatches
  ghi danh sách đã lọc xuống cache; cache shared cũng loại kết quả hợp lệ từ server.
  Bảng shared mất khỏi UI/cache dù server còn; bảng online cục bộ có nguy cơ mất
  lịch sử và chỉnh sửa chỉ tồn tại trên thiết bị.
- Probe main trích đúng predicate/constants từ TS hiện tại và chạy trong Node VM:
  active online=false; finish online hôm nay=true; local archive hôm nay=true;
  finish manual hôm nay=false. Probe không đọc/ghi dữ liệu người dùng. Tests hiện
  chỉ bao phủ finish sau cutoff cho manual, chưa bao phủ online.
- Hướng sửa: đánh dấu tập lịch sử đã purge một lần hoặc ràng buộc lịch sử trước
  cutoff nhất quán; giữ updatedAt sau cutoff và bàn active hợp lệ khi kết thúc.

### 2. P2 — Ghi chú ngày mất phần người dùng nhập thêm trong lúc lưu [mới]

- Vị trí: [HomeDayDetailsCard.tsx:134](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/Home/HomeDayDetailsCard.tsx:134),
  input ở351 và381.
- Bấm lưu lấy title/body hiện tại rồi await onSave. Hai TextInput vẫn editable
  trong lúc saving, nên người dùng tiếp tục sửa được khi mạng chậm. Khi request
  hoàn tất, popup đóng, trong khi phần nhập thêm chưa bao giờ được gửi lưu.
- Đã trace caller onSave → noteStore → saveNote; không cần lỗi server để xảy ra.
- Hướng sửa: khóa cả hai input trong lúc lưu hoặc phát hiện draft thay đổi để
  giữ popup/draft. Thêm test giữ promise save, nhập thêm rồi resolve.

### 3. P2 — Gửi lời mời đồng thời vượt cả rate limit và số pending [mới]

- Vị trí: [memory-access/handler.mjs:401](/Volumes/pmnb/Asher/a-home/LifeMate/supabase/functions/memory-access/handler.mjs:401),
  các nhánh đếm/insert pending ở418–447 và461–490.
- Lấy recent attempts rồi INSERT attempt là hai query riêng; kiểm tra pending
  và insert invite cũng tách rời. Nhiều request cùng sender đều vượt kiểm tra
  dựa trên count cũ; một verified caller có thể vượt20/ngày và20 pending.
- Probe reviewer dùng handler hiện tại + database mock có barrier theo đúng
  ranh giới query:25 request đồng thời trả25 HTTP200,25 attempt và25 invite.
  Chưa chạy nhiều kết nối PostgreSQL thật. Danh sách outgoing chỉ lấy21 nên một
  số lời mời thực tế không có trong danh sách quản lý.
- Hướng sửa: RPC service-only khóa quota sender/recipient theo thứ tự ổn định,
  kiểm tra và chiếm slot trong một transaction. Test nhiều request cùng lúc.

### 4. P2 — Reminder việc được tạo lại sau đăng xuất [tồn đọng]

- Vị trí: [agendaStore.ts:102](/Volumes/pmnb/Asher/a-home/LifeMate/src/store/agendaStore.ts:102) và
  [agendaReminders.ts:138](/Volumes/pmnb/Asher/a-home/LifeMate/src/services/agenda/agendaReminders.ts:138).
- Save đang chờ permission/schedule; logout xếp cancelAll vào queue. Save hoàn
  tất vẫn xếp reconcile sau cancel, không kiểm tra phiên sau await. Reminder
  service chỉ chặn tài khoản đang xóa, không chặn logout/đổi tài khoản. Reconcile
  có thể tạo lại notification của phiên cũ sau cancellation.
- Source hiện tại còn cùng đường lỗi. Probe cục bộ ngày22/10 đã tái hiện hai lần
  schedule và ID còn lại sau cancel; lượt này xác nhận lại source, không chạy lại
  probe cũ. Chi tiết ở full-app-review-2026-10-22-evening.md.
- Hướng sửa: guard UID/session epoch khi enqueue và sau từng await, theo pattern
  loanReminders, cùng regression logout trong lúc permission pending.

### 5. P2 — Vẫn hiện nút vào/mở lại phòng khi route Chơi online bị gỡ [tồn đọng]

- Vị trí: [CardScoreScreen.tsx:1064](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardScore/CardScoreScreen.tsx:1064),
  lịch sử ở1257; handler enterOnlineRoom ở313–367.
- Tài khoản đã có bảng online bị loại khỏi gameUsers. MainTabs gỡ route CardGames
  nhưng bảng điểm vẫn cho Vào lại/Tạo lại phòng. Handler thiếu guard live access,
  có thể reopen server rồi navigate đến route không còn đăng ký.
- Đây là UI/navigation inconsistency; không coi Firebase Remote Config là cơ
  chế authorization backend. Tests hiện mới kiểm tra mode tab/route visibility.
- Hướng sửa: cùng điều kiện useOnlineGameAccess cho controls và guard sau await
  trước reopen/navigation, bao gồm config đổi trong lúc request chờ.

### 6. P2 — Bảng điểm tự tích lũy vượt giới hạn API sửa bảng [tồn đọng]

- Vị trí: [game-access/handler.mjs:217](/Volumes/pmnb/Asher/a-home/LifeMate/supabase/functions/game-access/handler.mjs:217),
  [scores.mjs:57](/Volumes/pmnb/Asher/a-home/LifeMate/supabase/functions/game-access/scores.mjs:57),
  [shared_card_scores.sql:108](/Volumes/pmnb/Asher/a-home/LifeMate/supabase/migrations/20261021130001_shared_card_scores.sql:108).
- SQL tự append ván không có giới hạn tương ứng. Client gửi cả document khi
  sửa/đổi tên/kết thúc, nhưng gateway chặn262144 bytes và validator chặn2000 ván.
  Phòng dùng lâu sẽ vẫn tích điểm trong khi không lưu được sửa đổi quản trị.
- Reviewer xác nhận source chưa đổi; probe handler cũ với1000 ván/226699 bytes
  đi qua,1300 ván/294499 bytes bị400 trước RPC. Ngưỡng tùy dữ liệu, không phải
  mọi bảng đều hỏng ở1300 ván. Không kiểm tra trên bảng production.
- Hướng sửa: operation theo settings/round có CAS/version, không gửi lại toàn bộ
  lịch sử; thống nhất giới hạn, phân trang và chính sách tích lũy.

### 7. P2 — Nhận bạn đồng thời vượt quota và làm người đã nhận biến mất [tồn đọng]

- Vị trí: [memory_sharing.sql:103](/Volumes/pmnb/Asher/a-home/LifeMate/supabase/migrations/202610130001_memory_sharing.sql:103),
  [memory-access/handler.mjs:179](/Volumes/pmnb/Asher/a-home/LifeMate/supabase/functions/memory-access/handler.mjs:179).
- RPC count→insert không khóa UID/profile chung. Ở99 bạn, ba lời mời từ ba cặp
  khác nhau có thể cùng pass để thành102. Unique của từng cặp không ngăn được.
  Relationships chỉ đọc101, không phân trang, khiến bạn đã được nhận mất khỏi
  danh sách/feed. Không có migration sau thay function này.
- Finding dựa trên transaction hiện tại; chưa chạy đa kết nối PostgreSQL.
- Hướng sửa: khóa cả hai UID theo thứ tự ổn định trước count/insert, test ở99/100;
  xử lý cả quota gửi ở finding3, không chỉ khóa từng invite/cặp.

## Phạm vi các đường đã rà

| Nhóm | Nội dung |
| --- | --- |
| Shell/auth/config | Bootstrap, auth/session epoch, registration/logout, Remote Config, directory/gameUsers, profile refresh, admin/account cleanup |
| State/persistence | UID scoping, AES-GCM key lifecycle, queued writes, deletion gates, cache/sync/conflict paths và stale callbacks |
| Finance/loan/held | Privacy layer, suspended dialogs, CAS/atomic linked transactions, idempotent advance/repayment, caches, reminder/session guards; không phát hiện thêm lỗi đủ bằng chứng trong các đường này |
| Home/Agenda/Notes/Checklists | Editor/save/remove, reminders, calendar integration, local/cloud data, account guard, privacy lock, bullet scroll và common UI |
| Memories | Private photo paths, signing/transfer/session guards, sync, friends/feed, invite/accept quotas, revocation và cleanup |
| MP3/audio | Index merge/rename/delete, backup metadata and file ordering, upload quota, queue/playlist, cancel/session fences; native module interface và lifecycle source |
| Card games/scores | Turn/hand UI, responsive styles, kick/rejoin/CAS/receipt/epoch, room lifetime, shared/local score persistence, history filtering/paging và owner guards |
| Backend/security | Effective SQL permissions/RLS, Firebase ownership/access gates, Edge input/output/auth, workers, profile/avatar, durable account deletion, audio reservations |

Các bản sửa gần đây về ownerUid:null, receipt recovery, kick response fencing,
xoay iOS DEFAULT, bounded dialogs, active-turn marker và lọc system audit vẫn
hiện diện. Không dùng các vấn đề layout chưa chứng minh bằng runtime làm finding
xác nhận trong báo cáo này.

## Kiểm chứng

- npm run typecheck: đạt.
- npm run lint: đạt.
- Jest toàn app: **129 suites /1005 tests đạt**.
- npm run test:functions: **204/204 tests đạt**, gồm SQL PGlite.
- Expo offline export iOS+Android: đạt; output
  `/private/tmp/lifemate-full-review-export-20261023`.
- Node predicate probe cho finding1: tái hiện lọc sai, không tác động dữ liệu.
- Reviewer handler concurrency mock cho finding3: tái hiện25/25 accepted; không
  thay thế kiểm chứng đa kết nối PostgreSQL.
- Log ở `/private/tmp/lifemate-full-review-*-20261023.log` (export có tên cùng
  output+.log). Suite xanh không chứng minh những trường hợp chưa có regression.

## Giới hạn và thứ tự ưu tiên

1. Sửa nguy cơ mất lịch sử và draft (1,2), rồi reminder/session (4).
2. Sửa quota lời mời/accept (3,7) cùng bài test concurrency phù hợp.
3. Đồng bộ entry access (5) và thiết kế operation cho bảng điểm lớn (6).

Không chạy lại emulator Firebase rules: môi trường hiện chỉ có Java17/11, thiếu
prerequisite Java21 đã được xác định ở lượt trước. Không có instrumented run
native Android/iOS, không thử mọi modal với keyboard/font scale, không xác nhận
active game/layout trên thiết bị thật trong lượt này. Không truy vấn cấu hình,
quyền hay schema production; rollout/version drift ngoài phạm vi source review.
