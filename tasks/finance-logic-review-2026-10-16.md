# Review logic Tài chính — 16/10/2026

## Kết quả

Chưa phát hiện thêm lỗi logic có thể tái hiện sau bản sửa dashboard: nhận lại 10.000đ rồi chi mới 30.000đ vẫn hiển thị Chi Home 30.000đ. Không đổi phép tính, dữ liệu lưu hoặc quyền truy cập trong đợt review này.

## Các luồng đã đối chiếu

- Thu/chi: form số tiền/ngày/danh mục, tạo/sửa/xóa, loại giao dịch liên kết, trạng thái lưu/lỗi, mẫu và danh mục tùy chỉnh.
- Báo cáo: kỳ tháng/năm/khoảng, danh mục cũ/tùy chỉnh, thu công ty/ngoài công ty, khoản nhận lại giảm chi trong báo cáo; Home cộng hoạt động phát sinh riêng.
- Chi chung: phần mỗi người phải trả, nhận lại từng phần, request ID, sửa/xóa lần nhận, số còn chờ theo ngày/kỳ và dòng báo cáo dẫn về khoản gốc.
- Cho vay: gốc/cho thêm/nhận lại, ID retry, liên kết khoản chi/nhận lại, sửa/xóa, không giảm tổng vay thấp hơn số đã nhận, chuyển lần cho thêm thành khoản gốc.
- Đóng hộ: nhận/đóng/trả lại, tính lại số dư từ lịch sử, ứng trước, stale edit, retry ID; tách khỏi thu chi cá nhân.
- Dữ liệu: giới hạn UID, state khi đổi tài khoản, cache mã hóa, migration, pending edits, conflict với cloud và khôi phục khi cache không đọc được.
- Khóa Tài chính: retain/suspend màn khi khóa, phản hồi khi app background và đổi UID; kiểm tra mã và tests hiện có.

Main kiểm tra screen/hook/store/report/storage liên quan. Explorer trace sổ vay/giữ hộ; reviewer độc lập kiểm tra kế hoạch/invariants, gate quyền trong diff và tests bổ sung. Kết luận dựa trên mã + tests, không khẳng định mọi tổ hợp thao tác/thiết bị đều đã được thử.

## Bổ sung kiểm chứng

`src/services/finance/__tests__/ledgerInvariants.test.ts` thêm 3 ca gọi service thật với Firestore mock hiện có:

1. Cho thêm 500 và retry không nhân đôi; sửa thành 600; nhận 1.200; không xóa khoản cho thêm nếu tổng còn lại thấp hơn số đã nhận; sửa nhận thành 900 rồi xóa cho thêm/nhận lại. Kiểm tra số dư và các giao dịch liên kết ở từng bước.
2. Xóa khoản gốc, chuyển lần cho thêm 500 thành gốc; chỉ còn một khoản chi 500 và tải lại được đúng gốc mới.
3. Đóng hộ nhận 500, đóng 700 → −200; retry không nhân đôi; nhận thêm 200 → 0; sửa/xóa lịch sử và chặn stale edit. Không tạo giao dịch tài chính cá nhân.

Reviewer không có finding cần sửa trong tests này. Mock không mô phỏng Firestore conflict/retry, nhiều client đồng thời, rules hoặc mạng trả kết quả không chắc chắn.

## Tài liệu được sửa

- SPEC-held-money trước đây nói không cho âm, trong khi UI, service và rules hiện hỗ trợ ứng trước. Cập nhật tài liệu theo hành vi đang có; không siết parser/rules làm hỏng lịch sử ứng trước.
- SPEC-finance làm rõ khoản nhận lại giảm chi trong báo cáo, tách khỏi cách tổng hợp dashboard.

## Kết quả chạy

- Full suite trước khi thêm tests: **85 suites / 463 tests qua**.
- Chạy lại nhóm tài chính sau bổ sung: **15 suites / 119 tests qua** (gồm 3 tests mới).
- Typecheck, ESLint file test mới, Prettier các file thay đổi và `git diff --check`: qua.
- Không thay production logic, không ghi/xóa dữ liệu tài chính thật, không deploy rules/backend trong đợt này.

## Giới hạn còn lại

Chưa chạy hai thiết bị thật ghi đồng thời, ngắt mạng đúng lúc commit, camera/Face ID/native hoặc Firebase rules emulator trong đợt này. Bài test in-memory không thay thế kiểm chứng các tình huống đó. Không coi khoảng trống coverage là lỗi đã xác nhận.
