package com.vietnl.orderservice.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.isTokenValid(token)) {
                String username = jwtUtil.extractUsername(token);

                // Gán quyền (authority) từ claim "role" trong JWT — trước đây filter này luôn gán
                // Collections.emptyList() nên user KHÔNG có bất kỳ authority nào, khiến mọi hasRole()/
                // hasAnyRole() khai báo ở SecurityConfig luôn trả về false (bị 403) hoặc vô nghĩa;
                // filter thực chất chỉ kiểm tra CHỮ KÝ hợp lệ chứ không phân quyền theo role. Token nội
                // bộ payment-service tự cấp (JwtUtil.generateInternalServiceToken()) mang claim
                // role=SERVICE cũng đi qua đúng nhánh này để có authority ROLE_SERVICE.
                String role = jwtUtil.extractAllClaims(token).get("role", String.class);
                if (role == null || role.isBlank()) {
                    role = "USER";
                }
                if (!role.startsWith("ROLE_")) {
                    role = "ROLE_" + role;
                }

                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(username, null,
                                Collections.singletonList(new SimpleGrantedAuthority(role)));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        filterChain.doFilter(request, response);
    }
}
