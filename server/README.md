# Công cụ server LifeMate

Folder này chạy độc lập, không nằm trong bundle React Native. Hiện chưa cần HTTP backend: client dùng Firebase Auth, Remote Config và nhận FCM trực tiếp. File `send-push.mjs` là công cụ gửi đến một token thiết bị, không phải dịch vụ gửi tự động.

```sh
cd server
npm ci
cp .env.example .env
# Điền giá trị trong .env, credentials để ngoài repository.
node --env-file=.env send-push.mjs
```

Chỉ chạy lệnh cuối khi thực sự muốn gửi push. Cần Firebase Cloud Messaging API v1 và service account có quyền gửi của đúng project. Không dùng API key trong google-services.json thay cho Admin credentials.

FCM token lấy từ bản development: Setting → Bật thông báo → Sao chép FCM token để kiểm thử. Không có mapping token → user trong phiên bản này. Nếu thêm push cá nhân, server phải xác minh Firebase ID token, lưu mapping UID/token và hủy mapping khi logout; không lấy UID tùy ý từ client làm quyền gửi.
