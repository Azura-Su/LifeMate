# Chơi bài online

## Phỏm — 23/10/2026

Thêm Phỏm online với luật [phom-v1](SPEC-rules-phom.md):9/10 lá, ăn/bốc/hạ/gửi,
4 lượt mặc định (có tùy chọn Tái), ù/ù tròn/đền. Từng mức nhì/ba/bét/ăn/chốt/móm/ù/ù tròn/
đền/bỏ cuộc có ô nhập riêng khi tạo phòng, cho phép0. Cấu hình lưu trong phòng,
hiện trong luật và bất biến trong từng ván; chủ phòng sửa trong phòng để áp dụng từ ván sau. Bảng điểm tự ghi delta do server tính.
Cấp3 cây cho người ù luôn đền; tùy chọn Ù đền do tái chỉ hiện khi Tái bật và
chỉ quy trách nhiệm cho người ăn chốt tạo ra đúng lượt tái có người ù. Xem
SPEC-rules-phom.md để biết ưu tiên và vòng đời lượt tái.
Mô tả13 lá/bỏ lượt/tới trắng bên dưới dành cho miền Nam; Phỏm có bàn/actions riêng.

Room cũ không có kind vẫn là south. Phỏm dùng clientVersion3; server chặn client
cũ trước khi nhận ghế, tiếp quản, mở lại hoặc đọc bài. Client mới giữ fallback2→1
cho south, không hạ protocol khi tạo/gửi nước Phỏm. Snapshot không có nọc hoặc tay
đối thủ. Layout giữ hand/actions dưới, body/public history có viewport/cuộn riêng
để không đẩy nút ra khỏi màn thấp; xem lại cả bài đã đánh của chính mình.

Phỏm đã deploy backend v10 ngày23/10/2026; xem tasks/phom-cloud-deploy-2026-10-23.md.

Tiến lên bổ sung dropdown chế độ đánh tiếp hoặc dừng khi người đầu tiên hết bài,
cùng mức phạt chung mỗi lá2 bị chặt (0 tắt). Phòng khác mặc định dùng cấu hình
bất biến trong từng ván và south-v2, cần client capability4; phòng cũ giữ south-v1. Kết quả cộng
tiền bài còn chuyển người nhất và phí chặt chuyển trực tiếp người bị chặt/người
chặt, tổng0. UI hiện phí chặt gần nhất và khoản chặt trong kết quả. Xem
SPEC-rules-tien-len-south.md và tasks/south-config-plan-2026-10-23.md.

Mục Chơi online chỉ hiện khi email tài khoản có trong Remote Config `usergame`,
là JSON array chuỗi email. So khớp sau chuẩn hóa khoảng trắng đầu/cuối và chữ hoa
thường. Danh sách mặc định rỗng; cấu hình lỗi/offline giữ danh sách hợp lệ đã kích
hoạt. Khi danh sách hoặc email đổi, app cập nhật mode tab và gỡ route CardGames nếu
không còn phù hợp. Tính điểm vẫn dùng được. Đây là điều kiện hiển thị UI; quyền dữ
liệu backend và điều kiện dịch vụ hiện có vẫn áp dụng.

Người dùng đã chấp thuận kế hoạch ngày 19/10/2026. Tiến lên miền Nam và Phỏm
đang khả dụng; mọi tài khoản LifeMate có mã phòng đều vào được phòng còn chỗ,
không yêu cầu kết bạn. Giữ công cụ Ghi điểm bài thủ công và dữ liệu cũ.

Ngày 25/10/2026, người dùng chọn profile luật đề xuất cho Tiến lên miền Bắc,
Sâm và Tấn. Plan và SPEC riêng nằm trong
`tasks/card-games-north-sam-tan-plan-2026-10-25.md` và
`SPEC-rules-tien-len-north.md` / `SPEC-rules-sam.md` / `SPEC-rules-tan.md`.
Các vertical slice engine, protocol, room/score backend, SQL và UI đã được làm
trong source. Ba game dùng capability v9; cần rollout migration và Edge trước
bản ứng dụng có catalog mới để client cũ không thể tạo hoặc vào các phòng này.

