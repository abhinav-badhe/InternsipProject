import React, { useState, useEffect } from 'react';
import {
  FileText,
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  Send,
  Download,
  Printer,
  Sparkles,
  Phone,
  Mail,
  Star,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldAlert,
  Building2,
  Calendar,
} from 'lucide-react';
import {
  fetchLiveSuppliers,
  fetchLivePurchaseOrders,
  autoGeneratePurchaseOrder,
  issuePurchaseOrder,
  receivePurchaseOrder,
} from '../api/adminClient';

export const SupplierPurchaseOrdersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'RECEIVED'>('ALL');
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [supps, pos] = await Promise.all([
        fetchLiveSuppliers(),
        fetchLivePurchaseOrders(),
      ]);
      setSuppliers(supps);
      setPurchaseOrders(pos);
      if (pos.length > 0 && !selectedPo) {
        setSelectedPo(pos[0]);
      }
    } catch (err) {
      console.error('Failed to load PO data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoGeneratePO = async () => {
    setIsGenerating(true);
    setActionSuccessMsg(null);
    try {
      const newPo = await autoGeneratePurchaseOrder();
      setActionSuccessMsg(`Successfully generated Purchase Order #${newPo.poNumber} from low-stock ML alerts!`);
      await loadData();
      setSelectedPo(newPo);
    } catch (err: any) {
      alert(`Could not generate PO: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleIssuePo = async (poId: string) => {
    try {
      await issuePurchaseOrder(poId);
      setActionSuccessMsg('Purchase Order issued to supplier. Dispatched via supplier network.');
      await loadData();
    } catch (err: any) {
      alert(`Failed to issue PO: ${err.message}`);
    }
  };

  const handleReceivePo = async (poId: string) => {
    try {
      const res = await receivePurchaseOrder(poId);
      setActionSuccessMsg(res.message || 'Goods received and warehouse stock replenished!');
      await loadData();
    } catch (err: any) {
      alert(`Failed to receive goods: ${err.message}`);
    }
  };

  const filteredPos = purchaseOrders.filter((po) => {
    if (statusFilter === 'ALL') return true;
    return po.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Control Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  Suppliers & Automated Purchase Orders
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                  Feature 11 • Dark Store Inward
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Predictive supplier replenishment driven by ML stockout detection. Auto-generates POs, inward receipts, and restocks inventory.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleAutoGeneratePO}
              disabled={isGenerating}
              className="px-4 py-2 bg-[#007a55] hover:bg-[#006345] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Analyzing Stock...' : 'Auto-Generate PO from ML Alerts'}</span>
            </button>

            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#007a55]" />
              <span className="font-medium">{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab & Status Filter Switcher */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-slate-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Purchase Orders ({purchaseOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'suppliers'
                  ? 'bg-slate-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Registered Suppliers ({suppliers.length})</span>
            </button>
          </div>

          {activeTab === 'orders' && (
            <div className="flex items-center gap-1.5">
              {(['ALL', 'DRAFT', 'ISSUED', 'RECEIVED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: PO List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-600">
                <span>Purchase Order Pipeline</span>
                <span className="text-gray-400 font-mono text-[11px]">{filteredPos.length} POs</span>
              </div>

              {filteredPos.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No purchase orders found matching this filter. Click "Auto-Generate PO" above!
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {filteredPos.map((po) => {
                    const isSelected = selectedPo?.id === po.id;
                    return (
                      <div
                        key={po.id}
                        onClick={() => setSelectedPo(po)}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-gray-900">
                            {po.poNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              po.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : po.status === 'ISSUED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {po.status}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                          <span className="font-medium text-gray-800">{po.supplierName}</span>
                          <span className="font-bold text-gray-900">₹{Number(po.totalAmount).toFixed(2)}</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                          <span>{po.itemCount} item(s)</span>
                          <span>{new Date(po.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected PO Detail & Inward Receiving (7 cols) */}
          <div className="lg:col-span-7">
            {selectedPo ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 font-mono">
                        {selectedPo.poNumber}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                          selectedPo.status === 'RECEIVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedPo.status === 'ISSUED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedPo.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Supplier: <strong className="text-gray-900">{selectedPo.supplierName}</strong>
                    </div>
                  </div>

                  {/* Context Actions */}
                  <div className="flex items-center gap-2">
                    {selectedPo.status === 'DRAFT' && (
                      <button
                        onClick={() => handleIssuePo(selectedPo.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Issue to Supplier</span>
                      </button>
                    )}

                    {selectedPo.status === 'ISSUED' && (
                      <button
                        onClick={() => handleReceivePo(selectedPo.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#007a55] hover:bg-[#006345] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Receive Goods & Restock</span>
                      </button>
                    )}

                    <button
                      onClick={() => window.print()}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
                      title="Print Purchase Order"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Line Items & Suggested Replenishment
                  </h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Item / SKU</th>
                          <th className="py-2.5 px-3">Current Stock</th>
                          <th className="py-2.5 px-3">Order Qty</th>
                          <th className="py-2.5 px-3">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono">
                        {selectedPo.items?.map((it: any) => (
                          <tr key={it.id || it.sku} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-semibold text-gray-900">{it.productName}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{it.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 text-rose-600 font-bold">
                              {it.currentStock} units
                            </td>
                            <td className="py-2.5 px-3 font-bold text-gray-900">
                              +{it.orderedQty || it.suggestedQty}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              ₹{Number(it.unitCost).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                              ₹{Number(it.lineTotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals & Notes */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Notes / Memo
                    </span>
                    <p className="text-xs text-gray-600 mt-0.5">{selectedPo.notes || 'None'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Total Purchase Value
                    </span>
                    <div className="text-2xl font-black text-gray-900">
                      ₹{Number(selectedPo.totalAmount).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-xs text-gray-400">
                Select a Purchase Order to view items and issue goods receipt.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Suppliers Directory */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {suppliers.map((supp) => (
            <div
              key={supp.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                    {supp.code}
                  </span>
                  <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{supp.rating}</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-sm mt-3">{supp.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Contact: {supp.contactPerson}</p>

                <div className="mt-4 space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{supp.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>{supp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>Lead time: {supp.leadTimeDays} days</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100">
                <a
                  href={`https://wa.me/${supp.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#007a55] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp Supplier</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

