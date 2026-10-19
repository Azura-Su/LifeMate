# Kế hoạch: Chơi bài online trong LifeMate

Ngày: 19/10/2026. Người dùng đã yêu cầu triển khai. Engine, phòng, API, client và UI miền Nam đã có; hai migration game, game-access, user-admin và cron đã triển khai trên Supabase với mode `open`. Firebase Third-party Auth/Realtime chưa cấu hình được nên client dùng Edge polling foreground làm dự phòng; smoke test iOS simulator đã tạo phòng thật, kiểm chứng native nhiều thiết bị vẫn còn. Miền Bắc và Phỏm chưa triển khai. Trạng thái chi tiết và bằng chứng trong [runbook](../docs/card-games-online.md).

Checklist triển khai: [card-games-todo-2026-10-19.md](card-games-todo-2026-10-19.md).

## Yêu cầu đã chốt với người dùng

- Chơi bài trực tiếp trong app với người khác qua phòng online.
- Mọi tài khoản LifeMate có mã phòng đều được tham gia; không bắt buộc đã kết bạn.
- Có Tiến lên miền Nam, Tiến lên miền Bắc và Phỏm; triển khai miền Nam trước.
- Lưu kế hoạch và checklist riêng, giữ các kế hoạch đang mở.

## Phạm vi và mặc định đề xuất

- Vào từ Home → Ghi điểm bài. Thêm lựa chọn `Chơi online`; bảng điểm thủ công và lịch sử hiện có tiếp tục dùng riêng.
- Bản đầu hỗ trợ 2–4 người/phòng, 1 người/UID và 1 phòng đang tham gia/UID; người tạo phòng cũng là người chơi.
- Luồng: chọn trò → tạo/nhập mã → phòng chờ → sẵn sàng → chủ phòng bắt đầu → chơi → kết quả → ván tiếp.
- Sau miền Nam, làm miền Bắc để dùng lại phần tiến lên; tiếp theo là Phỏm. Thứ tự hai trò sau là đề xuất kỹ thuật.
- Tập trung chơi trong nhóm bằng mã phòng, xếp hạng trong ván và số ván thắng. Bot, ghép đối thủ ngẫu nhiên, chat, khán giả, tiền cược và liên kết Tài chính nằm ngoài bản đầu.
- Không tự ghi kết quả online vào bảng điểm thủ công. Nếu cần về sau, thêm thao tác nhập kết quả rõ ràng.
- Các mốc 30 giây/lượt, 90 giây mất kết nối, 30 phút hết hạn phòng chờ là mặc định đề xuất; cố định trong phiên bản luật, hiển thị trước lúc sẵn sàng.

## Hiện trạng lúc lập kế hoạch

- `SPEC-card-score.md`, `src/screens/CardScore/`, `src/types/cardScore.ts`, `src/utils/cardScore.ts` và `src/services/cardScore/cardScoreStorage.ts` đang mô tả công cụ ghi điểm offline, mã hóa theo UID. Chưa có engine hay phòng game online.
- App dùng Expo 55, React Native 0.83, React Navigation 7, Zustand 5 và React Native Firebase 26.4 theo package.json. Có Firebase Auth và Supabase Edge/Postgres cho chức năng khác.
- Edge Functions đã xác minh Firebase JWT và kiểm tra trạng thái tài khoản qua `_shared/accountAccess.mjs`. Có mẫu RPC và cron cho tác vụ bền vững.
- Repo chưa có Supabase client/Realtime hay tích hợp Firebase Auth cho Realtime. HTTP Edge hiện có không chứng minh kết nối Realtime đã hoạt động.
- Không dùng thao tác xáo chỗ bằng `Math.random` của bảng điểm cho bộ bài online.

## Bản đồ module đề xuất

Đây là ranh giới đề xuất để duyệt cùng kế hoạch; chưa thay CAPABILITIES.md hay viết SPEC cho từng module.

