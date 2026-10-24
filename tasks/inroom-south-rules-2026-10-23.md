# Sửa luật Tiến lên trong phòng

## Phạm vi và UI

- Chỉ chủ phòng đang điều khiển được sửa chế độ kết thúc, tiền mỗi lá còn và
  tiền chặt 2. Menu phòng có nút “Sửa luật ván tới”; dialog cuộn được khi xoay
  ngang và mở bàn phím. Thành viên xem được luật hiện tại và luật ván tới.
- Lưu cấu hình riêng `nextSouthRules`; không đổi bài, lượt, deadline, điểm,
  match hay cấu hình đang dùng. Chỉ khi chia ván mới mới áp dụng cấu hình đó.
- Khi lưu ở sảnh/kết quả, xóa cờ sẵn sàng; mọi người cần sẵn sàng lại.

## Các bước thực hiện

1. Regression server: pending rules, promotion ở start/rematch/tới trắng,
   tiền ván đang chơi bất biến, amount-only và quay lại mặc định.
2. RPC service-only, owner/controller/session/CAS/receipt; trigger bảo vệ
   pending field và mọi promotion match, giữ amount/config trong cùng match.
3. Protocol5 và UI. Client cũ đang ngồi vẫn sync/lease/play/pass/leave theo
   luật cũ; phải cập nhật trước join/takeover/ready/start ở phòng đã sửa luật.
   Không trả field mới cho parser cũ. Lệnh ready không rebase qua lần sửa luật.
4. Typecheck, lint, regression functions/Jest và UI; review độc lập diff cuối.
5. Edge trước SQL, chờ isolate cũ hết hạn trước mở RPC. Migration có guard,
   kiểm tra RPC thật bằng fixture rollback, đọc lại source/schema/ACL.

## Review plan

Reviewer read-only đã chỉ ra hai điểm đã đưa vào thiết kế: ready cũ không được
rebase qua lần lưu luật; trigger phải kiểm tra mọi match mới (kể cả amount-only,
trở về mặc định và tới trắng), đồng thời cấm thay amount/config giữa ván.
Snapshot trước thay đổi: `/private/tmp/lifemate-inroom-rules-before-20261023`.

## Kết quả

- Đã thêm dialog chủ phòng và phần xem luật hiện tại/ván tới cho thành viên.
  Draft cũ bị khóa và có tải lại; không gửi qua đổi tài khoản/phòng/match/quyền.
- 1.047 Jest tests/133 suites và245 backend tests đạt; typecheck, lint file
  thay đổi, export iOS/Android đạt. Watchman không được ghi state trong sandbox,
  dùng Jest --watchman=false, không bỏ test hoặc hạ assertion.
- Reviewer backend/client chỉ đọc đã review plan và diff; đã sửa finding
  delete-room thiếu capability fence, có regression client4 bị chặn/client5 đạt.
- Edge v12 ACTIVE,18 file đọc lại khớp. Triển khai12:13:00UTC, chỉ bật migration
  sau12:20:01UTC (>410s); migration thật20261023122005, file local khớp tên.
- Rehearsal theo38 RPC production đạt.6 ván2/3/4 người ×2 chế độ,185 bước,
  thử RPC thật PostgreSQL trong transaction rollback: owner/session/CAS, retry,
  pending không đổi game/rate, chặt2/quyết toán đúng, match/score delta chính xác,
  rematch về mặc định. Không còn ghế/phòng/receipt/score/account thử.
- RPC mới không cấp execute cho anon/authenticated; mode open, cron active.
  Nhóm advisory bảo mật giữ nguyên INFO RLS service-only/WARN hàm subscribe
  security definer có sẵn. Request không token vẫn401 invalid-session.
- Simulator local harness: mở form, cuộn đến input, sửa5→9 và lưu trả về đúng
  giá trị. Dialog hiển thị dọc/ngang. Chưa xác nhận đầy đủ bàn phím mềm ngang
  trong app thật: root orientation của harness khác màn navigation; không coi
  ảnh keyboard của harness là kiểm chứng đạt. Chưa thử nhiều thiết bị thật.
- Không phát hành OTA/bản cài. Backup, rollout, log và fixture ở
  `/private/tmp/lifemate-inroom-deploy-20261023`; giữ các thay đổi trước đó.

## Kiểm tra tiếp

Preview thêm navigation và hook orientation giống app đã xác nhận bàn/form
xoay ngang, cuộn và sửa/lưu local. Bàn phím mềm của Simulator vẫn trả hướng
không khớp cả khi bỏ native Modal; thử nghiệm shell thay thế đã được bỏ và
đối chiếu source trả đúng bản đã review/test/export. Không sửa hệ thống modal
hoặc orientation dựa trên giả định chưa chứng minh. Ca bàn phím ngang còn cần
kiểm tra trên app/thiết bị thật. Đã trả Simulator về máy chủ LifeMate8081 và
dừng server preview8082.
