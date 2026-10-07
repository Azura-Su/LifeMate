# LifeMate — thư viện và chỉnh sửa âm thanh

## Mục tiêu và hành vi

Tab MP3 có nút nhập từ trình chọn file hệ thống (audio hoặc video). Audio hợp lệ được sao chép nguyên bản; video được tách track tiếng ngay trên điện thoại, chỉ giữ audio M4A/AAC. Không gửi video lên cloud. File video gốc trong máy người dùng không bị xóa; bản tạm của app được dọn sau xử lý.

Mỗi UID có thư viện riêng, lưu bản audio trong Documents/app files và metadata local. App tự upload audio lên Storage, metadata lên Firestore. Upload lỗi không làm mất audio: hiện “Chỉ trên máy” và nút thử đồng bộ. Mở lại app vẫn thấy file; thiết bị khác lấy danh sách từ Firestore và tải audio qua SDK có xác thực khi nghe/chỉnh sửa. Không lưu download URL công khai.

Nghe/dừng/tua; cắt một khoảng start–end thành file mới; ghép 2–10 file/đoạn theo thứ tự người dùng chọn, cho đổi thứ tự. Các bản gốc giữ nguyên. Mỗi đoạn có thể chọn điểm đầu/cuối trước khi nối. Kết quả cắt/ghép được lưu lại như một audio mới.

Input tối đa 500 MiB, audio lưu tối đa 200 MiB, thời lượng mỗi file/tổng bản ghép tối đa 60 phút. Tối thiểu đoạn 0.1 giây. Codec theo AVFoundation/Media3; báo lỗi rõ nếu không có tiếng, DRM hoặc codec không hỗ trợ. Xuất M4A, không hứa mọi định dạng video đều hỗ trợ.

## Kiến trúc

- Native Expo local module `modules/lifemate-audio`: AVFoundation iOS, Media3 Transformer Android; `inspect(uri)`, `exportAudio(segments)`, `cancel()`.
- `src/services/audio`: file persistence và orchestration; `src/services/firebase/audioLibraryService.ts`: Cloud Storage/Firestore.
- `src/store/audioStore.ts`: UID và danh sách; hook quản lý loading/error. Không persist lẫn UID. `src/screens/Mp3/` UI, hook, editor và player riêng.
- `audioLibraries/{uid}/tracks/{id}` và `audio/{uid}/{id}/{fileName}`; rules chỉ owner đọc/ghi. Lưu title, durationMs, sizeBytes, mimeType, fileName, source, createdAt; không chứa credentials/local URI.
- expo-document-picker, expo-file-system, expo-audio, AsyncStorage; RN Firebase 26.4.0.
- Xử lý/upload một job mỗi lần, có trạng thái và hủy; UID/session guard ngăn kết quả async xuất hiện ở tài khoản khác. Đăng xuất dừng player và hủy job.

## Quy ước và kiểm chứng

Tiếp tục TypeScript strict, service hàm + hook riêng, Zustand chỉ data; ví dụ `validateSegments(segments)` chạy trước export. Không sửa generated native project để mang feature: module được autolink sau prebuild.

`npm run typecheck`, `npm run lint`, `npm test -- --watchman=false`, `npm run bundle`; native Android/iOS build. Tests cho bounds/format/remote data, audio/video import, upload failure/retry, ordered trim/merge, session reset; native smoke bằng fixture video có tiếng/audio khác định dạng. Security rules kiểm chứng bằng Firebase Emulator nếu khả dụng. Tài liệu phân biệt checks local và cloud thật.

## Ranh giới

Được cài dependencies và tạo schema/rules cho chức năng được yêu cầu. Không tự thay đổi gói thanh toán Firebase; không ghi đè rules hiện có mà chưa đọc. Không upload file riêng của người dùng để kiểm thử; dùng fixture tổng hợp. Không có tải từ URL/YouTube, mix đồng thời, hiệu ứng hay background export ở phiên bản này. Giữ app mở khi xử lý.

## Nguồn

- https://docs.expo.dev/modules/get-started/
- https://docs.expo.dev/versions/v55.0.0/sdk/document-picker/
- https://docs.expo.dev/versions/v55.0.0/sdk/audio/
- https://developer.android.com/media/media3/transformer/transformations
- https://developer.android.com/media/media3/transformer/composition
- https://developer.apple.com/documentation/avfoundation/avassetexportsession
- https://rnfirebase.io/storage/usage
- https://rnfirebase.io/firestore/usage
