import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  RefreshCw,
  Send,
  CheckCircle2,
  Phone,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export interface CustomerClvProfile {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  daysSinceLastOrder: number;
  predictedMonthlyOrders: number;
  predictedAnnualClv: number;
  churnProbability: number;
  churnRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  segment: 'VIP_CHAMPION' | 'LOYAL_REGULAR' | 'AT_RISK' | 'HIBERNATING' | 'NEW';
  recommendedAction: string;
  lastOrderAt: string;
}

export const CustomerClvChurnView: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerClvProfile[]>([]);
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalPortfolioClv: 0,
    averageClv: 0,
    highChurnRiskCount: 0,
    vipCount: 0,
  });
  const [selectedSegment, setSelectedSegment] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchClvData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/analytics/customers/clv-churn');
      const json = await res.json();
      if (json.success && json.data) {
        setCustomers(json.data.customers);
        setSummary(json.data.summary);
      }
    } catch (err: any) {
      console.warn('CLV data fetch note:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClvData();
  }, []);

  const handleReactivate = async (customerId: string) => {
    try {
      setReactivatingId(customerId);
      const res = await fetch(`/api/v1/analytics/customers/${customerId}/reactivate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage(json.data.message);
        setTimeout(() => setToastMessage(null), 4000);
        fetchClvData();
      }
    } catch (err: any) {
      alert(`Error triggering reactivation: ${err.message}`);
    } finally {
      setReactivatingId(null);
    }
  };

  const filteredCustomers = customers.filter(
    (c) => selectedSegment === 'ALL' || c.segment === selectedSegment || c.churnRiskLevel === selectedSegment
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Customer Lifetime Value (CLV) & Churn Risk Engine
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              RFM Machine Learning
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Predictive customer value forecasting, churn risk scores, and 1-click automated retention campaigns
          </p>
        </div>
        <button
          onClick={fetchClvData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tracked Customers</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{summary.totalCustomers}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active shopper database</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Portfolio Annual CLV</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            ₹{summary.totalPortfolioClv.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Projected 12-month value</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Average CLV / Customer</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ₹{summary.averageClv.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-purple-600 font-semibold mt-1 block">
            {summary.vipCount} VIP Champions
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-800">At-Risk & Churning</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-900 mt-2">{summary.highChurnRiskCount}</div>
          <span className="text-[11px] text-red-700 font-medium mt-1 block">
            Require automated win-back
          </span>
        </div>
      </div>

      {/* Segment Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'VIP_CHAMPION', 'LOYAL_REGULAR', 'AT_RISK', 'HIBERNATING'].map((seg) => (
          <button
            key={seg}
            onClick={() => setSelectedSegment(seg)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedSegment === seg
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {seg.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Customers Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Segment</th>
                <th className="p-3.5">Total Orders & Spend</th>
                <th className="p-3.5">AOV</th>
                <th className="p-3.5">Recency (Days)</th>
                <th className="p-3.5">Predicted Annual CLV</th>
                <th className="p-3.5">Churn Risk</th>
                <th className="p-3.5">Recommended Action</th>
                <th className="p-3.5 text-right">Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCustomers.map((c) => {
                const isHighRisk = c.churnRiskLevel === 'HIGH';
                const isMediumRisk = c.churnRiskLevel === 'MEDIUM';

                return (
                  <tr key={c.customerId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{c.customerName}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {c.customerPhone}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.segment === 'VIP_CHAMPION'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : c.segment === 'LOYAL_REGULAR'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : c.segment === 'AT_RISK'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}
                      >
                        {c.segment.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900">{c.totalOrders} orders</span>
                      <span className="text-slate-400 block text-[11px]">₹{c.totalSpend.toFixed(2)}</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      ₹{c.averageOrderValue.toFixed(0)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`font-semibold ${
                          c.daysSinceLastOrder > 21
                            ? 'text-red-600 font-bold'
                            : c.daysSinceLastOrder > 10
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {c.daysSinceLastOrder} {c.daysSinceLastOrder === 1 ? 'day' : 'days'} ago
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-black text-emerald-700 text-sm">
                        ₹{c.predictedAnnualClv.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        ~{c.predictedMonthlyOrders} orders/mo
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                          isHighRisk
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : isMediumRisk
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {Math.round(c.churnProbability * 100)}% ({c.churnRiskLevel})
                      </span>
                    </td>
                    <td className="p-3.5 max-w-xs text-[11px] text-slate-600">
                      {c.recommendedAction}
                    </td>
                    <td className="p-3.5 text-right">
                      {isHighRisk || isMediumRisk ? (
                        <button
                          onClick={() => handleReactivate(c.customerId)}
                          disabled={reactivatingId === c.customerId}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors shadow-2xs flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>{reactivatingId === c.customerId ? 'Sending...' : 'Win-Back'}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-slide-in">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

