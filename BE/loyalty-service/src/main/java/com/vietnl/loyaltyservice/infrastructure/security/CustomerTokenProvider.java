package com.vietnl.loyaltyservice.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * Phát hành & xác thực JWT của KHÁCH HÀNG — cố tình dùng secret RIÊNG (jwt.customer.secret),
 * khác với secret của nhân viên (jwt.staff.secret, phải khớp jwt.secret bên users-service),
 * để 2 loại token không thể dùng lẫn cho nhau kể cả khi có bug ở tầng khác.
 */
@Component
public class CustomerTokenProvider {

    private final SecretKey key;
    private final long expirationMs;

    public CustomerTokenProvider(
            @Value("${jwt.customer.secret}") String secret,
            @Value("${jwt.customer.expiration}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(UUID customerId, String phone) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .setSubject(customerId.toString())
                .claim("phone", phone)
                .claim("aud", "CUSTOMER")
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /** Trả về customerId nếu token hợp lệ, ném JwtException nếu không (hết hạn/sai chữ ký...). */
    public UUID validateAndGetCustomerId(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return UUID.fromString(claims.getSubject());
    }
}
