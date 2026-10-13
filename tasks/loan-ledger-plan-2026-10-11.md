# Sổ cho mượn tiền — 11/10/2026

## Mở rộng: Một người có nhiều khoản khi tạo — 12/10/2026

### Luồng

1. Ô người mượn gợi ý tên đã có trong sổ của tài khoản, tìm theo tên; tên trùng được gợi ý một lần. So khớp không phân biệt hoa/thường và khoảng trắng thừa, vẫn phân biệt dấu tiếng Việt.
2. Với tên có khoản chưa trả, hiển thị hai lựa chọn: **Khoản riêng** (mặc định) và **Cộng khoản cũ**. Không tự gộp hồ sơ theo tên.
3. Chọn cộng khoản cũ phải chọn đúng thẻ: hiện số thứ tự, ngày cho mượn, số tiền ban đầu, còn nợ, hạn trả và ghi chú. Khoản đã tất toán/hủy không được chọn; khoản có lần nhận đang chờ đồng bộ bị khóa.
4. Khoản riêng giữ form ngày hẹn, nhắc và ghi chú riêng. Cộng khoản cũ dùng hạn/nhắc/ghi chú hiện tại và preview dư nợ; nút lưu ghi rõ hành động.
5. Dùng lại `onRecordAdvance` đã có và transaction/chống trùng. Không thay schema hoặc rules Firebase; không cần deploy lại.

### Công việc và nghiệm thu

- UI chọn người/khoản: gợi ý không lặp tên, thẻ phân biệt được nhiều khoản của cùng người; không chọn nhầm mặc định. Tách component để form chính chỉ xử lý draft/lưu.
- Tích hợp tạo/cộng: lưu khoản riêng bằng ID mới; cộng chỉ đúng ID đã chọn; chuyển người xóa lựa chọn cũ; chặn thao tác lặp khi đang lưu; lỗi giữ form để thử lại.
- Rà luồng tải lại/đổi người/khoản đóng, TypeScript, lint và whitespace; không thêm/chạy test trong lượt này theo chỉ dẫn phiên. Cập nhật tài liệu và ghi rõ giới hạn kiểm chứng UI.

### Bổ sung nội dung và ngày cho mượn thêm — 12/10/2026

- Mỗi lần cho thêm nhập nội dung bắt buộc (tối đa 120 ký tự để khớp giới hạn mô tả giao dịch chi) và chọn ngày trên lịch.
- Ghi nội dung vào lịch sử từng lần cho thêm và dòng giao dịch Chi. Dùng cùng timestamp ngày địa phương lúc 12:00 ở bản ghi cho thêm và giao dịch liên kết.
- Lưu ngày/nội dung trong retry intent mã hóa để gửi lại không tạo lần cho mượn trùng. Khoản cũ không có nội dung vẫn đọc được; rule chỉ yêu cầu nội dung với lần mới.
- Áp dụng cả popup **Cho mượn thêm** trên thẻ và chế độ **Cộng khoản cũ** trong form tạo.
- Kiểm tra TypeScript, ESLint, whitespace và biên dịch rules; chưa chạy test tự động hoặc kiểm tra UI trên iPhone.

## Mở rộng: Cho mượn thêm — 12/10/2026

Yêu cầu: cộng một lần cho mượn mới vào hồ sơ đang còn nợ của đúng người đó.

### Thiết kế

