# Spec: Quản lý thu nhập và chi tiêu

## Objective

Thêm tab Tài chính cho người dùng đã đăng nhập LifeMate để ghi lại thu nhập (bao gồm lương) và chi tiêu, xem báo cáo theo năm với khoảng tháng tự chọn, các giao dịch chi tiết theo tháng và tổng hợp của kỳ. Firestore lưu dữ liệu bền theo Firebase UID; AsyncStorage làm cache cục bộ.

## Tech Stack

- React Native 0.83, TypeScript strict, React Navigation bottom tabs.
- Zustand cho state dùng chung; Firestore cho dữ liệu bền theo UID, AsyncStorage làm cache cục bộ.
- Giao diện dùng component `Screen`, theme và button hiện có.

## Commands

- Tests: `npm test -- --runInBand`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Bundles: `npm run bundle`

## Project Structure

- `src/types/finance.ts`: giao dịch và danh mục.
- `src/services/finance/financeStorage.ts`: đồng bộ Firestore theo UID, migrate cache cũ và xác thực dữ liệu.
- `src/store/financeStore.ts`: Zustand state/actions có kiểm tra UID.
- `src/hooks/useFinanceAccount.ts`: nạp tài khoản và chặn dữ liệu/trạng thái khác UID ngay khi render.
- `src/screens/Finance/`: tab, form và tổng hợp.
- `src/navigation/`: route và integration test tab.
- `src/services/finance/loanStorage.ts`, `src/hooks/useLoanLedger.ts` và `src/screens/Finance/LoanLedgerModal.tsx`: sổ khoản cho mượn theo UID, xác nhận trả và giao dịch Thu hồi có liên kết.

## Code Style

Theo cấu trúc screen/hook/styles và component hiện tại; validate dữ liệu đầu vào ở service boundary; chỉ dùng màu, button và typography từ `src/theme`.

## Testing Strategy

- Unit tests cho parse/validate và đọc/ghi storage theo UID.
- Store tests cho nạp tài khoản, thêm/xóa giao dịch và cách ly UID.
- Component tests cho summary, danh sách, form và các trạng thái trống/loading/lỗi.
- Navigation integration test xác nhận tab mới.
- Chạy Jest, typecheck, lint và bundle Android/iOS.

## Boundaries

- Always: chỉ cho số tiền hữu hạn lớn hơn 0; kiểm tra owner UID; không render dữ liệu tài chính của tài khoản khác; dùng theme hiện có.
- Ask first: ngân sách định kỳ, xuất báo cáo hoặc thêm thư viện mới.
- Never: cho phép UID khác đọc/ghi giao dịch, ghi dữ liệu tài chính vào log, hoặc lưu cache dưới một key dùng chung giữa các tài khoản.

## Success Criteria

- Người dùng có thể ghi giao dịch thu nhập/lương và chi tiêu với số tiền, danh mục, mô tả ngắn.
- Thu chi mặc định là tháng hiện tại; người dùng tìm tháng bằng picker năm/tháng hoặc chuyển tháng trước/sau. Giao dịch mới cho chọn ngày phát sinh.
- Thu nhập cộng mọi khoản thu; Chi tiêu chỉ cộng các khoản chi. Cả hai báo cáo giữ tên và số tiền của danh mục cũ hoặc tự tạo đã xóa để không bỏ sót giao dịch. Mỗi báo cáo mặc định cả năm hiện tại, có thể chọn từ tháng A/năm B đến tháng C/năm D.
- Báo cáo có tổng kỳ, tổng danh mục có phát sinh và tổng từng tháng; chạm tháng để mở/thu gọn từng khoản. Home không hiển thị số liệu tài chính; tổng tháng xem trong tab Tài chính.
- Tab và nút thêm ở header cố định. Dấu cộng trong tháng điền sẵn ngày của tháng và loại thu/chi đang xem. Đóng picker chưa chọn tháng giữ kỳ đã áp dụng.
- Giao dịch được lưu trong Firestore dưới UID chủ sở hữu để còn sau khi gỡ/cài lại; AsyncStorage là cache và dữ liệu local cũ được chuyển lên cloud.
- Chỉ người dùng đã đăng nhập đúng UID mới được đọc/ghi giao dịch của họ; khi cloud chưa kết nối, giao diện phân biệt rõ dữ liệu chưa sao lưu.
- Người dùng có thể xóa một giao dịch; trạng thái rỗng, loading và lỗi được trình bày rõ.
- Sổ cho mượn ghi người vay, tiền gốc, hạn trả tùy chọn và nhắc cục bộ tùy chọn. Tạo khoản vay ghi giao dịch chi `loan_lending`; nhận lại một phần/toàn phần ghi nguồn thu riêng `loan_repayment`. Sửa tiền gốc cập nhật khoản vay và khoản chi trong cùng transaction, không cho thấp hơn tổng đã nhận. Xóa khoản chưa nhận lại tiền xóa cả khoản chi liên kết; khoản chi còn sót từ hồ sơ đã xóa trước đây có thể xóa trong Tài chính nếu chưa có lần nhận tiền. Xóa khoản đã có lịch sử nhận tiền vẫn giữ các giao dịch Chi/Thu để bảo toàn lịch sử. Nhắc hạn được hủy khi tất toán, xóa hoặc đăng xuất.
- Cài đặt có khóa Tài chính bằng Face ID/Touch ID/sinh trắc học mạnh của Android, với mật mã thiết bị làm fallback hệ điều hành. Bật/tắt đều xác thực. Chỉ tab Tài chính yêu cầu xác thực (khi mở tab, hoặc khi app quay lại từ background ngay tại tab này); chuyển tab không khóa lại; background hoặc đổi UID khóa lại. Thiết lập theo UID trên từng thiết bị, lưu SecureStore; lỗi đọc thiết lập không mở dữ liệu.
- Các kiểm tra dự án nêu trên đều đạt.

## Open Questions

- Không có câu hỏi chặn. Firestore là nguồn dữ liệu bền; AsyncStorage giữ cache/offline fallback.
