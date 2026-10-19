# Checklist: Chơi bài online

Kế hoạch: [card-games-plan-2026-10-19.md](card-games-plan-2026-10-19.md). Engine/API/SQL/client miền Nam đã triển khai và server đã mở sau smoke test iOS simulator. Realtime có Edge polling foreground làm dự phòng; các checkpoint Realtime/private channel và native nhiều thiết bị vẫn chưa đạt. Bằng chứng và hạn chế: [runbook](../docs/card-games-online.md).

## Trạng thái ngày 19/10

- Đã có luật south-v1, engine, lobby2–4 người, tay riêng, CAS/receipt, takeover, deadline worker, cleanup account và UI riêng. Miền Bắc/Phỏm chưa làm.
- Supabase thật: ba migration game +game-access / user-admin +Vault/cron 5 giây đã triển khai; mode open, client có kill switch và server có drain/closed. Rollback closed đã được thử với phòng active.
- Đạt 749 ca Jest, 133 ca functions/SQL, typecheck/lint và bundle iOS/Android. Có kiểm tra ván 4 tài khoản tổng hợp và timeout thật; không coi đây là kiểm chứngnative 2–4 thiết bị.
- Realtime Firebase đang bị chặn: hosted integration chưa bật, công cụ trình duyệt Work vẫn báo disabled. App tự dùng Edge polling 3 giây chỉ khi màn game foreground. IP rate limit, load/latency/battery và TestFlight/Android release còn chờ.
- Dữ liệu thử được dọn sau kiểm chứng; không dùng dữ liệu tài khoản thật.

## A — Chốt nền tảng

### A1. Chứng minh Firebase Auth và Realtime riêng tư

- [ ] Chạy thử hai thành viên và một người ngoài; token sai/hết hạn/đổi UID bị xử lý đúng, UID chuỗi không bị ép UUID.
- [x] Chọn luồng cấp/refresh claim cho tài khoản cũ và mới; bảo toàn claim khác, kiểm tra quyền bảng hiện có và thu hồi quyền khi đang kết nối.
- [x] Chốt contract notification chỉ mang version và snapshot riêng qua Edge; ghi quyết định hoặc lý do phải đổi backend.

Kiểm chứng: thử project riêng với dữ liệu tổng hợp và regression auth/account-access; review độc lập trước thay đổi auth thật. Phụ thuộc: không. Phạm vi: M, cấu hình thử + ADR/contract + test, không deploy production.

### A2. Chốt luật miền Nam bằng ví dụ

- [ ] Duyệt ranh giới module và bộ luật theo bảng trong kế hoạch, gồm mọi chặt/tới trắng/thối/bỏ cuộc và cách tính kết quả.
- [x] Viết SPEC miền Nam, schema action/snapshot, fixtures cho tình huống thông thường và ngoại lệ; phân biệt rõ default đề xuất với yêu cầu đã chốt.
- [x] Quy định lượt đầu khi thiếu 3 bích, lượt mới khi người giữ vòng đã hết bài và tranh ưu tiên tới trắng.

Kiểm chứng: người dùng xem ví dụ ván và kết quả; fixture assertions trước engine. Phụ thuộc: không. File dự kiến: `SPEC-card-games.md`, fixtures/test của `rules-tien-len-south`. Phạm vi: M.

### A3. Chứng minh xử lý deadline bền vững

- [x] Đo cron/worker đến hạn bằng clock máy chủ và database thử, hoạt động dù không có client.
- [ ] Cạnh tranh timeout với action chỉ commit một lần; worker chết/khởi động lại tiếp tục được và không phạt dồn sai.
- [ ] Chốt giới hạn batch, retry/lease, tải thử và vùng backend; ghi mục tiêu latency cùng cách đo.

Kiểm chứng: integration với Postgres/Edge thử, fake clock cho test engine; không dựa vào timer app. Phụ thuộc: A1. File dự kiến: handler/worker thử, SQL và test integration (3–5 file). Phạm vi: M.

### Checkpoint A

- [ ] Auth, contract, luật, deadline và cách kiểm chứng SQL đã rõ; reviewer xem các rủi ro auth/migration.
- [ ] Duyệt kết quả thử trước các task phụ thuộc; game tiếp tục ẩn trong app đang chạy.

## B — Phòng chờ sử dụng được

### B1. Điểm vào chơi online

