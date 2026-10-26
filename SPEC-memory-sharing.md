# Chia sẻ Dòng ký ức — 13/10/2026

## Quota lời mời và bạn bè — 23/10/2026

- Service-only RPC `invite_lifemate_memory_friend` kiểm tra và ghi trong cùng
  transaction: tối đa20 lần mời/24giờ,20 lời mời đang gửi (email chưa đăng ký và
  request đã có UID cộng chung),20 lời mời trong inbox. Duplicate, người nhận chưa
  đăng ký hoặc inbox đầy đều trả `sent:true`; hết quota ngày trả HTTP429.
- Invite/claim/accept khóa UID và email theo thứ tự ổn định. Claim chuyển email
  invite sang request trong cùng transaction, giữ invite chưa chuyển khi inbox
  đầy. Accept khóa cả hai UID trước khi kiểm tra tối đa100 bạn cho mỗi bên.
- Không tự xóa quan hệ hoặc pending đã tồn tại trước migration. Áp dụng migration
  `20261022185328_memory_invite_quota_transactions.sql` trước handler mới.

## Trải nghiệm

- Thẻ Của tôi thu gọn phần dưới ảnh thành hai hàng: ngày/giờ dạng ngắn và quyền xem; ghi chú và nút sửa. Nút xóa nằm trên góc phải ảnh, có nền dễ nhìn và vùng chạm44pt; mục cũ không có ảnh giữ nút xóa bên dưới. Giữ vùng chạm ít nhất44pt, nhãn ngày đầy đủ cho trình đọc màn hình và nội dung ghi chú tự xuống dòng.

- Ảnh chụp mới mặc định chọn **Bạn bè** trong form lưu. Người dùng có thể đổi sang **Chỉ mình tôi** trước khi lưu; chỉ gửi bản chia sẻ sau khi bấm Lưu. Sửa ký ức đã có giữ quyền xem lúc mở form. Ảnh và nội dung chỉ xuất hiện với các tài khoản đã kết bạn và đã chấp nhận lời mời.
- Quyền **Bạn bè** áp dụng cho toàn bộ bạn bè hiện tại và người kết bạn sau này; giao diện nói rõ điều này trước khi đăng ảnh.
- Tab Ký ức vẫn mở ở màn chụp. Trang xem lại có hai phần **Của tôi** và **Bạn bè**; thanh chọn hai phần cố định phía trên, chỉ danh sách bên dưới cuộn. Đầu danh sách Của tôi chỉ hiện trạng thái đồng bộ; nút quản lý Bạn bè/số lượng/lời mời chỉ hiện trong tab Bạn bè. Bỏ dòng tổng số khoảnh khắc và dòng giải thích “Chỉ bạn chọn mục nào được chia sẻ”. Phần Của tôi hiển thị nhãn quyền xem và cho đổi quyền, sửa, xóa; phần Bạn bè hiển thị các mục đang được bạn bè chia sẻ.
- Người dùng nhập chính xác email đăng nhập LifeMate của bạn để gửi lời mời; bên nhận chấp nhận hoặc từ chối. Không có danh bạ hay tìm kiếm gần đúng. Email của người dùng lấy từ phiên Firebase đang đăng nhập, không nhập lại. Chỉ email đã được Firebase xác nhận trong ID token mới được dùng để ghép lời mời và chia sẻ; không nhận email tự khai từ client. Cảnh báo xác nhận email chỉ hiện trong phần Bạn bè, còn ký ức riêng vẫn đọc được bình thường. Có thể hủy lời mời và xóa bạn. Nếu không có kết nối, vẫn tạo và đọc ký ức riêng đã lưu trên máy.
- Nếu người nhận chưa mở Ký ức trên phiên bản mới, lời mời được giữ theo email và hiện khi họ mở tính năng này. Người gửi nhận cùng một phản hồi cho email có hoặc chưa có tài khoản.
- Sửa ký ức chỉ cho chỉnh nội dung; không có thao tác chụp/thay ảnh hoặc đổi quyền xem trong form sửa. Giữ ảnh, ngày và trạng thái quyền xem lúc mở; đổi quyền dùng nút riêng trên thẻ. Mục cũ không có ảnh vẫn sửa được nếu nội dung không rỗng. Sửa một mục đã chia sẻ sẽ gỡ bản chia sẻ trước, cập nhật bản trên máy, rồi chia sẻ lại theo quyền Bạn bè lúc mở form. Nếu chia sẻ lại lỗi, bản trên máy được giữ riêng và app báo rõ.

