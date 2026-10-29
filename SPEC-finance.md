# Spec: Quản lý thu nhập và chi tiêu

## Objective

Thêm tab Tài chính cho người dùng đã đăng nhập LifeMate để ghi lại thu nhập (bao gồm lương) và chi tiêu, xem báo cáo theo năm với khoảng tháng tự chọn, các giao dịch chi tiết theo tháng và tổng hợp của kỳ. Firestore lưu dữ liệu bền theo Firebase UID; AsyncStorage giữ cache mã hóa cục bộ.

## Tech Stack

- React Native 0.83, TypeScript strict, React Navigation bottom tabs.
- Zustand cho state dùng chung; Firestore cho dữ liệu bền theo UID, AsyncStorage giữ cache mã hóa cục bộ.
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
- `src/services/finance/loanStorage.ts`, `src/hooks/useLoanLedger.ts` và `src/screens/Finance/LoanLedgerModal.tsx`: mục Cho vay theo UID, ghi nhận từng lần nhận lại và giao dịch liên kết.

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

### Chia khoản chi cho người cần trả lại

- Trong Thêm/Sửa giao dịch chi → Có người cần trả lại có ba cách: **Tự nhập**
  (mặc định), **Chia đều**, **Theo suất**. Chia đều mặc định gồm phần của tôi,
  cho phép bỏ phần của tôi nếu chỉ trả hộ. Theo suất nhập số suất từng người;
  suất của tôi có thể 0, suất người cần trả phải >0. Hỗ trợ tối đa hai chữ số
  thập phân, dấu chấm/phẩy (ví dụ 1,5), giới hạn 9.999,99 suất.
- Chia tự động tính lại ngay khi thay tổng tiền/thành viên/suất; số tiền tự
  tính chỉ đọc. Đổi sang Tự nhập giữ số tiền đang xem để sửa tiếp. Chặn suất
  sai hoặc hóa đơn quá nhỏ khiến có người cần trả 0đ.
- Phân bổ theo tỷ lệ, làm tròn xuống đến đồng và chia các đồng còn lại cho
  phần có số dư lớn nhất; bằng nhau theo thứ tự tôi rồi từng người trong form.
  Tổng phần của tôi và tiền các người khác luôn khớp hóa đơn; dùng BigInt cho
  phép nhân/chia để không sai số với tổng tiền lớn trong giới hạn safe integer.
- Giữ cấu trúc lưu SharedExpense hiện tại (participants/receipts). Chỉ lưu số
  tiền kết quả; mở giao dịch cũ ở Tự nhập, giữ nguyên ID người, nợ đã lưu và
  các lần nhận lại. Không được chia lại thấp hơn tiền đã nhận hoặc xóa người
  đã trả tiền. Cách tính báo cáo/nhận lại không đổi; không thêm rules/schema.

