package com.food.order.ui.staff

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.food.order.R
import com.food.order.data.SessionManager
import com.food.order.data.request.RegisterRequest
// Nếu bạn cần dùng createdBy từ user đang đăng nhập thì mở comment dưới
// import com.food.order.data.AppConstants
import com.food.order.databinding.FragmentCreateStaffBinding
import com.food.order.utils.DateUtils
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class CreateStaffFragment : Fragment() {

    private var _binding: FragmentCreateStaffBinding? = null
    private val binding get() = _binding!!
    private val viewModel: StaffViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCreateStaffBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { loading ->
                    if (loading) binding.loadingView.show() else binding.loadingView.hide()
                }
            }
            launch {
                viewModel.insertFlow.collectLatest { ok ->
                    if (ok) {
                        Toast.makeText(requireContext(), "Create staff successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Create staff failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val sharedPref = requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE)

        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }

        binding.tvBirthdayValue.setOnClickListener {
            val calendar = java.util.Calendar.getInstance()
            android.app.DatePickerDialog(
                requireContext(),
                { _, year, month, dayOfMonth ->
                    val selectedDate = String.format("%02d/%02d/%04d", dayOfMonth, month + 1, year)
                    binding.tvBirthdayValue.text = selectedDate
                },
                calendar.get(java.util.Calendar.YEAR),
                calendar.get(java.util.Calendar.MONTH),
                calendar.get(java.util.Calendar.DAY_OF_MONTH)
            ).show()
        }

        binding.btnCreate.setOnClickListener {
            val username = binding.edtEmployeeId.text.toString().trim()
            val password = binding.edtPassword.text.toString().trim()
            val fullName = binding.edtDisplayName.text.toString().trim()
            val email    = binding.edtEmail.text.toString().trim().ifEmpty { null }
            val phone    = binding.edtPhoneNumber.text.toString().trim().ifEmpty { null }
            val gender   = when (binding.radioGroupGender.checkedRadioButtonId) {
                R.id.rbMale   -> "MALE"
                R.id.rbFemale -> "FEMALE"
                else          -> "MALE"
            }
            val role = when (binding.radioGroupRole.checkedRadioButtonId) {
                R.id.rbAdmin   -> "ADMIN"
                R.id.rbKitchen -> "KITCHEN"
                else           -> "WAITER"
            }
            val birthday = binding.tvBirthdayValue.text.toString().trim().ifEmpty { null }

            if (username.isEmpty()) {
                binding.edtEmployeeId.error = "Please enter employee ID"
                return@setOnClickListener
            }
            if (password.isEmpty()) {
                binding.edtPassword.error = "Please enter password"
                return@setOnClickListener
            }
            if (fullName.isEmpty()) {
                binding.edtDisplayName.error = "Please enter display name"
                return@setOnClickListener
            }

            val token  = SessionManager.getToken(requireContext()) ?: ""
            val server = sharedPref.getString("server_address", "") ?: ""

            val request = RegisterRequest(
                username = username,
                password = password,
                fullName = fullName,
                email    = email,
                phoneNumber = phone,
                gender   = gender,
                role = role,
                server = server,
                birthday = DateUtils.toApiDate(birthday)
            )

            viewModel.createStaff(token, request)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