## Dữ liệu và quyền

- Của tôi lưu cache mã hóa theo UID và đồng bộ metadata trên Firestore, ảnh gốc riêng trên R2 (xem `SPEC-private-memory-sync.md`). Trường `visibility` chỉ là gợi ý hiển thị; Supabase là nguồn quyền chia sẻ chính thức.
- Chỉ các mục chọn Bạn bè có bản sao chia sẻ cloud. Supabase Postgres lưu metadata, bucket Cloudflare R2 private lưu ảnh mới; ảnh cũ ở Supabase Storage được chuyển dần sang R2. Edge Function xác minh Firebase ID token rồi mới đọc/ghi. Client không có service-role key hoặc khóa R2. SQL bật RLS và không cấp quyền bảng/bucket trực tiếp cho `anon` hoặc `authenticated`.
- Người xem chỉ nhận metadata/URL ảnh của mục `active` từ chủ tài khoản đang là bạn. URL ảnh có thời hạn ngắn. Gỡ chia sẻ ẩn metadata trước khi dọn ảnh; không cấp URL mới sau khi gỡ. URL đã ký có thể còn hiệu lực rất ngắn cho đến khi hết hạn hoặc ảnh bị xóa.
- Tìm bạn bằng email chính xác; phản hồi gửi lời mời không tiết lộ email đó có tài khoản hay không. Lời mời không tự động tạo quan hệ; chỉ người nhận chấp nhận mới trở thành bạn bè. Giới hạn số lượng lời mời/bạn bè/mục chia sẻ và cỡ ảnh.
- Nếu hộp lời mời đã đầy, lời mời theo email chưa thể chuyển sẽ được giữ lại. Dòng ký ức của bạn bè tải từng trang 30 mục và có thể xem tiếp các mục cũ.
- Nếu cloud lỗi, không đánh dấu mục là đã chia sẻ. Màn hình phải nói rõ trạng thái, tránh hiện nhãn “Chỉ mình tôi” cho mục mà trạng thái cloud chưa được xác minh.

## Contract

Tab Ký ức chỉ xuất hiện khi email tài khoản có trong bảng `users` của Firebase
Remote Config (khớp chính xác sau khi bỏ khoảng trắng đầu/cuối và không phân biệt
hoa thường). Không có email hoặc danh sách rỗng thì ẩn tab và không đăng ký route
Memories. Navigator cập nhật theo tài khoản/danh sách đang kích hoạt; thu hồi email
khi đang xem Ký ức sẽ gỡ màn này. Offline dùng cấu hình đã kích hoạt theo cơ chế
cache hiện tại. Đây là điều kiện hiển thị UI, không thay quyền dữ liệu backend.

`POST /functions/v1/memory-access`, `Authorization: Bearer <Firebase ID token>`, `apikey: <Supabase publishable key>`, body JSON giới hạn kích thước. Các action: `state`, `invite`, `accept`, `decline`, `cancel`, `remove-friend`, `feed`, `photo`, `publish`, `confirm`, `unshare`, `delete-own`, `migrate`. Mọi UID chủ sở hữu lấy từ token, không tin UID do client gửi. Ảnh chia sẻ đi qua signed upload; feed và yêu cầu làm mới URL ảnh chỉ cấp signed download sau khi kiểm tra quan hệ bạn bè. `migrate` chỉ chuyển ảnh của chính chủ từ Supabase Storage sang R2 sau khi xác minh bản sao R2. Không gửi link trực tiếp giữa người dùng.

## Phạm vi bản này

- Chia sẻ cho toàn bộ danh sách bạn đã chấp nhận, chưa có chọn từng bạn hay widget.
- Bản gốc riêng được sao lưu theo tài khoản trên R2, metadata trên Firestore; bản chia sẻ vẫn tách riêng trên Supabase/R2.
- Không có thông báo đẩy lời mời; người dùng mở phần Bạn bè hoặc kéo xuống để cập nhật.

## Giới hạn chia sẻ đồng thời — 16/10/2026

