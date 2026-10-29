# Kế hoạch: chuyển động đặc trưng cho từng linh thú ngoài Home

## Mục tiêu

Trong màn Linh thú và các màn xem thử ngoài Home, mỗi loài có chuyển động đặc trưng, dễ nhận ra ngay cả khi không đọc tên. Ví dụ: Thanh Long uốn thân rồng, Lý Ngư Hóa Long bơi bằng thân và vây, Phượng Hoàng đập cánh kèm tàn lửa, Huyền Vũ chuyển động chậm và nặng. Giữ chất lượng hình ảnh và độ mượt theo chuẩn animation nghỉ vừa hoàn thành.

## Phạm vi

- Áp dụng cho 15 linh thú người dùng: Cửu Vĩ Hồ, Kỳ Lân Hỏa, Thiên Mã Kỳ Lân, Lang Linh, Huyền Vũ, Nhân Sư, Nhân Mã, Bạch Hổ, Thanh Long, Lý Ngư Hóa Long, Scylla, Chim Lạc, Phượng Hoàng, Anubis và Garuda.
- Tập trung màn Linh thú (`PixelPetScreen`) và nơi khác ngoài Home đang hiển thị linh thú/cho xem thử; kiểm kê mọi nơi render trước khi sửa.
- Home và các chuyển động đi lại/đi ngủ riêng tại Home giữ nguyên.
- Không đổi dữ liệu nhận nuôi, API, kỹ năng, chăm sóc, kinh tế, quyền sở hữu hay tiến trình. Không thêm dependency.
- Thiên Dực Linh Lộc của admin tiếp tục dùng animation riêng hiện có; chỉ đưa vào phạm vi nếu kiểm kê cho thấy màn preview ngoài Home cần đồng bộ cùng trải nghiệm.

## Bổ sung theo yêu cầu Home

Yêu cầu tiếp theo mở rộng phần mỹ thuật theo từng loài sang Home: tạo atlas toàn thân riêng cho đủ 15 linh thú trong kho, thêm chu kỳ Home tinh nghịch hơn cho Cửu Vĩ Hồ, và giữ atlas Home riêng của Thiên Dực Linh Lộc. Chu kỳ từng loài vẫn phải dừng khi Home không hoạt động hoặc Reduced Motion bật; khi kéo thú phải trở về atlas kéo hiện có. Các nút xem thử chuyển động hiện có ở màn Linh thú dùng lại cùng atlas theo loài; không thêm nút mới.

## Hiện trạng và hướng thiết kế

SPEC ghi nhận mỗi loài đã có atlas hoạt động 4×4 với các nhóm idle, locomotion, vui và kỹ năng, cùng atlas nghỉ riêng. Tuy vậy, màn Linh thú hiện chỉ có các lựa chọn xem thử chung; mapping clip/track nền tảng đang chia sẻ. Vì vậy, bước đầu là xem từng atlas và hành vi renderer, xác định loài nào đã có đủ tư thế đặc trưng. Ưu tiên mapping frame/nhịp riêng từ tài sản hiện có. Chỉ tạo hoặc thay atlas khi các khung hiện tại không thể diễn tả hành động đặc trưng đạt yêu cầu.

Giữ các nút xem thử quen thuộc; lựa chọn như “Đi dạo/Vỗ cánh/Lượn mình” và “Vui vẻ” sẽ phát biến thể phù hợp với loài đang chọn. Nếu cách gọi hiện tại không còn phù hợp khi có nhiều dạng cơ thể, đổi nhãn theo nhóm hành động dễ hiểu, sau khi rà soát trải nghiệm. Không thêm một loạt nút riêng cho từng loài.

## Ma trận hành động đặc trưng

