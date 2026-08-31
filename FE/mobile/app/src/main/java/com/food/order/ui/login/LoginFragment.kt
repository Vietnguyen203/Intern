package com.food.order.ui.login

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavDeepLinkRequest
import androidx.navigation.NavOptions
import androidx.navigation.fragment.findNavController
import com.food.order.R
import com.food.order.data.AppConstants
import com.food.order.data.RetrofitClient
import com.food.order.data.SessionManager
import com.food.order.data.request.LoginRequest
import com.food.order.databinding.FragmentLoginBinding
import com.food.order.ui.auth.RegisterDialogFragment
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    // nhớ lại server (ở đây dùng cứng "server-1"; nếu có EditText server thì đọc từ đó)
    private var lastServerUsed: String = "server-1"

    // LoginViewModel là AndroidViewModel → cần factory
    private val viewModel: LoginViewModel by viewModels {
        ViewModelProvider.AndroidViewModelFactory.getInstance(requireActivity().application)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Mở dialog đăng ký (nếu layout có tvRegister)
        binding.root.findViewById<View?>(R.id.tvRegister)?.setOnClickListener {
            RegisterDialogFragment.newInstance()
                .show(parentFragmentManager, "register_dialog")
        }

        // Mở dialog Quên mật khẩu
        binding.root.findViewById<View?>(R.id.tvForgotPassword)?.setOnClickListener {
            com.food.order.ui.auth.ForgotPasswordDialogFragment.newInstance()
                .show(parentFragmentManager, "forgot_password_dialog")
        }

        // Submit bằng nút "Done" trên bàn phím ở ô password
        binding.edtPassword.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                submitLogin(); true
            } else false
        }

        // Nút Back
        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }

        // Nút Login
        binding.btnLogin.setOnClickListener { submitLogin() }

        // Collect flows
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {

                // Loading
                launch {
                    viewModel.loadingFlow.collectLatest { loading ->
                        if (loading) binding.loadingView.show() else binding.loadingView.hide()
                        binding.btnLogin.isEnabled = !loading
                    }
                }

                // Error
                launch {
                    viewModel.errorFlow.collectLatest { error ->
                        if (error.isNotBlank()) {
                            binding.edtEmployeeId.error = error
                            Toast.makeText(requireContext(), error, Toast.LENGTH_SHORT).show()
                        }
                    }
                }

                // Token → lưu cho các API khác dùng Bearer
                launch {
                    viewModel.tokenFlow.collectLatest { tokenResp ->
                        val raw = tokenResp.token.orEmpty()
                        if (raw.isNotBlank()) {
                            SessionManager.saveToken(requireContext(), raw)
                        } else {
                            Toast.makeText(requireContext(), "Login failed: empty token", Toast.LENGTH_SHORT).show()
                        }
                    }
                }

                // User info → lưu ROLE (để SessionManager tự chuẩn hoá) + cập nhật RAM + điều hướng
                launch {
                    viewModel.userFlow.collectLatest { user ->
                        // 1) Lưu role THÔ, SessionManager sẽ tự chuẩn hoá (ADMIN/WAITER/UNKNOWN, chấp nhận ROLE_*)
                        SessionManager.saveRole(requireContext(), user.role)

                        // 2) Lưu server đã dùng (nếu cần các màn BE khác)
                        RetrofitClient.setXServer(requireContext(), lastServerUsed)

                        // 3) Cập nhật RAM & gán lại role đã chuẩn hoá để UI phản ánh ngay
                        val normalizedRole = SessionManager.getRoleOrUnknown(requireContext())
                        AppConstants.userModel = user
                        try { AppConstants.userModel.role = normalizedRole } catch (_: Throwable) {}

                        // 3.5) Đăng ký FCM token lên backend NGAY SAU KHI đăng nhập thành công — lúc
                        // này SessionManager mới thực sự có token hợp lệ. MainActivity.onCreate() chỉ
                        // xin quyền POST_NOTIFICATIONS chứ không đăng ký (xem MainActivity), nếu không
                        // gọi lại ở đây thiết bị sẽ không bao giờ nhận được push notification.
                        (activity as? com.food.order.MainActivity)?.registerFcmToken()

                        // (tuỳ chọn) Thông báo nhỏ để kiểm tra nhanh
                        // Toast.makeText(requireContext(), "Signed in as $normalizedRole", Toast.LENGTH_SHORT).show()

                        // 4) Điều hướng về Dashboard hoặc Kitchen & xoá back stack
                        val navOptions = NavOptions.Builder()
                            .setPopUpTo(R.id.mobile_navigation, true)
                            .build()
                        
                        val destinationUri = if (normalizedRole == "KITCHEN") "fo://kitchen" else "fo://dashboard"
                        
                        val request = NavDeepLinkRequest.Builder
                            .fromUri(Uri.parse(destinationUri))
                            .build()
                        findNavController().navigate(request, navOptions)
                    }
                }
            }
        }
    }

    private fun submitLogin() {
        val employeeId = binding.edtEmployeeId.text?.toString()?.trim().orEmpty()
        val password   = binding.edtPassword.text?.toString()?.trim().orEmpty()
        val server     = "server-1" // TODO: nếu có EditText server, đọc từ đó
        lastServerUsed = server

        var hasError = false
        if (employeeId.isEmpty()) { binding.edtEmployeeId.error = getString(R.string.err_required); hasError = true }
        if (password.isEmpty())   { binding.edtPassword.error   = getString(R.string.err_required); hasError = true }
        if (hasError) return

        viewModel.login(LoginRequest(username = employeeId, employeeId = employeeId, password = password, server = server))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