## Trải nghiệm

Home → Trò chơi & điểm số → Chơi online → Chọn trò → Chọn tạo phòng mới hoặc vào phòng có sẵn bằng mã → vào thẳng bàn chờ → mọi thành viên sẵn sàng → máy chủ tự bắt đầu → Chơi → Kết quả / Ván tiếp. Phòng cần ít nhất hai người; mọi thành viên, gồm chủ phòng, bật/tắt trạng thái sẵn sàng ngay trên bàn. Máy chủ tự bắt đầu ván đầu hoặc ván tiếp theo khi phòng có ít nhất hai người và tất cả thành viên hiện tại đã sẵn sàng; người mới vào chưa sẵn sàng và không xóa trạng thái sẵn sàng của những người đang chờ; rời phòng vẫn reset sẵn sàng của các thành viên còn lại. Không cần action bắt đầu riêng từ chủ phòng. Chơi online có danh mục nhiều trò; chỉ trò đã hoàn thiện luật và backend mới mở tạo/tham gia phòng. Tiến lên miền Nam, Tiến lên miền Bắc, Sâm, Tấn và Phỏm đã có luật/version riêng trong source. Phòng 2–4 người, mã 8 ký tự dễ đọc. Không có khán giả, bot, tiền cược hay giao dịch Tài chính; số tiền trong phòng chỉ là điểm số.

Khi tạo phòng Tiến lên miền Nam, chủ phòng đặt số đồng bị trừ trên mỗi lá còn lại (mặc định 1). Người thua bị trừ `số lá còn × mức mỗi lá`; người nhất nhận tổng tiền bị trừ để mỗi ván cân bằng. Đây là cách tính điểm đơn giản, chưa cộng phạt cóng/thối/chặt. Kết quả và số dư tích lũy do máy chủ tính, hiển thị trong sảnh, bàn chơi và kết quả. Khi ván kết thúc, mỗi ghế hiện delta ngay dưới số dư, delta bay vào số dư rồi bộ đếm chạy từ `số dư cuối - delta` đến chính xác số dư cuối. Hiệu ứng dùng cùng một `matchId` để không phát lại do snapshot lặp; ván hủy và delta 0 không chạy cộng/trừ. Pháo hoa particle xuất hiện quanh avatar người thắng trên mọi thiết bị, chạy một lần trong khoảng 2 giây rồi dừng; kết quả gọn ở từng ghế, không phủ giữa bàn. Avatar dùng ảnh hồ sơ của tài khoản khi có, nếu không tải được thì hiện chữ cái đầu tên; ảnh được chia sẻ qua URL ký hạn ngắn cho thành viên phòng và không lưu trong cache offline. Người thắng chỉ có vương miện trên avatar, không có huy hiệu ready bên dưới; trạng thái sẵn sàng sau kết quả hiện ở dòng tổng của bàn. Ở sảnh, trạng thái ready lấy từ snapshot server và hiển thị tại từng ghế; chủ phòng được biểu thị là ghế có quyền bắt đầu và được tính trong điều kiện sẵn sàng hiện có. Không tự động bắt đầu ngay sau khi công bố kết quả: mọi người cần chủ động sẵn sàng; khi tất cả đã sẵn sàng, máy chủ tự xác nhận điều kiện và bắt đầu match mới. Không thêm tự động ready/countdown nếu protocol phòng chưa cung cấp. Phòng và số dư/thành tích được giữ sau khi ván kết thúc; thành viên chỉ vào lại khi phòng còn hạn hoặc sau khi chủ phòng tạo lại phòng đã hết hạn. Mỗi phòng có một bảng điểm chung trên server, kể cả khi chủ phòng đang chờ một mình. Kết quả hoàn tất dùng matchId để chống ghi trùng; ván hủy không thêm dòng điểm. Chỉ chủ phòng hiện tại được sửa/xóa bảng điểm; thành viên cùng xem điểm và lịch sử thay đổi. Việc sửa bảng điểm không đổi số dư có thẩm quyền của game. Máy chỉ lưu cache mã hóa theo UID; các bản cũ cục bộ được giữ chỉ xem và không tạo bản cũ mới. Xem SPEC-card-score.md.

