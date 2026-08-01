package com.vietnl.loyaltyservice.application.responses;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private CustomerResponse customer;

    // "REQUIRE_OTP" khi register() vừa gửi OTP xong (token/customer null lúc này), hoặc "SUCCESS"
    // sau khi verify-otp thành công. login() không đụng tới field này (giữ null như trước giờ) —
    // không phá code cũ nào đang đọc AuthResponse mà không quan tâm status.
    private String status;
}
