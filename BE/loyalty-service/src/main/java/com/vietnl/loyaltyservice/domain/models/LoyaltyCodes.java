package com.vietnl.loyaltyservice.domain.models;

/**
 * Các mã số (SMALLINT) dùng trong DB loyalty-service — xem migration ở
 * BE/migration-service/modules/loyalty/changelog để đối chiếu.
 * Đặt tập trung ở đây thay vì rải rác "magic number" trong code, theo đúng kiểu
 * các cột status/type SMALLINT đã dùng ở orders/order_items/users trong dự án.
 */
public final class LoyaltyCodes {

    private LoyaltyCodes() {
    }

    // customers.status
    public static final short CUSTOMER_ACTIVE = 0;
    public static final short CUSTOMER_LOCKED = 1;

    // point_transactions.type
    public static final short TX_EARN = 0;
    public static final short TX_REDEEM = 1;
    public static final short TX_EXPIRE = 2;
    public static final short TX_ADJUST = 3;

    // reward_items.discount_type
    public static final short DISCOUNT_PERCENT = 0;
    public static final short DISCOUNT_FIXED_AMOUNT = 1;

    // reward_items.active
    public static final short REWARD_INACTIVE = 0;
    public static final short REWARD_ACTIVE = 1;

    // voucher_redemptions.status
    public static final short VOUCHER_ISSUED = 0;
    public static final short VOUCHER_USED = 1;
    public static final short VOUCHER_EXPIRED = 2;
}
