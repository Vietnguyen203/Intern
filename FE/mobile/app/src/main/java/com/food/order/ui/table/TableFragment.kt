package com.food.order.ui.table

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast                              // ✅ CHANGED
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import com.food.order.R
import com.food.order.adapter.TableAdapter
import com.food.order.databinding.FragmentTableBinding
import com.food.order.data.SessionManager
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.Collections

class TableFragment : Fragment() {

    private var _binding: FragmentTableBinding? = null
    private val binding get() = _binding!!
    private val viewModel: TableViewModel by viewModels()

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    private val adapter: TableAdapter by lazy {
        TableAdapter(Collections.emptyList()) { item ->
            val bundle = Bundle().apply { putSerializable("edit_table", item) }
            findNavController().navigate(
                R.id.action_navigation_table_to_navigation_update_table,
                bundle
            )
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTableBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { binding.loadingView.isVisible = it }
            }
            launch {
                viewModel.tablesFlow.collectLatest { tables ->       // ✅ CHANGED: collectLatest
                    binding.recyclerView.isVisible = tables.isNotEmpty()
                    binding.ivEmpty.isVisible = tables.isEmpty()
                    adapter.updateData(tables)
                }
            }
            // ✅ CHANGED: lắng nghe kết quả tạo/cập nhật/xoá để show thông báo (VM đã tự reload)
            launch {
                viewModel.insertFlow.collectLatest { if (it) Toast.makeText(requireContext(), "Created", Toast.LENGTH_SHORT).show() }
            }
            launch {
                viewModel.updateFlow.collectLatest { if (it) Toast.makeText(requireContext(), "Updated", Toast.LENGTH_SHORT).show() }
            }
            launch {
                viewModel.deleteFlow.collectLatest { if (it) Toast.makeText(requireContext(), "Deleted", Toast.LENGTH_SHORT).show() }
            }
            launch {
                viewModel.errorFlow.collectLatest { Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show() }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.recyclerView.apply {
            layoutManager = GridLayoutManager(requireContext(), 2)
            adapter = this@TableFragment.adapter
        }
        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }
        
        val role = SessionManager.getRoleOrUnknown(requireContext())
        if (role == "ADMIN") {
            binding.tvCreateTable.isVisible = true
            binding.tvCreateTable.setOnClickListener {
                findNavController().navigate(R.id.action_navigation_table_to_navigation_create_table)
            }
        } else {
            binding.tvCreateTable.isVisible = false
        }

        viewModel.getTablesFromServer(userToken) // load lần đầu
    }

    // ✅ CHANGED: luôn reload khi quay lại màn hình
    override fun onResume() {
        super.onResume()
        viewModel.getTablesFromServer(userToken)
        viewModel.startPolling(userToken)
    }

    override fun onPause() {
        super.onPause()
        viewModel.stopPolling()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
