package com.vietnl.loyaltyservice.infrastructure.persistence.repositories;

import com.vietnl.loyaltyservice.domain.models.entities.MembershipTier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembershipTierRepository extends JpaRepository<MembershipTier, UUID> {
    Optional<MembershipTier> findByRank(String rank);

    List<MembershipTier> findAllByOrderBySortOrderAsc();

    // Hạng cao nhất mà khách đủ điều kiện theo tổng chi tiêu — dùng khi tính lại hạng sau mỗi lần cộng điểm.
    List<MembershipTier> findByMinTotalSpentLessThanEqualOrderBySortOrderDesc(BigDecimal totalSpent);
}
