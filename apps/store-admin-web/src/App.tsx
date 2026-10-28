import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Check,
  X,
  ShieldCheck,
  Send,
} from 'lucide-react';

interface StockItem {
  sku: string;
  name: string;
  category: string;
  location: string;
  availableStock: number;
  reservedStock: number;
  mrp: number;
  costPrice: number;
  batchNumber: string;
  expiryDate: string;
}

interface PickListItem {
  id: string;
  sku: string;
  productName: string;
  packSize: string;
  quantityRequested: number;
  quantityPicked: number;
  expiryDate: string;
  status: 'PENDING' | 'PICKED' | 'SUBSTITUTION_PROPOSED' | 'SUBSTITUTED';
  proposedSku?: string;
  customerApproval?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

interface StockoutAlert {
  sku: string;
  productName: string;
  authoritativeStock: number;
  dailyBurnRate: number;
  daysOfSupply: number;
  supplierLeadTimeDays: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
  recommendedReorderUnits: number;
  modelVersion: string;
  dataFreshness: string;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'INVENTORY' | 'PICKING' | 'PREDICTIVE'>('OVERVIEW');
  const [searchFilter, setSearchFilter] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Inventory State
  const [inventory, setInventory] = useState<StockItem[]>([
    {
      sku: 'DOVE-BAR-125G-4PK',
      name: 'Dove Cream Beauty Bar (4 x 125g)',
      category: 'Bathing Soaps',
      location: 'Aisle 2 - Bay B',
      availableStock: 1, // Scenario 01 Last Unit!
      reservedStock: 0,
      mrp: 340.0,
      costPrice: 260.0,
      batchNumber: 'BAT-2026-OCT-01',
      expiryDate: '2027-10-01',
    },
    {
      sku: 'DETTOL-ORIG-75G',
      name: 'Dettol Original Bathing Soap (75g)',
      category: 'Bathing Soaps',
      location: 'Aisle 2 - Bay A',
      availableStock: 45,
      reservedStock: 2,
      mrp: 42.0,
      costPrice: 31.0,
      batchNumber: 'BAT-2026-SEP-14',
      expiryDate: '2028-09-01',
    },
    {
      sku: 'LIFEBUOY-RED-100G',
      name: 'Lifebuoy Total 10 Soap (100g)',
      category: 'Bathing Soaps',
      location: 'Aisle 2 - Bay A',
      availableStock: 0, // Out of stock
      reservedStock: 0,
      mrp: 36.0,
      costPrice: 25.0,
      batchNumber: 'BAT-2026-AUG-20',
      expiryDate: '2028-08-01',
    },
    {
      sku: 'SURF-BAR-200G',
      name: 'Surf Excel Stain Eraser Detergent Bar (200g)',
      category: 'Laundry Detergents',
      location: 'Aisle 4 - Bay C',
      availableStock: 50,
      reservedStock: 4,
      mrp: 35.0,
      costPrice: 24.0,
      batchNumber: 'BAT-2026-OCT-10',
      expiryDate: '2028-10-01',
    },
    {
      sku: 'VIM-BAR-200G',
      name: 'Vim Lemon Dishwash Bar (200g)',
      category: 'Dishwash & Cleaning',
      location: 'Aisle 5 - Bay A',
      availableStock: 40,
      reservedStock: 1,
      mrp: 28.0,
      costPrice: 19.0,
      batchNumber: 'BAT-2026-OCT-05',
      expiryDate: '2027-10-01',
    },
    {
      sku: 'AMUL-MILK-1L',
      name: 'Amul Taaza Toned Milk (1L)',
      category: 'Dairy & Milk',
      location: 'Chiller Cold Room - Section 1',
      availableStock: 35,
      reservedStock: 5,
      mrp: 75.0,
      costPrice: 66.0,
      batchNumber: 'BAT-2026-OCT-27',
      expiryDate: '2026-10-31', // Perishable FEFO item
    },
    {
      sku: 'AASH-ATTA-5KG',
      name: 'Aashirvaad Whole Wheat Atta (5kg)',
      category: 'Staples & Grains',
      location: 'Aisle 7 - Pallet 2',
      availableStock: 25,
      reservedStock: 0,
      mrp: 275.0,
      costPrice: 215.0,
      batchNumber: 'BAT-2026-OCT-15',
      expiryDate: '2027-04-15',
    },
  ]);

