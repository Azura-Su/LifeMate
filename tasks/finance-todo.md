# Công việc: Quản lý thu nhập và chi tiêu

- [x] Model, validation, per-UID storage và Zustand store; có unit tests.
- [x] Screen thu/chi với summary tháng, thêm/xóa giao dịch và trạng thái rỗng/loading/error; có component tests.
- [x] Thêm tab điều hướng và integration test.
- [x] Chạy Jest (41 suites / 160 tests), typecheck, lint, bundle Android/iOS và rà soát diff.
- [x] Thêm báo cáo năm với tháng bắt đầu/kết thúc, nhóm từng giao dịch theo tháng, subtotal tháng và tổng kỳ.
- [x] Cho chọn ngày giao dịch để ghi nhận khoản phát sinh từ tháng trước.
- [x] Chạy full Jest (41 suites / 164 tests), typecheck, lint, bundle Android/iOS và kiểm tra trên Simulator.
- [x] Chuyển dữ liệu cũ từ AsyncStorage sang Firestore và hiển thị trạng thái đã sao lưu/chưa sao lưu.
- [x] Thêm Firestore rules để dữ liệu tài chính chỉ truy cập được theo UID; kiểm tra 29 assertion bằng emulator.
- [x] Chạy full Jest (42 suites / 172 tests), typecheck, lint và bundle Android/iOS sau chuyển cloud.
- [x] Publish rules đã kiểm thử lên Firebase project `baseapp-dd227` ngày 08/10/2026.
- [x] Nhập 172 khoản thu lịch sử từ 2023–2026 vào tài khoản hiện tại và xác minh số tài liệu trên Firestore; không nhập tổng phụ tháng.