- [ ] Mở được chọn trò/tạo/vào phòng từ Ghi điểm bài; giữ bảng điểm và lịch sử UID hiện có.
- [x] Chỉ miền Nam bật, hai trò khác có trạng thái chưa khả dụng; không thêm tab đáy.
- [ ] Loading/error/keyboard/safe area và điều hướng quay lại rõ ràng.

Kiểm chứng: screen/navigation test + thử iOS/Android. Phụ thuộc: A1–A2. File dự kiến: `src/screens/CardScore/`, entry screen `src/screens/CardGames/`, navigation types/tests (3–5 file mỗi lượt sửa). Phạm vi: M.

### B2. Tạo và vào phòng bằng mã

- [ ] Schema/RPC/API và UI cho tạo/vào phòng hoạt động giữa hai tài khoản; mã ngẫu nhiên duy nhất và có TTL.
- [ ] Giới hạn một ghế/UID, một phòng hoạt động/UID, tối đa bốn người; tranh ghế cuối và gửi lặp không tạo ghế trùng.
- [ ] Mã sai/đầy/hết hạn/đang chơi và rate limit có lỗi rõ; người ngoài không đọc snapshot.

Kiểm chứng: API/SQL concurrency và client service test; reset/push DB thử. Phụ thuộc: A1, B1. File dự kiến: migration phòng, `supabase/functions/game-access/`, client service và test; tách migration khỏi slice kết nối UI nếu vượt 5–8 file. Phạm vi: M cho từng commit.

### B3. Sẵn sàng, bắt đầu và rời phòng chờ

- [ ] Mọi thành viên thấy ghế/sẵn sàng cập nhật; chủ chỉ start khi đủ điều kiện; khóa danh sách và rulesVersion nguyên tử.
- [ ] Rời/đổi chủ/đóng phòng rỗng và tranh start-leave có kết quả nhất quán.
- [ ] Đổi thành viên/luật hủy sẵn sàng, người mới không vào ván đang chơi.

Kiểm chứng: 2–4 client lobby, concurrency SQL, test chuyển trạng thái. Phụ thuộc: B2. File dự kiến: room reducer/handler, lobby UI, tests (3–5). Phạm vi: M.

### Checkpoint B

- [ ] Hai thiết bị tạo/vào/sẵn sàng/rời được; auth và bảng điểm cũ không hồi quy.
- [ ] Snapshot, quyền bảng/RPC và thông báo version qua review trước chia bài.

## C — Miền Nam hoàn chỉnh

### C1. Chia bài và hiển thị tay riêng

- [x] Máy chủ xáo mật mã, chia 13 lá/người, persist ván và chọn người mở theo luật; restart không chia lại.
- [ ] Bàn dọc hiện tay mình và số lá người khác; không response/log/subscription nào chứa bài ngoài quyền.
- [x] Chọn/sắp bài và trạng thái chờ ack hoạt động, bàn không loading lại toàn màn.

Kiểm chứng: invariant bộ bài, API privacy, screen test, thử hai client. Phụ thuộc: B3, A2. File dự kiến: card-core, deal handler, table/hand UI và tests; chia thành task nhỏ hơn nếu vượt 5–8 file. Phạm vi: M mỗi commit.

### C2. Đánh bài và bỏ lượt

- [ ] Lẻ/đôi/sám/sảnh, chặn, bỏ lượt và mở vòng mới theo fixture; sai lượt/sai bộ/bài không sở hữu bị từ chối.
- [x] Một action chỉ commit một lần qua receipt; ID trùng payload khác, version cũ và ack mất được xử lý rõ.
- [x] UI giữ lựa chọn khi server từ chối và cho khôi phục snapshot, không optimistic xóa lá trước xác nhận.

Kiểm chứng: engine fixtures + action transaction race + UI tương tác. Phụ thuộc: C1. File dự kiến: south engine, action commit RPC/handler, hand controls/tests. Phạm vi: M mỗi commit.

### C3. Chặt và các luật ngoại lệ

- [ ] Toàn bộ tổ hợp chặt/ngoài lượt đã duyệt có fixture dương/âm; không suy đoán quy tắc.
- [ ] Tới trắng, cóng/thối, thứ tự ưu tiên và về bằng 2 được xử lý đúng bộ luật.
- [ ] Bỏ cuộc/timeout khi còn bộ chưa kết thúc và người vừa hết bài giữ vòng không gây deadlock.

Kiểm chứng: fixture + invariant chạy nhiều chuỗi action, đối chiếu ví dụ ván. Phụ thuộc: C2. File dự kiến: south engine, fixtures và test (2–4). Phạm vi: M.

### C4. Kết quả và ván tiếp