Từ bàn điểm online đã liên kết hoặc lịch sử, người chơi có thể chạm “Vào lại” bằng mã đã lưu trong lúc trạng thái phòng đang tải hoặc tải lỗi; server vẫn kiểm tra quyền khi thực sự vào. Khi trạng thái đã xác nhận phòng hết hạn/đóng, không hiển thị “Vào lại”. Nếu phòng đã hết hạn, chỉ chủ phòng hiện tại thấy “Tạo lại phòng”; sau khi mở lại, những thành viên cũ thấy “Vào lại”. Chủ phòng cũng có thể chuyển quyền cho người đang ngồi và xóa phòng sau khi ván đã kết thúc. Xóa phòng làm mất phòng và mã nhưng giữ bảng điểm chung. Xóa bảng điểm là thao tác chủ phòng, đồng bộ cho mọi thành viên, loại bàn khỏi danh sách ngay khi xóa thành công và không có khôi phục. Dấu xóa/lịch sử sửa đổi nội bộ vẫn được giữ để chống đồng bộ lại và đối chiếu.

Mỗi người thấy bài mình, bộ trên bàn, lượt và thời gian còn lại. Theo yêu cầu UI đã chốt, không hiển thị số lá ở ghế đối thủ; số lá trong snapshot vẫn dùng cho animation chia bài. Chọn lá rồi Đánh hoặc Bỏ lượt. Thao tác chờ máy chủ không xóa lá sớm, không loading lại cả bàn. Trong phòng, header chỉ có nút quay lại; nút này phải hỏi xác nhận trước khi rời phòng hoặc bỏ ván. Bàn đủ bốn người ở cả màn dọc và ngang đặt một đối thủ phía trên, hai đối thủ thấp hơn ở hai bên và người chơi ở cạnh dưới để tạo bốn vị trí quanh bàn. Khi bàn đang mở (chờ, đang chơi hoặc kết quả), cho phép xoay theo hướng thiết bị thay vì ép ngang; màn chọn trò/tạo hoặc nhập mã phòng giữ dọc. iOS dùng orientation DEFAULT (dọc và hai chiều ngang, không dọc lộn ngược) để tương thích iPhone có tai thỏ/Dynamic Island; Android giữ ALL. Popup luật, mã phòng và thông tin người chơi hỗ trợ cùng các chiều xoay của bàn. Bài trên tay xếp chồng để vừa màn hình ở cả hai hướng. Nút và lá chạm được có nhãn trợ năng; chữ lớn và safe area được kiểm tra ở cả hai hướng.

Vùng bài dưới màn hình giữ nguyên khi ván chuyển trạng thái. Sau khi kết thúc, lá cũ được ẩn và ready/start hiện giữa vùng bài; không đặt action ván tiếp ở footer hay mép phải. Lá được chọn chỉ nâng theo trục Y, không phóng to hoặc đổi thứ tự lớp; overlap được tính theo viewport và giới hạn để góc số/chất vẫn đọc/chạm được. `PASS_TURN` dùng lá lưng biểu tượng bay từ ghế vào bàn rồi mờ đi; không lấy lá thật, không giảm số lá và không thay bộ đang đánh. Animation bắt đầu khi snapshot thêm người vào danh sách bỏ lượt. Lần bỏ cuối vòng (server dọn cả table/passed ngay) chỉ được suy ra từ hai version liên tiếp cùng phòng/match, có bộ cũ không rỗng, lượt cũ là người đang hoạt động khác chủ bộ, và toàn bộ UID/order/count/finished/forfeited cùng thành viên giữ nguyên. Không suy ra sau reconnect hoặc bỏ lỡ version. Flights có khóa sự kiện riêng và không phát lại do snapshot lặp; xoay màn hình, background, đổi ván hoặc kết thúc hủy sạch transient cũ.

