package com.food.order.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.food.order.data.model.KdsSettings

object SessionManager {
    private const val PREFS_NAME = "app_prefs"

    // ⚠️ SECURITY: JWT KHÔNG còn lưu trong PREFS_NAME ở trên (SharedPreferences thường — nội dung
    // là XML dạng plain-text trong /data/data/<pkg>/shared_prefs/, và mặc định còn bị Android
    // auto-backup lên Google Drive nếu allowBackup=true) — token đăng nhập giờ lưu riêng trong
    // SECURE_PREFS_NAME, mã hoá bằng AndroidX Security (EncryptedSharedPreferences). File này cũng
    // được loại trừ tường minh khỏi backup, xem res/xml/data_extraction_rules.xml + backup_rules.xml
    // (path phải khớp CHÍNH XÁC "$SECURE_PREFS_NAME.xml").
    private const val SECURE_PREFS_NAME = "secure_token_prefs"

    private const val KEY_TOKEN  = "token"
    private const val KEY_ROLE   = "role"
    private const val KEY_USER_JSON = "userProfileJson"
    // App Preferences
    private const val KEY_DARK_MODE = "dark_mode"
    private const val KEY_SOUND     = "sound_enabled"
    private const val KEY_LANG      = "lang"

    // KDS (Kitchen Display System) settings — mirror KDS_SETTINGS_DEFAULT bên Web (kitchenUtils.js),
    // lưu local trên từng thiết bị/tablet bếp, KHÔNG đồng bộ server (giống Web dùng localStorage).
    private const val KEY_KDS_WARNING_MIN     = "kds_warning_minutes"
    private const val KEY_KDS_CRITICAL_MIN    = "kds_critical_minutes"
    private const val KEY_KDS_AUTO_START_MIN  = "kds_auto_start_minutes"
    private const val KEY_KDS_AUTO_READY_MIN  = "kds_auto_ready_minutes"
    private const val KEY_KDS_AUTO_PRINT      = "kds_auto_print_on_cooking"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ===== Encrypted store (chỉ dùng cho JWT) =====
    @Volatile private var securePrefsCache: SharedPreferences? = null

    /**
     * SharedPreferences mã hoá (key: AES256_SIV, value: AES256_GCM) dùng riêng cho JWT. Tạo lười +
     * cache theo application context vì việc tạo MasterKey/EncryptedSharedPreferences chạm tới
     * Android Keystore, không cần lặp lại mỗi lần đọc/ghi token.
     */
    private fun securePrefs(ctx: Context): SharedPreferences {
        securePrefsCache?.let { return it }
        synchronized(this) {
            securePrefsCache?.let { return it }
            val appCtx = ctx.applicationContext
            val created = try {
                val masterKey = MasterKey.Builder(appCtx)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    appCtx,
                    SECURE_PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            } catch (e: Exception) {
                // Cực hiếm (Keystore lỗi/không khả dụng trên thiết bị). Không throw để tránh crash
                // toàn app lúc khởi động — fallback về SharedPreferences thường CHO RIÊNG file này
                // (không đụng tới PREFS_NAME), chấp nhận mất lớp mã hoá trong tình huống hiếm này
                // thay vì app không dùng được.
                Log.e("SessionManager", "Không tạo được EncryptedSharedPreferences, fallback plain prefs", e)
                appCtx.getSharedPreferences(SECURE_PREFS_NAME, Context.MODE_PRIVATE)
            }
            securePrefsCache = created
            return created
        }
    }

    /**
     * Di chuyển 1 lần JWT còn sót lại trong PREFS_NAME (lưu bởi bản app cũ, TRƯỚC khi có fix bảo
     * mật này) sang EncryptedSharedPreferences, rồi xoá khỏi file cũ để không còn bản plain-text
     * nào. An toàn để gọi nhiều lần — no-op nếu không còn gì cần di chuyển.
     */
    private fun migrateLegacyTokenIfNeeded(ctx: Context) {
        val legacyPrefs = prefs(ctx)
        val legacyToken = legacyPrefs.getString(KEY_TOKEN, null) ?: return
        securePrefs(ctx).edit().putString(KEY_TOKEN, legacyToken).apply()
        legacyPrefs.edit().remove(KEY_TOKEN).apply()
    }

