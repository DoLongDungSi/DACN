# How to use
## Cài đặt
### Cài đặt Docker

**Linux (Arch-based):**
```bash
yay -S docker docker-compose
# Thêm user vào nhóm docker (để không cần gõ sudo)
sudo usermod -aG docker $USER
```
**Linux (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo usermod -aG docker $USER
```
**Windows (winget):**

```bash
winget install Docker.DockerDesktop
```

**Windows/MacOS:** Tải và cài đặt Docker Desktop [tại đây](https://www.docker.com/products/docker-desktop/)



### Build dự án

Bạn buộc phải build dự án trước khi chạy bằng lệnh:

```bash
docker compose build
```

Bạn cũng có thể chạy lệnh này để chạy ngay khi build xong:
```bash
docker compose up --build
```

## Chạy dự án
Sau khi bạn build xong, bạn có thể chạy bằng:

```bash
docker compose up
```
## Sử dụng
Sau khi khởi động thành công, truy cập vào:

Frontend: http://localhost:3000

Backend: http://localhost:5000

Để chỉnh sửa cổng mặc định, bạn có thể xem trong file docker-compose.yml.

Bạn cũng có thể tạo file .env chứa các tham số như OPENROUTER_API_KEY, OPENROUTER_MODEL, CHATBOT_PROMPT,... để biết chi tiết, vui lòng xem .env.example