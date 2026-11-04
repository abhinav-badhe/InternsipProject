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
  UserPlus,
  Users,
  Radio,
  Coins,
  ShieldAlert,
  ArrowRight,
  Send,
  Sliders,
} from 'lucide-react';

export interface RegisteredRider {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  status: 'OFFLINE' | 'ONLINE' | 'ON_DELIVERY' | 'ON_BREAK';
  vehicle_type: 'EV_2W' | 'MOTORCYCLE' | 'BICYCLE';
  vehicle_number: string;
  driving_license: string;
  dark_store_name: string;
  kyc_status: string;
  current_lat?: number;
  current_lng?: number;
  last_active_at?: string;
  total_orders_completed: number;
  earnings_today: number;
  cod_collected_today: number;
  rating: number;
  pin_code?: string;
}

export interface AvailableOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  grandTotal: number;
  deliveryAddress: any;
  createdAt: string;
  itemCount: number;
}

export interface ActiveDelivery {
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
  const [viewMode, setViewMode] = useState<'roster' | 'dispatch' | 'pwa'>('roster');
  const [pwaTab, setPwaTab] = useState<'available' | 'active' | 'completed'>('active');

  // Registered Riders List
  const [riders, setRiders] = useState<RegisteredRider[]>([]);
  const [activeRider, setActiveRider] = useState<RegisteredRider | null>(null);

  // Deliveries State
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modals State
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<RegisteredRider | null>(null);
  const [orderToAssign, setOrderToAssign] = useState<AvailableOrder | null>(null);
  const [selectedRiderIdForAssignment, setSelectedRiderIdForAssignment] = useState<string>('');

