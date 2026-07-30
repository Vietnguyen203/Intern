package com.vietnl.loyaltyservice.application.responses;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Envelope response chung — khớp với format {code, message, data} mà frontend (services/api.js)
 * đang kiểm tra ở tất cả các service khác trong dự án (data.code === 'ERROR' -> throw).
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    private String code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder().code("SUCCESS").message("OK").data(data).build();
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder().code("SUCCESS").message(message).data(data).build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder().code("ERROR").message(message).data(null).build();
    }
}