  // 2. Picker Station & Substitutions State (Scenario 10)
  const [pickListItems, setPickListItems] = useState<PickListItem[]>([
    {
      id: 'pi-1',
      sku: 'AMUL-MILK-1L',
      productName: 'Amul Taaza Toned Milk 1L',
      packSize: '1L Tetra Pak',
      quantityRequested: 2,
      quantityPicked: 2,
      expiryDate: '2026-10-31', // FEFO: Earliest expiry picked first!
      status: 'PICKED',
    },
    {
      id: 'pi-2',
      sku: 'LIFEBUOY-RED-100G',
      productName: 'Lifebuoy Total 10 Soap (100g)',
      packSize: '100g',
      quantityRequested: 1,
      quantityPicked: 0,
      expiryDate: '2028-08-01',
      status: 'SUBSTITUTION_PROPOSED',
      proposedSku: 'DETTOL-ORIG-75G (Dettol Original 75g)',
      customerApproval: 'PENDING_APPROVAL', // Waiting for customer on WhatsApp/Web
    },
    {
      id: 'pi-3',
      sku: 'DOVE-BAR-125G-4PK',
      productName: 'Dove Cream Beauty Bar (4 x 125g)',
      packSize: '4 x 125g',
      quantityRequested: 1,
      quantityPicked: 0,
      expiryDate: '2027-10-01',
      status: 'PENDING',
    },
  ]);

  // 3. Predictive Reorder Alerts State (Scenario 15)
  const [stockoutAlerts] = useState<StockoutAlert[]>([
    {
      sku: 'DOVE-BAR-125G-4PK',
      productName: 'Dove Cream Beauty Bar (4 x 125g)',
      authoritativeStock: 1,
      dailyBurnRate: 3.5,
      daysOfSupply: 0.28,
      supplierLeadTimeDays: 3,
      riskLevel: 'CRITICAL',
      recommendedReorderUnits: 25,
      modelVersion: 'v1.0.0-baseline-ma7',
      dataFreshness: '2026-10-28T09:45:00.000Z',
    },
    {
      sku: 'LIFEBUOY-RED-100G',
      productName: 'Lifebuoy Total 10 Soap (100g)',
      authoritativeStock: 0,
      dailyBurnRate: 4.0,
      daysOfSupply: 0.0,
      supplierLeadTimeDays: 2,
      riskLevel: 'CRITICAL',
      recommendedReorderUnits: 30,
      modelVersion: 'v1.0.0-baseline-ma7',
      dataFreshness: '2026-10-28T09:45:00.000Z',
    },
    {
      sku: 'AMUL-MILK-1L',
      productName: 'Amul Taaza Toned Milk (1L)',
      authoritativeStock: 35,
      dailyBurnRate: 20.0,
      daysOfSupply: 1.75,
      supplierLeadTimeDays: 1,
      riskLevel: 'MEDIUM',
      recommendedReorderUnits: 40,
      modelVersion: 'v1.0.0-baseline-ma7',
      dataFreshness: '2026-10-28T09:45:00.000Z',
    },
  ]);

