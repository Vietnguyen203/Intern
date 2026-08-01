package com.vietnl.loyaltyservice.application.requests;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^0\\d{9}$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Pattern(regexp = "^.{6,}$", message = "Mật khẩu phải có ít nhất 6 ký tự")
    private String password;

    @NotBlank(message = "Họ tên không được để trống")
    private String fullName;

    // Bắt buộc từ khi có xác nhận OTP lúc đăng ký (trước đây tùy chọn) — OTP cần nơi để gửi tới.
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Sai định dạng email")
    private String email;

    private String birthday; // ISO date string (yyyy-MM-dd), optional
}
