import React from 'react';

import { OrderResponse, TradeResponse } from '../api';

interface OrderHistoryProps {
  trades: TradeResponse[];
  orders: OrderResponse[];
  loading?: boolean;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ trades, orders, loading = false }) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Trade History</h3>
          <span className="text-sm text-slate-500">{trades.length} fills</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">Time</th>
                <th className="pb-3">Symbol</th>
                <th className="pb-3">Side</th>
                <th className="pb-3">Quantity</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Fees</th>
                <th className="pb-3">Slip</th>
                <th className="pb-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="border-t border-slate-100">
                  <td className="py-3 text-slate-600">{new Date(trade.timestamp).toLocaleString()}</td>
                  <td className="py-3 font-semibold text-slate-900">{trade.symbol}</td>
                  <td className={`py-3 font-medium ${trade.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'}`}>{trade.side.toUpperCase()}</td>
                  <td className="py-3 text-slate-600">{trade.quantity}</td>
                  <td className="py-3 text-slate-600">${trade.price.toFixed(2)}</td>
                  <td className="py-3 text-slate-600">${trade.fees.toFixed(2)}</td>
                  <td className="py-3 text-slate-600">${trade.slippage.toFixed(2)}</td>
                  <td className="py-3 text-slate-600">${trade.total.toFixed(2)}</td>
                </tr>
              ))}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No trades yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Orders</h3>
          <span className="text-sm text-slate-500">{orders.length} submitted</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">Time</th>
                <th className="pb-3">Symbol</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Side</th>
                <th className="pb-3">Qty</th>
                <th className="pb-3">Fill</th>
                <th className="pb-3">Fees</th>
                <th className="pb-3">Slip</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="py-3 text-slate-600">{new Date(order.created_at).toLocaleString()}</td>
                  <td className="py-3 font-semibold text-slate-900">{order.symbol}</td>
                  <td className="py-3 text-slate-600">{order.order_type.toUpperCase()}</td>
                  <td className={`py-3 font-medium ${order.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'}`}>{order.side.toUpperCase()}</td>
                  <td className="py-3 text-slate-600">{order.quantity}</td>
                  <td className="py-3 text-slate-600">
                    ${order.price.toFixed(2)}
                    {order.requested_price > 0 && order.requested_price !== order.price && (
                      <div className="text-xs text-slate-400">req ${order.requested_price.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="py-3 text-slate-600">${order.fees.toFixed(2)}</td>
                  <td className="py-3 text-slate-600">${order.slippage.toFixed(2)}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{order.status.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderHistory;
