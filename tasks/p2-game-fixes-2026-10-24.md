# Sửa 3 lỗi P2 game UI — 24/10/2026

## Ranh giới

Room Members là nguồn ghế/quản lý hiện tại khi hết ván. Game Participants giữ
nguyên cho lượt đang chơi, bài công khai và kết quả lịch sử. Xoay ghế chỉ là
projection UI, không sửa thứ tự/server state/API. Không commit/push/deploy.
Giữ nguyên báo cáo review và các thay đổi có sẵn.

## Kế hoạch

- [x] Đọc báo cáo/yêu cầu, callers, protocol và engine projection; chụp baseline.
- [x] Reviewer độc lập duyệt phương án trước implementation.
- [x] RED regression cho roster sau ván, popup/kick người mới, active participants/history, góc nhìn2/3/4 người và số lá.
- [x] Phỏm: ghế room chờ tách khỏi participant; kết quả/public history không đổi.
- [x] South: helper xoay ghế immutable dùng cho render và animation fallback.
- [x] Phỏm: số lá độc lập trạng thái; waiting không giả lập số bài.
- [x] GREEN regression; 6 ván HTTP và chuỗi thay người/kick/rejoin/rematch, UI 4 góc nhìn.
- [x] Simulator: 36 ảnh dọc/ngang, 2/3/4 người trên iPhone nhỏ/lớn/iPad; popup/count/leave.
- [x] Review diff độc lập trước và sau implementation; kiểm tra lại phần bố cục count ngang.
- [x] Typecheck/lint/diff check PASS; full Jest cuối: 134 suite, 1.100 test PASS; chốt báo cáo bằng chứng và giới hạn.

Diff dự kiến:4 component/utility hiện có và regression liên quan. Không cần
migration, dependency hay thay đổi dữ liệu được lưu. Baseline/probe/log/ảnh mới:
`/private/tmp/lifemate-p2-fixes-20261024`.

## Kết quả theo lỗi

| Issue | Root Cause | Files Changed | Fix | Tests | Status |
|---|---|---|---|---|---|
| P2 #1: Phỏm giữ ghế cũ sau ván | Ghế luôn render từ `game.players`, dù snapshot ván trước đã kết thúc và membership đã đổi | `PhomGameTable.tsx`, `PhomTableParts.tsx` | Khi đang chơi dùng participant; khi chờ sau ván dùng member thật. Popup nhận UID hiện tại. Kết quả và public history vẫn đọc snapshot ván cũ | RED baseline; replacement 2/3/4 người; tên/avatar/ready/balance/UID; popup và xác nhận kick đúng UID; active forfeited participant còn nguyên; HTTP 4 người finish → leave → replace → kick → rejoin → rematch; ảnh popup thực tế | FIXED & VERIFIED trong môi trường local |
| P2 #2: Tiến lên sai góc nhìn ghế | Chỉ lọc self, chưa dịch vòng theo vị trí self; fallback animation cũng dùng thứ tự cũ | `CardGameTable.tsx`, `cardTableMotion.ts` | Tạo bản sao thứ tự đối thủ sau self rồi vòng về đầu. Dùng cùng projection cho ghế và fallback đánh/chia/bỏ lượt. Sau ván lấy thứ tự membership hiện tại | RED baseline; mọi self ở bàn 2/3/4 người, dọc/ngang; các slot trái/trên/phải; frozen snapshot không đổi; pass/deal fallback; rejoin sau ván; 4 góc nhìn native; 5 lượt thật từ HTTP trên cả 4 client | FIXED & VERIFIED trong môi trường local |
| P2 #3: Phỏm thiếu số lá đối thủ | Contract đã có `count` nhưng component chỉ render lượt/hạ/bỏ cuộc | `PhomTableParts.tsx` | Hiện `Còn N lá` độc lập với trạng thái. Chấp nhận số nguyên 0–10 theo contract; bỏ giá trị không hợp lệ; ghế waiting không giả số lá. Count/status nằm cùng hàng và wrap khi ngang | RED baseline; 9 → 10 → 9 → 3 → 2 → 0, đúng UID trên mọi viewer ở bàn 2/3/4; turn/laid; invalid count; HTTP projection; native ảnh có count cùng timer/đã đánh | FIXED & VERIFIED trong môi trường local |

