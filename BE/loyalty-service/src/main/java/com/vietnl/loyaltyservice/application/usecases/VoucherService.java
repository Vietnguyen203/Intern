package com.vietnl.loyaltyservice.application.usecases;

import com.vietnl.loyaltyservice.adapter.exception.ApiException;
import com.vietnl.loyaltyservice.application.responses.VoucherResponse;
import com.vietnl.loyaltyservice.domain.models.LoyaltyCodes;
import com.vietnl.loyaltyservice.domain.models.entities.RewardItem;
import com.vietnl.loyaltyservice.domain.models.entities.VoucherRedemption;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.RewardItemRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.VoucherRedemptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/** Dùng bởi WAITER lúc thanh toán (App.jsx) để kiểm tra & áp mã voucher của khách vào hoá đơn. */
@Service
@RequiredArgsConstructor
public class VoucherService {

    private final VoucherRedemptionRepository voucherRedemptionRepository;
    private final RewardItemRepository rewardItemRepository;

    @Transactional(readOnly = true)
    public VoucherResponse validate(String code) {
        VoucherRedemption voucher = voucherRedemptionRepository.findByCode(code)
                .orElseThrow(() -> ApiException.notFound("Mã voucher không tồn tại."));
        if (!voucher.getStatus().equals(LoyaltyCodes.VOUCHER_ISSUED)) {
            throw ApiException.badRequest("Voucher này đã được dùng hoặc đã hết hạn.");
        }
        RewardItem reward = rewardItemRepository.findById(voucher.getRewardItemId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy thông tin ưu đãi của voucher này."));

        return VoucherResponse.builder()
                .code(voucher.getCode())
                .status("ISSUED")
                .discountType(reward.getDiscountType() == LoyaltyCodes.DISCOUNT_PERCENT ? "PERCENT" : "FIXED_AMOUNT")
                .discountValue(reward.getDiscountValue())
                .build();
    }

    @Transactional
    public VoucherResponse use(String code, UUID orderId) {
        VoucherRedemption voucher = voucherRedemptionRepository.findByCode(code)
                .orElseThrow(() -> ApiException.notFound("Mã voucher không tồn tại."));
        if (!voucher.getStatus().equals(LoyaltyCodes.VOUCHER_ISSUED)) {
            throw ApiException.badRequest("Voucher này đã được dùng hoặc đã hết hạn.");
        }

        voucher.setStatus(LoyaltyCodes.VOUCHER_USED);
        voucher.setUsedAt(LocalDateTime.now());
        voucher.setUsedOnOrderId(orderId);
        voucherRedemptionRepository.save(voucher);

        RewardItem reward = rewardItemRepository.findById(voucher.getRewardItemId()).orElse(null);
        return VoucherResponse.builder()
                .code(voucher.getCode())
                .status("USED")
                .discountType(reward != null
                        ? (reward.getDiscountType() == LoyaltyCodes.DISCOUNT_PERCENT ? "PERCENT" : "FIXED_AMOUNT")
                        : null)
                .discountValue(reward != null ? reward.getDiscountValue() : null)
                .build();
    }
}
