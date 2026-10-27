# Luật Tiến lên miền Nam — south-v1 và south-v2

Đây là bộ luật LifeMate hiển thị trước khi sẵn sàng. Phòng cũ/mặc định dùng south-v1;
phòng chọn chế độ khác hoặc tiền chặt2 dùng south-v2. Cấu hình được lưu khi tạo
phòng và pin vào từng ván, không thay luật giữa ván hoặc khi mở lại phòng.

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

### Cấu hình south-v2 đã xác nhận ngày23/10/2026

- Dropdown gồm **Đánh tiếp đến hết ván** (như south-v1) và **Có người về nhất thì
  dừng ngay**. Mặc định đánh tiếp. Dừng sớm khi người đầu tiên hết bài: kết thúc
  ngay, người còn chơi đồng hạng nhì, người bỏ cuộc xếp sau; giữ nguyên tay riêng.
- Mức mỗi lá còn giữ cách tính hiện có. Người nhất nhận tổng
  `số lá còn × mức mỗi lá` của người thua. Trong chế độ đánh tiếp, người đã hết
  bài không còn tiền phạt bài; tới trắng vẫn kết thúc ngay theo luật đã có.
- Chủ phòng tự nhập **đ/lá2 bị chặt**, chung cho cả2 đen/đỏ, số nguyên0..1e9.
  Mức0 tắt khoản này. Chặt đôi2 tính hai lá, ba2 tính ba lá. Chỉ bộ chặt hợp lệ
  đánh lên lẻ/đôi/ba2 tạo khoản chuyển từ người đánh2 sang người chặt; không tính
  2 lớn đè2 nhỏ hoặc bộ chặt đè bộ chặt. Không cộng dồn/đền dây chuyền lên bộ sau.
- Phí được ghi trước khi thay bộ trên bàn, gồm cả cú chặt làm người đánh hết bài.
  Người đã hết bài vẫn phải trả nếu lá2 cuối bị chặt ở chế độ đánh tiếp. Mỗi cú
  được ghi một lần nhờ action receipt/CAS. Không đổi số dư giữa ván.
- Mức **chặt 2** mặc định ở phòng mới là4 điểm trên mỗi lá2 bị chặt.
- Mức **tới trắng** là số điểm cố định mỗi đối thủ trả cho người tới trắng; người
  thắng nhận tổng các khoản. Phòng mới mặc định15 điểm/người; đặt0 để tắt. Chỉ
  áp dụng khi kết quả có nhãn `instant-win`, cộng cùng tiền bài còn theo cấu
  hình hiện hành; ván thường và ván hủy không phát sinh khoản này. Cấu hình
  phòng cũ thiếu trường mới tiếp tục hiểu là0, không đổi luật đã lưu.
- Khi kết thúc, cộng tiền bài và các khoản chặt vào delta mỗi người, tổng bằng0.
  Người không về nhất có thể dương điểm nhờ chặt2; người nhất có thể âm nếu tiền
  chặt phải trả lớn hơn tiền bài nhận. Ván hủy vì tất cả mất kết nối không tính
  bất cứ khoản nào. Cóng/thối không có khoản phạt riêng trong cả hai chế độ.
- Config mặc định không phát sinh southConfig/south-v2 mới, giữ hợp đồng cũ.
  Phòng có cấu hình khác cần capability4; client cũ bị chặn trước khi nhận ghế,
  tiếp quản hay mở lại. Client4 vẫn chơi được Phỏm3 và south-v1.
- South config cũ gồm2 trường tiếp tục hợp lệ và được hiểu là mức tới trắng0.
  Config có `instantWinAmount` cần capability12; trạng thái phòng và takeover
  chặn client cũ trước khi nhận/tiếp quản ghế.

Fixture dương/âm cho mọi loại bộ, chặt ngoài lượt, mở vòng sau người hết bài, đầu ván thiếu 3 bích, tới trắng đồng thời, cóng/thối, bỏ cuộc và timeout. Invariant: 52 lá duy nhất ở tay + bài đã đánh + bài dư + bài bỏ cuộc, input không bị mutate, mọi lượt hoặc kết thúc đều tiến triển được. Snapshot không chứa tay người khác hay bài dư.

Tham khảo biến thể: [ZingPlay miền Nam](https://play.zing.vn/detail-games/chi-tiet.tien-len-mien-nam.2.html), [Pagat](https://www.pagat.com/climbing/thirteen.html). Luật LifeMate ở trên là contract của south-v1; không mặc định mọi nhóm chơi cùng biến thể.

## Sửa luật trong phòng

- Chủ phòng đang điều khiển có thể lưu chế độ kết thúc, tiền mỗi lá, tiền
  chặt 2 và mức phạt tới trắng ở menu phòng → “Sửa luật ván tới”. Cấu hình riêng `nextSouthRules`
  chỉ được đưa vào amountPerCard/southConfig khi chia match mới, kể cả tới
  trắng. Không thay bài, lượt, deadline, phí chặt hay điểm của match đang chơi.
- Lưu ở sảnh/kết quả xóa cờ sẵn sàng; lệnh ready đã gửi theo version cũ bị từ
  chối. SQL giữ amount/config hiện tại bất biến trong cùng match và bắt buộc
  mọi match mới lấy đúng pending rules, kể cả quay về luật mặc định.
- Client5 thấy cả luật hiện tại và ván tới. Thành viên dùng client cũ đã ngồi
  được tiếp tục sync/lease/play/pass/leave theo luật cũ; phải cập nhật trước
  các thao tác quản lý, sẵn sàng hoặc tham gia lại phòng đã sửa luật.