    // Token
    fun saveToken(ctx: Context, token: String) {
        securePrefs(ctx).edit().putString(KEY_TOKEN, token).apply()
    }
    fun getToken(ctx: Context): String? {
        migrateLegacyTokenIfNeeded(ctx)
        return securePrefs(ctx).getString(KEY_TOKEN, null)
    }
    fun getBearerToken(ctx: Context): String {
        val raw = getToken(ctx).orEmpty().trim()
        if (raw.isEmpty()) return ""
        return if (raw.startsWith("Bearer ", true)) raw else "Bearer $raw"
    }
    /** Xoá riêng token (VD: bắt đăng nhập lại mỗi cold-launch) mà không đụng tới role/preferences khác. */
    fun clearToken(ctx: Context) {
        securePrefs(ctx).edit().remove(KEY_TOKEN).apply()
        prefs(ctx).edit().remove(KEY_TOKEN).apply() // dọn nốt nếu còn sót bản plain-text từ app cũ
    }

    // Role normalize: ADMIN | WAITER | UNKNOWN  (chấp nhận ROLE_ADMIN/ROLE_USER)
    private fun normalizeRole(raw: String?): String {
        val s0 = raw?.trim()?.uppercase().orEmpty()
        val s  = if (s0.startsWith("ROLE_")) s0.removePrefix("ROLE_") else s0
        return when (s) {
            "ADMIN" -> "ADMIN"
            "KITCHEN" -> "KITCHEN"
            "WAITER", "USER", "STAFF", "EMPLOYEE" -> "WAITER"
            else -> "UNKNOWN"
        }
    }
    fun saveRole(ctx: Context, rawRole: String?) {
        prefs(ctx).edit().putString(KEY_ROLE, normalizeRole(rawRole)).apply()
    }
    fun getRole(ctx: Context): String? = prefs(ctx).getString(KEY_ROLE, null)
    fun getRoleOrUnknown(ctx: Context): String = getRole(ctx) ?: "UNKNOWN"

    // ===== App Preferences =====
    // Dark Mode
    fun setDarkMode(ctx: Context, enabled: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_DARK_MODE, enabled).apply()
    fun isDarkMode(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_DARK_MODE, false)

    // Sound Notification
    fun setSoundEnabled(ctx: Context, enabled: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_SOUND, enabled).apply()
    fun isSoundEnabled(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_SOUND, true)

    // Language ("vi" | "en")
    fun setLang(ctx: Context, lang: String) =
        prefs(ctx).edit().putString(KEY_LANG, lang).apply()
    fun getLang(ctx: Context): String = prefs(ctx).getString(KEY_LANG, "vi") ?: "vi"

    // ===== KDS Settings =====
    fun getKdsSettings(ctx: Context): KdsSettings {
        val p = prefs(ctx)
        val d = KdsSettings.DEFAULT
        return KdsSettings(
            warningMinutes = p.getInt(KEY_KDS_WARNING_MIN, d.warningMinutes),
            criticalMinutes = p.getInt(KEY_KDS_CRITICAL_MIN, d.criticalMinutes),
            autoStartMinutes = p.getInt(KEY_KDS_AUTO_START_MIN, d.autoStartMinutes),
            autoReadyMinutes = p.getInt(KEY_KDS_AUTO_READY_MIN, d.autoReadyMinutes),
            autoPrintOnCooking = p.getBoolean(KEY_KDS_AUTO_PRINT, d.autoPrintOnCooking)
        )
    }

    fun saveKdsSettings(ctx: Context, settings: KdsSettings) {
        prefs(ctx).edit()
            .putInt(KEY_KDS_WARNING_MIN, settings.warningMinutes)
            .putInt(KEY_KDS_CRITICAL_MIN, settings.criticalMinutes)
            .putInt(KEY_KDS_AUTO_START_MIN, settings.autoStartMinutes)
            .putInt(KEY_KDS_AUTO_READY_MIN, settings.autoReadyMinutes)
            .putBoolean(KEY_KDS_AUTO_PRINT, settings.autoPrintOnCooking)
            .apply()
    }

    // Clear
    fun clear(ctx: Context) {
        prefs(ctx).edit().remove(KEY_TOKEN).remove(KEY_ROLE).apply()
        securePrefs(ctx).edit().remove(KEY_TOKEN).apply()
    }
    fun clearAll(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_TOKEN)
            .remove(KEY_ROLE)
            .remove(KEY_USER_JSON)
            .apply()
        securePrefs(ctx).edit().remove(KEY_TOKEN).apply()
    }
    fun isLoggedIn(ctx: Context): Boolean = !getToken(ctx).isNullOrBlank()
}
