# Kế hoạch: Dùng chung luồng tạo/vào phòng — 27/10/2026

## Mục tiêu

Thu gọn màn Chơi online: chỉ có một bộ chọn “Tạo phòng mới / Vào phòng có sẵn”, một ô nhập mã và một nút vào phòng cho toàn bộ trò. Khi tạo, người chơi chọn một trò; chỉ cấu hình của trò đang chọn xuất hiện và dùng một nút tạo phòng chung.

## Quyết định thiết kế

- Chọn **Vào phòng có sẵn** không cần chọn trò; mã phòng xác định loại game ở server. Lệnh join chỉ gửi mã và tên như contract hiện hành.
- Chọn **Tạo phòng mới** thì danh sách game là danh sách chọn đơn; cấu hình riêng của game hiển thị trong cùng một vùng cấu hình bên dưới danh sách.
- Nút **Tạo phòng** nằm một chỗ, dùng cấu hình của game được chọn; validation chỉ xét cấu hình đó. Chuyển sang join không xóa các draft tạo phòng.
- Giữ nguyên luật/config, action protocol, điều hướng, quyền và UI bàn chơi; đây là thay đổi presentation/state ở màn vào phòng.

## Các lát triển khai

1. **Contract UI + regression tests** — kiểm tra chỉ có một selector; join chạy không chọn game, gửi mã chuẩn hóa; create chọn game và gửi đúng config; draft giữ nguyên khi chuyển chế độ.
2. **Cấu hình tạo phòng** — đưa draft/config và validation của Tiến lên, Phỏm, Bắc, Sâm, Tấn lên màn hình cha; game card chỉ chọn game, một vùng duy nhất hiển thị cấu hình đang chọn.
3. **Vùng hành động chung** — đặt selector chế độ, ô mã + nút join dùng chung; đặt nút create chung dưới cấu hình đã chọn; bỏ selector/input/action trùng trong entry component.
4. **Hoàn thiện và kiểm chứng** — cập nhật SPEC, targeted Jest, typecheck, ESLint và diff check; xác nhận luồng join vẫn lấy game từ mã phòng và create giữ nguyên payload từng trò.

## Tiêu chí chấp nhận

- Trên màn vào phòng chỉ có một bộ chọn chế độ và một ô/nút join; không cần chọn game để join.
- Create chỉ có một nút; chọn từng trò sẽ hiển thị đúng cấu hình và gửi payload tương ứng.
- Chuyển create/join/game không làm mất draft cấu hình, và validation của game khác không khóa action hiện tại.
- Accessibility labels, loading/disabled states, normalization mã 8 ký tự và behavior hiện tại được giữ.

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Chuyển state làm mất draft khi đổi trò | Lưu draft cấp screen; regression test chuyển qua lại giữa trò/chế độ |
| Join vô tình gắn game đang chọn vào request | Test payload chỉ gồm `type`, `name`, `code` |
| Validation cấu hình không liên quan chặn tạo | Chỉ parse/validate game đang chọn |