- Mỗi UID tối đa 100 mục cloud, bao gồm bản ảnh `pending`. RPC `reserve_lifemate_shared_memory` khóa theo owner trong transaction để kiểm tra quota và ghi cùng lúc; retry cùng mục pending không chiếm thêm slot, mục active trả `already-shared`.
- RPC chỉ cấp `EXECUTE` cho `service_role`; quyền client không thay đổi. Áp dụng `supabase/migrations/202610160003_memory_publish_quota.sql` trước khi deploy phiên bản `memory-access` dùng RPC. Migration bổ sung hàm, không đổi hoặc xóa dữ liệu hiện có.

## Xóa nhiều thiết bị — 16/10/2026

- `delete-own` chặn chia sẻ lại cùng ID bằng marker bền vững và xóa row chia sẻ trong transaction cùng khóa owner với publish reservation. Chỉ sau khi gỡ bản chia sẻ thành công mới xác nhận tombstone riêng trên Firestore. Retry giữ con trỏ ảnh để dọn tiếp nếu mất mạng.
- `unshare` và `delete-own` chấp nhận phiên chủ tài khoản hợp lệ dù email chưa xác nhận, chỉ giảm quyền xem, không tạo profile hay nhận lời mời. Các thao tác kết bạn/chia sẻ khác vẫn yêu cầu email xác nhận.
- Marker chỉ service role đọc/ghi, được dọn khi xóa tài khoản. ID đã xóa không thể chia sẻ lại; nếu khôi phục bản sửa offline riêng, cần tạo ký ức mới để chia sẻ. Migration `202610160004_private_memory_deletions.sql` phải có trước handler mới.

## Phản hồi thao tác và thời gian chờ — 17/10/2026

- Mở timeline hiện chỉ báo đồng bộ ngay, vẫn hiển thị ảnh/cache đang có. Mỗi ảnh hiện spinner đến khi load/decode xong hoặc có lỗi.
- Tab Bạn bè chỉ dùng một chỉ báo tải danh sách ngay dưới dòng số lượng Bạn bè, theo toàn bộ yêu cầu state và feed (bao gồm sau kết bạn hoặc kéo tải lại). Kéo tải lại vẫn hoạt động nhưng không giữ thêm spinner hệ thống ở đầu trang hoặc trong khung rỗng. Chỉ hiện “Chưa có ký ức từ bạn bè” sau khi feed của UID hiện tại tải thành công và trả rỗng; trạng thái state tải xong chưa đủ để kết luận. Sau lần tải thành công, giữ feed (kể cả rỗng), các trang đã tải và con trỏ trang trong bộ nhớ khi chuyển Của tôi/Bạn bè; quay lại Bạn bè không gọi tải lại hay hiện spinner danh sách. Đọc riêng trạng thái chia sẻ không xóa feed hoặc làm hiện spinner Bạn bè đã tải. Kéo refresh ở Bạn bè hoặc thay đổi quan hệ bạn bè vẫn tải mới; đổi tài khoản xóa cache. Xóa dấu đã tải mỗi khi xóa feed; lỗi tải hiện lỗi và dừng loading.
- Khi đổi quyền xem, lựa chọn đang xử lý thay icon bằng spinner và mô tả tiến trình; chặn nhấn lặp. Chỉ hoàn tất sau publish/confirm hoặc unshare được xác nhận và lưu cache cục bộ. Đồng bộ toàn thư viện tiếp tục nền, không giữ popup chờ bước đó. Giữ rollback và thông báo lỗi/thử lại hiện có.
- Khi chia sẻ, kiểm tra lại snapshot nội dung, publish/confirm và lưu quyền Bạn bè trong cùng hàng đợi theo UID. Nếu nội dung đã đổi trong lúc chờ đồng bộ thì từ chối trước khi publish. Lỗi sau publish phải thử gỡ chia sẻ trước khi nhả hàng đợi; không gỡ được phải báo chưa xác nhận quyền xem kể cả khi ghi cache cũng lỗi.
- Phản hồi state cũ không ghi đè hành động vừa xác nhận; state chưa biết được kiểm tra lại, không đoán quyền riêng tư.
- Chuyển tab hoặc cập nhật nền giữ nhãn quyền xem đã xác nhận của tài khoản hiện tại trong khi tải state mới, không đổi mọi nhãn thành “Đang kiểm tra…”. State mới thành công cập nhật nhãn; lỗi đọc state bỏ kết quả cũ và hiện “Chưa xác định”. Lỗi chỉ ở feed ảnh không xóa state vừa xác nhận. Đổi UID xóa cache; sau lưu nội dung/ảnh phải loại snapshot trước lần lưu và kiểm tra lại để không gắn nhãn riêng tư sai cho mục mới chia sẻ.
- Nhãn quyền xem có padding dọc 4pt, nền cao tối thiểu 28pt trong vùng chạm 44pt. Chỉ hiện “Đang kiểm tra…” khi đang gửi yêu cầu; khi đọc thất bại hiện “Chưa xác định”, cho thử lại và hiện lỗi ở Của tôi. Phản hồi JSON thiếu/hỏng và quá hạn phải báo rõ, không biến thành danh sách chia sẻ rỗng.
- Của tôi chỉ tải trạng thái chia sẻ; chỉ lấy feed ảnh bạn bè khi tab Bạn bè cần. Lần chia sẻ ảnh mới vẫn cần nén và tải bản chia sẻ riêng tối đa2MB; bản gốc private không trở thành ảnh public.

