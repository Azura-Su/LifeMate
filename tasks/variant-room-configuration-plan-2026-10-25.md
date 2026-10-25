# Kế hoạch: Cấu hình phòng cho miền Bắc, Sâm và Tấn

Trạng thái: đã triển khai cục bộ và kiểm tra. Mục tiêu là làm luồng tạo phòng
và chỉnh cấu hình trong phòng cho ba game mới gần với Phỏm/Tiến lên miền Nam.

## Rà soát hiện trạng

- Tiến lên miền Nam có cấu hình trước khi tạo: chế độ kết thúc, điểm/tiền mỗi lá
  và khoản chặt 2. Chủ phòng có thể lưu luật cho ván tới trong phòng.
- Phỏm có cấu hình trước khi tạo: các tùy chọn luật và từng mức điểm. Chủ phòng
  cũng có thể sửa cấu hình áp dụng từ ván kế tiếp.
- Miền Bắc, Sâm và Tấn hiện chỉ gửi `game` và `name` khi tạo phòng. Phần mở rộng
  hiện chỉ hiện mô tả luật cố định; không có input cấu hình. Trong phòng, dialog
  sửa luật cũng chỉ xử lý `south` và `phom`.
- Ba SPEC đã chốt profile luật v1. Điểm miền Bắc/Sâm là điểm nội bộ theo số lá;
  điểm Tấn có công thức riêng theo số lá người cuối còn giữ. Không dùng cược.

## Mục tiêu và hành vi đề xuất

1. Khi chọn **Tạo phòng mới**, mỗi game hiện một phần **Cấu hình ván** trước nút
   tạo; khi chọn **Vào phòng có sẵn**, chỉ hiện trường nhập mã.
2. Sau khi tạo, cùng cấu hình được ghi vào phòng và được gửi trong snapshot để
   mọi người xem được cấu hình đang áp dụng.
3. Từ menu phòng, chủ phòng có thể sửa cấu hình cho **ván tới** theo mẫu Phỏm/
   Tiến lên. Ván đang chơi không đổi; cấu hình mới chỉ có hiệu lực sau khi đủ
   người sẵn sàng và server tạo ván kế tiếp.
4. Cài đặt luật nền v1 đã chốt vẫn là mặc định. Không đưa các biến thể luật địa
   phương chưa chốt thành công tắc bật/tắt trong đợt này.

## Phạm vi cấu hình v1 đề xuất

| Game | Cấu hình người tạo chọn | Mặc định | Công thức tính điểm |
|---|---|---:|---|
| Miền Bắc | Điểm mỗi lá còn lại | 1 điểm/lá | Người thua trừ số lá × mức điểm; người nhất nhận tổng để ván zero-sum |
| Sâm | Điểm mỗi lá còn lại | 1 điểm/lá | Giữ nguyên công thức v1; không có thưởng/phạt riêng báo Sâm hoặc báo một |
| Tấn | Điểm mỗi lá của người cuối | 1 điểm/lá | Giữ nguyên công thức v1 cho nhóm còn trong kết quả: người cuối trừ `R × (N-1) × mức điểm`, mỗi người đã thoát nhận `R × mức điểm`. Người bỏ ván theo chính sách hiện hành nhận 0 và không tham gia chia điểm; giữ nguyên chính sách này khi nhân hệ số. |

Giá trị là **điểm nội bộ**, không phải tiền cược. Hiển thị kết quả của ba game
theo đơn vị “điểm”, tránh dùng nhãn tiền “đ” của miền Nam/Phỏm. Đợt này giữ cố
định: số người 2–4, số lá chia, luật tổ hợp/chặn, vòng báo Sâm, luật tấn/đỡ,
chuyển tấn và thời gian 40 giây/lượt.

