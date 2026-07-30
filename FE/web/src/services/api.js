const API_BASE_URL = '/api';

// Helper lấy token từ cả localStorage và sessionStorage
const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

// Token riêng của KHÁCH HÀNG (loyalty-service) — cố tình tách khỏi getToken() ở trên vì đó là JWT
// của NHÂN VIÊN (users-service). 2 loại JWT khác audience, không được dùng lẫn cho nhau.
const getCustomerToken = () => localStorage.getItem('customerToken');

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

// Safe JSON parser - handles empty body
const safeJson = async (response) => {
    const text = await response.text();
    if (!text || text.trim() === '') return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
};

export const apiService = {
    get: async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: getAuthHeaders(),
            cache: 'no-store'
        });
        const data = await safeJson(response);
        if (!response.ok || data.code === 'ERROR') {
            throw new Error(data.message || `API error: ${response.status}`);
        }
        return data;
    },

    post: async (endpoint, payload) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        const data = await safeJson(response);
        if (!response.ok || data.code === 'ERROR') {
            throw new Error(data.message || `API error: ${response.status}`);
        }
        return data;
    },

    put: async (endpoint, payload) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        const data = await safeJson(response);
        if (!response.ok || data.code === 'ERROR') {
            throw new Error(data.message || `API error: ${response.status}`);
        }
        return data;
    },

    delete: async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        const data = await safeJson(response);
        if (!response.ok || data.code === 'ERROR') {
            throw new Error(data.message || `API error: ${response.status}`);
        }
        return data;
    },

    // Specific API calls for cleaner components
    auth: {
        login: (username, password, deviceId) =>
            apiService.post('/users-service/login', { username, password, deviceId }),
        verifyOtp: (username, otp, deviceId, rememberMe) =>
            apiService.post('/users-service/login/verify-otp', { username, otp, deviceId, rememberMe }),
        forgotPassword: (email) =>
            apiService.post('/users-service/forgot-password', { email }),
        resetPassword: (email, otp, newPassword) =>
            apiService.put('/users-service/reset-password', { email, otp, password: newPassword })
    },

    dashboard: {
        // Tables (table-service) — port 8083
        getTables: (status) => apiService.get(status ? `/tables?status=${status}` : '/tables'),
        createTable: (data) => apiService.post('/tables', data),
        updateTable: (id, data) => apiService.put(`/tables/${id}`, data),
        updateTableStatus: (id, status) => apiService.patch(`/tables/${id}/status`, { status }),
        assignTableOrder: (id, orderId) => apiService.post(`/tables/${id}/assign-order`, { orderId }),
        deleteTable: (id) => apiService.delete(`/tables/${id}`),

        getRecentOrders: () => apiService.get('/orders?page=0&size=5'),
        getRevenue: () => apiService.get('/orders/revenue-by-week'),
        getAllOrders: (page = 0, size = 50) => apiService.get(`/orders?page=${page}&size=${size}`),

        getFoods: () => apiService.get('/foods/list'),
        createFood: (foodData) => apiService.post('/foods/create', foodData),
        updateFood: (id, foodData) => apiService.put(`/foods/${id}`, foodData),
        deleteFood: (id) => apiService.delete(`/foods/${id}`),

        // Staff (users-service) — base path: /users-service/request
        getStaff: () => apiService.get('/users-service'),
        createStaff: (staffData) => apiService.post('/users-service', staffData),
        updateStaff: (server, uid, staffData) => apiService.put(`/users-service/${uid}`, staffData),
        deleteStaff: (server, uid) => apiService.delete(`/users-service/${uid}`),
    },

    // ===== KITCHEN (dùng order-service port 8082) =====
    kitchen: {
        // Lấy tất cả đơn PENDING / CONFIRMED / ORDERING để bếp xử lý.
        // Lưu ý: ORDERING là trạng thái đơn khi bàn đang ăn và có thể gọi thêm món — PHẢI tính vào đây,
        // nếu không món gọi thêm ở bàn đang ORDERING sẽ tính tiền bình thường nhưng bếp không thấy (bug đã gặp).
        getPendingOrders: () => orderFetch('GET', '/orders?status=PENDING'),
        getConfirmedOrders: () => orderFetch('GET', '/orders?status=CONFIRMED'),
        getOrderingOrders: () => orderFetch('GET', '/orders?status=ORDERING'),

        // Cập nhật trạng thái chế biến của 1 món
        // status: PENDING | COOKING | READY | SERVED
        updateItemStatus: (itemId, status) =>
            orderFetch('PATCH', `/orders/items/${itemId}/kitchen-status?status=${status}`),
    },

    // ===== CATALOG SERVICE (port 8081 via /catalog proxy) =====
    catalog: {
        // Categories
        getCategories: () => catalogFetch('GET', '/catalog-service/categories'),
        createCategory: (data) => catalogFetch('POST', '/catalog-service/categories', data),
        updateCategory: (id, data) => catalogFetch('PUT', `/catalog-service/categories/${id}`, data),
        deleteCategory: (id) => catalogFetch('DELETE', `/catalog-service/categories/${id}`),

        // Menu Items
        getItems: () => catalogFetch('GET', '/catalog-service/items'),
        getItemsByCategory: (categoryId) => catalogFetch('GET', `/catalog-service/items/category/${categoryId}`),
        createItem: (data) => catalogFetch('POST', '/catalog-service/items', data),
        updateItem: (id, data) => catalogFetch('PUT', `/catalog-service/items/${id}`, data),
        deleteItem: (id) => catalogFetch('DELETE', `/catalog-service/items/${id}`),
        proposeItem: (data) => catalogFetch('POST', '/catalog-service/items/propose', data),
        approveItem: (id) => catalogFetch('PUT', `/catalog-service/items/${id}/approve`),
        rejectItem: (id) => catalogFetch('PUT', `/catalog-service/items/${id}/reject`),
        proposeRecipe: (id, recipe) => catalogFetch('PUT', `/catalog-service/items/${id}/propose-recipe`, { recipe }),
        approveRecipe: (id) => catalogFetch('PUT', `/catalog-service/items/${id}/approve-recipe`),
        rejectRecipe: (id) => catalogFetch('PUT', `/catalog-service/items/${id}/reject-recipe`),
        uploadImage: async (file) => {
            const token = getToken();
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`/catalog/catalog-service/items/upload`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData // browser sets correct content-type
            });
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};
            if (!response.ok) throw new Error(data.message || `Upload error: ${response.status}`);
            return data;
        },

        // Inventory Management
        getIngredients: () => catalogFetch('GET', '/catalog-service/inventory/ingredients'),
        createIngredient: (data) => catalogFetch('POST', '/catalog-service/inventory/ingredients', data),
        updateIngredient: (id, data) => catalogFetch('PUT', `/catalog-service/inventory/ingredients/${id}`, data),
        deleteIngredient: (id, reason) => catalogFetch('DELETE', `/catalog-service/inventory/ingredients/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`),
        importStock: (data) => catalogFetch('POST', '/catalog-service/inventory/transactions/import', data),
        exportStock: (data) => catalogFetch('POST', '/catalog-service/inventory/transactions/export', data),
        getTransactions: () => catalogFetch('GET', '/catalog-service/inventory/transactions'),
        getRecipes: (menuItemId) => catalogFetch('GET', `/catalog-service/inventory/recipes/${menuItemId}`),
        updateRecipes: (menuItemId, data) => catalogFetch('POST', `/catalog-service/inventory/recipes/${menuItemId}`, data),
    },

    // ===== ORDER SERVICE (port 8082 via /order proxy) =====
    order: {
        // Lấy tất cả đơn / lọc theo status
        getAll: (status) => orderFetch('GET', `/orders${status ? `?status=${status}` : ''}`),
        getById: (id) => orderFetch('GET', `/orders/${id}`),
        getReports: (type) => orderFetch('GET', `/reports?type=${type}`),
        getComparisonReport: (date, shift, period) =>
            orderFetch('GET', `/reports/comparison?date=${date || ''}&shift=${shift || ''}&period=${period || ''}`),

        // Tạo đơn hàng mới
        create: (data) => orderFetch('POST', '/orders', data),
        createPublic: (data) => orderFetch('POST', '/orders/public', data),

        // Thêm / sửa / xóa món trong đơn
        addItem: (orderId, item) => orderFetch('POST', `/orders/${orderId}/items`, item),
        updateItem: (orderId, itemId, data) => orderFetch('PUT', `/orders/${orderId}/items/${itemId}`, data),
        removeItem: (orderId, itemId) => orderFetch('DELETE', `/orders/${orderId}/items/${itemId}`),

        // Đổi trạng thái đơn: PENDING | CONFIRMED | COMPLETED | CANCELLED
        updateStatus: (orderId, status) => orderFetch('PATCH', `/orders/${orderId}/status?status=${status}`),

        // Hủy đơn
        cancel: (orderId) => orderFetch('DELETE', `/orders/${orderId}`),

        // Bếp cập nhật trạng thái chế biến: PENDING | COOKING | READY | SERVED
        updateKitchenStatus: (itemId, status) =>
            orderFetch('PATCH', `/orders/items/${itemId}/kitchen-status?status=${status}`),
    },

    // ===== PAYMENT SERVICE (port 8085 via /payment proxy) =====
    payment: {
        // Tạo yêu cầu thanh toán (PENDING)
        create: (data) => paymentFetch('POST', '/api/payments', data),
        
        // Xác nhận đã thu tiền thành công (PATCH -> COMPLETED)
        complete: (orderId, transactionCode) => 
            paymentFetch('PATCH', `/api/payments/order/${orderId}/complete?transactionCode=${transactionCode || ''}`),
            
        // Lấy lịch sử thanh toán của đơn hàng
        getByOrderId: (orderId) => paymentFetch('GET', `/api/payments/order/${orderId}`),
    },

    // ===== LOYALTY SERVICE (proxy /loyalty) — tài khoản khách hàng + tích điểm/hạng thành viên =====
    // Backend service này đang trong giai đoạn triển khai (xem Ke-hoach-Loyalty-Service.md) — các hàm
    // dưới đây đã theo đúng contract đã chốt, sẵn sàng chạy thật ngay khi loyalty-service lên route ở gateway.
    loyalty: {
        // --- Khách hàng tự quản lý tài khoản (auth: customer token) ---
        register: (data) => loyaltyFetch('POST', '/customers/register', data, 'none'),
        login: (data) => loyaltyFetch('POST', '/customers/login', data, 'none'),
        me: () => loyaltyFetch('GET', '/customers/me', undefined, 'customer'),
        pointsHistory: () => loyaltyFetch('GET', '/customers/me/points-history', undefined, 'customer'),
        redeemReward: (rewardId) => loyaltyFetch('POST', `/rewards/${rewardId}/redeem`, undefined, 'customer'),

        // --- Danh mục công khai, không cần đăng nhập ---
        getTiers: () => loyaltyFetch('GET', '/tiers', undefined, 'none'),
        getRewards: () => loyaltyFetch('GET', '/rewards', undefined, 'none'),

        // --- Nhân viên dùng lúc checkout (auth: staff token, không phải customer token) ---
        validateVoucher: (code) => loyaltyFetch('POST', `/vouchers/${code}/validate`, undefined, 'staff'),
        useVoucher: (code, orderId) => loyaltyFetch('POST', `/vouchers/${code}/use`, { orderId }, 'staff'),
    }
};

// Helper riêng cho payment-service (proxy /payment → port 8085)
async function paymentFetch(method, path, body) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(`/payment${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.message || `Payment API error: ${response.status}`);
    return data;
}

// Helper riêng cho catalog-service (proxy /catalog → port 8081)
async function catalogFetch(method, path, body) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(`/catalog${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.message || `Catalog API error: ${response.status}`);
    return data;
}

// Helper riêng cho order-service (proxy /order → port 8082)
async function orderFetch(method, path, body) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(`/order${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.message || `Order API error: ${response.status}`);
    return data;
}

// Helper riêng cho loyalty-service (proxy /loyalty → port của loyalty-service khi lên gateway).
// authMode: 'customer' = gắn JWT khách hàng | 'staff' = gắn JWT nhân viên | 'none' = không gắn token
// (dùng cho register/login — lúc đó chưa có token nào — và các danh mục công khai như tiers/rewards).
async function loyaltyFetch(method, path, body, authMode = 'customer') {
    const token = authMode === 'customer' ? getCustomerToken() : authMode === 'staff' ? getToken() : null;
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(`/loyalty${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.message || `Loyalty API error: ${response.status}`);
    return data;
}