- Chạm ảnh trong Của tôi hoặc Bạn bè mở ảnh lớn toàn màn hình, giữ tỉ lệ đầy đủ và có loading/lỗi. Chạm hai lần liên tiếp tại cùng vùng ảnh để phóng2,5 lần quanh vị trí chạm; khi đang phóng, chạm hai lần đưa về kích thước chuẩn. Không nhận nhầm thao tác kéo, giữ lâu hoặc chạm đa điểm thành chạm đôi. Chụm hai ngón thu/phóng từ1–4 lần, kéo để xem vùng ảnh khi đang phóng. Ở kích thước chuẩn, vuốt xuống đóng ảnh, vuốt trái/phải chuyển ảnh sau/trước theo thứ tự danh sách đang mở; bỏ qua mục không có ảnh và dừng ở hai đầu. Nội dung ghi chú của ảnh hiện ở cuối màn xem, dưới ảnh; ghi chú dài cuộn riêng và đổi theo ảnh đang xem, mục không có nội dung không giữ vùng trống. Mỗi ảnh mới trở về kích thước chuẩn. Giữ nút đóng và điều khiển chuyển ảnh cho khả năng tiếp cận. Link ảnh bạn bè lỗi được làm mới một lần qua kiểm tra quyền hiện có; bỏ qua kết quả cũ khi đã chuyển ảnh/đổi tài khoản. Trình xem đóng khi app vào nền hoặc rời màn hình. Nút xóa trên thẻ vẫn thao tác độc lập.

- Bấm chụp hiện ngay lớp xử lý ảnh che toàn bộ preview và khóa thao tác điều hướng/chụp lặp. Khi camera trả ảnh hợp lệ mở form nội dung; lỗi chụp trả lại camera với thông báo. Kết quả chụp cũ sau khi rời màn hình không được mở form. Giữ xử lý hướng ảnh gốc của camera.
- Khi bàn phím mở, popup ký ức nằm ngay trên bàn phím với khoảng cách 12pt; header và nút X luôn nằm trong vùng an toàn phía trên. Ảnh tự vừa phần chiều cao còn lại, giữ tỷ lệ và không có vùng cuộn ảnh riêng. Chạm bất kỳ đâu ngoài ô nội dung, kể cả nền ngoài popup, để ẩn bàn phím và đưa popup trở lại giữa màn hình, không đóng bản nháp. Chạm hoặc kéo trong ô nhập vẫn giữ bàn phím; nút Lưu, quyền xem và nút X vẫn hoạt động bằng một lần chạm. Ô nội dung nằm ngay trên nút Lưu, giới hạn chiều cao và cuộn chữ dài bên trong; lưu bằng một lần chạm. Popup quyền xem che cả ô nhập và nút Lưu khỏi trình đọc màn hình. Các dialog khác giữ cách tránh bàn phím mặc định.

- Màn chụp dùng khung camera co giãn theo phần chiều cao còn lại, cụm nút chụp/đổi camera cố định phía trên thanh tab; tiêu đề và khung camera nằm trong vùng cuộn riêng khi màn thấp, bỏ nút xem ký ức có số lượng và dòng nhắc quyền riêng tư phía dưới. Mở danh sách bằng nút lưới ở header.

