package com.food.order.ui.table

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.food.order.data.SessionManager
import com.food.order.data.request.TableRequest
import com.food.order.databinding.FragmentUpdateTableBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UpdateTableFragment : Fragment() {

    private var _binding: FragmentUpdateTableBinding? = null
    private val binding get() = _binding!!

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }
    private val viewModel: TableViewModel by viewModels()

    @SuppressLint("SetTextI18n")
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentUpdateTableBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { result ->
                    if (result) {
                        binding.loadingView.show()
                    } else {
                        binding.loadingView.hide()
                    }
                }
            }
            launch {
                viewModel.updateFlow.collectLatest { result ->
                    if (result) {
                        Toast.makeText(requireContext(), "Update table successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Update table failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            launch {
                viewModel.deleteFlow.collectLatest { result ->
                    if (result) {
                        Toast.makeText(requireContext(), "Delete table successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Delete table failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            launch {
                viewModel.tableFlow.collectLatest { result ->
                    result?.let {
                        binding.edtName.setText(it.name)
                    }
                }
            }
        }
        return binding.root
    }

    @SuppressLint("IntentReset")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.setArgument(arguments)

        binding.cardViewBack.setOnClickListener {
            findNavController().popBackStack()
        }
        binding.btnUpdate.setOnClickListener {
            val name = binding.edtName.text.toString().trim()
            if (userToken.isEmpty()) {
                Toast.makeText(requireContext(), "Please login first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (name.isEmpty()) {
                binding.edtName.error = "Please enter name"
                return@setOnClickListener
            }

            // Parse số từ tên: "Bàn 7" -> 7, "7" -> 7
            val tableNumber: Int? = name.toIntOrNull()
                ?: Regex("\\d+").find(name)?.value?.toIntOrNull()

            if (tableNumber == null || tableNumber < 1) {
                binding.edtName.error = "Tên phải chứa số bàn (vd: 'Bàn 7' hoặc '7')"
                return@setOnClickListener
            }

            val request = TableRequest(tableNumber = tableNumber)
            viewModel.updateTable(userToken, request)
        }
        binding.btnRemove.setOnClickListener {
            viewModel.deleteTable(userToken)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}