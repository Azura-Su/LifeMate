# Review Phỏm và Tiến lên — 24/10/2026

## Kết luận

Phát hiện **3 lỗi P2 ở UI**. Chưa xác lập lỗi P0/P1 hoặc lỗi luật/điểm mới trong
phạm vi đã kiểm chứng. Đây là lượt review: **không sửa source, không thêm test vào
repository, không deploy**. Probe, database, client giả lập và preview nằm ngoài
repository trong `/private/tmp/lifemate-full-game-review-20261024`.

Không kết luận toàn bộ tính năng đã PASS production: chưa có phiên 4 tài khoản
thật qua Firebase/Supabase Realtime, chưa chạy tải PostgreSQL nhiều kết nối hoặc
Android/thiết bị vật lý. Kết quả từng lớp được phân biệt dưới đây.

## 1. Các lỗi cần sửa

### P2 — Ghế Phỏm dùng danh sách ván cũ sau khi thành viên đổi

Vị trí: [PhomGameTable.tsx:132](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/PhomGameTable.tsx:132).

Tái hiện thực tế trong probe HTTP + SQL, sau đó render bằng component native:

1. Bốn người chơi hết một ván Phỏm.
2. My rời phòng. Danh sách hiện tại còn 3 người, nhưng ghế My vẫn còn trên bàn
   kết quả, bị vô hiệu hóa.
3. “Người mới thay ghế” tham gia. Server có đúng 4 thành viên mới nhưng bàn của
   chủ phòng vẫn hiển thị Trang/Tuấn/My, không có ghế người mới.

Nguyên nhân: hàng ghế luôn lấy `game.players`, là danh sách bất biến của ván đã
kết thúc; không hòa giải với `room.members`. `PhomSeat` khóa popup nếu người đó
không còn là member. Chủ phòng không mở được popup/kích thành viên mới từ bàn
trước rematch. Kết quả và điểm của ván cũ vẫn đúng; không được sửa roster lịch sử
để chữa lỗi hiển thị.

Đề xuất: khi ván không còn chơi, dùng roster hiện tại cho ghế tương tự South;
giữ `game.players` cho kết quả. Test cần có leave/kick → join người mới → mở popup
người mới, trong khi kết quả cũ không đổi.

Bằng chứng: [ghế trước/sau thay người](/private/tmp/lifemate-full-game-review-20261024/findings-matrix.jpg),
[sau leave: 0/3 sẵn sàng nhưng vẫn thấy My](/private/tmp/lifemate-full-game-review-20261024/ipad-phom-after-leave.png).

### P2 — Ghế Tiến lên không xoay tương đối theo người đang xem

Vị trí: [CardGameTable.tsx:453](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/CardGameTable.tsx:453).

Server giữ thứ tự ghế `[Asher, Trang, Tuấn, My]`. Với Asher, ba đối thủ trái/trên/
phải là Trang/Tuấn/My. Với Trang, UI hiện Asher/Tuấn/My; thứ tự tương đối đúng phải
là Tuấn/My/Asher. Chính mình vẫn ở dưới nhưng vòng thứ tự lượt trên bàn bị thay
đổi, không nhất quán giữa các client. Đã đối chiếu hai snapshot độc lập của cùng
ván và ảnh native từ cả hai góc nhìn.

Nguyên nhân: chỉ `filter(uid !== self)` trên thứ tự ghế toàn cục. Các fallback
vị trí bay/chia bài cũng dùng cách lọc tương tự. Test vị trí hiện có chỉ lấy người
đầu danh sách làm người xem nên không bắt được lỗi.

Đề xuất: xoay danh sách theo vị trí self trước khi gán trái/trên/phải; tái sử dụng
thứ tự đó cho vị trí animation. Test mọi self UID với 2/3/4 người, dọc/ngang.

Bằng chứng: [góc nhìn Asher và Trang](/private/tmp/lifemate-full-game-review-20261024/findings-matrix.jpg).

### P2 — Phỏm không hiển thị số lá còn lại của đối thủ

Vị trí: [PhomTableParts.tsx:85](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/PhomTableParts.tsx:85).