| Module               | Trách nhiệm                                                                     | Phụ thuộc                                  |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| card-core            | Bộ 52 lá, định danh lá, trạng thái ván, đầu vào/đầu ra engine thuần             | —                                          |
| rules-tien-len-south | Kiểm tra hành động, chuyển lượt, chặt, kết thúc miền Nam                        | card-core                                  |
| rules-tien-len-north | Luật và kết thúc miền Bắc                                                       | card-core                                  |
| rules-phom           | Bốc/ăn/đánh/hạ/gửi, ù/móm/đền và kết quả                                        | card-core                                  |
| game-rooms           | Thành viên, máy chủ điều khiển ván, giao dịch dữ liệu, deadline, quyền truy cập | identity hiện có, các module luật được bật |
| game-session         | Client API, nhận báo thay đổi, đồng bộ phiên bản, kết nối lại và vòng đời app   | game-rooms                                 |
| game-table           | Chọn trò, tạo/vào phòng, phòng chờ, bàn bài, kết quả                            | shell hiện có, game-session                |

Chiều phụ thuộc: engine không biết UI, mạng hay database. Máy chủ gọi engine; giao diện chỉ gửi ý định và hiển thị dữ liệu được phép nhận. Module ghi điểm thủ công không phụ thuộc game online.

Thứ tự: thử nghiệm quyền/kết nối + chốt bộ luật → phòng chờ → chia bài riêng → chơi miền Nam hoàn chỉnh → mất mạng/vào nền/timeout → kiểm chứng và phát hành miền Nam → miền Bắc → Phỏm.

## Luồng UI

1. **Điểm vào:** màn Ghi điểm bài có `Ghi điểm` và `Chơi online`. Giữ đường vào và dữ liệu ghi điểm cũ; không thêm tab đáy thứ năm.
2. **Chọn trò:** miền Nam khả dụng trước; hai trò chưa triển khai có trạng thái rõ ràng, không cho tạo phòng chưa chơi được.
3. **Tạo/vào phòng:** chọn trò, tên hiển thị, tạo mã dễ đọc hoặc nhập mã. Lỗi mã sai, hết hạn, đầy, đang chơi xuất hiện ngay cạnh thao tác; chống gửi lặp.
4. **Phòng chờ:** tối đa bốn ghế, avatar/tên, chủ phòng, trạng thái sẵn sàng; có sao chép/chia sẻ mã và xem luật. Bắt đầu khi có ít nhất hai người, tất cả sẵn sàng. Thay đổi ghế hoặc luật làm mất trạng thái sẵn sàng; không đổi luật giữa ván.
5. **Bàn chơi dọc:** tay mình phía dưới, ba vị trí còn lại theo ghế; chỉ hiện số lá của người khác. Giữa bàn là bộ vừa đánh, người đánh và lượt hiện tại. Chọn/bỏ chọn lá, sắp xếp theo số/chất, nút `Đánh`/`Bỏ lượt`, báo lý do bộ không hợp lệ. Ván Phỏm thay bằng nhóm thao tác đúng giai đoạn.
6. **Đang chờ máy chủ:** khóa hành động tương ứng và giữ bàn hiện tại. Khi nhận version mới, chỉ cập nhật phần thay đổi; không che toàn bàn bằng loading mỗi lượt.
7. **Kết quả:** thứ hạng, thắng trắng/phạt nếu có, số ván thắng; `Sẵn sàng ván tiếp` và `Rời phòng`. Có xác nhận khi rời ván đang chơi. Chủ phòng rời không làm mất ván.

Nút chạm tối thiểu 44 pt, safe area đúng Android/iOS, thử màn hình thấp và chữ lớn. Khi bàn phím nhập mã phòng mở, ô nhập/nút chính vẫn thấy được. Bàn chơi toàn màn hình có đường quay lại rõ ràng. Các hiệu ứng chia/đánh bài ngắn, tôn trọng giảm chuyển động, không giữ hoạt ảnh khi app nền.

## Kiến trúc online đề xuất

**Ưu tiên Supabase Edge Functions + Postgres + Realtime; giữ Firebase làm hệ thống đăng nhập.** Cần chứng minh các điều kiện dưới đây trong môi trường thử trước khi cam kết triển khai toàn bộ.

### Điều kiện nền tảng phải kiểm chứng sớm

