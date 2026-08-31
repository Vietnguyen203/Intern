package com.vietnl.notificationservice.infrastructure.security;

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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Handshake WebSocket (SockJS) — xác thực JWT được thực hiện riêng ở bước
                        // STOMP CONNECT trong WebSocketConfig, không phải ở tầng HTTP filter này.
                        .requestMatchers("/ws-notifications/**").permitAll()

                        // POST /notifications/send: endpoint nội bộ để các service khác (catalog-service,
                        // order-service, payment-service) tự bắn thông báo hệ thống (hết hàng, đơn mới,
                        // thanh toán thành công...) — xem NotificationFeignClient ở các service đó.
                        // Các Feign client này gọi thẳng KHÔNG kèm Authorization header (fire-and-forget,
                        // không có service token như payment-service -> order-service), nên phải giữ
                        // permitAll ở đây, nếu không toàn bộ luồng thông báo tự động giữa các service sẽ
                        // vỡ (403). users-service có forward JWT của user khi gọi endpoint này nhưng điều
                        // đó vẫn hoạt động bình thường vì permitAll không cấm việc có token hợp lệ.
                        .requestMatchers(HttpMethod.POST, "/notifications/send").permitAll()

                        // Các endpoint còn lại là thao tác của nhân viên (xem thông báo của mình, đánh
                        // dấu đã đọc, đăng ký/hủy device token để nhận push FCM) — chỉ nhân viên đã đăng
                        // nhập (phục vụ, bếp, quản trị) mới được gọi, KHÔNG public.
                        .requestMatchers(HttpMethod.GET, "/notifications/recent").hasAnyRole("WAITER", "ADMIN", "KITCHEN")
                        .requestMatchers(HttpMethod.PATCH, "/notifications/*/read").hasAnyRole("WAITER", "ADMIN", "KITCHEN")
                        .requestMatchers(HttpMethod.POST, "/notifications/device-token").hasAnyRole("WAITER", "ADMIN", "KITCHEN")
                        .requestMatchers(HttpMethod.DELETE, "/notifications/device-token").hasAnyRole("WAITER", "ADMIN", "KITCHEN")

                        .anyRequest().authenticated()
                )
                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
