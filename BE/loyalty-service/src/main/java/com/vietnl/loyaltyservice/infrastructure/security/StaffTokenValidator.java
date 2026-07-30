package com.vietnl.loyaltyservice.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * CHỈ xác thực (không phát hành) JWT của NHÂN VIÊN — dùng ở các endpoint waiter thao tác lúc
 * checkout (validate/use voucher). Secret phải khớp jwt.secret bên users-service/order-service/
 * payment-service thì mới xác thực được token thật do users-service phát hành.
 *
 * LƯU Ý: hiện chưa xác nhận được tên các claim tuỳ biến (role, userId...) trong JWT nhân viên vì
 * chưa đọc được source users-service — nên tạm thời chỉ đọc "sub" (chuẩn JWT, gần như chắc chắn có)
 * để ghi log/audit ai là người xử lý voucher, KHÔNG dùng để phân quyền chi tiết theo role.
 */
@Component
public class StaffTokenValidator {

    private final SecretKey key;

    public StaffTokenValidator(@Value("${jwt.staff.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Trả về "sub" (thường là username) nếu token hợp lệ, ném JwtException nếu không. */
    public String validateAndGetSubject(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return claims.getSubject();
    }
}
