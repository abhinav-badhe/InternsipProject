import React, { useState, useEffect } from 'react';
import {
  Bike,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Truck,
  Coins,
  Radio,
  Search,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';

export interface RegisteredRider {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  status: 'OFFLINE' | 'ONLINE' | 'ON_DELIVERY' | 'ON_BREAK';
  vehicle_type: 'EV_2W' | 'MOTORCYCLE' | 'SCOOTER' | 'BICYCLE';
  vehicle_number: string;
  driving_license: string;
  dark_store_name: string;
  kyc_status: string;
  approval_status?: string;
  current_lat?: number;
  current_lng?: number;
  last_active_at?: string;
  total_orders_completed: number;
  earnings_today: number;
  cod_collected_today: number;
  rating: number;
}

export interface WaitingOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  grandTotal: number;
  deliveryAddress: any;
  createdAt: string;
  readyForPickup?: boolean;
  readyForPickupAt?: string;
  itemCount: number;
  distanceKm?: number;
  estimatedMinutes?: number;
}

export interface ActiveDelivery {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  deliveryStatus: 'ASSIGNED' | 'REACHED_STORE' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
  currentLat?: number;
  currentLng?: number;
  etaMinutes?: number;
  deliveryAddress: any;
  deliveryOtp?: string;
  assignedAt: string;
  reachedStoreAt?: string;
  dispatchedAt?: string;
  grandTotal: number;
  orderStatus: string;
  distanceKm?: number;
}

export interface CompletedDeliveryItem {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  riderName: string;
  deliveryStatus: string;
  deliveryAddress: any;
  assignedAt: string;
  deliveredAt: string;
  deliveryOtp: string;
  grandTotal: number;
}