- Yêu cầu chỉ đọc state/feed/photo được thử lại tối đa một lần khi HTTP thành công nhưng nội dung JSON không đọc được; giữ chung ngân sách 20 giây từ lấy token, fetch và đọc body đến làm mới xác minh email hoặc thử lại. Đổi phiên hủy yêu cầu, kể cả đăng xuất rồi đăng nhập lại cùng UID; kết quả JSON muộn không được tự khởi động lần thử lại bằng phiên mới. Không tự gửi lại các thao tác thay đổi dữ liệu khi phản hồi không rõ. Quá hạn hoặc hết lượt thử vẫn báo lỗi/chưa xác định, không suy ra quyền riêng tư.

- Thông báo lỗi chia sẻ không có nút Thử lại; kéo xuống danh sách để tải lại. Giữ nút xác nhận email cho luồng xác minh tài khoản.

- Camera chỉ được mount khi tab Ký ức đang focus, app ở trạng thái active và không mở editor. Inactive/background hoặc rời tab phải gỡ CameraView để nhả phiên camera; quay lại chờ onCameraReady mới cho chụp. Trạng thái app chưa xác định không được coi là foreground.

- Gỡ chia sẻ dùng trạng thái `revoking` và lease dọn ảnh5 phút: ẩn metadata trước,
  chặn confirm/publish trong khi dọn, kiểm tra token trước khi xóa row. Cleanup
  thất bại giữ con trỏ và lease để retry an toàn sau hết hạn. Mỗi reservation có
  token mới để confirm cũ không kích hoạt lần chia sẻ mới. Retry publish pending
  không xóa object từ snapshot cũ; đổi pending có ảnh sang text-only phải unshare
  trước. Giữ quota cho mọi row chưa dọn xong và giữ cờ cleanup Supabase cũ.
- Chụp mới, lưu riêng thành công nhưng chia sẻ lỗi phải giữ cảnh báo khi chuyển
  sang timeline và auto-refresh. Chỉ xóa phản hồi này khi đổi tài khoản hoặc bắt
  đầu thao tác lưu/chụp/đổi quyền mới.
- Migration ảnh Supabase active dùng lease5 phút cùng khóa owner với gỡ/xóa; trong
  lease, gỡ/xóa trả busy rõ ràng và feed vẫn đọc ảnh Supabase. Copy R2 dùng atomic
  If-None-Match và proof reservation ổn định, không ghi đè object đã tồn tại. Retry
  sau lỗi SQL chỉ dùng lại object có proof đúng hoặc bytes giống nguồn legacy;
  CAS cuối cần đúng reservation/lease còn hạn trước khi chuyển backend và dọn nguồn.

## Đổi camera — 19/10/2026

- Khóa nút chụp/đổi ngay khi bắt đầu chuyển camera, chặn tap kép bằng ref, mở lại khi nhận camera ready. Bỏ qua callback ready/error từ phiên cũ sau retry, đổi camera hoặc rời màn.
- expo-camera55.0.23 trên iOS chỉ phát onCameraReady khi khởi tạo session, không phát khi đổi facing trong cùng session. iOS tạo CameraView mới cho mỗi lần đổi để nhận sự kiện đúng; Android giữ view hiện tại để native rebind nhanh và nhận sự kiện OPEN.
- Không dùng thời gian chờ giả để đánh dấu ready. Giữ timeout10giây cho lỗi thiết bị thật và nút retry. Không đổi dependencies/native code.

## Giảm chờ khi mở và chia sẻ — 26/10/2026

- Các lần đọc state đồng thời cùng UID, phiên đăng nhập và tên hiển thị dùng
  chung một yêu cầu đang chạy. Không giữ kết quả hoàn tất làm cache quyền.
  Bắt đầu và kết thúc mutation (kể cả lỗi chưa xác nhận) đều ngăn lần đọc sau
  dùng chung snapshot cũ; đổi phiên hủy các caller đang chờ.
