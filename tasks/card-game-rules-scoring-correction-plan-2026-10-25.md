# Kế hoạch rà và sửa luật / tính điểm North, Sâm, Tấn

Trạng thái: hoàn tất triển khai và rà soát. Phạm vi là sửa profile luật và
điểm của ba game variant đã có; không thay luật miền Nam/Phỏm, bảng điểm thủ
công, hay triển khai production.

## Hiện trạng đã xác minh

- **Tiến lên miền Bắc:** engine đã coi 2 cao hơn lá thường, so 2 theo chất và
  cho tứ quý chặt một lá 2. Nhưng event chặt không được lưu vào kết quả nên
  không có khoản điểm chuyển giữa người bị chặt và người chặt. Điểm hiện chỉ là
  số lá còn × `pointsPerCard`; 2 còn lại không có khoản thối riêng.
- **Sâm:** engine có vòng báo Sâm và ghi `samOutcome`, nhưng settlement bỏ qua kết
  quả báo Sâm. Báo thành công/thất bại hiện không tạo khoản điểm; tứ quý chưa
  chặt 2. `reported` là trạng thái báo Sâm, không phải báo một.
- **Tấn:** không có quy ước điểm thống nhất trong các luật được đối chiếu; engine
  dùng bảng điểm nội bộ: `R` là tổng số người tự nhiên kết thúc, tính cả người
  cuối; người bỏ cuộc không nằm trong `R`. Nếu người cuối giữ `C` lá, người đó
  mất `C × (R - 1) × điểm/lá`, mỗi người về trước nhận `C × điểm/lá`. Bài nhặt
  khi đỡ hụt chỉ bị tính một lần nếu còn trên tay lúc kết thúc; không có khoản
  cộng riêng cho từng lần nhặt. Forfeit hiện nhận 0 và không tham gia chia điểm.
- Tài liệu nguồn cho biết Tiến lên miền Bắc có tứ quý chặt 2 và có khoản chặt /
  thối, nhưng mức quy đổi khác nhau giữa bàn; Sâm cũng có báo Sâm, chặn 2 và
  cách đền thay đổi theo phiên bản. Tấn tập trung vào thoát bài, không có bảng
  điểm truyền thống thống nhất. Vì vậy các con số LifeMate dưới đây là điểm nội
  bộ do phòng chọn, không phải tiền cược hoặc tuyên bố một bảng luật duy nhất.

## Profile đề xuất để triển khai

1. **North:** giữ luật đang có: 2 cao nhất; tứ quý chặt một lá 2; tứ quý cao
   hơn vẫn chặn được tứ quý thấp hơn theo luật cùng loại hiện tại. Điểm nền là
   một mức cho mỗi lá còn. Thêm hai khoản tuyệt đối tính bằng điểm:
   `remainingTwoPoints` mặc định 2 điểm cho mỗi 2 còn (cộng thêm điểm lá
   thường; ví dụ rate 5 + khoản 2 = 7 điểm cho một lá 2) và `cutTwoPoints` mặc
   định 3 điểm chuyển từ chủ lá 2 sang người dùng tứ quý. Chỉ lần tứ quý đầu
   tiên chặt một lá 2 sinh khoản chuyển; nếu tứ quý đó bị chặn bằng tứ quý cao
   hơn, khoản đã phát sinh vẫn giữ nguyên, không phát sinh thêm khoản chặt 2.
   Hai mức tuyệt đối này hiển thị rõ và chủ phòng sửa được. Không áp thối tứ
   quý/đôi thông hoặc chặt đôi 2 trong profile này.
2. **Sâm:** giữ 10 lá, không so chất, báo Sâm theo thứ tự ghế. Profile mới cho
   tứ quý chặt một lá 2; profile legacy giữ nguyên luật v1. Mỗi lá còn tính theo
   điểm/lá. Báo Sâm thành công: người báo nhận `20` điểm từ từng người còn
   trong roster đã chốt lúc báo; không cộng thêm điểm lá cho kết quả thành công.
   Báo thất bại: người báo trả `20` điểm cho cùng roster và ván vẫn tiếp tục
   tính điểm thường. Rời bàn sau khi đã phát sinh kết quả báo không xóa khoản
   đã phát sinh. Nếu người báo rời bàn hoặc ván bị hủy khi lời báo còn pending,
   không tính phí báo. Mức `20` là điểm nội bộ mặc định, chủ phòng chỉnh được.
   Báo một chỉ là thông báo/nhãn, không ép đánh lá lớn nhất và không phạt riêng
   trong profile này. Không thêm thối tứ quý, cóng hoặc các khoản đặc biệt khác.
