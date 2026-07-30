package com.vietnl.loyaltyservice.infrastructure.persistence.repositories;

import com.vietnl.loyaltyservice.domain.models.entities.RewardItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RewardItemRepository extends JpaRepository<RewardItem, UUID> {
    List<RewardItem> findByActiveOrderByPointsCostAsc(Short active);
}