Giới hạn nhập đề xuất: số nguyên từ 1 đến 1.000.000.000, mặc định 1. Mức 0 không
có ý nghĩa cho cấu hình điểm và dễ bị hiểu là chế độ miễn điểm. Trước khi chốt
giới hạn trên, cần chứng minh mọi delta, tổng điểm và lịch sử vẫn an toàn với
integer bounds; giảm giới hạn nếu không chứng minh được.

## Hợp đồng và kiến trúc

- Dùng một cấu hình có discriminator theo `gameKind`, không thêm các field tùy
  chọn rời rạc vào mọi intent. Cấu hình hiện tại và cấu hình ván tới là hai giá
  trị riêng; cấu hình được pin vào kết quả của mỗi ván.
- Mở rộng `GameIntent`/`GameRequest`, parser strict, `gameApi`, Edge validation,
  server engine start/rematch và settlement. Client không được tự quyết toán
  multiplier.
- Thêm migration additive: xác thực game/config tương ứng, lưu config khi tạo,
  ngăn đổi cấu hình hiện tại khi ván đang chạy, và cập nhật config ván tới bằng
  `ownerUid` authoritative + controller session + CAS/version + idempotency.
  Nếu phòng legacy chưa có `ownerUid`, chỉ dùng fallback cũ đã được server xác
  thực; `hostUid` hoặc người thay quyền điều khiển bàn tự nó không cấp quyền sửa
  luật. Giữ nguyên RPC cũ và các phòng South/Phỏm.
- Nâng capability cho phòng có cấu hình mới để client cũ bị chặn trước khi vào
  ghế, takeover hoặc ready; đặt giá trị mặc định tương thích khi đọc phòng variant
  đã tồn tại chưa có cấu hình. Multiplier cho phòng variant cũ là đúng 1 điểm/lá
  theo profile đang chạy; tuyệt đối không lấy `amountPerCard` legacy làm
  multiplier mới, vì các phòng này lưu 0 dù engine v1 đang ghi điểm theo hệ số 1.
  Phòng đang chơi/kết thúc giữ nguyên settlement đã lưu; mặc định này chỉ áp dụng
  cho ván tương lai.
- Dùng lại form/phong cách của `PhomGameSettings` và `TienLenGameSettings`, nhưng
  giữ form riêng gọn cho ba game; cùng một schema/validator server-client sẽ giữ
  default và giới hạn giống nhau.

## Các lát triển khai

### 1. Chốt hợp đồng

- Xác nhận chỉ cấu hình điểm theo lá trong v1 hay cần thêm biến thể luật.
- Chốt tên đơn vị, giới hạn số có thể chứng minh an toàn, schema config,
  capability mới và semantics của phòng variant cũ.
- Cập nhật SPEC từng game và tiêu chí kiểm thử trước khi code.

### 2. Contract, validation và quyết toán

- Thêm type/config defaults/validator strict ở TypeScript và Edge.
- Cho create, snapshot, history/reopen và rematch mang cùng config; phiên bản
  config đang chạy không lấy từ request action.
- Dùng điểm multiplier ở server settlement miền Bắc/Sâm/Tấn; kiểm thử zero-sum,
  timeout/forfeit, hòa và retry idempotent. Với Tấn, giữ nguyên policy hiện tại
  cho forfeited players (0 điểm, không nằm trong nhóm chia); multiplier chỉ tác
  động lên nhóm và công thức hiện có.

### 3. Cấu hình lúc tạo phòng

- Thay phần ghi chú cố định của `VariantGameEntry` bằng summary cấu hình mặc định
  và input “Điểm mỗi lá”.
- Chỉ serialize config đã validate. Disable nút tạo khi giá trị sai; join mode chỉ
  nhập mã và không gửi cấu hình của người tham gia.
- Kiểm thử ba game đều gửi config đúng và state form được reset/giữ đúng khi đổi
  game hoặc đổi giữa tạo/tham gia.

### 4. Chỉnh cấu hình ván tới trong phòng