3. **Tấn:** giữ công thức zero-sum hiện tại và cho chủ phòng chỉnh điểm/lá.
   UI luật và kết quả giải thích rõ công thức trên, kèm ví dụ 4 người: người
   thua còn 5 lá ở mức 1 điểm/lá thì mất 15 điểm; mỗi người thoát trước nhận
   5 điểm. Bài nhặt đã nằm trong số lá cuối tay, không bị tính lần hai.

Các mức mặc định North/Sâm là profile đề xuất của LifeMate, không phải chuẩn
chung. Giá trị được ghim theo từng ván; thay đổi trong phòng chỉ áp dụng từ ván
kế tiếp.

## Hợp đồng dữ liệu và tính điểm

- Mở rộng config theo game: North gồm `pointsPerCard`, `remainingTwoPoints`,
  `cutTwoPoints`; Sâm gồm `pointsPerCard`, `samCallPoints`; Tấn giữ
  `pointsPerCard`. Validator client, Edge, SQL và snapshot phải cùng chặn key
  thừa, thiếu field, số âm, số thập phân và vượt giới hạn an toàn.
- Kết quả lưu breakdown có loại khoản, số điểm có dấu và đối thủ liên quan;
  tổng các delta mỗi ván phải bằng 0. Giới hạn mọi phép nhân/tổng trong safe
  integer.
- Engine ghi sự kiện chặt 2 server-side; không lấy số điểm hoặc recipient từ
  request của client. Kết quả báo Sâm lấy từ state authoritative (`samOutcome`,
  người báo và roster đã đóng băng khi báo), không nhận từ client.
- Settlement North: người nhất nhận khoản lá còn và khoản 2 còn; khoản chặt là
  chuyển riêng giữa đúng hai người. Settlement Sâm: thành công chỉ tính khoản
  báo, không cộng khoản lá còn; thất bại tính khoản báo rồi ván vẫn quyết toán
  theo số lá. Roster của khoản báo bị đóng băng lúc báo; pending bị hủy khi
  caller rời hoặc match bị hủy thì không thu phí. Cả hai giữ zero-sum và replay
  idempotently.
- Định danh profile engine v1/v2 trong config và match. Không tự nâng luật hoặc
  bật khoản điểm mới cho room v1 đã tạo; active match v1 giữ nguyên đến khi
  kết thúc, lịch sử không tính lại. Room cũ chỉ lên v2 khi chủ phòng lưu profile
  mới; config đang chơi được ghim, config v2 chỉ promote ở ván mới.
- Nâng protocol/capability để client cũ không thể vào room có config/breakdown
  schema v2. Room v1 tiếp tục dùng payload/capability cũ.

## Task list và checkpoint

### Phase 1 — hợp đồng, UI và luật được công bố

- [x] Cập nhật SPEC North/Sâm/Tấn, ghi rõ điểm nào là luật có căn cứ, điểm nào
  là profile nội bộ LifeMate và các biến thể không thuộc profile.
- [x] Thêm config discriminator/validator/defaults có profile version và migration
  schema/capability theo game; đọc config cũ mà không đổi luật hoặc active match,
  và từ chối client cũ trước mutation.
- [x] Cập nhật form tạo phòng và dialog luật trong phòng: hiện số điểm thực tế,
  người trả/người nhận và ví dụ Tấn; chỉ chủ phòng sửa config ván tới.

### Checkpoint 1

- [x] Config create/join/snapshot/reconnect/rematch đồng nhất; migration tests,
  parser tests và UI tests xác nhận mặc định/biên/field lạ. Room v1 vẫn chạy và
  rematch theo v1 đến khi chủ phòng chủ động lưu v2.

### Phase 2 — luật đặc biệt và settlement server