- Theo tài liệu Supabase, Realtime dùng Firebase cần cấu hình Third-party Auth, claim `role: authenticated`, lấy token Firebase và cơ chế làm mới token. Kiểm tra dự án thực tế trước; không giả định đã cấu hình.
- Chọn cơ chế cấp claim phía máy chủ cho cả tài khoản mới và tài khoản cũ khi dùng game lần đầu; bảo toàn các claim khác, giới hạn tần suất và chỉ cấp sau xác minh tài khoản. Refresh token có giới hạn sau khi cấp; không tạo vòng lặp refresh.
- Firebase UID là chuỗi, không mặc định UUID hay FK vào `auth.users`; chính sách lấy UID từ claim `sub`, kiểm tra đúng issuer/audience và trạng thái tài khoản.
- Chứng minh hai tài khoản thật nhận đúng thông báo phòng, tài khoản thứ ba bị từ chối, token hết hạn được làm mới và UID thay đổi hủy phiên cũ. Kiểm tra việc thêm role không mở quyền ở các bảng hiện có.
- Kiểm chứng cron theo giây trên project/version đang dùng, độ trễ Edge và cơ chế xử lý deadline khi không có client online. Cron dọn tài khoản mỗi phút hiện có không đáp ứng thời gian lượt chơi.
- Nếu thử nghiệm không đạt, ghi lại nguyên nhân và cập nhật lựa chọn backend trước các tác vụ phụ thuộc. Không tự ghép thêm nguồn trạng thái game thứ hai.

### Ranh giới dữ liệu và đồng bộ

- Postgres là nguồn quyết định duy nhất cho phòng/ván. Không lưu ván mutable ở cả Firestore và Postgres; R2 không cần cho dữ liệu bộ bài.
- State đầy đủ gồm bài trên tay mọi người, bộ còn lại, lượt, luật, seed/entropy nếu cần phục hồi: chỉ máy chủ truy cập; không publish toàn bộ row qua Realtime.
- Snapshot trả về cho một UID gồm dữ liệu chung trong phòng + bài của UID đó + hành động hiện được phép. Không trả email, token, seed, nọc Phỏm hay bài người khác. Kiểm tra trạng thái tài khoản/thành viên ở mỗi lần lấy snapshot.
- Realtime private chỉ thông báo `roomId/version`; không mang bài riêng, tên hay payload ván. Nhận báo mới thì lấy snapshot được lọc qua Edge. Chặn client tự phát thông báo hệ thống.
- Realtime không phải nhật ký bảo đảm giao nhận. Mọi join/resubscribe/foreground dùng cùng handshake: lấy metadata phiên/kênh đã kiểm tra thành viên → đăng ký listener và chờ xác nhận subscription → lấy snapshot có version. Gộp báo dồn trong lúc lấy snapshot, chỉ nhận version tăng dần và lấy lại nếu có khoảng trống. Nếu epoch đổi giữa handshake thì lặp có giới hạn/backoff với metadata mới; không báo đã đồng bộ khi listener chưa sẵn sàng. Không áp dụng response cũ đè state mới.
- Quyền kênh Realtime có thể được cache đến lúc token thay đổi/hết hạn. Khi thành viên bị loại/khóa, tăng epoch/đổi topic cho thông báo tương lai; phát invalidation không chứa dữ liệu ván trên topic cũ. Snapshot/metadata đã kiểm tra thành viên mới trả epoch/topic mới; người còn quyền thực hiện lại handshake trên topic mới rồi bỏ listener cũ. Mọi API vẫn kiểm tra quyền hiện tại. Không dựa vào RLS lúc join để thu hồi bài đã/đang trả về.
- Invalidation cũng có thể thất lạc: response gia hạn lease kết nối foreground luôn trả epoch/version hiện tại. Client phát hiện khác biệt thì resubscribe/resync, không cần một vòng polling snapshot riêng. Người đã mất quyền bị từ chối cả gia hạn và snapshot. Test cả invalidation bị mất, resubscribe thất bại và action xảy ra trong lúc đổi kênh.
- Tay bài giữ trong bộ nhớ theo UID/phòng, không đưa vào log/analytics hay cache offline mặc định. Logout/đổi tài khoản/rời phòng hủy request/listener, xóa state; bỏ response tới muộn của phiên cũ.

### Giao dịch và tính đúng của ván

