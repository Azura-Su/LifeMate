# Review và sửa xoay bàn — 22/10/2026

## Phát hiện

1. P1: useCardGameOrientation gọi OrientationLock.ALL ở iOS. Expo đang cài đặt
   (~55.0.20) định nghĩa ALL gồm portraitUpsideDown, và native
   ScreenOrientationUtilities.swift từ chối mask này khi thiết bị có notch.
   lockAsync reject bị catch bỏ qua, giữ khóa PORTRAIT_UP trước đó. Đây là lỗi
   code có thể giải thích bàn không quay trên iPhone tai thỏ/Dynamic Island;
   chưa đo runtime trên điện thoại của người dùng.
2. P2: Modal của popup bàn thiếu supportedOrientations; React Native iOS mặc định
   portrait trên iPhone (cả implementation Fabric và cũ), có thể kéo popup về dọc
   hoặc ngăn xoay khi mở.

## Sửa

- iOS dùng DEFAULT (allButUpsideDown); Android giữ ALL. Luồng chọn trò giữ dọc,
  khi bàn mở cho xoay tự nhiên, blur/unmount vẫn unlock theo hành vi trước.
- DialogModal thêm prop tùy chọn supportedOrientations; chỉ popup thông tin,
  luật và mã phòng của game truyền portrait + landscape-left/right. Các popup
  khác giữ default hiện có.
- Info.plist đã cho hai chiều landscape, Android manifest unspecified, app.json
  orientation default. Không đổi native config, không đổi dependency.

## Kiểm chứng

- Test RED: mock native iOS từ chối ALL, 2 test thất bại với hook cũ.
- Sau sửa: 79/79 tests của hook, DialogModal, CardGamesScreen, CardGameTable đạt.
  Có kiểm tra cả iOS/Android, portrait trước bàn, blur/unmount và orientation props
  của popup thực tế trong screen. Toàn app: 127 suites / 997 tests đạt.
  Typecheck, lint các file thay đổi, git diff --check và bundle iOS/Android đạt.
- Rà lại code callers/native dependency, giữ thay đổi trước đó trong working tree.
- Chưa kiểm tra runtime bằng thao tác xoay trên thiết bị thật/Simulator; chưa phát
  hành client. Cần chạy bản JS mới để nhận bản sửa.

## Sửa sau review lần hai — popup mã phòng

- Giới hạn popup ở 90% chiều cao vùng hiển thị; giữ heading/nút đóng ngoài vùng
  cuộn. Mã phòng, thông báo đã sao chép và toàn bộ action nằm trong ScrollView có
  flexShrink:1. Giữ khoảng cách 12 theo spacing.md.
- Regression mở popup với quyền chủ phòng/thành viên khác, xác nhận maxHeight,
  scroll chứa chuyển quyền và thông báo sao chép, nút đóng nằm ngoài scroll. Test
  thất bại trước khi sửa vì thiếu vùng cuộn. Chưa xác nhận layout bằng máy thật.

## Sửa bàn chờ ngang theo ảnh lúc 18:35

- Nguyên nhân: landscapeLobbyBoard dùng flexDirection:row trong khi hàng đối thủ
  width:100%, đẩy bộ bài và thông báo ra ngoài bàn. Chuyển vùng bàn về column để
  đối thủ nằm trên, bộ bài giữa, trạng thái dưới. Giữ bảng điều khiển bên phải.
- Hàng đối thủ ngang không wrap; từng ghế được co chiều rộng, tên tối đa2 dòng và
  trạng thái1 dòng. Thông tin bản thân không chiếm toàn bộ chiều cao panel và nút
  sẵn sàng có thể dùng hết chiều rộng panel.
- Regression component với4 thành viên ở các viewport giả lập568x320,667x375,
  956x440 kiểm tra cấu trúc/style và hành động ready; cùng screen tests46/46 đạt.
- Đã quan sát runtime trên Simulator iPhone17 Pro Max iOS26.3, phòng hiện có2
  thành viên: sau hot reload, dọc vẫn đúng; xoay ngang hiển thị đủ bộ bài/trạng thái
  bên trong bàn và khối sẵn sàng gọn. Không bấm ready hoặc sửa dữ liệu phòng.
- Chưa xác nhận4 người trên nhiều thiết bị thật; kiểm tra viewport trong Jest
  không thay cho phép đo layout native ở các kích thước đó.

## Điều chỉnh theo yêu cầu vị trí người cầm bài lúc 18:40

Yêu cầu mới thay cho cột điều khiển bên phải: bàn chờ ngang cũng xếp khu vực bản
thân thành một thanh ngang toàn chiều rộng ở cạnh dưới. Board nằm phía trên; panel
chứa avatar/tên/số người bên trái và ready bên phải, chiều cao tối thiểu60. Bỏ style
own-player flex0 đã dùng cho rail dọc. Bàn đang chơi vốn đã đặt handSection trong
landscapeBottom (bottom:4, left/right:8), không đổi logic/chọn bài.

Kiểm tra74/74 tests (lobby/table/screen) đạt. Các viewport giả lập kiểm tra panel
row/full-width, root column và ready action. Không xác nhận ảnh runtime của lần
đổi này: lúc mở lại Simulator, tài khoản đã ở trang chọn trò, không còn trong bàn.

## Thiết kế nhấn mạnh lượt đánh

- Đối thủ có lượt nhận nhãn Đang đánh (không chỉ dựa màu), tên đậm, khung xanh
  viền2 và shadow rõ hơn. Không áp highlight khi ván đã kết thúc.
- Đồng hồ20px/đậm800, chữ trắng trên nền xanh; <=10s nền vàng đậm, <=5s nền đỏ.
  Tận dụng pulse đã có, không thêm timer/animation hoặc đổi deadline server.
- Vùng bài bản thân có nền xanh nhẹ/viền2 khi tới lượt. Đồng hồ ở header ngang
  giữ chiều cao26 để không lấn vùng lá bài; đồng hồ đối thủ cao32/minWidth48.
- Tests kiểm tra badge, màu/nền deadline, đổi lượt chuyển highlight từ đối thủ
  sang bản thân và khung bài active. Snapshot màu test cập nhật theo thiết kế mới.
- Simulator đang ở kết quả/nối lại khi quan sát; chưa xác nhận hình ảnh runtime
  của lượt đang chơi, không gửi ready/play để tạo dữ liệu thử trong phòng thật.
- Kết quả kiểm tra phần nhấn lượt:72/72 tests của table/screen đạt; typecheck và
  lint các file thay đổi đạt. Kiểm tra own timer ngang cao26 và không đổi vùng lá.