Snapshot có `player.count` nhưng toàn bộ render ghế chỉ hiện tiền, lượt/hạ/móm/
bỏ cuộc và bài công khai; không dùng count. Quan sát cả 2/3/4 người, dọc/ngang.
Người chơi không biết số lá đang giữ của đối thủ sau ăn/bốc/hạ/gửi. Đây là thông
tin đã có ở server và được yêu cầu trong checklist, không cần lộ tay đối phương.

Đề xuất: hiện “Còn N lá” độc lập với trạng thái lượt/hạ, kể cả người đang đánh;
test count thay đổi sau bốc/ăn/hạ/gửi và tránh cắt chữ trên ghế 4 người.

Bằng chứng: [Phỏm dọc](/private/tmp/lifemate-full-game-review-20261024/small-portrait-matrix.jpg),
[Phỏm ngang](/private/tmp/lifemate-full-game-review-20261024/small-landscape-matrix.jpg).

## 2. Kiểm thử multiplayer đã thực sự chạy

Probe tạo HTTP server chỉ listen `127.0.0.1:8787`, chạy **handler và engine source
thật**, SQL migration thật trong PGlite0.5.10. Mỗi client có UID, sessionId và
actionId riêng; Firebase verifier được thay bằng danh tính fixture cục bộ. Không
dùng tài khoản, phòng hoặc điểm của người dùng làm dữ liệu thử.

| Trò | Người | Bước chơi tới hết ván | Chia bài | Chơi ván kế | Kết quả |
| --- | --- | ---: | --- | --- | --- |
| Tiến lên | 2 | 32 | 13/người | Có | Đạt trong probe |
| Tiến lên | 3 | 55 | 13/người | Có | Đạt trong probe |
| Tiến lên | 4 | 70 | 13/người | Có | Đạt trong probe |
| Phỏm | 2 | 17 | 10 người mở, 9 người còn lại | Có | Đạt trong probe |
| Phỏm | 3 | 26 | 10/9/9 | Có | Đạt trong probe |
| Phỏm | 4 | 35 | 10/9/9/9 | Có | Đạt trong probe |

Tổng **6 ván hoàn chỉnh, 235 bước chơi**, chưa tính join/ready/start/retry. Sau
mỗi bước các client sync qua HTTP riêng và đối chiếu version, matchId, roster,
public players và lượt. Kiểm tra 52 lá duy nhất ở trạng thái có thẩm quyền, không
lộ tay đối thủ/nọc, tổng delta bằng0, một result cho match. Bot Tiến lên chủ yếu
đánh lẻ/bỏ; bot Phỏm bốc/ăn khi hợp lệ/hạ/đánh. Các bộ bài đặc biệt có fixture
riêng trong suite, không nói rằng bot đã tự chơi mọi tổ hợp.

Các ca bổ sung đã đạt trong probe ở **cả hai trò**:

- Tạo phòng → chủ ngồi đúng → join đồng thời các thành viên → sẵn sàng/start.
- Chủ + 4 client tranh 3 ghế: đúng 3 thành công, 1 nhận `room-full`.
- Phòng đủ4 không trùng UID; từ chối người thứ5, giữ nguyên4 ghế.
- 6 lần resync và 10 vòng lease/sync ở phòng4: không mất người vì capacity.
- Request đánh sai lượt/bài ngoài miền hợp lệ bị từ chối.
- Gửi lại cùng actionId cho một nước đánh ở mỗi trong6 ván: không tăng version
  hay thực hiện nước đánh lần thứ2.
- Tạo phiên mới: chỉ đọc, chưa có quyền điều khiển; takeover xong thì phiên cũ
  không còn controller.
- Kích giữa ván: người thường và tự kích bị từ chối; chủ kích thành công; người
  bị kích nhận `removal.reason=kicked`; client còn lại thấy roster giảm.
- Chủ rời sau đó; engine áp dụng forfeit/kết thúc theo số người còn hoạt động.
- Worker đã claim một lease cũ, client gia hạn trước commit: worker cũ bị từ
  chối, không xóa nhầm người vừa kết nối lại, cả4 ghế còn nguyên.
- Leave ở kết quả → người mới join → rematch: server đúng, UI có lỗi mục1.

PGlite xử lý query trong một database nhúng: Promise/HTTP thực sự đồng thời ở
lớp request nhưng **không thay cho stress test khóa PostgreSQL nhiều connection**.
Lease được làm hết hạn trong fixture; không mô tả đây là thử mất sóng90 giây thật.

