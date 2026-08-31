package com.vietnl.orderservice.infrastructure.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Khách hàng ẩn danh (quét QR, không có JWT) tạo đơn mới + gọi thêm món vào đơn đang mở +
                // kiểm tra đơn còn mở không, tất cả đều tự xác thực bằng tableToken ở tầng OrderService
                // (validateTableToken), KHÔNG dựa vào Spring Security ở đây.
                .requestMatchers(HttpMethod.POST, "/orders/public", "/orders/public/*/items").permitAll()
                .requestMatchers(HttpMethod.GET, "/orders/public/*").permitAll()

                // OrderStatisticAPI (cùng base path "/orders" nhưng khác controller) — 2 endpoint thống
                // kê này trùng độ dài path (1 segment) với "/orders/{id}" nên phải khai báo TRƯỚC luật
                // GET /orders/* ở dưới để không vô tình bị bó buộc vào role WAITER/ADMIN/SERVICE của
                // riêng việc xem 1 đơn hàng. Giữ nguyên hành vi cũ: chỉ cần đăng nhập (không giới hạn role).
                .requestMatchers(HttpMethod.GET, "/orders/most-favorite-food", "/orders/list").authenticated()

                // GET /orders/{id}: nhân viên (phục vụ trở lên) xem đơn, HOẶC payment-service tự gọi
                // bằng internal service token (subject "service:payment-service", claim role=SERVICE)
                // để lấy customerId lúc phát sự kiện Kafka cộng điểm loyalty sau khi hoàn tất thanh toán
                // — xem OrderFeignClient.getOrderById + JwtUtil.generateInternalServiceToken() bên
                // payment-service. PHẢI giữ SERVICE trong danh sách role, nếu không luồng Kafka loyalty
                // đang chạy sẽ bị 403.
                .requestMatchers(HttpMethod.GET, "/orders/*").hasAnyRole("WAITER", "ADMIN", "SERVICE")

                // Tạo đơn, thêm/sửa/xóa món, đổi trạng thái đơn, hủy đơn — nghiệp vụ của nhân viên phục
                // vụ (waiter) trở lên, không phải thao tác khách hàng được phép tự làm qua JWT.
                .requestMatchers(HttpMethod.POST, "/orders").hasAnyRole("WAITER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/orders/*/items").hasAnyRole("WAITER", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/orders/*/items/*").hasAnyRole("WAITER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/orders/*/items/*").hasAnyRole("WAITER", "ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/orders/*/status").hasAnyRole("WAITER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/orders/*").hasAnyRole("WAITER", "ADMIN")

                // Bếp cập nhật trạng thái chế biến từng món (PENDING/COOKING/READY/CANCELLED)
                .requestMatchers(HttpMethod.PATCH, "/orders/items/*/kitchen-status").hasAnyRole("KITCHEN", "ADMIN")

                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
