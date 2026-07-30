package com.vietnl.loyaltyservice.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * 1 filter dùng chung cho cả 2 loại JWT (khách hàng vs nhân viên), chọn validator theo path:
 *  - /vouchers/**  -> JWT nhân viên (waiter xử lý lúc checkout)
 *  - còn lại       -> JWT khách hàng (đăng nhập tài khoản loyalty)
 * Không cố "thử cả 2" trên cùng 1 path để tránh mập mờ — mỗi path chỉ chấp nhận đúng 1 loại token.
 * Token thiếu/sai/hết hạn thì bỏ qua (anonymous) — SecurityConfig sẽ tự chặn nếu path đó cần login.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String CUSTOMER_ID_ATTR = "loyalty.customerId";
    public static final String STAFF_SUBJECT_ATTR = "loyalty.staffSubject";

    private final CustomerTokenProvider customerTokenProvider;
    private final StaffTokenValidator staffTokenValidator;

    public JwtAuthenticationFilter(CustomerTokenProvider customerTokenProvider, StaffTokenValidator staffTokenValidator) {
        this.customerTokenProvider = customerTokenProvider;
        this.staffTokenValidator = staffTokenValidator;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        String path = request.getServletPath();

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                if (path.startsWith("/vouchers")) {
                    String staffSubject = staffTokenValidator.validateAndGetSubject(token);
                    request.setAttribute(STAFF_SUBJECT_ATTR, staffSubject);
                    setAuthentication(staffSubject, "ROLE_STAFF");
                } else {
                    UUID customerId = customerTokenProvider.validateAndGetCustomerId(token);
                    request.setAttribute(CUSTOMER_ID_ATTR, customerId);
                    setAuthentication(customerId.toString(), "ROLE_CUSTOMER");
                }
            } catch (Exception ex) {
                // Token không hợp lệ -> để anonymous, SecurityConfig quyết định có chặn path này không.
                SecurityContextHolder.clearContext();
            }
        }

        chain.doFilter(request, response);
    }

    private void setAuthentication(String principal, String authority) {
        var auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority(authority)));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
