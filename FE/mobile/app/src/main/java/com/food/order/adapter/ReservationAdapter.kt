package com.food.order.adapter

import android.annotation.SuppressLint
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import androidx.core.content.ContextCompat
import com.food.order.R
import com.food.order.data.model.ReservationModel
import com.food.order.databinding.ItemReservationBinding

class ReservationAdapter(
    private var data: List<ReservationModel>,
    private val onCancelClick: (ReservationModel) -> Unit
) : RecyclerView.Adapter<ReservationAdapter.ReservationViewHolder>() {

    @SuppressLint("NotifyDataSetChanged")
    fun updateData(newData: List<ReservationModel>) {
        data = newData
        notifyDataSetChanged()
    }

    inner class ReservationViewHolder(
        val binding: ItemReservationBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: ReservationModel) {
            binding.tvTableLabel.text = item.tableLabel
            binding.tvCustomerInfo.text = if (item.customerPhone.isNotBlank())
                "${item.customerName} • ${item.customerPhone}" else item.customerName
            binding.tvPartyAndTime.text = "${item.partySize} khách • ${item.reservedAtDisplay}"

            when (item.status) {
                "CANCELLED" -> {
                    binding.tvStatus.text = "ĐÃ HUỶ"
                    binding.tvStatus.setBackgroundResource(R.drawable.bg_chip_urgent)
                    binding.tvStatus.setTextColor(ContextCompat.getColor(binding.root.context, R.color.accent_danger))
                }
                "COMPLETED" -> {
                    binding.tvStatus.text = "HOÀN TẤT"
                    binding.tvStatus.setBackgroundResource(R.drawable.bg_chip_neutral)
                    binding.tvStatus.setTextColor(ContextCompat.getColor(binding.root.context, R.color.chip_neutral_text))
                }
                else -> {
                    binding.tvStatus.text = "ĐÃ XÁC NHẬN"
                    binding.tvStatus.setBackgroundResource(R.drawable.bg_chip_ready)
                    binding.tvStatus.setTextColor(ContextCompat.getColor(binding.root.context, R.color.chip_ready_text))
                }
            }

            // Chỉ cho huỷ khi lượt đặt còn đang CONFIRMED — khớp đúng logic bên Web
            // (ReservationsPanel.jsx chỉ hiện nút Huỷ cho các lượt CONFIRMED).
            binding.btnCancel.isVisible = item.status == "CONFIRMED"
            binding.btnCancel.setOnClickListener { onCancelClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ReservationViewHolder {
        val binding = ItemReservationBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ReservationViewHolder(binding)
    }

    override fun getItemCount(): Int = data.size

    override fun onBindViewHolder(holder: ReservationViewHolder, position: Int) {
        holder.bind(data[position])
    }
}