## Hợp đồng máy chủ

- Firebase xác thực người chơi. Postgres là nguồn trạng thái duy nhất. Edge xác thực hành động và gọi engine thuần; RPC service-only commit bằng compare-and-swap version trong transaction.
- Mỗi command có actionId UUID ổn định khi retry, payload fingerprint; lệnh tác động phòng và takeover bắt buộc roomId. Các lệnh đổi trạng thái còn có expectedVersion và matchId. Riêng ready có thể dùng phiên bản cũ trong cùng phòng/match: Edge đọc lại và tính lại trên trạng thái hiện tại, thử CAS tối đa 4 lần; không áp dụng qua match mới, cho phiên bản tương lai hoặc các lệnh đánh/bỏ lượt. Receipt giữ nguyên actionId/fingerprint để request trùng chỉ tạo một match. UID/authTime lấy từ JWT đã xác minh; không nhận từ client. Receipt trả ack ban đầu, còn snapshot luôn được kiểm tra quyền và lọc theo người đang gọi.
- Commit khóa phòng và kiểm tra tài khoản hiện tại, `valid_since <= authTime`, thành viên, phiên điều khiển và deadline; khóa dòng tài khoản đồng bộ với thao tác khóa/mở tài khoản. RLS Realtime cũng kiểm tra issuer/audience/sub/auth_time và cutoff thu hồi token.
- Một ghế/UID, một phòng đang tham gia/UID, một phiên điều khiển/UID. Thiết bị khác chỉ tiếp quản sau thao tác rõ ràng; phiên trước không được gửi action nữa.
- Không expose row chứa tay bài/nọc/entropy. Snapshot allowlist gồm người chơi trong phòng, số lá, lượt, bộ đang đánh, kết quả và tay của người gọi. Không log bài, email, mã phòng hay token.
- Realtime private chỉ gửi version/epoch; client mở listener rồi đọc ngay snapshot đã lọc qua Edge, không chờ handshake Realtime. Thao tác chỉ mở sau khi lần đọc mới thành công, kể cả khi đang giữ snapshot cũ để hiển thị trong lúc nối lại. Khi Realtime chưa kết nối, client polling mỗi 1 giây khi foreground, gộp các lần đọc đang chờ để không có hai lần sync chạy đồng thời và tạm bỏ qua poll trong lúc chính thiết bị chờ action commit; dừng polling ngay khi SUBSCRIBED. Lease foreground phát hiện event thất lạc. Khi xoay epoch, thành viên còn quyền handshake lại qua metadata kiểm tra membership; người mất quyền không đọc được snapshot. Lỗi đọc lại vẫn cho quay lại màn trước với thông báo việc rời phòng chưa được xác nhận.
- Khi blur/inactive/background/logout: hủy request, kết nối và timer render. Logout/UID đổi xóa cả tay bài và bỏ response phiên cũ. Server vẫn xử lý timeout khi không có client.
- Lượt 40 giây, lease kết nối 90 giây, phòng chờ hết hạn sau 30 phút không có hoạt động hợp lệ. Timeout có vòng đang đánh thì bỏ lượt; mở vòng thì đánh lá nhỏ nhất hợp lệ. Bỏ cuộc đứng sau người còn chơi, theo thứ tự bỏ cuộc ngược lại; không được tính thắng vì tự thoát.
- Client mặc định bật khi có cấu hình cloud hợp lệ và vẫn có kill switch build; server có `open`/`drain`/`closed`. Theo yêu cầu mở bản chơi được ngày 19/10/2026, Edge polling foreground cho phép phát hành khi Realtime gateway chưa nhận Firebase JWT; các gate SQL/function/review và smoke test tạo phòng native phải đạt. Realtime private, nhiều thiết bị thật, lifecycle/battery và tải vẫn là gate để xác nhận chất lượng đầy đủ, không được ghi là đã đạt. Không tạo dữ liệu tài khoản thật làm fixture.
- Xóa tài khoản đóng/xóa phòng tạm có bài của tài khoản đó và xóa summary/receipt liên quan trước khi báo hoàn tất dọn dữ liệu; người khác trong phòng được báo phòng đã đóng. Khóa tài khoản chỉ thu hồi quyền và xử bỏ cuộc, không xóa dữ liệu bảng điểm thủ công.

