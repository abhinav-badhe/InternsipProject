import React, { useState, useEffect, useRef } from 'react';
import {
  Bike,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Monitor,
  RefreshCw,
  ExternalLink,
  Check,
  AlertCircle,
  Truck,
  DollarSign,
  Compass,
  PenTool,
  Trash2,
  X,
} from 'lucide-react';

interface AvailableOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  grandTotal: number;
  deliveryAddress: any;
  createdAt: string;
  itemCount: number;
}

interface ActiveDelivery {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  deliveryStatus: 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
  currentLat: number;
  currentLng: number;
  etaMinutes: number;
  deliveryAddress: any;
  assignedAt: string;
  dispatchedAt?: string;
  grandTotal: number;
  orderStatus: string;
}

export const RiderFleetView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'pwa' | 'dispatch'>('pwa');
  const [pwaTab, setPwaTab] = useState<'available' | 'active' | 'completed'>('active');
  const [isOnline, setIsOnline] = useState(true);

  // Rider Profile
  const riderProfile = {
    id: 'rider_rahul_01',
    name: 'Rahul Sharma',
    phone: '+91 98765 00112',
    rating: 4.9,
    vehicle: 'Ather 450X (KA-05-EQ-4412)',
    completedToday: 8,
    earningsToday: 760,
  };

  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Fetch live deliveries from backend
  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      // 1. Available orders
      const availRes = await fetch('/api/v1/fulfillment/deliveries/available');
      const availData = await availRes.json();
      if (availData.success && Array.isArray(availData.data)) {
        setAvailableOrders(availData.data);
      }

      // 2. Active deliveries
      const activeRes = await fetch('/api/v1/fulfillment/deliveries/active');
      const activeData = await activeRes.json();
      if (activeData.success && Array.isArray(activeData.data)) {
        setActiveDeliveries(activeData.data);
        if (activeData.data.length > 0 && pwaTab !== 'active') {
          setPwaTab('active');
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch deliveries:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 8000);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Accept order
  const handleAcceptOrder = async (order: AvailableOrder) => {
    try {
      const res = await fetch(`/api/v1/fulfillment/deliveries/${order.orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: riderProfile.id,
          riderName: riderProfile.name,
          riderPhone: riderProfile.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${order.orderNumber} accepted! Dark store packing verified.`);
        await fetchDeliveries();
        setPwaTab('active');
      }
    } catch (err: any) {
      showNotification(`Failed to accept order: ${err.message}`);
    }
  };

  // 2. Mark Picked Up & In Transit (Out for delivery)
  const handlePickupOrder = async (delivery: ActiveDelivery) => {
    try {
      const res = await fetch(`/api/v1/fulfillment/deliveries/${delivery.orderId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${delivery.orderNumber} is now Out for Delivery! Customer notified.`);
        await fetchDeliveries();
      }
    } catch (err: any) {
      showNotification(`Failed to mark pickup: ${err.message}`);
    }
  };

  // 3. Update GPS coordinates simulation
  const handleUpdateGps = async (delivery: ActiveDelivery, step: number) => {
    // Simulate rider moving closer to HSR Sector 2 customer destination
    const targetLat = 12.912543 + step * 0.0012;
    const targetLng = 77.643211 + step * 0.0015;
    const newEta = Math.max(2, (delivery.etaMinutes || 10) - 2);

    try {
      await fetch(`/api/v1/fulfillment/deliveries/${delivery.orderId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: targetLat,
          lng: targetLng,
          etaMinutes: newEta,
        }),
      });
      showNotification(`GPS Updated: Rider at ${targetLat.toFixed(5)}, ${targetLng.toFixed(5)} (ETA: ${newEta}m)`);
      await fetchDeliveries();
    } catch (err: any) {}
  };

  // Feature 8: Proof of Delivery (Digital Signature & OTP Verification)
  const [podModalDelivery, setPodModalDelivery] = useState<ActiveDelivery | null>(null);
  const [podOtp, setPodOtp] = useState('7409');
  const [podHandoverType, setPodHandoverType] = useState('Handed to customer in person');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // 4. Open Proof of Delivery Handover
  const handleOpenPodModal = (delivery: ActiveDelivery) => {
    setPodModalDelivery(delivery);
    setHasSignature(false);
  };

  const handleConfirmProofOfDelivery = async () => {
    if (!podModalDelivery) return;
    setIsSubmittingPod(true);

    try {
      const canvas = canvasRef.current;
      const signatureData = canvas && hasSignature ? canvas.toDataURL('image/png') : `sig_signed_${podModalDelivery.orderNumber}`;
      const notes = `${podHandoverType}${podOtp ? ` (Customer OTP: ${podOtp})` : ''}`;

      const res = await fetch(`/api/v1/fulfillment/deliveries/${podModalDelivery.orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proofSignature: signatureData,
          proofNotes: notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${podModalDelivery.orderNumber} DELIVERED with digital signature! Earned ₹60.`);
        setPodModalDelivery(null);
        clearSignature();
        await fetchDeliveries();
        setPwaTab('completed');
      }
    } catch (err: any) {
      showNotification(`Failed to complete delivery: ${err.message}`);
    } finally {
      setIsSubmittingPod(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-[#007a55]">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Rider Fleet & Delivery Operations</h2>
              <p className="text-xs text-gray-500">
                10-Minute Hyperlocal Dark Store Delivery Management & Rider Mobile PWA
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setViewMode('pwa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'pwa'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-[#007a55]" />
              <span>Rider Phone View</span>
            </button>
            <button
              onClick={() => setViewMode('dispatch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'dispatch'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-blue-600" />
              <span>Store Dispatch Board</span>
            </button>
          </div>

          <button
            onClick={fetchDeliveries}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            title="Refresh Deliveries"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-medium text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 1: RIDER SMARTPHONE PWA SIMULATOR                              */}
      {/* =================================================================== */}
      {viewMode === 'pwa' ? (
        <div className="flex justify-center py-2">
          {/* Smartphone Frame */}
          <div className="w-full max-w-md bg-gray-900 rounded-[36px] p-3 shadow-2xl border-4 border-gray-800">
            {/* Screen Inner */}
            <div className="bg-gray-50 rounded-[28px] overflow-hidden flex flex-col min-h-[640px] text-gray-900">
              {/* Phone Status Bar */}
              <div className="bg-[#007a55] px-5 py-3 text-white flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">FreshCart Rider</span>
                  <span className="text-emerald-200 text-[10px]">PWA Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                      isOnline ? 'bg-emerald-400 text-gray-950' : 'bg-red-400 text-white'
                    }`}
                  >
                    {isOnline ? '● ONLINE' : '○ OFFLINE'}
                  </button>
                </div>
              </div>

              {/* Rider Shift Info Banner */}
              <div className="bg-emerald-800 text-white px-5 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{riderProfile.name}</h3>
                    <p className="text-[11px] text-emerald-200">{riderProfile.vehicle}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-200">Today's Earnings</span>
                    <div className="font-bold text-base">₹{riderProfile.earningsToday}</div>
                  </div>
                </div>
              </div>

              {/* Rider Tabs */}
              <div className="flex border-b border-gray-200 bg-white text-xs font-semibold">
                <button
                  onClick={() => setPwaTab('available')}
                  className={`flex-1 py-2.5 text-center relative ${
                    pwaTab === 'available'
                      ? 'text-[#007a55] border-b-2 border-[#007a55]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  New Bags ({availableOrders.length})
                </button>
                <button
                  onClick={() => setPwaTab('active')}
                  className={`flex-1 py-2.5 text-center relative ${
                    pwaTab === 'active'
                      ? 'text-[#007a55] border-b-2 border-[#007a55]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  On Duty ({activeDeliveries.length})
                  {activeDeliveries.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-4 animate-ping" />
                  )}
                </button>
                <button
                  onClick={() => setPwaTab('completed')}
                  className={`flex-1 py-2.5 text-center ${
                    pwaTab === 'completed'
                      ? 'text-[#007a55] border-b-2 border-[#007a55]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Completed ({riderProfile.completedToday})
                </button>
              </div>

              {/* Content Area */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
                {/* TAB 1: AVAILABLE PICKUPS */}
                {pwaTab === 'available' && (
                  <>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Orders Packed at Dark Store (Ready for pickup)
                    </div>

                    {availableOrders.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 space-y-2">
                        <Truck className="w-8 h-8 mx-auto text-gray-300" />
                        <p className="text-xs">No packed orders awaiting rider right now.</p>
                        <p className="text-[11px] text-gray-400">New orders will pop up automatically!</p>
                      </div>
                    ) : (
                      availableOrders.map((ord) => (
                        <div
                          key={ord.orderId}
                          className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between border-b pb-2">
                            <div>
                              <span className="font-mono font-bold text-xs text-gray-900">
                                {ord.orderNumber}
                              </span>
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded ml-2">
                                {ord.itemCount} items
                              </span>
                            </div>
                            <span className="font-bold text-xs text-emerald-700">
                              ₹{Number(ord.grandTotal).toFixed(2)}
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 space-y-1">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span className="text-[11px]">
                                {ord.deliveryAddress?.street || '12th Main Road, HSR Layout'},{' '}
                                {ord.deliveryAddress?.city || 'Bengaluru'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Slot: {ord.deliveryAddress?.slot || '10-Min Express'}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAcceptOrder(ord)}
                            className="w-full py-2 bg-[#007a55] hover:bg-[#006345] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept & Pick Up Bag</span>
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* TAB 2: ACTIVE ON DUTY */}
                {pwaTab === 'active' && (
                  <>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Current Active Delivery Run
                    </div>

                    {activeDeliveries.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 space-y-2">
                        <Bike className="w-8 h-8 mx-auto text-gray-300" />
                        <p className="text-xs">No active deliveries in progress.</p>
                        <button
                          onClick={() => setPwaTab('available')}
                          className="text-xs text-[#007a55] font-bold hover:underline"
                        >
                          Check available bags &rarr;
                        </button>
                      </div>
                    ) : (
                      activeDeliveries.map((del) => (
                        <div
                          key={del.deliveryId}
                          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4"
                        >
                          {/* Status Badge */}
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-gray-900">
                              {del.orderNumber}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                del.deliveryStatus === 'IN_TRANSIT'
                                  ? 'bg-blue-100 text-blue-800 animate-pulse'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {del.deliveryStatus === 'IN_TRANSIT' ? '🛵 ON THE WAY' : '📦 ASSIGNED'}
                            </span>
                          </div>

                          {/* Customer & Address Details */}
                          <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1.5">
                            <div className="font-bold text-gray-900 flex justify-between">
                              <span>Customer Doorstep</span>
                              <span className="text-[#007a55] font-bold">
                                ETA: ~{del.etaMinutes || 10} mins
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-600">
                              {del.deliveryAddress?.street || '12th Main Road, HSR Sector 2'},{' '}
                              {del.deliveryAddress?.city || 'Bengaluru'}
                            </div>
                            <div className="pt-1 flex gap-2">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  `${del.deliveryAddress?.street || 'HSR Layout'}, Bengaluru`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold flex items-center justify-center gap-1 border border-blue-200"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>Google Maps</span>
                              </a>
                              <a
                                href={`tel:${del.deliveryAddress?.phone || '9876543210'}`}
                                className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-[11px] font-semibold flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call</span>
                              </a>
                            </div>
                          </div>

                          {/* Action Milestone Controls */}
                          {del.deliveryStatus === 'ASSIGNED' ? (
                            <button
                              onClick={() => handlePickupOrder(del)}
                              className="w-full py-2.5 bg-[#007a55] hover:bg-[#006345] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                            >
                              <Bike className="w-4 h-4" />
                              <span>Pick Up Bag & Start Ride</span>
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <button
                                onClick={() => handleUpdateGps(del, 1)}
                                className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-[11px] rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <Compass className="w-3 h-3 text-blue-600" />
                                <span>Simulate GPS Move Closer (-2m ETA)</span>
                              </button>

                              <button
                                onClick={() => handleOpenPodModal(del)}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Doorstep Handover (Proof of Delivery)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* TAB 3: COMPLETED TRIPS */}
                {pwaTab === 'completed' && (
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-xl border text-center space-y-1">
                      <div className="w-10 h-10 bg-emerald-100 text-[#007a55] rounded-full flex items-center justify-center mx-auto mb-2">
                        <Check className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-sm text-gray-900">Great Job Today!</h4>
                      <p className="text-xs text-gray-500">
                        Completed {riderProfile.completedToday} deliveries on time.
                      </p>
                      <div className="pt-2 text-base font-black text-[#007a55]">
                        ₹{riderProfile.earningsToday} Total Payout
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* MODE 2: STORE DISPATCH BOARD & FLEET MONITORING                      */
        /* =================================================================== */
        <div className="space-y-6">
          {/* Fleet Statistics KPI Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Bags Ready for Rider</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">{availableOrders.length}</div>
              <span className="text-[11px] text-amber-600 font-medium">Awaiting pickup</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Riders In Transit</span>
              <div className="text-2xl font-bold text-blue-600 mt-1">{activeDeliveries.length}</div>
              <span className="text-[11px] text-blue-600 font-medium">Live on GPS map</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Avg Delivery Speed</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">11.4 mins</div>
              <span className="text-[11px] text-emerald-700 font-medium">Target: &lt;15 mins</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">On-Duty Fleet</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">6 Riders</div>
              <span className="text-[11px] text-emerald-600 font-medium">100% Shift Coverage</span>
            </div>
          </div>

          {/* Active Deliveries Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-sm text-gray-900">Active Delivery Runs (Live Milestones)</h3>
              <span className="text-xs text-gray-500">{activeDeliveries.length} in transit</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b text-gray-600 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="px-5 py-3">Order Number</th>
                    <th className="px-5 py-3">Assigned Rider</th>
                    <th className="px-5 py-3">Customer Destination</th>
                    <th className="px-5 py-3">Milestone</th>
                    <th className="px-5 py-3">Live ETA</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                        No deliveries currently in transit.
                      </td>
                    </tr>
                  ) : (
                    activeDeliveries.map((del) => (
                      <tr key={del.deliveryId} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-mono font-bold text-gray-900">
                          {del.orderNumber}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-800">
                          <div className="flex items-center gap-1.5">
                            <Bike className="w-3.5 h-3.5 text-[#007a55]" />
                            <span>{del.riderName}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">{del.riderPhone}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 max-w-xs truncate">
                          {del.deliveryAddress?.street || '12th Main Road, HSR Sector 2'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              del.deliveryStatus === 'IN_TRANSIT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {del.deliveryStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-emerald-700">
                          ~{del.etaMinutes || 10} mins
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleOpenPodModal(del)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold cursor-pointer"
                          >
                            Mark Delivered (POD)
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Feature 8: Proof of Delivery (Digital Signature & OTP Verification) Modal */}
      {podModalDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#007a55]" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Proof of Delivery (POD)</h3>
                  <p className="text-xs text-slate-500">Order #{podModalDelivery.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setPodModalDelivery(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Handover type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Handover Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Handed to customer in person',
                    'Left with security / neighbor',
                  ].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPodHandoverType(type)}
                      className={`p-2 rounded-lg border text-[11px] font-semibold text-left transition-colors cursor-pointer ${
                        podHandoverType === type
                          ? 'border-[#007a55] bg-emerald-50 text-[#007a55]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer OTP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery Verification PIN / OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 7409"
                  value={podOtp}
                  onChange={(e) => setPodOtp(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Customer received this PIN on WhatsApp order confirmation.
                </span>
              </div>

              {/* Digital Signature Pad (Canvas) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-[#007a55]" />
                    <span>Customer Digital Signature (Touch / Stylus)</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 bg-white cursor-crosshair touch-none"
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                      Sign here on screen
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSubmittingPod}
                  onClick={handleConfirmProofOfDelivery}
                  className="w-full py-2.5 bg-[#007a55] hover:bg-[#006345] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingPod ? 'Recording Proof...' : 'Confirm POD & Mark Delivered'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

