# Tiến lên: chế độ ván và tiền chặt2

## Yêu cầu đã xác nhận

- Dropdown: đánh tiếp tới khi còn1 người như hiện tại; hoặc dừng ngay khi có
  người đầu tiên hết bài. Chế độ sau tính số lá còn × mức mỗi lá cho mọi người
  thua, tổng chuyển cho người về nhất.
- Một mức tiền chung tự nhập cho mỗi lá2 bị chặt. Trừ người đánh2 và cộng người
  chặt; cộng dồn vào kết quả cuối. Chỉ các bộ chặt hợp lệ theo luật hiện có tính
  phạt, không tính việc2 lớn hơn đè2 nhỏ hoặc chặt bộ chặt khác.
- Mặc định chế độ cũ và tiền chặt0. Ván hủy toàn bộ không quyết toán khoản nào.
- Khi dừng sớm, người còn chơi đồng hạng nhì; người bỏ cuộc xếp sau. Không dựng
  thứ hạng từ số lá chưa đánh. Giữ bài riêng để bảo toàn52 lá.

## Plan

1. Viết regression engine/scoring: một/đôi/ba2, thắng bằng bộ chặt, ngoài lượt,
   cộng dồn phí, dừng sớm, forfeit/timeout/hủy, tới trắng và zero-sum.
2. Thêm config bất biến và engine south-v2 cho phòng có tùy chọn khác mặc định.
   Phòng cũ/default giữ south-v1. Tính tiền ở một chỗ, không bị room ghi đè.
3. RPC tạo phòng riêng và trigger giữ config, status metadata cho capability.
   Client4 là superset3; chặn client cũ trước join/takeover/reopen phòng mới.
4. UI dropdown trong form Tiến lên, input đ/lá2, hint và luật theo cấu hình;
   kết quả có khoản chi tiết. Dùng style/token hiện có và giữ form cuộn được.
5. Regression SQL/API/parser/UI, typecheck/lint/functions/bundle; reviewer cuối.
6. Rollout worker hỗ trợ v2 trước, chờ worker v10 kết thúc theo barrier400s rồi
   mới bật RPC tạo phòng v2. Không dùng mode closed hoặc sửa ghế/phòng thật.

## Review plan

Reviewer chỉ đọc đã chỉ ra các ràng buộc: settlement non-Phỏm hiện bị room ghi
đè; gate4 phải giữ Phỏm3/lifecycle/avatar; phòng v2 phải có metadata từ lobby;
worker cũ có thể xử lý sai v2 nên cần barrier trước bật tạo phòng. Đã đưa vào plan.

## Kết quả kiểm tra trước schema rollout

- 241 backend tests đạt;83 tests client trọng tâm đạt, regression riêng form/luật
 48 tests đạt. Typecheck và lint file thay đổi đạt. Export iOS/Android đạt.
- Reviewer backend/SQL không còn finding. Reviewer client phát hiện draft cấu
  hình lẫn vào luật phòng cũ; đã dùng mặc định thực của phòng và thêm regression.
- Simulator đã mở dropdown, chọn dừng khi về nhất, đóng dropdown và cập nhật
  mô tả đúng. Input tiền riêng và nút tạo phòng vẫn hiển thị.
- Đã deploy Edge v11 hỗ trợ hai phiên bản South; schema tạo phòng v2 chưa bật
  trong thời gian chờ worker v10 kết thúc.
- Lượt full Jest đầu bị process exit139 khi chạy chồng export, không có assertion
  thất bại trước crash. Chạy lại tuần tự đạt133 suites/1.037 tests; không bỏ/giảm
  test. Không khẳng định nguyên nhân crash đã được chứng minh.
- Rehearsal theo35 RPC và11 phiên bản migration production đạt5 ca SQL/API;
  fixture rollback bổ sung đạt6 ván2/3/4 người ×2 chế độ, có chặt2, retry từng
  bước và so sánh chính xác điểm mỗi người/match ID.

## Triển khai và kiểm chứng cuối

- Backend `game-access` **v11 ACTIVE**,18 file source đọc lại khớp bundle được
  review; giữ xác thực Firebase và `verify_jwt=false`.
- Deploy11:12:34UTC, chỉ bật schema sau11:19:41UTC, hơn410 giây; log ghi nhận
  request v11, không có request v10 mới trong khoảng kiểm tra. Không dùng mode
  closed hoặc dọn ghế thật để bảo trì.
- CLI tự cập nhật2.122.0 nhưng thiếu token. Chuyển sang connector đã kết nối và
  apply nội dung SQL đã review với guard. Migration thực `20261023112114`;
  đổi tên file local theo phiên bản thật và chạy lại3 tests SQL/HTTP đạt, không
  thay SQL body hoặc đánh dấu phiên bản nháp là đã chạy.
- Sáu ván fixture PostgreSQL production đạt cho2/3/4 người và cả hai chế độ,
  có chặt2, so sánh đầy đủ từng delta/match ID, retry và sửa/xóa bảng điểm.
  Fixture dùng engine local và RPC thật; không gọi gameplay Edge bằng token
  tài khoản thật. Transaction đã rollback, không còn ghế/receipt/bảng điểm thử.
- 133 suites/1.037 Jest tests,241 backend tests, typecheck/lint và export iOS/
  Android đạt. Hai reviewer chỉ đọc duyệt code, rollout và fixture; finding
  draft/legacy rules đã sửa và có regression.
- Đã xem/chọn dropdown trên Simulator; chưa thử trọn ván nhiều điện thoại thật.
  Không phát hành bản cài/OTA. Backup và log ở
  `/private/tmp/lifemate-south-deploy-20261023`, snapshot trước thay đổi tại
  `/private/tmp/lifemate-south-config-before-20261023`.
