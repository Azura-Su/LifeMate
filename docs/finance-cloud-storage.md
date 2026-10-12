# Đồng bộ dữ liệu tài chính

Các giao dịch được lưu trong Firebase Firestore của LifeMate, tại
`financeAccounts/{uid}/transactions/{transactionId}`. Ứng dụng dùng Firebase
Authentication hiện có; Firestore rules chỉ cho UID đang đăng nhập đọc, tạo,
cập nhật hoặc xóa dữ liệu dưới đúng UID đó. Mỗi bản ghi chỉ chứa mã, UID, loại,
số tiền, danh mục, ghi chú và ngày phát sinh.

Danh mục tùy chỉnh và mẫu giao dịch được lưu riêng tại
`financeAccounts/{uid}/settings/preferences`. Khi mở Tài chính, ứng dụng tải
cài đặt của cùng UID về thiết bị; cài đặt cũ trong AsyncStorage được chuyển
lên cloud. Nếu đang offline, thay đổi vẫn được giữ trên máy và được thử gửi lại
khi chọn **Đồng bộ lại**. Khi thử lại, ứng dụng áp dụng thay đổi cục bộ lên bộ
cài đặt cloud hiện có để giữ các thay đổi riêng đã tạo trên thiết bị khác.

AsyncStorage vẫn là cache theo UID. Ở lần kết nối thành công đầu tiên, các giao
dịch cũ trên máy được hợp nhất và chuyển lên Firestore; bản trùng ID trên cloud
được ưu tiên. Sau khi cài lại ứng dụng và đăng nhập cùng tài khoản, Firestore
đổ dữ liệu trở lại cache. Màn hình báo **Đã lưu trên tài khoản** sau khi đồng bộ.

Khi không có kết nối hoặc Firestore từ chối truy cập, giao dịch cũ vẫn xem được
từ cache. Giao dịch mới vẫn có thể ghi cục bộ nhưng màn hình báo **Chưa sao lưu ·
chỉ có trên thiết bị**; cần chọn **Đồng bộ lại** khi kết nối phục hồi trước khi
gỡ ứng dụng. Chỉ những giao dịch thêm hoặc sửa trên máy mà cloud chưa xác nhận
mới được đẩy lại khi có mạng (bản sửa trên máy thắng bản cũ trên cloud); giao
dịch đã bị xóa ở thiết bị khác không bị tạo lại. Xóa giao dịch chỉ hoàn tất sau
khi Firestore xác nhận xóa; mọi lệnh ghi lên cloud dừng chờ sau 15 giây để không
treo các thao tác khác.

**Lịch sử triển khai (08/10/2026):** rules khi đó đã qua bộ kiểm tra trên
Firestore/Storage emulator. Bản rules trước khi thêm đường dẫn cài đặt tài chính
được publish lên Firebase project `baseapp-dd227` ngày 08/10/2026. Dữ liệu
lương lịch sử do người dùng cung cấp đã được nhập vào tài khoản hiện tại gồm 172
giao dịch thu nhập từ 2023 đến 2026; đã xác minh đủ 172 tài liệu trên Firestore.
Chỉ các khoản chi tiết được nhập, không nhập dòng tổng phụ tháng. Các ID lịch sử
có tính ổn định để chạy lại thao tác nhập không tạo bản sao. Báo cáo tháng nhóm
theo ngày phát sinh thực tế của từng giao dịch.

Rule giới hạn cài đặt tài chính theo UID và kích thước danh sách nằm trong
`firebase/firestore.rules`. Phiên bản rules này đã được kiểm thử và publish lên
project `baseapp-dd227` ngày 09/10/2026 để ứng dụng đồng bộ danh mục và mẫu lên
cloud.

**Bản sửa ngày 12/10/2026:** rules hỗ trợ giao dịch thu theo `incomeSource`,
sổ cho mượn, khoản chi liên kết, thu hồi và tombstone chống khôi phục khoản đã xóa.
Lần nhận tiền đầu tiên và hoàn tất lần trả đang chờ xử lý không còn cắt một danh
sách rỗng. Bộ emulator có 60 kiểm tra cho quyền sở hữu, dữ liệu tài chính, các
lần trả và kho âm thanh; kịch bản dịch vụ thực cũng đã chạy qua tạo khoản, sửa
vốn, nhận tiền, thử lại cùng lần trả và xóa khoản.

Đã phát hành riêng Firestore rules lên `baseapp-dd227` và đọc lại để xác nhận
nội dung trùng workspace. Ruleset: `18a2ede6-1853-405b-8793-eff1bbf74051`.
Bản trước để khôi phục khi cần: `88e9c91e-f2a5-4d33-8d5b-700dd21c8365`.

Ứng dụng đối soát mã lần trả đã được xác nhận sau khi mở lại, tải cả Tài chính
khi làm mới sổ và ngừng tác vụ nhắc hạn của phiên đã đăng xuất. Khoản chưa được
cloud xác nhận vẫn giữ mã thử lại để tránh ghi nhận hai lần.

Các rule nằm ở `firebase/firestore.rules`, kiểm thử cùng emulator bằng:

```sh
JAVA_HOME="$PWD/.build/tools/jdk21/Contents/Home" \
PATH="$PWD/.build/tools/jdk21/Contents/Home/bin:$PATH" \
.build/tools/node_modules/.bin/firebase emulators:exec \
  --project demo-lifemate-audio \
  --config firebase/audio.firebase.json \
  --only firestore,storage \
  'node scripts/test-audio-rules.cjs'
```

Khi cần cập nhật rules lên Firebase project `baseapp-dd227`, đăng nhập Firebase
CLI rồi chạy từ thư mục gốc:

```sh
.build/tools/node_modules/.bin/firebase deploy \
  --only firestore:rules \
  --project baseapp-dd227 \
  --config firebase/audio.firebase.json
```
