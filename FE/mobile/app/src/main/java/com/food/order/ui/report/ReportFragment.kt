package com.food.order.ui.report

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.anychart.AnyChart
import com.anychart.AnyChartView
import com.anychart.chart.common.dataentry.DataEntry
import com.anychart.chart.common.dataentry.ValueDataEntry
import com.anychart.charts.Pie
import com.anychart.charts.Cartesian
import com.anychart.enums.Align
import com.anychart.enums.LegendLayout
import android.webkit.WebView
import androidx.navigation.fragment.findNavController
import com.food.order.data.SessionManager
import com.food.order.data.response.ReportData
import com.food.order.databinding.FragmentReportBinding
import com.google.android.material.tabs.TabLayout
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class ReportFragment : Fragment() {

    private var _binding: FragmentReportBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReportViewModel by viewModels()

    private var chartView: AnyChartView? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentReportBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch { viewModel.countEmployeeFlow.collectLatest { binding.tvUserNumber.text = it.toString() } }
            launch { viewModel.mostFavoriteFoodFlow.collectLatest { binding.tvMostFood.text = it?.foodName ?: "No data" } }
            launch {
                viewModel.listOrderInTimeFlow.collectLatest { list ->
                    if (list != null) {
                        binding.tvPaymentInvoiceNumber.text = list.size.toString()
                        var ordering = 0; var completed = 0; var cancelled = 0
                        for (o in list) when (o.status) {
                            "ORDERING" -> ordering++
                            "COMPLETED" -> completed++
                            "CANCELLED" -> cancelled++
                        }
                        binding.tvCountOrdering.text = ordering.toString()
                        binding.tvCountCompleted.text = completed.toString()
                        binding.tvCountCancelled.text = cancelled.toString()
                    } else {
                        binding.tvPaymentInvoiceNumber.text = "0"
                        binding.tvCountOrdering.text = "0"
                        binding.tvCountCompleted.text = "0"
                        binding.tvCountCancelled.text = "0"
                    }
                }
            }
            launch {
                viewModel.reportDataFlow.collectLatest { data ->
                    if (!isAdded || _binding == null) return@collectLatest
                    if (data.isNullOrEmpty()) {
                        destroyChartView()
                        binding.layoutAnyChartView.removeAllViews()
                        binding.layoutAnyChartView.visibility = View.INVISIBLE
                        binding.ivEmptyBox.visibility = View.VISIBLE
                        binding.progressBar.visibility = View.GONE
                    } else {
                        binding.layoutAnyChartView.visibility = View.VISIBLE
                        binding.ivEmptyBox.visibility = View.GONE
                        setupChart(data)
                    }
                }
            }
            launch {
                viewModel.errorFlow.collectLatest {
                    if (isAdded) Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show()
                }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val sharedPref = requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        viewModel.server = sharedPref.getString("server_address", "") ?: ""
        viewModel.authToken = SessionManager.getBearerToken(requireContext())

        viewModel.fetchDataInTime()
        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }

        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                val type = when(tab?.position) {
                    0 -> "DAY"
                    1 -> "MONTH"
                    2 -> "CATEGORY"
                    else -> "DAY"
                }
                viewModel.loadReportsOnly(type, viewModel.server)
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun setupChart(result: List<ReportData>) {
        if (!isAdded || _binding == null) return

        destroyChartView()

        val data: MutableList<DataEntry> = ArrayList()
        for (r in result) data.add(ValueDataEntry(r.name, r.value))

        val cv = AnyChartView(requireContext()).apply {
            setProgressBar(binding.progressBar)
        }

        if (viewModel.currentReportType == "CATEGORY") {
            val chart = AnyChart.pie().apply {
                title("")
                labels().position("outside")
                legend().title().enabled(false)
                legend().position("center-bottom").itemsLayout(LegendLayout.HORIZONTAL).align(Align.CENTER)
            }
            chart.data(data)
            cv.setChart(chart)
        } else {
            val chart = AnyChart.column().apply {
                title("")
            }
            chart.data(data)
            cv.setChart(chart)
        }

        binding.layoutAnyChartView.removeAllViews()
        binding.layoutAnyChartView.addView(cv)
        chartView = cv
    }

    private fun destroyChartView() {
        val cv = chartView ?: return
        chartView = null
        try {
            cv.clear()
            val webViewId = resources.getIdentifier("web_view", "id", requireContext().packageName)
            if (webViewId != 0) {
                val webView = cv.findViewById<WebView>(webViewId)
                webView?.apply {
                    stopLoading()
                    webViewClient = android.webkit.WebViewClient()
                    webChromeClient = android.webkit.WebChromeClient()
                    destroy()
                }
            }
        } catch (_: Throwable) {}
    }

    override fun onDestroyView() {
        destroyChartView()
        _binding = null
        super.onDestroyView()
    }
}
