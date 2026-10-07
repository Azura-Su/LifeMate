# Thư viện âm thanh LifeMate

Mỗi tài khoản Firebase có thư viện riêng. App lưu audio trên máy trước, sau đó sao lưu file vào Supabase Free (khi đã kết nối) và metadata lên Firestore Native. Firebase giữ gói Spark, không cần Blaze. Không dùng Remote Config để chứa nhạc.

## Cách sử dụng

1. Đăng nhập, mở tab **MP3**, bấm **Chọn file audio hoặc video**, chọn file bằng trình chọn file hệ thống, nhập tên và bấm **Lưu âm thanh**. Tên có 1–120 ký tự, không cần nhập đuôi file. Bấm **Hủy** sẽ bỏ bản sao tạm vừa chọn. Audio được giữ nguyên định dạng; video được tách track tiếng đầu tiên thành M4A/AAC ngay trên thiết bị. Chỉ audio được lưu vào thư viện và sao lưu lên đám mây. Video gốc trong máy của bạn vẫn nguyên vẹn.
2. Bấm **Nghe** để phát/dừng/tua. Nếu file mới chỉ có trên đám mây, app tải bản riêng về máy trước khi mở.
3. Bấm **Cắt** trên một file, đặt tên bản mới và nhập điểm bắt đầu/kết thúc. Nhập số giây (ví dụ `12.5`) hoặc `phút:giây` (`1:02.5`). Dùng **Nghe thử đoạn** để nghe thử, rồi lưu.
4. Đánh dấu các file theo thứ tự muốn nối, bấm **Ghép**. Trong màn chỉnh sửa, dùng mũi tên lên/xuống để đổi thứ tự; mỗi đoạn có khoảng cắt riêng. Đặt tên và lưu kết quả M4A mới. Các file gốc giữ nguyên.
5. Bấm **Đổi tên** trên một bản nghe rồi **Lưu tên**. Tên được lưu trên máy trước; nếu bản audio đã sao lưu, app chỉ cập nhật tên trên Firestore, không upload lại audio. Tên mới chưa đồng bộ vẫn được giữ khi mở lại app hoặc làm mới danh sách. Bấm **Đồng bộ tên** để thử lại nếu cần.
6. Nếu mất mạng hoặc kho miễn phí chưa kết nối, bản đã nhập/xuất vẫn nằm trên máy, hiện **Chỉ trên máy**. **Sao lưu miễn phí** gửi audio vào kho private Supabase và metadata lên Firestore để tải lại bằng cùng tài khoản. Nút bị vô hiệu khi chưa cấu hình hoặc file trên 50 MB; lý do hiện ngay dưới nút. Làm mới chỉ tải danh sách cloud, không tự upload các bản trên máy.

Giữ app mở khi nhập/xuất/upload; có tiến trình và nút hủy. Hủy đồng bộ sau khi đã lưu không xóa bản local. Chuyển tab dừng phát; đăng xuất hủy tác vụ và bỏ dữ liệu khỏi giao diện. Dữ liệu local vẫn được giữ theo UID để dùng khi đăng nhập lại. Gỡ app sẽ mất các bản chưa đồng bộ.

Giới hạn: input tối đa 500 MiB, audio lưu tối đa 200 MiB, mỗi file/bản ghép tối đa 60 phút, 2–10 đoạn cho một bản ghép, đoạn tối thiểu 0,1 giây. Codec phụ thuộc thiết bị; file có DRM/không có tiếng/codec không hỗ trợ sẽ báo lỗi. Không cần quyền micro. Nguồn là file chọn từ thiết bị/Files; chưa có nhập URL, mix nhiều lớp, hiệu ứng hoặc xử lý/phát nền.

## Cloud miễn phí và trạng thái triển khai

Ngày 07/10/2026: database `(default)` của `baseapp-dd227` đã chuyển từ Datastore sang **Firestore Native**, xác minh Console báo database sẵn sàng và còn trống. Project vẫn **Spark ($0)**. Storage cũ yêu cầu nâng Blaze nên app không upload file mới vào đó.

Code dùng Supabase Free: bucket `lifemate-audio` private, 1 GB tổng dung lượng project, tối đa 50 MB/file; tài khoản Firebase vẫn là danh tính duy nhất trong app. File audio lớn hơn giới hạn sao lưu vẫn dùng trên máy (tối đa 200 MiB). Không có bucket public hoặc service-role key trong app.

**Chưa hoạt động trên cloud thật:** Supabase đang chờ chủ tài khoản đăng nhập/tạo tài khoản; chưa tạo project/bucket hoặc deploy function. Firestore rules private theo UID đã xuất bản thành công lúc 22:48 theo xác nhận của chủ tài khoản. Vì `.env` chưa có URL kho, app hiện đúng trạng thái chỉ lưu trên máy. [Kiến trúc và các bước triển khai](free-audio-storage.md).

Metadata: `audioLibraries/{uid}/tracks/{id}`, có `storageProvider: "supabase"` cho file mới. Binary: bucket private `lifemate-audio`, path `audio/{uid}/{id}/{id}.{extension}`. Edge Function xác minh chữ ký Firebase ID token và tự dựng UID/path, rồi cấp signed URL. URL/token không được lưu vào index/Firestore hoặc log. Metadata cũ không có provider được tải bằng Firebase SDK khi storage cũ còn truy cập được; không tự di chuyển/xóa dữ liệu cũ.

Chỉ triển khai `firebase/firestore.rules`, không deploy Storage rules vào bucket trả phí. Rules kiểm tra UID, metadata và giới hạn dung lượng; bucket chặn MIME không phải audio. Engine native kiểm tra nội dung trước khi lưu. Không có cơ chế server phân tích codec của binary.

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
