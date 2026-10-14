# Dòng ký ức — 13/10/2026

## Mục tiêu

Thêm tab **Ký ức** ở bottom bar. Người dùng chụp ảnh, có thể viết thêm nội dung, rồi xem theo dòng thời gian, sửa và xóa. Mục mới cần có ảnh và tự lấy ngày hiện tại khi lưu; các mục cũ chỉ có chữ vẫn được giữ. Mỗi tài khoản chỉ thấy ký ức riêng của mình, trừ những mục đã chọn chia sẻ với bạn bè.

## Phạm vi và quyết định

- Bản đầu lưu riêng trên thiết bị theo Firebase UID. Metadata dùng kho mã hóa hiện có; ảnh được chép vào thư mục tài liệu riêng của app, theo UID. Không ghi ảnh vào cache tạm của picker. UI nói rõ dữ liệu hiện lưu trên thiết bị, tránh ngụ ý đã đồng bộ cloud.
- Một ảnh cho mỗi mục, nội dung tối đa 2.000 ký tự. Mục mới lấy ngày hiện tại; khi sửa vẫn giữ ngày cũ. Sắp xếp ngày mới trước; cùng ngày theo thời điểm tạo. Sửa/xóa có trạng thái xử lý và xác nhận xóa.
- Dùng `expo-camera` cho khung chụp nhanh, `expo-image-picker` để chụp lại ảnh trong trình soạn, và `expo-file-system/legacy` để lưu ảnh. Camera chỉ xin quyền khi người dùng bấm bật máy ảnh. Cấu hình permission iOS/Android phải khớp tính năng.
- Không thay đổi dữ liệu Tài chính, MP3 hay các tab ẩn. Bottom bar tăng từ ba lên bốn tab; nhãn truy cập được cập nhật.

## Lát cắt triển khai

1. **Lưu trữ và xác thực dữ liệu**: type, parser, lưu metadata mã hóa theo UID, chép ảnh bền vững và dọn ảnh khi thay/xóa. Chấp nhận: mục lỗi không làm hỏng cả danh sách; tài khoản khác không thấy dữ liệu; lưu lỗi không để danh sách trỏ tới ảnh thiếu. Kiểm chứng: kiểm tra mã và typecheck.
2. **Tạo và xem**: tab, danh sách nhóm tháng, trạng thái rỗng, chụp ảnh, form nội dung và nút lưu. Chấp nhận: mục mới có ảnh, danh sách sau lưu hiển thị ngay, ảnh còn sau mở lại app. Kiểm chứng: typecheck, lint và rà luồng UI.
3. **Sửa và xóa**: mở form từ từng mục, chỉnh nội dung/ảnh/quyền xem, xác nhận xóa. Chấp nhận: ảnh cũ chỉ xóa sau khi cập nhật thành công; xóa ảnh và metadata khi xóa mục; lỗi thao tác hiển thị rõ. Kiểm chứng: typecheck, lint và rà luồng UI.
4. **Hoàn thiện**: cập nhật quyền camera, nhãn bottom bar, tài liệu giới hạn lưu cục bộ, rà diff. Chấp nhận: không vô tình yêu cầu quyền lúc mở tab; thông điệp lưu trên thiết bị rõ ràng. Kiểm chứng: typecheck, lint, Prettier và rà diff. Không thêm/chạy test tự động trong lượt này theo chỉ dẫn phiên làm việc.

## Rủi ro

- Ảnh lưu trên thiết bị chưa có bản sao cloud và không tự khôi phục sau khi gỡ app hoặc đổi máy. Cần hạ tầng ảnh riêng trước khi bật đồng bộ, vì bucket Firebase hiện phục vụ audio và Supabase hiện giới hạn audio.
- Tệp ảnh nằm trong sandbox ứng dụng; metadata được mã hóa bởi kho hiện có. Không mô tả ảnh là đã mã hóa đầu cuối.

## Điều chỉnh theo phản hồi 13/10/2026

Người dùng muốn trải nghiệm theo hướng Locket: vào tab là thấy nơi chụp ảnh nổi bật, chụp xong mới thêm nội dung và lưu; có lối xem lại dòng ảnh rõ ràng. Sau đó bổ sung chia sẻ cho bạn bè và tùy chọn chỉ mình tôi; chi tiết quyền truy cập nằm trong [đặc tả chia sẻ](../SPEC-memory-sharing.md).

1. Mở tab ở chế độ chụp, khung ngắm vuông với nút chụp lớn; chuyển camera trước/sau. Quyền camera chỉ xin khi người dùng chọn bật máy ảnh. Nếu camera không mở được (như trên Simulator), hiện thông báo và nút thử lại.
2. Ảnh vừa chụp đi vào màn soạn; ảnh hiện đủ khung theo tỉ lệ gốc, nút chụp lại nằm trên góc ảnh. Ngay dưới ảnh là menu chọn ai có thể xem. Ngày của mục mới lấy tại lúc lưu; mục đang sửa giữ ngày cũ. Nút “Xem ký ức” mở dòng ảnh, giữ sửa/xóa các mục đã lưu.
3. Camera chỉ hoạt động khi tab được focus. Bản native cần `expo-camera` đúng SDK 55 và build/cài lại; bản đã cài trước đó không thể nạp module mới chỉ bằng Metro.