`game.players`, lượt, bài, kết quả, API, server engines và schema không bị sửa bởi đợt này.
So sánh hash với baseline trước sửa xác nhận chỉ 4 file implementation và 1 file
test đã có thay đổi; các file nguồn/service/backend/migration còn lại giữ nguyên.
File test mới được liệt kê riêng bên dưới. Các thay đổi có sẵn từ đợt trước được giữ nguyên.

## File thuộc đợt sửa này

- [CardGameTable.tsx](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/CardGameTable.tsx)
- [cardTableMotion.ts](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/cardTableMotion.ts)
- [PhomGameTable.tsx](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/PhomGameTable.tsx)
- [PhomTableParts.tsx](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/PhomTableParts.tsx)
- [cardTableSeats.test.tsx](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/__tests__/cardTableSeats.test.tsx): 36 regression tests mới.
- [CardGamesScreen.test.tsx](/Volumes/pmnb/Asher/a-home/LifeMate/src/screens/CardGames/__tests__/CardGamesScreen.test.tsx): thêm 1 case popup/kick thành viên thay thế sau ván.
- [SPEC-card-games.md](/Volumes/pmnb/Asher/a-home/LifeMate/SPEC-card-games.md), [SPEC-rules-phom.md](/Volumes/pmnb/Asher/a-home/LifeMate/SPEC-rules-phom.md): ghi rõ nguồn dữ liệu và projection UI.
- Báo cáo/kế hoạch hiện tại. Không sửa báo cáo review cũ.

[Diff riêng so với baseline trước task](/private/tmp/lifemate-p2-fixes-20261024/fix-final.diff)
và [kiểm tra phạm vi source](/private/tmp/lifemate-p2-fixes-20261024/source-scope-check.json).

## Bằng chứng kiểm thử

Regression được chạy trên bản sao nguồn baseline trước sửa: 13 case thất bại,
12 case đã đúng, 70 case không thuộc lựa chọn RED. Các lỗi xác nhận gồm sai ghế
tương đối, thiếu thành viên mới/popup và thiếu count. Có thêm RED riêng cho
room order sau rejoin ở Tiến lên. Bản sao baseline không ghi đè working tree.

- [RED baseline đã đối chiếu](/private/tmp/lifemate-p2-fixes-20261024/baseline-red-confirmed.log).
- [RED screen popup](/private/tmp/lifemate-p2-fixes-20261024/red-screen.log), [RED rejoin Tiến lên](/private/tmp/lifemate-p2-fixes-20261024/red-south-rejoin.log).
- [GREEN 36 regression tests](/private/tmp/lifemate-p2-fixes-20261024/seats-final.log).
- [100 tests component/screen sau điều chỉnh count ngang](/private/tmp/lifemate-p2-fixes-20261024/compact-count-tests.log).
- [15 integration tests với snapshot HTTP thật](/private/tmp/lifemate-p2-fixes-20261024/runtime-ui-final.log): mount đồng thời 2/3/4 component với UID/snapshot độc lập; kiểm tra popup, count, roster và active turn.
- [Supabase functions: 263/263 PASS](/private/tmp/lifemate-p2-fixes-20261024/functions.log).
- [Export iOS + Android: PASS](/private/tmp/lifemate-p2-fixes-20261024/export.log).
- [Typecheck: PASS](/private/tmp/lifemate-p2-fixes-20261024/typecheck-final.log).
- [ESLint 6 file TypeScript thay đổi: PASS](/private/tmp/lifemate-p2-fixes-20261024/lint-final.log); `git diff --check`: PASS.
- Full app Jest cuối: **134/134 suite, 1.100/1.100 test PASS**, bao gồm 37 case thêm trong task. Lệnh `npm test -- --watchman=false --json --outputFile=…`; `--watchman=false` dùng file crawler của Jest vì sandbox chặn state Watchman, không đổi assertion/test/timeout.
  [Log cuối](/private/tmp/lifemate-p2-fixes-20261024/jest-quiet.log), [JSON kết quả](/private/tmp/lifemate-p2-fixes-20261024/jest-quiet-result.json).

