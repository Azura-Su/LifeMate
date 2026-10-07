# LifeMate — phạm vi

| Module        | Trách nhiệm                                   | Phụ thuộc                        |
| ------------- | --------------------------------------------- | -------------------------------- |
| identity      | Firebase Auth, phiên đăng nhập, logout        | foundation                       |
| profile       | Remote Config `users`, ánh xạ tên theo email  | identity                         |
| notifications | Quyền nhận push, FCM token, nhận/mở thông báo | identity                         |
| shell         | Login, Home, MP3, Setting, nhận diện          | identity, profile, notifications |

Thứ tự: foundation → identity → profile → notifications → shell → kiểm thử.
Người dùng yêu cầu lập plan rồi thực hiện trong cùng lượt. Tiến hành theo phạm vi này, không chờ duyệt lại.
