# Sửa 7 findings — 23/10/2026

Main owns implementation; reviewers chỉ đọc. Giữ dirty/untracked có sẵn, không
commit/deploy hoặc dùng dữ liệu thật. Mỗi slice có regression và review cuối.

1. Lịch sử: giữ known purged room IDs bị chặn; chỉ dọn lịch sử cũ có updatedAt
   trước cutoff. Thêm localFinishedAt chỉ cho sở thích archive cục bộ để phân biệt
   archive mới với lịch sử trước cutoff, giữ field qua shared cache merge và xóa
   cùng localFinished khi resume. Không sửa updatedAt có thẩm quyền của server.
2. Home note: khóa cả title/body khi saving; pending save test, giữ draft khi lỗi.
3. Reminders: capture UID/sessionEpoch trước enqueue, kiểm tra sau mọi await có
   thể tạo/persist reminder, hủy notification vừa tạo nếu phiên đổi. Cancel không
   cần active session. Guard store trước reconcile sau schedule. Test queued,
   permission pending, schedule pending, logout/same-UID login.
4. Entry: dùng useOnlineGameAccess cho controls + live getter chung cho guard
   sau await. Thu hồi quyền hủy pending entry, không gửi reopen/navigation muộn.
5. Memory quota: migration CLI mới. RPC invite transaction kiểm tra rate20/day,
   outgoing20 và recipient inbox20; generic sent=true cho duplicate/full/unknown
   giữ tránh email enumeration, rate-limit vẫn429. Khóa advisory participant UID
   và email theo thứ tự ổn định. accept khóa cả2UID trước count100+insert. claim
   email-invites dùng cùng recipient UID/email locks để không đua inbox với invite.
   Không xóa friendships/pending đã tồn tại, không đổi quyền truy cập.
6. Scores lớn: giữ score-write/save cũ cho compatibility, thêm operation patch
   bounded, gửi settings và delta round thay vì full history. Client diff dựa trên
   base cùng sharedVersion, normalize score của player bị xóa ở server. SQL merge
   dưới room/table locks rồi đi qua owner/CAS/receipt/audit/tombstone hiện có. Không
   tăng body limit hay loại bỏ validate; patch upsert<=100, round removal IDs
   bounded, UI single-round/settings/finish hoạt động cả>2000rounds. Không truncate
   lịch sử tự ghi hoặc metadata đã lưu. Test>2000rounds và>262KB, stale/replay,
   non-owner, player removal và preserved results.
7. Kiểm chứng: targeted Jest/functions/PGlite từng slice, typecheck/lint, toàn
   suites và bundle. Tìm PostgreSQL nhiều connection cục bộ để kiểm concurrency;
   không gọi production. Nếu không có, ghi rõ giới hạn của PGlite/mocks. Reviewer
   plan trước thay đổi data/SQL, diff sau tất cả fixes. Cập nhật SPEC/docs/rollout.

## Tiến độ

- Đã review plan backend và client trước thay đổi liên quan dữ liệu/quyền.
- Đã triển khai đủ7 findings. Review cuối độc lập backend/client không thấy thêm
  finding; bổ sung session epoch cho cả load/save/complete/remove trong agenda
  theo finding reviewer trước đó.
- Đã thêm regression pending logout/sameUID login, thu hồi allowlist trong lúc
  status/reopen chờ, bảng điểm3.001ván vượt body limit, CAS/replay/tombstone,
  quota ngày/pending/inbox và giới hạn100 bạn.
- Gates cuối đạt: TypeScript, lint,130 Jest suites/1.022 tests,211 backend tests,
  export iOS+Android và diff whitespace. Chi tiết ở
  [báo cáo sửa lỗi](full-app-review-fixes-results-2026-10-23.md).

## Rollout

Chưa deploy, chạy migration remote hoặc thay đổi dữ liệu production. Hai migration
mới được tạo bằng Supabase CLI. Thứ tự khi triển khai: (1) kiểm tra migration history
của môi trường đích, áp dụng riêng hai migration mới cùng các prerequisite đã có;
(2) deploy `memory-access` và `game-access`; (3) phát hành client dùng patch. Không
push toàn bộ migration cục bộ khi chưa đối chiếu history remote. SQL giữ legacy
`save`; Edge mới chạy được client cũ. Nếu rollback client về bản cũ, bảng điểm lớn
vẫn có giới hạn sửa cũ. Rollback Edge memory sẽ khôi phục race quota; giữ bản mới
hoặc tạm ngưng lời mời nếu phải xử lý sự cố. Các migration không xóa dữ liệu có sẵn.