- Mỗi hành động mang `roomId`, `matchId`, `actionId`, `expectedVersion`, `type` và payload nhỏ có schema. UID lấy từ token, không nhận danh tính người đánh từ client.
- Máy chủ xác thực, kiểm tra tài khoản/thành viên, đọc state và gọi engine thuần. Commit RPC giới hạn service-role, khóa room, kiểm tra lại trạng thái tài khoản/thành viên/phiên điều khiển/deadline/version và ghi state + receipt của action + kết quả + thông báo thay đổi trong một giao dịch.
- Engine có thể tính ngoài transaction; nếu version thay đổi trước commit phải tính lại trên state mới hoặc báo xung đột. Không ghép nhiều HTTP PATCH thành một lần đánh bài.
- Unique receipt theo room/match/UID/actionId và ràng buộc payload: gửi lại cùng action trả receipt cũ; tái dùng ID với payload khác bị từ chối. Ack mất không được đánh hai lần. Lệnh start/join/leave/ready/next-round cũng phải chống lặp và cạnh tranh.
- Xáo bộ 52 lá tại máy chủ bằng nguồn ngẫu nhiên mật mã và thuật toán không thiên lệch. Bộ đã chia được persist để restart không chia lại. Client không gửi seed hay tự quyết định bài được chia.
- Cùng một UID chỉ có một phiên được điều khiển bàn; thiết bị thứ hai có luồng nhận quyền rõ ràng và làm vô hiệu phiên điều khiển cũ. Không nhân đôi ghế hay lượt khi reconnect.

### Mã phòng, timeout và vòng đời

- Mã đề xuất: 8 ký tự không dễ nhầm, sinh ngẫu nhiên, uniqueness ở database. Mã là cách tìm phòng; chỉ thành viên đã tham gia mới đọc snapshot. Rate limit tạo/tìm/vào phòng theo tài khoản và IP; không có endpoint liệt kê phòng công khai.
- Phòng chờ cho đổi chủ khi chủ rời, đóng khi hết người/hết hạn. Phòng đang chơi khóa ghế, chỉ thành viên cũ được kết nối lại; người mới không vào giữa ván.
- Server lưu `turnDeadline` và đồng hồ chuẩn. Hết 30 giây: tự bỏ lượt nếu hợp lệ; nếu đang mở vòng, đánh lá hợp lệ nhỏ nhất theo luật đã chốt. Không suy diễn bỏ lượt bằng `setInterval` của điện thoại.
- Bộ xử lý deadline bền vững chạy độc lập với client, lấy lease/lock và so `matchId/version/deadline` trước khi áp dụng; timeout cạnh tranh với đánh bài chỉ có một kết quả. Worker trễ xử lý tuần tự trên deadline mới, không phát sinh chuỗi phạt tức thời vì lấy lại mốc thời gian cũ.
- Mất kết nối được giữ ghế trong 90 giây; timeout lượt vẫn áp dụng, không dừng cả bàn. Quá hạn/rời chủ động: đánh dấu bỏ cuộc một lần, cách xếp hạng và xử lý lá còn lại phải có fixture theo từng trò. Còn một người hoạt động kết thúc ván theo luật bỏ cuộc; tất cả mất kết nối thì đóng ván theo chính sách hủy rõ ràng.
- Presence chỉ hỗ trợ hiển thị; không phải căn cứ duy nhất để xử thua. Định nghĩa lease kết nối/gia hạn khi foreground, ngừng gia hạn khi nền. Chỉ một cơ chế gia hạn có tần suất giới hạn, không chạy polling game liên tục.
- Khi đổi màn hoặc app inactive/background: dừng countdown render, hoạt ảnh và kết nối game theo chính sách phiên; trở lại foreground thực hiện handshake listener đã xác nhận → snapshot như trên, kể cả khi epoch đã thay đổi. Không dùng background audio/keep-awake để giữ phòng. Trong ván, server vẫn chạy luật timeout.
- Phòng chờ hết hạn sau 30 phút không có hoạt động hợp lệ. State ván/bài riêng xóa sau 24 giờ kể từ kết thúc; receipt giữ ít nhất cùng thời gian. Chỉ giữ summary kết quả 30 ngày, phân quyền theo người tham gia. Dọn UID khi xóa tài khoản, ẩn danh tên ở summary cần giữ; policy retention phải chốt trong SPEC trước migration.

## Luật từng trò: việc phải chốt trước engine

Không coi một mô tả trên mạng là luật chung cho mọi nhóm. Mỗi phòng có `rulesVersion` bất biến; dùng bộ ví dụ đầu vào/kết quả làm tiêu chí nghiệm thu. Các luật đặc biệt không được thay bằng nhánh suy đoán trong UI.

