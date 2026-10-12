# Sổ cho mượn tiền — 11/10/2026

## Mục tiêu

Theo dõi tiền đã cho người khác mượn, số còn phải thu và hạn trả. Khi tạo khoản vay, ghi khoản tiền đưa đi thành giao dịch Chi `Cho mượn`; khi xác nhận nhận lại tiền, ghi giao dịch Thu `Thu hồi cho mượn`. Cả hai giao dịch liên kết với khoản vay trong Tài chính; hỗ trợ trả từng phần. Nhắc ngày hẹn là tùy chọn và dùng thông báo cục bộ trên thiết bị.

## Quyết định thiết kế

- Tiền đưa cho mượn vừa làm giảm tiền hiện có, vừa được ghi là khoản chi `Cho mượn`; khoản phải thu vẫn được theo dõi riêng trong sổ. Có thể sửa tiền gốc và khoản chi liên kết đồng thời. Xóa hồ sơ chưa có lần nhận tiền sẽ xóa khoản chi để sửa trường hợp nhập nhầm; khoản chi còn sót từ hồ sơ đã xóa trước đây có thể xóa riêng khi tombstone xác nhận chưa nhận lại tiền. Nếu đã có lịch sử nhận tiền, các giao dịch Chi/Thu vẫn được giữ lại.
- Tạo mới khoản vay cần kết nối mạng để Firestore ghi hồ sơ và giao dịch chi liên kết trong cùng transaction. Khoản vay cũ được bổ sung giao dịch chi theo ID ổn định, tránh ghi trùng.
- Lưu bản ghi theo UID tại `financeAccounts/{uid}/loans/{loanId}` và cache mã hóa theo UID trên thiết bị, cùng quy ước phân quyền của Tài chính.
- Mỗi lần nhận tiền yêu cầu xác nhận số tiền (có thể trả một phần, không vượt số còn nợ). Tạo giao dịch Thu `Thu hồi cho mượn`, có `incomeSource: loan_repayment`, `loanId` và `repaymentId` để nhận diện, lọc báo cáo và chặn sửa/xóa giao dịch độc lập.
- Khoản thu hồi vẫn tính vào dòng tiền Thu của kỳ, nhưng trong báo cáo nguồn thu có nhóm riêng để không lẫn với lương, thưởng hoặc thu nhập khác.
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
- Mỗi lần xác nhận trả tiền hiện trong Tài chính với nguồn riêng `Thu hồi cho mượn`; không thể sửa/xóa đơn lẻ làm hỏng liên kết. Sửa tiền gốc thay đổi khoản chi cùng lúc. Xóa hồ sơ chưa nhận lại tiền xóa khoản chi; xóa hồ sơ đã có lần nhận tiền vẫn giữ giao dịch chi và lịch sử thu.
- Có thể tắt nhắc; ngày hẹn không bắt buộc; từ chối quyền notification không cản trở lưu.
- Không thể đọc/ghi khoản vay hoặc giao dịch liên kết từ UID khác; nội dung notification không tiết lộ người mượn/số tiền.
- Checklist/notes Tài chính hiện có và các thay đổi chưa commit trước đó được giữ nguyên.
