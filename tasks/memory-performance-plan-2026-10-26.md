# Tối ưu phản hồi Ký ức — 26/10/2026

## Bằng chứng và phạm vi

Luồng chụp mở editor sau khi camera trả file. Lưu riêng đã kết thúc sau copy file
và ghi cache mã hóa, còn sao lưu gốc chạy nền. Luồng Bạn bè phải chờ nén JPEG,
publish, upload, confirm và ghi quyền xem trước khi báo hoàn tất.

Ba phần có thể giảm công việc mà vẫn giữ các ranh giới trên:

1. `getMemoryShareState` hiện tạo request riêng cho mỗi caller. Camera/focus và
   chuyển timeline có thể cùng chờ các request state giống nhau. Chỉ gộp request
   đang chạy, khóa theo UID + sessionEpoch + displayName; kết quả hoàn tất không
   trở thành cache quyền. Mutation vô hiệu request dùng chung cả lúc bắt đầu
   và khi kết thúc (kể cả lỗi) để lần đọc mới không lấy snapshot trước mutation.
2. JPEG Bạn bè hiện resize theo chiều rộng 1024 rồi 760, khiến ảnh dọc cao hơn
   ngưỡng và ảnh nhỏ bị phóng lớn. Với ảnh mới có kích thước camera/picker,
   chuyển sang cạnh dài tối đa1024/760, giữ tỷ lệ và quality0,72/0,52; không thay
   bản gốc riêng. Kích thước đi kèm draft/new-photo save, không lưu Entry/cloud.
   Ảnh cũ thiếu metadata giữ bước width-first đầu tiên. Dùng cùng context native
   cho hai lần thử để không decode lại file gốc khi fallback.
3. Editor đọc kích thước ảnh bằng `Image.getSize` dù camera đã cung cấp kích
   thước. Truyền width/height hợp lệ cùng URI; chỉ bỏ đọc lại khi biết metadata
   thật, không coi tỷ lệ dự phòng3/4 là metadata. Picker thay ảnh dùng metadata
   mới hoặc đọc lại nếu thiếu.

## Công việc và kiểm chứng

- [x] Reviewer chỉ đọc rà plan trước implementation, tập trung mutation/session
  fences và quyền riêng tư.
- [x] Gộp state request đang chạy. Regression: hai caller dùng một request;
  sau hoàn tất/lỗi/mutation/đổi phiên phải đọc mới. Giữ deadline20 giây và retry.
- [x] Tách xử lý JPEG vào helper nhỏ; ảnh mới đủ metadata dùng cạnh dài và không
  phóng ảnh nhỏ; kiểm tra <=2MB, legacy fallback, cleanup, lỗi render/save.
- [x] Bỏ đọc kích thước thừa cho ảnh camera; kiểm tra fallback và đổi ảnh.
- [x] Chạy Jest Memories/service, typecheck, lint và diff review; kiểm tra native
  nếu có camera phù hợp. Giữ thay đổi Home đang có trong working tree.

## Tiêu chí đo trước/sau

- Hai yêu cầu state đồng thời: từ 2 request HTTP xuống 1; đọc mới sau mutation
  vẫn phát sinh request riêng. Không dùng thời gian mock để tuyên bố độ trễ mạng.
- Ảnh dọc 4000×6000: cũ 1024×1536 (~1,57 triệu pixel), mới khoảng683×1024
  (~0,70 triệu pixel); ảnh ngang giữ ngưỡng cũ, ảnh nhỏ không upscale. Kích thước
  JPEG thực tế và tốc độ mạng phải đo trên thiết bị, không suy từ số pixel.
- Editor ảnh camera có tỷ lệ hợp lệ: từ 1 lần `Image.getSize` xuống 0.

Không bỏ bước ghi bền vững, xác nhận upload hoặc kiểm quyền; không thay schema,
backend, queue theo UID, độ phân giải camera/bản gốc hay dữ liệu đã lưu.

API đã đối chiếu dependency 55.0.21 và [Expo SDK55 ImageManipulator](https://docs.expo.dev/versions/v55.0.0/sdk/imagemanipulator/).

## Kết quả đo native và các phương án đã loại

Chạy JPEG encode thật trên iPhone17 Pro Max Simulator iOS26.3 bằng ba fixture
tổng hợp, không có ảnh người dùng hoặc upload cloud. Mỗi fixture có một lượt
warm-up cho mỗi thuật toán, bốn mẫu đo/thuật toán, xen kẽ thứ tự cũ/mới. Thời
gian tính đến khi kiểm tra dung lượng file xong, chưa bao gồm mạng.

| Fixture | Kích thước cũ → mới | JPEG cũ → mới | Trung vị xử lý cũ → mới |
|---|---|---|---|
| Dọc3000×4000 | 1024×1366 → 768×1024 | 311.836 → 210.768 byte (−32,4%) | 117,6 → 102,0ms |
| Ngang4000×3000 | 1024×768 → 1024×768 | 211.529 → 211.529 byte | 97,0 → 92,2ms; nằm trong dao động |
| Nhỏ480×640 | 1024×1366 → 480×640 | 214.160 → 86.094 byte (−59,8%) | 23,7 → 6,0ms |

- Đã loại phương án render ảnh gốc trước để đọc kích thước: fixture dọc tăng
  113,7→160,9ms, ảnh ngang tăng93,4→164,7ms.
- Đã loại phương án `Image.getSize` riêng trước resize: fixture dọc tăng
  115,5→255,9ms, ảnh ngang tăng91,8→253,2ms. Dùng metadata camera/picker trực tiếp
  để tránh cả hai chi phí này.
- Test tái hiện trước sửa có7 ca fail đúng các điểm công việc thừa. Sau sửa,
  request state đồng thời từ2 xuống1; metadata camera không gọi lại getSize.
- Kết quả cuối có trong `/private/tmp/lifemate-memory-perf-fixtures/final-metadata-path.json`.
  Màn benchmark tạm và fixture trong Simulator đã được dọn. Reviewer cuối không
  còn finding cần xử lý.
- Chưa đo camera vật lý/Android hoặc upload qua mạng thật; không quy đổi các
  số trên thành cam kết thời gian chụp hoặc upload của người dùng.
- Kiểm tra cuối: 201/201 test trong10 suite Ký ức/service đạt; typecheck, lint
  các file thay đổi và diff check đạt. Các cảnh báo `act(...)` có sẵn trong
  MemoryScreen tests vẫn xuất hiện nhưng không có test thất bại.
