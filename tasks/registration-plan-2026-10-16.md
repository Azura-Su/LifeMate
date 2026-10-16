# Kế hoạch màn đăng ký LifeMate — 16/10/2026

## Mục tiêu và phạm vi

Thêm đăng ký bằng email/mật khẩu vào cây màn hình chưa đăng nhập. Giữ cách đăng nhập hiện có và quyền sở hữu dữ liệu theo Firebase UID. Người dùng đã chốt **mọi email đều có thể tự đăng ký khi tính năng đang hiện**; không cần mã mời hoặc danh sách email được cấp trước. Có thể ẩn/hiện lối vào đăng ký từ Firebase Remote Config mà không phát hành bản app mới.

Màn đăng ký có tên hiển thị, email, mật khẩu, xác nhận mật khẩu; liên kết quay lại đăng nhập. Sau khi tạo tài khoản, người dùng được dùng các tính năng riêng. Xác nhận email cần cho Ký ức chia sẻ như hiện tại, không chặn dữ liệu riêng. Đổi mật khẩu, đăng nhập Google/Apple và xóa tài khoản là phạm vi riêng.

## Quyết định lưu trữ

| Dữ liệu                                                           | Nơi lưu                                    | Lý do                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email, mật khẩu, trạng thái xác nhận email, UID                   | Firebase Authentication                    | Đây là hệ thống đăng nhập đang dùng; SDK quản lý mật khẩu và phiên. Ứng dụng không ghi mật khẩu/token vào Zustand, AsyncStorage, SecureStore, Firestore hoặc Supabase. |
| Tên hiển thị                                                      | `displayName` của Firebase Authentication  | Profile cơ bản đã có trong `SessionUser` và `useProfile`; chưa cần collection hồ sơ mới. Giới hạn tên tối đa 60 ký tự để tương thích tên Ký ức chia sẻ.                |
| Thu chi, ghi chú, việc cần làm, âm thanh và các dữ liệu tính năng | Các kho hiện có, khóa theo Firebase UID    | Tài khoản mới dùng cùng quy tắc sở hữu; không sao chép hoặc tạo dữ liệu mẫu của tài khoản khác.                                                                        |
| Danh sách tên trong Remote Config                                 | Giữ nguyên cho tài khoản được cấu hình sẵn | Không dùng Remote Config làm nơi ghi tài khoản mới hay danh sách cấp quyền. Tên từ Remote Config hiện được ưu tiên trước `displayName`; giữ hành vi này trong đợt đầu. |
| Cờ `registration_enabled`                                         | Firebase Remote Config, kiểu Boolean       | Chỉ điều khiển giao diện và thao tác đăng ký trong app; mặc định trong app là `false` khi chưa có giá trị đã kích hoạt.                                                |

Firebase Authentication chỉ có các thuộc tính hồ sơ cơ bản; khi ứng dụng thực sự cần nhiều trường hồ sơ riêng, cân nhắc tài liệu `profiles/{uid}` trong Firestore với rules chủ UID và kế hoạch đồng bộ/xóa dữ liệu. Không tạo collection đó trong đợt đăng ký này. Bảng người dùng của Ký ức chia sẻ trong Supabase phục vụ tính năng bạn bè và không thay thế Firebase Authentication.

## Công tắc Remote Config

- Tạo parameter Boolean **`registration_enabled`** trong Firebase Console. `true`: hiện nút **Tạo tài khoản** và cho mở/gửi form. `false`: ẩn nút, không cho mở form hoặc bắt đầu yêu cầu đăng ký mới; Đăng nhập của tài khoản đã có luôn hoạt động.
- Mở rộng dịch vụ và store Remote Config hiện có để cùng đọc `users` và cờ này. Lần cài mới chưa tải cấu hình dùng in-app default `false`; khi mất mạng, giữ giá trị đã kích hoạt trong cache của SDK (có thể vẫn là `true`). Cập nhật khi app khởi động/vào foreground. `useAppBootstrap` giữ listener thời gian thực chỉ khi chưa đăng nhập; callback có `next` và `error`, kích hoạt bản mới rồi đọc lại **cả** cờ và `users`, hủy listener khi đăng nhập hoặc unmount. Chặn callback/`activate` hoàn tất muộn sau khi hủy, xử lý lỗi không chặn Đăng nhập và phối hợp với `refresh()` đang chạy để không ghi đè snapshot mới bằng snapshot cũ. Điều này giảm phụ thuộc vào khoảng cache production hiện là một giờ.
- Nếu cờ chuyển `false` khi form đang mở và chưa gửi, quay về Đăng nhập và xóa mật khẩu đang nhập. Kiểm tra cờ ngay trước khi bắt đầu tạo tài khoản. Nếu lời gọi tạo tài khoản đã bắt đầu thì tiếp tục xử lý kết quả và các bước hoàn tất; cờ không thể hoàn tác tài khoản đã tạo.
- Đây là **công tắc giao diện**, không phải cơ chế phân quyền hay chặn tạo tài khoản ở máy chủ. Client có thể đọc cấu hình và giá trị có thể cũ khi offline; SDK Firebase Auth vẫn có thể được gọi ngoài UI. Nếu cần khóa đăng ký thực sự cho mọi client, phải thiết kế kiểm soát phía máy chủ riêng trước khi tuyên bố tính năng đã bị vô hiệu hóa hoàn toàn.

