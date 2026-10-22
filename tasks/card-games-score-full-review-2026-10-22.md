# Review logic trò chơi và tính điểm — 22/10/2026

Phạm vi là code hiện tại trong working tree, gồm file đã sửa và file mới chưa commit.
Đối chiếu `SPEC-card-games.md`, `SPEC-rules-tien-len-south.md` và `SPEC-card-score.md`.
Review theo Agent Skills `code-review-and-quality`, có hai reviewer độc lập cho
engine và bảng điểm; main agent kiểm tra phòng, quyền, giao tiếp và đối chiếu kết quả.
Không sửa source, migration, dữ liệu hay deploy trong lượt review này.

## Các lỗi cần xử lý

### 1. P2 — Back của Android bỏ qua xác nhận rời bàn

Vị trí: [CardGamesScreen.tsx:430](../src/screens/CardGames/CardGamesScreen.tsx#L430).

Xác nhận rời phòng/bỏ cuộc chỉ được gọi từ nút back trên header. Không có
`BackHandler`, `beforeRemove` hoặc bộ chặn tương đương ở màn game hay cấp app.
Nút/gesture Back hệ thống được React Navigation xử lý bằng `goBack()`.
Router hiện tại trả từ CardGames về Home mà không chạy `leave()`.

Cách tái hiện: vào một phòng trên Android → đang chờ hoặc đang chơi → bấm Back hệ thống.
Màn hình rời đi mà không hỏi xác nhận. Blur dừng session và heartbeat, không gửi lệnh
leave; timeout vẫn tiếp tục và ghế có thể hết lease sau 90 giây, dẫn đến bỏ cuộc/tính điểm
nếu người chơi không quay lại.

Bằng chứng: đối chiếu code navigator và `useBackButton.native.tsx` / `SwitchRouter.tsx`
đang cài; reviewer chạy probe router trong bộ nhớ với Home → CardScore → CardGames →
GO_BACK, kết quả là Home. Chưa thử gesture trên điện thoại thật.

Đề xuất: chỉ khi màn game đang focus, chặn Back Android và gọi cùng luồng xác nhận
đã dùng cho header. Giữ phân biệt rời phòng bình thường với quay lại khi chưa có dữ liệu mới.
Test thêm: Back khi chơi/chờ phải hỏi, hủy giữ nguyên bàn, xác nhận mới rời;
listener không hoạt động khi màn khác đang focus.

### 2. P2 — Trạng thái cho phép vào lại một phòng trống mà API từ chối

Vị trí: [room_reactivation.sql:272](../supabase/migrations/20261021130000_card_game_room_reactivation.sql#L272).
Nhánh từ chối nằm ở cùng migration dòng 180–182 và `rooms.mjs:52`.

Khi mọi người đã rời nhưng chưa đủ 30 phút, phòng lobby/finished vẫn tồn tại.
`lifemate_game_status` trả `canRejoin=true` cho thành viên cũ vì chỉ xét hạn và phase.
Trong khi đó, `lifemate_game_find` và engine chỉ cho chủ phòng vào một phòng trống.
Luồng vào lại tin kết quả status, điều hướng sang game, rồi nhận `room-not-found`.

Cách tái hiện: A tạo phòng, B vào, A và B lần lượt rời → B bấm vào lại trước 30 phút.

Probe đã chạy với PostgreSQL PGlite và toàn bộ migration hiện tại, dùng lệnh tạo/join/leave
thực qua RPC trong bộ nhớ, không truy cập production:

```json
{
  "members": 0,
  "expired": false,
  "canRejoin": true,
  "canReopen": false,
  "find": { "error": "room-not-found" }
}
```

Đề xuất: thống nhất điều kiện status với điều kiện vào phòng. Nếu giữ chính sách chủ phòng
phải vào trước khi phòng đang trống, status/luồng vào lại cần phản ánh đúng điều đó và thông báo
chờ chủ phòng, thay vì chuyển màn rồi báo mã phòng sai. Không thay quy tắc chỉ chủ phòng mở lại
sau 30 phút. Test thêm đúng vòng đời tạo → join → tất cả leave → thành viên bấm vào lại trước hạn.

### 3. P2 — Không sửa được người chơi duy nhất của bảng điểm online

Vị trí: [CardScoreScreen.tsx:551](../src/screens/CardScore/CardScoreScreen.tsx#L551).
Các chỗ cùng điều kiện: `removeManagedPlayer` dòng 522,
`CardScoreManagePlayersDialog.tsx:96`, `src/utils/cardScore.ts:16`.

Bảng điểm chung được tạo ngay khi chủ phòng đang chờ một mình. Đặc tả, parser và server
đều chấp nhận bảng chung có một người. Tuy nhiên form quản lý gọi validator mặc định
yêu cầu ít nhất hai người.

Cách tái hiện: tạo phòng → chưa có ai vào → mở bảng điểm chung → sửa tên chủ phòng → lưu.
Form luôn báo “Cần ít nhất 2 người chơi.” Nếu thêm người tạm để lưu, sau đó cũng không thể
xóa người đó để trở về một người vì cả handler và nút xóa đều khóa ở mốc hai.

Đề xuất: dùng tối thiểu một người cho quản lý bảng chung có `sharedVersion`, giữ tối thiểu
hai người cho bảng thủ công/legacy. Áp dụng cùng chính sách ở validator, handler và nút xóa.
Test thêm sửa tên bảng chung một người và xóa người thứ hai; bảng thủ công vẫn không được còn một người.

### 4. P2 — Form cho nhập tên dài hơn giới hạn server

Vị trí: [CardScoreManagePlayersDialog.tsx:89](../src/screens/CardScore/CardScoreManagePlayersDialog.tsx#L89)
và dòng 118. Server kiểm tra tại `supabase/functions/game-access/scores.mjs:41`.

Hai ô sửa/thêm tên nhận tối đa 32 ký tự; validator client không kiểm tra độ dài.
Server bảng điểm chung chỉ chấp nhận tối đa 30 ký tự.

Cách tái hiện: chủ phòng mở bảng điểm chung có ít nhất hai người → đổi hoặc thêm tên
31–32 ký tự → lưu. Client cho qua nhưng Edge luôn trả `invalid-input`, thao tác không lưu được.
Reviewer đã gọi validator server trực tiếp và xác nhận từ chối tên 31 ký tự.

Đề xuất: thống nhất giới hạn 30 ký tự và kiểm tra nội dung tên cho form bảng chung trước khi gửi.
Test thêm tên 30 ký tự lưu được, 31 ký tự bị chặn/giới hạn tại client; giữ dữ liệu thủ công cũ tương thích.

## Nhánh cũ cần lưu ý khi sửa sau review

Lệnh API `start` cũ cho host bắt đầu khi những người khác sẵn sàng, dù flag ready của host còn false
(`rooms.mjs:108–124`). UI mới dùng ready của tất cả thành viên và không gửi lệnh này;
test cũ đang chủ động giữ hành vi explicit-start. Không gộp mục này vào bốn lỗi trên:
host bấm start có thể được hiểu là đồng ý chơi trên client cũ. Nếu siết hợp đồng chỉ cho phép
all-ready theo flag, cần xử lý tương thích clientVersion thay vì bỏ nhánh này tùy tiện.

## Phạm vi đã rà soát

| Nhóm | Nội dung |
| --- | --- |
| Engine và luật | Xáo/chia 52 lá; bộ hợp lệ; so/chặt; lá mở; thứ tự lượt; bỏ lượt; vòng mới; tới trắng; về bài; bỏ cuộc; timeout |
| Kết quả | Xếp hạng; trường hợp hủy; điểm còn lá; cân bằng tổng điểm; thắng/thua; chống ghi kết quả lặp |
| Phòng | Tạo/vào/ready; phiên điều khiển/takeover; owner/host; chuyển chủ; TTL 30 phút; lease 90 giây; mở lại/xóa; worker |
| API và đồng bộ | Validate input/output; snapshot chỉ tay mình; version/match/CAS; receipt; mất ack; polling/Realtime; dừng/resume; UID/session fence |
| Tính điểm | Bàn thủ công/legacy/chung; tổng điểm; thêm/sửa/xóa ván và người; finish/reopen; quyền owner/member; audit; xóa vĩnh viễn/tombstone; cache |
| Ranh giới | Khóa/xóa tài khoản; RLS và RPC service-only; lịch sử migration hiện tại; callback cũ và quyền thay đổi giữa các thao tác |

Các helper đồng bộ legacy không còn caller production không được coi là lỗi của luồng đang chạy.
`host` đổi khi người chơi rời không đồng nghĩa chuyển `ownerUid`; các quyền mở lại/xóa/chuyển chủ
đã được đối chiếu theo owner thực tế.

## Kiểm chứng đã chạy

- Jest các vùng cardGames/cardScore, hooks, config và utils: **21 suite / 201 ca đạt**.
- `npm run test:functions`: **193 ca đạt**, gồm game engine, phòng, API, SQL/RLS và các backend khác.
- `npm run typecheck`: đạt. `git diff --check`: đạt.
- Reviewer engine chạy 300 ván có seed, 10.149 bước play/pass/timeout/forfeit trong bộ nhớ;
  tất cả kết thúc, bảo toàn 52 lá duy nhất; 280 ván hoàn tất cân bằng tổng điểm, 20 ván hủy.
- Probe SQL phòng trống trước hạn tái hiện được lỗi số 2.
- Review source không phát hiện thêm lỗi cụ thể ở luật đánh/chặt, cộng điểm lặp hay vượt quyền
  sửa bảng chung trong các đường đã kiểm tra. Điều này không thay thế kiểm thử thực tế.

Chưa kiểm tra lại bàn 2–4 điện thoại thật, Android gesture thực tế, Realtime/gateway đang deploy,
mạng chập chờn thực, tải/battery hoặc khóa transaction giữa nhiều kết nối PostgreSQL thật.
PGlite là bằng chứng hành vi SQL đơn tiến trình, không phải bằng chứng concurrency production.
