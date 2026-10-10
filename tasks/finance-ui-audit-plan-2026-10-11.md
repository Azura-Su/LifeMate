# Rà soát UI Tài chính — 11/10/2026

## Mục tiêu

Rà và hoàn thiện trải nghiệm dễ đọc, gọn và nhất quán trong luồng Tài chính: tổng quan thu chi, báo cáo thu nhập/chi tiêu, bộ lọc kỳ, danh sách giao dịch và popup thêm/sửa giao dịch. Giữ nguyên dữ liệu, nghiệp vụ, màu sắc và điều hướng đã có.

## Kế hoạch

1. Kiểm tra cấu trúc màn hình, thứ bậc thông tin, trạng thái rỗng/loading/lỗi và khả năng đọc trên màn nhỏ.
2. Hoàn thiện các điểm dễ gây chật hoặc khó chạm ở báo cáo, hàng giao dịch và popup nhập liệu; giữ hành vi thu/chi hiện tại.
3. Bổ sung regression test cho các điều chỉnh có ảnh hưởng hiển thị hoặc tương tác.
4. Chạy test liên quan, typecheck, lint, format và rà diff.

## Tiêu chí hoàn thành

- Tổng quan, báo cáo thu nhập và chi tiêu có tiêu đề, số tiền, kỳ báo cáo và trạng thái dễ quét.
- Tên danh mục dài/số tiền lớn không đẩy tràn nội dung; các nút thao tác có nhãn trợ năng.
- Popup vẫn cuộn được khi nhiều mẫu/danh mục hoặc khi bàn phím mở; nút lưu và đóng dễ nhận biết.
- Hành vi thêm/sửa/xóa, lọc kỳ và chọn nguồn thu không thay đổi ngoài chủ đích.
- Jest, typecheck, ESLint và Prettier đạt.

## Giới hạn

`tasks/plan.md` và các checklist hiện hữu còn công việc độc lập; kế hoạch này dùng file riêng để bảo toàn chúng. Kiểm tra runtime trên Simulator tùy trạng thái dịch vụ mô phỏng.
