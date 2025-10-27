# Cài đặt


## Để có thể chạy được dự án, ta cần docker, npm và python

Trên Arch-base, bạn có thể dùng yay để cài đặt:

```bash
yay -S npm docker docker-compose python
```

## Để chạy dự án
### Ta cài các dependencies

```bash
# Cài cho back-end
cd backend
npm install
cd ..

# Cài cho front-end
cd frontend
npm install
cd ..
```

### Khởi tạo dự án
```bash
# Windows
docker-compose up --build

# Arch-based / Linux distros
docker compose up --build

```

Khi đã build  xong dự án, ta có thể chạy không cần cờ build

```bash
# Windows
docker-compose up

# Arch-based / Linux distros
docker compose up

```