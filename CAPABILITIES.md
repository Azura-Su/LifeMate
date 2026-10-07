# LifeMate — phạm vi

| Module        | Trách nhiệm                                   | Phụ thuộc                        |
| ------------- | --------------------------------------------- | -------------------------------- |
| identity      | Firebase Auth, phiên đăng nhập, logout        | foundation                       |
| profile       | Remote Config `users`, ánh xạ tên theo email  | identity                         |
| notifications | Quyền nhận push, FCM token, nhận/mở thông báo | identity                         |
| shell         | Login, Home, MP3, Setting, nhận diện          | identity, profile, notifications |
| audio-media   | Đọc media, tách tiếng, cắt và nối audio trên thiết bị | foundation |
| audio-library | Thư viện riêng, bản local bền vững, Storage/Firestore | identity, audio-media |
| audio-editor  | Chọn file, nghe, chọn đoạn và thứ tự ghép trong tab MP3 | audio-library |

Thứ tự: foundation → identity → profile → notifications → shell → kiểm thử.
Người dùng yêu cầu lập plan rồi thực hiện trong cùng lượt. Tiến hành theo phạm vi này, không chờ duyệt lại.

Mở rộng 07/10/2026: audio-media → audio-library → audio-editor. Người dùng xác nhận thư viện riêng và nối âm thanh lần lượt.
