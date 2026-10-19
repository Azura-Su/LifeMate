# Đồng bộ Của tôi — 16/10/2026

## Trải nghiệm

- Của tôi tự sao lưu ảnh gốc/nội dung theo tài khoản; tài khoản khác không đọc được. Khi mở Ký ức, app nhập cache cũ của đúng UID rồi máy khác tải về. Không cần email xác nhận để dùng kho riêng.
- Hiện bản trên máy ngay, trạng thái đồng bộ và thông báo lỗi; không xóa cache khi mạng lỗi. Mở trang xem lại hoặc đưa app về foreground để cập nhật; Firestore listener báo thay đổi từ máy khác.
- Hai thiết bị sửa/xóa cùng mục: giữ bản đang chờ và hỏi chọn bản trên máy/cloud. Kiểm tra lại revision trước khi áp dụng; không tự chọn theo đồng hồ máy. Editor/hộp xóa giữ snapshot nội dung đã mở và từ chối nếu nội dung, ảnh, quyền xem, thời điểm sửa hoặc trạng thái xóa thay đổi; xác nhận đồng bộ chỉ thay revision/cỡ ảnh/proof không làm form mất hiệu lực. Kiểm tra snapshot khi chọn bản xung đột vẫn giữ chặt revision.
- Chia sẻ Bạn bè giữ Supabase/R2 như trước. Khi chưa lấy được quyền từ máy chủ, không khẳng định Chỉ mình tôi. Sửa mục cũ chỉ lưu sau khi gỡ chia sẻ thành công; chụp ký ức mới vẫn lưu offline.

## Lưu trữ

- Firestore `memoryAccounts/{uid}/items/{id}`: metadata có revision UUID, ảnh filename/cỡ, ngày/nội dung, hoặc tombstone tối thiểu. Không cho xóa thẳng tombstone để thiết bị cũ không nhập lại bản đã xóa.
- Cloudflare R2 private `private/{uid}/{id}/{filename}`: ảnh gốc tối đa 15 MiB, tên bất biến khi thay ảnh. `memory-access` lấy UID từ Firebase token và kiểm tra account gate, không yêu cầu email xác nhận. PUT ký 120 giây ràng buộc MIME/cỡ và `If-None-Match: *`; GET ký tối đa 600 giây. Xác nhận HEAD trước commit metadata, không lưu URL trong cache/Firestore. Firebase Storage chỉ dùng để đọc ảnh cũ khi R2 xác nhận chưa có object; chuyển bản gốc trên máy hoặc vừa tải từ Firebase sang R2, giữ nguyên bản Firebase. Lỗi R2 không kích hoạt fallback.
- Cache mã hóa và file gốc theo UID vẫn dùng schema v1; optional cloudRevision/pendingRevision/deletedAt/photoSizeBytes tương thích dữ liệu cũ. Stable pending intent lưu trước upload. Ảnh upload xong mới commit metadata bằng compare-and-set transaction; đọc server xác nhận đúng revision trước khi xóa pending.
- Lỗi tải lên/tải xuống một ảnh giữ mục đó để thử lại, không chặn các mục còn lại; trạng thái vẫn báo chưa đồng bộ đầy đủ. Mỗi mục áp dụng thành công được lưu cache ngay.
- Sau khi áp dụng tombstone/thay ảnh/chọn bản cloud, dọn ảnh gốc không còn được cache tham chiếu trong thư mục UID. Chỉ xóa sau khi cache mã hóa đã lưu; giữ mọi ảnh đang được mục pending/conflict tham chiếu. Lỗi dọn file được thử lại khi sync tiếp; không dọn ảnh cloud ở bước này.
- Cache riêng trên máy giữ `r2Photo: {fileName, sizeBytes}` sau khi xác minh upload hoặc tải ảnh R2 thành công. Không ghi dấu này vào Firestore, không dùng làm quyền truy cập. Chỉ tái sử dụng khi UID/ID/filename, cỡ cloud và file trên máy khớp; file mất hoặc thay ảnh vẫn tải/xác minh lại. Cache cũ chưa có dấu vẫn chuyển/xác minh R2 một lần. Dấu không làm editor/conflict đang mở bị coi là sửa dữ liệu.
- Các lần mở màn/listener/refresh chồng nhau gộp thành một lần đang chạy và một lượt tiếp theo khi có thay đổi, giữ kiểm tra tài khoản và revision.
- Download vào `.partial`, kiểm tra kích thước, đổi tên sau khi đủ. Kiểm tra phiên trước/sau await, hủy transfer khi đổi UID; account deletion gate chặn công việc mới.
- Xóa tài khoản dọn cả R2 `private/{uid}/` và `shared/{uid}/`, cùng ảnh Firebase cũ; cleanup phân trang có retry.
- Không tự dọn ảnh cloud phiên bản cũ vì thiết bị offline có thể còn tham chiếu; xóa tài khoản sẽ dọn toàn bộ prefix và metadata. Tombstone và marker chia sẻ giữ tới lúc xóa tài khoản.
- `delete-own` trên backend gỡ bản chia sẻ và tạo marker trước Firestore tombstone, chống publish đồng thời. Không tuyên bố đã đồng bộ nếu một bước thất bại.

## Triển khai

- Cập nhật R2 ngày 17/10: deploy `memory-access` và `user-admin` trước khi phát hành JS mới. Dùng bucket/secrets R2 hiện có; không cần migration dữ liệu hoặc thay Firestore rules. Mọi máy phải chạy JS mới để đọc ảnh mới chỉ có trên R2; client Firebase-only cũ không đọc được ảnh mới này.
- Áp dụng migration marker trên Supabase, deploy memory-access và user-admin; deploy Firestore/Storage rules. Không cần build native mới vì app đã có Firebase Storage/Firestore SDK.
- Máy thật phải chạy JS mới và mở Ký ức để upload dữ liệu trước đây chỉ nằm trên máy; máy khác cùng UID tải về sau đó. Chưa thể phục hồi dữ liệu chỉ nằm trên một máy chưa mở phiên bản mới.

- Mọi yêu cầu cấp URL/kiểm tra ảnh riêng phải kết thúc khi hết deadline20 giây
  hoặc đổi phiên đăng nhập, kể cả khi lấy token hoặc giải mã JSON không kết
  thúc. Đăng xuất rồi đăng nhập lại cùng UID vẫn hủy yêu cầu cũ; kết quả token
  muộn không được bắt đầu fetch. Dọn timer/subscription trong finally và giải
  phóng hàng đợi UID khi hủy.
