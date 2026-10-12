# Checklist — Sổ cho mượn tiền

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
