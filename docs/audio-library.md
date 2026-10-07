# Thư viện âm thanh LifeMate

Mỗi tài khoản Firebase có thư viện riêng. App lưu audio trên máy trước, sau đó upload file lên Firebase Storage và metadata lên Firestore. Không dùng Remote Config để chứa nhạc.

## Cách sử dụng

1. Đăng nhập, mở tab **MP3**, bấm **Chọn file audio hoặc video**, chọn file bằng trình chọn file hệ thống, nhập tên và bấm **Lưu âm thanh**. Tên có 1–120 ký tự, không cần nhập đuôi file. Bấm **Hủy** sẽ bỏ bản sao tạm vừa chọn. Audio được giữ nguyên định dạng; video được tách track tiếng đầu tiên thành M4A/AAC ngay trên thiết bị. Chỉ audio được lưu vào thư viện và gửi lên Firebase. Video gốc trong máy của bạn vẫn nguyên vẹn.
2. Bấm **Nghe** để phát/dừng/tua. Nếu file mới chỉ có trên Firebase, app tải bản riêng về máy trước khi mở.
3. Bấm **Cắt** trên một file, đặt tên bản mới và nhập điểm bắt đầu/kết thúc. Nhập số giây (ví dụ `12.5`) hoặc `phút:giây` (`1:02.5`). Dùng **Nghe thử đoạn** để nghe thử, rồi lưu.
4. Đánh dấu các file theo thứ tự muốn nối, bấm **Ghép**. Trong màn chỉnh sửa, dùng mũi tên lên/xuống để đổi thứ tự; mỗi đoạn có khoảng cắt riêng. Đặt tên và lưu kết quả M4A mới. Các file gốc giữ nguyên.
5. Bấm **Đổi tên** trên một bản nghe rồi **Lưu tên**. Tên được lưu trên máy trước; nếu bản audio đã sao lưu, app chỉ cập nhật tên trên Firestore, không upload lại audio. Tên mới chưa đồng bộ vẫn được giữ khi mở lại app hoặc làm mới danh sách. Bấm **Đồng bộ tên lên Firebase** để thử lại nếu cần.
6. Nếu mất mạng hoặc Firebase chưa được cấu hình, bản đã nhập/xuất vẫn nằm trên máy, hiện **Chỉ trên máy**. Nút **Sao lưu lên Firebase** (trước đây là “Đồng bộ lại”) gửi audio và thông tin lên Firebase để có thể tải lại trên thiết bị khác bằng cùng tài khoản. Nút làm mới chỉ tải lại danh sách cloud; không tự upload các bản còn trên máy.

Giữ app mở khi nhập/xuất/upload; có tiến trình và nút hủy. Hủy đồng bộ sau khi đã lưu không xóa bản local. Chuyển tab dừng phát; đăng xuất hủy tác vụ và bỏ dữ liệu khỏi giao diện. Dữ liệu local vẫn được giữ theo UID để dùng khi đăng nhập lại. Gỡ app sẽ mất các bản chưa đồng bộ.

Giới hạn: input tối đa 500 MiB, audio lưu tối đa 200 MiB, mỗi file/bản ghép tối đa 60 phút, 2–10 đoạn cho một bản ghép, đoạn tối thiểu 0,1 giây. Codec phụ thuộc thiết bị; file có DRM/không có tiếng/codec không hỗ trợ sẽ báo lỗi. Không cần quyền micro. Nguồn là file chọn từ thiết bị/Files; chưa có nhập URL, mix nhiều lớp, hiệu ứng hoặc xử lý/phát nền.

## Firebase thật: phần còn cần cấu hình

Chưa triển khai rules hoặc kiểm thử upload/download vào project thật `baseapp-dd227`. Firebase CLI trên máy chưa đăng nhập. Lần mở Console bị bộ duyệt tự động chặn khi chuyển sang `accounts.google.com`; cần chủ tài khoản cho phép truy cập trang đăng nhập trước khi tiếp tục.

Log Xcode ngày 07/10/2026 xác nhận Firestore trả `Cloud Firestore API has not been used in project baseapp-dd227 before or it is disabled`. Đây là lỗi cấu hình dịch vụ phía Firebase khi đọc danh sách; không phải lỗi file audio đã lưu. Banner kết nối chung có thể xuất hiện vì SDK chỉ trả `unavailable` hoặc request hết thời gian chờ. Nếu SDK trả thông tin API bị tắt, app hiển thị nguyên nhân cụ thể. Chưa xác minh trạng thái bucket Storage.

