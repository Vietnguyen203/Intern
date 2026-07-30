package com.vietnl.loyaltyservice.infrastructure.persistence.repositories;

import com.vietnl.loyaltyservice.domain.models.entities.PointTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PointTransactionRepository extends JpaRepository<PointTransaction, UUID> {
    List<PointTransaction> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    // Chống cộng điểm trùng khi Kafka gửi lại (retry/rebalance) cùng 1 orderId — kiểm tra trước khi
    // insert bản ghi EARN mới. Xem mục "idempotency" đã bàn trong kế hoạch.
    boolean existsByOrderIdAndType(UUID orderId, Short type);
}
