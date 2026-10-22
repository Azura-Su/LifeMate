# Quản lý thành viên phòng và bố cục bốn người

## Yêu cầu và quyết định

- Nới khung đối thủ để avatar/tên/trạng thái không ép chữ xuống từng ký tự; cân
  đối portrait/landscape và màn hình nhỏ. Popup mở từ avatar hoặc tên ở lobby/bàn.
- Popup chỉ hiển thị thông tin sẵn có trong snapshot: tên, avatar, số ván thắng,
  số dư bàn, trạng thái và chủ phòng. Không thêm email/thông tin tài khoản riêng.
- Chỉ ownerUid hiện tại (fallback host cho snapshot cũ) được kích thành viên khác;
  cần controller, snapshot mới và xác nhận. Server kiểm tra độc lập.
- Kích giữa ván áp dụng cùng luật bỏ cuộc đã có, giữ game.players/scoreMembers để
  bảo toàn kết quả/điểm; chỉ xóa member/seat mục tiêu. Không tự cấm vào lại lâu dài.
- Thông báo đúng câu “Bạn đã bị chủ phòng mời ra khỏi phòng.” qua successful
  snapshot room=null kèm event id ổn định, gắn UID/session/phòng; không consume khi
  read. Client chặn response cũ, dọn pending/cache/route và dedup popup theo event.
- Giữ tối đa4 ở JS và SQL khóa room row/CAS. Retry/rejoin UID đang có ghế được
  khôi phục qua read/takeover, không qua kiểm tra thêm ghế thứ5.

## Các bước

1. Baseline và regression tái hiện join lại fresh action khi4, race join thứ4/5,
   controller/lease và response cũ. Không kết luận capacity tự xóa thành viên.
2. Backend: idempotent seated rejoin, kick intent/validation/owner CAS, seat cleanup,
   rotate topic và notice bền theo cơ chế receipt hiện tại. Migration mới qua CLI.
3. Client: protocol/session fences, thông báo kick và cache cleanup, kiểm tra join;
   popup có guard xác nhận theo tài khoản/phòng/match/controller/focus/owner.
4. Bố cục: khung đối thủ rộng hơn, sắp avatar/tên/readiness không wrap xấu, kiểm
   tra320/390/430 portrait và landscape; giữ tuned table/card animation.
5. Regression tests JS/session/UI/protocol và SQL PGlite theo luồng thật; typecheck,
   lint, bundle iOS/Android. Reviewer chỉ đọc plan trước implementation và diff cuối.

## Review plan độc lập

Reviewer yêu cầu notice không consume ở read, pending request phải bị fence khi
kick; popup dùng UID live và đóng khi context đổi; giữ participant cho scoring;
publish invalidate old epoch + changed new epoch. Đã đưa vào thiết kế trên.

## Trạng thái

Đã hoàn tất triển khai mã nguồn và review độc lập trước/sau thay đổi. Không deploy
migration/Edge hoặc dùng dữ liệu thật.

### Kết quả và nguyên nhân

- Tái hiện lỗi người đã có ghế gửi join với action mới khi đủ4 bị kiểm tra như người
  thứ5. Sửa nhánh recovery riêng, có receipt để retry phản hồi thất lạc sau kick
  không tự thêm ghế. Chưa có bằng chứng counter tự xóa thành viên trong production.
- Thêm kick có owner/controller/CAS guards, forfeit giữa ván, realtime epoch và
  notice bền theo phiên. Giữ ownerUid=null sau xóa tài khoản, không fallback host.
- Popup công khai, có xác nhận và kiểm tra context live; khung đối thủ rộng và tên
  đọc được. Reviewer phát hiện popup ngang tràn và history rejoin kẹt sau notice;
  đã sửa, thêm regression, reviewer kiểm tra lại không còn finding ở hai mục này.

### Kiểm chứng

- Jest toàn app: 127 suites / 995 tests đạt; screen regression cuối: 43 tests đạt.
- Backend: chạy toàn bộ test:functions và SQL PGlite, gồm race thứ4/5, bốn người
  recovery, kick lobby/playing, replay, khác controller, response muộn, SQL chặn
  overflow/non-owner/ownerless. Tổng 204/204 tests đạt.
- Typecheck, ESLint các file TypeScript thay đổi, git diff --check đạt.
- Expo offline export iOS + Android đạt. Export all ban đầu không chạy vì project
  thiếu react-native-web; không thêm dependency ngoài phạm vi mobile.
- Chưa chạy đa thiết bị/điện thoại thật; kiểm tra UI bằng RNTL và bundle, chưa có
  xác nhận hình ảnh runtime trên màn hình ngang. Cloud chưa áp migration mới hay
  deploy Edge/client. Rollout theo docs/card-games-online.md.

