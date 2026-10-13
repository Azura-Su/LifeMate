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

### Báo cáo tiền hoàn trả khoản vay — 12/10/2026

Giao dịch nhận lại tiền vẫn được lưu là `type: income` với
`incomeSource: loan_repayment` để giữ liên kết khoản vay và tương thích Firestore
rules hiện có. Khi lập báo cáo, giao dịch này **không tăng Thu nhập** mà giảm
Chi tiêu ở danh mục **Cho vay** vào đúng tháng nhận tiền. Tổng Thu chi và hai tab
Thu nhập/Chi tiêu dùng cùng cách phân loại; `Còn lại = Thu nhập − Chi tiêu ròng`
không đổi. Một tháng chỉ có tiền nhận lại từ khoản cho vay kỳ trước có thể có
Chi tiêu ròng âm. Dữ liệu cũ được tính lại khi hiển thị, không cần chuyển đổi
giao dịch hoặc phát hành rules mới.

### Sửa lần nhận tiền ghi nhầm — 12/10/2026

Mỗi lần **Đã nhận** đã ghi Tài chính có nút xóa riêng trong lịch sử khoản vay.
Ứng dụng yêu cầu xác nhận trước khi xóa. Firestore transaction bỏ đúng lần nhận
khỏi khoản vay, xóa giao dịch `loan_repayment` liên kết và tạo tombstone tại
`financeAccounts/{uid}/deletedLoanRepayments/{transactionId}`. Tombstone chỉ
được tạo một lần và không cho phép xóa; rules chặn thiết bị cũ thêm lại mã lần
nhận đã xóa. Giao dịch liên kết không thể bị xóa độc lập trong tab Tài chính.

Sau khi xóa, số còn phải thu tăng lại; khoản đã tất toán có thể trở về **Chưa
hoàn thành**. Vì tiền hoàn trả được tính là phần giảm chi tiêu **Cho vay**, xóa
giao dịch liên kết cũng đưa phần chi tiêu đó trở lại. Dòng đang chờ ghi Tài
chính không có nút xóa. Ứng dụng tải lại Tài chính và đối soát nhắc hạn sau
commit; nếu mất kết nối ở thời điểm xác nhận, người dùng tải lại sổ để xem kết
quả trên cloud trước khi thử lại.

Rules cho thao tác này đã được biên dịch bằng Firebase CLI dry-run và phát hành
riêng lên `baseapp-dd227` lúc 18:35 ngày 12/10/2026. Nguồn đang chạy được đọc
lại từ Firebase Console; độ dài 40.018 ký tự và mã kiểm tra FNV-1a `9045289e`
khớp file trong workspace. Supabase không có thay đổi trong lần phát hành này.

### Cho mượn thêm — 12/10/2026

- Khoản đang còn nợ có nút **Cho vay thêm**. Mỗi lần thêm có ngày cho vay được
  chọn, preview dư nợ mới và xuất hiện trong lịch sử cùng các lần đã trả.
- `principalAmount` giữ tiền ban đầu. Các trường tùy chọn `advances` và
  `additionalAmount` lưu lịch sử (tối đa 50 lần) và tổng tiền cho thêm. Khi đọc,
  parser đối chiếu tổng, ID và giới hạn số nguyên an toàn; dữ liệu cũ không có
  các trường này vẫn được đọc bình thường.
- Mỗi lần thêm và giao dịch chi `loan-lent-{loanId}-{advanceId}` được ghi nguyên
  tử. Giao dịch có `expenseSource: loan_lending`, `loanId`, `advanceId`, giữ đúng
  ngày phát sinh; tiền cho thêm không làm thay đổi khoản chi ban đầu.
- Intent được lưu mã hóa trước khi gửi. Nếu timeout, thử lại dùng cùng ID;
  tải lại sổ đối chiếu lịch sử cloud để thu hồi intent đã được xác nhận. Lỗi
  cache sau commit không báo lần cho thêm thất bại.
- Dư nợ = tiền ban đầu + tiền thêm − các lần đã trả. Sửa khoản ban đầu chỉ
  sửa giao dịch ban đầu và vẫn kiểm tra tổng không thấp hơn số đã nhận.
  Xóa hồ sơ chưa nhận tiền xóa tất cả khoản chi liên kết; hồ sơ đã nhận tiền
  giữ dòng tiền và tombstone chứa cả lịch sử cho thêm.
