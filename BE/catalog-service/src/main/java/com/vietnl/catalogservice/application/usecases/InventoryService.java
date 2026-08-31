package com.vietnl.catalogservice.application.usecases;

import com.vietnl.catalogservice.application.requests.IngredientRequest;
import com.vietnl.catalogservice.application.requests.RecipeItemRequest;
import com.vietnl.catalogservice.application.requests.StockTransactionRequest;
import com.vietnl.catalogservice.application.requests.DeductStockRequest;
import com.vietnl.catalogservice.domain.entities.Ingredient;
import com.vietnl.catalogservice.domain.entities.Recipe;
import com.vietnl.catalogservice.domain.entities.InventoryTransaction;
import com.vietnl.catalogservice.infrastructure.persistence.repositories.IngredientRepository;
import com.vietnl.catalogservice.infrastructure.persistence.repositories.RecipeRepository;
import com.vietnl.catalogservice.infrastructure.persistence.repositories.InventoryTransactionRepository;
import com.vietnl.catalogservice.infrastructure.communication.NotificationFeignClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final IngredientRepository ingredientRepository;
    private final RecipeRepository recipeRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final NotificationFeignClient notificationFeignClient;

    // --- Ingredients CRUD ---

    public List<Ingredient> getAllIngredients() {
        return ingredientRepository.findAll().stream()
                .filter(Ingredient::isActive)
                .collect(java.util.stream.Collectors.toList());
    }

    public Ingredient getIngredientById(UUID id) {
        return ingredientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Nguyên vật liệu không tồn tại!"));
    }

    public Ingredient createIngredient(IngredientRequest request) {
        Ingredient ingredient = new Ingredient();
        ingredient.setName(request.getName());
        ingredient.setUnit(request.getUnit());
        ingredient.setMinStock(request.getMinStock() != null ? request.getMinStock() : BigDecimal.ZERO);
        ingredient.setCurrentStock(BigDecimal.ZERO);
        return ingredientRepository.save(ingredient);
    }

    public Ingredient updateIngredient(UUID id, IngredientRequest request) {
        Ingredient ingredient = getIngredientById(id);
        if (request.getName() != null) ingredient.setName(request.getName());
        if (request.getUnit() != null) ingredient.setUnit(request.getUnit());
        if (request.getMinStock() != null) ingredient.setMinStock(request.getMinStock());
        return ingredientRepository.save(ingredient);
    }

    @Transactional
    public void deleteIngredient(UUID id, String reason) {
        Ingredient ingredient = ingredientRepository.findById(id).orElse(null);
        if (ingredient != null) {
            boolean hasStock = ingredient.getCurrentStock() != null && ingredient.getCurrentStock().compareTo(BigDecimal.ZERO) > 0;
            if (hasStock || (reason != null && !reason.isBlank())) {
                InventoryTransaction tx = new InventoryTransaction();
                tx.setIngredientId(id);
                tx.setTransactionType("EXPORT_WASTE");
                tx.setQuantity(hasStock ? ingredient.getCurrentStock() : BigDecimal.ZERO);
                tx.setPrice(BigDecimal.ZERO);
                tx.setReason("Xóa nguyên liệu: " + (reason != null && !reason.isBlank() ? reason : "Không có lý do"));
                transactionRepository.save(tx);
            }
            ingredient.setActive(false);
            ingredient.setCurrentStock(BigDecimal.ZERO);
            ingredientRepository.save(ingredient);
        }
    }

    // --- Stock Transactions ---

    @Transactional
    public InventoryTransaction importStock(StockTransactionRequest request) {
        Ingredient ingredient = getIngredientById(request.getIngredientId());
        
        ingredient.setCurrentStock(ingredient.getCurrentStock().add(request.getQuantity()));
        ingredientRepository.save(ingredient);

        InventoryTransaction tx = new InventoryTransaction();
        tx.setIngredientId(request.getIngredientId());
        tx.setTransactionType("IMPORT");
        tx.setQuantity(request.getQuantity());
        tx.setPrice(request.getPrice());
        tx.setReason(request.getReason());
        return transactionRepository.save(tx);
    }

    @Transactional
    public InventoryTransaction exportStock(StockTransactionRequest request) {
        Ingredient ingredient = getIngredientById(request.getIngredientId());

        ingredient.setCurrentStock(ingredient.getCurrentStock().subtract(request.getQuantity()));
        ingredientRepository.save(ingredient);

        InventoryTransaction tx = new InventoryTransaction();
        tx.setIngredientId(request.getIngredientId());
        tx.setTransactionType("EXPORT_WASTE");
        tx.setQuantity(request.getQuantity());
        tx.setPrice(BigDecimal.ZERO);
        tx.setReason(request.getReason());
        return transactionRepository.save(tx);
    }

    public List<InventoryTransaction> getAllTransactions() {
        return transactionRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<InventoryTransaction> getTransactions(LocalDate date, String period, String shift) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        LocalDateTime start;
        LocalDateTime end;

        if ("WEEK".equalsIgnoreCase(period)) {
            LocalDate weekStart = targetDate.with(DayOfWeek.MONDAY);
            start = weekStart.atStartOfDay();
            end = weekStart.plusDays(7).atStartOfDay();
        } else {
            start = targetDate.atStartOfDay();
            end = targetDate.plusDays(1).atStartOfDay();
        }

        List<InventoryTransaction> transactions = transactionRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(start, end);
        if (shift == null || shift.isBlank() || "ALL".equalsIgnoreCase(shift) || "WEEK".equalsIgnoreCase(period)) {
            return transactions;
        }

        return transactions.stream()
                .filter(tx -> shift.equalsIgnoreCase(resolveShift(tx.getCreatedAt())))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getInventorySummary(LocalDate date, String period, String shift) {
        List<InventoryTransaction> transactions = getTransactions(date, period, shift);

        BigDecimal importQuantity = BigDecimal.ZERO;
        BigDecimal exportSaleQuantity = BigDecimal.ZERO;
        BigDecimal exportWasteQuantity = BigDecimal.ZERO;
        BigDecimal importValue = BigDecimal.ZERO;

        for (InventoryTransaction tx : transactions) {
            BigDecimal quantity = tx.getQuantity() != null ? tx.getQuantity() : BigDecimal.ZERO;
            BigDecimal price = tx.getPrice() != null ? tx.getPrice() : BigDecimal.ZERO;
            if ("IMPORT".equalsIgnoreCase(tx.getTransactionType())) {
                importQuantity = importQuantity.add(quantity);
                importValue = importValue.add(quantity.multiply(price));
            } else if ("EXPORT_SALE".equalsIgnoreCase(tx.getTransactionType())) {
                exportSaleQuantity = exportSaleQuantity.add(quantity);
            } else {
                exportWasteQuantity = exportWasteQuantity.add(quantity);
            }
        }

        Map<String, Long> countByType = transactions.stream()
                .collect(Collectors.groupingBy(InventoryTransaction::getTransactionType, Collectors.counting()));

        Map<UUID, Ingredient> ingredientById = ingredientRepository.findAll().stream()
                .collect(Collectors.toMap(Ingredient::getId, ingredient -> ingredient));

        Map<UUID, Map<String, BigDecimal>> summaryByIngredient = new HashMap<>();
        for (InventoryTransaction tx : transactions) {
            UUID ingredientId = tx.getIngredientId();
            BigDecimal quantity = tx.getQuantity() != null ? tx.getQuantity() : BigDecimal.ZERO;
            Map<String, BigDecimal> row = summaryByIngredient.computeIfAbsent(ingredientId, key -> {
                Map<String, BigDecimal> values = new HashMap<>();
                values.put("importQuantity", BigDecimal.ZERO);
                values.put("exportSaleQuantity", BigDecimal.ZERO);
                values.put("exportWasteQuantity", BigDecimal.ZERO);
                return values;
            });

            if ("IMPORT".equalsIgnoreCase(tx.getTransactionType())) {
                row.put("importQuantity", row.get("importQuantity").add(quantity));
            } else if ("EXPORT_SALE".equalsIgnoreCase(tx.getTransactionType())) {
                row.put("exportSaleQuantity", row.get("exportSaleQuantity").add(quantity));
            } else {
                row.put("exportWasteQuantity", row.get("exportWasteQuantity").add(quantity));
            }
        }

        List<Map<String, Object>> items = new ArrayList<>();
        summaryByIngredient.forEach((ingredientId, values) -> {
            Ingredient ingredient = ingredientById.get(ingredientId);
            BigDecimal importQty = values.get("importQuantity");
            BigDecimal exportSaleQty = values.get("exportSaleQuantity");
            BigDecimal exportWasteQty = values.get("exportWasteQuantity");
            items.add(Map.of(
                    "ingredientId", ingredientId,
                    "ingredientName", ingredient != null ? ingredient.getName() : "Nguyên liệu cũ",
                    "unit", ingredient != null ? ingredient.getUnit() : "",
                    "importQuantity", importQty,
                    "exportSaleQuantity", exportSaleQty,
                    "exportWasteQuantity", exportWasteQty,
                    "totalExportQuantity", exportSaleQty.add(exportWasteQty),
                    "netQuantity", importQty.subtract(exportSaleQty).subtract(exportWasteQty),
                    "currentStock", ingredient != null ? ingredient.getCurrentStock() : BigDecimal.ZERO
            ));
        });
        items.sort(Comparator.comparing(item -> String.valueOf(item.get("ingredientName"))));

        return Map.of(
                "totalTransactions", transactions.size(),
                "importQuantity", importQuantity,
                "exportSaleQuantity", exportSaleQuantity,
                "exportWasteQuantity", exportWasteQuantity,
                "totalExportQuantity", exportSaleQuantity.add(exportWasteQuantity),
                "importValue", importValue,
                "countByType", countByType,
                "items", items
        );
    }

    public String resolveShift(LocalDateTime time) {
        if (time == null) return "UNKNOWN";
        LocalTime current = time.toLocalTime();
        if (!current.isBefore(LocalTime.of(6, 0)) && current.isBefore(LocalTime.of(14, 0))) return "MORNING";
        if (!current.isBefore(LocalTime.of(14, 0)) && current.isBefore(LocalTime.of(22, 0))) return "AFTERNOON";
        return "NIGHT";
    }

    // --- Recipes Management ---

    public List<Recipe> getRecipesForMenuItem(UUID menuItemId) {
        return recipeRepository.findByMenuItemId(menuItemId);
    }

    @Transactional
    public List<Recipe> updateRecipeForMenuItem(UUID menuItemId, List<RecipeItemRequest> requests) {
        recipeRepository.deleteByMenuItemId(menuItemId);

        if (requests != null) {
            for (RecipeItemRequest req : requests) {
                Recipe recipe = new Recipe();
                recipe.setMenuItemId(menuItemId);
                recipe.setIngredientId(req.getIngredientId());
                recipe.setQuantityNeeded(req.getQuantityNeeded());
                recipeRepository.save(recipe);
            }
        }
        return recipeRepository.findByMenuItemId(menuItemId);
    }

    // --- Bulk Stock Deduction ---

    @Transactional
    public void deductStockForOrder(DeductStockRequest request) {
        if (request == null || request.getItems() == null) {
            return;
        }

        // Bước 1: gộp tổng nhu cầu theo từng nguyên liệu (chỉ đọc recipe, không cần khoá — recipe
        // không đổi trong lúc đặt món).
        java.util.Map<UUID, BigDecimal> totalRequired = new java.util.HashMap<>();
        for (DeductStockRequest.DeductItem item : request.getItems()) {
            List<Recipe> recipes = recipeRepository.findByMenuItemId(item.getMenuItemId());
            if (recipes == null || recipes.isEmpty()) {
                throw new RuntimeException("Món ăn chưa được thiết lập định lượng nguyên liệu (recipe). Không thể đặt món!");
            }
            BigDecimal quantitySold = BigDecimal.valueOf(item.getQuantity());
            for (Recipe recipe : recipes) {
                BigDecimal needed = recipe.getQuantityNeeded().multiply(quantitySold);
                totalRequired.put(recipe.getIngredientId(), totalRequired.getOrDefault(recipe.getIngredientId(), BigDecimal.ZERO).add(needed));
            }
        }

        // Bước 2: khoá (SELECT ... FOR UPDATE) từng nguyên liệu ĐÚNG 1 LẦN, theo thứ tự UUID tăng dần
        // (tránh deadlock khi 2 đơn hàng cùng lúc cần chung nhiều nguyên liệu nhưng theo thứ tự khác
        // nhau), rồi kiểm tra đủ hàng ngay dưới khoá đó. TRƯỚC ĐÂY bước "kiểm tra" và bước "trừ" tách
        // rời thành 2 vòng lặp không khoá gì cả — 2 request đặt món cùng lúc cho cùng 1 nguyên liệu đều
        // có thể đọc thấy đủ hàng trước khi CẢ HAI cùng trừ, khiến tồn kho âm (oversell). Giữ lại entity
        // đã khoá để dùng lại ở bước 3 (cùng persistence context, không đọc lại nên không mất khoá).
        List<UUID> orderedIngredientIds = new ArrayList<>(totalRequired.keySet());
        orderedIngredientIds.sort(Comparator.naturalOrder());
        Map<UUID, Ingredient> lockedIngredients = new HashMap<>();
        for (UUID ingredientId : orderedIngredientIds) {
            Ingredient ingredient = ingredientRepository.findByIdForUpdate(ingredientId).orElse(null);
            if (ingredient == null || !ingredient.isActive()) {
                throw new RuntimeException("Nguyên liệu không tồn tại hoặc đã ngừng sử dụng!");
            }
            BigDecimal current = ingredient.getCurrentStock() != null ? ingredient.getCurrentStock() : BigDecimal.ZERO;
            BigDecimal required = totalRequired.get(ingredientId);
            if (current.compareTo(required) < 0) {
                throw new RuntimeException("Không đủ " + ingredient.getName() + " (Cần " + required + " " + ingredient.getUnit() + ", tồn kho " + current + " " + ingredient.getUnit() + ")");
            }
            lockedIngredients.put(ingredientId, ingredient);
        }

        // Bước 3: trừ kho thật sự + ghi log giao dịch theo từng (món, nguyên liệu) như cũ — dùng lại
        // đúng entity đã khoá ở bước 2, không gọi findById lại.
        for (DeductStockRequest.DeductItem item : request.getItems()) {
            List<Recipe> recipes = recipeRepository.findByMenuItemId(item.getMenuItemId());
            BigDecimal quantitySold = BigDecimal.valueOf(item.getQuantity());

            for (Recipe recipe : recipes) {
                Ingredient ingredient = lockedIngredients.get(recipe.getIngredientId());
                if (ingredient == null) {
                    continue;
                }

                BigDecimal totalDeducted = recipe.getQuantityNeeded().multiply(quantitySold);

                ingredient.setCurrentStock(ingredient.getCurrentStock().subtract(totalDeducted));
                ingredientRepository.save(ingredient);

                if (ingredient.getCurrentStock().compareTo(ingredient.getMinStock()) <= 0) {
                    sendWarningNotification(ingredient);
                }

                InventoryTransaction tx = new InventoryTransaction();
                tx.setIngredientId(ingredient.getId());
                tx.setTransactionType("EXPORT_SALE");
                tx.setQuantity(totalDeducted);
                tx.setPrice(BigDecimal.ZERO);
                tx.setReason("Xuất bán đơn hàng (Món UUID: " + item.getMenuItemId() + ")");
                transactionRepository.save(tx);
            }
        }
    }

    private void sendWarningNotification(Ingredient ingredient) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                NotificationFeignClient.NotificationRequest payload = new NotificationFeignClient.NotificationRequest(
                        "Cảnh báo sắp hết nguyên liệu",
                        "Nguyên liệu " + ingredient.getName() + " hiện chỉ còn " + ingredient.getCurrentStock() + " " + ingredient.getUnit() + " (Mức tối thiểu: " + ingredient.getMinStock() + ")",
                        "warning",
                        "ALL"
                );
                notificationFeignClient.sendNotification(payload);
            } catch (Exception e) {
            }
        });
    }

    @Transactional
    public void refundStockForOrder(DeductStockRequest request) {
        if (request == null || request.getItems() == null) {
            return;
        }

        for (DeductStockRequest.DeductItem item : request.getItems()) {
            List<Recipe> recipes = recipeRepository.findByMenuItemId(item.getMenuItemId());
            BigDecimal quantityRefunded = BigDecimal.valueOf(item.getQuantity());

            for (Recipe recipe : recipes) {
                // Khoá đúng bản ghi nguyên liệu trước khi cộng lại — tránh lost update khi 2 lượt hoàn
                // kho (vd. huỷ 2 đơn cùng lúc) cùng đọc currentStock cũ rồi ghi đè lên nhau.
                Ingredient ingredient = ingredientRepository.findByIdForUpdate(recipe.getIngredientId()).orElse(null);
                if (ingredient == null) {
                    continue;
                }

                BigDecimal totalRefunded = recipe.getQuantityNeeded().multiply(quantityRefunded);

                ingredient.setCurrentStock(ingredient.getCurrentStock().add(totalRefunded));
                ingredientRepository.save(ingredient);

                InventoryTransaction tx = new InventoryTransaction();
                tx.setIngredientId(ingredient.getId());
                tx.setTransactionType("IMPORT_REFUND");
                tx.setQuantity(totalRefunded);
                tx.setPrice(BigDecimal.ZERO);
                tx.setReason("Hoàn trả kho do hủy món/hủy đơn (Món UUID: " + item.getMenuItemId() + ")");
                transactionRepository.save(tx);
            }
        }
    }
}