## Module và kiểm chứng

Các module và dependency theo `tasks/card-games-plan-2026-10-19.md`; bộ luật miền Nam chi tiết ở `SPEC-rules-tien-len-south.md`. Engine server nằm dưới `supabase/functions/game-access/`, test Node bên `supabase/functions/tests/`; client types/service/hook/UI dưới `src/`. Engine không phụ thuộc React, database hay token.

Lệnh: `npm run test:functions`; `npm run typecheck`; `npx eslint <file thay đổi>`; `npm test -- --watchman=false --runTestsByPath <test liên quan>`; `npm run bundle`. Migration có test PostgreSQL/RLS/concurrency thật trước khi bật cờ. Kiểm tra iOS/Android với 2–4 người, retry/mất ack, mất mạng/đổi mạng, vào nền, logout và khóa tài khoản.

Nguồn: [Supabase Firebase Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).

## Bổ sung từ review 20/10/2026

- Nút back trên header và Back hệ thống Android dùng chung luồng xác nhận rời phòng/bỏ ván; chỉ màn đang focus/foreground chặn Back hệ thống. Trong lúc nối lại chưa có dữ liệu mới, giữ cùng giới hạn thao tác của header; khi đọc lỗi chỉ cho quay lại cục bộ với thông báo chưa xác nhận rời phòng. Phòng trống còn hạn chờ chủ phòng vào trước; trạng thái không được báo thành viên khác có thể vào rồi để API từ chối mã phòng.

- Người tạo là chủ phòng đầu tiên. Chủ phòng hiện tại có thể chuyển quyền cho người đang ngồi; quyền không tự chuyển khi chủ phòng rời hoặc mất kết nối. Việc vào phòng, sẵn sàng/bỏ sẵn sàng, đánh/bỏ lượt, chuyển chủ và mở lại là hoạt động hợp lệ đặt lại hạn 30 phút. Chỉ mở app, xem phòng, đọc snapshot, heartbeat, timeout và dọn lease không đặt lại hạn.
- Ghế Tiến lên là projection tương đối theo UID đang xem: bản thân ở dưới,
  đối thủ theo vòng thứ tự ghế bắt đầu sau bản thân. Đang chơi lấy thứ tự
  participants; sau ván lấy thứ tự Room Members hiện tại. Phép xoay chỉ tạo bản
  sao hiển thị và dùng chung cho animation; không đổi thứ tự lượt/server state.
- Sau 30 phút không có hoạt động, người chơi khác không còn nút vào lại; chủ phòng hiện tại có nút tạo lại cùng phòng và mã. Room được giữ nguyên, ghế/lease cũ được dọn và thành viên đã tham gia trước đó có thể vào lại sau khi chủ mở phòng. Worker không tự xóa phòng khi hết hạn; phòng chỉ bị xóa khi chủ phòng hiện tại chủ động xóa sau khi ván đã kết thúc. Việc xóa phòng không xóa bảng điểm chung hoặc lịch sử thay đổi; chủ phòng cuối cùng vẫn quản lý bảng điểm đó.
- Hết lease của ghế không đóng hoặc xóa phòng. Rời khi đang chơi vẫn xử lý bỏ cuộc theo luật; rời sảnh không xóa phòng trống. Xóa bàn điểm online khỏi lịch sử vẫn là thao tác riêng, ghi nhớ theo tài khoản để snapshot cũ không tạo lại chính bàn điểm đó.
- Xóa tài khoản phải xóa định danh trong `scoreMembers` và không trao quyền chủ phòng cho người khác ngoài thao tác chuyển quyền đã commit. Nếu tài khoản còn trong thành viên/tay bài hiện tại, xử lý đóng phòng như chính sách xóa tài khoản hiện có; nếu tài khoản chỉ còn trong lịch sử điểm, xóa định danh lịch sử và giữ ván hiện tại của người khác. Đồng thời xóa bảng điểm chung/audit/receipt có liên quan đến tài khoản; các cập nhật phòng sau đó chỉ có thể tạo bảng mới từ dữ liệu phòng đã được làm sạch.