## Luồng dự kiến

1. Khi `registration_enabled` đã kích hoạt thành `true`, từ Đăng nhập mở Đăng ký trong cây chưa đăng nhập. Kiểm tra email bằng tiện ích hiện có; chuẩn hóa email trước khi gửi Firebase. Cắt khoảng trắng hai đầu của tên, từ chối tên rỗng/ký tự điều khiển hoặc quá 60 ký tự. Mật khẩu giữ nguyên từng ký tự; kiểm tra độ dài theo chính sách Firebase đã cấu hình và khớp xác nhận. Chặn gửi lặp; lỗi hiển thị bằng tiếng Việt mà không lộ phản hồi nội bộ.
2. Trước khi gọi `createUserWithEmailAndPassword`, đánh dấu phiên đang đăng ký. Firebase tự đăng nhập ngay khi tạo tài khoản, nên `AppNavigator` phải giữ màn đăng ký/hoàn tất trong khi lưu tên và thử gửi thư xác nhận. Không dựa vào việc màn hình còn mounted sau sự kiện Auth.
3. Tạo tài khoản là điểm đã cam kết. Nếu tạo thất bại, giữ form để sửa/thử lại. Nếu tạo thành công nhưng lưu tên hoặc gửi thư thất bại, báo rõ **tài khoản đã được tạo**, cho thử lại riêng bước lỗi hoặc tiếp tục dùng app; không gọi tạo tài khoản lần hai và không xóa tài khoản. Vẫn thử gửi thư nếu lưu tên thất bại.
4. Sau khi cập nhật tên, đọc lại người dùng hiện tại từ Firebase và đồng bộ `SessionUser` trong Zustand với kiểm tra UID; không chờ `onAuthStateChanged` tự phát lại sau `updateProfile`. Khi kết thúc hoặc hủy bước hoàn tất, nhả trạng thái đăng ký. Nếu logout/đổi UID giữa chừng, không công bố kết quả cũ hay giữ người dùng trong màn đăng ký.
5. Màn hoàn tất giải thích email xác nhận dùng cho Ký ức chia sẻ; có Gửi lại, Tôi đã xác nhận và Tiếp tục. Tách thao tác gửi/kiểm tra email đang nằm trong `memorySharing.ts` thành dịch vụ Auth dùng chung: kiểm tra UID, `reload` user và làm mới ID token trước khi đọc `emailVerified`. Thư được Firebase tiếp nhận không đồng nghĩa đã đến hộp thư.

## Công việc theo thứ tự