- [x] North lưu event tứ quý chặt 2; settlement cộng thối 2 và chuyển chặt 2
  đúng người. Tứ quý cao chặn tứ quý thấp hợp lệ nhưng không tạo thêm khoản
  chặt 2; không chặt đôi 2 hoặc chặt chồng.
- [x] Sâm v2 cho tứ quý chặt đơn 2; settlement xử lý báo Sâm thành công/thất
  bại với roster đóng băng; báo thành công không cộng điểm lá, báo thất bại
  tiếp tục tính điểm thường; caller rời/pending cancellation không tính phí;
  báo một không sinh phí.
- [x] Tấn giữ công thức hiện tại; hiển thị breakdown để chứng minh nhặt bài không
  tính trùng và forfeit không chia điểm.
- [x] Kiểm thử zero-sum, kết quả nhiều người/forfeit/cancel, giới hạn số học,
  retry idempotent, rematch và room cũ.

### Checkpoint 2

- [x] Typecheck, lint, tests engine + room/SQL + UI; reviewer độc lập không còn
  finding. Không deploy migration/Edge trong task này.

## Reviewer pre-implementation findings

- [x] Legacy room behavior must remain v1 until owner explicitly saves the v2
  profile; active matches and saved history are immutable.
- [x] Freeze Sâm fee recipients when Sâm is declared; no fee while pending if
  caller leaves or room cancels; once outcome is recorded, later departure does
  not erase the fee.
- [x] Define `remainingTwoPoints` as additive absolute points, and distinguish
  legal quad-over-quad play from the one-time fee generated only by quad over a
  single 2.

## Findings fixed during final review

- [x] Auto-start and rematch now pass the pinned variant profile to the engine;
  HTTP regressions cover the final-ready start and first move for North/Sâm v2.
- [x] SQL kind guard accepts only the engine profile selected by the current
  room config; SQL rejects missing v2 fields before persisting a room.
- [x] SQL room-status, takeover and rules edits honor the maximum capability
  required by both current and pending profiles, so v2 cannot be masked by a
  legacy next-round profile.
- [x] Client Sâm v2 selection agrees with the server on quad-over-single-2.
- [x] Finished North/Sâm breakdowns render in the active table; Tấn result text
  states the exact C/R formula, excludes forfeits, and explains picked-up cards.

## Rủi ro và cách giảm

| Rủi ro | Tác động | Giảm thiểu |
|---|---|---|
| Luật điểm khác nhau theo bàn | Người chơi bất ngờ vì mức phạt | Hiện mức và ví dụ trước khi vào ván; chủ phòng cấu hình; lưu bất biến theo ván |
| Tổng điểm vượt safe integer | Sai balance/lịch sử | Giới hạn field, tính và kiểm tra tổng server-side trước khi commit |
| Client cũ parse strict schema cũ | Mất snapshot hoặc thao tác trên config lạ | Tăng capability và chặn trước mutation; giữ fallback cho room legacy |
| Room cũ bị tính lại theo luật mới | Sai lịch sử | Chỉ dùng default cho ván mới; không migrate result/balance lịch sử |
| Config được sửa đồng thời với ready cuối | Ván bắt đầu với profile cũ | Tái dùng CAS/transition guard hiện tại; kiểm thử cạnh tranh |

## Nguồn và giới hạn

- [GameVH — hướng dẫn Tiến lên miền Bắc](https://gamevh.net/cms/static/guide_3.jsp):
  2 cao nhất; tứ quý chặt 2; có phí chặt/thối theo bảng riêng của nguồn.
- [Viet Game Index — Sâm Lốc](https://vietgameindex.com/tro-choi/sam-loc/):
  10 lá, báo Sâm/báo một/chặn 2; mức phạt thay đổi theo phiên bản, không có một
  bảng điểm chung.
- [Bài Tấn — hướng dẫn luật cơ bản](https://www.jessieevans.net/luat-choi-bai-tan/):
  game tập trung vào tấn/đỡ và người giữ bài cuối thua; không có quy ước điểm
  truyền thống phổ quát.
- Một số nguồn Sâm khác nhau về số tiền báo Sâm; LifeMate dùng `20` **điểm nội
  bộ** làm mặc định phòng đề xuất, không lấy số cược từ các trang đó.