Chi tiết chạy được lưu ở [multiclient-final.log](/private/tmp/lifemate-full-game-review-20261024/multiclient-final.log),
[kết quả JSON](/private/tmp/lifemate-full-game-review-20261024/multiclient-results.json),
[probe](/private/tmp/lifemate-full-game-review-20261024/multiclient.mjs).

## 3. Lỗi “đủ4 thì tự thoát”

**Chưa tái hiện trên source hiện tại.** Không suy ra mọi lỗi mạng production đã
được loại trừ. Regression SQL/HTTP hiện có cũng đã chạy lại ca4 người ngồi gửi
join mới, mất ACK rồi retry, tranh ghế4/5 và stale worker/lease.

Nguyên nhân code từng được tái hiện trong lịch sử project là người đã có ghế
gửi join bằng action mới bị kiểm tra như người thứ5. Nhánh recovery hiện tại xử
lý UID đã ngồi trước capacity, giữ receipt/session fence; không tự tạo ghế mới.
Current join/worker không có nhánh đuổi người chỉ vì `members.length===4`.
Một incident production cụ thể vẫn cần phiên bản client và log thời điểm đó;
lượt này không có log incident hay 4 tài khoản thử thật để đối chiếu.

Không tự chuyển quyền chủ khi chủ rời/mất mạng là **luật đã ghi ở SPEC-card-games**,
không được coi là lỗi. `host` và chủ sở hữu là hai khái niệm khác nhau; chủ có
thể chủ động chuyển quyền trước khi rời.

## 4. Đối chiếu luật và tính điểm

Nguồn chuẩn là SPEC trong repository, không lấy biến thể bên ngoài thay luật.
Đã đọc cả engine/scoring và reviewer server độc lập không xác lập thêm lỗi.

| Nhóm luật | Bằng chứng đã chạy |
| --- | --- |
| South52 lá,13/người, người mở, lá nhỏ nhất, thứ tự ghế | Probe6 ván + game-rules |
| Lẻ/đôi/sám/tứ quý/sảnh/đôi thông; bộ sai; chặt2; ngoài lượt4 đôi thông | Fixture game-rules/south-config |
| Bỏ lượt, reset vòng, người giữ vòng đã hết bài | Fixture game-rules + ván HTTP |
| Tới trắng, cóng/thối, forfeit/cancel, timeout | Fixture game-rules/rooms/SQL |
| Hai chế độ kết thúc, phí chặt, người đã về vẫn trả chặt, tổng0 | Fixture south-config |
| Phỏm9/10, nọc, ăn phải có phỏm riêng, giữ lá ăn | Fixture phom-engine/melds + ván HTTP |
| Hạ cuối, gửi, móm, ù/ù tròn/ù gửi, đền3 cây/đền chốt | Fixture phom-engine/scoring/options |
| Tái/Gửi/Ù đền bật/tắt, lượt mở lại, bounds protocol |96 ván2–4 người trong phom-options |
| Luật ván tới không đổi luật/điểm ván đang chơi | Fixture SQL/rules + guard client6/7 |

Suite còn chạy30 ván South timeout ngẫu nhiên và các ván timeout/configured2–4
người; kiểm tra bảo toàn bài, kết thúc được và zero-sum. Tất cả nằm trong263
backend tests đã chạy, không phải số test tạo mới trong lượt review.

Các quyết định bài hợp lệ/lượt/thắng/điểm được engine server tính từ state có
thẩm quyền. Client gửi ý định, không quyết định kết quả. SQL giữ account/session/
membership/CAS/receipt, state/config pinning và quyền service-only; không cần tin
client tự khai điểm hay lá đối phương.

## 5. Realtime, reconnect và cleanup

Đã review `gameSession`, `gameApi`, protocol, `subscribeGame` và worker; chạy
test hiện có về reconnect giữ snapshot, stale/out-of-order response, lời gọi bị
hủy, retry actionId, removal fence, subscribe-before-read, polling fallback,
stop/blur/account switch và dọn timer/listener. Các test này dùng dependency
Realtime được mô phỏng; probe HTTP chủ động sync sau bước chơi.

