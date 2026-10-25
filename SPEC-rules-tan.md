# Tấn — luật LifeMate dự kiến

Trạng thái: người dùng chọn profile đề xuất `tan-v1` (25/10/2026) theo kiểu Tấn
Việt Nam 8 lá, attack/defend, không đồng nhất mọi chi tiết với Durak. Đây là
game theo vòng tấn công-phòng thủ, khác hẳn các game leo bài.

## Luật nền đề xuất

- Bộ 52 lá, 2–4 người, chia 8 lá mỗi người. Lật một lá để xác định chất chủ;
  lá ngửa vẫn thuộc nọc và được rút cuối. Người tấn mở lượt; người phòng thủ kế
  tiếp theo chiều bàn.
- Hạng 2 < … < A. Một lá bị đỡ bởi lá cùng chất cao hơn hoặc lá chủ; lá chủ chỉ
  bị lá chủ cao hơn đỡ.
- Người tấn đánh một lá; những người chơi còn lại trừ người đỡ có thể thêm lá
  mang một trong các hạng đã xuất hiện. Người đỡ phải đỡ từng lá tấn bằng một
  lá riêng, hoặc nhận toàn bộ lá trên bàn. Tổng số lá tấn tối đa là 8 và không
  vượt quá số lá người đỡ có trước lượt.
- Đỡ hết: bỏ các lá trên bàn, người đỡ trở thành người tấn tiếp theo. Nhận bài:
  người đỡ lấy cả lá tấn lẫn lá đỡ vào tay; người kế tiếp theo chiều bàn mở lượt.
- Sau lượt, những người còn nọc rút lên tối đa 8 lá theo thứ tự tấn trước, đỡ
  sau; chất chủ lật được rút cuối. Khi nọc hết, tiếp tục đến khi người chơi hết
  bài; người cuối còn bài là người thua. Người hết bài rời khỏi vòng tấn/đỡ.
- Người hết bài rời khỏi lượt; khi nọc hết, người cuối còn bài là người thua.
  Nếu bằng cách kết thúc ván không còn ai giữ bài thì kết quả hòa.
- Điểm zero-sum nội bộ: `C` là số lá người cuối còn; `R` là tổng số người kết
  thúc tự nhiên, tính cả người cuối và không tính người bỏ cuộc. Người cuối mất
  `C × (R-1) × pointsPerCard`; mỗi người về trước nhận `C × pointsPerCard`.
  Ví dụ bàn 4 người, người thua còn 5 lá, mức 1: `R=4`, người thua mất
  `5 × (4-1) × 1 = 15` điểm; mỗi người về trước nhận 5 điểm. Bỏ cuộc không vào
  phép tính; tất cả hết bài thì hòa và không có điểm. Không có phí nhận bài
  riêng, vì bài nhặt chỉ được tính nếu còn trên tay lúc kết thúc.

## Cấu hình phòng

- Chủ phòng chọn điểm mỗi lá người thua còn khi tạo phòng; mặc định 1 điểm,
  giới hạn số nguyên 1–1.000.000.000. Đây là điểm nội bộ, không phải tiền cược.
- Chủ phòng có thể sửa điểm cho ván tới. Ván đang chơi giữ nguyên mức đã ghim;
  mức mới chỉ được áp dụng khi bắt đầu ván tiếp theo. Lưu khi ở sảnh yêu cầu
  mọi người sẵn sàng lại.
- Phòng Tấn cũ chưa có cấu hình dùng 1 điểm/lá cho ván tương lai; kết quả đã
  lưu không được tính lại. Chính sách bỏ ván vẫn giữ nguyên.

## Biến thể chưa thuộc profile v1

- Deck 36/52 lá, 6/8 lá chia, chiều đánh, ai là người đầu.
- Chỉ người tấn chính được thêm bài hay mọi người ngoài người đỡ; profile v1
  chọn mọi người được thêm bài.
- `Chuyển tấn` bằng lá cùng hạng; profile v1 tắt chuyển tấn.
- Thứ tự bốc lại, lá chủ cuối nọc, xử lý khi một người hết bài giữa lượt/cuối nọc,
  điều kiện hòa/không có người thua.
- Điểm kết quả cho người thoát sớm, người còn cuối và các ván nhiều người.

## Nguồn và giới hạn

- [Bài Tấn — luật, chất chủ và cách tấn/đỡ (nguồn thứ cấp tiếng Việt)](https://gamebaidoithuonguytin.net/bai-tan-2/): mô tả tấn, đỡ, ôm và lá chủ; không dùng các nội dung cược.
- [Pagat — Podkidnoy Durak](https://www.pagat.com/beating/podkidnoy_durak.html): nguồn quy tắc chi tiết cho một game họ hàng; đỡ cùng chất cao hơn/chủ, thả thêm hạng đang có, giới hạn đòn, nhặt cả bàn, rút bù và nhiều biến thể. Tấn Việt Nam không mặc định kế thừa toàn bộ.
- [Durak app — luật tấn/đỡ và chuyển tấn](https://www.durak.app/en/rules/): đối chiếu khác biệt giữa throw-in và transfer; đây không phải nguồn chuẩn hoá luật Việt Nam.

## Tiêu chí chấp nhận engine

- State machine biểu diễn riêng phase tấn, đỡ, xác nhận lượt, nhặt bài, bốc bù,
  hết nọc và kết thúc; mọi action có kiểm tra quyền/lượt và giới hạn lá.
- Server là nguồn sự thật cho nọc, chất chủ, bài người chơi, nước tấn/đỡ và kết
  quả. Snapshot chỉ chứa tay người xem cùng số lượng bài công khai.
- Bao phủ đỡ hợp lệ/sai, nhận bài, nhiều người tấn (nếu profile bật), chuyển tấn
  (nếu profile bật), rút bù qua lá chủ cuối, timeout/disconnect và điểm zero-sum.
