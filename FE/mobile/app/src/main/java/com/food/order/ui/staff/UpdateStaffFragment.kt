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
import com.food.order.data.request.UpdateStaffRequest
import com.food.order.databinding.FragmentUpdateStaffBinding
import com.food.order.utils.DateUtils
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UpdateStaffFragment : Fragment() {

    private var _binding: FragmentUpdateStaffBinding? = null
    private val binding get() = _binding!!
    private val viewModel: StaffViewModel by viewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentUpdateStaffBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { loading ->
                    if (loading) binding.loadingView.show() else binding.loadingView.hide()
                }
            }
            launch {
                viewModel.updateFlow.collectLatest { ok ->
                    if (ok) {
                        Toast.makeText(requireContext(), "Update staff successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Update staff failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            launch {
                viewModel.deleteFlow.collectLatest { ok ->
                    if (ok) {
                        Toast.makeText(requireContext(), "Delete staff successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Delete staff failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            launch {
                viewModel.staffFlow.collectLatest { it ->
                    it?.let { staff ->
                        val name = staff.displayName ?: staff.employeeId ?: ""
                        binding.edtEmployeeId.setText(staff.employeeId)
                        binding.edtPassword.setText(staff.employeeId)
                        binding.edtDisplayName.setText(name)
                        binding.edtEmail.setText(staff.email ?: "")
                        binding.edtPhoneNumber.setText(staff.phoneNumber ?: "")
                        when (staff.gender) {
                            "FEMALE" -> binding.rbFemale.isChecked = true
                            "MALE"   -> binding.rbMale.isChecked   = true
                            else     -> { /* Can be OTHER if we add it to RadioGroup */ }
                        }
                        when (staff.role) {
                            "WAITER"  -> binding.rbWaiter.isChecked  = true
                            "KITCHEN" -> binding.rbKitchen.isChecked = true
                            else      -> binding.rbAdmin.isChecked   = true
                        }
                        binding.tvBirthdayValue.text = DateUtils.formatBirthday(staff.birthday)
                    }
                }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val sharedPref = requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE)

        binding.cardViewBack.setOnClickListener {
            findNavController().popBackStack()
        }

            binding.tvBirthdayValue.setOnClickListener {
                val calendar = java.util.Calendar.getInstance()
                // Parse existing date if any
                val current = binding.tvBirthdayValue.text.toString()
                if (current.isNotEmpty() && current != "N/A") {
                    try {
                        // Support both yyyy-MM-dd and dd/MM/yyyy for parsing flexibility
                        if (current.contains("-")) {
                            val parts = current.split("-")
                            calendar.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
                        } else if (current.contains("/")) {
                            val parts = current.split("/")
                            calendar.set(parts[2].toInt(), parts[1].toInt() - 1, parts[0].toInt())
                        }
                    } catch (e: Exception) {}
                }

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

        binding.btnUpdate.setOnClickListener {
            val employeeId  = binding.edtEmployeeId.text.toString().trim()
            val password    = binding.edtPassword.text.toString().trim().ifEmpty { null }
            val displayName = binding.edtDisplayName.text.toString().trim()
            val email       = binding.edtEmail.text.toString().trim().ifEmpty { null }
            val phone       = binding.edtPhoneNumber.text.toString().trim().ifEmpty { null }
            val gender      = when (binding.radioGroupGender.checkedRadioButtonId) {
                R.id.rbMale   -> "MALE"
                R.id.rbFemale -> "FEMALE"
                else          -> "MALE"
            }
            val role = when {
                binding.rbWaiter.isChecked  -> "WAITER"
                binding.rbKitchen.isChecked -> "KITCHEN"
                else                        -> "ADMIN"
            }
            val birthday = binding.tvBirthdayValue.text.toString().trim().ifEmpty { null }

            if (displayName.isEmpty()) {
                binding.edtDisplayName.error = "Display name is required"
                return@setOnClickListener
            }

            val request = UpdateStaffRequest(
                fullName = displayName,
                role = role,
                password = password,
                email = email,
                phoneNumber = phone,
                gender = gender,
                birthday = DateUtils.toApiDate(birthday)
            )

            viewModel.updateStaff(
                SessionManager.getToken(requireContext()) ?: "",
                sharedPref.getString("server_address", "") ?: "",
                employeeId,
                request
            )
        }

        binding.btnRemove.setOnClickListener {
            val employeeId = binding.edtEmployeeId.text.toString().trim()
            viewModel.deleteStaff(
                SessionManager.getToken(requireContext()) ?: "",
                sharedPref.getString("server_address", "") ?: "",
                employeeId
            )
        }

        viewModel.setArgument(arguments)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
