# Kế hoạch: Mức phạt tới trắng — 27/10/2026

## Mục tiêu

Thêm một trường mức phạt riêng cho trường hợp tới trắng khi tạo phòng Tiến lên miền Nam; áp dụng cùng cấu hình khi chủ phòng sửa luật ván tới. Giá trị 0 tắt khoản phạt. Phạm vi bao gồm lưu cấu hình, validation phía client/server, tính điểm kết quả, hiển thị luật và kiểm thử.

## Quyết định đang chờ xác nhận

- Đã được người dùng duyệt: mức phạt là số điểm cố định **mỗi đối thủ trả cho người tới trắng**; người thắng nhận tổng khoản thu, bảo đảm tổng delta bằng 0. Phòng mới mặc định chặt 2 là 4 điểm/lá và tới trắng là 15 điểm/người. Config phòng cũ thiếu trường `instantWinAmount` vẫn được hiểu là 0 để không đổi điểm các phòng hiện có.
- Cấu hình chỉ tính khi ván kết thúc bằng `instant-win`; không thay đổi điểm ván thường hay khoản chặt 2.
- Kế hoạch này cần được review trước khi sửa logic tính điểm vì ảnh hưởng quyết toán điểm của phòng.

## Các lát triển khai

1. **Hợp đồng và đặc tả** — thêm `instantWinAmount` vào cấu hình Tiến lên miền Nam, xác định mặc định/backward compatibility, cập nhật luật và capability/version cần thiết.
2. **Tính điểm server** — cộng khoản cố định từ từng đối thủ sang người tới trắng; kiểm tra giới hạn số nguyên, tổng delta bằng 0, xử lý nhiều người cùng tới trắng theo luật xếp hạng hiện tại.
3. **Giao diện cấu hình** — thêm ô “Phạt mỗi người khi tới trắng” vào tạo phòng và dialog sửa luật ván tới; 0 là tắt; lưu/đọc lại đúng cấu hình.
4. **Hiển thị và hồi quy** — phản ánh mức phạt ở phần xem luật/kết quả phù hợp; thêm test cho mặc định cũ, giá trị 0, mức dương, nhiều người cùng tới trắng, và không áp dụng trong ván thường.
5. **Kiểm chứng/review** — chạy test server và Jest liên quan, typecheck/lint; rà soát cuối diff và cập nhật SPEC/tài liệu rollout nếu cần.

## Tiêu chí chấp nhận

- Người tạo/sửa luật nhập số nguyên 0..1.000.000.000; 0 tắt khoản này.
- Phòng cũ thiếu trường mới tiếp tục dùng 0 và không đổi điểm.
- Chỉ kết quả tới trắng mới phát sinh mức phạt; tổng điểm cả bàn luôn bằng 0.
- Cấu hình được pin cho ván và không đổi giữa ván; luật ván tới chỉ có hiệu lực khi chia ván tiếp.
- Tests bao phủ client, server validation/scoring và tương thích dữ liệu cũ.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Quy ước “mức phạt” có thể là tiền mỗi đối thủ hoặc khoản cố định cho cả bàn | Chốt quy ước trước khi triển khai; không tự ý quyết toán khác kỳ vọng |
| Cấu hình mới đi qua lưu phòng, pin match và giao thức client/server | Giữ default 0 cho phòng cũ; cập nhật capability và validation đồng bộ |
| Nhiều người cùng tới trắng và giới hạn điểm | Tuân thủ thứ hạng hiện tại; kiểm tra tổng delta và giới hạn an toàn bằng test |

## Task list

- [x] Task 1: Chốt quy ước mức phạt và review kế hoạch.
- [x] Task 2: Cập nhật đặc tả/type, backward compatibility, capability12 và quyết toán phía server.
- [x] Task 3: Thêm trường vào form tạo phòng và sửa luật ván tới, kèm hiển thị luật/kết quả.
- [x] Task 4: Hoàn tất kiểm chứng phù hợp và tự rà soát diff cuối.

## Triển khai

Đã thêm migration `20261027220000_south_instant_win_penalty.sql`. Chưa áp dụng
migration hoặc cập nhật Edge Function trên môi trường Supabase; phải rollout
backend trước bản client có capability12.

Kiểm thử, typecheck, lint và rà soát diff đều đạt. Không có công cụ read-only
reviewer độc lập trong phiên này; thay vào đó đã rà từng thay đổi về tương thích
config cũ, quyền RPC, capability12 và tổng điểm bằng0.
