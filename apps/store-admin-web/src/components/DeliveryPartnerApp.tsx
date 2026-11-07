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
  Star,
  Store,
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

const API_BASE = '/api/v1/fulfillment';
const FALLBACK_API_BASE = 'http://localhost:3000/api/v1/fulfillment';

const VEHICLE_LABELS: Record<DeliveryPartnerSession['vehicleType'], string> = {
  EV_2W: 'Electric two-wheeler',
  MOTORCYCLE: 'Motorcycle',
  SCOOTER: 'Scooter',
  BICYCLE: 'Bicycle',
};

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
              title: 'New order available',
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
      html: `<div class="grid size-8 place-items-center rounded-full border-2 border-surface bg-primary text-xs font-bold text-white" aria-label="Pickup">P</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    // Customer Dropdown Marker (Indigo/Rose)
    const dropIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div class="grid size-8 place-items-center rounded-full border-2 border-surface bg-destructive text-xs font-bold text-white" aria-label="Drop-off">D</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    L.marker([storeLat, storeLng], { icon: storeIcon })
      .addTo(map)
      .bindPopup(`<b>Pickup: ${inspectMapOrder.storeLocation?.name || 'Dark Store #04'}</b><br/>${inspectMapOrder.storeLocation?.address || ''}`, { autoPan: false })
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
      { color: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(), weight: 4, dashArray: '6, 8' }
    ).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40], animate: false });

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
          title: newStatus === 'ONLINE' ? 'On duty' : 'Off duty',
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
        title: 'You’re off duty',
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
          title: 'Order already claimed',
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
        title: 'Order assigned to you',
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': partner?.id || '' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage({
          title: nextStatus === 'REACHED_STORE' ? 'Arrived at pickup' : 'Out for delivery',
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
          riderId: partner?.id,
          cashCollected: true,
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
        title: 'Delivery completed',
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
        title: 'Rider account created',
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
        title: 'Signed in',
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
  if (currentRoute ==='register') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="max-w-2xl mx-auto w-full my-auto">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary-light text-primary mb-4">
              <Bike className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              FreshCart <span className="text-success">Partner Fleet</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Join Bengaluru’s fastest 10-minute grocery delivery network. Earn up to ₹850/day + instant payouts!
            </p>
          </div>

          {/* Enrollment Card */}
          <div className="bg-surface-muted border border-border rounded-lg p-5">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-success" />
                  Delivery Partner Enrollment
                </h2>
                <p className="text-xs text-muted-foreground">Independent onboarding • Verified within 60 seconds</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success/8 text-success border border-success/25">
                Instant Activation
              </span>
            </div>

            {regError && (
              <div className="mb-6 p-4 rounded-md bg-destructive/8 border border-destructive/25 text-destructive text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              {/* Section 1: Personal Details */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-surface-muted text-foreground text-center text-xs leading-5">1</span>
                  Personal & Contact Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success focus:border-primary placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Mobile Phone Number (+91) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 00112"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success focus:border-primary placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="rahul@example.com"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success focus:border-primary placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Password or 4-Digit Quick PIN *</label>
                    <input
                      type="password"
                      required
                      placeholder="e.g. 1234 or SecurePass"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value, pinCode: e.target.value.slice(0, 4) })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success focus:border-primary placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Vehicle & Driving License */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-surface-muted text-foreground text-center text-xs leading-5">2</span>
                  Vehicle & License Credentials
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Vehicle Type *</label>
                    <select
                      value={regForm.vehicleType}
                      onChange={(e) => setRegForm({ ...regForm, vehicleType: e.target.value as any })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success"
                    >
                      {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Vehicle Registration Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. KA-05-EQ-4412"
                      value={regForm.vehicleNumber}
                      onChange={(e) => setRegForm({ ...regForm, vehicleNumber: e.target.value.toUpperCase() })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Driving License Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL-04-2022-88192"
                      value={regForm.drivingLicense}
                      onChange={(e) => setRegForm({ ...regForm, drivingLicense: e.target.value.toUpperCase() })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned Dark Store Hub *</label>
                    <select
                      value={regForm.darkStoreName}
                      onChange={(e) => setRegForm({ ...regForm, darkStoreName: e.target.value })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success"
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
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-surface-muted text-foreground text-center text-xs leading-5">3</span>
                  Emergency & Health Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="+91 99887 76655"
                      value={regForm.emergencyContact}
                      onChange={(e) => setRegForm({ ...regForm, emergencyContact: e.target.value })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Blood Group</label>
                    <select
                      value={regForm.bloodGroup}
                      onChange={(e) => setRegForm({ ...regForm, bloodGroup: e.target.value })}
                      className="w-full bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success"
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
                  className="mt-1 w-4 h-4 rounded border-border text-success focus:ring-success bg-surface"
                />
                <label htmlFor="agreeTerms" className="text-xs text-muted-foreground leading-relaxed">
                  I agree to FreshCart's Delivery Partner Service Agreement, Dark Store safety protocols, and certify that my vehicle registration and driving license are authentic.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-6 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
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
            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Already registered with FreshCart?{''}
                <button
                  onClick={() => navigateTo('login')}
                  className="text-success hover:text-success font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Delivery Partner Sign In
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-8">
          FreshCart Quick Commerce Fleet System • Independent Delivery Network • Bengaluru
        </div>
      </div>
    );
  }

  // ====================================================================
  // VIEW 2: LOGIN INTERFACE (/delivery/login)
  // ====================================================================
  if (currentRoute ==='login') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="max-w-md mx-auto w-full my-auto">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary-light text-primary mb-4">
              <Bike className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              FreshCart <span className="text-success">Rider Portal</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in with your mobile number or 4-digit security PIN to start accepting delivery orders.
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-surface-muted border border-border rounded-lg p-5">
            <div className="border-b border-border pb-4 mb-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-success" />
                Delivery Partner Sign In
              </h2>
              <p className="text-xs text-muted-foreground">Separate authentication for fleet partners</p>
            </div>

            {loginError && (
              <div className="mb-6 p-4 rounded-md bg-destructive/8 border border-destructive/25 text-destructive text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Registered Mobile Number or Email *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876500112 or +91 98765 00112"
                    value={loginForm.phoneOrEmail}
                    onChange={(e) => setLoginForm({ ...loginForm, phoneOrEmail: e.target.value })}
                    className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success focus:border-primary placeholder:text-muted-foreground"
                  />
                  <Smartphone className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Password or 4-Digit Security PIN</label>
                  <span className="text-xs text-muted-foreground">Default PIN: 1234</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="•••• or Your Password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value, pinCode: e.target.value })}
                    className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm text-foreground focus-visible:outline-primary focus:ring-2 focus:ring-success focus:border-primary placeholder:text-muted-foreground"
                  />
                  <KeyRound className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3.5" />
                </div>
              </div>

              {/* Demo Quick Logins */}
              <div className="p-3 bg-surface rounded-md border border-border">
                <div className="text-xs text-muted-foreground mb-2 font-medium">Demo rider accounts</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginForm({ phoneOrEmail: '+91 98765 00112', password: '1234', pinCode: '1234' })}
                    className="text-xs bg-surface-muted hover:bg-surface-muted text-muted-foreground border border-border px-2.5 py-1 rounded-lg transition"
                  >
                    Rahul Sharma (EV-2W)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginForm({ phoneOrEmail: '+91 98765 00113', password: '1234', pinCode: '1234' })}
                    className="text-xs bg-surface-muted hover:bg-surface-muted text-muted-foreground border border-border px-2.5 py-1 rounded-lg transition"
                  >
                    Vikram Singh (Bike)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-6 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
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

            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                New delivery partner?{''}
                <button
                  onClick={() => navigateTo('register')}
                  className="text-success hover:text-success font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Enroll / Register Here
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-8">
          FreshCart Quick Commerce Fleet System • Independent Delivery Network • Bengaluru
        </div>
      </div>
    );
  }

  // ====================================================================
  // VIEW 3: DEDICATED DELIVERY PARTNER DASHBOARD (/delivery/dashboard)
  // ====================================================================
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div role={toastMessage.type === 'error' ? 'alert' : 'status'} className="fixed top-4 right-4 left-4 z-50 max-w-sm sm:left-auto">
          <div
            className={`bg-surface p-4 rounded-lg border shadow-md flex items-start gap-3 ${
              toastMessage.type ==='success'
                ?'border-success/25'
                : toastMessage.type ==='warning'
                ?'border-warning/25'
                : toastMessage.type ==='error'
                ?'border-destructive/25'
                : 'border-border'
            }`}
          >
            {toastMessage.type ==='success' && <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />}
            {toastMessage.type ==='warning' && <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />}
            {toastMessage.type ==='error' && <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
            {toastMessage.type ==='info' && <Radio className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div className="font-bold text-sm">{toastMessage.title}</div>
              <div className="text-xs opacity-90 mt-0.5 leading-relaxed">{toastMessage.message}</div>
            </div>
            <button onClick={() => setToastMessage(null)} aria-label="Dismiss notification" className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-surface border-b border-border sticky top-0 z-40 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Partner Info */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 shrink-0 h-10 rounded-lg bg-primary-light flex items-center justify-center font-bold text-primary text-lg">
              {partner?.fullName?.charAt(0) ||'D'}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-foreground text-sm sm:text-base leading-tight">Rider dashboard</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{partner?.fullName}</span>
                {partner?.vehicleType && <span className="inline-flex items-center gap-1"><Bike aria-hidden="true" className="size-3.5" />{VEHICLE_LABELS[partner.vehicleType]}</span>}
                {Number(partner?.rating) > 0 && (
                  <span className="inline-flex items-center gap-1" aria-label={`Rating ${Number(partner?.rating).toFixed(1)} out of 5`}>
                    <Star aria-hidden="true" className="size-3.5 text-warning" />{Number(partner?.rating).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Controls: Duty Switch & Sign Out */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live SSE Pulse */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-surface-muted border border-border text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${sseConnected ?'bg-primary' : 'bg-warning'}`} />
              <span className="text-xs font-medium">{sseConnected ? 'Live updates' : 'Syncing'}</span>
            </div>

            {/* Online / Offline Toggle Button */}
            <button
              onClick={handleToggleDuty}
              disabled={partner?.status === 'ON_DELIVERY'}
              className={`flex min-h-11 items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer border disabled:cursor-default ${
                partner?.status ==='ONLINE'
                  ?'bg-success/8 text-success border-success/25 hover:bg-success/15'
                  : 'bg-surface-muted text-muted-foreground border-border hover:bg-surface-muted'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${partner?.status ==='ONLINE' ?'bg-primary' : 'bg-surface'}`} />
              <span>{partner?.status === 'ON_DELIVERY' ? 'Delivering' : partner?.status === 'ONLINE' ? 'On duty' : 'Off duty'}</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="min-h-11 min-w-11 grid place-items-center p-2 rounded-md bg-surface-muted hover:bg-destructive/15 text-muted-foreground hover:text-destructive border border-border hover:border-destructive/25 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Cards */}
        <div aria-label="Rider summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          <div className="bg-primary-light p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Today's earnings</span>
              <Coins aria-hidden="true" className="size-4 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-primary">
              ₹{Number(partner?.earningsToday || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-surface p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Completed deliveries</span>
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">{partner?.totalOrdersCompleted || 0}</div>

          </div>

          <div className="bg-surface p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Cash on hand</span>
              <Coins className="w-4 h-4 text-warning" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
              ₹{Number(partner?.codCollectedToday || 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Deposit at the end of your shift</div>
          </div>

          <div className="bg-surface p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Duty status</span>
              <Radio className={`w-4 h-4 ${partner?.status ==='ONLINE' ?'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {partner?.status ==='ON_DELIVERY' ?'Delivering' : partner?.status ==='ONLINE' ?'Online' : 'Offline'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {partner?.status === 'ON_DELIVERY' ? 'Finish your current delivery' : partner?.status === 'ONLINE' ? 'Available for orders' : 'Go on duty to accept orders'}
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="grid min-w-0 gap-4 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Rider dashboard" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-2 lg:sticky lg:top-24 lg:grid-cols-1">
          <button
            aria-pressed={activeTab ==='available'}
            onClick={() => setActiveTab('available')}
            className={`flex items-center gap-2 min-h-11 px-2.5 py-2 rounded-md text-[13px] font-semibold transition-colors text-left ${
              activeTab ==='available'
                ?'bg-primary-light text-primary'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Available</span>
            {availableOrders.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-primary-light text-primary">
                {availableOrders.length}
              </span>
            )}
          </button>

          <button
            aria-pressed={activeTab ==='active'}
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 min-h-11 px-2.5 py-2 rounded-md text-[13px] font-semibold transition-colors text-left ${
              activeTab ==='active'
                ?'bg-primary-light text-primary'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Active deliveries</span>
            {activeDeliveries.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-primary-light text-primary">
                {activeDeliveries.length}
              </span>
            )}
          </button>

          <button
            aria-pressed={activeTab ==='history'}
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 min-h-11 px-2.5 py-2 rounded-md text-[13px] font-semibold transition-colors text-left ${
              activeTab ==='history'
                ?'bg-primary-light text-primary'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Completed</span>
            {completedDeliveries.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-surface-muted text-muted-foreground">
                {completedDeliveries.length}
              </span>
            )}
          </button>

          <button
            aria-pressed={activeTab ==='profile'}
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 min-h-11 px-2.5 py-2 rounded-md text-[13px] font-semibold transition-colors text-left ${
              activeTab ==='profile'
                ?'bg-primary-light text-primary'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Profile</span>
          </button>
        </nav>
        <div className="min-w-0">

        {/* TAB 1: AVAILABLE ORDERS (First-Acceptance-Wins Broadcast Pool) */}
        {activeTab ==='available' && (
          <div className="space-y-4">
            {/* Offline Alert Banner */}
            {partner?.status ==='OFFLINE' && (
              <div className="p-4 rounded-lg bg-warning/8 border border-warning/25 text-warning flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold">You are currently OFFLINE.</span> Toggle your duty status to ONLINE to start seeing broadcast delivery orders.
                  </div>
                </div>
                <button
                  onClick={handleToggleDuty}
                  className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3.5 py-2 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  Go on duty
                </button>
              </div>
            )}

            {/* Header info */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Available orders
                </h3>
                <p className="text-xs text-muted-foreground">
                  Orders go to the first rider to accept.
                </p>
              </div>
              <button
                onClick={loadAvailableOrders}
                className="flex min-h-11 shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-surface border border-border px-3 py-1.5 rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Orders List */}
            {availableOrders.length === 0 ? (
              <div className="p-5 text-left rounded-lg bg-surface border border-border">
                <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary-light text-primary">
                  <Radio aria-hidden="true" className="size-5" />
                </div>
                <h4 className="font-bold text-foreground text-base">No orders ready for pickup</h4>
                <p className="text-muted-foreground text-sm mt-1">
                  Packed orders will appear here when they’re ready to collect.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {availableOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="bg-surface border border-border rounded-lg p-5 hover:border-success/25 transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-base">{order.orderNumber}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success/8 text-success border border-success/25">
                            Ready for pickup
                          </span>
                        </div>
                        <span className="text-primary font-bold text-lg tabular-nums">
                          +₹{Number(order.estimatedPayout || 50).toFixed(2)}
                        </span>
                      </div>

                      {/* Distance & Time Pill */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs bg-surface-muted rounded-md p-3 mb-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Compass className="w-4 h-4 text-success" />
                          <span>{order.distanceKm} km</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4 text-primary" />
                          <span>~{order.estimatedMinutes} mins</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                          <span className="text-muted-foreground">Cash due</span>
                          <span className="font-bold text-foreground">₹{Number(order.grandTotal).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Route Details */}
                      <div className="space-y-2.5 text-xs mb-5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-success/8 text-success flex items-center justify-center shrink-0 mt-0.5">
                            <Store aria-hidden="true" className="size-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">Pickup</div>
                            <div className="font-semibold text-foreground">{order.storeLocation.name}</div>
                            <div className="text-muted-foreground text-xs">{order.storeLocation.address}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-primary-light text-primary flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin aria-hidden="true" className="size-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">Drop-off</div>
                            <div className="font-semibold text-foreground">
                              {order.deliveryAddress?.recipient_name || order.deliveryAddress?.recipientName ||'Customer'}
                              {order.deliveryAddress?.phone ? ` (${order.deliveryAddress.phone})` : ''}
                            </div>
                            <div className="text-muted-foreground text-xs">{order.dropLocation.address}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                      <button
                        onClick={() => setInspectMapOrder(order)}
                        className="bg-surface-muted hover:bg-surface-muted text-foreground font-semibold text-xs py-2.5 px-3 rounded-md border border-border flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MapIcon className="w-3.5 h-3.5 text-success" />
                        <span>View route</span>
                      </button>

                      <button
                        onClick={() => handleAcceptOrder(order)}
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Accept order</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE DELIVERIES */}
        {activeTab ==='active' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Bike className="w-5 h-5 text-success" />
                  Active deliveries ({activeDeliveries.length})
                </h3>
                <p className="text-xs text-muted-foreground">Update progress from pickup to verified doorstep handover.</p>
              </div>
              <button
                onClick={loadActiveDeliveries}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-surface border border-border px-3 py-1.5 rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {activeDeliveries.length === 0 ? (
              <div className="p-5 text-left rounded-lg bg-surface border border-border">
                <Bike className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-bold text-foreground text-base">No active deliveries right now</h4>
                <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                  You don't have any orders in transit. Check the Available tab to claim an open delivery!
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 bg-primary hover:bg-primary-hover text-white font-bold text-xs px-4 py-2 rounded-md transition-colors cursor-pointer"
                >
                  View Available
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
                      className="bg-surface border border-success/25 rounded-lg p-5 sm:p-6"
                    >
                      {/* Status Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 mb-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-foreground text-lg">{task.orderNumber}</span>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                task.deliveryStatus ==='ASSIGNED'
                                  ?'bg-warning/8 text-warning border-warning/25'
                                  : task.deliveryStatus ==='REACHED_STORE'
                                  ?'bg-primary-light text-primary border-primary/25'
                                  : 'bg-success/8 text-success border-success/25'
                              }`}
                            >
                              {task.deliveryStatus === 'ASSIGNED' && 'Head to pickup'}
                              {task.deliveryStatus === 'REACHED_STORE' && 'At pickup'}
                              {task.deliveryStatus === 'PICKED_UP' && 'Order collected'}
                              {task.deliveryStatus === 'IN_TRANSIT' && 'Out for delivery'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Assigned {new Date(task.assignedAt).toLocaleTimeString()} • Order Value: ₹{Number(task.grandTotal).toFixed(2)}
                          </div>
                        </div>

                        {/* Direct Navigation */}
                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-primary/8 hover:bg-primary/15 text-primary border border-primary/25 font-bold text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition"
                        >
                          <Navigation className="w-4 h-4 text-primary" />
                          <span>Turn-by-Turn GPS</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                        </a>
                      </div>

                      {/* Customer & Locations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-6">
                        <div className="bg-surface-muted border border-border rounded-md p-3.5">
                          <div className="text-xs font-bold text-success mb-1">Store Pickup Hub</div>
                          <div className="font-semibold text-foreground">{task.storeLocation?.name ||'Dark Store #04'}</div>
                          <div className="text-muted-foreground">{task.storeLocation?.address ||'HSR Sector 2, Bengaluru'}</div>
                        </div>

                        <div className="bg-surface-muted border border-border rounded-md p-3.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-destructive">Customer Doorstep Drop</span>
                            {custPhone && (
                              <a
                                href={`tel:${custPhone}`}
                                className="text-success hover:text-success font-bold flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call Customer</span>
                              </a>
                            )}
                          </div>
                          <div className="font-semibold text-foreground">
                            {task.deliveryAddress?.recipient_name || task.deliveryAddress?.recipientName ||'Customer'}
                          </div>
                          <div className="text-muted-foreground">{task.dropLocation?.address ||'Customer doorstep address'}</div>
                        </div>
                      </div>

                      {/* Step Progress Tracker & Action Controls */}
                      <div className="bg-surface-muted border border-border rounded-md p-4">
                        <div className="text-xs font-bold text-muted-foreground mb-3">
                          Fulfillment Action Workflow:
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Step 1: Reached Store */}
                          {task.deliveryStatus ==='ASSIGNED' && (
                            <button
                              onClick={() => handleUpdateDeliveryStep(task,'REACHED_STORE')}
                              disabled={isLoading}
                              className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-4 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <MapPin className="w-4 h-4" />
                              <span>1. I have Reached Dark Store</span>
                            </button>
                          )}

                          {/* Step 2: Picked Up & In Transit */}
                          {(task.deliveryStatus ==='ASSIGNED' || task.deliveryStatus ==='REACHED_STORE') && (
                            <button
                              onClick={() => handleUpdateDeliveryStep(task,'IN_TRANSIT')}
                              disabled={isLoading}
                              className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-4 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
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
                            className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-5 rounded-md flex items-center gap-2 transition-colors cursor-pointer ml-auto"
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
        {activeTab ==='history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Completed ({completedDeliveries.length})
                </h3>
                <p className="text-xs text-muted-foreground">Audit trail of completed drop-offs and verified OTPs.</p>
              </div>
            </div>

            {completedDeliveries.length === 0 ? (
              <div className="p-5 text-left rounded-lg bg-surface border border-border">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-bold text-foreground text-base">No completed deliveries yet today</h4>
                <p className="text-muted-foreground text-xs mt-1">Accept orders and complete doorstep handovers to build your payout!</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto overscroll-x-contain" tabIndex={0} aria-label="Completed deliveries">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted text-muted-foreground border-b border-border font-semibold">
                      <tr>
                        <th className="p-3.5">Order Number</th>
                        <th className="p-3.5">Customer / Address</th>
                        <th className="p-3.5">Delivered Time</th>
                        <th className="p-3.5">Verification PIN</th>
                        <th className="p-3.5">Order Value</th>
                        <th className="p-3.5 text-right">Partner Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {completedDeliveries.map((item) => (
                        <tr key={item.deliveryId} className="hover:bg-surface-muted">
                          <td className="p-3.5 font-bold text-foreground">{item.orderNumber}</td>
                          <td className="p-3.5 text-muted-foreground">
                            <div>{item.deliveryAddress?.recipient_name || item.deliveryAddress?.recipientName ||'Customer'}</div>
                            <div className="text-xs text-muted-foreground">{item.deliveryAddress?.city ||'Bengaluru'}</div>
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {item.deliveredAt ? new Date(item.deliveredAt).toLocaleTimeString() : 'Recent'}
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-success bg-success/8 px-2 py-0.5 rounded border border-success/25">
                              {item.deliveryOtp ||'VERIFIED'}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-foreground">₹{Number(item.grandTotal).toFixed(2)}</td>
                          <td className="p-3.5 text-right font-bold text-success">+₹50.00</td>
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
        {activeTab ==='profile' && (
          <div className="max-w-2xl mx-auto bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center gap-4 border-b border-border pb-6 mb-6">
              <div className="w-16 h-16 rounded-lg bg-primary hover:bg-primary-hover flex items-center justify-center font-bold text-white text-2xl">
                {partner?.fullName?.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{partner?.fullName}</h3>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ID: <span className="font-mono text-muted-foreground">{partner?.id}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-success/8 text-success border border-success/25 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    KYC Verified
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface-muted text-muted-foreground border border-border">
                    Role: Delivery Partner
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-8">
              <div className="bg-surface-muted p-3.5 rounded-md border border-border">
                <span className="text-muted-foreground block mb-1">Mobile Phone</span>
                <span className="font-semibold text-foreground text-sm">{partner?.phone}</span>
              </div>
              <div className="bg-surface-muted p-3.5 rounded-md border border-border">
                <span className="text-muted-foreground block mb-1">Email Address</span>
                <span className="font-semibold text-foreground text-sm">{partner?.email ||'None on file'}</span>
              </div>
              <div className="bg-surface-muted p-3.5 rounded-md border border-border">
                <span className="text-muted-foreground block mb-1">Vehicle Type & Reg Number</span>
                <span className="font-semibold text-foreground text-sm">
                  {partner?.vehicleType && VEHICLE_LABELS[partner.vehicleType]} {partner?.vehicleNumber}
                </span>
              </div>
              <div className="bg-surface-muted p-3.5 rounded-md border border-border">
                <span className="text-muted-foreground block mb-1">Driving License Number</span>
                <span className="font-semibold text-foreground text-sm">{partner?.drivingLicense}</span>
              </div>
              <div className="bg-surface-muted p-3.5 rounded-md border border-border">
                <span className="text-muted-foreground block mb-1">Base Dark Store Hub</span>
                <span className="font-semibold text-foreground text-sm">{partner?.darkStoreName}</span>
              </div>
              <div className="bg-surface-muted p-3.5 rounded-md border border-border">
                <span className="text-muted-foreground block mb-1">Total Lifetime Earnings</span>
                <span className="font-bold text-success text-sm">
                  ₹{Number(partner?.totalEarningsAllTime || partner?.earningsToday || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-border">
              <span className="text-xs text-muted-foreground">Need to update vehicle or bank account? Contact Dark Store Manager.</span>
              <button
                onClick={handleSignOut}
                className="bg-destructive/8 hover:bg-destructive/15 text-destructive border border-destructive/25 font-bold text-xs px-4 py-2 rounded-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
        </div>
        </div>
      </main>

      {/* MODAL 1: INTERACTIVE ROUTE MAP */}
      {inspectMapOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/35">
          <div className="bg-surface border border-border rounded-lg max-w-2xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-lg flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-success" />
                  Route for {inspectMapOrder.orderNumber}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {inspectMapOrder.distanceKm} km • ~{inspectMapOrder.estimatedMinutes || 12} mins travel time
                </p>
              </div>
              <button onClick={() => setInspectMapOrder(null)} aria-label="Close map" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Map Canvas */}
            <div className="w-full h-80 bg-surface-muted relative" ref={mapContainerRef} />

            {/* Bottom Details */}
            <div className="p-4 bg-surface-muted border-t border-border flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-start gap-2"><Store aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /><span><span className="font-semibold">Pickup</span> · {inspectMapOrder.storeLocation?.name}</span></div>
                <div className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span><span className="font-semibold">Drop-off</span> · {inspectMapOrder.dropLocation?.address}</span></div>
              </div>
              <button
                onClick={() => setInspectMapOrder(null)}
                className="bg-surface-muted hover:bg-surface-muted text-foreground font-bold px-4 py-2 rounded-md transition-colors cursor-pointer"
              >
                Close map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OTP HANDOVER VERIFICATION */}
      {otpModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/35">
          <div className="bg-surface border border-success/25 rounded-lg max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-lg">
            <div className="mb-5">
              <div className="w-14 h-14 rounded-lg bg-success/8 text-success flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Enter Customer OTP</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Ask the customer for the 4-digit PIN sent to their WhatsApp & order tracking screen to complete order{''}
                <span className="text-foreground font-bold">{otpModalTask.orderNumber}</span>.
              </p>
            </div>

            {otpError && (
              <div className="mb-5 p-3.5 rounded-md bg-destructive/8 border border-destructive/25 text-destructive text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground text-center mb-2">
                  4-Digit Verification PIN
                </label>
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  placeholder="• • • •"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g,''))}
                  className="w-full text-center tracking-[1em] text-2xl font-bold bg-surface-muted border-2 border-border focus:border-success/25 rounded-lg py-3 text-foreground focus-visible:outline-primary"
                />
                <p className="text-sm font-semibold text-foreground text-center mt-2">
                  Collect ₹{Number(otpModalTask.grandTotal).toFixed(2)} in cash before confirming delivery.
                </p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Ask the customer for the 4-digit PIN sent to their WhatsApp or Live Tracking screen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOtpModalTask(null)}
                  className="bg-surface-muted hover:bg-surface-muted text-muted-foreground font-semibold text-xs py-3 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOtpAndDeliver}
                  disabled={isSubmittingOtp || otpInput.length !== 4}
                  className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-3 rounded-md flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm delivery & cash collected</span>
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
