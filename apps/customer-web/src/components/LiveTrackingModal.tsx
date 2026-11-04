import React, { useState, useEffect } from 'react';
import {
  X,
  Bike,
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { CustomerOrder } from './OrderHistoryModal';

interface LiveTrackingModalProps {
  order: CustomerOrder;
  isOpen: boolean;
  onClose: () => void;
}

interface TrackingData {
  deliveryId?: string;
  orderNumber: string;
  riderName?: string;
  riderPhone?: string;
  deliveryStatus?: string;
  currentLat?: number;
  currentLng?: number;
  etaMinutes?: number;
  deliveryOtp?: string;
  proofSignature?: string;
  proofNotes?: string;
  assignedAt?: string;
  dispatchedAt?: string;
  orderStatus: string;
  deliveryAddress?: any;
  grandTotal?: number;
}

export const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bikeProgress, setBikeProgress] = useState(65); // percentage along the road (0 - 100)
  const [mapMode, setMapMode] = useState<'osm' | 'graphic'>('osm');

  const fetchTracking = async () => {
    try {
      const res = await fetch(`/api/v1/fulfillment/deliveries/${order.id || order.orderNumber}/tracking`);
      const data = await res.json();
      if (data.success && data.data) {
        setTracking(data.data);
        if (data.data.deliveryStatus === 'IN_TRANSIT') {
          setBikeProgress(75);
        } else if (data.data.deliveryStatus === 'DELIVERED') {
          setBikeProgress(100);
        } else {
          setBikeProgress(30);
        }
      }
    } catch (err: any) {
      console.warn('Live tracking fetch error:', err.message);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetchTracking().finally(() => setIsLoading(false));

    // Live polling every 5 seconds
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, [isOpen, order]);

  if (!isOpen) return null;

  const hasRider = Boolean(tracking?.riderName);
  const currentStatus = tracking?.deliveryStatus || (order.status === 'DISPATCHED' ? 'IN_TRANSIT' : order.status);
  const eta = tracking?.etaMinutes || 10;
  const riderName = tracking?.riderName || 'Assigning nearest delivery partner...';
  const riderPhone = tracking?.riderPhone;
  const currentLat = tracking?.currentLat || 12.914142;
  const currentLng = tracking?.currentLng || 77.641151;
  const doorstepStreet = (order as any)?.deliveryAddress?.street || 'Customer Doorstep';

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 relative flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="bg-[#007a55] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Bike className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Live Hyperlocal Delivery</h3>
              <p className="text-[11px] text-emerald-100 font-mono">Order #{order.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status & ETA Card */}
        <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-emerald-900">
              {currentStatus === 'DELIVERED'
                ? 'Delivered to Doorstep 🎉'
                : currentStatus === 'IN_TRANSIT'
                ? 'Rider is on the way! 🛵'
                : 'Packing at Dark Store'}
            </span>
          </div>
          {currentStatus !== 'DELIVERED' && (
            <div className="text-right">
              <span className="text-[10px] text-emerald-700 uppercase font-semibold">Estimated Arrival</span>
              <div className="text-sm font-black text-emerald-900">~{eta} mins</div>
            </div>
          )}
        </div>

        {/* Real Delivery Verification PIN Card */}
        {currentStatus !== 'DELIVERED' && (tracking?.deliveryOtp || true) && (
          <div className="bg-amber-50 px-5 py-2.5 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <div>
                <p className="text-[11px] font-bold text-amber-900">Delivery Handover PIN</p>
                <p className="text-[9px] text-amber-700">Share with rider only when items arrive at doorstep</p>
              </div>
            </div>
            <div className="bg-amber-200/80 px-2.5 py-1 rounded-md border border-amber-300 font-mono font-black text-sm text-amber-950 tracking-wider">
              {tracking?.deliveryOtp || '----'}
            </div>
          </div>
        )}

        {/* Real GPS Map / Route Toggle */}
        <div className="px-5 pt-3 pb-1 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700">
            <Compass className="w-3.5 h-3.5 text-[#007a55]" />
            <span>Telemetry: {currentLat.toFixed(4)}° N, {currentLng.toFixed(4)}° E</span>
          </div>
          <div className="flex rounded-md p-0.5 bg-gray-200 text-[10px] font-semibold">
            <button
              onClick={() => setMapMode('osm')}
              className={`px-2 py-0.5 rounded cursor-pointer ${mapMode === 'osm' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'}`}
            >
              Real OSM Map
            </button>
            <button
              onClick={() => setMapMode('graphic')}
              className={`px-2 py-0.5 rounded cursor-pointer ${mapMode === 'graphic' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'}`}
            >
              Route Graphic
            </button>
          </div>
        </div>

        {/* Interactive GPS Visual Route Map / OSM Embed */}
        <div className="p-4 bg-gray-50 flex-1">
          {mapMode === 'osm' ? (
            <div className="relative w-full h-52 bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-300">
              <iframe
                title="OpenStreetMap Live Telemetry"
                className="w-full h-full border-0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentLng - 0.015}%2C${currentLat - 0.012}%2C${currentLng + 0.015}%2C${currentLat + 0.012}&layer=mapnik&marker=${currentLat}%2C${currentLng}`}
              />
              <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] px-2 py-1 rounded-md flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Rider GPS Telemetry</span>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-48 bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800 p-4 flex flex-col justify-between">
              {/* Dark Store Pin (Top-Left) */}
              <div className="flex items-center gap-2 text-white z-10">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white">Dark Store #04</div>
                  <div className="text-[9px] text-slate-400">HSR Layout Micro-Warehouse</div>
                </div>
              </div>

              {/* Animated Road Graphic */}
              <div className="relative w-full py-6">
                <div className="w-full h-2 bg-slate-800 rounded-full relative overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-linear-to-r from-emerald-500 via-teal-400 to-[#007a55] transition-all duration-700"
                    style={{ width: `${bikeProgress}%` }}
                  />
                </div>

                <div
                  className="absolute top-1/2 -translate-y-1/2 -ml-4 transition-all duration-700"
                  style={{ left: `${Math.min(92, Math.max(8, bikeProgress))}%` }}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-[#007a55] text-white flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-emerald-500/30">
                      <Bike className="w-4 h-4" />
                    </div>
                    {currentStatus === 'IN_TRANSIT' && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Doorstep Pin (Bottom-Right) */}
              <div className="flex items-center justify-end gap-2 text-white z-10">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-white">Your Doorstep</div>
                  <div className="text-[9px] text-slate-400">{doorstepStreet}</div>
                </div>
                <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-rose-400" />
                </div>
              </div>
            </div>
          )}

          {/* Rider Profile Card */}
          <div className="mt-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#007a55] font-bold text-sm">
                {riderName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-gray-900">{riderName}</span>
                  {hasRider && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                      4.9 ★
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {hasRider ? 'Electric Scooter Partner • Express Delivery' : 'Matching rider in your zone'}
                </p>
              </div>
            </div>

            {hasRider && riderPhone ? (
              <a
                href={`tel:${riderPhone}`}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#007a55] rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Rider</span>
              </a>
            ) : (
              <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                Dispatching...
              </span>
            )}
          </div>

          {/* Milestone Step Timeline */}
          <div className="mt-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2.5 text-xs">
            <div className="font-bold text-gray-900 text-[11px] uppercase tracking-wider">
              Delivery Milestones
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Order Packed & Quality-Checked at Dark Store</span>
              </div>
              <div
                className={`flex items-center gap-2.5 ${
                  currentStatus === 'IN_TRANSIT' || currentStatus === 'DELIVERED'
                    ? 'text-emerald-700 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {currentStatus === 'IN_TRANSIT' || currentStatus === 'DELIVERED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 shrink-0" />
                )}
                <span>Rider Dispatched & On the Way (GPS Active)</span>
              </div>
              <div
                className={`flex items-center gap-2.5 ${
                  currentStatus === 'DELIVERED' ? 'text-emerald-700 font-bold' : 'text-gray-400'
                }`}
              >
                {currentStatus === 'DELIVERED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 shrink-0" />
                )}
                <span>Doorstep Delivery & Handover</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Live GPS Polling Active (Every 5s)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

