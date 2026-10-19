# Hồ sơ cá nhân

- Bấm thẻ tên/email trong Menu mở màn Hồ sơ cá nhân cho tài khoản đang đăng nhập.
- User chưa xác nhận email vẫn mở và sửa Hồ sơ. Hiện trạng thái xác nhận, nút gửi thư (chờ 60 giây trước gửi lại) và “Tôi đã xác nhận”; làm mới qua dịch vụ Auth hiện có khi vào màn/quay lại app. Không đổi trạng thái xác nhận bằng dữ liệu client tự khai.
- Bố cục hồ sơ gồm hai khối: avatar và tên hiển thị cùng khối cá nhân; email, trạng thái xác nhận và đổi mật khẩu cùng khối tài khoản. Icon email/khóa cùng kích thước, trạng thái xác nhận dùng dòng gọn thay badge nổi. Khi kiểm tra lần đầu chỉ hiện dòng loading, không bung hộp xác nhận gây nhảy bố cục. Nút lưu ở cuối màn hình, chừa safe area phía dưới; nội dung dài vẫn cuộn được đến nút lưu.
- Tên từ 1–60 ký tự hợp lệ. Tên do người dùng lưu trong Firebase Auth được ưu tiên; Remote Config chỉ cung cấp tên dự phòng khi chưa có tên tự đặt.
- Badge máy ảnh gọn 22 px/icon 12 px, toàn bộ avatar 64 px là vùng chạm. Khi chạm, camera đổi ngay sang spinner tới khi sheet báo onShow; khi tải/chọn/cắt ảnh vẫn dùng spinner trong cùng khung, hủy/hoàn tất trả về camera, không nhảy bố cục. Chạm mở bottom sheet đúng hai lựa chọn: Chỉnh sửa ảnh hiện tại và Chọn ảnh từ thư viện. Khi chưa có avatar riêng, lựa chọn chỉnh ảnh hiện tại bị vô hiệu.
- Chỉnh ảnh hiện tại mở bản nháp trên máy hoặc tải lại avatar riêng bằng signed URL mới. Chọn ảnh thư viện (tối đa 20 MiB) không tự cắt giữa; cả hai luồng mở khung cắt vuông có kéo ảnh, zoom 1–3x bằng thanh/nút ±, đặt lại và hủy. Vùng cắt luôn nằm trong ảnh. Dùng ảnh chỉ cập nhật preview; Lưu thay đổi mới upload. Hủy/lỗi không thay draft cũ. Ảnh đã lưu chỉ còn phần đã cắt; muốn lấy lại phần ngoài khung phải chọn lại ảnh gốc từ thư viện.
- Xác nhận vùng cắt nén JPEG 384×384 tối đa 512 KiB. Tài khoản chưa có ảnh dùng logo LifeMate; không có thao tác đưa ảnh đã đặt về logo mặc định. Xem trước ảnh/tên rồi bấm Lưu thay đổi.
- Tên lưu bằng dịch vụ Firebase Auth hiện có. Ảnh lưu trong bucket Supabase private `lifemate-avatars`, đường dẫn duy nhất `profiles/{uid}/avatar.jpg`. Không lưu ảnh/base64/token vào Firebase Auth, Firestore hoặc Remote Config.
- Edge `profile-access` kiểm tra Firebase JWT và trạng thái khóa/thu hồi phiên hiện có; đường dẫn luôn suy ra từ UID đã xác minh. Tài khoản chưa xác nhận email vẫn sửa hồ sơ riêng. Chỉ upload trực tiếp JPEG nhỏ, không phát URL upload. URL xem ảnh riêng hết hạn sau 10 phút, chỉ cache trong bộ nhớ theo UID và làm mới khi cần.
- Đóng sheet trước khi mở native picker (iOS đợi onDismiss); tải avatar hiện tại có timeout 20 giây/cancel, file cache duy nhất và dọn khi hủy/rời màn. Crop/picker/download gắn UID và operation generation, không áp kết quả trễ sau hủy hoặc chuyển tài khoản.
- Lưu tên rồi lưu ảnh; nếu chỉ bước tên thành công phải thông báo đúng phần đã lưu và cho thử lại phần ảnh. Không áp dụng kết quả của phiên cũ sau logout/đổi UID. Dọn ảnh tạm khi thay ảnh, hủy, lưu hoặc rời màn.
- Menu và ảnh người dùng ở Home cập nhật sau khi lưu. Các màn đăng nhập/loading giữ logo thương hiệu.
- Luồng xóa toàn bộ dữ liệu admin phải dọn cả bucket avatar theo UID, kể cả upload đang chạy hoàn tất muộn.

