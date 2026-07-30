package com.vietnl.loyaltyservice.infrastructure.persistence.repositories;

import com.vietnl.loyaltyservice.domain.models.entities.LoyaltyAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

public interface LoyaltyAccountRepository extends JpaRepository<LoyaltyAccount, UUID> {
    Optional<LoyaltyAccount> findByCustomerId(UUID customerId);

    // Khoá dòng khi cộng/trừ điểm để tránh race condition (2 request cùng lúc đổi điểm/cộng điểm
    // của cùng 1 khách) — xem phần "đổi điểm lấy voucher" trong kế hoạch đã thống nhất.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LoyaltyAccount a where a.customerId = :customerId")
    Optional<LoyaltyAccount> findByCustomerIdForUpdate(UUID customerId);
}
