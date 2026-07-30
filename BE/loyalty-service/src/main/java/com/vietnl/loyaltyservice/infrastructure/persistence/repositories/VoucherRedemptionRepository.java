package com.vietnl.loyaltyservice.infrastructure.persistence.repositories;

import com.vietnl.loyaltyservice.domain.models.entities.VoucherRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VoucherRedemptionRepository extends JpaRepository<VoucherRedemption, UUID> {
    Optional<VoucherRedemption> findByCode(String code);
    boolean existsByCode(String code);
    List<VoucherRedemption> findByCustomerIdOrderByIssuedAtDesc(UUID customerId);
}
