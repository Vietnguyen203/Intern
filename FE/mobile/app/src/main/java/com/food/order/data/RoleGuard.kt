package com.food.order.data

import android.content.Context
import androidx.annotation.StringRes
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.food.order.R
import com.google.android.material.dialog.MaterialAlertDialogBuilder

object RoleGuard {

    // ⚠️ AppConstants.userModel là `lateinit var` — phải checkExistsUser() trước khi đọc, `?.`
    // không bảo vệ được lateinit (vẫn ném UninitializedPropertyAccessException).
    fun currentRole(): Role =
        Role.from(if (AppConstants.checkExistsUser()) AppConstants.userModel.role else null)

    fun hasAny(vararg allowed: Role): Boolean {
        val me = currentRole()
        return allowed.any { it == me }
    }

    /**
     * Gọi ở đầu mỗi Fragment cần bảo vệ (onViewCreated hoặc onResume).
     * Nếu không có quyền: hiện dialog và điều hướng quay lại.
     */
    fun requireAnyRole(
        fragment: Fragment,
        vararg allowed: Role,
        @StringRes message: Int = R.string.permission_denied
    ): Boolean {
        if (hasAny(*allowed)) return true

        MaterialAlertDialogBuilder(fragment.requireContext())
            .setTitle(R.string.permission_title)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                fragment.findNavController().navigateUp()
            }
            .setCancelable(false)
            .show()
        return false
    }

    /** Nhãn role hiện tại, fallback "UNKNOWN" */
    fun roleLabel(ctx: Context): String =
        if (AppConstants.checkExistsUser()) AppConstants.userModel.role else "UNKNOWN"

    /** Helper nhanh: chỉ ADMIN */
    fun requireAdmin(fragment: Fragment): Boolean =
        requireAnyRole(fragment, Role.ADMIN, message = R.string.admin_only)

    /** Helper nhanh: ADMIN hoặc WAITER */
    fun requireStaff(fragment: Fragment): Boolean =
        requireAnyRole(fragment, Role.ADMIN, Role.WAITER)
}