- Mở rộng menu phòng và rules dialog theo `gameKind`; người không có quyền chỉ
  xem cấu hình hiện tại/ván tới.
- Chỉ `ownerUid` authoritative mới được lưu; người đang làm host/controller thay
  thế không được tự có quyền sửa luật. Save dùng expected version/CAS; stale draft
  yêu cầu tải lại.
- Khi lưu config ván tới đồng thời với lệnh ready cuối, server chỉ rebase ready
  nếu lệnh không thể bỏ qua config mới hoặc bắt đầu ván theo draft cũ. Nếu không
  an toàn, từ chối ready stale để client nạp snapshot mới rồi xác nhận lại. Bao
  phủ cấu hình đầu tiên trước ván 1 và các lần đổi sau mỗi ván.
- Khi lưu trong sảnh, mọi người sẵn sàng lại như các cấu hình hiện hữu.
- Chỉ promote config tại transition bắt đầu/rematch. Kết quả ván hiện tại tiếp tục
  dùng cấu hình đã pin.

### 5. Regression, review và rollout

- Thêm test UI, protocol, Edge/RPC, migration, scoring và tương thích client cũ.
- Kiểm tra create → join → ván 1 → đổi config → rematch → reconnect/reopen; thử
  2–4 người và mỗi game ở dọc/ngang.
- Reviewer độc lập rà plan trước code và diff cuối. Deploy cần thứ tự migration →
  Edge → app; chưa nằm trong đợt lập kế hoạch này.

## Tiêu chí nghiệm thu

- Ba form tạo phòng có cấu hình rõ ràng; create/join tách biệt và joiner không
  thay đổi config của chủ phòng.
- Cấu hình hiển thị nhất quán cho mọi thành viên, kể cả sau reconnect/reopen.
- Lưu config ván tới không làm đổi game, deadline hay điểm của ván đang chơi.
- Chỉ chủ phòng có quyền lưu; stale version và request sai cấu trúc bị từ chối.
- Chủ phòng là `ownerUid` authoritative (fallback legacy chỉ khi trường này chưa
  tồn tại); host/controller mới không có quyền sửa cấu hình.
- Config save/ready race không bắt đầu ván theo cấu hình cũ; trường hợp cấu hình
  đầu tiên trước ván 1 cũng được bảo vệ.
- Điểm sau multiplier giữ zero-sum theo profile đã chốt; không có cơ chế cược.
- Tấn giữ nguyên policy forfeit: người bỏ ván nhận 0 và không nằm trong nhóm
  chia; hệ số mới không đổi chính sách này.
- Phòng variant legacy chưa có config dùng multiplier v1 = 1 cho ván tương lai;
  kết quả cũ không bị tính lại và `amountPerCard` legacy không được dùng làm
  nguồn config.
- South/Phỏm, room legacy và client cũ vẫn giữ hành vi hiện tại hoặc bị chặn có
  thông báo trước mutation khi phòng yêu cầu capability mới.

## Kết quả triển khai

- Mỗi game có cấu hình điểm/lá mặc định 1, giới hạn 1–1.000.000.000; luật v1
  giữ cố định và điểm không phải tiền cược.
- Chủ phòng cấu hình khi tạo và sửa cho ván tới. Server ghim cấu hình vào lượt
  chơi mới, giữ nguyên cấu hình ván đang chạy, và bảo vệ quyền/CAS/replay.
- Phòng legacy dùng multiplier 1 cho ván tương lai; kết quả đã lưu không đổi.
- Migration và Edge Function đã được thêm ở local. Chưa triển khai lên Supabase;
  cần rollout migration trước Edge Function rồi app.
- Xác minh: `npm run typecheck`, 187 Jest tests liên quan, 344 function tests,
  và `git diff --check` đều đạt. Reviewer độc lập đã rà plan; final diff review
  không còn finding. Chưa xác minh trực tiếp bố cục trên thiết bị thật.