## Cập nhật 20/10 — tự động chơi ván tiếp

Quy định này thay cho phần mô tả trước về chủ phòng bấm bắt đầu ván tiếp. Sau kết quả, tất cả thành viên hiện tại, bao gồm chủ phòng, có nút Sẵn sàng. Server chỉ bắt đầu lại khi phòng còn ít nhất hai thành viên và tất cả đều đã sẵn sàng; action ready cuối cùng được commit như bắt đầu một match mới để cấp matchId, áp dụng gate mở ván và lưu kết quả nếu ván mới kết thúc ngay. Bỏ sẵn sàng trước khi đủ người sẽ hủy điều kiện. Người vào thêm bắt đầu với ready=false và giữ nguyên ready của người đã chờ; khi có người rời phòng, reset readiness như trước. Nút bắt đầu ván mới không còn trên bàn kết quả; ván đầu cũng dùng trạng thái sẵn sàng của mọi thành viên và server tự bắt đầu khi đủ điều kiện.

Sau kết quả, giữa bàn hiển thị chồng bài úp tượng trưng sau khi các lá cuối được thu dọn. Không hiển thị bảng xếp hạng giữa bàn; điểm cộng/trừ và ready status hiển thị ở từng ghế. Match mới chỉ xuất hiện sau snapshot server xác nhận.

## UI và vòng đời animation — 21/10/2026

- Chia bài là sự kiện một lần: tự kết thúc theo timeline; xoay màn hình, vào nền hoặc nước đánh đầu sẽ settle hand hiện tại. Không replay khi reconnect/đổi layout. Anchor ghế/hand/bộ đang đánh dùng cùng tọa độ cửa sổ; callback đo thuộc viewport cũ bị bỏ.
- Đồng hồ của đối thủ ở dưới avatar; của bản thân nằm giữa thông tin hand và xếp bài. Deadline và serverTime là nguồn thời gian; tick cũ không được kéo dài lượt. Màu tăng dần mức khẩn cấp và pulse nhẹ ở 5 giây cuối; hết hạn khóa action và chờ server. Không dựng vòng tiến trình hay countdown ván mới với thời lượng giả khi protocol chưa có cấu hình.
- Khi nhận kết quả trực tiếp từ ván đang chơi, giữ bộ cuối 500ms, thu trong 380ms. Overlay bài cũ không tương tác, giữ cách xếp hiện tại và không can thiệp state server. HandArea giữ chiều cao, ready fade-in ở giữa; nút chưa lộ ra không nhận chạm. Rematch mới hủy callback/overlay ván cũ.
- Mỗi ghế hiển thị số dư; người thắng được đánh dấu bằng vương miện trên avatar, không có nhãn Thắng/Thua hay huy hiệu ready bên dưới avatar. Dòng tổng sẵn sàng vẫn phản ánh trạng thái phòng. Fireworks khoảng 1.9 giây gắn room/match/UID và chỉ chạy một lần; ván mới cùng người thắng vẫn chạy. Reconnect với kết quả cũ hiển thị số dư cuối và phần trang trí đã ổn định, không cộng lại hoặc replay.
- Hand đo bề rộng ở cả hai hướng, dùng kích thước compact nếu cần cho 13 lá; góc số/chất và thứ tự z-index giữ ổn định. Hand đã được server xác nhận thay đổi có layout transition; selection hạ ngay khi bấm bỏ lượt, bài thật chỉ đổi sau xác nhận.
- Màn dọc và ngang dùng chung dòng thông tin gọn `Bài N · Dư [số dư]`, đồng hồ lượt ở giữa và nút `Xếp chất/số` bên phải; không tách số dư thành dòng riêng. Vùng bài dọc giảm khoảng trống và giữ cùng chiều cao tối thiểu khi chuyển sang chờ ván mới; không đổi kích thước chọn/chạm lá hoặc cách tính số dư.
- Không thêm sound/haptic hoặc dependency khi repo chưa có asset và cấu hình âm thanh game.

