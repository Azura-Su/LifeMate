# Linh Lộc và cảnh ngủ lớn hơn trên Home — kết quả

Đã triển khai [kế hoạch](celestial-stag-home-scale-plan.md) cho cấp1–20.

- Canvas thú mục tiêu **144pt**, tăng20% từ120pt; giữ tỷ lệ tiến hóa giữa các cấp.
- Tất cả cảnh ngủ dùng khung mục tiêu **240pt**, tự thu cùng thú khi màn hình
  không đủ rộng/cao. Chọn atlas và cấp mở khóa vẫn theo thiết lập đang có.
- Home dành vùng dưới viewport thẻ cho thú/cảnh. Các thẻ vẫn cuộn được, bị
  giới hạn trong viewport riêng và có khoảng hở tối thiểu `spacing.md` với cảnh.
  Vùng dành riêng không mất đi khi mở menu/lịch hoặc tạm dừng hoạt ảnh.
- Điểm ngủ nằm trong biên an toàn; resize căn lại cả thú ngủ và cảnh tan. Cảnh
  thức sớm dùng cùng kích thước/đường đất với cảnh đang mọc.
- Tăng kích thước chỉ ở Home và bản xem thử Home; tỷ lệ của màn chi tiết giữ
  nguyên. Dữ liệu lưu và atlas không bị thay vì yêu cầu chỉnh tỷ lệ này.
- Điều kiện đổi ngoại hình phân biệt lựa chọn thủ công với tăng cấp tự nhiên,
  tránh tự đánh thức thú đang ngủ khi dữ liệu cấp được làm mới.

[Ảnh ghép đủ20cấp](previews/celestial-stag-home-scale-levels-01-20.png) dùng atlas
runtime và tỷ lệ renderer mới; đây là ảnh ghép để so tỷ lệ, không phải screenshot20thiết bị.

## Xác minh

- Reviewer chỉ đọc đã rà plan và diff; hai điểm về giữ vùng khi pause và căn
  lại vị trí khi resize/đổi pha đã xử lý; lần rà cuối không còn finding.
- Jest: **7suite, 233test đạt**, gồm HomeScreen, HomePetRoamer, HomeSleepScene,
  homePetDrag, celestialStagHomeLayout, PixelPetSprite và celestialStagAtlas.
  Bộ test hình học kiểm tra cấp1–20, 320×568, 390×844, 430×932 và các vùng hẹp/ngắn;
  regression kiểm tra menu, wake sớm, resize thú/cảnh tan và tăng cấp khi ngủ.
- `npm run typecheck`: đạt. ESLint các file ảnh hưởng: đạt.
- `expo export --platform ios --platform android`: đạt; output kiểm tra tại
  `/tmp/lifemate-home-scale-export-final`. Không deploy.
- Native iPhone17ProMax: đã quan sát Home khi ngủ ở cấp đang sở hữu, thấy cảnh
  nằm trọn trên tab và tách rõ khỏi các thẻ; đã mở bản xem thử cấp20 và thấy thú
  chuyển động ở cỡ mới. Chưa xem trọn từng chu kỳ của cả20cấp trên native;
  chưa chạy Android trên thiết bị. Các trường hợp đó có kiểm tra hình học/Jest.
- `git diff --check` các đường sửa: đạt. Giữ các thay đổi khác đang có trong worktree.

Test HomeScreen vẫn in cảnh báo Expo notifications/async act đã có; không tắt
cảnh báo, không bỏ test hoặc hạ tiêu chí kiểm tra.
