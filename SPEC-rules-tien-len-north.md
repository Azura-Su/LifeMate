# Tiến lên miền Bắc — profile luật và điểm LifeMate

Trạng thái: `north-v2` là profile tạo phòng mới. Phòng `north-v1` cũ giữ nguyên
đến khi chủ phòng chủ động lưu luật v2 cho ván tới. Đây là game riêng, không
dùng luật/engine miền Nam chỉ bằng cách đổi nhãn. Phòng cũ không có `gameKind`
vẫn giữ luật miền Nam.

## Luật nền đề xuất

- Dùng bộ 52 lá, 2–4 người, mỗi người 13 lá. Ở ván đầu, người có 3♠ đi trước
  và nước đầu phải chứa lá đó. Nếu lá nhỏ nhất không được chia trong bàn ít hơn
  bốn người, dùng lá nhỏ nhất đã chia làm lá mở ván. Các ván sau người về nhất
  ván trước mở.
- Thứ tự hạng 3 < 4 < … < A < 2. Khi cần phá hòa cùng hạng, thứ tự chất là
  ♠ < ♣ < ♦ < ♥. Ghế đánh theo chiều hiện tại của bàn LifeMate.
- Bộ hợp lệ: lá lẻ; đôi cùng hạng, cùng màu; bộ ba cùng hạng; tứ quý; sảnh từ
  3 lá liên tiếp cùng chất. Đề xuất không cho 2 vào sảnh và không vòng A–2.
- Chặn bằng cùng loại và cùng số lá. Lá lẻ thường phải cùng chất và cao hơn;
  riêng lá 2 cao hơn mọi hạng thường, và hai lá 2 so theo chất ♠ < ♣ < ♦ < ♥.
  Đôi cùng màu và cao hơn; sảnh cùng chất, cùng chiều dài, có lá cao nhất lớn
  hơn. Bộ ba cao hơn theo hạng. Tứ quý chặt một lá 2 và tứ quý hạng thấp hơn;
  không chặt đôi 2.
- Người bỏ lượt ở một vòng không tham gia lại đến khi vòng được dọn. Khi vòng
  được dọn, người đánh cuối cùng còn trong ván mở vòng mới; nếu người đó đã hết
  bài hoặc bỏ ván, lượt mở chuyển đến người còn hoạt động kế tiếp theo chiều bàn
  tính từ ghế của người đánh cuối. Phòng tiếp tục xếp hạng đến khi còn một
  người; đầu tiên hết bài là hạng nhất.
- `north-v1` cũ: mỗi lá còn trên tay bị trừ theo điểm/lá; người nhất nhận tổng
  điểm bị trừ. Không tự tính lại lịch sử.
- `north-v2` mới: mỗi lá còn bị trừ theo `pointsPerCard`; mỗi lá 2 còn lại cộng
  thêm `remainingTwoPoints` điểm tuyệt đối (không nhân theo điểm/lá). Ví dụ
  điểm/lá 5 và điểm cộng lá 2 là 2 thì một lá 2 còn tính 7 điểm. Tứ quý chặt
  một lá 2 chuyển `cutTwoPoints` từ người đánh lá 2 sang người chặt. Mỗi lần
  chặt một lá 2 chỉ tạo một khoản; chặt tứ quý bằng tứ quý cao hơn vẫn hợp lệ
  nhưng không tạo thêm phí chặt. Không có đôi thông, thối tứ quý, hoặc khoản
  cược/phạt khác. Toàn bộ điểm là điểm nội bộ, tổng ván phải bằng 0.

## Cấu hình phòng

- Phòng mới mặc định `pointsPerCard=1`, `remainingTwoPoints=2`,
  `cutTwoPoints=3`. Điểm/lá từ 1 đến 1.000.000.000; điểm cộng/phạt từ 0 đến
  1.000.000.000. Đây là điểm nội bộ, không phải tiền cược.
- Chủ phòng có thể sửa điểm cho ván tới. Ván đang chơi giữ nguyên mức đã ghim;
  mức mới chỉ được áp dụng khi bắt đầu ván tiếp theo. Lưu khi ở sảnh yêu cầu
  mọi người sẵn sàng lại.
- Phòng miền Bắc cũ có cấu hình v1 giữ nguyên điểm/lá và luật đã ghim. Chủ
  phòng lưu luật v2 thì chỉ ván tiếp theo chuyển profile; kết quả đã lưu không
  được tính lại.

## Biến thể chưa thuộc profile v1

- Có nguồn yêu cầu cùng chất khi chặn bài lẻ và đôi cùng màu; có nguồn chỉ nói
  cùng loại/cao hơn. Bộ ba không có chất đơn nhất; cần chốt tie-break nếu có
  nguồn/bàn luật khác. Trường hợp 2 khác chất là ngoại lệ đề xuất dựa trên
  nguồn mô tả riêng thứ tự chất của 2.
- Một số bàn cho sảnh chứa 2, sảnh dài chặt 2, đôi thông, tới trắng, cấm về 2 /
  tứ quý hoặc phạt thối; không đưa vào profile mặc định. Luật chặt hợp lệ vẫn
  tách biệt với khoản điểm chặt chỉ có ở v2.
- Chiều đánh và người mở ván ở bàn ít hơn bốn người không hoàn toàn thống nhất;
  v1 giữ thứ tự ghế/chiều đánh hiện hành của LifeMate.

## Nguồn

- [GameVH — Hướng dẫn Tiến lên miền Bắc](https://gamevh.net/cms/static/guide_3.jsp): 13 lá, 2–4 người, đôi cùng màu, sảnh cùng chất, thứ tự 2 và chất của 2, 3♠/lá nhỏ nhất mở, tứ quý chặt 2. Các mức cược trên trang không được dùng.
- [Saigoneer — các kiểu chơi bài Tây ở Việt Nam](https://saigoneer.com/vn/vietnam-culture/17182-m%E1%BB%99t-s%E1%BB%91-ki%E1%BB%83u-ch%C6%A1i-b%C3%A0i-t%C3%A2y-th%E1%BB%91ng-l%C4%A9nh-%27ng%C3%A0y-m%C3%B9ng%27-mi%E1%BB%81n-b%E1%BA%AFc-nam-cho-ng%C6%B0%E1%BB%9Di-m%E1%BB%9Bi-nh%E1%BA%ADp-m%C3%B4n): nhấn mạnh miền Bắc so cùng chất/cùng màu; bài lẻ theo cùng chất.
- [Pagat — Tiến Lên](https://www.pagat.com/climbing/thirteen.html): đối chiếu vòng chơi, bộ, sảnh, lá 3♠, cách chơi tiếp tục xếp hạng và ghi nhận nhiều biến thể; mô tả chung này không thay thế luật riêng miền Bắc.

## Tiêu chí chấp nhận engine

- Bộ bài/hạng/chất và classifier từ chối bài trùng, sảnh sai chất, đôi khác màu,
  sảnh có 2, hoặc tổ hợp sai độ dài.
- Máy chủ xác thực mở ván, đúng lượt, bài thuộc tay, bỏ lượt, vòng mới, chặt 2,
  rời/kích giữa ván, timeout và kết thúc; action sai không làm đổi state.
- Snapshot không lộ tay đối thủ, nọc, hay dữ liệu suy ra được; kết quả/điểm zero-sum
  chống ghi lặp theo `matchId`.
- Mỗi trường hợp biến thể được lưu thành `rulesVersion`/cấu hình bất biến của ván;
  không đọc cấu hình từ client khi tính nước đánh.