- Ảnh mới có metadata camera/picker giữ tỷ lệ, cạnh dài tối đa1024px,
  fallback760px nếu JPEG vượt2MB; không phóng ảnh nhỏ. Metadata chỉ đi kèm draft
  trong bộ nhớ, không ghi cache/Firestore hoặc gửi server. Mục cũ không có
  metadata giữ bước resize theo chiều rộng như trước. Dùng lại pipeline native
  khi fallback và dọn file tạm khi kiểm tra cỡ/lưu thất bại. Bản gốc riêng không
  bị thu nhỏ hoặc đổi quality.
- Camera chuyển width/height hợp lệ vào editor để khỏi đọc lại kích thước file.
  Tỷ lệ dự phòng3/4 không được coi là metadata thật; thiếu kích thước hoặc chụp
  lại mà metadata không hợp lệ thì đọc kích thước như trước.

## Tab mặc định và cache bạn bè — 19/10/2026

- Khi vào tab Ký ức ở foreground và đang focus, tải trạng thái bạn bè ngay cả khi đang ở màn chụp. Không tải feed/ảnh bạn bè cho tới khi mở Dòng ký ức ở tab Bạn bè.
- Ghi cache boolean có/không có bạn bè đã chấp nhận theo UID, mã hóa với key `lifemate:memory-friends-tab:v1:{uid}`. Không lưu email/danh sách bạn/token trong hint này; không dùng cache để cấp quyền chia sẻ hay ảnh.
- Khi mở Dòng ký ức, ưu tiên trạng thái máy chủ đã có, sau đó cache đúng UID: có bạn bè mở Bạn bè ngay, chưa có mở Của tôi. Mạng lỗi giữ hint; lần nhận thành công không còn bạn bè cập nhật false. Lời mời chưa chấp nhận không tính.
- Không cho phản hồi cache muộn thay thế thông tin máy chủ mới, tài khoản khác hoặc lựa chọn tab bằng tay của người dùng. Cache nằm trong namespace được dọn khi xóa tài khoản.
- Feed đã tải gắn với UID tài khoản và tập UID bạn bè đã chấp nhận. Khi một phản hồi state mới phát hiện tập này thay đổi (kể cả từ thiết bị khác), bỏ feed và con trỏ phân trang cũ, rồi tải lại từ đầu khi xem Bạn bè. Đổi thứ tự hoặc tên bạn bè không làm mất cache; trang cũ đang tải không được khôi phục dữ liệu đã vô hiệu.

## Thời điểm kết thúc lưu khoảnh khắc — 19/10/2026

- Mở màn camera chỉ đọc cache riêng, chưa chạy đồng bộ ảnh gốc trong hàng đợi ghi. Mở Dòng ký ức mới bắt đầu đồng bộ riêng theo lịch focus hiện có.
- Nút Lưu khoảnh khắc kết thúc khi ảnh và metadata đã ghi bền vững trên máy; thêm mục vừa lưu vào danh sách ngay, không đợi backup ảnh gốc và đồng bộ toàn bộ kho. Dùng loader coalescing hiện có chạy nền, không đánh dấu đã đồng bộ trước khi máy chủ xác nhận.
- Nếu chọn Bạn bè, vẫn chờ xác nhận chia sẻ hiện có; lỗi chia sẻ/không xác định quyền được giữ đúng như trước. Sửa mục cũ vẫn gỡ quyền chia sẻ trước khi ghi theo quy tắc an toàn hiện có.
- Nếu hàng đợi đang chạy đồng bộ từ lần xem Dòng ký ức trước đó, ghi mới vẫn tuần tự chờ tác vụ đang chạy để giữ nhất quán; không sửa cơ chế queue hoặc bỏ kiểm tra quyền nhằm làm nhanh.

- Sau khi sửa nội dung thành công, giữ nhãn quyền xem đã xác nhận và cập nhật đúng ID từ kết quả lưu/chia sẻ; làm mới máy chủ ngầm không reset nhãn về loading. Nếu quyền trước đó chưa xác định hoặc chia sẻ chưa được xác nhận, không suy đoán quyền từ cache.
- Chia sẻ thành công trả lại entry thực tế đã ghi bền vững, gồm updatedAt và revision mới. Dùng entry này khi cập nhật thẻ ngay để sửa/xóa tiếp không bị từ chối bởi snapshot trước chia sẻ; vẫn giữ rollback khi ghi cache thất bại và không chờ backup ảnh gốc.
- Đổi tài khoản xóa thông báo lỗi đọc cache của phiên trước trước khi nạp cache mới.
