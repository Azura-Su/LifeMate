# Kết quả: chuyển động riêng từng linh thú ở Home

## Đã làm

- Tạo 15 atlas Home 4×4 toàn thân, mỗi loài 16 khung; mỗi sheet có hàng idle, di chuyển theo giải phẫu, vui chơi và động tác đặc trưng. Nguồn hình dựa trên art từng loài, được đóng gói thành PNG 1024×1024 có alpha.
- Dung lượng 15 atlas mới: 3.80 MiB. Home mount atlas theo linh thú đang hiển thị; atlas kéo và atlas Thiên Dực Linh Lộc vẫn giữ riêng.
- Thêm cấu hình nhịp di chuyển theo loài: Huyền Vũ chậm, Bạch Hổ nhanh, Thanh Long/Lý Ngư uốn lượn, Scylla chuyển động theo xúc tu, chim/linh thú có cánh đập cánh.
- Cập nhật hành động Home ngẫu nhiên để có clip vui và clip dấu ấn của từng loài.
- Nối các nút **Đi dạo/Vỗ cánh/Lượn mình**, **Vui vẻ** và **Linh hỏa** ở màn Linh thú vào atlas/nhịp riêng; nghỉ ngơi và atlas riêng của Thiên Dực Linh Lộc tiếp tục giữ nguyên.
- Vẽ lại atlas Cửu Vĩ Hồ: đi nhún, chạy lúp xúp, bật nhảy vui, ngoái nhìn và đáp nhẹ; giữ đủ chín đuôi và thêm chớp hồ hỏa nhỏ. Hạ cung nhảy, giảm vòng xoay lớn thành pha ngoái/đổi hướng nhẹ; ngủ/thức tiếp tục dùng atlas nghỉ đã có.
- Cập nhật SPEC, README, provenance và task checklist.

## Kiểm tra

- Jest Home/Pet screen/PetSprite/mapping: 38 tests passed.
- `npm run typecheck`: passed.
- ESLint trên các file TypeScript bị tác động: passed.
- iOS Expo export: passed; Metro đóng gói đủ 15 atlas Home.
- Kiểm tra atlas: 15/15 đúng 1024×1024, 16 khung không rỗng, alpha trong suốt, mỗi PNG dưới 500 KB.
- Rà trực quan các atlas đã đóng gói, gồm Cửu Vĩ Hồ, Kỳ Lân, Huyền Vũ, Thanh Long, Koi Long, Scylla, Nhân Mã, Bạch Hổ, Phượng Hoàng, Garuda, Chim Lạc, Anubis và các loài còn lại.

## Giới hạn kiểm chứng

iOS Simulator đang ở màn Quản lý linh thú và giao diện Simulator không được cung cấp cho điều khiển UI trong phiên này, nên chưa thể mở Home và quay/chụp trực tiếp chu kỳ chạy của pet. Đã kiểm tra từng atlas, renderer qua Jest và Metro iOS export. Không thay đổi dữ liệu người dùng hoặc backend.