| Linh thú | Chuyển động cần nhận ra |
| --- | --- |
| Cửu Vĩ Hồ | Bước nhún tinh nghịch; chín đuôi xòe rồi ve vẩy theo nhịp, chóp đuôi có ánh hồ hỏa nhẹ ở clip vui/kỹ năng. |
| Kỳ Lân Hỏa | Dậm vó có trọng lượng; bờm và đuôi trễ nhịp, móng/vệt lửa lóe ngắn khi vui hoặc dùng kỹ năng. |
| Thiên Mã Kỳ Lân | Cánh lông vũ đập theo nhịp nâng thân; bờm và đuôi bay trễ, có một nhịp lượn nhẹ. |
| Lang Linh | Hạ vai, bước chắc; tai xoay, đuôi quét; clip vui có động tác ngẩng đầu hú ngắn và phù văn lóe theo nhịp. |
| Huyền Vũ | Chuyển động chậm, nặng; đầu và chân thò/thu nhẹ quanh mai, mai/hoa văn phát sáng dịu ở clip kỹ năng. |
| Nhân Sư | Dáng bước mèo lớn; vươn vai, đuôi ve vẩy và xòe/gập cánh theo nhịp, không che mặt. |
| Nhân Mã | Nhịp vó ngựa và thân người đồng bộ; bước/trot có độ nảy tự nhiên, động tác kéo cung gọn trong clip kỹ năng. |
| Bạch Hổ | Rình mồi bằng vai và chân trước; đuôi quất nhẹ, kết thúc bằng cú nhún/chồm có kiểm soát, giữ rõ vằn. |
| Thanh Long | Thân uốn chữ S liên tục theo làn sóng từ đầu đến đuôi; râu, bờm và vây có độ trễ, không dùng nhịp bước chân. |
| Lý Ngư Hóa Long | Bơi lượn hướng lên; thân uốn nhịp nhàng, vây xòe/khép và râu kéo theo dòng nước. |
| Scylla | Thân trung tâm ổn định; các xúc tu chuyển động nối tiếp như gợn sóng, giữ đầu và mặt dễ nhìn. |
| Chim Lạc | Nhịp chim trang trọng: nhún chân/đầu, xòe rồi khép cánh nhiều lớp và rung nhẹ lông mào. |
| Phượng Hoàng | Dang cánh, nhấc người và đáp mềm; lông đuôi để lại vài đốm lửa ngắn, không che silhouette. |
| Anubis | Dáng đứng uy nghi; xoay đầu chó rừng, tai giật nhẹ, nghiêng người/chào ngắn; trang sức chuyển động có quán tính nhỏ. |
| Garuda | Động tác thần điểu: mở cánh rộng, nhún/hover một nhịp rồi khép cánh có kiểm soát; lông cánh phân lớp rõ. |

Đây là đặc trưng theo nhóm clip, không yêu cầu mỗi lần phát phải có hiệu ứng hạt. Hiệu ứng phụ chỉ dùng vừa đủ, không làm rối dáng hoặc giảm độ rõ của nhân vật.

## Kế hoạch thực hiện

1. **Kiểm kê và chốt baseline:** xem `SPEC-pixel-pet.md`, catalog, frame mapping, atlas 15 loài, renderer, điều khiển playback và tất cả điểm render ngoài Home. Ghi bảng clip/pose hiện có, điểm còn thiếu, dung lượng và hành vi fallback. Xác nhận Home không bị tác động.
2. **Chốt hợp đồng chuyển động:** thiết kế mapping dữ liệu theo species ID và clip hiện có (hoặc kiểu action nhỏ nếu cần), gồm frame sequence, thời lượng, loop/one-shot và nhấn nhá phụ. Có fallback chung cho species chưa khai báo; không rải điều kiện loài khắp component.
3. **Pilot đối lập hình thái:** tích hợp thử một thú thân dài (Thanh Long hoặc Lý Ngư Hóa Long) và một thú cánh/lửa (Phượng Hoàng hoặc Garuda). Tận dụng atlas có sẵn trước; nếu thiếu pose, bổ sung riêng đúng loài. Duyệt preview ở kích thước thật trên thiết bị, nền sáng/tối và Reduced Motion trước khi nhân rộng.
4. **Mở rộng toàn bộ 15 loài:** áp dụng ma trận hành động; đảm bảo mỗi species có locomotion và vui/đặc trưng phân biệt. Rà từng chuỗi frame/contact sheet và sửa các khung làm lệch tỷ lệ, mất chi tiết nhận diện, cắt cánh/đuôi hoặc xuyên hình.
5. **Tích hợp UI và vòng đời:** giữ thao tác xem thử đơn giản; đổi mapping cho loài đang chọn mà không remount/reset sai trạng thái. Dừng/tiếp tục theo focus, AppState và Reduced Motion. Dùng một progress clock trên UI thread, không cập nhật React mỗi frame; giữ style/animated handle ổn định để tránh tái phát lỗi Reanimated.
6. **Regression và hiệu năng:** kiểm thử map theo species/clip, đổi thú giữa lúc clip đang chạy, callback cũ, loop/one-shot, unmount, atlas lỗi/tải chậm, Reduced Motion và tương tác sau khi animation kết thúc. Chỉ tải atlas đang hiển thị; đo dung lượng và decode memory nếu bổ sung asset.
7. **Cập nhật tài liệu:** sửa SPEC và provenance/README atlas theo kết quả thật; ghi rõ assets tái dùng, assets được tạo mới và các giới hạn preview.

