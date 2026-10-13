# Checklist — Sổ cho mượn tiền

## Chọn người có nhiều khoản từ form tạo — 12/10/2026

- [x] Gợi ý tên và lựa chọn khoản riêng/cộng khoản cũ.
- [x] Hiển thị và chọn chính xác khoản đang mở của người đó.
- [x] Dùng lại ghi thêm nguyên tử, preview, khóa khi đang lưu và reset lựa chọn khi đổi tên.
- [x] TypeScript toàn project, ESLint các file UI thay đổi và whitespace đạt; cập nhật tài liệu. Chưa chạy test hoặc thử trên iPhone trong lượt này.

## Nội dung và ngày cho mượn thêm — 12/10/2026

- [x] Nhập nội dung bắt buộc, lưu vào lịch sử và giao dịch Chi.
- [x] Chọn ngày bằng lịch, dùng cùng ngày cho giao dịch và lịch sử.
- [x] Giữ tương thích lịch sử cũ; cập nhật Firestore rules cho lần mới có nội dung.
- [x] Rules biên dịch và phát hành lên `baseapp-dd227`; đọc lại đúng source. TypeScript, ESLint, whitespace và tài liệu đạt; chưa thử UI trên iPhone.

## Sửa lần cho mượn thêm — 12/10/2026

- [x] Sửa số tiền, ngày và nội dung của từng lần trong lịch sử.
- [x] Cập nhật khoản vay và giao dịch Chi liên kết nguyên tử; chặn sửa thấp hơn tổng tiền đã nhận.
- [x] Firestore rules chỉ cho đổi đúng một vị trí lịch sử và giao dịch Chi khớp; phát hành ruleset `1d72f535-816f-425f-a125-3e846a8f85df` lên `baseapp-dd227`.
- [x] TypeScript, ESLint và `git diff --check` đạt; chưa chạy Jest/emulator hoặc thử UI trên iPhone.

## Cho mượn thêm — 12/10/2026

- [x] Types/parser, tổng gốc và lịch sử thêm tương thích dữ liệu cũ.
- [x] Ghi thêm + giao dịch chi nguyên tử, retry ổn định, đối soát cache.
- [x] Xử lý sửa tiền ban đầu/xóa hồ sơ và các khoản chi thêm.
- [x] Nút, popup, preview dư nợ, lịch sử và bảo vệ phiên tài khoản.
- [x] Rules append và liên kết giao dịch; compile/phát hành rules lên `baseapp-dd227`.
- [x] Typecheck, lint, rà diff và tài liệu; chưa chạy Jest/emulator hoặc thử trên iPhone trong lượt này.

- [x] Types, validation và local/cloud store theo UID.
- [x] Firestore rules cho khoản cho mượn; mở rộng allowlist giao dịch Thu hồi.
- [x] Tích hợp giao dịch chi `Cho mượn` và giao dịch thu hồi có liên kết, phân loại báo cáo và bảo vệ sửa/xóa.
- [x] Nhắc hạn cục bộ tùy chọn, thông báo chung không lộ thông tin.
- [x] UI danh sách/tạo khoản/xác nhận trả từng phần hoặc tất toán trong Tài chính.
- [x] Rà cấu hình: chỉ cần Firestore; không cần Firebase Storage hoặc Supabase.
- [x] Phát hành riêng Firestore rules lên `baseapp-dd227`; Firebase xác nhận rules biên dịch và phát hành thành công.
- [x] Phát hành rule mới: xóa khoản cho mượn có tombstone chống khôi phục, giao dịch thu hồi phải liên kết đúng lần trả, và dùng `.get()` an toàn cho trường nguồn thu tùy chọn.
- [x] Phát hành Firestore rules buộc hồ sơ vay mới/cập nhật có giao dịch chi `loan_lending` liên kết; giao dịch chi chỉ được ghi cùng khoản vay.
- [x] Rà diff và whitespace (`git diff --check`); không chạy Jest theo chỉ dẫn phiên này.
- [x] Sửa tiền gốc và khoản chi nguyên tử; xóa khoản chưa nhận lại tiền cùng khoản chi liên kết.
- [x] Hủy nhắc khi tất toán, xóa và đăng xuất; đối soát giao dịch chi bằng một truy vấn khi tải sổ.
- [x] Cho xóa khoản chi còn sót từ hồ sơ đã xóa trước bản sửa, chỉ khi không có lịch sử nhận tiền.

## Sửa theo review ngày 12/10/2026

- [x] Sửa rules cho lần trả đầu tiên và lần trả pending đơn lẻ; giữ kiểm tra giao dịch liên kết và lịch sử cũ.
- [x] Thu hồi retry key khi cloud xác nhận lần trả; vẫn giữ key của yêu cầu chưa xác nhận.
- [x] Tải lại sổ khi mở, luôn có nút đồng bộ, làm mới cả giao dịch Tài chính.
- [x] Chặn cập nhật/đặt nhắc của phiên cũ sau các bước bất đồng bộ và khi đăng nhập lại cùng UID.
- [x] Regression: 375 Jest tests / 71 suites; 60 emulator assertions; typecheck, ESLint và whitespace đều đạt.
- [x] Phát hành rules không còn cảnh báo biên dịch lên `baseapp-dd227`, đọc lại và xác nhận đúng nguồn đã kiểm thử.
