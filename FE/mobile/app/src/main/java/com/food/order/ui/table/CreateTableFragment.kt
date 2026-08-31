package com.food.order.ui.table

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.food.order.data.SessionManager
import com.food.order.data.request.TableRequest
import com.food.order.databinding.FragmentCreateTableBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class CreateTableFragment : Fragment() {

    private var _binding: FragmentCreateTableBinding? = null
    private val binding get() = _binding!!
    private val viewModel: TableViewModel by viewModels()

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCreateTableBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { result ->
                    binding.loadingView.isVisible = result
                }
            }
            launch {
                viewModel.errorFlow.collectLatest { result ->
                    Toast.makeText(requireContext(), result, Toast.LENGTH_SHORT).show()
                }
            }
            launch {
                viewModel.insertFlow.collectLatest { result ->
                    if (result) {
                        Toast.makeText(requireContext(), "Create Table success", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Create Table failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.cardViewBack.setOnClickListener {
            findNavController().popBackStack()
        }
        binding.btnCreate.setOnClickListener {
            val name = binding.edtName.text.toString().trim()

            if (userToken.isEmpty()) {
                Toast.makeText(requireContext(), "Please login first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (name.isEmpty()) {
                binding.edtName.error = "Please enter name"
                return@setOnClickListener
            }

            // Tự parse số từ tên: "Table 7" -> 7, "Bàn 3" -> 3, "5" -> 5
            val tableNumber: Int? = name.trim().toIntOrNull()
                ?: Regex("\\d+").find(name)?.value?.toIntOrNull()

            if (tableNumber == null || tableNumber < 1) {
                binding.edtName.error = "Tên phải chứa số bàn (vd: 'Bàn 7' hoặc '7')"
                return@setOnClickListener
            }

            val request = TableRequest(tableNumber = tableNumber)
            viewModel.createTable(userToken, request)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}