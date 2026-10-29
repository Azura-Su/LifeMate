# Kế hoạch: tư thế nghỉ riêng cho 15 linh thú, 29/10/2026

## Mục tiêu

Lấy chuyển động nghỉ của **Thiên Dực Linh Lộc** làm chuẩn chất lượng và thiết kế lại tư thế nghỉ cho 15 linh thú còn lại. Mỗi loài có một chuỗi khung hình riêng, chuyển từ dáng hiện tại sang tư thế nằm/ngồi nghỉ phù hợp giải phẫu; không dùng phép xoay cả ảnh để giả làm tư thế nằm. Khi vào tư thế cuối, linh thú tiếp tục thở rất nhẹ rồi trở lại chuyển động hiện tại khi được đánh thức.

## Phạm vi

- Áp dụng cho: Cửu Vĩ Hồ, Kỳ Lân, Thiên Mã, Lang Rune, Huyền Vũ, Nhân Sư, Nhân Mã, Bạch Hổ, Thanh Long, Koi Long, Scylla, Lạc Điểu, Phượng Hoàng, Anubis và Garuda.
- Thiên Dực Linh Lộc giữ nguyên, làm mốc đối chiếu về độ mượt, bố cục, kích thước nhân vật và chất lượng hoàn thiện.
- Giữ nguyên ảnh/atlas hiện tại, các animation đi, vui, kỹ năng, callback và giao diện người dùng. Chỉ bổ sung clip nghỉ và chuyển trạng thái ngủ/thức.
- Không đổi dữ liệu thú, API, quyền sở hữu, chăm sóc hay tiến trình người dùng; không thêm dependency.

## Hướng mỹ thuật

Giữ cùng ngôn ngữ minh họa của từng linh thú hiện có: chibi fantasy, viền nâu mềm, mắt và điểm sáng rõ, cel-shading pha bóng mềm, bảng màu và phụ kiện nhất quán. Nhân vật luôn nằm trọn khung, không mất tai/sừng/cánh/đuôi; bóng đổ và điểm neo sàn không nhảy giữa các khung. Nền trong suốt để hiển thị đúng trên nền ứng dụng.

Mỗi atlas nghỉ là chuỗi 16 tư thế có thứ tự: khung đầu khớp dáng đứng/idle hiện tại; 1–4 hạ trọng tâm; 5–9 thu chân, cánh, đuôi hoặc xúc tu; 10–14 hoàn tất tư thế; khung 15 là tư thế nghỉ yên để giữ. Các bộ phận phụ có chuyển động bù nhẹ, có quán tính, sau đó dừng tự nhiên. Không thêm hạt/hiệu ứng bay liên tục làm rối dáng ngủ. Chuyển động thở nhỏ được tạo bằng transform nhẹ ở thân/ngực sau khi đã nằm.

## Bản thiết kế tư thế theo loài

| Linh thú | Chuyển động và tư thế nghỉ cuối |
| --- | --- |
| Cửu Vĩ Hồ | Hạ người, co chân trước, cuộn thành vòng cung; chín đuôi xếp quạt ôm quanh thân, chóp đuôi gần mũi; tai cụp thư giãn. |
| Kỳ Lân | Khuỵu chân rồi nằm gọn; bờm lắng xuống, sừng và vòng trang trí vẫn rõ; đuôi cong sát hông, không xuyên chân. |
| Thiên Mã | Hạ chân trước rồi gập chân sau; cánh lông vũ gấp lớp ôm sườn; bờm và đuôi rủ tự nhiên, mặt không bị cánh che. |
| Lang Rune | Hạ vai, đặt đầu lên hai chân trước; chân sau co, đuôi vòng về gần mõm; tai và dấu rune dịu sáng. |
| Huyền Vũ | Hạ thấp thân, thu đầu và chân một phần dưới mai; mai vẫn là khối nhận diện chính; hoàn tất bằng dáng nằm vững, không biến mất chi. |
| Nhân Sư | Từ dáng ngồi chuyển sang nằm kiểu sư tử; hai chân trước xếp gọn, cánh gấp sát lưng, đuôi cuộn bên cạnh. |
| Nhân Mã | Hạ phần thân ngựa xuống theo tư thế nghỉ tự nhiên, hai chân ngựa gập cân đối; thân người tự chống rồi tựa lên tay; đuôi buông sau hông. Không xoay cứng toàn thân. |
| Bạch Hổ | Hạ xuống dáng nằm nghiêng/loaf, chân trước thu dưới ngực; đuôi vằn cuộn cạnh mõm; giữ rõ vằn và tỷ lệ đầu-thân. |
| Thanh Long | Thân rồng uốn thành vòng chữ S rộng, đầu tựa gần vòng cuộn; vây/sừng lắng theo nhịp, đuôi khép vào trong, không xuyên qua thân. |
| Koi Long | Uốn thành vòng nổi mềm như đang nghỉ trên mặt nước; vây lưng và râu cá chậm lại; giữ vảy và dáng cá-rồng dễ nhận ra. |
| Scylla | Hạ phần thân trung tâm; các xúc tu lần lượt cuộn thành vòng bất đối xứng quanh thân; từng xúc tu vẫn tách bạch và không chồng kín mặt. |
| Lạc Điểu | Thu chân vào dáng đậu/ngồi; cánh lớn gập theo nhiều lớp lông; đầu rúc nhẹ vào vai/cánh, mỏ và mào vẫn nhìn rõ. |
| Phượng Hoàng | Hạ người, gập cánh ôm thân; lông đuôi lửa cuộn quanh chân rồi dịu sáng; giữ sắc đỏ-vàng nhưng không biến thành ngọn lửa lớn. |
| Anubis | Chuyển về dáng quỳ/ngồi nghỉ; đầu chó rừng nghiêng tựa lên tay; tai dài hạ nhẹ; đuôi cuộn cạnh hông, trang sức không rung. |
| Garuda | Hạ vào tư thế đậu/quỳ vững; móng vuốt thả lỏng; đôi cánh lớn xếp lần lượt thành lớp sát lưng; giữ silhouette thần điểu và đầu chim rõ. |

