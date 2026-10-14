# Chia sẻ Dòng ký ức — 13/10/2026

## Trải nghiệm

- Mỗi ký ức mới mặc định **Chỉ mình tôi**. Người dùng có thể chọn **Bạn bè** khi lưu hoặc chia sẻ một mục đã lưu. Ảnh và nội dung chỉ xuất hiện với các tài khoản đã kết bạn và đã chấp nhận lời mời.
- Quyền **Bạn bè** áp dụng cho toàn bộ bạn bè hiện tại và người kết bạn sau này; giao diện nói rõ điều này trước khi đăng ảnh.
- Tab Ký ức vẫn mở ở màn chụp. Trang xem lại có hai phần **Của tôi** và **Bạn bè**. Phần Của tôi hiển thị nhãn quyền xem và cho đổi quyền, sửa, xóa; phần Bạn bè hiển thị các mục đang được bạn bè chia sẻ.
- Người dùng nhập chính xác email đăng nhập LifeMate của bạn để gửi lời mời; bên nhận chấp nhận hoặc từ chối. Không có danh bạ hay tìm kiếm gần đúng. Email của người dùng lấy từ phiên Firebase đang đăng nhập, không nhập lại. Chỉ email đã được Firebase xác nhận trong ID token mới được dùng để ghép lời mời và chia sẻ; không nhận email tự khai từ client. Cảnh báo xác nhận email chỉ hiện trong phần Bạn bè, còn ký ức riêng vẫn đọc được bình thường. Có thể hủy lời mời và xóa bạn. Nếu không có kết nối, vẫn tạo và đọc ký ức riêng đã lưu trên máy.
- Nếu người nhận chưa mở Ký ức trên phiên bản mới, lời mời được giữ theo email và hiện khi họ mở tính năng này. Người gửi nhận cùng một phản hồi cho email có hoặc chưa có tài khoản.
- Sửa một mục đã chia sẻ sẽ gỡ bản chia sẻ trước, cập nhật bản trên máy, rồi chia sẻ lại nếu người dùng vẫn chọn Bạn bè. Nếu chia sẻ lại lỗi, bản trên máy được giữ riêng và app báo rõ.

## Dữ liệu và quyền

- Ký ức riêng và bản gốc vẫn nằm trên thiết bị theo UID như hiện tại; không tự tải các mục cũ lên cloud. Trường `visibility` của dữ liệu cũ mặc định là `private`.
- Chỉ các mục chọn Bạn bè có bản sao cloud. Supabase Postgres lưu metadata, bucket private lưu ảnh. Edge Function xác minh Firebase ID token rồi mới đọc/ghi. Client không có service-role key. SQL bật RLS và không cấp quyền bảng/bucket trực tiếp cho `anon` hoặc `authenticated`.
- Người xem chỉ nhận metadata/URL ảnh của mục `active` từ chủ tài khoản đang là bạn. URL ảnh có thời hạn ngắn. Gỡ chia sẻ ẩn metadata trước khi dọn ảnh; không cấp URL mới sau khi gỡ. URL đã ký có thể còn hiệu lực rất ngắn cho đến khi hết hạn hoặc ảnh bị xóa.
- Tìm bạn bằng email chính xác; phản hồi gửi lời mời không tiết lộ email đó có tài khoản hay không. Lời mời không tự động tạo quan hệ; chỉ người nhận chấp nhận mới trở thành bạn bè. Giới hạn số lượng lời mời/bạn bè/mục chia sẻ và cỡ ảnh.
- Nếu hộp lời mời đã đầy, lời mời theo email chưa thể chuyển sẽ được giữ lại. Dòng ký ức của bạn bè tải từng trang 30 mục và có thể xem tiếp các mục cũ.
- Nếu cloud lỗi, không đánh dấu mục là đã chia sẻ. Màn hình phải nói rõ trạng thái, tránh hiện nhãn “Chỉ mình tôi” cho mục mà trạng thái cloud chưa được xác minh.

## Contract

`POST /functions/v1/memory-access`, `Authorization: Bearer <Firebase ID token>`, `apikey: <Supabase publishable key>`, body JSON giới hạn kích thước. Các action: `state`, `invite`, `accept`, `decline`, `cancel`, `remove-friend`, `feed`, `photo`, `publish`, `confirm`, `unshare`. Mọi UID chủ sở hữu lấy từ token, không tin UID do client gửi. Ảnh chia sẻ đi qua signed upload; feed và yêu cầu làm mới URL ảnh chỉ cấp signed download sau khi kiểm tra quan hệ bạn bè. Không gửi link trực tiếp giữa người dùng.

## Phạm vi bản này

- Chia sẻ cho toàn bộ danh sách bạn đã chấp nhận, chưa có chọn từng bạn hay widget.
- Ảnh riêng trên máy không được sao lưu. Bản chia sẻ trên cloud là bản sao có thể xóa; việc đổi máy không tự phục hồi ký ức riêng từ bản chia sẻ.
- Không có thông báo đẩy lời mời; người dùng mở phần Bạn bè hoặc kéo xuống để cập nhật.
