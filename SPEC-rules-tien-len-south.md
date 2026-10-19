# Luật Tiến lên miền Nam — south-v1

Đây là bộ luật LifeMate cố định, hiển thị trước khi sẵn sàng. Bản đầu dùng thứ hạng và số ván thắng, không quy đổi tiền hoặc điểm phạt. Một ván pin rulesVersion; không thay luật giữa ván.

## Bộ lá và lượt

- 52 lá, rank 3–10/J/Q/K/A/2; chất bích < chuồn < rô < cơ. Mã lá 0–51 theo `rankIndex * 4 + suitIndex`.
- 2–4 người, 13 lá/người. Lá dư là bài không chia, không lộ cho client. Xáo tại máy chủ bằng ngẫu nhiên mật mã với rejection sampling.
- Ván đầu người có lá nhỏ nhất đã chia đi trước, phải đánh bộ chứa lá đó. Ván sau người thắng trước đi trước, không phải chứa 3 bích; nếu người thắng đã rời thì dùng lá nhỏ nhất đã chia.
- Theo thứ tự ghế. Bỏ lượt thì không được đánh lại trong vòng đó, trừ chặt bằng bốn đôi thông. Khi những người còn tranh vòng đều bỏ thì người giữ bộ mở vòng mới. Nếu người đó đã hết bài, người còn chơi kế tiếp theo ghế mở vòng mới.
- Bộ hợp lệ: lẻ; đôi; sám; tứ quý; sảnh ít nhất 3 lá liên tiếp; ba/bốn đôi thông. Sảnh và đôi thông không chứa 2, không nối A–2–3. Không có sảnh đồng chất riêng hay bộ 5 lá kiểu poker.
- Bộ cùng loại và cùng số lá so lá cao nhất. Bộ mới phải lớn hơn bộ cũ. Có thể về bằng 2. Không được bỏ lượt khi mở vòng mới.

## Chặt

| Bộ chặt       | Chặt được                                                 |
| ------------- | --------------------------------------------------------- |
| Ba đôi thông  | Một 2; ba đôi thông nhỏ hơn                               |
| Tứ quý        | Một/đôi 2; ba đôi thông; tứ quý nhỏ hơn                   |
| Bốn đôi thông | Một/đôi/ba 2; ba đôi thông; tứ quý; bốn đôi thông nhỏ hơn |

Ba đôi thông và tứ quý phải đúng lượt và chưa bỏ vòng. Bốn đôi thông được chặt các bộ trong bảng ngoài lượt, kể cả đã bỏ; sau chặt xóa trạng thái bỏ lượt và tiếp tục theo ghế sau người chặt. Bốn đôi thông không được chen vào bộ thường không thuộc bảng chặt.

## Tới trắng và kết quả

- Ngay khi chia, xét: sảnh rồng (13 rank khác nhau, có 2) → tứ quý 2 → sáu đôi (ít nhất 6 rank có đôi). Bản v1 chỉ dùng ba điều kiện này.
- Nhiều người cùng đạt: ưu tiên theo loại ở trên, sau đó ghế theo chiều từ người mở. Người thắng trắng hạng nhất; người khác đồng hạng nhì. Không tạo thứ hạng giả dựa trên bài rác chưa đánh.
- Chơi thường tiếp tục đến khi chỉ còn một người có bài. Người hết bài lần lượt nhận hạng 1, 2, 3; người cuối nhận hạng còn lại.
- Cóng: người chưa đánh lá nào khi có người về nhất được gắn nhãn trong kết quả. Thối 2/tứ quý/đôi thông chỉ gắn nhãn cho người cuối còn bài, không trừ điểm trong bản v1.
- Người bỏ cuộc không được tính thắng và xếp cuối; người bỏ trước xếp thấp hơn người bỏ sau. Bài của người bỏ được giữ ở vùng private bỏ cuộc để bảo toàn bộ bài, không phát cho đối thủ. Nếu chỉ còn một người chưa xếp hạng, người đó nhận hạng tiếp theo. Không còn người hoạt động mà chưa có người kết thúc thì hủy ván.
- Timeout dùng cùng luật Đánh/Bỏ lượt, không phải đường tắt thay đổi state. Deadline mới tính từ giờ server xử lý, tránh phạt dồn khi worker bị trễ.

## Tiêu chí

Fixture dương/âm cho mọi loại bộ, chặt ngoài lượt, mở vòng sau người hết bài, đầu ván thiếu 3 bích, tới trắng đồng thời, cóng/thối, bỏ cuộc và timeout. Invariant: 52 lá duy nhất ở tay + bài đã đánh + bài dư + bài bỏ cuộc, input không bị mutate, mọi lượt hoặc kết thúc đều tiến triển được. Snapshot không chứa tay người khác hay bài dư.

Tham khảo biến thể: [ZingPlay miền Nam](https://play.zing.vn/detail-games/chi-tiet.tien-len-mien-nam.2.html), [Pagat](https://www.pagat.com/climbing/thirteen.html). Luật LifeMate ở trên là contract của south-v1; không mặc định mọi nhóm chơi cùng biến thể.