1. **Cấu hình và đặc tả.** Chính sách mọi email đăng ký khi giao diện được bật đã được chốt. Kiểm tra Email/Password, chính sách mật khẩu và thêm parameter `registration_enabled` trong Firebase Console. Cập nhật đặc tả Auth mà không thay `tasks/plan.md` và `tasks/todo.md` đang có việc mở.
2. **Cờ giao diện.** Mở rộng `src/config/defaults.ts`, `src/services/firebase/remoteConfigService.ts`, `src/store/configStore.ts` và các test liên quan. Đặt listener ở `useAppBootstrap` khi chưa đăng nhập; sau `activate`, cập nhật cờ và danh sách tên cùng một snapshot, xử lý lỗi/hoàn tất muộn và `refresh()` đồng thời; không tạo thêm đường fetch song song. Kiểm thử default/cache, chuyển `true` ↔ `false`, fetch/listener/activate lỗi và login vẫn dùng được.
3. **Ranh giới đăng ký.** Thêm `register` vào `src/services/firebase/authService.ts`, validation và ánh xạ lỗi đăng ký trong `src/utils/auth.ts`, kèm unit tests. Kết quả tách `accountCreated`, `profileSaved`, `verificationSent` hoặc cảnh báo tương ứng để xử lý lỗi từng bước; không giữ mật khẩu ngoài state tạm của form.
4. **Điều phối phiên khi tạo tài khoản.** Thêm trạng thái đăng ký trong `src/store/authStore.ts` và điều chỉnh `src/navigation/AppNavigator.tsx`/`src/hooks/useAppBootstrap.ts` ở mức cần thiết để giữ màn hoàn tất, bảo toàn logout/account switch, đồng bộ lại tên. Kiểm thử thứ tự observer đến trước promise tạo tài khoản và trường hợp UID thay đổi giữa chừng.
5. **Màn đăng ký.** Tạo `src/screens/Register/` theo `LoginScreen` và theme hiện tại; thêm lối vào/ra trên màn đăng nhập chỉ khi cờ bật. Bảo đảm bàn phím, nhãn hỗ trợ truy cập, trạng thái tải, hiện/ẩn mật khẩu, xác nhận mật khẩu, lỗi và nút thử lại. Kiểm thử cờ tắt khi form mở, trước khi gửi và khi đang gửi.
6. **Xác nhận email và hoàn tất.** Dùng chung dịch vụ gửi/kiểm tra xác nhận với Ký ức; màn hoàn tất cho thử lại từng bước hoặc tiếp tục. Kiểm thử lỗi mạng sau khi tài khoản đã tạo, tên cập nhật hiện trên Home không cần mở lại app, xác nhận email đổi trạng thái, và tài khoản cũ vẫn đăng nhập như trước.
7. **Tài liệu và kiểm chứng.** Cập nhật README về công tắc Remote Config, độ trễ/cache, tự đăng ký, nơi lưu dữ liệu và bước xác nhận email. Chạy Jest theo các test Auth/navigation/Remote Config/memory liên quan, `npm run typecheck`, `npm run lint`; thử iOS/Android với tài khoản test mới và một tài khoản cũ. Chỉ chạy rules/functions tests nếu thay các đường dẫn đó.

Chi tiết tiêu chí chấp nhận và lệnh kiểm chứng nằm trong `tasks/registration-todo-2026-10-16.md`.

## Rủi ro và điều kiện trước khi mở công khai

- Đăng ký mở cho mọi email tạo UID mới có quyền dùng các kho dữ liệu theo UID. Các rules hiện tại cách ly UID, nhưng cần xem giới hạn chi phí/abuse của âm thanh, Ký ức và Firestore trước khi phát hành rộng. Không coi UI hay Remote Config là cổng kiểm soát truy cập.
- Giá trị Remote Config có cache và cần mạng để nhận thay đổi mới. Listener thời gian thực giảm độ trễ khi app đang mở, nhưng không bảo đảm tắt tức thì trên thiết bị offline; không dùng cờ này làm cam kết khóa đăng ký ở máy chủ.
- Xử lý vòng đời tạo tài khoản như luồng có thể hoàn tất dở dang: lỗi sau `createUserWithEmailAndPassword` không được biến thành lần tạo mới hoặc mất khả năng đăng nhập.
- Khi triển khai tự đăng ký cho người dùng thật, cần quyết định đường xóa tài khoản và dữ liệu theo UID ở Firebase, Supabase/R2 và cache thiết bị. Đây là hạng mục phát hành riêng vì hiện ứng dụng chưa có luồng xóa tài khoản.
- Chưa cần schema Firestore mới, migration hay thay đổi rules cho dữ liệu hiện có. Nếu quyết định thêm hồ sơ Firestore hoặc cơ chế mời, phải rà rules và tests trước khi triển khai.

## Nguồn và mã hiện có

- `src/services/firebase/authService.ts`, `src/hooks/useAppBootstrap.ts`, `src/navigation/AppNavigator.tsx`, `src/utils/users.ts`, `src/services/memories/memorySharing.ts`, `firebase/firestore.rules`.
- [React Native Firebase Authentication](https://rnfirebase.io/auth/usage): tạo email/mật khẩu sẽ tạo tài khoản và đăng nhập; observer nhận thay đổi Auth.
- [Firebase Authentication user properties](https://firebase.google.com/docs/auth/users/): hồ sơ Auth có UID, email, tên; trường bổ sung cần kho dữ liệu khác.
- [React Native Firebase `updateProfile`](https://reference.rnfirebase.io/_react-native-firebase/auth/updateProfile-1.html): cập nhật `displayName` của user.
- [React Native Firebase Remote Config](https://rnfirebase.io/remote-config/usage): in-app defaults, `fetchAndActivate`, cache và listener thời gian thực.
- [Firebase Remote Config parameters](https://firebase.google.com/docs/remote-config/parameters): client config được lưu cache và người dùng app có thể đọc; không phù hợp làm ranh giới phân quyền.
