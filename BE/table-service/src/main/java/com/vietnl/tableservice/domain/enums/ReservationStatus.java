package com.vietnl.tableservice.domain.enums;

public enum ReservationStatus {
    CONFIRMED(0),
    CANCELLED(1),
    COMPLETED(2);

    private final Integer value;

    ReservationStatus(Integer value) {
        this.value = value;
    }

    public Integer getValue() {
        return value;
    }
}