Private broadcast chỉ báo changed; client đọc lại snapshot có thẩm quyền, không
lấy event đến muộn làm state mới. Cleanup unsubscribe/removeChannel/disconnect
được review, nhưng **chưa đo memory/battery leak trên thiết bị thật**. Không có
test transport Supabase WebSocket với4 Firebase identities thật trong lượt này.

## 6. UI native và screenshot

Đã cold-start **entrypoint LifeMate đầy đủ** qua Metro riêng8085, vào Home →
Trò chơi & điểm số → Chơi online → mở form Phỏm. App khởi động và hiện đúng ba
công tắc/các mức mặc định. Không bấm tạo/join/sửa điểm trên tài khoản đang đăng
nhập. Cũng đã mở form Tiến lên (hai chế độ, mức mỗi lá/chặt2) và popup luật
Tiến lên; header/nút đóng nằm trong viewport.
[Ảnh form thật](/private/tmp/lifemate-full-game-review-20261024/app-phom-create-form.png),
[popup luật thật](/private/tmp/lifemate-full-game-review-20261024/app-south-rules.png).
Metro8081 có sẵn thuộc một dự án khác; lỗi bundle không tương thích khi mở nhầm
cổng đó không được ghi thành lỗi LifeMate. Cold-start đúng8085 hoạt động.

Chạy bản development trên iOS26.3 với **component/table/header/modal/style thật**.
Harness phát lại snapshot từ HTTP+SQL; dùng Avatar component thật với profile
lookup stub cục bộ, không truy cập ảnh/tài khoản thật. Phần điều hướng/xác thực
toàn app không phải phiên multiplayer E2E. Action UI trong harness không gửi
nước đánh lên production; nước đánh thật đã kiểm tra riêng qua các client HTTP.

Đã đối chiếu36 ảnh chia bài ở ma trận dưới, thêm ảnh lobby, lá giữa bàn, kết quả,
góc nhìn khác, leave/thay ghế và popup owner/member. Layout ngang đã xác nhận
viewport native, không chỉ đổi CSS/Dimensions trong Jest. Để ổn định ma trận,
harness có điều khiển orientation; không dùng kết quả này chứng nhận xoay tự
nhiên trong toàn bộ app trên điện thoại thật.

| Thiết bị | Dọc | Ngang | 2/3/4, cả hai trò |
| --- | --- | --- | --- |
| iPhone SE3 |375×667 |667×375 | Đã chụp/quan sát |
| iPhone17 Pro Max |440×956 |956×440 | Đã chụp/quan sát |
| iPad Pro13 |1032×1376 |1376×1032 | Đã chụp/quan sát |

- [Mobile nhỏ dọc](/private/tmp/lifemate-full-game-review-20261024/small-portrait-matrix.jpg)
- [Mobile nhỏ ngang](/private/tmp/lifemate-full-game-review-20261024/small-landscape-matrix.jpg)
- [Mobile lớn dọc](/private/tmp/lifemate-full-game-review-20261024/large-portrait-matrix.jpg)
- [Mobile lớn ngang](/private/tmp/lifemate-full-game-review-20261024/large-landscape-matrix.jpg)
- [Tablet dọc](/private/tmp/lifemate-full-game-review-20261024/ipad-portrait-matrix.jpg)
- [Tablet ngang](/private/tmp/lifemate-full-game-review-20261024/ipad-landscape-matrix.jpg)
- [Popup owner có kích](/private/tmp/lifemate-full-game-review-20261024/ipad-phom-popup.png)
- [Popup thành viên không có kích](/private/tmp/lifemate-full-game-review-20261024/large-member-popup-no-kick.png)
- [Popup luật ngang](/private/tmp/lifemate-full-game-review-20261024/ipad-rules-landscape.png)

Trong các cảnh đã xem, tay bài ở dưới ở cả hai hướng,13 lá South không bị đẩy
ra cột phải, tên dài có thể mở popup đọc đầy đủ, highlight/giây có tương phản,
Safe Area/notch không che nút chính. Còn3 lỗi mục1; không suy ra mọi tổ hợp bài,
animation và cỡ font accessibility đã đạt từ các ảnh này.