## Tiêu chí chấp nhận

- 15/15 loài có chuyển động ngoài Home thể hiện ít nhất một dấu hiệu chuyển động nhận diện riêng theo bảng; các loài có nhiều dạng cơ thể không bị ép vào cùng một nhịp đi bộ.
- Khác biệt nhìn thấy được trong preview mà không cần đọc mô tả; mặt, tỷ lệ, màu và bộ phận đặc trưng không bị mất hoặc biến dạng.
- Chuyển động nối khung mượt, điểm neo và kích thước ổn định; loop không giật ở điểm nối, one-shot hoàn tất đúng clip.
- Không thêm điều khiển rườm rà; các nút hiện có cho kết quả phù hợp với loài đang xem.
- Home, nghỉ/thức, kỹ năng, chăm sóc và hợp đồng dữ liệu hiện tại không đổi ngoài phần được yêu cầu.
- Đổi species/clip liên tục, mất focus, Reduced Motion, atlas lỗi và callback trễ không khóa thao tác, không để clip cũ ghi đè trạng thái mới, không phát sinh lỗi Reanimated.
- Atlas mới (nếu cần) có đúng schema, nền trong suốt, kích thước/khung nhất quán; không preload toàn bộ loài.

## Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
| --- | --- |
| Atlas hiện hữu có các pose giống nhau hoặc không khớp mô tả | Kiểm duyệt trước khi code; chỉ tạo lại các nhóm frame thiếu và pilot trước khi mở rộng. |
| Một hành động bị gượng ép giữa thú bốn chân, có cánh, thân dài và hai chân | Dùng cấu hình theo species/rig, có fallback; không áp dụng chung nhịp chân cho rồng/cá/xúc tu. |
| Tạo thêm nhiều atlas làm tăng bộ nhớ | Tái dùng atlas khi đạt; tải theo thú hiện xem, đo dung lượng và chi phí giải mã cho từng asset bổ sung. |
| Hiệu ứng trang trí làm giảm độ rõ hoặc gây nhiễu | Giới hạn thời lượng/số lượng, không che mặt và có hành vi phù hợp Reduced Motion. |
| Animation cập nhật trạng thái gây lỗi Reanimated/tắc tương tác | Giữ đồng hồ ở UI thread, stable animated styles, generation guard/cancel; thêm regression cho chuỗi chuyển nhanh. |

## Kiểm chứng dự kiến

- Jest tests liên quan cho playback, frame mapping, renderer và PixelPetScreen.
- `npm run typecheck` và ESLint cho file bị tác động.
- Xem trực quan preview trên iOS Simulator/thiết bị nếu môi trường có sẵn; rà ít nhất thú bốn chân, có cánh, thân dài và nhiều xúc tu.
- Nếu có thay asset, kiểm tra kích thước, alpha, giới hạn từng ô, bbox, continuity và dung lượng. Không chạy test/build trước khi có triển khai.

## Câu hỏi còn mở

- Chuyển động đặc trưng nên được phát tự động xen giữa idle hay chỉ phát khi người dùng chạm nút xem thử? Mặc định đề xuất: idle chỉ có chuyển động nền rất nhẹ; hành động rõ như hú, bật nhảy, mở cánh được phát qua các nút xem thử để không gây xao nhãng.
- Có muốn đưa Thiên Dực Linh Lộc admin vào cùng hệ thống preview không? Mặc định trong plan: giữ animation riêng hiện có, chỉ đồng bộ nếu kiểm kê cho thấy có lợi và không làm thay đổi Home.

## Điều kiện trước triển khai

Đây là plan-only. Sau khi người dùng duyệt, bắt đầu bằng kiểm kê atlas và pilot hai loài tương phản; tiếp tục toàn bộ 15 loài sau khi chất lượng pilot đạt tiêu chí.
