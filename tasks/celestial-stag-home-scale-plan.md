# Phóng Linh Lộc và cảnh ngủ theo cấp trên Home

Người dùng yêu cầu lên kế hoạch và triển khai: Linh Lộc cấp 1–20 cùng tất cả
cảnh ngủ lớn, rõ hơn; cảnh ngủ không chạm các thẻ Home. Đây là thay đổi bố cục
Home, giữ nguyên art đã chọn, cấp mở khóa và tỷ lệ tiến hóa giữa các cấp.

## 1. Hình học và kiểm tra khoảng hở

- Canvas thú mục tiêu 144pt, tăng 20% từ 120pt; cảnh mục tiêu 240pt.
- Giới hạn theo chiều rộng và không quá 55% vùng dưới header của Home. Khi
  màn hình ngắn, thu cả thú/cảnh cùng tỷ lệ; giữ các thẻ cuộn được.
- Một module bố cục Home tính kích thước, đường đất và giới hạn điểm ngủ.
  Giữ nguyên tỷ lệ cấp của renderer dùng chung ở các màn khác.
- Tiêu chí: cảnh nằm trong chiều ngang màn hình; trên cảnh có khoảng hở ít
  nhất spacing.md với viewport thẻ; đường đất không đổi giữa mọc/ngủ/tan.
- Kiểm tra: Jest hình học trên các kích thước 320×568, 390×844, 430×932 và ngang.

## 2. Tích hợp vào Home

- HomePetRoamer báo chiều cao dành cho Linh Lộc qua callback. HomeScreen
  chừa vùng đó ngoài ScrollView thẻ; không thay dữ liệu pet hoặc gọi API mới.
- Canvas, hit target, tốc độ bước/đường bay, biên kéo và điểm ngủ cùng dùng
  kích thước mới. Cảnh thức giữ đúng vị trí/cấp đang ngủ và được căn lại khi resize.
- Các loài khác giữ bố cục hiện tại; cảnh cấp18 ứng viên vẫn ở bước duyệt art.
- Tiêu chí: không chạm thẻ ở mọi cấp, wake sớm không nhảy cỡ, kéo/thả vẫn hoạt động.
- Kiểm tra: HomeScreen, HomePetRoamer, HomeSleepScene và PixelPet regressions.

## 3. Kiểm tra và hoàn thiện

- Reviewer chỉ đọc rà plan trước và diff sau vì thay đổi xuyên đường render/drag.
- Typecheck, ESLint các file ảnh hưởng; iOS export nếu nguồn/thiết bị cho phép.
- Xem Home trên Simulator, đối chiếu các cấp/thước màn hình; ghi đúng giới hạn
  kiểm chứng. Cập nhật SPEC và checklist, giữ các thay đổi khác trong worktree.

Phụ thuộc: 1 → 2 → 3. Mỗi phần có checkpoint trước khi sang phần sau.
Không thêm dependency, không đổi dữ liệu lưu, không deploy.

Đã hoàn tất; số liệu kiểm tra và giới hạn native tại
[celestial-stag-home-scale-result.md](celestial-stag-home-scale-result.md).