  // Picker actions
  const handleMarkItemPicked = (id: string) => {
    setPickListItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'PICKED', quantityPicked: item.quantityRequested } : item
      )
    );
    showToast('Item marked as verified and picked.');
  };

  // Simulate customer approving substitution on WhatsApp
  const handleSimulateCustomerApproval = (id: string, approved: boolean) => {
    setPickListItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status: approved ? 'SUBSTITUTED' : 'PENDING',
            quantityPicked: approved ? item.quantityRequested : 0,
            customerApproval: approved ? 'APPROVED' : 'REJECTED',
          };
        }
        return item;
      })
    );
    showToast(
      approved
        ? 'Customer approved substitution via WhatsApp (+91 98765 43210)!'
        : 'Customer rejected substitution. Item removed from order.'
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800">
        <div>
          {/* Brand */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              FC
            </div>
            <div>
              <span className="font-bold text-white text-sm block leading-tight">FreshCart Ops</span>
              <span className="text-[11px] text-slate-400 block">Dark Store Console</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                activeTab === 'OVERVIEW'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview & KPIs</span>
            </button>

            <button
              onClick={() => setActiveTab('INVENTORY')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                activeTab === 'INVENTORY'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Inventory & Batches</span>
            </button>

            <button
              onClick={() => setActiveTab('PICKING')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-colors ${
                activeTab === 'PICKING'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4" />
                <span>Picker Station (FEFO)</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold">
                1 Pending
              </span>
            </button>

            <button
              onClick={() => setActiveTab('PREDICTIVE')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-colors ${
                activeTab === 'PREDICTIVE'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4" />
                <span>Predictive Reorder</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                2 Critical
              </span>
            </button>
          </nav>
        </div>

        {/* Staff Session Info */}
        <div className="p-3 border-t border-slate-800 text-xs">
          <div className="font-semibold text-white">Sanjay Verma</div>
          <div className="text-slate-400 text-[11px]">Role: STORE_ADMIN</div>
          <div className="text-emerald-400 text-[10px] mt-1">● Store #01 (Bengaluru HSR)</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 capitalize">
              {activeTab === 'OVERVIEW'
                ? 'Store Operations Dashboard'
                : activeTab === 'INVENTORY'
                ? 'Inventory Master & Stock Movement'
                : activeTab === 'PICKING'
                ? 'Fulfillment Picker Station (Order #ORD-889814-409)'
                : 'Demand Forecast & Stockout Alerts'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => showToast('Refreshed data from PostgreSQL domain microservices.')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Sync Live DB</span>
            </button>
          </div>
        </header>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Today&apos;s Gross Revenue</span>
                <span className="text-2xl font-bold text-slate-900">₹42,850.00</span>
                <span className="text-[11px] text-emerald-600 block mt-1">↑ 14% vs yesterday</span>
              </div>
              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Total Orders Processed</span>
                <span className="text-2xl font-bold text-slate-900">128 Orders</span>
                <span className="text-[11px] text-slate-500 block mt-1">68 Web • 60 WhatsApp</span>
              </div>
              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Pending Pick Lists</span>
                <span className="text-2xl font-bold text-amber-600">4 Active</span>
                <span className="text-[11px] text-slate-500 block mt-1">Average pick time: 4.2 mins</span>
              </div>
              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Critical Stockout Alerts</span>
                <span className="text-2xl font-bold text-rose-600">2 SKUs</span>
                <span className="text-[11px] text-rose-700 block mt-1">Days of supply &lt; lead time</span>
              </div>
            </div>

            {/* Architecture Integrity Badge */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-emerald-950 font-bold mb-0.5">
                  Microservices Architecture Active & Transactionally Isolated
                </strong>
                <span>
                  PostgreSQL is the single source of truth for stock balances and orders. Transactional
                  outbox and saga orchestrator guarantee zero overselling on last units and deduplicate
                  WhatsApp & Payment webhooks.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: INVENTORY & BATCHES */}
        {activeTab === 'INVENTORY' && (
          <div className="p-6 space-y-4">
            {/* Search and Filter */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by SKU, brand, or name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">SKU & Product</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">Available Stock</th>
                    <th className="p-3 text-right">Reserved</th>
                    <th className="p-3 text-right">MRP</th>
                    <th className="p-3">Batch & Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory
                    .filter(
                      (item) =>
                        item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        item.sku.toLowerCase().includes(searchFilter.toLowerCase())
                    )
                    .map((item) => (
                      <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{item.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                        </td>
                        <td className="p-3 text-slate-600">{item.category}</td>
                        <td className="p-3 text-slate-600">{item.location}</td>
                        <td className="p-3 text-right font-bold">
                          {item.availableStock === 0 ? (
                            <span className="text-rose-600">0 (Out of stock)</span>
                          ) : item.availableStock === 1 ? (
                            <span className="text-amber-600">1 unit (Last Sellable)</span>
                          ) : (
                            <span className="text-emerald-700">{item.availableStock}</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-slate-500">{item.reservedStock}</td>
                        <td className="p-3 text-right text-slate-900 font-medium">₹{item.mrp.toFixed(2)}</td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          <div>{item.batchNumber}</div>
                          <div className="text-[10px] text-slate-400">Exp: {item.expiryDate}</div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: PICKER STATION & SUBSTITUTIONS (Scenario 10) */}
        {activeTab === 'PICKING' && (
          <div className="p-6 space-y-4">
            {/* Info Notice */}
            <div className="p-4 bg-slate-900 text-white rounded-md text-xs flex items-center justify-between">
              <div>
                <strong className="block text-emerald-400 font-bold mb-0.5">
                  FEFO Picking Order Active (First-Expired, First-Out)
                </strong>
                <span className="text-slate-300">
                  Pick batches with earliest expiration dates first. When an item is damaged or out of
                  stock, propose a substitution. The customer must explicitly approve via WhatsApp before
                  dispatch.
                </span>
              </div>
            </div>

            {/* Pick List Card */}
            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Pick List #PL-9921 (Order ORD-889814-409)</h2>
                  <span className="text-xs text-slate-500">Customer: Rahul Sharma (+91 98765 43210)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  In Progress
                </span>
              </div>

              <div className="divide-y divide-slate-100 p-4 space-y-3">
                {pickListItems.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{item.productName}</span>
                        <span className="text-[10px] font-mono text-slate-400">({item.sku})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Quantity: <strong>{item.quantityRequested}</strong> • Batch Expiry:{' '}
                        <span className="font-mono text-emerald-800 font-semibold">{item.expiryDate}</span>
                      </div>

                      {/* Substitution Status */}
                      {item.status === 'SUBSTITUTION_PROPOSED' && (
                        <div className="mt-2 p-2.5 rounded bg-amber-50 border border-amber-200 text-xs">
                          <div className="flex items-center gap-1.5 text-amber-800 font-bold mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Substitution Proposed: {item.proposedSku}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mb-2">
                            Prompt sent to customer&apos;s WhatsApp. Waiting for explicit approval (Scenario 10).
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSimulateCustomerApproval(item.id, true)}
                              className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              Simulate WhatsApp &quot;YES&quot;
                            </button>
                            <button
                              onClick={() => handleSimulateCustomerApproval(item.id, false)}
                              className="px-2 py-1 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                            >
                              Simulate WhatsApp &quot;NO&quot;
                            </button>
                          </div>
                        </div>
                      )}

                      {item.status === 'SUBSTITUTED' && (
                        <div className="mt-1 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Customer Approved Substitution: {item.proposedSku}</span>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div>
                      {item.status === 'PICKED' ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3.5 h-3.5" />
                          <span>Picked</span>
                        </span>
                      ) : item.status === 'PENDING' ? (
                        <button
                          onClick={() => handleMarkItemPicked(item.id)}
                          className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        >
                          Verify & Pick
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: PREDICTIVE REORDER & STOCKOUT ALERTS (Scenario 15) */}
        {activeTab === 'PREDICTIVE' && (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-white border border-slate-200 rounded-md text-xs shadow-xs">
              <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Predictive Inventory Forecast (Acceptance Scenario 15)</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Demand forecasting uses moving-average baseline models. Model metadata is strictly tagged
                with every output (`modelVersion`, `dataFreshness`). Stockout risk triggers when Days of
                Supply falls below supplier lead times. Recommendations are strictly <strong>advisory</strong>;
                PostgreSQL inventory remains authoritative.
              </p>
            </div>

            {/* Alerts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stockoutAlerts.map((alert) => (
                <div
                  key={alert.sku}
                  className={`p-4 rounded-md border bg-white shadow-xs ${
                    alert.riskLevel === 'CRITICAL' ? 'border-rose-300' : 'border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{alert.productName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        alert.riskLevel === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {alert.riskLevel} RISK
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3 bg-slate-50 p-2.5 rounded">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Authoritative Live Stock</span>
                      <strong className="text-slate-900">{alert.authoritativeStock} units</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Days of Supply</span>
                      <strong
                        className={alert.daysOfSupply < 1 ? 'text-rose-600 font-bold' : 'text-slate-900'}
                      >
                        {alert.daysOfSupply.toFixed(1)} days
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Daily Burn Rate</span>
                      <strong className="text-slate-900">{alert.dailyBurnRate} units/day</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Supplier Lead Time</span>
                      <strong className="text-slate-900">{alert.supplierLeadTimeDays} days</strong>
                    </div>
                  </div>

                  <div className="text-xs mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Recommended Reorder</span>
                      <strong className="text-sm font-bold text-emerald-800">
                        {alert.recommendedReorderUnits} units
                      </strong>
                    </div>
                    <div className="text-right text-[10px] text-slate-400">
                      <div>Model: {alert.modelVersion}</div>
                      <div>Freshness: {alert.dataFreshness.split('T')[0]}</div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      showToast(
                        `Draft Purchase Order created for ${alert.recommendedReorderUnits} units of ${alert.sku}`
                      )
                    }
                    className="w-full py-1.5 rounded text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Create Draft Purchase Order</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded shadow-lg border border-slate-700">
          {toast}
        </div>
      )}
    </div>
  );
};
export default App;
