package com.vietnl.usersservice.application.requests;

import lombok.Data;

// Dùng riêng cho luồng "Quên mật khẩu" tự phục vụ (public, xác thực bằng OTP gửi qua email) —
// khác với ResetPasswordRequest (chỉ có password, dùng cho Admin đổi mật khẩu người khác theo id,
// đã yêu cầu quyền ADMIN sẵn nên không cần OTP).
@Data
public class ResetPasswordWithOtpRequest {
    private String username;
    private String email;
    private String otp;
    private String password;
}
