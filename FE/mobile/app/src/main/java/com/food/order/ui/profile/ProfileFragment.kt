package com.food.order.ui.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.food.order.R
import com.food.order.data.AppConstants
import com.food.order.databinding.FragmentProfileBinding
import com.food.order.utils.DateUtils

/**
 * Màn Hồ sơ cá nhân — mirror đúng tab Profile bên Web: chỉ đọc dữ liệu từ AppConstants.userModel
 * (được LoginViewModel.userFromToken() giải mã sẵn từ JWT lúc đăng nhập, xem LoginFragment), KHÔNG
 * gọi thêm API nào. Vì JWT hiện chỉ mang theo "sub"/"uid", "fullName" và "role" (xem
 * UserService.login/verifyLoginOtp bên BE), các trường còn lại (birthday, email, phoneNumber,
 * gender, createdAt) có thể null nếu server chưa đưa vào claim — hiển thị "N/A" cho các trường đó,
 * không coi là lỗi.
 */
class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        if (AppConstants.checkExistsUser()) {
            bindUser()
        } else {
            // Chưa có thông tin user trong RAM (VD: Activity bị hệ thống kill rồi khôi phục) — quay
            // lại màn trước thay vì crash vì AppConstants.userModel là lateinit, truy cập sẽ throw.
            findNavController().popBackStack()
            return
        }

        binding.cardBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.cardLogout.setOnClickListener {
            runCatching { findNavController().navigate(R.id.navigation_logout_dialog) }
        }
    }

    private fun bindUser() {
        val u = AppConstants.userModel

        val initial = u.displayName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
        binding.tvAvatarInitial.text = initial
        binding.tvDisplayName.text = u.displayName
        binding.tvRoleBadge.text = u.role

        binding.tvEmployeeId.text = u.employeeId
        binding.tvFullName.text = u.displayName
        binding.tvRole.text = u.role
        binding.tvBirthday.text = DateUtils.formatBirthday(u.birthday)
        binding.tvEmail.text = u.email?.takeIf { it.isNotBlank() } ?: "N/A"
        binding.tvPhone.text = u.phoneNumber?.takeIf { it.isNotBlank() } ?: "N/A"
        binding.tvGender.text = u.gender?.takeIf { it.isNotBlank() } ?: "N/A"
        binding.tvCreatedAt.text = u.createdAt?.takeIf { it.isNotBlank() } ?: "N/A"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
