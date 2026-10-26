# Pet lai chibi 2D

Mỗi tài khoản có tối đa một pet. Người dùng chọn 1–3 loài trong 12 loài: mèo,
chó, thỏ, cáo, gấu, cú, gấu trúc, hamster, chim cánh cụt, hươu, hổ và heo.
Bản nháp có thể random lại với cùng tập loài; pet đã lưu chỉ đổi tên hoặc xóa.
Pet đồng bộ Firebase, vẫn xem được offline và xóa có xác nhận.

## Trải nghiệm và trình bày

Home mở Thú cưng của tôi. Bộ chọn loài có tìm kiếm tên không dấu. Màn tạo mới
hiện preview chibi 2D nét mềm, màu ấm, đầu to, thân tròn, mắt có điểm sáng,
chân nhỏ, má ửng và nền/đổ bóng nhẹ. Các bộ phận đầu, tai, mõm/mỏ, thân, chân,
đuôi và cánh được ghép từ chính các loài trong DNA đã chọn. Pattern, bảng màu,
kích thước, mắt và biến thể lấy từ seed/DNA, không random lại khi render.

`react-native-svg` dựng hình bằng vector path/shape; Reanimated + Worklets chạy
một số transform nhóm trên UI thread: idle `breathe` thở, `curious` nghiêng
ngó, `sway` lắc nhẹ; lựa chọn và nhịp lấy từ animation DNA. `greet` bay ngắn,
`bounce` cưỡi mây, `happy` nhảy/xoay; interaction variant điều chỉnh thời lượng.
Skill giữ allowlist cũ; lửa phun gần miệng, gió thành luồng xoáy, các skill khác
dùng motif vector gọn. Không tạo React state mỗi frame. Reduced Motion tắt idle
và hiệu ứng; pet không active thì dừng animation. Vuốt ngang đổi giữa góc nhìn
trước, nghiêng và sau; vuốt dọc vẫn để ScrollView xử lý.

Không có dịch vụ tạo ảnh, tải model, GLB, WebView hay rendering 3D lúc chạy.
Vector được đóng gói trong ứng dụng; không lấy nội dung art từ bên thứ ba.

## Genetics và dữ liệu

Nguồn kiểu dữ liệu: `src/types/pet.ts`; danh mục: `petCatalog.ts`; random có seed
và validation: `petGenetics.ts`; playback mapping: `petPlayback.ts`;
presentation-only mapping: `petPresentation.ts`.

- Giữ schema DNA v1, wire v1, 6 loài V1 và 12 loài V2, thứ tự allowlist,
  deterministic hash, giới hạn nguồn part, shape/material, animation và skill IDs.
- Giá trị `hybrid-3d-v1/v2` là generator identifier lịch sử trong DNA đã lưu;
  giữ tương thích để không cần migration dù renderer hiện tại là 2D.
- Pet mới dùng cùng deterministic seed/genetics hiện tại. Một đến ba loài góp
  đặc điểm; loài V1 không bị đổi kết quả do mở rộng catalog.
- Skill/animation chỉ là presentation, không cấp quyền hay giá trị giao dịch.
  Chuyển renderer không sửa pet đã lưu hoặc thêm backend field/rule.

## Lưu trữ, sync và quyền

Namespace đơn: `petAccounts/{uid}/state/current`. Slot revision tăng nguyên tử;
server transaction quyết định create/rename/delete. Hai thiết bị create cùng lúc
chỉ một thành công. Operation ID/payload/revision retry là idempotent; stale
revision được reconcile, không tự ghi đè pet mới. Không có petA→petB trực tiếp.

Offline giữ snapshot mã hóa theo UID và outbox intent. Chỉ xác nhận server khi
online; xóa offline được gửi khi có mạng. Sau delete chỉ còn fence để ngăn replay,
không giữ bản pet có thể khôi phục. Mọi tác vụ kiểm tra UID/session epoch trước
và sau await. Rules giới hạn owner, singleton, schema/range/version và mutation;
không public read, URL art tùy ý hay client-controlled animation code.

## Kiểm chứng

Genetics tests bảo vệ fixed seeds, nguồn part, combinations V1/V2, validation,
roundtrip, deterministic hash và diversity. Service/storage/cloud tests bảo vệ
singleton, offline cache, retry/stale revision, rename/delete và context. Rules
emulator kiểm tra owner isolation, revoke, concurrent create, immutability và
revision. Renderer tests kiểm tra hướng nhìn khi vuốt, quay về trước khi phun lửa
và cleanup khi unmount. Presentation tests kiểm tra idle/interactions/skill
mapping, Reduced Motion, inactive screen và không phát lại action đã tiêu thụ.

Gates: typecheck, lint các file đổi, Jest pet, Firestore rules, Expo iOS/Android
export và native build/smoke trên simulator/device sẵn có. Đo bundle/asset trước
sau; simulator FPS không thay thế thiết bị thật. Không tuyên bố pet duy nhất toàn
cầu hoặc pixel-identical giữa hệ điều hành.
