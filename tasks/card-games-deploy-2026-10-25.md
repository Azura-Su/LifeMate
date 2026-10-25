# Triển khai game online — 25/10/2026

## Phạm vi

- Thêm Tiến lên miền Bắc, Sâm và Tấn; cấu hình điểm cho phòng và ván tới.
- Bắc/Sâm v2 giữ luật và kết quả v1 của phòng cũ cho đến khi chủ phòng đổi luật.
- Đồng nhất thao tác tạo/vào phòng; sửa parser trạng thái protocol 11, không lưu
  ô phí để trống thành 0, hiển thị riêng phí hiện tại và phí ván tới.

## Backend production

Project Supabase: `xbhelntqytleiduzicuj` (LifeMate).

Ba migration đã được production ghi nhận; tên file local dùng đúng version do
MCP cấp để tránh áp dụng lại:

1. `20261025163926_lifemate_new_online_game_variants`
2. `20261025163933_card_game_variant_room_configuration`
3. `20261025163939_card_game_v2_scoring_profiles`

`game-access` đã được deploy ở lượt trước. Lượt chuẩn bị commit/push này đọc lại
source production và đối chiếu đủ 22 file, không có khác biệt. Function giữ
`verify_jwt=false` vì handler xác minh Firebase JWT và RPC kiểm quyền tài khoản.

Firebase rules không có thay đổi trong bản game này. Cảnh báo Supabase Advisors
sau deploy giống trước deploy: 19 INFO về bảng service-only không có RLS policy,
1 WARN về RPC Realtime membership và 2 INFO về index foreign key.

## Giới hạn phát hành client

App React Native chưa cấu hình Expo OTA/EAS, nên triển khai backend không cập
nhật JavaScript trên bản app đã cài. Cần build/phân phối bản iOS/Android hoặc chạy
app phát triển từ source mới. Chưa xác nhận trọn ván trên 2–4 thiết bị thật.

## Kiểm chứng trước commit

- 357/357 test Supabase functions đạt, gồm SQL integration với migration đúng
  version production.
- 461/461 test app/service trong 24 suite game và CardScore đạt.
- Typecheck, lint các file thay đổi và kiểm tra whitespace đều đạt.
- Review độc lập đã xác nhận ba lỗi parser/ô phí/luật ván tới được xử lý;
  chưa kiểm chứng native rendering hoặc trọn ván trên nhiều thiết bị.