Các lượt full suite trước trong lúc chạy nhiều Simulator/export có failure chờ
dialog bất đồng bộ ở CardScore/Checklists/HeldMoney, ngoài phần sửa này. Các lượt
chạy riêng và full suite cuối khi môi trường yên đều PASS; không sửa source hay
nới timeout/expectation để đạt kết quả. Log các lượt trước vẫn giữ trong thư mục
artifact (`jest.log`, `jest-verified.log`, `unrelated-rerun.log`, `held-alone.log`).

### Sáu ván multiplayer đã chạy hoàn chỉnh

Harness cũ được đọc, sao chép sang thư mục task mới, rồi mở rộng chuỗi replacement.
HTTP server chỉ nghe localhost, chạy handler/engine/RPC SQL thật trên PGlite với
migration hiện tại. Mỗi client có UID, session và action riêng; identity verifier
dùng fixture local. Không dùng tài khoản hay dữ liệu production.

| Trò | Số người | Action đến kết thúc ván | Kết thúc | Ván mới |
|---|---:|---:|---|---|
| Tiến lên | 2 | 32 | PASS | PASS |
| Tiến lên | 3 | 55 | PASS | PASS |
| Tiến lên | 4 | 70 | PASS | PASS |
| Phỏm | 2 | 17 | PASS | PASS |
| Phỏm | 3 | 26 | PASS | PASS |
| Phỏm | 4 | 35 | PASS | PASS |

Tổng 235 action đánh bài, không tính các bước tạo/join/resync/kick. Sau mỗi action
kiểm tra version/turn/public state giữa các client, 52 lá không trùng, không lộ
tay đối thủ/nọc, tổng điểm bằng 0 và chỉ ghi một kết quả cuối.

Đã chạy thêm cho cả hai trò:

- Bốn client tranh 3 ghế còn lại đồng thời: đúng 3 vào, 1 bị từ chối; không vượt 4.
- Phòng đủ 4: 10 vòng heartbeat và 6 lượt resync vẫn đủ người, không tự rời phòng.
- Retry action cùng ID không tăng version lần hai; sai lượt/input bị server từ chối.
- Reload/takeover session, controller cũ bị chặn; worker lease cũ không thể commit sau renew.
- Thành viên thường/self kick bị từ chối; owner kick giữa ván, nạn nhân nhận reason `kicked`; owner rời phòng được xử lý.
- Ván 4 người kết thúc → thành viên cũ rời → người mới vào → mọi client resync → owner kick đúng UID mới → victim sync/bootstrap vẫn bị loại → người khác vào → rematch. JSON snapshot kết quả cũ không đổi xuyên suốt.
- Lưu 150 frame độc lập; 5 lần chuyển lượt Tiến lên được mount lại từ cả 4 góc nhìn và so active highlight.

[Kết quả từng ván và từng luồng](/private/tmp/lifemate-p2-fixes-20261024/multiclient-results.json),
[log](/private/tmp/lifemate-p2-fixes-20261024/multiclient.log),
[HTTP harness](/private/tmp/lifemate-p2-fixes-20261024/multiclient.mjs),
[snapshot](/private/tmp/lifemate-p2-fixes-20261024/frames.json).

## UI native đã đối chiếu

