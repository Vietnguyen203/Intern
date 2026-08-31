package com.food.order.data

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

// ✅ NEW imports cho Gson
import com.google.gson.FieldNamingPolicy
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.food.order.BuildConfig

object RetrofitClient {

    // BASE URL mặc định cho emulator (host máy): 10.0.2.2
    private const val DEFAULT_BASE_URL = "http://10.0.2.2:8080/"

    private const val PREFS = "app_prefs"
    private const val KEY_BASE_URL = "server_address"   // chỗ từng bị lưu nhầm "server-1"
    private const val KEY_X_SERVER = "x_server"
    private const val DEFAULT_X_SERVER = "server-1"

    private lateinit var appContext: Context
    @Volatile private var _api: ApiService? = null

    /** Dùng để ghép ảnh: FILE_BASE_URL + "/uploads/..." */
    @JvmStatic
    var FILE_BASE_URL: String = DEFAULT_BASE_URL.removeSuffix("/")

    /* ---------------- public API ---------------- */

    @JvmStatic
    fun init(context: Context) { appContext = context.applicationContext }

    /** Sửa prefs cũ nếu lỡ lưu "server-1" vào BASE_URL; gọi trước rebuild trong Application.onCreate */
    @JvmStatic
    fun sanitizeSavedServerConfig(ctx: Context) {
        val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = sp.getString(KEY_BASE_URL, null) ?: return
        if (saved.contains("/foodordersystem/api", ignoreCase = true)) {
            sp.edit().putString(KEY_BASE_URL, DEFAULT_BASE_URL).apply()
            return
        }
        val (baseCandidate, xServerMaybe) = splitUrlOrServerName(saved)
        if (xServerMaybe != null) {
            // Di chuyển "server-1" về X-Server và reset BASE_URL về default
            setXServer(ctx, xServerMaybe)
            sp.edit().putString(KEY_BASE_URL, DEFAULT_BASE_URL).apply()
        } else {
            // Nếu baseCandidate vẫn không hợp lệ → reset về default
            val normalized = normalizeBaseUrl(baseCandidate)
            val ok = isValidBaseUrl(normalized)
            if (!ok) sp.edit().putString(KEY_BASE_URL, DEFAULT_BASE_URL).apply()
        }
    }

    @JvmStatic
    fun currentBaseUrl(ctx: Context? = null): String {
        val c = ctx ?: if (this::appContext.isInitialized) appContext else null
        val sp = c?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = sp?.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        return ensureSlash(saved)
    }

    @JvmStatic
    fun currentXServer(ctx: Context? = null): String {
        val c = ctx ?: if (this::appContext.isInitialized) appContext else null
        val sp = c?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return sp?.getString(KEY_X_SERVER, DEFAULT_X_SERVER) ?: DEFAULT_X_SERVER
    }

    @JvmStatic
    fun setXServer(ctx: Context, value: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_X_SERVER, value).apply()
    }

    /** Rebuild Retrofit; nếu override là “server-1” → coi đó là X-Server, không dùng làm host */
    @JvmStatic
    fun rebuild(ctx: Context, overrideBaseUrl: String? = null) {
        val app = ctx.applicationContext
        val sp  = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        val requestedRaw = overrideBaseUrl?.takeIf { it.isNotBlank() }
            ?: sp.getString(KEY_BASE_URL, DEFAULT_BASE_URL)
            ?: DEFAULT_BASE_URL

        val (baseCandidate, xServerMaybe) = splitUrlOrServerName(requestedRaw)
        if (xServerMaybe != null) setXServer(app, xServerMaybe)

        val normalized = normalizeBaseUrl(baseCandidate)
        val base = if (isValidBaseUrl(normalized)) normalized else DEFAULT_BASE_URL
        sp.edit().putString(KEY_BASE_URL, base).apply()
        FILE_BASE_URL = base.removeSuffix("/")

        // ⚠️ SECURITY: chỉ log full body (có thể chứa password/JWT) ở bản debug; bản release
        // KHÔNG log body để tránh lộ dữ liệu nhạy cảm qua Logcat.
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
            redactHeader("Authorization")
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(TokenInterceptor())
            .addInterceptor { chain ->
                val req = chain.request().newBuilder()
                    .header("X-Server", currentXServer(app))
                    .build()
                chain.proceed(req)
            }
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        // ✅ Dùng Gson map snake_case <-> camelCase
        val gson: Gson = GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
            .serializeNulls()
            .setLenient()
            .create()

        val retrofit = Retrofit.Builder()
            .baseUrl(base) // luôn hợp lệ
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson)) // ✅ dùng gson
            .build()

        _api = retrofit.create(ApiService::class.java)
    }

    @JvmStatic
    val instance: ApiService
        get() = synchronized(this) {
            if (_api == null) {
                check(::appContext.isInitialized) { "RetrofitClient.init() must be called first" }
                rebuild(appContext)
            }
            _api!!
        }

    /* ---------------- helpers ---------------- */

    // Tách input: nếu nhập "server-1" → (DEFAULT_BASE_URL, "server-1"), ngược lại (input, null)
    private fun splitUrlOrServerName(input: String): Pair<String, String?> {
        var s = input.trim()
        if (s.isBlank()) return DEFAULT_BASE_URL to null

        // chỉ chữ/số/_- → coi là x-server token
        if (s.matches(Regex("^[A-Za-z0-9_-]+$"))) {
            return DEFAULT_BASE_URL to s
        }

        // thêm http:// tạm để lấy host
        val tmp = if (s.startsWith("http", true)) s else "http://$s"
        val host = tmp.removePrefix("http://")
            .removePrefix("https://")
            .substringBefore("/").substringBefore("?").substringBefore("#")

        val ipv4 = Regex("""\d{1,3}(\.\d{1,3}){3}""")
        val looksLikeToken = !ipv4.matches(host) && host != "localhost"
                && !host.contains(".") && !host.contains(":")

        return if (looksLikeToken) DEFAULT_BASE_URL to host else s to null
    }

    private fun normalizeBaseUrl(raw: String?): String {
        var s = (raw ?: "").trim()
        if (s.isBlank()) return DEFAULT_BASE_URL
        if (!s.startsWith("http://", true) && !s.startsWith("https://", true)) s = "http://$s"
        s = s.replace("\\", "/")
        s = s.replace(Regex("(?<!:)/{2,}"), "/")
        if (!s.endsWith("/")) s += "/"
        return s
    }

    private fun isValidBaseUrl(url: String): Boolean {
        return try {
            // Retrofit/OkHttp validate; build thử để check hợp lệ
            Retrofit.Builder().baseUrl(url)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
            true
        } catch (_: IllegalArgumentException) { false }
    }

    private fun ensureSlash(u: String) = if (u.endsWith("/")) u else "$u/"
}