## Thiết kế kỹ thuật

- Mỗi loài có atlas nghỉ riêng 4×4, 16 khung 256×256 trong ảnh 1024×1024, alpha trong suốt, cùng tỉ lệ và hệ tọa độ với atlas đang có. Atlas chính hiện tại không bị ghi đè.
- Tải atlas nghỉ khi bắt đầu ngủ; chỉ render atlas đang hoạt động. Khi thức dậy, chạy chuỗi chuyển ngược nếu asset hỗ trợ; nếu không, dùng các khung nghỉ theo thứ tự ngược để trở về dáng đầu, rồi gỡ atlas nghỉ.
- Phát khung bằng progress/animated style trên UI thread theo mẫu hiện tại. Một lượt nằm xuống dự kiến khoảng 1.3–1.7 giây, dùng easing nhẹ ở đầu/cuối; giữ khung cuối và chạy nhịp thở nhỏ, không setInterval hay React state mỗi khung.
- Tuân thủ các quy tắc focus, AppState, Reduced Motion, huỷ animation và fallback ảnh hiện có. Chuyển ngủ/thức lặp lại không tạo thêm worklet hoặc style handle; giữ nguyên handle `useAnimatedStyle` qua các trạng thái để tránh lỗi Reanimated đã gặp trước đó.
- Dừng mọi clip khác trước khi bắt đầu clip nghỉ; callback one-shot và trạng thái hoàn tất phải an toàn khi lệnh cũ đến trễ.

## Các bước thực hiện và điểm duyệt

1. **Chốt baseline và giao kèo atlas:** xác nhận 15 ID, renderer hiện tại, kích thước/chi phí decode và cách unmount atlas cũ; thêm test mô tả lỗi hiện tại trước khi đổi hành vi.
2. **Làm pilot chất lượng:** tạo atlas nghỉ cho một loài có cánh và một loài có hình thái khác biệt (dự kiến Garuda và Thanh Long); kiểm tra từng khung, continuity, viền trong suốt, chân trời, nhận dạng và điểm neo. Chỉnh hướng mỹ thuật/prompt nếu hai pilot không đạt.
3. **Tạo các atlas còn lại:** áp dụng cùng tiêu chuẩn theo bảng tư thế; duyệt contact sheet từng loài, sửa atlas có khung lặp, chi thừa/thiếu, hình bị méo hoặc nhảy kích thước.
4. **Tích hợp renderer:** thêm clip `rest`/`wake`, chuyển atlas có huỷ an toàn, giữ frame cuối và nhịp thở tinh tế; không thay đổi animation đang có.
5. **Regression và xem trực quan:** test mapping khung, chuyển trạng thái, focus/Reduced Motion, unmount/fallback, sleep-wake lặp nhanh và bắt lỗi Reanimated; xem preview các nhóm cánh, nhiều đuôi, mai, thân dài và xúc tu.
6. **Kiểm chứng hoàn tất:** kiểm tra assets (16 khung/atlas, alpha, bounding box, padding, khác biệt pose), Jest liên quan, typecheck, ESLint, export iOS/Android nếu môi trường cho phép. Ghi rõ thiết bị nào chưa xem trực tiếp và hạn chế memory/FPS.

## Tiêu chí chấp nhận

- Cả 15 loài đều có chuỗi nghỉ riêng; Thiên Dực Linh Lộc không đổi.
- Mỗi chuỗi nhìn thấy rõ ít nhất 5 thay đổi tư thế có chủ đích; không phải cùng một ảnh được co/ xoay lặp lại.
- Khung đầu/khung thức khớp dáng idle hiện hành; chuyển động không nhảy tỷ lệ, điểm neo hoặc bóng sàn; khung cuối giữ được rõ ràng khi ngủ.
- Bộ phận đặc trưng của từng loài được bảo toàn và xếp hợp lý ở tư thế cuối; không cắt khung hay xuyên hình nổi bật.
- Sleep/wake, lặp nhanh, màn mất focus, Reduced Motion và lỗi tải atlas không khóa tương tác, không để animation cũ ghi đè trạng thái mới, không phát sinh lỗi Reanimated.
- Không tải đồng thời atlas của nhiều loài; đo và ghi lại tổng dung lượng tệp cùng mức giải mã ước tính sau khi đóng gói.

## Rủi ro cần theo dõi

| Rủi ro | Cách xử lý |
| --- | --- |
| 16 khung do sinh ảnh có sai khác mặt/vằn/phụ kiện | Dùng atlas hiện hành làm reference; kiểm duyệt contact sheet, loại và sinh lại khung sai trước đóng gói. |
| 15 atlas mới làm tăng bộ nhớ | Tải theo pet đang hiển thị, gỡ atlas nghỉ khi thức; giữ kích thước atlas hiện hành và không preload. |
| Atlas nghỉ và idle lệch điểm neo | Khớp khung đầu với pose idle, thống nhất bounding box/scale và kiểm tra GIF/preview nền sáng-tối. |
| Cạnh tranh animation lúc chuyển sleep/wake | Dùng một nguồn progress có token phiên/guard hủy; kiểm thử chuỗi sleep-wake nhanh và callback trễ. |

## Điều kiện trước triển khai

Plan này cần được người dùng duyệt trước khi sinh asset và sửa code, theo quy trình của skill `planning-and-task-breakdown`. Sau khi duyệt, triển khai theo các checkpoint trên và cập nhật checklist tại `tasks/todo.md`.
