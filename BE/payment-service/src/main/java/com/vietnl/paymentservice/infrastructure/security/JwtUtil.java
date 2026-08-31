package com.vietnl.paymentservice.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    // Token nội bộ service-to-service (KHÔNG phải token của nhân viên/khách) — dùng khi payment-service
    // cần tự gọi sang order-service (vd. lấy customerId của đơn lúc hoàn tất thanh toán để phát sự kiện
    // Kafka cho loyalty-service). Ký bằng cùng jwt.secret dùng chung giữa các service nội bộ, TTL ngắn vì
    // chỉ dùng ngay trong 1 lượt gọi Feign chứ không lưu lại.
    public String generateInternalServiceToken() {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", "SERVICE");
        return Jwts.builder()
                .setClaims(claims)
                .setSubject("service:payment-service")
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 60_000L)) // 60s là đủ cho 1 lượt gọi Feign
                .signWith(getSignInKey())
                .compact();
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }
}