| Trò               | Cơ sở đề xuất                                                                                   | Các trường hợp phải có fixture trước phát hành                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiến lên miền Nam | 2–4 người, 13 lá/người; thứ tự 3→A→2, bích→chuồn→rô→cơ; lẻ/đôi/sám/sảnh; 2 không nằm trong sảnh | Mở ván đầu khi 3 bích không được chia; ván sau ai mở; bỏ lượt và mở vòng mới; người vừa hết bài đang giữ vòng; chặt heo/tứ quý/3–4 đôi thông, chặt ngoài lượt có/không; tới trắng và thứ tự ưu tiên nhiều người cùng đạt; cóng/thối; về bằng 2; xếp hạng tiếp đến còn một người |
| Tiến lên miền Bắc | Dùng chung bộ lá và khung lượt; quy định đồng màu/đồng chất theo bộ luật đã duyệt               | Đôi đồng màu, sảnh đồng chất; ràng buộc chất của bộ chặn; tứ quý/chặt 2; bỏ lượt, mở ván, thối và kết thúc; không dùng validator miền Nam cho miền Bắc                                                                                                                          |
| Phỏm              | 2–4 người; người mở 10 lá, người khác 9; phỏm bộ ba/bốn và sảnh đồng chất; lượt bốc/ăn rồi đánh | Ăn lá và phỏm liên quan; thứ tự nọc; số lượt; hạ/gửi; ăn chốt; ù/ù tròn/đền; móm; điểm bài rác và hòa điểm; hết nọc; timeout/bỏ cuộc ở từng giai đoạn; lá đã ăn không bị dùng vào hai phỏm                                                                                      |

Miền Nam là gói hoàn chỉnh đầu tiên: không bật cho người dùng thật khi mới xử lý lẻ/đôi/sảnh mà chưa chốt chặt/tới trắng/bỏ cuộc. Kết quả bản đầu dùng thứ hạng và số ván thắng; nếu bổ sung điểm phạt, công thức phải có SPEC và test riêng, không ảnh hưởng số liệu Tài chính.

## Lát cắt triển khai và cổng kiểm chứng

| Mốc | Người dùng làm được                                | Điều kiện hoàn tất                                                                  |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A   | Chưa bật game; xác nhận phương án kỹ thuật và luật | Auth/Realtime/cron thử được, bộ luật miền Nam có fixtures được duyệt                |
| B   | Tạo/vào phòng, xem ghế, sẵn sàng, rời phòng        | Hai thiết bị thấy cùng phòng; tranh ghế/start/rời không phá state                   |
| C   | Chơi một ván miền Nam đầy đủ và ván tiếp           | Chia bài riêng, luật/đặc biệt, thứ hạng và idempotency đúng                         |
| D   | Mất mạng, đổi màn, vào nền rồi quay lại            | Khôi phục đúng ván; timeout chạy không cần client; không lộ bài hay duy trì tải nền |
| E   | Thử miền Nam trên nhóm nhỏ                         | Test quyền/tải/native, cờ bật tính năng, giám sát lỗi và phương án tắt có tác dụng  |
| F   | Chơi miền Bắc                                      | Bộ luật riêng, không hồi quy miền Nam                                               |
| G   | Chơi Phỏm                                          | Bốc/ăn/đánh/hạ/gửi và kết quả đặc biệt đúng                                         |

Mỗi mốc chia thành các task nhỏ trong checklist; không gộp toàn bộ backend hoặc UI thành một lần sửa. Chỉ viết SPEC module sau khi thống nhất ranh giới và luật; trước thay đổi auth/migration cần review kế hoạch và diff độc lập theo AGENTS.md.

## Kiểm thử và mục tiêu chất lượng