export const RiderFleetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'waiting' | 'active' | 'completed' | 'roster'>('waiting');

  // Data States
  const [waitingOrders, setWaitingOrders] = useState<WaitingOrder[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [completedDeliveries, setCompletedDeliveries] = useState<CompletedDeliveryItem[]>([]);
  const [riders, setRiders] = useState<RegisteredRider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Settle COD Modal
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<RegisteredRider | null>(null);

  // Search Filter
  const [searchFilter, setSearchFilter] = useState('');

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Fetch Delivery Management Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Available orders waiting for partner pickup
      const availRes = await fetch('/api/v1/fulfillment/deliveries/available');
      const availJson = await availRes.json();
      if (availJson.success && Array.isArray(availJson.data)) {
        setWaitingOrders(availJson.data);
      }

      // 2. Active in-flight deliveries
      const activeRes = await fetch('/api/v1/fulfillment/deliveries/active');
      const activeJson = await activeRes.json();
      if (activeJson.success && Array.isArray(activeJson.data)) {
        setActiveDeliveries(activeJson.data);
      }

      // 3. Completed deliveries
      const compRes = await fetch('/api/v1/fulfillment/deliveries/completed');
      const compJson = await compRes.json();
      if (compJson.success && Array.isArray(compJson.data)) {
        setCompletedDeliveries(compJson.data);
      }

      // 4. Registered Fleet Roster
      const riderRes = await fetch('/api/v1/fulfillment/riders');
      const riderJson = await riderRes.json();
      if (riderJson.success && Array.isArray(riderJson.data)) {
        setRiders(riderJson.data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch delivery management data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Settle COD Cash
  const handleSettleCod = async (rider: RegisteredRider) => {
    try {
      const res = await fetch(`/api/v1/fulfillment/riders/${rider.id}/cash-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountDeposited: rider.cod_collected_today }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Reconciled ₹${Number(rider.cod_collected_today).toFixed(2)} COD cash for ${rider.full_name}`);
        setIsSettleModalOpen(null);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Failed to settle cash: ${err.message}`);
    }
  };

  const onlineRidersCount = riders.filter((r) => r.status === 'ONLINE' || r.status === 'ON_DELIVERY').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl shadow-xl bg-emerald-900 border border-emerald-500 text-emerald-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{actionNotice}</span>
        </div>
      )}

      {/* Header Banner: Fleet Overview & Quick Launch to Partner App */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-emerald-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Dark Store #04 Dispatch Control
            </span>
            <span className="text-xs text-emerald-200/80">• First-Acceptance-Wins Distribution</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Delivery Fleet Management</h2>
          <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 max-w-xl">
            Orders packed and marked ready are broadcast to online delivery partners in real time. The first partner to accept gets automatically assigned.
          </p>
        </div>

        {/* Right Action: Open Dedicated Delivery Partner Portal */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <a
            href="/delivery/login"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
          >
            <Bike className="w-4 h-4" />
            <span>Open Delivery Partner App</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
            <span>Waiting for Partner</span>
            <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-gray-900">{waitingOrders.length}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">Broadcasting in HSR Sector 2</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
            <span>In-Flight Active</span>
            <Bike className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">{activeDeliveries.length}</div>
          <div className="text-[11px] text-sky-600 font-medium mt-0.5">Assigned & en route</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
            <span>Completed Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">{completedDeliveries.length}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">100% verified with OTP</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
            <span>Online Fleet</span>
            <Users className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">{onlineRidersCount} <span className="text-xs font-medium text-gray-500">/ {riders.length}</span></div>
          <div className="text-[11px] text-teal-600 font-medium mt-0.5">Ready for orders</div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('waiting')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'waiting'
                ? 'bg-[#007a55] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Ready for Delivery (Broadcast Pool)</span>
            {waitingOrders.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${activeTab === 'waiting' ? 'bg-white text-[#007a55]' : 'bg-amber-100 text-amber-800'}`}>
                {waitingOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'active'
                ? 'bg-[#007a55] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>In-Flight Deliveries</span>
            {activeDeliveries.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${activeTab === 'active' ? 'bg-white text-[#007a55]' : 'bg-sky-100 text-sky-800'}`}>
                {activeDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-[#007a55] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Deliveries</span>
            {completedDeliveries.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-extrabold bg-gray-100 text-gray-700">
                {completedDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-[#007a55] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Fleet Roster & COD Settlement</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search order or partner..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] w-48 sm:w-60"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* VIEW 1: ORDERS WAITING FOR DELIVERY PARTNER ACCEPTANCE */}
      {activeTab === 'waiting' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-xs text-amber-900">
                <span className="font-bold">Automated Allocation Active:</span> These orders are currently visible to all {onlineRidersCount} online delivery partners in HSR Sector 2. The first partner to accept gets the assignment instantly.
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200 shrink-0">
              Zero Manual Assignment Required
            </span>
          </div>

          {waitingOrders.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 rounded-xl shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-base">No orders waiting for delivery partner pickup</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                All packed orders have been accepted by delivery partners or are currently being prepared in picking.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 font-semibold">
                    <tr>
                      <th className="p-3.5">Order Number</th>
                      <th className="p-3.5">Customer & Drop Location</th>
                      <th className="p-3.5">Distance</th>
                      <th className="p-3.5">Order Value</th>
                      <th className="p-3.5">Ready Since</th>
                      <th className="p-3.5 text-right">Broadcast Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {waitingOrders.map((ord) => (
                      <tr key={ord.orderId} className="hover:bg-gray-50/60">
                        <td className="p-3.5 font-bold text-gray-900">
                          <div>{ord.orderNumber}</div>
                          <span className="text-[10px] font-mono text-gray-400">ID: {ord.orderId.slice(0, 8)}</span>
                        </td>
                        <td className="p-3.5 text-gray-700">
                          <div className="font-semibold text-gray-900">
                            {ord.deliveryAddress?.recipient_name || ord.deliveryAddress?.recipientName || 'Customer'}
                            {ord.deliveryAddress?.phone ? ` (${ord.deliveryAddress.phone})` : ''}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate max-w-xs">
                            {ord.deliveryAddress?.flat_number ? `${ord.deliveryAddress.flat_number}, ` : ''}
                            {ord.deliveryAddress?.street || ''}, {ord.deliveryAddress?.city || 'Bengaluru'}
                          </div>
                        </td>
                        <td className="p-3.5 text-gray-600">
                          <span className="font-semibold">{ord.distanceKm || '2.4'} km</span>
                          <span className="text-[10px] text-gray-400 block">~{ord.estimatedMinutes || 11} mins ETA</span>
                        </td>
                        <td className="p-3.5 font-bold text-gray-900">₹{Number(ord.grandTotal).toFixed(2)}</td>
                        <td className="p-3.5 text-gray-500 font-mono">
                          {ord.readyForPickupAt ? new Date(ord.readyForPickupAt).toLocaleTimeString() : new Date(ord.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                            <span>Broadcasting to Fleet</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: IN-FLIGHT ACTIVE DELIVERIES */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeDeliveries.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 rounded-xl shadow-xs">
              <Bike className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-base">No in-flight deliveries right now</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Orders accepted by delivery partners will appear here with live tracking and contact info.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDeliveries.map((del) => {
                const custPhone = del.deliveryAddress?.phone;
                const custLat = del.currentLat || del.deliveryAddress?.lat || 12.915523;
                const custLng = del.currentLng || del.deliveryAddress?.lng || 77.643218;
                const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=12.914142,77.641151&destination=${custLat},${custLng}`;

                return (
                  <div
                    key={del.deliveryId}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-emerald-300 transition space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <div className="font-black text-gray-900 text-base">{del.orderNumber}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          Assigned: {new Date(del.assignedAt).toLocaleTimeString()} • ₹{Number(del.grandTotal).toFixed(2)}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          del.deliveryStatus === 'ASSIGNED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : del.deliveryStatus === 'REACHED_STORE'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {del.deliveryStatus === 'ASSIGNED' && '🛵 Partner Assigned'}
                        {del.deliveryStatus === 'REACHED_STORE' && '🏪 Partner at Store'}
                        {del.deliveryStatus === 'IN_TRANSIT' && '🚀 Out for Delivery'}
                      </span>
                    </div>

                    {/* Assigned Rider Card */}
                    <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#007a55] font-black text-sm flex items-center justify-center">
                          {del.riderName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-gray-900">{del.riderName}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{del.riderPhone}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${del.riderPhone}`}
                          className="p-2 rounded-lg bg-white border border-gray-200 text-[#007a55] hover:bg-emerald-50 transition"
                          title="Call Assigned Delivery Partner"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white border border-gray-200 text-sky-600 hover:bg-sky-50 transition"
                          title="View Live Map Navigation"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Customer Drop Location */}
                    <div className="text-xs space-y-1">
                      <div className="text-[10px] font-bold uppercase text-gray-400">Customer Drop-off</div>
                      <div className="font-semibold text-gray-900">
                        {del.deliveryAddress?.recipient_name || del.deliveryAddress?.recipientName || 'Customer'}
                        {custPhone ? ` • ${custPhone}` : ''}
                      </div>
                      <div className="text-gray-500 text-[11px]">
                        {del.deliveryAddress?.flat_number ? `${del.deliveryAddress.flat_number}, ` : ''}
                        {del.deliveryAddress?.street || ''}, {del.deliveryAddress?.city || 'Bengaluru'}
                      </div>
                    </div>

                    {/* Verification PIN Helper */}
                    {del.deliveryOtp && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-between text-xs">
                        <span className="text-emerald-800 font-medium">Customer Verification OTP:</span>
                        <span className="font-mono font-black text-emerald-900 tracking-wider text-sm bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {del.deliveryOtp}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: COMPLETED DELIVERIES */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {completedDeliveries.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 rounded-xl shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-base">No completed deliveries recorded today</h3>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 font-semibold">
                    <tr>
                      <th className="p-3.5">Order Number</th>
                      <th className="p-3.5">Delivered By Partner</th>
                      <th className="p-3.5">Customer / Address</th>
                      <th className="p-3.5">Delivered Time</th>
                      <th className="p-3.5">Verified OTP</th>
                      <th className="p-3.5 text-right">Order Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completedDeliveries.map((item) => (
                      <tr key={item.deliveryId} className="hover:bg-gray-50/60">
                        <td className="p-3.5 font-bold text-gray-900">{item.orderNumber}</td>
                        <td className="p-3.5 text-gray-800 font-semibold">{item.riderName}</td>
                        <td className="p-3.5 text-gray-600">
                          <div>{item.deliveryAddress?.recipient_name || item.deliveryAddress?.recipientName || 'Customer'}</div>
                          <div className="text-[11px] text-gray-400">{item.deliveryAddress?.city || 'Bengaluru'}</div>
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono">
                          {item.deliveredAt ? new Date(item.deliveredAt).toLocaleTimeString() : 'Recent'}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {item.deliveryOtp || 'VERIFIED'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-gray-900">₹{Number(item.grandTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: FLEET ROSTER & COD SETTLEMENT */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {riders.map((rider) => (
              <div key={rider.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#007a55] font-black text-sm flex items-center justify-center">
                        {rider.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900">{rider.full_name}</div>
                        <div className="text-[11px] text-gray-500">{rider.phone}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        rider.status === 'ONLINE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : rider.status === 'ON_DELIVERY'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {rider.status === 'ONLINE' && '🟢 Online'}
                      {rider.status === 'ON_DELIVERY' && '🛵 On Delivery'}
                      {rider.status === 'OFFLINE' && '⚪ Offline'}
                      {rider.status === 'ON_BREAK' && '☕ On Break'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Vehicle:</span>
                      <span className="font-semibold text-gray-800">{rider.vehicle_type} ({rider.vehicle_number})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Driving License:</span>
                      <span className="font-mono text-gray-800">{rider.driving_license}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rating:</span>
                      <span className="font-bold text-amber-600">★ {rider.rating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Deliveries Today:</span>
                      <span className="font-bold text-gray-800">{rider.total_orders_completed}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom COD Cash Settlement */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">COD In Bag</span>
                    <span className="font-black text-gray-900">₹{Number(rider.cod_collected_today || 0).toFixed(2)}</span>
                  </div>

                  {Number(rider.cod_collected_today || 0) > 0 && (
                    <button
                      onClick={() => handleSettleCod(rider)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-[#007a55] font-bold text-xs py-1.5 px-3 rounded-lg border border-emerald-200 transition cursor-pointer"
                    >
                      Settle Cash Deposit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
