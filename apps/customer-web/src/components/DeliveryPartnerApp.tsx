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
  RefreshCw,
  ExternalLink,
  Check,
  AlertCircle,
  Truck,
  DollarSign,
  Compass,
  X,
  UserPlus,
  Users,
  Radio,
  Coins,
  ShieldAlert,
  ArrowRight,
  LogOut,
  Map as MapIcon,
  ChevronRight,
  KeyRound,
  FileText,
  AlertTriangle,
  Award,
  Sparkles,
  Zap,
} from 'lucide-react';
import L from 'leaflet';

export interface DeliveryPartnerSession {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  status: 'ONLINE' | 'OFFLINE' | 'ON_DELIVERY' | 'ON_BREAK';
  vehicleType: 'EV_2W' | 'MOTORCYCLE' | 'SCOOTER' | 'BICYCLE';
  vehicleNumber: string;
  drivingLicense: string;
  darkStoreName: string;
  kycStatus: string;
  approvalStatus: string;
  rating: number;
  totalOrdersCompleted: number;
  earningsToday: number;
  codCollectedToday: number;
  totalEarningsAllTime: number;
  emergencyContact?: string;
  bloodGroup?: string;
  token?: string;
}

export interface BroadcastOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
  readyForPickup?: boolean;
  readyForPickupAt?: string;
  deliveryAddress: any;
  storeLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  dropLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  distanceKm: number;
  estimatedMinutes: number;
  estimatedPayout: number;
}

export interface ActiveDeliveryTask {
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
  storeLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  dropLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  distanceKm?: number;
  estimatedMinutes?: number;
  estimatedPayout?: number;
}

export interface CompletedDelivery {
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
  earnings: number;
}

const API_BASE = 'http://localhost:3000/api/v1/fulfillment';
const FALLBACK_API_BASE = 'http://localhost:3008/api/v1/fulfillment';

