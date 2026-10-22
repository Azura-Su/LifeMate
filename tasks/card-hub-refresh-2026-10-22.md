# Cố định tab và kéo tải lại bảng điểm — 22/10/2026

Yêu cầu đã chốt: giữ `Tính điểm` / `Chơi online` cố định dưới header, chỉ phần
nội dung bên dưới cuộn. Tab Tính điểm có pull-to-refresh; danh mục Chơi online chỉ
cuộn, không loading tải lại và không tự kết nối phòng.

## Thay đổi

- Dùng `Screen.fixedContent` hiện có cho hai tab ở cả hai route, spacing theo theme.
  Bàn chơi/lobby giữ chế độ tĩnh hiện có.
- Dùng native `RefreshControl` cho Tính điểm. Đọc bảng chung rồi đọc lại dữ liệu
  cục bộ; giữ nội dung và bàn đang chọn, không bật lại loading toàn màn hình.
- Nếu đang có request đồng bộ thì chờ cùng request đó. Spinner theo tiến trình
  request/cache thực, không đặt timer giả hoặc tạo request trùng.
- Chặn kéo trùng, khi đang lưu/đọc ban đầu hoặc đã đổi phiên; bỏ kết quả đến muộn
  khi blur/unmount/đổi UID hoặc session epoch. Kéo lại thành công cũng phục hồi được
  trường hợp lần đầu đọc local bị lỗi. Lỗi mạng giữ cache và quyền shared chỉ xem.
- Không thay backend, schema, luật chơi, cách tính điểm hoặc quyền sửa bảng.

## Kiểm chứng

- Chín test mới RED trước khi sửa, sau đó GREEN: vị trí tab cả hai route; giữ bàn
  đang chọn/nội dung; spinner và dedup; shared deletion; lỗi mạng; phục hồi local;
  blur/account fence; chờ request đã chạy.
- Test cũ gọi `act(() => retry())` chuyển sang explicit `void` vì retry nay trả về
  Promise; hai thao tác xóa/kết thúc trong test được chờ bằng async act, giữ nguyên
  assertions và timeout. Không nới kiểm tra.
- Hồi quy trò chơi/tính điểm, services/hooks/config/utils, Screen và navigation:
  **23 suite / 242 test đạt**.
- `npm run typecheck`, ESLint các file bị sửa và `git diff --check`: đạt.
- Review độc lập kế hoạch và diff: không còn phát hiện cần xử lý.
- Đã nạp lại app trên iPhone 17 Pro Max Simulator, kiểm tra bố cục Tính điểm,
  chuyển qua danh mục online và mở form tạo/vào phòng; không tạo/join phòng thật.
  Chưa quan sát được spinner thoáng qua trong ảnh sau gesture; trạng thái pending,
  lỗi và hoàn tất đã kiểm tra bằng các request trì hoãn trong Jest.

`npm run bundle` xuất iOS/Android thành công. Chưa kiểm tra gesture trên Android thật.
Baseline riêng của lượt sửa ở `/private/tmp/lifemate-card-hub-refresh-20261022/before/`;
giữ nguyên các thay đổi working tree có sẵn. Không deploy trong lượt này.