- Rules kiểm tra append lịch sử, tăng tổng đúng số tiền, giao dịch chi đối ứng
  và bảo toàn lịch sử khi cập nhật từ client cũ. Quyền vẫn giới hạn đúng UID.
- Kiểm chứng lượt này: TypeScript, ESLint, whitespace; Firebase CLI dry-run
  biên dịch rules thành công. Không thêm/chạy Jest hoặc emulator; chưa thử
  luồng trên iPhone.
- Đã phát hành và đọc lại đúng nguồn trên `baseapp-dd227`: ruleset
  `c13c30ae-5170-40eb-90fe-600e001332c6`. Bản trước để khôi phục:
  `18a2ede6-1853-405b-8793-eff1bbf74051`.

### Một người có nhiều khoản khi tạo — 12/10/2026

- Form tạo gợi ý tên từ các khoản của tài khoản hiện tại. Tên được so khớp
  không phân biệt hoa/thường, khoảng trắng thừa; vẫn phân biệt dấu tiếng Việt.
  Gợi ý theo tên không thay đổi danh tính hoặc tự gộp hồ sơ.
- **Khoản riêng** là mặc định: tạo hồ sơ và giao dịch chi mới, có hạn trả,
  ghi chú và lịch nhắc riêng. Cùng một tên có thể có nhiều hồ sơ độc lập.
- **Cộng khoản cũ** yêu cầu chọn cụ thể một khoản đang còn nợ. Danh sách hiện
  số thứ tự, ngày cho mượn, tiền ban đầu, còn nợ, hạn trả và ghi chú. Không
  chọn khoản đã tất toán/hủy hoặc khoản có lần nhận tiền đang chờ đồng bộ.
- Khi cộng, form chỉ nhập số tiền, xem dư nợ sau khi cộng; giữ hạn trả,
  ghi chú và cài đặt nhắc của khoản đã chọn. Đổi tên xóa lựa chọn khoản cũ;
  khoản không còn hợp lệ không được tự chuyển thành thao tác tạo mới.
- Dùng lại `recordAdvance` và transaction hiện có; chặn bấm lưu lặp, giữ
  nội dung khi lưu lỗi để thử lại. Không đổi schema, Firebase hoặc Supabase.
- Kiểm chứng: TypeScript toàn project, ESLint các file UI thay đổi và
  `git diff --check` đạt. Chưa chạy test hoặc thử UI trên iPhone trong lượt này.

### Nội dung và ngày cho mượn thêm — 12/10/2026

- Mỗi lần **Cho mượn thêm** yêu cầu nội dung ngắn (tối đa 120 ký tự) để nhận
  diện khoản chi trong Tài chính; nội dung cũng xuất hiện dưới lần cho thêm ở
  lịch sử khoản vay.
- Người dùng chọn ngày trên cùng lịch dùng cho hạn trả. Ngày được lưu lúc
  12:00 giờ địa phương vào `advances[].lentAt` và `transactions[].createdAt`.
- Retry intent mã hóa giữ nguyên số tiền, nội dung và ngày qua lỗi mạng. Rule
  chấp nhận lịch sử cho thêm cũ không có `note`, nhưng yêu cầu `note` khớp với
  giao dịch Chi cho lần mới.
- Áp dụng trong popup trên thẻ khoản vay và form **Cộng khoản cũ**.
- Đã biên dịch và phát hành Firestore rules lên `baseapp-dd227`, sau đó đọc lại
  xác nhận đúng nội dung. Ruleset `fc3d58df-3c2f-4b75-a828-e9ba94ad6dfa`;
  bản trước để khôi phục `c13c30ae-5170-40eb-90fe-600e001332c6`.
- Lượt này: TypeScript, ESLint các file giao diện/lưu trữ đã đổi và
  `git diff --check` đạt. Chưa chạy Jest/emulator hoặc thử UI trên iPhone.

### Sửa lần cho mượn thêm — 12/10/2026

- Mỗi dòng cho vay thêm trong lịch sử có nút sửa số tiền, ngày và nội dung.
  Nội dung là bắt buộc khi lưu thay đổi.
