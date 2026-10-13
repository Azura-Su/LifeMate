# Tiền hoàn trả khoản vay: giảm Chi tiêu, không tăng Thu nhập — 12/10/2026

## Kết quả cần đạt

- Tiền **cho vay** vẫn là khoản chi `Cho vay` vào ngày đưa tiền.
- Tiền **nhận lại** giảm khoản chi `Cho vay` vào ngày thực nhận, kể cả khi trả nhiều lần; không tăng bất kỳ tổng hoặc nhóm nào ở tab Thu nhập.
- `Còn lại = Thu nhập − Chi tiêu ròng` giữ nguyên so với dòng tiền hiện tại. Không thay đổi số dư khoản vay trong mục Cho vay.
- Trong kỳ chỉ nhận lại tiền của khoản cho vay ở kỳ trước, Chi tiêu hoặc nhóm `Cho vay` có thể là số âm. Hiển thị giá trị âm rõ ràng, không ép về 0 và không hồi tố ngày cho vay.

Ví dụ: cho vay 1.500.000 ₫ và nhận lại 500.000 ₫ cùng kỳ → `Cho vay` còn 1.000.000 ₫ trong Chi tiêu; Thu nhập không tăng; Còn lại không đổi. Nếu nhận lại ở tháng sau, tháng cho vay vẫn ghi chi 1.500.000 ₫ và tháng nhận lại ghi giảm chi 500.000 ₫.

## Phạm vi và tác động đã rà

1. **Dữ liệu giao dịch:** `loanStorage.ts` hiện lưu lần nhận tiền là giao dịch `type: 'income'`, `incomeSource: 'loan_repayment'`, gắn `loanId`/`repaymentId`. Firestore rules bắt buộc cấu trúc này. Giữ nguyên bản ghi, ID, đồng bộ, quyền truy cập và lịch sử; đổi phép phân loại **khi lập báo cáo** để áp dụng cho cả dữ liệu cũ. Chỉ nhận diện bằng marker `incomeSource`, không suy đoán từ tên danh mục.
2. **Tổng Thu chi:** `getFinanceReport` đang cộng khoản hoàn trả vào Thu. Đổi thành `Thu = các khoản thu thông thường`, `Chi = các khoản chi − tiền hoàn trả` cho cả tổng và từng tháng. Vì `Thu − Chi` không đổi, số `Còn lại` và dòng tiền vẫn khớp.
3. **Hai tab báo cáo:** `getIncomeReport` loại khoản hoàn trả ở mọi bộ lọc. `getExpenseReport` đưa khoản này vào nhóm `Cho vay` với dấu âm, đúng tháng nhận tiền. Giữ các giao dịch gốc để mở liên kết tới khoản vay; không tạo giao dịch chi âm hay sao chép dòng thu. Báo cáo năm, tháng, khoảng tháng và danh sách theo ngày phải dùng cùng quy tắc.
4. **Giao diện:** bỏ lựa chọn `Thu hồi` khỏi bộ lọc nguồn của tab Thu nhập; mục Cho vay vẫn mở được từ tab Thu chi và liên kết giao dịch. Tab Chi tiêu hiển thị dòng “Nhận lại tiền từ …” như khoản giảm chi và tổng `Cho vay` ròng. Cập nhật nhãn/empty state, số lượng khoản, dấu của số tiền, hàng danh mục bằng 0 hoặc âm để không che hoạt động hoàn trả hoặc làm người dùng hiểu nhầm là thu nhập mới.
5. **Tài liệu:** cập nhật mô tả cũ trong `tasks/loan-ledger-plan-2026-10-11.md` và `docs/finance-cloud-storage.md` khi triển khai; hiện chúng còn nói tiền thu hồi cộng vào Thu.

## Thứ tự triển khai

