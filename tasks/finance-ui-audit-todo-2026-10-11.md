# Checklist: Rà soát UI Tài chính

- [x] Rà tổng quan tháng, bộ chọn kỳ, báo cáo thu/chi, hàng giao dịch và form thêm/sửa.
- [x] Sửa co giãn số liệu, tên danh mục dài, tổng tháng, trạng thái báo cáo rỗng và vùng chạm nút nhỏ.
- [x] Thêm regression tests cho danh mục dài, tổng tháng tự xuống dòng và báo cáo trống.
- [x] Chạy Jest (62 suites / 302 tests), typecheck, ESLint, Prettier, Expo bundle iOS/Android và kiểm tra diff.

## Kết quả

- Số tổng tự co theo một dòng; tổng tháng được phép hiển thị hai dòng; số tiền dùng chữ số tabular để dễ so sánh.
- Tên danh mục dài rút gọn trong vùng tên, không đẩy số tiền khỏi hàng.
- Nút nguồn thu, chọn kỳ và thao tác thêm/xóa trong form dễ chạm hơn; báo cáo trống ghi “Chưa phát sinh”.
- Giữ nguyên cách tính, cách lọc và luồng thêm/sửa/xóa giao dịch.