Chạy các component thật bằng development build LifeMate trên iOS Simulator.
Harness dùng header/layout của màn game và dữ liệu lấy từ các client HTTP trên;
chỉ lookup hồ sơ/ảnh đại diện được thay bằng fixture, không truy cập tài khoản thật.
Tên dài có ellipsis theo thiết kế; mở popup xem tên đầy đủ. Các lá trên tay chồng
theo thiết kế. Không thấy overlap/overflow mới do 3 bản sửa trong các ảnh đã kiểm tra.

| Viewport | Dọc: Tiến lên/Phỏm, 2–3–4 người | Ngang: Tiến lên/Phỏm, 2–3–4 người |
|---|---|---|
| iPhone nhỏ 375 × 667 pt | [6 ảnh](/private/tmp/lifemate-p2-fixes-20261024/small-portrait-matrix.jpg) | [6 ảnh](/private/tmp/lifemate-p2-fixes-20261024/small-landscape-matrix.jpg) |
| iPhone lớn 440 × 956 pt | [6 ảnh](/private/tmp/lifemate-p2-fixes-20261024/large-portrait-matrix.jpg) | [6 ảnh](/private/tmp/lifemate-p2-fixes-20261024/large-landscape-matrix.jpg) |
| iPad 1032 × 1376 pt | [6 ảnh](/private/tmp/lifemate-p2-fixes-20261024/ipad-portrait-matrix.jpg) | [6 ảnh](/private/tmp/lifemate-p2-fixes-20261024/ipad-landscape-matrix.jpg) |

Ảnh bổ sung:

- [Bốn góc nhìn Tiến lên, cùng lượt đang đánh](/private/tmp/lifemate-p2-fixes-20261024/south-four-views.jpg).
- [Phỏm: số lá cùng timer đối thủ và bài giữa bàn](/private/tmp/lifemate-p2-fixes-20261024/phom-opponent-turn-view.jpg).
- [Phỏm: popup đúng người mới và nút kích](/private/tmp/lifemate-p2-fixes-20261024/ipad-new-member-popup-view.jpg).
- [Sau kích: roster còn 3, kết quả người cũ vẫn còn](/private/tmp/lifemate-p2-fixes-20261024/ipad-replacement-kicked-view.jpg).

Thao tác popup native dùng confirmation local để chuyển sang snapshot HTTP sau
kick. Chứng cứ gửi kick thật nằm ở test màn hình (đúng action/UID) và HTTP handler
(thực thi/đồng bộ/quyền). Không coi preview native này là một phiên mạng production.
Đã dừng Metro thử nghiệm, xóa duy nhất thiết bị SE tạo riêng cho task, trả iPad
về shutdown và iPhone gốc về Home dọc. Giữ nguyên Metro 8081 của dự án khác.

## Review và giới hạn

Reviewer độc lập read-only đã duyệt plan và diff cuối, không còn finding P1/P2
trong phạm vi sửa. Sau điều chỉnh count/status ngang cũng đã được kiểm tra lại.
Self-review xác nhận không thêm listener, timer hay state network mới; không
thay cleanup/session/caching, không đổi ID/turn order, không thêm dependency.

Các giới hạn còn lại:

- Chưa chạy 4 thiết bị vật lý với Firebase Auth và Supabase Realtime/WebSocket production. HTTP client độc lập + SQL và replay UI không thay thế kiểm thử đó.
- Concurrent request đã chạy qua HTTP; PGlite dùng một database local, chưa phải stress test nhiều PostgreSQL connection/transaction ngoài production.
- Android đã export bundle; chưa chạy runtime native Android trong đợt này.
- Không xác nhận thao tác cuộn bằng cử chỉ thật mới: công cụ native có giới hạn tạo touch move. Không đánh dấu scroll PASS từ một lần gọi gesture.
- Chưa kiểm tra phóng to cỡ chữ hệ thống ngoài font scale mặc định.

Không commit, push, merge hoặc deploy. Đánh giá 3 lỗi: **FIXED & VERIFIED trong
môi trường local**; phạm vi production và thiết bị vật lý được liệt kê ở trên.
