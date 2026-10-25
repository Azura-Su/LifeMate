# Review trò chơi — checklist 25/10/2026

- [x] Xác định phạm vi, SPEC và working tree; đọc review trước.
- [x] Lập kế hoạch review, tiêu chí và ranh giới dữ liệu.
- [x] Reviewer độc lập duyệt kế hoạch; bổ sung revoke/subscription và score ACK race.
- [x] Lưu baseline; chạy full Jest/functions/typecheck/lint.
- [x] Review backend/phòng/worker/protocol/quyền và engine/điểm.
- [x] Review client/session/realtime/cache/UI và bảng điểm dùng chung.
- [x] Probe cục bộ2–4 client/cả2 trò và xác nhận từng bug.
- [x] Lập kế hoạch sửa bug đã xác nhận, duyệt thay đổi rủi ro cao.
- [x] RED regression, sửa tối thiểu và GREEN cho từng bug.
- [x] Reviewer độc lập rà diff cuối; xử lý finding còn lại (cache khi rời bàn lịch sử).
- [x] Chạy các gate sau fix và bundle iOS/Android; ghi rõ giới hạn chưa test race native trên thiết bị thật.
- [x] Ghi báo cáo phát hiện, kết quả sửa và giới hạn xác minh.