- [x] Chốt xếp hạng/kết quả một lần; không tính hai lần khi hai thiết bị cùng nhận kết thúc.
- [x] Ready/start ván tiếp tạo matchId mới, không nhận action trễ của ván cũ; giữ số ván thắng.
- [x] UI kết quả có lý do kết thúc, rời phòng và sẵn sàng; bảng điểm thủ công không bị ghi tự động.

Kiểm chứng: result/next-round concurrency, snapshot integration, screen test. Phụ thuộc: C3. File dự kiến: result handler/SQL, result UI và tests. Phạm vi: M.

### Checkpoint C

- [ ] 2–4 người chơi xong ván miền Nam và chơi tiếp, các ngoại lệ đã được kiểm chứng.
- [ ] Typecheck/lint/Jest/function/SQL gates và review auth/data qua trước khi thử trên mạng không ổn định.

## D — Phiên chơi ổn định

### D1. Mất mạng và kết nối lại

- [ ] Sync sau subscribe/resubscribe đã xác nhận không bỏ sót action; response cũ không đè version mới. Lease foreground phát hiện version/epoch lệch khi mất thông báo.
- [x] Mất ack retry cùng ID không đánh hai lần; mất nhiều event lấy snapshot hiện tại.
- [x] Chuyển thiết bị có phiên điều khiển duy nhất, không nhân ghế và vô hiệu action của phiên cũ.

Kiểm chứng: integration ngắt mạng/đảo response, client session tests, hai thiết bị cùng UID. Phụ thuộc: C4. File dự kiến: game-session service/hook/tests (3–5). Phạm vi: M.

### D2. Timeout và bỏ cuộc trên ván thật

- [x] Nối worker A3 vào engine miền Nam, tự bỏ/đánh khi hết hạn; lease/version chống áp dụng hai lần.
- [ ] Reconnect trong thời gian giữ ghế trở lại đúng tay; quá hạn/rời chủ động xử lý đúng fixture.
- [x] Không còn client thì timeout/hủy ván vẫn chạy; không loop vô hạn hoặc xử thua dựa riêng vào Presence.

Kiểm chứng: SQL/worker/engine integration + restart/timeout race + thử app đóng. Phụ thuộc: A3, C4. File dự kiến: worker, room connection lease, deadline tests. Phạm vi: M.

### D3. Vào nền, đổi màn và đổi tài khoản

- [ ] Suspend dừng request/subscription, render countdown/animation; foreground chờ listener xác nhận rồi lấy snapshot đúng một phiên, kiểm thử action chen giữa các bước handshake.
- [x] Logout/UID đổi/rời phòng xóa tay bài và hủy request; response cũ không lộ dữ liệu sang tài khoản mới.
- [ ] Không giữ audio/keep-awake để duy trì game; CPU/network sau suspend trở về mức nghỉ.

Kiểm chứng: lifecycle tests và profiler iOS/Android với nền 5–10 phút, chuyển qua camera/MP3. Phụ thuộc: D1–D2. File dự kiến: game session hook, table lifecycle, tests (3–5). Phạm vi: M.

### D4. Phân quyền và dọn dữ liệu

- [ ] RLS/RPC/API chống đọc bài người khác, đọc phòng đã rời, client sửa ván, tài khoản bị khóa/xóa hoặc JWT khác project.
- [ ] Thu hồi giữa kết nối xoay topic và chặn snapshot/action ngay ở server; người còn quyền nhận invalidation hoặc phát hiện epoch mới qua lease rồi handshake lại, kể cả khi mất event. Kiểm tra quyền cũ không mở lại khi refresh token.
- [ ] Retention dọn private state/receipt/summary đúng hạn và xóa UID theo account lifecycle, không xóa bảng điểm hay dữ liệu khác.

Kiểm chứng: SQL/RLS thật, admin revocation/deletion integration trong môi trường thử và review độc lập. Phụ thuộc: D1–D3. File dự kiến: game policy/migration, account cleanup integration, tests; tách cleanup thành commit riêng. Phạm vi: M mỗi commit.

### Checkpoint D

- [ ] Các ca mất mạng/đóng app/retry/timeout/khóa tài khoản không sai ván hoặc lộ bài.
- [ ] UI/native, battery và concurrency có bằng chứng; không coi test mock là đã qua native hoặc SQL.

## E — Phát hành miền Nam có kiểm soát

### E1. Quan sát lỗi và bật thử

