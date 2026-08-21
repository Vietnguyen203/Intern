package com.food.order.data

import android.content.Context
import android.content.SharedPreferences
import com.food.order.data.model.KdsSettings

object SessionManager {
    private const val PREFS_NAME = "app_prefs"
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

    // Token
    fun saveToken(ctx: Context, token: String) {
        prefs(ctx).edit().putString(KEY_TOKEN, token).apply()
    }
    fun getToken(ctx: Context): String? = prefs(ctx).getString(KEY_TOKEN, null)
    fun getBearerToken(ctx: Context): String {
        val raw = getToken(ctx).orEmpty().trim()
        if (raw.isEmpty()) return ""
        return if (raw.startsWith("Bearer ", true)) raw else "Bearer $raw"
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
    }
    fun clearAll(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_TOKEN)
            .remove(KEY_ROLE)
            .remove(KEY_USER_JSON)
            .apply()
    }
    fun isLoggedIn(ctx: Context): Boolean = !getToken(ctx).isNullOrBlank()
}
