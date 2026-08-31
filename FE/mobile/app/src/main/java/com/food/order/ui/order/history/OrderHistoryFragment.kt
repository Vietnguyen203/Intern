package com.food.order.ui.order.history

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.food.order.data.SessionManager
import com.food.order.databinding.FragmentOrderHistoryBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class OrderHistoryFragment : Fragment() {

    private var _b: FragmentOrderHistoryBinding? = null
    private val b get() = _b!!

    private val vm: OrderHistoryViewModel by viewModels {
        object : androidx.lifecycle.ViewModelProvider.Factory {
            override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                val repo = com.food.order.data.repository.OrderRepository
                @Suppress("UNCHECKED_CAST")
                return OrderHistoryViewModel(repo) as T
            }
        }
    }

    private lateinit var adapter: OrderHistoryAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentOrderHistoryBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = OrderHistoryAdapter { /* onClick row nếu cần */ }
        b.rvOrders.layoutManager = LinearLayoutManager(requireContext())
        b.rvOrders.adapter = adapter

        val refreshListener = object : SwipeRefreshLayout.OnRefreshListener {
            override fun onRefresh() { vm.refresh() }
        }
        b.swipe.setOnRefreshListener(refreshListener)

        b.rvOrders.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(rv: RecyclerView, dx: Int, dy: Int) {
                if (dy > 0) {
                    val lm = rv.layoutManager as LinearLayoutManager
                    val last = lm.findLastVisibleItemPosition()
                    if (last >= adapter.itemCount - 3) vm.loadNext()
                }
            }
        })

        vm.init(userToken())
        viewLifecycleOwner.lifecycleScope.launch {
            launch { vm.items.collectLatest { adapter.submit(it) } }
            launch { vm.loading.collectLatest { b.swipe.isRefreshing = it } }
        }
    }

    private fun userToken(): String = SessionManager.getBearerToken(requireContext())

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