Popup người chơi đã mở bằng avatar/tên, thấy tên/vai trò/wins/balance; vai trò
thành viên không có nút kích, owner có. Xác nhận và live-context guard trong
screen được kiểm tra bằng Jest; backend quyền kích được probe độc lập.

**Cuộn popup luật:** đã mở native; scroll và drag của CUA không làm viewport đổi.
Do công cụ này đã có giới hạn gesture trong lượt kiểm tra trước (người dùng đã
xác nhận vuốt thật cuộn được), không gắn nhãn lỗi sản phẩm mới và không ghi PASS
gesture ngày24. Cần vuốt thật lại trên mobile sau phát hành. Bàn Phỏm ngang có
vùng bài/public cards cuộn dọc khi thiếu chiều cao; chưa xác nhận cử chỉ đó bằng
tự động hóa. Không kết luận phần bị clip trong viewport cuộn là nút che mất bài.
Scroll CUA trên form tạo Phỏm của app đầy đủ cũng không làm viewport đổi;
giới hạn không chỉ xảy ra ở popup.

Quan sát UX mức thấp: đối thủ duy nhất của Phỏm lệch trái, và tablet để nhiều
khoảng trống với lá bài kích thước cố định. Có thể cân giữa/điều chỉnh mật độ sau
khi sửa3 lỗi chức năng; không nâng các lựa chọn trình bày này thành P2.

## 7. Kết quả các lệnh

| Lệnh/check | Kết quả thực chạy |
| --- | --- |
| `npm run test:functions` |263/263 đạt |
| `npm test -- --watchman=false --json ...` |133 suites,1.063 tests đạt |
| Tập game trong Jest |19 suites,186 tests nằm trong lần chạy trên |
| `npm run typecheck` | Đạt |
| ESLint CardGames/cardGames/hooks/game-access | Đạt |
|6 ván HTTP + capacity/lease probes | Đạt; JSON/log đính kèm |
| Hash source trước/sau | Không đổi các file source được review |
| Independent server/client review |3 P2 UI; không có server finding mới |

Logs ở [thư mục kiểm chứng](/private/tmp/lifemate-full-game-review-20261024):
`jest-result.json`, `jest.log`, `functions.log`, `typecheck.log`, `lint.log`,
`multiclient-final.log`, `baseline-hashes.json`, toàn bộ PNG và contact sheets.
Không thêm regression vào repository vì đây là review-only. Các test cần bổ
sung cho3 lỗi đã mô tả tại từng finding.

## 8. Production read-only và giới hạn còn lại

- `game-access` **v15 ACTIVE**,18 file đọc lại khớp source; không deploy mới.
- Migration mới nhất `20261023163323`, modeopen, deadline cron1 job active.
- Các RPC game security-definer không có anon/authenticated execute, ngoại trừ
  `lifemate_game_can_subscribe(p_topic)` dành cho authenticated có chủ ý.
- Advisors giữ19 INFO RLS service-only/no-policy và1 WARN subscribe function;
  không phải advisory mới trong lượt này. Tham chiếu: [Supabase function privileges](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Chưa có logs incident,4 tài khoản thử thật, môi trường PostgreSQL đa kết nối,
  Android hoặc máy vật lý; chưa chạy network shaping, process kill khi action
  đang gửi, hoặc memory/battery profiling. Không lấy mock thay bằng PASS thực tế.
- Chưa build/OTA/phát hành client trong lượt review. Source đang có nhiều thay
  đổi từ các nhiệm vụ trước; giữ nguyên, không commit/push.
- Đã dừng Metro preview8084/HTTP probe8787, xóa Simulator SE được tạo riêng cho
  review và trả iPad về shutdown như ban đầu. Metro8081 có sẵn thuộc `sportVN`,
  được giữ nguyên; không dùng bundle của dự án đó làm bằng chứng lỗi LifeMate.
- Sau smoke app đầy đủ, trả LifeMate về Home và dừng Metro8085 của lượt review.

Ưu tiên tiếp theo: sửa3 P2 UI với regression cho roster sau ván, mọi góc nhìn ghế
và count Phỏm; sau đó chạy phiên4 tài khoản thật để xác nhận gateway Realtime,
mất/kết nối mạng, đóng/mở app và các cử chỉ cuộn trên thiết bị.