1. Trong Firebase Console, xác nhận đúng project và bucket mặc định trong hai file Firebase client. Kiểm tra gói thanh toán: Cloud Storage yêu cầu Blaze, vẫn có mức sử dụng miễn phí theo điều kiện của Firebase. Chưa tự đổi gói hay liên kết thanh toán. [Yêu cầu chính thức](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
2. Bật Cloud Firestore database `(default)` và Cloud Storage nếu chưa có, chọn vùng phù hợp. Auth Email/Password phải bật và có tài khoản thử nghiệm như hướng dẫn README.
3. Đọc và sao lưu rules hiện có. Gộp các match trong `firebase/firestore.rules` và `firebase/storage.rules` vào rules của project; giữ nguyên các phần dành cho ứng dụng khác. Kiểm tra không có wildcard `allow` khác vô tình cho người ngoài đọc các đường dẫn audio. Các file rules trong repo chỉ định nghĩa tính năng audio, mặc định từ chối mọi đường dẫn khác; không deploy đè một project đang dùng chung mà chưa đối chiếu.
4. Khi rules đã được đối chiếu, deploy bằng CLI hoặc Firebase Console. Cấu hình CLI nằm ở `firebase/audio.firebase.json` (khác `firebase.json` ở root dành cho React Native Firebase):

   ```sh
   firebase deploy --project baseapp-dd227 --config firebase/audio.firebase.json --only firestore:rules,storage
   ```

5. Kiểm tra với hai tài khoản: A nhập video tổng hợp, chỉ có audio xuất hiện trong Storage; A mở lại và tải trên thiết bị thứ hai; B không đọc được dữ liệu của A; A cắt/ghép và mở lại kết quả. Không cần Admin key trong ứng dụng.

Metadata ở `audioLibraries/{uid}/tracks/{id}`. Binary ở `audio/{uid}/{id}/{id}.{extension}`. Rules đối chiếu UID, giới hạn kích thước và kiểm tra tên/MIME. Rules không phân tích codec/binary; app kiểm tra nội dung bằng engine native trước khi lưu. Không ghi URL có download token vào metadata hoặc chia sẻ file công khai; tải qua Firebase SDK có xác thực. [Firebase Storage Security Rules](https://firebase.google.com/docs/storage/security).

Upload binary hoàn tất trước khi ghi metadata. Nếu metadata lỗi, bản local vẫn chưa đồng bộ và nút thử lại sẽ ghi cùng ID/path. Có thể có object chưa được lập danh sách nếu app bị gỡ ngay giữa hai bước; chưa có tác vụ server dọn object mồ côi. Danh sách hiện tải toàn bộ metadata của tài khoản trong một truy vấn; thư viện rất lớn cần bổ sung phân trang. Không có chức năng xóa nhạc ở phiên bản này.

## Kiểm thử

```sh
nvm use
npm run typecheck
npm run lint
npm test -- --watchman=false
npm run bundle
```

Các fixture trong `tests/fixtures/audio/` là dữ liệu tổng hợp: WAV 440 Hz, MP3 880 Hz khác sample rate/số kênh, video có tiếng và video im lặng. Không dùng file riêng của người dùng. Android instrumentation kiểm tra extraction, trim, nối khác codec/rate, reject khoảng cắt sai và video không có tiếng:

```sh
cd android
./gradlew :lifemate-audio:connectedDebugAndroidTest -PreactNativeArchitectures=arm64-v8a
```

AVFoundation smoke dùng trực tiếp source engine iOS, chạy trên macOS; kiểm tra duration, không có video, và giải mã PCM để xác nhận thứ tự tần số khi ghép:

```sh
mkdir -p .build
xcrun swiftc -parse-as-library modules/lifemate-audio/ios/AudioEngine.swift scripts/AudioEngineSmoke.swift -o .build/audio-engine-smoke
.build/audio-engine-smoke tests/fixtures/audio
```

Firebase rules tests chạy local, không cần đăng nhập và không đụng project thật. Dùng Node 24 và JDK 21 cho Firebase Emulator (Android build vẫn dùng JDK 17). Tool test cài riêng trong `.build/tools`, không vào bundle app:

```sh
npm install --prefix .build/tools firebase-tools@15.32.1 firebase@12.19.0 @firebase/rules-unit-testing@5.0.2
.build/tools/node_modules/.bin/firebase emulators:exec --project demo-lifemate-audio --config firebase/audio.firebase.json --only firestore,storage 'node scripts/test-audio-rules.cjs'
```

Trên máy hiện tại có JDK 21 tại `.build/tools/jdk21/Contents/Home`; đặt `JAVA_HOME` và thêm `bin` vào `PATH` khi chạy emulator. Tests chứng minh owner access/deny account khác/deny guest, reject metadata sai và MIME/extension video. Kết quả chi tiết trong [verification.md](verification.md); không thay thế kiểm thử trên Firebase thật và thiết bị iOS thật.