Kiểm chứng và giới hạn native được ghi tại `tasks/card-table-motion-plan-2026-10-21.md`.

## Quản lý thành viên phòng (22/10/2026)

- Tối đa 4 người. Client chặn khi biết chắc phòng đã đầy; Edge và SQL kiểm tra
  độc lập dưới khóa phòng, kể cả hai yêu cầu vào đồng thời. Người mới thứ 5 nhận
  “Phòng đã đủ người chơi, vui lòng chọn phòng khác.” Người đã có ghế được nối lại
  mà không thêm ghế, không đổi version hay chiếm controller của thiết bị khác.
- Chạm avatar/tên trong phòng mở thông tin công khai sẵn có: tên, ảnh, vai trò,
  sẵn sàng, số ván thắng và số dư bàn. Nội dung popup cuộn trên màn hình thấp.
- Tiến lên và Phỏm dùng chung mục “Chuyển chủ phòng” trong menu mã phòng. Chỉ
  hiện cho chủ phòng khi có người khác đang ngồi; khóa khi chưa có snapshot mới,
  đang nối lại/chờ thao tác hoặc thiết bị không điều khiển phiên. Lựa chọn người
  nhận chỉ dùng một lần và bị hủy khi đổi tài khoản/phiên/phòng/ván, quyền, danh
  sách thành viên hoặc mất khả năng thao tác, kể cả khi sau đó đã kết nối lại.
  Trước khi gửi, kiểm tra lại chủ phòng và người nhận còn trong phòng hiện tại.
- Chỉ chủ phòng hiện tại, đang điều khiển phiên, thấy “Kích người chơi” cho người
  khác. Xác nhận lại trước khi gửi; server kiểm tra quyền, phiên, version và match.
  `ownerUid: null` nghĩa là không có chủ phòng; chỉ dữ liệu cũ thiếu thuộc tính này
  mới fallback host.
- Kích giữa ván áp dụng luật bỏ cuộc hiện có, giữ người tham gia trong dữ liệu
  tính điểm. Ghế/thành viên bị xóa, readiness còn lại reset và epoch đổi để các máy
  đọc lại danh sách. Người bị kích nhận “Bạn đã bị chủ phòng mời ra khỏi phòng.”
  kèm sự kiện ổn định theo UID/phiên, không bị mất thông báo do lần đọc bootstrap.
- Client dọn cache/route/pending và chặn phản hồi cũ sau khi bị kích. Retry của
  lệnh nối lại đã commit không tự thêm người vừa bị kích; người dùng vẫn được chủ
  động vào lại sau đó nếu phòng cho phép. Không thêm lệnh cấm vào lại lâu dài.
- Khung đối thủ portrait mở rộng theo chiều ngang màn hình, tên tối đa hai dòng,
  readiness một dòng; avatar và thông tin được xếp để tránh ép chữ xuống từng ký tự.

### Luật Tiến lên cho ván tiếp theo

Menu phòng cho chủ phòng sửa luật ván tới, tách khỏi luật ván hiện tại. Mọi
thành viên xem được cả hai. Chỉ lúc chia match mới mới áp dụng; sảnh/kết quả
phải sẵn sàng lại sau mỗi lần lưu. Không đổi điểm lịch sử. Protocol5 và RPC
service-only có owner/controller/session/CAS/receipt, trigger bảo vệ việc
chuyển luật; xem SPEC-rules-tien-len-south.md.

### Luật Phỏm cho ván tiếp theo

Chủ phòng sửa10 mức điểm từ menu phòng, cùng dialog với Tiến lên; luật đang
chơi và ván tới hiển thị riêng. PendingPhỏm cần protocol6; chỉ promote lúc
chia match mới và yêu cầu ready lại sau lưu ở sảnh. Luồng South giữ floor5.