- Nút **Cho mượn thêm** chỉ ở khoản đang mở. Popup nhập tiền, xem còn nợ trước/sau, ghi nhận ngày hôm nay. Giữ hạn trả, ghi chú và nhắc hiện tại.
- `principalAmount` vẫn là khoản ban đầu; thêm `advances` (lịch sử tối đa 50 lần) và `additionalAmount` (tổng tiền thêm). Dữ liệu cũ không có hai trường này tương đương không có lần thêm. Tổng đã cho mượn = tiền ban đầu + tổng tiền thêm.
- Mỗi lần thêm có ID được lưu trước yêu cầu mạng và giao dịch chi riêng `loan-lent-{loanId}-{advanceId}`, có `advanceId`. Ghi hồ sơ và giao dịch trong một Firestore transaction; thử lại dùng cùng ID. Ngày giao dịch là ngày cho mượn thêm, không sửa giao dịch chi ban đầu.
- Rules chỉ cho nối thêm lịch sử, kiểm tra tổng tăng đúng và giao dịch chi đối ứng; không cho sửa/xóa lịch sử thêm bằng cập nhật ghi chú từ client cũ.
- Khi xóa hồ sơ chưa nhận tiền: xóa cả các giao dịch chi liên kết. Nếu đã nhận tiền: giữ dòng tiền, lưu tombstone kèm lịch sử thêm. Sửa tiền ban đầu không được làm tổng thấp hơn số đã nhận.
- Chỉ dùng Firebase Firestore hiện có, không thay Supabase.

### Thứ tự và nghiệm thu

1. **Mô hình + lưu trữ** (`types/loan`, `types/finance`, `utils/finance`, `loanStorage`): đọc được dữ liệu cũ; tăng đúng dư nợ; giao dịch bổ sung đúng ngày; timeout/retry không nhân đôi. Rà luồng và typecheck.
2. **Hook + giao diện** (`useLoanLedger`, `LoanLedgerModal`, styles, `FinanceScreen`): chỉ khoản đang mở cho thêm; preview rõ; loading đúng nút; lịch sử phân biệt cho thêm/đã trả; chặn phiên cũ. Typecheck/lint và rà diff.
3. **Rules + tài liệu**: append nguyên tử, bảo vệ lịch sử và quyền theo UID; compile rules trước phát hành project `baseapp-dd227`. Ghi đúng phạm vi kiểm chứng. Không thêm/chạy test tự động trong lượt này theo chỉ dẫn phiên.

### Rủi ro

- Timeout có thể xảy ra sau commit: lưu intent mã hóa, đối chiếu cloud trước retry.
- App cũ có thể ghi đè lịch sử: rules chặn mất trường/lịch sử mới.
- Một người có nhiều hồ sơ: thao tác từ thẻ hồ sơ cụ thể, không tự gộp theo tên.

## Mục tiêu

Theo dõi tiền đã cho người khác mượn, số còn phải thu và hạn trả. Khi tạo khoản vay, ghi khoản tiền đưa đi thành giao dịch Chi `Cho mượn`; khi xác nhận nhận lại tiền, ghi giao dịch Thu `Thu hồi cho mượn`. Cả hai giao dịch liên kết với khoản vay trong Tài chính; hỗ trợ trả từng phần. Nhắc ngày hẹn là tùy chọn và dùng thông báo cục bộ trên thiết bị.

## Quyết định thiết kế

- Tiền đưa cho mượn vừa làm giảm tiền hiện có, vừa được ghi là khoản chi `Cho mượn`; khoản phải thu vẫn được theo dõi riêng trong sổ. Có thể sửa tiền gốc và khoản chi liên kết đồng thời. Xóa hồ sơ chưa có lần nhận tiền sẽ xóa khoản chi để sửa trường hợp nhập nhầm; khoản chi còn sót từ hồ sơ đã xóa trước đây có thể xóa riêng khi tombstone xác nhận chưa nhận lại tiền. Nếu đã có lịch sử nhận tiền, các giao dịch Chi/Thu vẫn được giữ lại.
- Tạo mới khoản vay cần kết nối mạng để Firestore ghi hồ sơ và giao dịch chi liên kết trong cùng transaction. Khoản vay cũ được bổ sung giao dịch chi theo ID ổn định, tránh ghi trùng.
- Lưu bản ghi theo UID tại `financeAccounts/{uid}/loans/{loanId}` và cache mã hóa theo UID trên thiết bị, cùng quy ước phân quyền của Tài chính.
- Mỗi lần nhận tiền yêu cầu xác nhận số tiền (có thể trả một phần, không vượt số còn nợ). Tạo giao dịch Thu `Thu hồi cho mượn`, có `incomeSource: loan_repayment`, `loanId` và `repaymentId` để nhận diện, lọc báo cáo và chặn sửa/xóa giao dịch độc lập.
- Khoản thu hồi vẫn là dòng tiền vào và được lưu với `incomeSource: loan_repayment` để giữ liên kết/rules. Từ 12/10/2026, báo cáo không cộng vào Thu nhập: số tiền nhận lại giảm Chi tiêu ở danh mục `Cho vay` của kỳ nhận tiền. Số `Còn lại` không đổi; xem thêm `tasks/loan-repayment-expense-offset-plan-2026-10-12.md`.
- Nhắc hay không nhắc là lựa chọn khi tạo/sửa khoản. Nếu bật, nhắc lúc 09:00 ngày hẹn; không ghi tên người mượn hoặc số tiền vào nội dung notification. Quyền thông báo bị từ chối không ngăn lưu khoản vay.
- Không xóa lịch sử trả tiền; khoản đã tất toán vẫn xem lại được. Hạn trả có thể để trống.
- Tạo hồ sơ vay và giao dịch chi, hoặc ghi nhận trả nợ và giao dịch Thu, theo từng cặp nguyên tử bằng ID ổn định; không để lại một nửa cặp dữ liệu khi lỗi hoặc retry.

