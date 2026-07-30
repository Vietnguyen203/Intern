# Backend Services (BE)

Thư mục này chứa toàn bộ các microservices của hệ thống RMS.

## Danh sách dịch vụ
- **gateway-service**: Cổng điều phối request (Port 8080).
- **users-service**: Quản lý người dùng, login, phân quyền (Port 8087).
- **order-service**: Xử lý đơn hàng (Port 8082).
- **catalog-service**: Quản lý món ăn, thực đơn (Port 8081).
- **table-service**: Quản lý trạng thái bàn (Port 8083).
- **payment-service**: Quản lý thanh toán (Port 8085).
- **notification-service**: Gửi thông báo WebSocket/Mail (Port 8086).
- **loyalty-service**: Tài khoản khách hàng, tích điểm & hạng thành viên (Port 8088).
- **migration-service**: Công cụ chạy script SQL (Liquibase).

## Cách chạy nhanh
1. Chạy Kafka: `docker-compose up -d`
2. Chạy Migration: `cd migration-service && ./gradlew migrate-all`
3. Chạy từng service: `cd <service-name> && ./gradlew bootRun`

*Xem hướng dẫn chi tiết tại [README.md chính ở thư mục gốc](../README.md).*
