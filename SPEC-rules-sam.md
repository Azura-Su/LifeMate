# Sâm Lốc — profile luật và điểm LifeMate

Trạng thái: `sam-v2` là profile tạo phòng mới. Phòng `sam-v1` cũ giữ nguyên đến
khi chủ phòng chủ động lưu luật v2 cho ván tới. Nguồn công khai xác nhận luật
nền nhưng không có một bảng điểm thống nhất. Sâm là engine riêng, không phải
Tiến lên với 10 lá.

## Luật nền đề xuất

- Bộ 52 lá, 2–4 người, chia 10 lá mỗi người. Hạng 3 < … < A < 2; chất không
  phá hòa. Người đầu được chọn theo luật phòng/ván trước; mặc định ván đầu người
  có 3♠ đi trước nếu lá này nằm trong số bài được chia, nếu không chọn lá thấp
  nhất.
- Bộ hợp lệ: lẻ, đôi, sám, tứ quý, sảnh từ 3 lá liên tiếp. Chặn cùng loại và
  cùng số lá bằng bộ cao hơn. Không cho 2 nối sảnh. Trong v2, tứ quý chặt một
  lá 2; không chặt đôi 2. v1 cũ giữ comparator đã lưu.
- Sau khi chia, mỗi người theo thứ tự ghế kể từ người mở ván có thể báo Sâm hoặc
  bỏ qua. Báo đầu tiên được nhận; người báo trở thành người đánh đầu. Nếu tất cả
  bỏ qua thì người mở ván đánh. Khi nước hợp lệ của đối thủ chặn được một nước
  của người báo, ghi Sâm thất bại; nếu người báo hết bài trước khi bị chặn, ghi
  Sâm thành công và kết thúc ván.
- `Báo một` hiển thị khi người chơi còn một lá; không bắt buộc đối thủ phải
  đánh lá lớn nhất và không phát sinh phạt riêng.
- `sam-v1` cũ chỉ tính điểm/lá như đã lưu, không phát sinh điểm báo Sâm. Không
  tự tính lại lịch sử.
- `sam-v2`: báo Sâm thành công nhận `samCallPoints` từ từng người trong roster
  đã chốt lúc báo; không cộng thêm điểm bài còn cho kết quả thành công. Báo
  thất bại trả cùng mức điểm cho từng người trong roster, sau đó vẫn tính điểm
  bài còn theo `pointsPerCard`. Nếu người báo rời bàn khi lời báo còn chờ hoặc
  ván bị hủy, báo bị hủy và không phát sinh điểm báo. Khi kết quả báo đã được
  xác định thì người rời bàn sau đó vẫn chịu/nhận khoản đã phát sinh. Toàn bộ
  điểm là điểm nội bộ, tổng ván bằng 0; không dùng mức cược từ ứng dụng cá cược.
- Báo Sâm chỉ nhận ở giai đoạn khai báo trước nước bài đầu tiên. Nếu bị chặn,
  ghi Sâm thất bại nhưng ván và điểm cơ bản tiếp tục. Thứ tự ghế xử lý trường
  hợp nhiều người muốn báo để không phụ thuộc race/network timing.

## Cấu hình phòng

- Phòng mới mặc định `pointsPerCard=1`, `samCallPoints=20`. Điểm/lá từ 1 đến
  1.000.000.000; điểm báo từ 0 đến 1.000.000.000. Đây là điểm nội bộ, không
  phải tiền cược.
- Chủ phòng có thể sửa điểm cho ván tới. Ván đang chơi giữ nguyên mức đã ghim;
  mức mới chỉ được áp dụng khi bắt đầu ván tiếp theo. Lưu khi ở sảnh yêu cầu
  mọi người sẵn sàng lại.
- Phòng Sâm cũ giữ profile v1 cho tới khi chủ phòng chủ động lưu profile v2 cho
  ván tới. Kết quả đã lưu không được tính lại.

## Biến thể chưa thuộc profile v1

- A thấp trong sảnh, 2 trong sảnh, sảnh 2-A-3, chặn đôi 2 bằng tứ quý, cho về
  bằng 2, phạt thối 2/tứ quý/cóng.
- Chất trong sảnh không dùng để so; profile v1 chỉ so hạng và không cho 2 vào
  sảnh.

## Nguồn

- [Viet Game Index — Sâm Lốc](https://vietgameindex.com/tro-choi/sam-loc/): tổng hợp 10 lá, không so chất, các bộ cơ bản và xác nhận báo Sâm/báo một/chặn 2/đền thay đổi theo bàn; bài không xem một mức phạt là phổ quát.
- [Pagat — Tiến Lên](https://www.pagat.com/climbing/thirteen.html): chỉ dùng để đối chiếu họ game climbing và cách so bộ, không coi luật miền Nam là luật Sâm.

## Tiêu chí chấp nhận engine

- Tách lượt gọi Sâm khỏi nước đánh; lưu trạng thái gọi/đã bị chặn trong state
  authoritative và kết quả hiển thị đúng cho từng thành viên.
- Bao phủ chơi thường, người gọi hết bài thành công/thất bại, bỏ lượt, báo một,
  timeout, disconnect/kick, kết thúc và tính điểm zero-sum.
- Không cho client sửa kết quả lời gọi Sâm, bài đối thủ, hay số dư.