## Kiểm tra triển khai

- Bucket private và hai functions `profile-access`/`user-admin` đã triển khai ngày 16/10/2026, không thêm credential/dependency.
- Simulator: mở Hồ sơ từ Menu, chọn ảnh thư viện, cắt vuông, xem trước, về logo mặc định và rời màn hoạt động. Không lưu ảnh thử vào tài khoản thật.
- Test tự động gồm đổi UID trong lúc chọn ảnh/lưu tên, tên thành công/ảnh lỗi rồi thử lại, ảnh tải về cũ không ghi đè ảnh vừa lưu, giới hạn JPEG và dọn avatar khi xóa user. Review độc lập không còn blocker.

Nguồn: [Expo ImagePicker](https://docs.expo.dev/versions/v55.0.0/sdk/imagepicker/), [Supabase standard upload](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [private signed URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl).


## Đổi mật khẩu — 17/10/2026

- Mục Đổi mật khẩu trong Hồ sơ mở dialog, giữ nguyên draft tên/ảnh đang sửa. Có mật khẩu hiện tại, mới và nhập lại; nút mắt riêng cho mỗi ô.
- Mật khẩu mới tối thiểu 8 ký tự, khác hiện tại, xác nhận khớp. Không trim hay chuẩn hóa mật khẩu. Firebase có thể áp thêm chính sách bảo mật và trả lỗi hiển thị phù hợp.
- Tài khoản provider password, kể cả email chưa xác nhận, dùng native Firebase Auth26.4: EmailAuthProvider.credential + reauthenticateWithCredential, sau đó updatePassword. Không tự tạo provider password cho tài khoản OAuth.
- Native và store UID cùng gate xóa tài khoản được kiểm tra trước/sau reauth và ngay trước update. Không lưu mật khẩu vào cache/store/log/backend riêng; chỉ giữ state form/native request trong thời gian xử lý. Không đặt timeout giả cho thao tác ghi có thể đã thành công.
- Ngăn submit kép, khóa nút đóng khi xử lý. ProfileContent unmount khi blur, dialog keyedUID; chuyển tài khoản không giữ form cũ. Rời foreground xóa nội dung và ẩn mật khẩu. Thành công xóa form rồi thông báo dùng mật khẩu mới ở lần đăng nhập sau, không khẳng định logout mọi thiết bị.
- Không cần deploy backend/rules/migration hoặc native dependency mới. Runtime không đổi mật khẩu thật bằng công cụ tự động; người dùng tự nhập và gửi.

Nguồn: [Firebase iOS manage users](https://firebase.google.com/docs/auth/ios/manage-users), API modular dependency @react-native-firebase/auth26.4.0.

- Bộ đếm gửi lại email chỉ chạy khi app active và còn thời gian. Trở lại sau khi
  hết hạn phải hiện thao tác gửi lại, không dùng timer trước khi khởi tạo và dọn
  interval sau hết hạn/unmount.
- Yêu cầu đọc/gỡ avatar có deadline20 giây cho cả token, fetch và đọc response
  body. Timeout/đổi phiên phải reject rõ ràng kể cả native request không settle,
  giải phóng dedupe/pending task và dọn timer/listener. Đổi metadata cùng UID không
  được coi là đăng nhập phiên khác.
- Upload avatar có ngân sách25 giây cho cả lấy token, kiểm tra file và upload
  native. Hủy từ caller, đổi phiên hoặc hết hạn phải giải phóng công việc đang
  chờ kể cả khi native cancel không hoàn tất; kết quả preflight muộn không được
  tạo upload mới.