- [x] Tạo một hàm phân loại đóng góp báo cáo dùng chung: giao dịch thu thông thường `(+Thu, 0 Chi)`; giao dịch chi `(+Chi)`; khoản hoàn trả `(0 Thu, −Chi ở Cho vay)`. Dùng hàm này cho tổng Thu chi và báo cáo danh mục để tránh hai phép tính lệch nhau. Không đổi `FinanceTransaction` đã lưu.
- [x] Cập nhật tổng theo tháng/năm/khoảng tháng và nhóm danh mục. Gắn khoản hoàn trả vào ngày nhận, cộng đúng một lần, giữ transaction gốc/ID cho thao tác mở khoản vay. Rà nhánh khoản vay đã xóa nhưng giao dịch liên kết còn được giữ.
- [x] Cập nhật ba tab Thu chi, Thu nhập, Chi tiêu: bộ lọc nguồn, danh mục `Cho vay`, danh sách theo ngày, nhãn tổng và số âm/0. Trạng thái “chưa phát sinh” dựa trên giao dịch trong kỳ thay vì `total > 0`.
- [x] Cập nhật tài liệu, rà thay đổi với dữ liệu chưa commit hiện có; không đụng Firebase rules, Supabase hoặc dữ liệu người dùng nếu không phát hiện nhu cầu schema mới.

## Các trường hợp cần kiểm chứng khi triển khai

| Trường hợp                                           |           Thu nhập |           Chi tiêu / Cho vay |                      Còn lại |
| ---------------------------------------------------- | -----------------: | ---------------------------: | ---------------------------: |
| Cho vay 1.500.000 ₫, chưa trả                        |                0 ₫ |                 +1.500.000 ₫ |                 −1.500.000 ₫ |
| Nhận lại 500.000 ₫ cùng kỳ                           |                0 ₫ |             còn +1.000.000 ₫ |                 −1.000.000 ₫ |
| Nhận lại 500.000 ₫ ở kỳ sau, không có khoản chi khác |                0 ₫ |      −500.000 ₫ trong kỳ sau |      +500.000 ₫ trong kỳ sau |
| Trả hết qua nhiều lần                                | 0 ₫ từ các lần trả | 0 ₫ ròng trên toàn thời gian | 0 ₫ ròng trên toàn thời gian |

Ngoài bảng trên: kiểm tra nhiều người vay/nhiều khoản, lần cho vay thêm, hoàn trả một phần, bộ lọc Thu nhập “Tất cả”, báo cáo năm/tháng/khoảng tháng, năm giao nhau, giao dịch liên kết còn lại sau xóa hồ sơ, làm mới/đồng bộ và khả năng mở đúng khoản vay từ dòng hoàn trả. Đối chiếu tổng danh mục với tổng Chi tiêu và đối chiếu `Thu − Chi` trước/sau sửa trên cùng dữ liệu. Khi được giao triển khai và kiểm chứng, bổ sung kiểm tra hồi quy cho các phép tính này rồi chạy kiểm tra phù hợp trước phát hành.

## Giới hạn thay đổi

- Không chuyển giao dịch hoàn trả đã lưu từ `income` sang `expense`: Firestore rules và liên kết khoản vay đang phụ thuộc cấu trúc này; việc đổi dữ liệu sẽ cần migration và có nguy cơ đồng bộ sinh bản ghi trùng.
- Không sửa ngày phát sinh của khoản cho vay cũ. Khoản nhận lại được tính vào kỳ nhận tiền để báo cáo từng tháng phản ánh đúng dòng tiền.
- Thay đổi này chỉ tác động phép tính và hiển thị báo cáo; không ghi lại dữ liệu đã lưu hoặc phát hành rules.

## Kết quả triển khai

Đã triển khai phần tính báo cáo và giao diện ngày 12/10/2026. TypeScript, ESLint,
Prettier và `git diff --check` đều đạt. Chưa chạy hoặc thêm kiểm tra tự động trong
lượt này; chưa phát hành ứng dụng hay thay đổi rules/dữ liệu cloud.
