package com.vietnl.loyaltyservice.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;

/**
 * CHỈ xác thực (không phát hành) JWT của NHÂN VIÊN — dùng ở các endpoint waiter thao tác lúc
 * checkout (validate/use voucher). Secret phải khớp jwt.secret bên users-service/order-service/
 * payment-service thì mới xác thực được token thật do users-service phát hành.
 *
 * QUAN TRỌNG: users-service (JwtService.getSignInKey) build key bằng
 * Decoders.BASE64.decode(secretKey) — KHÔNG PHẢI secret.getBytes(UTF_8). Trước đây chỗ này dùng
 * getBytes(UTF_8) trực tiếp: dù giá trị cấu hình 2 bên giống hệt nhau (cùng 1 chuỗi hex), decode
 * theo 2 kiểu khác nhau tạo ra 2 key thực tế khác nhau về độ dài lẫn giá trị byte (Base64-decode
 * 64 ký tự -> 48 byte, còn getBytes(UTF_8) -> 64 byte) -> mọi JWT nhân viên thật do users-service
 * phát hành đều verify thất bại ở đây, /vouchers/** và /admin/** coi như luôn nhận "chưa đăng nhập"
 * dù có gửi kèm token hợp lệ. Phải decode ĐÚNG CÙNG KIỂU với bên phát hành token thì mới ra chung 1 key.
 *
 * LƯU Ý: hiện chưa xác nhận được tên các claim tuỳ biến (role, userId...) trong JWT nhân viên vì
 * chưa đọc được source users-service — nên tạm thời chỉ đọc "sub" (chuẩn JWT, gần như chắc chắn có)
 * để ghi log/audit ai là người xử lý voucher, KHÔNG dùng để phân quyền chi tiết theo role.
 */
@Component
public class StaffTokenValidator {

    private final SecretKey key;

    public StaffTokenValidator(@Value("${jwt.staff.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
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
