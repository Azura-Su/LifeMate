# Review và nâng cấp chuyển động bàn Tiến lên — 21/10/2026

Người dùng yêu cầu review kỹ, lên kế hoạch và thực hiện. Giữ giao diện sáng hiện tại, luật, API/socket và dữ liệu điểm. Các kế hoạch đang mở khác được giữ nguyên.

## Kết quả audit

- Deal key không kết thúc khiến xoay màn hình có thể giấu/chia lại tay bài; guard bàn trống sau pass đã có nhưng chưa bảo vệ hand.
- Pass cuối vòng không thêm vào `passed` vì server dọn danh sách ngay; một flight duy nhất còn có thể làm mất pass liên tiếp.
- Kết thúc đổi ngay hand sang ready, làm animation dọn hand không có gì để render. Pháo hoa thiếu khóa room/match và có thể chạy lại khi remount.
- Timer đã đúng vị trí theo yêu cầu trước: đối thủ dưới avatar, bản thân giữa thông tin hand và xếp bài. Cần sửa tick cũ khi snapshot clock mới tới.
- Hand hẹp đang giữ kích thước và khoảng góc tối thiểu lớn hơn bề rộng khả dụng. Chưa có chuyển động thu gọn khi server xác nhận mất lá.
- Giữ yêu cầu đã chốt: ẩn số lá đối thủ; không thêm popup kết quả giữa bàn; chỉ tự vào ván sau khi server xác nhận mọi người ready.

## Các lát cắt

1. Sự kiện: pass cuối vòng chỉ suy ra từ hai version liên tiếp cùng room/match, table cũ không rỗng, cùng player UID/order/count/finish/forfeit, lượt cũ là người hoạt động khác chủ bộ. Không đoán sau reconnect/skipped versions. Flights có event key và cleanup riêng.
2. Lifecycle: deal kết thúc/cancel có generation guard; hand settle khi rotation/background/đánh lá đầu. Winner effects dùng khóa room/match/ghế và không replay khi reconnect.
3. Kết thúc: giữ lá cuối 500ms, thu trong 380ms; snapshot cũ chỉ là overlay không tương tác, không block server/ready/rematch. Kết quả nhỏ ở ghế. Snapshot finished mở lại hiển thị trạng thái đã ổn định.
4. Layout/timer: đo hand và anchor bằng cùng tọa độ cửa sổ, bỏ callback thuộc viewport cũ; compact hand khi slot hẹp; nâng selection không đổi lớp, reorder theo hand đã xác nhận. Giữ đồng hồ tại vị trí đã chốt và đồng bộ tick server.
5. Verification: Jest theo lát cắt và toàn bộ test game UI, typecheck, ESLint/Prettier/diff check, export iOS/Android; runtime native nếu có simulator khả dụng. Reviewer cuối kiểm tra lifecycle và regression.

## Giới hạn có chủ đích

Snapshot chỉ có deadline, không có tổng thời lượng lượt/countdown ván mới; không tạo vòng tiến trình theo thời lượng giả hoặc đổi API. Repo chưa có sound asset/cài đặt âm thanh game; không thêm tiếng mới hoặc dependency trong lượt này.

## Rủi ro và kiểm soát

- Callback/timer cũ: hủy và kiểm tra room/match/viewport generation.
- Đo layout async: bỏ kết quả cũ, dùng fallback khi chưa có đủ anchor hiện tại.
- Consume animation: đánh dấu khi bắt đầu; remount cùng key không replay, match mới vẫn chạy.
- State server luôn cập nhật ngay; animation chỉ giữ bản sao hình ảnh tạm.

## Checklist

- [x] Pass/deduplication/deal lifecycle có regression tests.
- [x] Finish/result/winner lifecycle có regression tests.
- [x] Layout/clock/orientation có regression tests.
- [x] Gates và review cuối đạt; ghi rõ runtime nào đã/chưa thực hiện.

## Bằng chứng sau triển khai

- Reviewer độc lập đã rà kế hoạch và diff cuối: không còn finding cần sửa. Các finding hidden-ready, pass/exiting effect ván cũ và thứ tự suit-sort lúc thu bài đều đã sửa và có test.
- 8 Jest suites / 85 tests đạt, gồm UI game, navigation integration và orientation hook; typecheck, ESLint, Prettier, diff check đạt. Navigation test có cảnh báo Expo Go push notifications đã có sẵn, không liên quan thay đổi.
- Export bundle iOS/Android đạt, output ở thư mục tạm ngoài repo.
- iOS Simulator iPhone 17 Pro Max: dữ liệu giả tạm đã kiểm tra portrait/landscape, bàn 2/4 ghế, hand 13 lá, chọn bài giữ góc lá bên cạnh, đánh và thu gọn hand, bỏ lượt, thu bài/kết quả thua, pháo hoa tại ghế đối thủ thắng, chạy số dư, ready giữa hand và xoay kết quả. Có sửa thêm thông báo chuyển lượt ngang bị hand che và số dư ghế hẹp bị xuống dòng.
- Preview tạm đã gỡ; CardGamesRoute khôi phục đúng byte so với trước lượt làm. Không tạo phòng thật hay ghi bảng điểm test.
- Chưa đo FPS, chưa chạy Android native/large font hoặc nhiều thiết bị thật với reconnect/mất mạng. Không coi export hay Jest là đã kiểm chứng những mục này.