- Người dùng có thể ghi giao dịch thu nhập/lương và chi tiêu với số tiền, danh mục, mô tả ngắn.
- Khi nhập tiền trong Thu chi, Thu nhập, Chi tiêu, Cho vay hoặc Đóng hộ, ô nhập hiện số có dấu phân cách hàng nghìn và ký hiệu `đ`; dòng bên dưới đọc số tiền bằng chữ để đối chiếu trước khi lưu.
- Thu chi mặc định là tháng hiện tại; người dùng tìm tháng bằng picker năm/tháng hoặc chuyển tháng trước/sau. Giao dịch mới cho chọn ngày phát sinh.
- Thu nhập cộng các khoản thu thông thường (công ty/ngoài công ty). Khoản nhận lại từ cho vay hoặc chi chung được tính giảm chi trong báo cáo theo ngày nhận, không cộng vào thu nhập; tổng chi báo cáo vì vậy có thể âm trong kỳ chỉ nhận lại tiền. Cả hai báo cáo giữ tên và số tiền của danh mục cũ hoặc tự tạo đã xóa để không bỏ sót giao dịch. Mỗi báo cáo mặc định cả năm hiện tại, có thể chọn từ tháng A/năm B đến tháng C/năm D.
- Báo cáo có tổng kỳ, tổng danh mục có phát sinh và tổng từng tháng; chạm tháng để mở/thu gọn từng khoản. Home hiển thị tổng Thu/Chi theo ngày: chỉ cộng các khoản phát sinh, không tính các khoản nhận lại từ cho mượn hoặc thu lại tiền đóng hộ và không trừ chúng vào Chi mới. Ví dụ nhận lại 10.000đ rồi chi ăn 30.000đ thì Chi trên Home là 30.000đ. Tổng tháng và quy tắc giảm chi trong báo cáo vẫn xem trong tab Tài chính.
- Tab và nút thêm ở header cố định. Dấu cộng trong tháng điền sẵn ngày của tháng và loại thu/chi đang xem. Đóng picker chưa chọn tháng giữ kỳ đã áp dụng.
- Giao dịch được lưu trong Firestore dưới UID chủ sở hữu để còn sau khi gỡ/cài lại; AsyncStorage giữ cache mã hóa và dữ liệu local cũ được chuyển lên cloud.
- Chỉ người dùng đã đăng nhập đúng UID mới được đọc/ghi giao dịch của họ; khi cloud chưa kết nối, giao diện phân biệt rõ dữ liệu chưa sao lưu.
- Người dùng có thể xóa một giao dịch; trạng thái rỗng, loading và lỗi được trình bày rõ.
- Mục Cho vay ghi người vay, tiền gốc, hạn trả tùy chọn và nhắc cục bộ tùy chọn. Tạo khoản vay ghi giao dịch chi `loan_lending`; nhận lại một phần/toàn phần ghi nguồn thu riêng `loan_repayment`. Lịch sử cho vay thêm và nhận lại có thao tác sửa/xóa từng mục. Sửa tiền gốc cập nhật khoản vay và khoản chi trong cùng transaction, không cho thấp hơn tổng đã nhận. Xóa lần cho vay ban đầu giữ các mục còn lại và lấy lần cho vay thêm đầu tiên làm khoản gốc mới. Nhắc hạn được hủy khi tất toán, xóa hoặc đăng xuất.
- Cài đặt có khóa Tài chính bằng Face ID/Touch ID/sinh trắc học mạnh của Android, với mật mã thiết bị làm fallback hệ điều hành. Bật/tắt đều xác thực. Chỉ tab Tài chính yêu cầu xác thực (khi mở tab, hoặc khi app quay lại từ background ngay tại tab này); chuyển tab không khóa lại; background hoặc đổi UID khóa lại. Thiết lập theo UID trên từng thiết bị, lưu SecureStore; lỗi đọc thiết lập không mở dữ liệu.
- Các kiểm tra dự án nêu trên đều đạt.

## Open Questions

- Không có câu hỏi chặn. Firestore là nguồn dữ liệu bền; AsyncStorage giữ cache mã hóa/offline fallback.

- Sửa giao dịch truyền snapshot lúc mở form đến service. Nếu cache đã đổi trong
  lượt refresh, từ chối lưu trước khi ghi và giữ draft, không dùng cache mới làm
  baseline để ghi đè các trường cũ của draft.
- Sửa lần nhận lại chi chung dùng snapshot giao dịch lúc mở form; xóa dùng snapshot
  lúc mở xác nhận. Refresh không đổi baseline của thao tác đang mở. Retry thêm mới
  cùng requestId và nội dung đã lưu được xác nhận mà không ghi thêm lần nhận.
- Refresh tên/email cùng UID không hủy tải sổ Cho vay; logout/đăng nhập lại vẫn
  loại kết quả phiên trước và request kết thúc phải nhả trạng thái loading.
- Xác nhận xóa giao dịch, nhận lại chi chung, khoản vay/các lần cho vay và nhận
  lại, cùng lựa chọn xung đột phải mất hiệu lực khi lớp khóa xuất hiện, dialog
  đóng, đổi chủ dữ liệu hoặc unmount. Mở lại dialog không khôi phục callback
  xác nhận cũ. Android date picker cũng bỏ qua kết quả sau khi dialog đóng.

- Xóa toàn bộ khoản cho vay xóa đồng thời giao dịch cho vay ban đầu, cho vay thêm và nhận lại, rồi tải lại báo cáo. Giữ marker xóa để thiết bị cũ không tạo lại khoản/giao dịch. Với hồ sơ đã xóa theo bản cũ, người dùng có thể xóa toàn bộ giao dịch còn sót qua xác nhận xóa từ một giao dịch liên kết trong Thu chi; không tự động xóa lịch sử cũ khi tải sổ.
