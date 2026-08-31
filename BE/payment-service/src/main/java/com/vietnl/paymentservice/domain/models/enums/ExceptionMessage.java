package com.vietnl.paymentservice.domain.models.enums;

public enum ExceptionMessage {
    MISSING_REQUIRED_FIELD("Trường %s là bắt buộc"),
    INVALID_AMOUNT("Số tiền thanh toán không hợp lệ"),
    PAYMENT_NOT_FOUND("Không tìm thấy thông tin thanh toán"),
    ORDER_NOT_FOUND("Không tìm thấy đơn hàng tương ứng"),
    DUPLICATE_PAYMENT("Đơn hàng này đã được thanh toán trước đó"),
    AMOUNT_MISMATCH("Số tiền thanh toán không khớp với tổng tiền đơn hàng, vui lòng kiểm tra lại");

    private final String message;
    
    ExceptionMessage(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
}
