package com.vietnl.catalogservice.adapter.apis;

import com.vietnl.catalogservice.application.requests.MenuItemRequest;
import com.vietnl.catalogservice.domain.entities.MenuItem;
import com.vietnl.catalogservice.application.usecases.MenuItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/catalog-service/items")
@RequiredArgsConstructor
public class MenuItemAPI {

    private final MenuItemService menuItemService;

    // GET all items
    @GetMapping
    public ResponseEntity<?> getAll(@RequestParam(defaultValue = "false") boolean includeProposals) {
        List<MenuItem> list = menuItemService.getAll(includeProposals);
        return ResponseEntity.ok(Map.of("code", "200", "data", list));
    }

    // GET items by category
    @GetMapping("/category/{categoryId}")
    public ResponseEntity<?> getByCategoryId(
            @PathVariable String categoryId,
            @RequestParam(defaultValue = "false") boolean includeProposals) {
        List<MenuItem> list = menuItemService.getByCategoryId(categoryId, includeProposals);
        return ResponseEntity.ok(Map.of("code", "200", "data", list));
    }

    // GET item by ID
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("code", "200", "data", menuItemService.getById(id)));
    }

    // POST create item
    @PostMapping
    public ResponseEntity<?> create(@RequestBody MenuItemRequest request) {
        MenuItem created = menuItemService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("code", "201", "message", "Thêm món ăn thành công", "data", created));
    }

    // PUT update item
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody MenuItemRequest request) {
        MenuItem updated = menuItemService.update(id, request);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Cập nhật món ăn thành công", "data", updated));
    }

    // DELETE item
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        menuItemService.delete(id);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Xóa món ăn thành công"));
    }

    // PUT bật/tắt bán món ăn (Admin) — vd: tắt tạm khi nguyên liệu ở mức cảnh báo
    @PutMapping("/{id}/availability")
    public ResponseEntity<?> setAvailability(@PathVariable String id, @RequestBody Map<String, Boolean> request) {
        boolean available = Boolean.TRUE.equals(request.get("available"));
        MenuItem updated = menuItemService.setAvailability(id, available);
        return ResponseEntity.ok(Map.of(
                "code", "200",
                "message", available ? "Đã bật bán món ăn" : "Đã tắt bán món ăn",
                "data", updated
        ));
    }

    // POST propose new item (Kitchen)
    @PostMapping("/propose")
    public ResponseEntity<?> propose(@RequestBody MenuItemRequest request) {
        MenuItem proposed = menuItemService.propose(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("code", "201", "message", "Gửi đề xuất món ăn thành công", "data", proposed));
    }

    // PUT approve item (Admin)
    @PutMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable String id) {
        MenuItem approved = menuItemService.approve(id);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Duyệt món ăn thành công", "data", approved));
    }

    // PUT reject item (Admin)
    @PutMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable String id) {
        MenuItem rejected = menuItemService.reject(id);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Từ chối món ăn thành công", "data", rejected));
    }

    // PUT propose recipe update (Kitchen)
    @PutMapping("/{id}/propose-recipe")
    public ResponseEntity<?> proposeRecipe(@PathVariable String id, @RequestBody Map<String, String> request) {
        String newRecipe = request.get("recipe");
        MenuItem item = menuItemService.proposeRecipe(id, newRecipe);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Gửi đề xuất sửa công thức thành công", "data", item));
    }

    // PUT approve recipe update (Admin)
    @PutMapping("/{id}/approve-recipe")
    public ResponseEntity<?> approveRecipe(@PathVariable String id) {
        MenuItem item = menuItemService.approveRecipe(id);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Duyệt công thức mới thành công", "data", item));
    }

    // PUT reject recipe update (Admin)
    @PutMapping("/{id}/reject-recipe")
    public ResponseEntity<?> rejectRecipe(@PathVariable String id) {
        MenuItem item = menuItemService.rejectRecipe(id);
        return ResponseEntity.ok(Map.of("code", "200", "message", "Từ chối công thức mới thành công", "data", item));
    }

    // POST upload image
    @PostMapping("/upload")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("code", "400", "message", "Vui lòng chọn một ảnh để tải lên."));
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("code", "400", "message", "Chỉ cho phép tải lên tệp hình ảnh."));
        }

        try {
            String uploadDir = System.getProperty("user.dir") + "/uploads/";
            File uploadPath = new File(uploadDir);
            if (!uploadPath.exists()) {
                uploadPath.mkdirs();
            }

            String originalFilename = file.getOriginalFilename();
            String extension = ".jpg";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }

            String filename = UUID.randomUUID().toString() + extension;
            File destFile = new File(uploadDir + filename);
            file.transferTo(destFile);

            String fileUrl = "/catalog-service/uploads/" + filename;

            return ResponseEntity.ok(Map.of("code", "200", "message", "Tải ảnh lên thành công", "url", fileUrl));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("code", "500", "message", "Không thể lưu tệp: " + e.getMessage()));
        }
    }
}
