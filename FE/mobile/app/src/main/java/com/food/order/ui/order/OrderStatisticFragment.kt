//package com.food.order.ui.order
//
//import android.content.Context
//import android.os.Bundle
//import android.view.LayoutInflater
//import android.view.View
//import android.view.ViewGroup
//import android.widget.Toast
//import androidx.fragment.app.Fragment
//import androidx.fragment.app.viewModels
//import androidx.lifecycle.lifecycleScope
//import androidx.navigation.fragment.findNavController
//import androidx.recyclerview.widget.LinearLayoutManager
//import com.food.order.adapter.OrderStatisticAdapter
//import com.food.order.databinding.FragmentOrderStatisticBinding
//import kotlinx.coroutines.flow.collectLatest
//import kotlinx.coroutines.launch
//import java.util.Collections
//
//class OrderStatisticFragment : Fragment() {
//    private var _binding: FragmentOrderStatisticBinding? = null
//    private val binding get() = _binding!!
//    private val viewModel: OrderTableViewModel by viewModels()
//    private val userToken: String by lazy {
//        ("Bearer " + requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE).getString("token", ""))
//    }
//    private val adapter: OrderStatisticAdapter by lazy {
//        OrderStatisticAdapter(Collections.emptyList()) {}
//    }
//
//    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
//        _binding = FragmentOrderStatisticBinding.inflate(inflater, container, false)
//        viewLifecycleOwner.lifecycleScope.launch {
//            launch {
//                launch {
//                    viewModel.listOrderFlow.collectLatest {
//                        adapter.updateData(it)
//                    }
//                }
//            }
//        }
//        return binding.root
//    }
//
//    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
//        super.onViewCreated(view, savedInstanceState)
//        binding.cardViewBack.setOnClickListener {
//            findNavController().popBackStack()
//        }
//
//        binding.recyclerView.apply {
//            layoutManager = LinearLayoutManager(requireContext())
//            adapter = this@OrderStatisticFragment.adapter
//        }
//        viewModel.listOrders(userToken)
//    }
//
//    override fun onDestroyView() {
//        super.onDestroyView()
//        _binding = null
//    }
//}
package com.food.order.ui.order

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.food.order.adapter.OrderStatisticAdapter
import com.food.order.data.SessionManager
import com.food.order.databinding.FragmentOrderStatisticBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.Collections

class OrderStatisticFragment : Fragment() {

    private var _binding: FragmentOrderStatisticBinding? = null
    private val binding get() = _binding!!

    private val viewModel: OrderTableViewModel by viewModels()

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    private val adapter: OrderStatisticAdapter by lazy {
        OrderStatisticAdapter(Collections.emptyList()) {}
    }

    // ✅ Dùng tên khác để tránh trùng với RecyclerView.layoutManager
    private lateinit var llm: LinearLayoutManager
    private var isLoadingMore = false
    private val visibleThreshold = 4

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOrderStatisticBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }

        llm = LinearLayoutManager(requireContext())
        binding.recyclerView.apply {
            adapter = this@OrderStatisticFragment.adapter
            layoutManager = llm

            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (dy <= 0) return

                    // Cast an toàn sang LinearLayoutManager
                    val manager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    val total = manager.itemCount
                    val lastVisible = manager.findLastVisibleItemPosition()
                    val canLoadMore = viewModel.pageFlow.value?.let { it.number + 1 < it.totalPages } ?: false

                    if (!isLoadingMore && canLoadMore && total <= lastVisible + visibleThreshold) {
                        isLoadingMore = true
                        viewModel.loadNext(userToken)
                    }
                }
            })
        }

        // Observers
        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.listOrderFlow.collectLatest { list ->
                    adapter.updateData(list)
                    isLoadingMore = false
                }
            }
            launch {
                viewModel.errorFlow.collectLatest { msg ->
                    Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Trang đầu
        viewModel.listOrders(userToken)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