- **Engine:** bảng fixture luật và invariant 52 lá không trùng/mất, bảo toàn quyền sở hữu, đúng lượt, đúng số người/xếp hạng, không sửa state đầu vào. Random test dùng seed trong test, không thay ngẫu nhiên production.
- **Backend/SQL thật:** giả token/UID/room; đọc bài người khác; client gọi RPC/ghi bảng; khóa/xóa tài khoản; cạnh tranh start/join/play/timeout; lặp action; restart sau commit trước ack; version lạc; dọn dữ liệu. Test thực trên Postgres cục bộ, không chỉ mock HTTP.
- **Client:** loading lần đầu, giữ bàn khi nhận lượt, lỗi gửi có thể khôi phục, sync sau mất event, response đảo thứ tự, đổi UID, listener/timer cleanup, tiếp quản phiên thiết bị khác.
- **Native:** iOS TestFlight và Android release trên thiết bị thật, 2–4 tài khoản/thiết bị; Wi-Fi↔4G, airplane mode, khóa màn hình, nền 5–10 phút, chữ lớn/màn thấp, bàn phím/safe area.
- **Mục tiêu để đo:** thao tác hợp lệ được hiển thị sang máy khác p95 ≤ 1 giây ở mạng ổn định trong cùng vùng; sau foreground + mạng phục hồi, trở lại snapshot nhất quán p95 ≤ 3 giây. Đây là mục tiêu, chưa có số đo. Chốt tải thử và vùng backend tại mốc A.
- **Nền:** không có request/subscription/animation game từ client sau khi suspend hoàn tất; CPU trở về mức nghỉ của app. Đo native profiler, không suy ra nhiệt độ từ Jest.
- **Lệnh có sẵn:** `npm run typecheck`; `npx eslint <các file TS/JS thay đổi>`; `npm test -- --watchman=false --runTestsByPath <các test liên quan>`; `npm run test:functions`; `npm run bundle`. Chạy `npm run test:rules` nếu thay Firestore rules. Phải bổ sung runner SQL/RLS và kiểm tra reset/push trên database thử cho các migration mới; không gọi mock unit test là đã kiểm chứng migration.

## Phát hành và vận hành

- Mỗi trò có cờ availability riêng; trong lúc phát triển chỉ tài khoản thử vào được. Cờ UI không thay kiểm tra bật/tắt ở server.
- Migration cộng thêm bảng/RPC, version duy nhất, RLS mặc định đóng; không thay dữ liệu bảng điểm cũ. Chạy trên DB mới và DB có schema hiện tại trước khi đẩy môi trường thật.
- Pin phiên bản luật/engine của ván đang chạy. Deploy mới phải tiếp tục xử lý phiên bản ván cũ hoặc đợi drain; không áp luật mới vào ván đang chơi.
- Tắt khẩn cấp: chặn tạo/start ván mới, cho ván đang chơi kết thúc nếu an toàn; nếu có lỗi lộ bài/dữ liệu thì chặn toàn bộ API game, thu hồi kênh và hủy ván có lý do. Không rollback bằng cách xóa schema hay dữ liệu ghi điểm.
- Log có cấu trúc: mã hành động, correlation ID không chứa PII, latency, version conflict, timeout lag, reconnect, số phòng đang hoạt động; không log bộ bài, request/response nguyên văn, mã phòng hay token.
- Thu thập lỗi client/server có giới hạn; theo dõi chi phí request/Realtime/cron. Một worker lấy batch deadline đến hạn, không một cron riêng cho mỗi phòng, không sweep toàn bộ bảng mỗi giây.

## Nguồn và giới hạn của kế hoạch

- [Supabase: Firebase Auth integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth): cấu hình provider, custom claim và client accessToken; repo chưa có luồng này cho game.
- [Supabase: Realtime authorization](https://supabase.com/docs/guides/realtime/authorization): private channel/RLS và thời điểm kiểm tra lại quyền; vì vậy thiết kế không phát bài riêng qua kênh.
- [Supabase Cron](https://supabase.com/docs/guides/cron): hỗ trợ lịch theo giây; vẫn phải xác nhận extension/version/quota của project.
- [Pagat: Tien Len](https://www.pagat.com/climbing/thirteen.html): tham khảo cơ chế leo bài và sự khác nhau giữa các biến thể; không dùng làm bộ luật mặc định chưa duyệt, không áp quy tắc tiền cược.
- Chưa đo latency/tải, chưa xác minh cấu hình cloud đang chạy, chưa kiểm thử game native. Đây là kế hoạch đề xuất; các mục đó là việc của mốc A–E.

## Rà soát kế hoạch

- Review độc lập ngày 19/10/2026 phát hiện thứ tự reconnect chưa thống nhất và thiếu bàn giao topic sau thu hồi quyền. Đã sửa handshake listener → snapshot, invalidation và phát hiện epoch/version lệch qua lease; bổ sung ca kiểm chứng ở D1/D3/D4.
- Reviewer kiểm tra lại các sửa đổi: hai phát hiện đã được giải quyết, không có vấn đề mới cần sửa trong các đoạn bổ sung; kế hoạch sẵn sàng để người dùng xem xét.
- Kiểm tra định dạng Prettier của hai tài liệu đạt. Chưa chạy test ứng dụng/SQL/native vì lượt này chỉ tạo tài liệu kế hoạch.