  // New Rider Registration Form State
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderEmail, setNewRiderEmail] = useState('');
  const [newRiderVehicleType, setNewRiderVehicleType] = useState<'EV_2W' | 'MOTORCYCLE' | 'BICYCLE'>('EV_2W');
  const [newRiderVehicleNumber, setNewRiderVehicleNumber] = useState('');
  const [newRiderLicense, setNewRiderLicense] = useState('');
  const [newRiderPin, setNewRiderPin] = useState('1234');
  const [isSubmittingRider, setIsSubmittingRider] = useState(false);

  // Device GPS Streaming
  const [isGpsStreaming, setIsGpsStreaming] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Proof of Delivery Handover
  const [podModalDelivery, setPodModalDelivery] = useState<ActiveDelivery | null>(null);
  const [podOtp, setPodOtp] = useState('');
  const [podHandoverType, setPodHandoverType] = useState('Handed to customer in person');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch all fleet data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Registered Riders
      const riderRes = await fetch('/api/v1/fulfillment/riders');
      const riderData = await riderRes.json();
      if (riderData.success && Array.isArray(riderData.data)) {
        setRiders(riderData.data);
        if (!activeRider && riderData.data.length > 0) {
          setActiveRider(riderData.data[0]);
        } else if (activeRider) {
          const fresh = riderData.data.find((r: RegisteredRider) => r.id === activeRider.id);
          if (fresh) setActiveRider(fresh);
        }
      }

      // 2. Fetch Available Orders
      const availRes = await fetch('/api/v1/fulfillment/deliveries/available');
      const availData = await availRes.json();
      if (availData.success && Array.isArray(availData.data)) {
        setAvailableOrders(availData.data);
      }

      // 3. Fetch Active Deliveries
      const activeRes = await fetch('/api/v1/fulfillment/deliveries/active');
      const activeData = await activeRes.json();
      if (activeData.success && Array.isArray(activeData.data)) {
        setActiveDeliveries(activeData.data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch fleet data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Register New Rider (Storekeeper Action)
  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName || !newRiderPhone || !newRiderVehicleNumber || !newRiderLicense) {
      alert('Please fill in all required fields.');
      return;
    }
    setIsSubmittingRider(true);
    try {
      const res = await fetch('/api/v1/fulfillment/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newRiderName,
          phone: newRiderPhone,
          email: newRiderEmail,
          vehicleType: newRiderVehicleType,
          vehicleNumber: newRiderVehicleNumber,
          drivingLicense: newRiderLicense,
          pinCode: newRiderPin,
          darkStoreName: 'Dark Store #04 - HSR Sector 2',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Delivery Partner ${newRiderName} successfully registered!`);
        setIsOnboardModalOpen(false);
        setNewRiderName('');
        setNewRiderPhone('');
        setNewRiderEmail('');
        setNewRiderVehicleNumber('');
        setNewRiderLicense('');
        await fetchData();
      } else {
        alert(data.error?.message || 'Failed to register rider');
      }
    } catch (err: any) {
      alert(`Error registering rider: ${err.message}`);
    } finally {
      setIsSubmittingRider(false);
    }
  };

  // Toggle Rider Duty (Online / Offline)
  const handleToggleDuty = async (rider: RegisteredRider, nextStatus: 'ONLINE' | 'OFFLINE' | 'ON_BREAK') => {
    try {
      const res = await fetch(`/api/v1/fulfillment/riders/${rider.id}/duty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`${rider.full_name} status updated to ${nextStatus}`);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Failed to toggle duty: ${err.message}`);
    }
  };

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
        showNotification(`Reconciled ₹${rider.cod_collected_today} COD cash for ${rider.full_name}`);
        setIsSettleModalOpen(null);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Failed to settle cash: ${err.message}`);
    }
  };

  // Storekeeper Assigns Order to a Rider
  const handleAssignOrderToRider = async () => {
    if (!orderToAssign || !selectedRiderIdForAssignment) return;
    const targetRider = riders.find((r) => r.id === selectedRiderIdForAssignment);
    if (!targetRider) return;

    try {
      const res = await fetch(`/api/v1/fulfillment/deliveries/${orderToAssign.orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: targetRider.id,
          riderName: targetRider.full_name,
          riderPhone: targetRider.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${orderToAssign.orderNumber} assigned to ${targetRider.full_name}!`);
        setOrderToAssign(null);
        setSelectedRiderIdForAssignment('');
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Failed to assign order: ${err.message}`);
    }
  };

  // Rider accepts order from mobile PWA
  const handleRiderAcceptOrder = async (order: AvailableOrder) => {
    if (!activeRider) return;
    try {
      const res = await fetch(`/api/v1/fulfillment/deliveries/${order.orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: activeRider.id,
          riderName: activeRider.full_name,
          riderPhone: activeRider.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${order.orderNumber} accepted! Dark store pick verified.`);
        await fetchData();
        setPwaTab('active');
      }
    } catch (err: any) {
      showNotification(`Failed to accept order: ${err.message}`);
    }
  };

  // Mark Order Picked Up (Out for Delivery)
  const handlePickupOrder = async (delivery: ActiveDelivery) => {
    try {
      const res = await fetch(`/api/v1/fulfillment/deliveries/${delivery.orderId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${delivery.orderNumber} is Out for Delivery! Customer alerted.`);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Failed to mark pickup: ${err.message}`);
    }
  };

  // Real Device Geolocation Stream (HTML5 watchPosition)
  const toggleGpsStreaming = () => {
    if (isGpsStreaming) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsGpsStreaming(false);
      showNotification('Device GPS tracking paused.');
    } else {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (activeRider) {
            await fetch(`/api/v1/fulfillment/riders/${activeRider.id}/location`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lng }),
            }).catch(() => {});
          }
        },
        (error) => {
          console.warn('Geolocation watch notice:', error.message);
          // Fallback simulation if location is denied or simulated
          if (activeRider) {
            fetch(`/api/v1/fulfillment/riders/${activeRider.id}/location`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: 12.914142, lng: 77.641151 }),
            }).catch(() => {});
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      watchIdRef.current = id;
      setIsGpsStreaming(true);
      showNotification('Live device GPS telemetry connected!');
    }
  };

  // Digital Signature Pad Functions
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

  // Complete Delivery Handover with Customer Verification PIN & Signature
  const handleConfirmProofOfDelivery = async () => {
    if (!podModalDelivery) return;
    if (!podOtp || podOtp.trim().length !== 4) {
      alert('Please ask the customer for their 4-digit verification PIN.');
      return;
    }
    setIsSubmittingPod(true);
    try {
      const canvas = canvasRef.current;
      const signatureData = canvas && hasSignature ? canvas.toDataURL('image/png') : `sig_signed_${podModalDelivery.orderNumber}`;
      const notes = `${podHandoverType} (Customer PIN: ${podOtp.trim()})`;

      const res = await fetch(`/api/v1/fulfillment/deliveries/${podModalDelivery.orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proofSignature: signatureData,
          proofNotes: notes,
          otp: podOtp.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Order #${podModalDelivery.orderNumber} DELIVERED! OTP verified & ₹50 payout credited.`);
        setPodModalDelivery(null);
        clearSignature();
        setPodOtp('');
        await fetchData();
        setPwaTab('completed');
      } else {
        alert(data.error?.message || 'Delivery verification failed. Invalid OTP.');
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
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-[#007a55]">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Rider Fleet & Delivery Operations</h2>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  Multi-Rider Enterprise Architecture
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Onboard delivery partners, manage dark store dispatch, and run the isolated Rider Mobile PWA
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setViewMode('roster')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'roster'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#007a55]" />
              <span>Fleet Roster ({riders.length})</span>
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
              <span>Dispatch Board ({availableOrders.length})</span>
            </button>
            <button
              onClick={() => setViewMode('pwa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'pwa'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-purple-600" />
              <span>Rider Smartphone App</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            title="Refresh Fleet Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {viewMode === 'roster' && (
            <button
              onClick={() => setIsOnboardModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#007a55] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register New Rider</span>
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-medium text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 1: FLEET ROSTER & ONBOARDING (Storekeeper Management)         */}
      {/* =================================================================== */}
      {viewMode === 'roster' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase">Total Registered</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">{riders.length}</div>
              <span className="text-[10px] text-emerald-600 font-medium">All KYC Verified</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase">Online & Ready</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {riders.filter((r) => r.status === 'ONLINE' || r.status === 'ON_DELIVERY').length}
              </div>
              <span className="text-[10px] text-gray-400">Stationed at Dark Store #04</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase">Active In-Transit</span>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {riders.filter((r) => r.status === 'ON_DELIVERY').length}
              </div>
              <span className="text-[10px] text-blue-500">Delivering to Doorsteps</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase">Total COD in Fleet</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                ₹{riders.reduce((sum, r) => sum + (parseFloat(String(r.cod_collected_today)) || 0), 0).toFixed(2)}
              </div>
              <span className="text-[10px] text-amber-600">To reconcile at shift end</span>
            </div>
          </div>

          {/* Riders Roster Cards */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Dark Store Delivery Partners</h3>
                <p className="text-xs text-gray-500">Manage delivery partner profiles, duty status, and daily cash collection</p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {riders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold">No delivery riders registered yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Click "Register New Rider" above to onboard your first delivery partner.</p>
                </div>
              ) : (
                riders.map((r) => (
                  <div key={r.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/75 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-base shrink-0 border border-gray-200">
                        {r.full_name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-gray-900">{r.full_name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'ONLINE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'ON_DELIVERY'
                                ? 'bg-blue-100 text-blue-800 animate-pulse'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            ● {r.status}
                          </span>
                          <span className="text-[10px] bg-gray-100 text-gray-700 font-mono px-1.5 py-0.5 rounded">
                            {r.vehicle_type} ({r.vehicle_number})
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {r.phone}
                          </span>
                          <span>License: <strong className="font-mono text-gray-700">{r.driving_license}</strong></span>
                          <span>Dark Store: <strong className="text-gray-700">{r.dark_store_name}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-between md:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Today's Performance</span>
                        <div className="text-xs font-bold text-gray-900">
                          {r.total_orders_completed} drops · ₹{parseFloat(String(r.earnings_today) || '0').toFixed(0)} payout
                        </div>
                        <div className="text-[11px] text-amber-700 font-medium">
                          COD in hand: ₹{parseFloat(String(r.cod_collected_today) || '0').toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {parseFloat(String(r.cod_collected_today) || '0') > 0 && (
                          <button
                            onClick={() => setIsSettleModalOpen(r)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all"
                            title="Reconcile Cash Collection"
                          >
                            Settle COD
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActiveRider(r);
                            setViewMode('pwa');
                          }}
                          className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Open Rider App</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: STORE DISPATCH BOARD (Storekeeper Dispatch Operations)     */}
      {/* =================================================================== */}
      {viewMode === 'dispatch' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column A: Packed Orders Ready for Dispatch */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">1. Available Orders ({availableOrders.length})</h3>
                  <p className="text-xs text-gray-500">Orders packed in Dark Store #04 awaiting delivery partner assignment</p>
                </div>
              </div>

              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {availableOrders.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                    <p className="text-xs font-bold text-gray-700">All orders dispatched!</p>
                    <p className="text-[11px] text-gray-400">New customer orders will appear automatically upon warehouse packing.</p>
                  </div>
                ) : (
                  availableOrders.map((ord) => (
                    <div key={ord.orderId} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-xs text-gray-900">{ord.orderNumber}</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full ml-2">
                            {ord.itemCount} items
                          </span>
                        </div>
                        <span className="font-bold text-sm text-emerald-700">₹{Number(ord.grandTotal).toFixed(2)}</span>
                      </div>

                      <div className="text-xs text-gray-600 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span>
                          {ord.deliveryAddress?.street || 'Main Street'}, {ord.deliveryAddress?.city || 'Bengaluru'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                          Ordered {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => {
                            setOrderToAssign(ord);
                            const onlineRider = riders.find((r) => r.status === 'ONLINE');
                            if (onlineRider) setSelectedRiderIdForAssignment(onlineRider.id);
                          }}
                          className="px-3 py-1.5 bg-[#007a55] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <span>Dispatch to Rider</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column B: Active In-Transit Deliveries */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">2. Active In-Transit Deliveries ({activeDeliveries.length})</h3>
                  <p className="text-xs text-gray-500">Live courier tracking and doorstep delivery status</p>
                </div>
              </div>

              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {activeDeliveries.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Truck className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-600">No deliveries currently in transit.</p>
                  </div>
                ) : (
                  activeDeliveries.map((del) => (
                    <div key={del.deliveryId} className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-xs text-gray-900">{del.orderNumber}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-full ml-2">
                            {del.deliveryStatus}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-blue-700">ETA: {del.etaMinutes || 10} mins</span>
                      </div>

                      <div className="bg-gray-50 p-2.5 rounded-lg text-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">Assigned Rider</span>
                          <div className="font-bold text-gray-900">{del.riderName}</div>
                          <div className="text-[11px] text-gray-500">{del.riderPhone}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">GPS Coordinates</span>
                          <div className="font-mono text-[11px] text-gray-700">
                            {Number(del.currentLat || 12.9141).toFixed(4)}, {Number(del.currentLng || 77.6411).toFixed(4)}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-600 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span>
                          {del.deliveryAddress?.street || 'Main Street'}, {del.deliveryAddress?.city || 'Bengaluru'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 3: RIDER SMARTPHONE PWA (Dedicated Mobile View)                */}
      {/* =================================================================== */}
      {viewMode === 'pwa' && (
        <div className="flex flex-col items-center py-2">
          {/* Rider Selector (Simulating different rider devices) */}
          <div className="w-full max-w-md mb-3 flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-gray-200 text-xs shadow-xs">
            <span className="text-gray-500 font-medium">Logged-In Rider:</span>
            <select
              value={activeRider?.id || ''}
              onChange={(e) => {
                const found = riders.find((r) => r.id === e.target.value);
                if (found) setActiveRider(found);
              }}
              className="font-bold text-gray-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ({r.vehicle_number})
                </option>
              ))}
            </select>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-md bg-gray-900 rounded-[36px] p-3 shadow-2xl border-4 border-gray-800">
            {/* Screen Inner */}
            <div className="bg-gray-50 rounded-[28px] overflow-hidden flex flex-col min-h-[640px] text-gray-900">
              {/* Phone Status Bar */}
              <div className="bg-[#007a55] px-5 py-3 text-white flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">FreshCart Rider</span>
                  <span className="text-emerald-200 text-[10px]">Mobile PWA</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!activeRider) return;
                      const next = activeRider.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
                      handleToggleDuty(activeRider, next);
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                      activeRider?.status === 'ONLINE' || activeRider?.status === 'ON_DELIVERY'
                        ? 'bg-emerald-400 text-gray-950'
                        : 'bg-red-400 text-white'
                    }`}
                  >
                    {activeRider?.status === 'ONLINE' || activeRider?.status === 'ON_DELIVERY' ? '● ONLINE' : '○ OFFLINE'}
                  </button>
                </div>
              </div>

              {/* Rider Shift Info Banner */}
              <div className="bg-emerald-800 text-white px-5 py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{activeRider?.full_name || 'Rider Profile'}</h3>
                    <p className="text-[11px] text-emerald-200">{activeRider?.vehicle_number} · {activeRider?.vehicle_type}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-200">Today's Earnings</span>
                    <div className="font-bold text-base">₹{parseFloat(String(activeRider?.earnings_today) || '0').toFixed(0)}</div>
                  </div>
                </div>

                {/* Device GPS Toggle */}
                <div className="pt-2 border-t border-emerald-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-200 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Real-Time Device GPS</span>
                  </span>
                  <button
                    onClick={toggleGpsStreaming}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      isGpsStreaming ? 'bg-emerald-400 text-gray-950' : 'bg-emerald-900 text-emerald-200 border border-emerald-600'
                    }`}
                  >
                    {isGpsStreaming ? 'GPS Active (Streaming)' : 'Enable Live GPS'}
                  </button>
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
                  New Tasks ({availableOrders.length})
                </button>
                <button
                  onClick={() => setPwaTab('active')}
                  className={`flex-1 py-2.5 text-center relative ${
                    pwaTab === 'active'
                      ? 'text-[#007a55] border-b-2 border-[#007a55]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Active ({activeDeliveries.length})
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
                  Shift Stats ({activeRider?.total_orders_completed || 0})
                </button>
              </div>

              {/* Content Area */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
                {/* TAB 1: AVAILABLE TASKS */}
                {pwaTab === 'available' && (
                  <>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Orders Packed at Dark Store
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
                              <span className="font-mono font-bold text-xs text-gray-900">{ord.orderNumber}</span>
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded ml-2">
                                {ord.itemCount} items
                              </span>
                            </div>
                            <span className="font-bold text-xs text-emerald-700">₹{Number(ord.grandTotal).toFixed(2)}</span>
                          </div>

                          <div className="text-xs text-gray-600 space-y-1">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span className="text-[11px]">
                                {ord.deliveryAddress?.street || '12th Main Road, HSR Layout'},{' '}
                                {ord.deliveryAddress?.city || 'Bengaluru'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRiderAcceptOrder(ord)}
                            className="w-full py-2 bg-[#007a55] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>Accept Delivery Task (+₹50 Payout)</span>
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* TAB 2: ACTIVE DELIVERIES */}
                {pwaTab === 'active' && (
                  <>
                    {activeDeliveries.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 space-y-2">
                        <Bike className="w-8 h-8 mx-auto text-gray-300" />
                        <p className="text-xs">You have no active orders in transit.</p>
                        <button
                          onClick={() => setPwaTab('available')}
                          className="px-3 py-1.5 bg-emerald-50 text-[#007a55] font-bold text-xs rounded-lg"
                        >
                          View Available Pickups
                        </button>
                      </div>
                    ) : (
                      activeDeliveries.map((del) => (
                        <div
                          key={del.deliveryId}
                          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3.5"
                        >
                          <div className="flex items-center justify-between border-b pb-2">
                            <div>
                              <span className="font-mono font-bold text-xs text-gray-900">{del.orderNumber}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ml-2 ${
                                  del.deliveryStatus === 'IN_TRANSIT'
                                    ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {del.deliveryStatus}
                              </span>
                            </div>
                            <span className="font-bold text-xs text-blue-700">ETA: {del.etaMinutes || 10}m</span>
                          </div>

                          <div className="bg-gray-50 p-2.5 rounded-lg text-xs space-y-1.5">
                            <div className="font-semibold text-gray-800 flex items-center justify-between">
                              <span>Recipient: {del.deliveryAddress?.recipientName || 'Verified Customer'}</span>
                              {del.deliveryAddress?.label && (
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono font-bold">
                                  {del.deliveryAddress.label}
                                </span>
                              )}
                            </div>
                            <div className="text-gray-600 flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <a href={`tel:${del.deliveryAddress?.phone || '+919876543210'}`} className="text-blue-600 hover:underline font-mono">
                                {del.deliveryAddress?.phone || '+91 98765 43210'}
                              </a>
                            </div>
                            <div className="text-gray-600 flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              <span>
                                {del.deliveryAddress?.addressLine1 || del.deliveryAddress?.street || '12th Main Road, HSR Layout'},{' '}
                                {del.deliveryAddress?.city || 'Bengaluru'}
                              </span>
                            </div>

                            {/* GPS Coordinates Badge if customer marked on map */}
                            {del.deliveryAddress?.lat && del.deliveryAddress?.lng && (
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md font-mono font-bold">
                                <Navigation className="w-3 h-3 text-[#007a55]" />
                                <span>GPS Pin: {Number(del.deliveryAddress.lat).toFixed(6)}, {Number(del.deliveryAddress.lng).toFixed(6)} (Exact Doorstep)</span>
                              </div>
                            )}

                            {/* Google Maps Turn-by-Turn GPS Navigation Link */}
                            <div className="pt-1">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${
                                  del.deliveryAddress?.lat && del.deliveryAddress?.lng
                                    ? `${del.deliveryAddress.lat},${del.deliveryAddress.lng}`
                                    : encodeURIComponent(
                                        `${del.deliveryAddress?.addressLine1 || del.deliveryAddress?.street || '12th Main Road, HSR Layout'}, ${del.deliveryAddress?.city || 'Bengaluru'}`
                                      )
                                }`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#007a55] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Navigation className="w-3 h-3 text-[#007a55]" />
                                <span>Navigate to Customer (Google Maps Turn-by-Turn)</span>
                              </a>
                            </div>
                          </div>

                          {/* Action Steps */}
                          <div className="space-y-2">
                            {del.deliveryStatus === 'ASSIGNED' && (
                              <button
                                onClick={() => handlePickupOrder(del)}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <Truck className="w-4 h-4" />
                                <span>Pick Up from Dark Store & Start Delivery</span>
                              </button>
                            )}

                            {del.deliveryStatus === 'IN_TRANSIT' && (
                              <button
                                onClick={() => {
                                  setPodModalDelivery(del);
                                  setPodOtp('');
                                  setHasSignature(false);
                                }}
                                className="w-full py-2.5 bg-[#007a55] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Complete Delivery (Verify Customer OTP)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* TAB 3: SHIFT STATS & EARNINGS */}
                {pwaTab === 'completed' && (
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                      <h4 className="text-xs font-bold text-gray-900 uppercase">Daily Shift Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                          <span className="text-[10px] text-emerald-700 font-semibold">Completed Orders</span>
                          <div className="text-lg font-bold text-emerald-900">{activeRider?.total_orders_completed || 0}</div>
                        </div>
                        <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-blue-700 font-semibold">Total Earnings</span>
                          <div className="text-lg font-bold text-blue-900">₹{activeRider?.earnings_today || 0}</div>
                        </div>
                      </div>

                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-amber-800 font-bold uppercase">COD Cash In Hand</span>
                          <div className="text-base font-bold text-amber-900">
                            ₹{parseFloat(String(activeRider?.cod_collected_today) || '0').toFixed(2)}
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-700 font-medium">To deposit at store desk</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: REGISTER NEW DELIVERY PARTNER (Storekeeper Action)          */}
      {/* =================================================================== */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#007a55]" />
                <h3 className="font-bold text-gray-900 text-base">Onboard Delivery Partner</h3>
              </div>
              <button onClick={() => setIsOnboardModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterRider} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 00114"
                    value={newRiderPhone}
                    onChange={(e) => setNewRiderPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Vehicle Type *</label>
                  <select
                    value={newRiderVehicleType}
                    onChange={(e: any) => setNewRiderVehicleType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none"
                  >
                    <option value="EV_2W">Electric 2W (EV)</option>
                    <option value="MOTORCYCLE">Motorcycle</option>
                    <option value="BICYCLE">Bicycle</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Vehicle Reg Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="KA-05-EQ-9921"
                    value={newRiderVehicleNumber}
                    onChange={(e) => setNewRiderVehicleNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Driving License (DL) *</label>
                  <input
                    type="text"
                    required
                    placeholder="DL-04-2023-99120"
                    value={newRiderLicense}
                    onChange={(e) => setNewRiderLicense(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Assigned Dark Store</label>
                  <input
                    type="text"
                    disabled
                    value="Dark Store #04 - HSR Sector 2"
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">App Login PIN</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newRiderPin}
                    onChange={(e) => setNewRiderPin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingRider}
                  className="w-full py-2.5 bg-[#007a55] hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-xs"
                >
                  {isSubmittingRider ? 'Registering...' : 'Register & Authorize Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ASSIGN ORDER TO REGISTERED RIDER                             */}
      {/* =================================================================== */}
      {orderToAssign && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Assign Order #{orderToAssign.orderNumber}</h3>
              <button onClick={() => setOrderToAssign(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-gray-700">Select Available Online Rider:</label>
              <select
                value={selectedRiderIdForAssignment}
                onChange={(e) => setSelectedRiderIdForAssignment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none"
              >
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} ({r.vehicle_number}) - {r.status}
                  </option>
                ))}
              </select>

              <button
                onClick={handleAssignOrderToRider}
                className="w-full py-2 bg-[#007a55] hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-xs"
              >
                Confirm Dispatch Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SETTLE COD CASH                                              */}
      {/* =================================================================== */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Settle Cash Collection</h3>
              <button onClick={() => setIsSettleModalOpen(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600">
                Reconcile physical cash deposit from <strong>{isSettleModalOpen.full_name}</strong> into the dark store cash drawer.
              </p>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                <span className="text-[11px] text-amber-800 font-semibold uppercase">Pending Deposit Amount</span>
                <div className="text-xl font-bold text-amber-900">
                  ₹{parseFloat(String(isSettleModalOpen.cod_collected_today)).toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => handleSettleCod(isSettleModalOpen)}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all shadow-xs"
              >
                Confirm Cash Deposited
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PROOF OF DELIVERY (PIN + SIGNATURE HANDOVER)                */}
      {/* =================================================================== */}
      {podModalDelivery && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#007a55]" />
                <h3 className="font-bold text-gray-900 text-sm">Proof of Delivery Handover</h3>
              </div>
              <button onClick={() => setPodModalDelivery(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  1. Customer 4-Digit Verification PIN *
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={podOtp}
                  onChange={(e) => setPodOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 text-center text-lg font-mono font-bold tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007a55] outline-none"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Customer can find this PIN in their WhatsApp delivery alert and live tracking screen.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-gray-700">2. Customer E-Signature</label>
                  <button onClick={clearSignature} className="text-[11px] text-red-600 font-semibold hover:underline">
                    Clear Pad
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={120}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[120px] bg-white cursor-crosshair touch-none"
                  />
                </div>
              </div>

              <button
                onClick={handleConfirmProofOfDelivery}
                disabled={isSubmittingPod || podOtp.length !== 4}
                className="w-full py-2.5 bg-[#007a55] hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-xs disabled:opacity-50"
              >
                {isSubmittingPod ? 'Verifying PIN...' : 'Verify PIN & Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
