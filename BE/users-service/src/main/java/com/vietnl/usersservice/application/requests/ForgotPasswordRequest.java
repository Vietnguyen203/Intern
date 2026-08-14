package com.vietnl.usersservice.application.requests;

import lombok.Data;

@Data
public class ForgotPasswordRequest {
    // Bắt buộc kèm username (Employee ID) — vì email không unique trong hệ thống, chỉ dựa vào email
    // thì không xác định được chính xác 1 tài khoản (xem UserService.forgotPassword).
    private String username;
    private String email;
}
