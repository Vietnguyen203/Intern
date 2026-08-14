package com.food.order.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.food.order.data.RetrofitClient
import com.food.order.databinding.FragmentForgotPasswordBinding
import kotlinx.coroutines.launch

class ForgotPasswordDialogFragment : DialogFragment() {

    private var _binding: FragmentForgotPasswordBinding? = null
    private val binding get() = _binding!!

    // state: 1 = email input, 2 = otp + new password
    private var step = 1
    private var storedUsername = ""
    private var storedEmail = ""

    companion object {
        fun newInstance(): ForgotPasswordDialogFragment {
            return ForgotPasswordDialogFragment()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentForgotPasswordBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        dialog?.window?.setBackgroundDrawableResource(android.R.color.transparent)
        
        // Initial State
        updateUiForStep()

        binding.btnSendOtp.setOnClickListener {
            val employeeId = binding.edtEmployeeId.text?.toString()?.trim()
            val email = binding.edtEmail.text?.toString()?.trim()
            var hasErr = false
            if (employeeId.isNullOrEmpty()) { binding.edtEmployeeId.error = "Required"; hasErr = true }
            if (email.isNullOrEmpty()) { binding.edtEmail.error = "Required"; hasErr = true }
            if (hasErr) return@setOnClickListener
            sendOtp(employeeId!!, email!!)
        }

        binding.btnResetPassword.setOnClickListener {
            val otp = binding.edtOtp.text?.toString()?.trim()
            val newPass = binding.edtNewPassword.text?.toString()?.trim()
            
            var hasErr = false
            if (otp.isNullOrEmpty()) { binding.edtOtp.error = "Required"; hasErr = true }
            if (newPass.isNullOrEmpty() || newPass.length < 6) { binding.edtNewPassword.error = "Min 6 chars"; hasErr = true }
            
            if (hasErr) return@setOnClickListener
            resetPassword(otp!!, newPass!!)
        }

        binding.btnCancel.setOnClickListener { dismiss() }
    }

    private fun updateUiForStep() {
        if (step == 1) {
            binding.tvSubtitle.text = "Enter your Employee ID and email to receive an OTP."
            binding.layoutStep1.visibility = View.VISIBLE
            binding.layoutStep2.visibility = View.GONE
        } else {
            binding.tvSubtitle.text = "Check your email for the 6-digit OTP code."
            binding.layoutStep1.visibility = View.GONE
            binding.layoutStep2.visibility = View.VISIBLE
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnSendOtp.isEnabled = !isLoading
        binding.btnResetPassword.isEnabled = !isLoading
    }

    private fun sendOtp(username: String, email: String) {
        setLoading(true)
        lifecycleScope.launch {
            try {
                val reqBody = mapOf("username" to username, "email" to email)
                val response = RetrofitClient.instance.forgotPassword(reqBody)
                
                if (response.isSuccess) {
                    Toast.makeText(requireContext(), "OTP sent to email", Toast.LENGTH_SHORT).show()
                    storedUsername = username
                    storedEmail = email
                    step = 2
                    updateUiForStep()
                } else {
                    Toast.makeText(requireContext(), response.message ?: "Failed to send OTP", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                setLoading(false)
            }
        }
    }

    private fun resetPassword(otp: String, newPass: String) {
        setLoading(true)
        lifecycleScope.launch {
            try {
                val reqBody = mapOf(
                    "username" to storedUsername,
                    "email" to storedEmail,
                    "otp" to otp,
                    "password" to newPass
                )
                val response = RetrofitClient.instance.resetPassword(reqBody)
                
                if (response.isSuccess) {
                    Toast.makeText(requireContext(), "Password reset successfully", Toast.LENGTH_SHORT).show()
                    dismiss()
                } else {
                    Toast.makeText(requireContext(), response.message ?: "Failed to reset password", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                setLoading(false)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
