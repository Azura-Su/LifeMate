# Bàn chơi bị giữ ngang trên iOS Simulator — 25/10/2026

Quan sát trực tiếp iPhone 17 Pro Max / iOS 26.3: khung thiết bị ở dọc nhưng
giao diện kết quả Phỏm vẫn ngang. Native trả orientation=3, lock=DEFAULT và
cho phép đủ portrait/landscape-left/landscape-right; không phải khóa landscape
trong hook. Bản development đang bật nút công cụ nổi Expo.

Expo dev-menu đang cài dùng một UIWindow riêng với UIHostingController cho nút
nổi. [Báo cáo upstream](https://github.com/software-mansion/react-native-screens/issues/3831)
mô tả xung đột hướng cửa sổ này với hướng của app trên iOS. Đây là bằng chứng
cho workaround development, chưa chứng minh overlay là nguyên nhân duy nhất.

## Khắc phục

- `ios.infoPlist.EXDevMenuShowFloatingActionButton=false` trong app.json, để
  các build sau mặc định không hiện cửa sổ công cụ nổi. Không sửa hook xoay,
  dependency, native source được sinh, luật chơi hoặc điểm.
- Simulator hiện tại đã áp dụng cùng preference qua API native dev-menu, nên
  không cần build lại để tắt nút đang hiện. Đưa màn chọn trò về PORTRAIT_UP sau
  khi kiểm tra. Dev menu vẫn có thể mở bằng phím tắt/gesture hiện có.

## Kiểm chứng và giới hạn

- Thử chính sách DEFAULT của bàn qua debugger native; xoay một vòng qua hai
  chiều ngang và trở về dọc bằng nút Rotate của Simulator: giao diện theo đúng
  hướng. Sau khi bật lại overlay để đối chứng, lượt xoay tiếp cũng đạt; lỗi
  ban đầu không tái hiện ổn định sau khi trạng thái cửa sổ đã được làm mới.
- Trước khi vào lại bàn, xác nhận orientation=1, lock=PORTRAIT_UP,
  floatingButton=false.
- Expo config introspection sinh đúng preference=false, giữ nguyên danh sách
  hướng native và hướng dọc khi khởi động. Prettier đạt; 3/3 test hook xoay đạt.
- Vào lại bàn Phỏm hiện có từ bảng điểm, không bấm sẵn sàng hoặc bắt đầu ván.
  Màn kết quả quay dọc → ngang → dọc thành công và giữ nguyên phòng, điểm.
- Chưa kiểm tra trong lúc đang đánh bài, trên máy thật hoặc bản release.
  Nếu còn lỗi cần thu thập đồng thời hướng thiết bị,
  UIWindowScene và từng cửa sổ app/overlay; không thêm vòng lặp ép xoay bằng JS.