- [x] Cờ game/client/server chỉ bật cho nhóm thử; log không có bài, mã phòng, email hoặc token.
- [ ] Có đo latency, timeout lag, reconnect, xung đột và chi phí trên tải phòng đã định ở A3.
- [ ] Deploy tương thích rulesVersion cũ; kiểm chứng tắt tạo/start mới và phương án chặn game khi có lỗi nghiêm trọng.

Kiểm chứng: thử staging 2–4 thiết bị, tải đồng thời theo mục tiêu A3, reviewer xem diff cuối và chạy đầy đủ gates liên quan. Phụ thuộc: D4. File dự kiến: feature config, metrics/runbook và tests (3–5). Phạm vi: M.

### Checkpoint E

- [ ] Người dùng thử miền Nam trên iOS TestFlight và Android release, các lỗi chặn được sửa.
- [ ] Chỉ mở rộng sau khi quyền, luật, UI, reconnect và vận hành đạt tiêu chí; không deploy cloud trong lượt lập kế hoạch này.

## F — Tiến lên miền Bắc

### F1. Bộ luật miền Bắc

- [ ] Chốt SPEC/fixture đồng màu, đồng chất, chặt/thối, mở ván và kết thúc; engine tách khỏi miền Nam.
- [ ] Implement validators/reducer và public/private projection đúng luật riêng, giữ invariant bộ bài.
- [ ] Cùng một chuỗi không hợp lệ ở Bắc nhưng hợp lệ ở Nam có regression test phân biệt.

Kiểm chứng: fixtures miền Bắc và toàn bộ tests miền Nam. Phụ thuộc: E1. File dự kiến: SPEC, north engine/fixtures/tests; chia spec và engine thành hai commit. Phạm vi: M mỗi commit.

### F2. Chơi miền Bắc online

- [ ] Tạo phòng Bắc, xem luật, chơi/kết quả/ván tiếp bằng khung phòng đã có.
- [ ] Deadline/bỏ cuộc/reconnect đúng fixture Bắc, không chỉ thay nhãn UI.
- [ ] Cờ bật riêng, chơi hai loại phòng Nam/Bắc đồng thời không lẫn luật hoặc state.

Kiểm chứng: server integration + screen/native, SQL/RLS và regression Nam; checkpoint review trước bật thử. Phụ thuộc: F1. File dự kiến: game registry, room UI, integration tests (3–5). Phạm vi: M.

## G — Phỏm

### G1. Bốc, ăn và đánh

- [ ] Chốt SPEC/fixtures thứ tự lượt, nọc, lá ăn và timeout; người mở 10 lá/người khác 9.
- [ ] Máy chủ duyệt bốc/ăn/đánh theo giai đoạn, giấu nọc, bảo toàn lá và chống gửi lặp.
- [ ] UI chỉ hiện thao tác đúng giai đoạn và tay mình; khung bàn/nọc/chồng đánh đủ rõ.

Kiểm chứng: engine + server privacy/action race + screen tests; chia luật và kết nối UI thành các commit nhỏ. Phụ thuộc: E1 và bộ luật Phỏm được duyệt. File dự kiến: phom engine/fixtures, handler, phase controls/tests. Phạm vi: M mỗi commit.

### G2. Hạ, gửi và kết thúc Phỏm

- [ ] Hạ/gửi/ăn chốt/ù/ù tròn/đền/móm và hòa điểm có kết quả đúng fixture, không dùng một lá vào nhiều phỏm.
- [ ] Hết nọc, timeout, bỏ cuộc, mất mạng ở từng giai đoạn đều kết thúc hoặc tiếp tục hợp lệ.
- [ ] Kết quả/ván tiếp và cờ bật riêng hoạt động; không hồi quy hai trò tiến lên.

Kiểm chứng: fixtures/invariant/SQL integration, UI/native 2–4 người; review cuối trước bật thử. Phụ thuộc: G1. File dự kiến: phom scoring/endgame, UI actions/results, tests; chia theo hạ/gửi và kết thúc nếu vượt một phiên làm việc. Phạm vi: M mỗi commit.

### Checkpoint hoàn tất ba trò

- [ ] Các tiêu chí trong kế hoạch đều có bằng chứng, tài liệu và phiên bản luật khớp triển khai.
- [ ] Ghi điểm cũ, điều hướng, đăng nhập và dữ liệu UID không hồi quy; typecheck/lint/Jest/function/SQL/native và review đạt.
- [ ] Từng trò có thể tắt riêng; hướng dẫn tạo/vào phòng, reconnect và luật đủ cho người dùng mới.