export const DeliveryPartnerApp: React.FC<{ initialRoute?: string }> = ({ initialRoute }) => {
  // Navigation Route State
  const [currentRoute, setCurrentRoute] = useState<'login' | 'register' | 'dashboard'>(() => {
    const path = window.location.pathname;
    if (path.includes('register')) return 'register';
    if (path.includes('dashboard')) return 'dashboard';
    return 'login';
  });

  // Partner Session
  const [partner, setPartner] = useState<DeliveryPartnerSession | null>(() => {
    try {
      const saved = localStorage.getItem('freshcart_delivery_partner_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Dashboard Sub-Tabs
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history' | 'profile'>('available');

  // Broadcast & Deliveries Data
  const [availableOrders, setAvailableOrders] = useState<BroadcastOrder[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDeliveryTask[]>([]);
  const [completedDeliveries, setCompletedDeliveries] = useState<CompletedDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Map Modal State
  const [inspectMapOrder, setInspectMapOrder] = useState<BroadcastOrder | ActiveDeliveryTask | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // OTP Handover Modal
  const [otpModalTask, setOtpModalTask] = useState<ActiveDeliveryTask | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    pinCode: '1234',
    vehicleType: 'EV_2W' as 'EV_2W' | 'MOTORCYCLE' | 'SCOOTER' | 'BICYCLE',
    vehicleNumber: '',
    drivingLicense: '',
    darkStoreName: 'Dark Store #04 - HSR Sector 2, Bengaluru',
    emergencyContact: '',
    bloodGroup: 'B+',
    agreeTerms: true,
  });
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Login Form State
  const [loginForm, setLoginForm] = useState({
    phoneOrEmail: '',
    password: '',
    pinCode: '',
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Sync route on mount & popstate
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.includes('register')) {
        setCurrentRoute('register');
      } else if (path.includes('dashboard')) {
        setCurrentRoute('dashboard');
      } else {
        setCurrentRoute('login');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (route: 'login' | 'register' | 'dashboard') => {
    setCurrentRoute(route);
    window.history.pushState(null, '', `/delivery/${route}`);
  };

  // Route Guard: If not logged in and on dashboard, redirect to login
  useEffect(() => {
    if (currentRoute === 'dashboard' && !partner) {
      navigateTo('login');
    }
  }, [currentRoute, partner]);

  // Load Partner Dashboard Data
  const loadAvailableOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/deliveries/available`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAvailableOrders(json.data);
      }
    } catch {
      try {
        const fbRes = await fetch(`${FALLBACK_API_BASE}/deliveries/available`);
        const fbJson = await fbRes.json();
        if (fbJson.success) setAvailableOrders(fbJson.data);
      } catch {}
    }
  };

  const loadActiveDeliveries = async () => {
    if (!partner) return;
    try {
      const res = await fetch(`${API_BASE}/deliveries/active?riderId=${partner.id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setActiveDeliveries(json.data);
      }
    } catch {
      try {
        const fbRes = await fetch(`${FALLBACK_API_BASE}/deliveries/active?riderId=${partner.id}`);
        const fbJson = await fbRes.json();
        if (fbJson.success) setActiveDeliveries(fbJson.data);
      } catch {}
    }
  };

  const loadCompletedDeliveries = async () => {
    if (!partner) return;
    try {
      const res = await fetch(`${API_BASE}/deliveries/completed?riderId=${partner.id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCompletedDeliveries(json.data);
      }
    } catch {}
  };

  const refreshProfile = async () => {
    if (!partner) return;
    try {
      const res = await fetch(`${API_BASE}/delivery-partners/me?partnerId=${partner.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        const updated: DeliveryPartnerSession = {
          ...partner,
          ...json.data,
          fullName: json.data.full_name || partner.fullName,
          vehicleNumber: json.data.vehicle_number || partner.vehicleNumber,
          vehicleType: json.data.vehicle_type || partner.vehicleType,
          totalOrdersCompleted: json.data.total_orders_completed ?? partner.totalOrdersCompleted,
          earningsToday: Number(json.data.earnings_today ?? partner.earningsToday),
          codCollectedToday: Number(json.data.cod_collected_today ?? partner.codCollectedToday),
          totalEarningsAllTime: Number(json.data.total_earnings_all_time ?? partner.totalEarningsAllTime),
        };
        setPartner(updated);
        localStorage.setItem('freshcart_delivery_partner_session', JSON.stringify(updated));
      }
    } catch {}
  };

  // Real-Time SSE Stream Listener
  useEffect(() => {
    if (!partner || currentRoute !== 'dashboard') return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE}/deliveries/stream?riderId=${partner.id}`);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // 1. New Order Ready for Delivery
          if (payload.type === 'ORDER_READY') {
            loadAvailableOrders();
            setToastMessage({
              title: '🔔 New Order Available!',
              message: `Order #${payload.orderNumber || ''} is ready for pickup. Tap to review & accept.`,
              type: 'info',
            });
          }

          // 2. Order Assigned (First Acceptance Wins notification)
          if (payload.type === 'ORDER_ASSIGNED') {
            // Remove from available orders list in real time
            setAvailableOrders((prev) => prev.filter((o) => o.orderId !== payload.orderId));
            if (payload.riderId === partner.id) {
              loadActiveDeliveries();
              setActiveTab('active');
            }
          }

          // 3. Status Changed
          if (payload.type === 'DELIVERY_STATUS_CHANGED') {
            loadActiveDeliveries();
            loadCompletedDeliveries();
            refreshProfile();
          }

          // 4. Partner status changed
          if (payload.type === 'RIDER_STATUS_CHANGED' && payload.riderId === partner.id) {
            setPartner((prev) => (prev ? { ...prev, status: payload.status } : null));
          }
        } catch {}
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    // Polling fallback to guarantee zero missed data
    loadAvailableOrders();
    loadActiveDeliveries();
    loadCompletedDeliveries();
    const interval = setInterval(() => {
      loadAvailableOrders();
      loadActiveDeliveries();
      loadCompletedDeliveries();
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [partner?.id, currentRoute]);

  // Leaflet Map Initialization for Route Modal
  useEffect(() => {
    if (!inspectMapOrder || !mapContainerRef.current) return;

    // Destroy prior map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const storeLat = inspectMapOrder.storeLocation?.lat || 12.914142;
    const storeLng = inspectMapOrder.storeLocation?.lng || 77.641151;
    const dropLat = inspectMapOrder.dropLocation?.lat || 12.915523;
    const dropLng = inspectMapOrder.dropLocation?.lng || 77.643218;

    const map = L.map(mapContainerRef.current).setView([storeLat, storeLng], 14);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Store Pickup Marker (Emerald)
    const storeIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background-color: #059669; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🏪</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    // Customer Dropdown Marker (Indigo/Rose)
    const dropIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background-color: #e11d48; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">📍</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    L.marker([storeLat, storeLng], { icon: storeIcon })
      .addTo(map)
      .bindPopup(`<b>Pickup: ${inspectMapOrder.storeLocation?.name || 'Dark Store #04'}</b><br/>${inspectMapOrder.storeLocation?.address || ''}`)
      .openPopup();

    L.marker([dropLat, dropLng], { icon: dropIcon })
      .addTo(map)
      .bindPopup(`<b>Doorstep Drop: ${inspectMapOrder.orderNumber}</b><br/>${inspectMapOrder.dropLocation?.address || ''}`);

    // Dotted polyline
    const routeLine = L.polyline(
      [
        [storeLat, storeLng],
        [dropLat, dropLng],
      ],
      { color: '#059669', weight: 4, dashArray: '6, 8' }
    ).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [inspectMapOrder]);

  // Toggle Online / Offline Duty
  const handleToggleDuty = async () => {
    if (!partner) return;
    const newStatus = partner.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    try {
      const res = await fetch(`${API_BASE}/delivery-partners/${partner.id}/duty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        const updated = { ...partner, status: newStatus as any };
        setPartner(updated);
        localStorage.setItem('freshcart_delivery_partner_session', JSON.stringify(updated));
        setToastMessage({
          title: newStatus === 'ONLINE' ? '🟢 Duty Activated' : '⚪ Duty Offline',
          message: newStatus === 'ONLINE' ? 'You are now Online and receiving nearby orders.' : 'You are now Offline. No new orders will be assigned.',
          type: newStatus === 'ONLINE' ? 'success' : 'info',
        });
      }
    } catch {
      setToastMessage({ title: 'Error', message: 'Failed to update duty status', type: 'error' });
    }
  };

  // First-Acceptance-Wins Order Acceptance
  const handleAcceptOrder = async (order: BroadcastOrder) => {
    if (!partner) return;
    if (partner.status === 'OFFLINE') {
      setToastMessage({
        title: '⚠️ Duty Offline',
        message: 'Please toggle your duty to ONLINE at the top before accepting delivery orders.',
        type: 'warning',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliveries/${order.orderId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': partner.id,
        },
        body: JSON.stringify({
          riderId: partner.id,
          riderName: partner.fullName,
          riderPhone: partner.phone,
        }),
      });

      const json = await res.json();

      if (res.status === 409 || json.error?.code === 'ORDER_ALREADY_ACCEPTED') {
        // Race condition: another partner was faster
        setAvailableOrders((prev) => prev.filter((o) => o.orderId !== order.orderId));
        setToastMessage({
          title: '⚡ Order Already Claimed',
          message: json.error?.message || 'This order has already been accepted by another delivery partner.',
          type: 'warning',
        });
        return;
      }

      if (!res.ok || !json.success) {
        setToastMessage({
          title: 'Acceptance Failed',
          message: json.error?.message || 'Could not accept this order.',
          type: 'error',
        });
        return;
      }

      // Success! Partner won the order
      setToastMessage({
        title: '🎉 Order Assigned to You!',
        message: `Order #${order.orderNumber} successfully accepted! Head to Dark Store #04 for pickup.`,
        type: 'success',
      });

      // Update state immediately
      setAvailableOrders((prev) => prev.filter((o) => o.orderId !== order.orderId));
      loadActiveDeliveries();
      setActiveTab('active');
    } catch (err: any) {
      setToastMessage({ title: 'Connection Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Update Delivery Step (Reached Store -> Picked Up)
  const handleUpdateDeliveryStep = async (task: ActiveDeliveryTask, nextStatus: 'REACHED_STORE' | 'PICKED_UP' | 'IN_TRANSIT') => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliveries/${task.orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage({
          title: nextStatus === 'REACHED_STORE' ? '🏪 Arrived at Dark Store' : '🛵 Out for Delivery!',
          message:
            nextStatus === 'REACHED_STORE'
              ? 'Status updated to Reached Store. Please collect the package.'
              : 'Package verified & picked up! Customer has received their 4-digit verification PIN.',
          type: 'success',
        });
        loadActiveDeliveries();
      } else {
        setToastMessage({ title: 'Update Failed', message: json.error?.message || 'Could not update status', type: 'error' });
      }
    } catch (err: any) {
      setToastMessage({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Submit OTP Verification Handover
  const handleVerifyOtpAndDeliver = async () => {
    if (!otpModalTask) return;
    if (!otpInput || otpInput.trim().length !== 4) {
      setOtpError('Please enter the 4-digit verification PIN provided by the customer.');
      return;
    }

    setIsSubmittingOtp(true);
    setOtpError(null);
    try {
      const res = await fetch(`${API_BASE}/deliveries/${otpModalTask.orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DELIVERED',
          otp: otpInput.trim(),
          proofNotes: 'Customer doorstep handover with 4-digit OTP verification',
        }),
      });

      const json = await res.json();
      if (res.status === 400 || json.error?.code === 'INVALID_DELIVERY_PIN') {
        setOtpError(json.error?.message || 'Invalid 4-digit Delivery PIN. Please ask customer to check their WhatsApp or order screen.');
        return;
      }

      if (!res.ok || !json.success) {
        setOtpError(json.error?.message || 'Delivery completion failed.');
        return;
      }

      // Success! Delivery Completed!
      setOtpModalTask(null);
      setOtpInput('');
      setToastMessage({
        title: '🎉 Delivery Completed Successfully!',
        message: `Order #${otpModalTask.orderNumber} handed over. ₹50.00 base payout added to your earnings today!`,
        type: 'success',
      });

      loadActiveDeliveries();
      loadCompletedDeliveries();
      refreshProfile();
      setActiveTab('history');
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  // Dedicated Registration Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regForm.fullName.trim() || !regForm.phone.trim() || !regForm.vehicleNumber.trim() || !regForm.drivingLicense.trim()) {
      setRegError('Please fill in all required fields (Full Name, Phone, Vehicle Number, Driving License).');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const res = await fetch(`${API_BASE}/delivery-partners/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setRegError(json.error?.message || 'Enrollment failed. Please check details or try again.');
        return;
      }

      const newPartner: DeliveryPartnerSession = {
        id: json.data.partner.id,
        fullName: json.data.partner.full_name,
        phone: json.data.partner.phone,
        email: json.data.partner.email,
        status: 'ONLINE',
        vehicleType: json.data.partner.vehicle_type,
        vehicleNumber: json.data.partner.vehicle_number,
        drivingLicense: json.data.partner.driving_license,
        darkStoreName: json.data.partner.dark_store_name,
        kycStatus: json.data.partner.kyc_status,
        approvalStatus: json.data.partner.approval_status,
        rating: 5.0,
        totalOrdersCompleted: 0,
        earningsToday: 0,
        codCollectedToday: 0,
        totalEarningsAllTime: 0,
        emergencyContact: json.data.partner.emergency_contact,
        bloodGroup: json.data.partner.blood_group,
        token: json.data.token,
      };

      setPartner(newPartner);
      localStorage.setItem('freshcart_delivery_partner_session', JSON.stringify(newPartner));
      navigateTo('dashboard');
      setToastMessage({
        title: '🎉 Enrollment Successful!',
        message: json.data.message || 'Welcome to FreshCart Fleet! Your account is verified and ready for orders.',
        type: 'success',
      });
    } catch (err: any) {
      setRegError(err.message || 'Connection error. Please try again.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Dedicated Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginForm.phoneOrEmail.trim()) {
      setLoginError('Please enter your mobile number or email.');
      return;
    }

    setIsSubmittingLogin(true);
    try {
      const res = await fetch(`${API_BASE}/delivery-partners/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoginError(json.error?.message || 'Invalid credentials. Please verify your mobile number or 4-digit PIN.');
        return;
      }

      const loggedInPartner: DeliveryPartnerSession = {
        id: json.data.partner.id,
        fullName: json.data.partner.full_name,
        phone: json.data.partner.phone,
        email: json.data.partner.email,
        status: 'ONLINE',
        vehicleType: json.data.partner.vehicle_type,
        vehicleNumber: json.data.partner.vehicle_number,
        drivingLicense: json.data.partner.driving_license,
        darkStoreName: json.data.partner.dark_store_name,
        kycStatus: json.data.partner.kyc_status,
        approvalStatus: json.data.partner.approval_status,
        rating: Number(json.data.partner.rating || 5.0),
        totalOrdersCompleted: json.data.partner.total_orders_completed || 0,
        earningsToday: Number(json.data.partner.earnings_today || 0),
        codCollectedToday: Number(json.data.partner.cod_collected_today || 0),
        totalEarningsAllTime: Number(json.data.partner.total_earnings_all_time || 0),
        emergencyContact: json.data.partner.emergency_contact,
        bloodGroup: json.data.partner.blood_group,
        token: json.data.token,
      };

      setPartner(loggedInPartner);
      localStorage.setItem('freshcart_delivery_partner_session', JSON.stringify(loggedInPartner));
      navigateTo('dashboard');
      setToastMessage({
        title: '👋 Welcome Back!',
        message: `Signed in as ${loggedInPartner.fullName}. Duty is set to ONLINE.`,
        type: 'success',
      });
    } catch (err: any) {
      setLoginError(err.message || 'Connection error. Please try again.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    if (partner) {
      try {
        await fetch(`${API_BASE}/delivery-partners/${partner.id}/duty`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'OFFLINE' }),
        });
      } catch {}
    }
    setPartner(null);
    localStorage.removeItem('freshcart_delivery_partner_session');
    navigateTo('login');
  };

  // ====================================================================
  // VIEW 1: REGISTRATION INTERFACE (/delivery/register)
  // ====================================================================
  if (currentRoute === 'register') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="max-w-2xl mx-auto w-full my-auto">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/20 mb-4">
              <Bike className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              FreshCart <span className="text-emerald-400">Partner Fleet</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Join Bengaluru’s fastest 10-minute grocery delivery network. Earn up to ₹850/day + instant payouts!
            </p>
          </div>

          {/* Enrollment Card */}
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  Delivery Partner Enrollment
                </h2>
                <p className="text-xs text-slate-400">Independent onboarding • Verified within 60 seconds</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Instant Activation
              </span>
            </div>

            {regError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              {/* Section 1: Personal Details */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-center text-xs leading-5">1</span>
                  Personal & Contact Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Phone Number (+91) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 00112"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="rahul@example.com"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Password or 4-Digit Quick PIN *</label>
                    <input
                      type="password"
                      required
                      placeholder="e.g. 1234 or SecurePass"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value, pinCode: e.target.value.slice(0, 4) })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Vehicle & Driving License */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-center text-xs leading-5">2</span>
                  Vehicle & License Credentials
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle Type *</label>
                    <select
                      value={regForm.vehicleType}
                      onChange={(e) => setRegForm({ ...regForm, vehicleType: e.target.value as any })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="EV_2W">⚡ Electric 2-Wheeler (EV)</option>
                      <option value="MOTORCYCLE">🏍️ Motorcycle</option>
                      <option value="SCOOTER">🛵 Petrol Scooter</option>
                      <option value="BICYCLE">🚲 Bicycle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle Registration Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. KA-05-EQ-4412"
                      value={regForm.vehicleNumber}
                      onChange={(e) => setRegForm({ ...regForm, vehicleNumber: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Driving License Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL-04-2022-88192"
                      value={regForm.drivingLicense}
                      onChange={(e) => setRegForm({ ...regForm, drivingLicense: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Dark Store Hub *</label>
                    <select
                      value={regForm.darkStoreName}
                      onChange={(e) => setRegForm({ ...regForm, darkStoreName: e.target.value })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Dark Store #04 - HSR Sector 2, Bengaluru">Dark Store #04 - HSR Sector 2, Bengaluru</option>
                      <option value="Dark Store #02 - Koramangala, Bengaluru">Dark Store #02 - Koramangala, Bengaluru</option>
                      <option value="Dark Store #07 - Bellandur Outer Ring Road, Bengaluru">Dark Store #07 - Bellandur Outer Ring Road, Bengaluru</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Safety & Emergency */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-center text-xs leading-5">3</span>
                  Emergency & Health Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="+91 99887 76655"
                      value={regForm.emergencyContact}
                      onChange={(e) => setRegForm({ ...regForm, emergencyContact: e.target.value })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Blood Group</label>
                    <select
                      value={regForm.bloodGroup}
                      onChange={(e) => setRegForm({ ...regForm, bloodGroup: e.target.value })}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  required
                  checked={regForm.agreeTerms}
                  onChange={(e) => setRegForm({ ...regForm, agreeTerms: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 bg-slate-900"
                />
                <label htmlFor="agreeTerms" className="text-xs text-slate-400 leading-relaxed">
                  I agree to FreshCart's Delivery Partner Service Agreement, Dark Store safety protocols, and certify that my vehicle registration and driving license are authentic.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingReg ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Verifying Credentials & Enrolling...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Submit & Activate Partner Account</span>
                  </>
                )}
              </button>
            </form>

            {/* Link to Login */}
            <div className="mt-6 pt-6 border-t border-slate-700/60 text-center">
              <p className="text-sm text-slate-400">
                Already registered with FreshCart?{' '}
                <button
                  onClick={() => navigateTo('login')}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Delivery Partner Sign In
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 mt-8">
          FreshCart Quick Commerce Fleet System • Independent Delivery Network • Bengaluru
        </div>
      </div>
    );
  }

  // ====================================================================
  // VIEW 2: LOGIN INTERFACE (/delivery/login)
  // ====================================================================
  if (currentRoute === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="max-w-md mx-auto w-full my-auto">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/20 mb-4">
              <Bike className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              FreshCart <span className="text-emerald-400">Rider Portal</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sign in with your mobile number or 4-digit security PIN to start accepting delivery orders.
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="border-b border-slate-700 pb-4 mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                Delivery Partner Sign In
              </h2>
              <p className="text-xs text-slate-400">Separate authentication for fleet partners</p>
            </div>

            {loginError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Registered Mobile Number or Email *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876500112 or +91 98765 00112"
                    value={loginForm.phoneOrEmail}
                    onChange={(e) => setLoginForm({ ...loginForm, phoneOrEmail: e.target.value })}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-500"
                  />
                  <Smartphone className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Password or 4-Digit Security PIN</label>
                  <span className="text-xs text-slate-500">Default PIN: 1234</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="•••• or Your Password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value, pinCode: e.target.value })}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-500"
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                </div>
              </div>

              {/* Demo Quick Logins */}
              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/60">
                <div className="text-xs text-slate-400 mb-2 font-medium">⚡ Quick Test Fleet Accounts:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginForm({ phoneOrEmail: '+91 98765 00112', password: '1234', pinCode: '1234' })}
                    className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-600/60 px-2.5 py-1 rounded-lg transition"
                  >
                    Rahul Sharma (EV-2W)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginForm({ phoneOrEmail: '+91 98765 00113', password: '1234', pinCode: '1234' })}
                    className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-600/60 px-2.5 py-1 rounded-lg transition"
                  >
                    Vikram Singh (Bike)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingLogin ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Signing in & Activating Duty...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Partner Dashboard</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-700/60 text-center">
              <p className="text-sm text-slate-400">
                New delivery partner?{' '}
                <button
                  onClick={() => navigateTo('register')}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Enroll / Register Here
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 mt-8">
          FreshCart Quick Commerce Fleet System • Independent Delivery Network • Bengaluru
        </div>
      </div>
    );
  }

  // ====================================================================
  // VIEW 3: DEDICATED DELIVERY PARTNER DASHBOARD (/delivery/dashboard)
  // ====================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-xl ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toastMessage.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : 'bg-slate-900/95 border-slate-700 text-slate-200'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toastMessage.type === 'info' && <Radio className="w-5 h-5 text-sky-400 shrink-0 mt-0.5 animate-pulse" />}
            <div className="flex-1">
              <div className="font-bold text-sm">{toastMessage.title}</div>
              <div className="text-xs opacity-90 mt-0.5 leading-relaxed">{toastMessage.message}</div>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Partner Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-lg shadow-md">
              {partner?.fullName?.charAt(0) || 'D'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm sm:text-base leading-tight">{partner?.fullName}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {partner?.vehicleType === 'EV_2W' ? '⚡ EV' : '🏍️ Bike'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{partner?.vehicleNumber}</span>
                <span>•</span>
                <span className="flex items-center text-amber-400 font-semibold">
                  ★ {partner?.rating || '5.0'}
                </span>
                <span>•</span>
                <span className="hidden sm:inline text-slate-500">{partner?.darkStoreName}</span>
              </div>
            </div>
          </div>

          {/* Right Action Controls: Duty Switch & Sign Out */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live SSE Pulse */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className="text-[11px] font-medium">{sseConnected ? 'Live Network' : 'Syncing'}</span>
            </div>

            {/* Online / Offline Toggle Button */}
            <button
              onClick={handleToggleDuty}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border shadow-sm ${
                partner?.status === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${partner?.status === 'ONLINE' ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-500'}`} />
              <span>{partner?.status === 'ONLINE' ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)'}</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              title="Sign Out of Partner Portal"
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Today's Payout</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              ₹{Number(partner?.earningsToday || 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-1">₹50 base per delivery + bonuses</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Orders Handled</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{partner?.totalOrdersCompleted || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">100% on-time completion</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Cash in Hand (COD)</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              ₹{Number(partner?.codCollectedToday || 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-amber-400 mt-1">To deposit at hub end of shift</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Duty Status</span>
              <Radio className={`w-4 h-4 ${partner?.status === 'ONLINE' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {partner?.status === 'ONLINE' ? '🟢 ONLINE' : '⚪ OFFLINE'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {partner?.status === 'ONLINE' ? 'Broadcasting live orders' : 'Orders paused'}
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'available'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Available Orders</span>
            {availableOrders.length > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'available' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {availableOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'active'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>My Active Deliveries</span>
            {activeDeliveries.length > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'active' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {activeDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Completed Deliveries</span>
            {completedDeliveries.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-extrabold bg-slate-800 text-slate-300">
                {completedDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Partner Profile</span>
          </button>
        </div>

        {/* TAB 1: AVAILABLE ORDERS (First-Acceptance-Wins Broadcast Pool) */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            {/* Offline Alert Banner */}
            {partner?.status === 'OFFLINE' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold">You are currently OFFLINE.</span> Toggle your duty status to ONLINE to start seeing broadcast delivery orders.
                  </div>
                </div>
                <button
                  onClick={handleToggleDuty}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0"
                >
                  Turn Duty ON
                </button>
              </div>
            )}

            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-400" />
                  Available Delivery Orders (Live Pool)
                </h3>
                <p className="text-xs text-slate-400">
                  First acceptance wins: Any online partner can inspect location and accept immediately.
                </p>
              </div>
              <button
                onClick={loadAvailableOrders}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Orders List */}
            {availableOrders.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-4 text-slate-500">
                  <Radio className="w-8 h-8 text-emerald-400/50 animate-pulse" />
                </div>
                <h4 className="font-bold text-white text-base">Searching for Ready Orders in HSR Sector 2...</h4>
                <p className="text-slate-400 text-xs max-w-md mx-auto mt-1">
                  Shopkeepers are currently packing fresh grocery orders. When an order is marked ready, it will appear here instantly!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-emerald-500/40 transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-base">{order.orderNumber}</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Ready for Pickup
                          </span>
                        </div>
                        <span className="text-emerald-400 font-black text-lg">
                          +₹{Number(order.estimatedPayout || 50).toFixed(2)}
                        </span>
                      </div>

                      {/* Distance & Time Pill */}
                      <div className="flex items-center gap-4 text-xs bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 mb-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Compass className="w-4 h-4 text-emerald-400" />
                          <span>{order.distanceKm} km</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-4 h-4 text-teal-400" />
                          <span>~{order.estimatedMinutes} mins</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 ml-auto">
                          <span className="text-slate-400">Total:</span>
                          <span className="font-bold text-white">₹{Number(order.grandTotal).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Route Details */}
                      <div className="space-y-2.5 text-xs mb-5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            🏪
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase text-emerald-400">Pickup Location</div>
                            <div className="font-semibold text-slate-200">{order.storeLocation.name}</div>
                            <div className="text-slate-400 text-[11px]">{order.storeLocation.address}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                            📍
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase text-rose-400">Customer Doorstep Drop</div>
                            <div className="font-semibold text-slate-200">
                              {order.deliveryAddress?.recipient_name || order.deliveryAddress?.recipientName || 'Customer'}
                              {order.deliveryAddress?.phone ? ` (${order.deliveryAddress.phone})` : ''}
                            </div>
                            <div className="text-slate-400 text-[11px]">{order.dropLocation.address}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => setInspectMapOrder(order)}
                        className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs py-2.5 px-3 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Inspect Map</span>
                      </button>

                      <button
                        onClick={() => handleAcceptOrder(order)}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs py-2.5 px-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Accept Order</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE DELIVERIES */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bike className="w-5 h-5 text-emerald-400" />
                  My Active Deliveries ({activeDeliveries.length})
                </h3>
                <p className="text-xs text-slate-400">Update progress from pickup to verified doorstep handover.</p>
              </div>
              <button
                onClick={loadActiveDeliveries}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {activeDeliveries.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <Bike className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="font-bold text-white text-base">No active deliveries right now</h4>
                <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                  You don't have any orders in transit. Check the Available Orders tab to claim an open delivery!
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  View Available Orders
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDeliveries.map((task) => {
                  const custPhone = task.deliveryAddress?.phone || task.riderPhone;
                  const custLat = task.dropLocation?.lat || task.currentLat || 12.915523;
                  const custLng = task.dropLocation?.lng || task.currentLng || 77.643218;
                  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${task.storeLocation?.lat || 12.914142},${task.storeLocation?.lng || 77.641151}&destination=${custLat},${custLng}`;

                  return (
                    <div
                      key={task.deliveryId}
                      className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-xl"
                    >
                      {/* Status Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-lg">{task.orderNumber}</span>
                            <span
                              className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                task.deliveryStatus === 'ASSIGNED'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : task.deliveryStatus === 'REACHED_STORE'
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {task.deliveryStatus === 'ASSIGNED' && '🛵 Claimed • Head to Store'}
                              {task.deliveryStatus === 'REACHED_STORE' && '🏪 At Store • Collect Bag'}
                              {task.deliveryStatus === 'IN_TRANSIT' && '🚀 Out for Delivery • En Route'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Assigned {new Date(task.assignedAt).toLocaleTimeString()} • Order Value: ₹{Number(task.grandTotal).toFixed(2)}
                          </div>
                        </div>

                        {/* Direct Navigation */}
                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Navigation className="w-4 h-4 text-sky-400" />
                          <span>Turn-by-Turn GPS</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                        </a>
                      </div>

                      {/* Customer & Locations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-6">
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                          <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Store Pickup Hub</div>
                          <div className="font-semibold text-slate-200">{task.storeLocation?.name || 'Dark Store #04'}</div>
                          <div className="text-slate-400">{task.storeLocation?.address || 'HSR Sector 2, Bengaluru'}</div>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-rose-400">Customer Doorstep Drop</span>
                            {custPhone && (
                              <a
                                href={`tel:${custPhone}`}
                                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call Customer</span>
                              </a>
                            )}
                          </div>
                          <div className="font-semibold text-slate-200">
                            {task.deliveryAddress?.recipient_name || task.deliveryAddress?.recipientName || 'Customer'}
                          </div>
                          <div className="text-slate-400">{task.dropLocation?.address || 'Customer doorstep address'}</div>
                        </div>
                      </div>

                      {/* Step Progress Tracker & Action Controls */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                          Fulfillment Action Workflow:
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Step 1: Reached Store */}
                          {task.deliveryStatus === 'ASSIGNED' && (
                            <button
                              onClick={() => handleUpdateDeliveryStep(task, 'REACHED_STORE')}
                              disabled={isLoading}
                              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer"
                            >
                              <MapPin className="w-4 h-4" />
                              <span>1. I have Reached Dark Store</span>
                            </button>
                          )}

                          {/* Step 2: Picked Up & In Transit */}
                          {(task.deliveryStatus === 'ASSIGNED' || task.deliveryStatus === 'REACHED_STORE') && (
                            <button
                              onClick={() => handleUpdateDeliveryStep(task, 'IN_TRANSIT')}
                              disabled={isLoading}
                              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer"
                            >
                              <Bike className="w-4 h-4" />
                              <span>2. Package Collected • Start Navigation</span>
                            </button>
                          )}

                          {/* Step 3: Complete with OTP */}
                          <button
                            onClick={() => {
                              setOtpModalTask(task);
                              setOtpInput('');
                              setOtpError(null);
                            }}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition cursor-pointer ml-auto"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Complete Handover & Enter OTP</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPLETED DELIVERIES */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Completed Deliveries ({completedDeliveries.length})
                </h3>
                <p className="text-xs text-slate-400">Audit trail of completed drop-offs and verified OTPs.</p>
              </div>
            </div>

            {completedDeliveries.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="font-bold text-white text-base">No completed deliveries yet today</h4>
                <p className="text-slate-400 text-xs mt-1">Accept orders and complete doorstep handovers to build your payout!</p>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="p-3.5">Order Number</th>
                        <th className="p-3.5">Customer / Address</th>
                        <th className="p-3.5">Delivered Time</th>
                        <th className="p-3.5">Verification PIN</th>
                        <th className="p-3.5">Order Value</th>
                        <th className="p-3.5 text-right">Partner Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {completedDeliveries.map((item) => (
                        <tr key={item.deliveryId} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">{item.orderNumber}</td>
                          <td className="p-3.5 text-slate-300">
                            <div>{item.deliveryAddress?.recipient_name || item.deliveryAddress?.recipientName || 'Customer'}</div>
                            <div className="text-[11px] text-slate-400">{item.deliveryAddress?.city || 'Bengaluru'}</div>
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {item.deliveredAt ? new Date(item.deliveredAt).toLocaleTimeString() : 'Recent'}
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              {item.deliveryOtp || 'VERIFIED'}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-slate-200">₹{Number(item.grandTotal).toFixed(2)}</td>
                          <td className="p-3.5 text-right font-bold text-emerald-400">+₹50.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PARTNER PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-6 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg">
                {partner?.fullName?.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{partner?.fullName}</h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  ID: <span className="font-mono text-slate-300">{partner?.id}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    KYC Verified
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Role: Delivery Partner
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-8">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">Mobile Phone</span>
                <span className="font-semibold text-slate-200 text-sm">{partner?.phone}</span>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">Email Address</span>
                <span className="font-semibold text-slate-200 text-sm">{partner?.email || 'None on file'}</span>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">Vehicle Type & Reg Number</span>
                <span className="font-semibold text-slate-200 text-sm">
                  {partner?.vehicleType} • {partner?.vehicleNumber}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">Driving License Number</span>
                <span className="font-semibold text-slate-200 text-sm">{partner?.drivingLicense}</span>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">Base Dark Store Hub</span>
                <span className="font-semibold text-slate-200 text-sm">{partner?.darkStoreName}</span>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">Total Lifetime Earnings</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{Number(partner?.totalEarningsAllTime || partner?.earningsToday || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <span className="text-xs text-slate-500">Need to update vehicle or bank account? Contact Dark Store Manager.</span>
              <button
                onClick={handleSignOut}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: INTERACTIVE ROUTE MAP */}
      {inspectMapOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  Route Map: {inspectMapOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  {inspectMapOrder.distanceKm} km • ~{inspectMapOrder.estimatedMinutes || 12} mins travel time
                </p>
              </div>
              <button onClick={() => setInspectMapOrder(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Map Canvas */}
            <div className="w-full h-80 bg-slate-950 relative" ref={mapContainerRef} />

            {/* Bottom Details */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div><span className="text-emerald-400 font-bold">🏪 Pickup:</span> {inspectMapOrder.storeLocation?.name}</div>
                <div><span className="text-rose-400 font-bold">📍 Drop:</span> {inspectMapOrder.dropLocation?.address}</div>
              </div>
              <button
                onClick={() => setInspectMapOrder(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OTP HANDOVER VERIFICATION */}
      {otpModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-white">Enter Customer OTP</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ask the customer for the 4-digit PIN sent to their WhatsApp & order tracking screen to complete order{' '}
                <span className="text-white font-bold">{otpModalTask.orderNumber}</span>.
              </p>
            </div>

            {otpError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 text-center mb-2 uppercase tracking-wider">
                  4-Digit Verification PIN
                </label>
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  placeholder="• • • •"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[1em] text-2xl font-black bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl py-3 text-white focus:outline-none"
                />
                {otpModalTask.deliveryOtp && (
                  <div className="text-[11px] text-slate-500 text-center mt-1">
                    Demo Helper PIN: <span className="text-slate-400 font-mono font-bold">{otpModalTask.deliveryOtp}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOtpModalTask(null)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs py-3 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOtpAndDeliver}
                  disabled={isSubmittingOtp || otpInput.length !== 4}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