## Lát cắt triển khai

1. **Mô hình và lưu trữ (types, validation, local/cloud storage, Firestore rules):** bản ghi theo UID, kiểm tra số nguyên an toàn, ngày, giới hạn chuỗi, lịch sử trả, merge/retry an toàn; rules chỉ cho chủ tài khoản đọc/ghi đúng schema và buộc giao dịch chi/thu khớp khoản vay.
2. **Giao dịch Tài chính:** tạo giao dịch Chi liên kết `loan_lending` và giao dịch Thu `loan_repayment`; đưa cả hai vào báo cáo dòng tiền, khóa sửa/xóa độc lập để khoản chi và số dư khoản vay không lệch nhau.
3. **Nhắc hạn:** lịch notification cục bộ theo UID, reconcile khi tải sổ, hủy khi tắt nhắc/đổi hạn/tất toán/xóa/đăng xuất; notification không lộ dữ liệu tài chính.
4. **Giao diện:** lối vào Sổ cho mượn trong Tài chính; tổng còn phải thu; ba tab chưa hoàn thành/đã hoàn thành/đã hủy; tạo khoản vay với người mượn/số tiền/ngày hẹn/nhắc tùy chọn; sửa tiền gốc; xác nhận nhận một phần hoặc toàn bộ; xóa hồ sơ từ từng tab với quy tắc giữ lịch sử theo số lần nhận tiền.
5. **Đóng gói thay đổi:** rà diff và tài liệu; cập nhật checklist. Chỉ phát hành Firestore rules nếu cấu hình project đang xác thực đúng `baseapp-dd227`; không cần Supabase.

## Tiêu chí hoàn thành

- Tạo khoản vay tạo đúng một giao dịch chi `Cho mượn`, làm giảm số dư dòng tiền và tăng chi tiêu; tổng còn phải thu được theo dõi riêng.
- Số còn nợ và trạng thái tất toán khớp sau từng lần trả một phần/toàn phần.
- Mỗi lần xác nhận trả tiền hiện trong Tài chính dưới dạng khoản giảm chi `Cho vay`, không tăng báo cáo Thu nhập; không thể sửa/xóa đơn lẻ làm hỏng liên kết. Sửa tiền gốc thay đổi khoản chi cùng lúc. Xóa hồ sơ chưa nhận lại tiền xóa khoản chi; xóa hồ sơ đã có lần nhận tiền vẫn giữ giao dịch chi và lịch sử thu.
- Có thể tắt nhắc; ngày hẹn không bắt buộc; từ chối quyền notification không cản trở lưu.
- Không thể đọc/ghi khoản vay hoặc giao dịch liên kết từ UID khác; nội dung notification không tiết lộ người mượn/số tiền.
- Checklist/notes Tài chính hiện có và các thay đổi chưa commit trước đó được giữ nguyên.
