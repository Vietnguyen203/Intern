package com.vietnl.tableservice.infrastructure.security;

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
                        .requestMatchers("/ws-tables/**").permitAll()

                        // Công khai — khách quét QR hoặc tự đặt bàn trước, không cần đăng nhập
                        .requestMatchers(HttpMethod.GET, "/tables/reservations/available").permitAll()
                        .requestMatchers(HttpMethod.POST, "/tables/reservations/public").permitAll()

                        // Tạo/sửa/xóa bàn = thay đổi sơ đồ bàn của nhà hàng — chỉ ADMIN
                        .requestMatchers(HttpMethod.POST, "/tables").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/tables/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/tables/*").hasRole("ADMIN")

                        // Thao tác vận hành bàn theo ca (đổi trạng thái, gán/gỡ đơn, dọn bàn, lấy QR
                        // token để in) — nhân viên phục vụ trở lên, KHÔNG public
                        .requestMatchers(HttpMethod.PATCH, "/tables/*/status").hasAnyRole("WAITER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/tables/*/assign-order").hasAnyRole("WAITER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/tables/*/release").hasAnyRole("WAITER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/tables/*/ready").hasAnyRole("WAITER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/tables/*/qr-token").hasAnyRole("WAITER", "ADMIN")

                        // Quản lý lượt đặt bàn (xem danh sách, huỷ) — nhân viên trở lên, KHÔNG public
                        // (khác với /tables/reservations/available và /public đã permitAll ở trên)
                        .requestMatchers(HttpMethod.GET, "/tables/reservations").hasAnyRole("WAITER", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/tables/reservations/*").hasAnyRole("WAITER", "ADMIN")

                        .anyRequest().authenticated()
                )
                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
