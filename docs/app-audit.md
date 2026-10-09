# Rà soát thiết kế và tính năng LifeMate — 08/10/2026

## Phạm vi và căn cứ

Rà Login/auth gate, Home, ba chế độ Tài chính, form giao dịch, MP3/playlist/player, thư viện, cắt/ghép, Cài đặt, component dùng chung và dữ liệu theo UID. Đọc implementation/tests; quan sát trực tiếp Home, Cài đặt, MP3, thư viện, cắt, Tài chính và form trên iPhone Simulator. Các yêu cầu đã chốt về header cố định, chỉ cuộn file ở MP3, kéo sắp xếp, repeat và bản gốc được giữ khi cắt/ghép tiếp tục là tiêu chí bắt buộc.

## Phát hiện và hướng xử lý

| Ưu tiên | Bằng chứng                                                                                                                  | Hướng sửa                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| P1      | `useFinanceScreen` đọc toàn bộ store trước effect bind UID mới; có thể render giao dịch tài khoản cũ trong lần render đầu.  | Hook account chung lọc dữ liệu/trạng thái theo UID ngay khi render; kiểm thử chuyển tài khoản khi tải còn chờ. |
| P1      | Báo cáo chi bỏ giao dịch chi có danh mục ngoài sáu danh mục chuẩn dù tổng thu chi vẫn cộng.                                 | Giữ mọi giao dịch chi hợp lệ; nhóm danh mục cũ vào Khác.                                                       |
| P2      | Đổi năm trong picker ghi thẳng bộ lọc; đóng picker mà chưa chọn tháng vẫn đổi kỳ.                                           | Picker có draft riêng, chỉ áp dụng khi chọn tháng; đóng giữ kỳ đang xem.                                       |
| P2      | Thanh chuyển báo cáo và nút thêm bị cuộn khỏi màn; nút thêm thu/chi nằm sau toàn bộ lịch sử.                                | Đặt tab và nút thêm trong header cố định; tạo giao dịch theo kỳ đang xem.                                      |
| P2      | Báo cáo rỗng có sáu dòng 0 đồng và lặp tên báo cáo; lịch sử năm mở hết giao dịch.                                           | Bộ lọc gọn, chỉ hiện danh mục phát sinh, mỗi tháng có tổng và mở/thu gọn chi tiết.                             |
| P2      | Home chỉ có hero và lối vào MP3 dù Tài chính đã là tính năng chính.                                                         | Tổng thu/chi/còn lại của tháng hiện tại và lối vào Tài chính; giảm phần trang trí.                             |
| P2      | Thư viện chỉ duyệt danh sách toàn bộ, chọn ghép thiếu nút bỏ chọn cùng lúc; caption dùng tên nút đã thay đổi.               | Tìm tên file không phân biệt dấu, báo kết quả rỗng, bỏ chọn nhanh, sửa hướng dẫn membership.                   |
| P2      | Tiền nhập chỉ là chuỗi số; form cần cuộn tới Hủy khi bàn phím mở; dòng giao dịch chia nhiều cột làm ghi chú bị cắt quá sớm. | Hiện số tiền định dạng, nút back ở đầu form, bố cục ghi chú/tiền rõ hơn.                                       |
| P2      | Lỗi đồng bộ Tài chính có thể hiện thông báo SDK; version Cài đặt là chuỗi cố định; email Login thiếu chuyển sang mật khẩu.  | Ánh xạ lỗi tiếng Việt, version từ app config, phím Next và lời dẫn Login rõ mục đích.                          |

## Các luồng được giữ

- Firebase auth gate, fallback tên Remote Config, quyền push và logout đã có tests.
- Audio import local trước cloud, session guards, delete confirmation, success message 3 giây, selection reset, trim/merge preview và range handles đã có tests. Runtime editor và library hoạt động trong phiên đang đăng nhập.
- Playlist/reorder, repeat bài/cả danh sách và background playback được giữ; không đổi native audio engine hay schema cloud.
- Cài đặt đã gọn và version ở cuối; chỉ lấy version từ app config để tránh lệch khi đổi phiên bản.

## Giới hạn kiểm chứng

Rà soát không ghi/xóa giao dịch hay file cá nhân để thử. Luồng lưu/xóa được kiểm chứng bằng tests với Firestore fake và rules emulator đã có. Push thật/APNs, Android trên thiết bị và thử audio cloud bằng hai tài khoản/fixture vẫn là kiểm chứng triển khai riêng trong checklist cũ.

## Kết quả

Đã thực hiện các hướng sửa trong bảng. Hook account dùng chung cho Home/Tài chính; báo cáo thu và chi dùng cùng component để giữ bộ lọc, tháng và form nhất quán. Không thêm dependency hay thay native audio engine. README, SPEC, CAPABILITIES và SPEC-finance đã cập nhật theo bốn tab và hành vi hiện tại.

- Jest: **44 suites / 190 tests pass**; regression tests gồm render đầu khi đổi UID, danh mục chi cũ, hủy picker sau đổi năm, mở/thu gọn tháng, thêm đúng kỳ, số tiền định dạng, Home và tìm kiếm/bỏ chọn MP3.
- `npm run typecheck`, `npm run lint`, Prettier và `git diff --check`: pass.
- `EXPO_NO_TELEMETRY=1 npm run bundle`: xuất Hermes Android và iOS thành công.
- Simulator: xem Home/tháng hiện tại, trạng thái báo cáo chi rỗng, tổng thu năm 2025/2026, mở tháng 1/2026, form có tiền định dạng/back, tìm `FILE 1`, xóa bộ lọc và bỏ chọn ghép. Không lưu/xóa dữ liệu cá nhân trong kiểm tra này.

Vị trí header/tabs/nút thêm ngoài vùng cuộn được kiểm tra bằng component tests. Công cụ Simulator không tạo được cuộn bằng wheel/drag trong phiên kiểm tra cuối; không coi thao tác này là đã kiểm chứng runtime. Bàn phím phần mềm, font phóng lớn và gesture trên thiết bị Android thật còn cần kiểm tra thiết bị.

Theo dõi các bước đã hoàn tất tại [tasks/todo.md](../tasks/todo.md). Các kiểm chứng cloud/push thật còn mở ở checklist triển khai cũ được giữ nguyên.