- Ghi khoản vay cùng giao dịch Chi liên kết trong một Firestore transaction;
  kiểm tra không làm tổng tiền thấp hơn các lần nhận đã ghi hoặc đang chờ.
- Rules xác nhận chỉ vị trí được chọn thay đổi, giữ nguyên danh tính giao dịch,
  và bắt buộc giao dịch Chi mới khớp với số tiền/ngày/nội dung.
- Phát hành rules lên `baseapp-dd227`, sau đó xác nhận source đang hoạt động là
  ruleset `1d72f535-816f-425f-a125-3e846a8f85df`. TypeScript, ESLint và
  `git diff --check` đạt; chưa chạy Jest/emulator hoặc thử UI trên iPhone.

### Sửa các lỗi sau review — 12/10/2026

- Khoản vay mới lưu `recordedRepaymentAmount` bắt đầu từ 0. Mỗi lần nhận tiền
  tăng đúng số đã ghi; rules không cho sửa tổng tiền cho vay thấp hơn tổng này.
  Khoản cũ chưa có trường tổng và đã có lần trả chỉ được giữ hoặc tăng tổng
  tiền cho vay; ngày và nội dung vẫn sửa được. Khoản cũ chưa nhận tiền bắt đầu
  theo dõi tổng từ lần nhận đầu tiên.
- Sau khi Firestore xác nhận lần cho vay thêm, ứng dụng dọn mã thử lại trước
  khi cập nhật cache/Tài chính. Khi đồng bộ, ID đã nằm trong lịch sử được xem
  là đã ghi nhận dù số tiền, ngày hoặc nội dung của lần đó đã được sửa.
- Giao dịch còn lại của hồ sơ đã xóa hiển thị nội dung có sẵn và không còn nút
  liên kết tới hồ sơ không tồn tại.
- Dữ liệu mẫu trong các kiểm thử hiện có dùng mẫu giao dịch tùy chỉnh thay vì
  mẫu cà phê đã bỏ; báo cáo chi tiêu kỳ vọng cả danh mục Vui chơi.
- Firestore rules đã được biên dịch bằng emulator và dry-run, phát hành lên
  `baseapp-dd227`, rồi đọc lại bản đang hoạt động để đối chiếu đúng nguồn.
  Ruleset: `3ec99e24-15f3-4928-a82e-d71ca48d62e2`.
- TypeScript, ESLint, `git diff --check` và bundle Android/iOS đạt. Jest:
  71 suite, 375 kiểm thử đạt sau khi cập nhật kỳ vọng cho bố cục tháng mới.
  Chưa thử UI trên iPhone trong lượt này.
- Supabase `audio-access` không có thay đổi trong repo. Đã tải mã đang chạy
  từ Dashboard và đối chiếu với nguồn cục bộ; khác tên file, cách viết chuỗi
  và định dạng, không khác hành vi. Endpoint từ chối yêu cầu không có token
  với HTTP 401; tùy chọn gateway JWT legacy vẫn tắt để handler xác minh
  Firebase ID token. Cả 22 kiểm thử Supabase đều đạt; không phát hành lại
  function hay chạy migration.

### Sửa và xóa từng mục lịch sử khoản vay — 12/10/2026

- Mỗi khoản vay ban đầu, khoản vay thêm và lần đã nhận đã ghi Tài chính có
  nút mở bảng thao tác Sửa/Xóa ở cuối màn hình. Sửa lần nhận cho đổi số
  tiền/ngày; giao dịch Tài chính liên kết được sửa cùng lần ghi Firestore.
- Xóa khoản vay thêm hoặc lần đã nhận sẽ xóa giao dịch Tài chính liên kết
  cùng lần ghi. Xóa khoản vay ban đầu khi còn khoản vay thêm sẽ lấy khoản
  vay thêm đầu tiên làm khoản gốc, giữ các lần vay và nhận còn lại.
  Nếu chỉ có khoản vay ban đầu và còn lần đã nhận, ứng dụng yêu cầu xử lý
  các lần đã nhận trước để tránh tạo hồ sơ không có khoản gốc.
- Rules cho các thao tác này đã được phát hành trên Firebase
  `baseapp-dd227` qua Firebase Console lúc 22:57. Supabase không có thay
  đổi cho chức năng này.

### Lệnh kiểm tra rules

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
