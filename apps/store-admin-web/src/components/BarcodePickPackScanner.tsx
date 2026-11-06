import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  Printer,
  Bike,
  Volume2,
  VolumeX,
  Sparkles,
  QrCode,
  Tag,
  MapPin,
  Radio,
  Phone,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { scanPickItemBarcode, fetchOrderPickList, markOrderReadyForDelivery } from '../api/adminClient';

interface BarcodePickPackScannerProps {
  ordersInPicking: Array<{
    orderNumber: string;
    id?: string;
    readyForPickup?: boolean;
    orderStatus?: string;
  }>;
  onOrderCompleted?: (orderNumber: string, bagCode: string) => void;
  onSwitchToFleet?: () => void;
}

export const BarcodePickPackScanner: React.FC<BarcodePickPackScannerProps> = ({
  ordersInPicking,
  onOrderCompleted,
  onSwitchToFleet,
}) => {
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>(
    ordersInPicking[0]?.orderNumber || ''
  );
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);

  // Pick list state
  const [pickListData, setPickListData] = useState<any | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);

  // Scan feedback state
  const [lastScanResult, setLastScanResult] = useState<{
    type: 'success' | 'error' | 'already_picked';
    message: string;
    item?: any;
  } | null>(null);

  // Final Bag Packing state
  const [completedBagCode, setCompletedBagCode] = useState<string | null>(null);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isReadyForDelivery, setIsReadyForDelivery] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep selected order updated when ordersInPicking changes
  useEffect(() => {
    if (!selectedOrderNumber && ordersInPicking.length > 0) {
      setSelectedOrderNumber(ordersInPicking[0].orderNumber);
    }
  }, [ordersInPicking, selectedOrderNumber]);

  // Load pick list whenever selected order changes
  useEffect(() => {
    if (selectedOrderNumber) {
      loadPickList(selectedOrderNumber);
    }
  }, [selectedOrderNumber]);

  // Keep input focused for physical USB/Bluetooth handheld barcode scanners
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedOrderNumber, lastScanResult]);

  const loadPickList = async (orderNum: string) => {
    const cleanNum = (orderNum || '').replace(/^#/, '').trim();
    if (!cleanNum) return;
    setIsLoadingOrder(true);
    setLastScanResult(null);
    setCompletedBagCode(null);
    setIsReadyForDelivery(false);
    try {
      const data = await fetchOrderPickList(cleanNum);
      setPickListData(data);
      const isPickDone = data?.isCompleted || (data?.totalItems > 0 && data?.pickedItems === data?.totalItems);
      const isOrderStatusPackedOrMore = ['PACKED', 'DISPATCHED', 'DELIVERED'].includes(data?.pickList?.orderStatus);
      if (isPickDone || isOrderStatusPackedOrMore) {
        setCompletedBagCode(`BAG-${cleanNum}-VERIFIED`);
      }
      const matched = ordersInPicking.find((o) => o.orderNumber.replace(/^#/, '') === cleanNum);
      const isReady =
        matched?.readyForPickup ||
        data?.pickList?.readyForPickup ||
        data?.pickList?.ready_for_pickup ||
        data?.pickList?.assignedRiderName ||
        isOrderStatusPackedOrMore;
      if (isReady) {
        setIsReadyForDelivery(true);
      }
    } catch (err) {
      console.error('Failed to load pick list', err);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const handleCopySeal = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleMarkReadyForDelivery = async () => {
    const cleanNum = (selectedOrderNumber || '').replace(/^#/, '').trim();
    const orderId =
      pickListData?.orderId ||
      pickListData?.pickList?.orderId ||
      pickListData?.pickList?.order_id ||
      ordersInPicking.find((o) => o.orderNumber.replace(/^#/, '') === cleanNum)?.id ||
      cleanNum;

    if (!orderId) {
      alert(`Could not resolve orderId for ${selectedOrderNumber}. Please check order details.`);
      return;
    }

    try {
      setIsMarkingReady(true);
      const res = await markOrderReadyForDelivery(orderId);
      setIsReadyForDelivery(true);
      playBeep('success');

      // Refresh pick list in place so rider assignment & broadcast status are immediately visible
      await loadPickList(cleanNum);

      if (onOrderCompleted) {
        onOrderCompleted(cleanNum, completedBagCode || `BAG-${cleanNum}-VERIFIED`);
      }
    } catch (err: any) {
      alert(`Failed to broadcast order to delivery partners: ${err.message}`);
    } finally {
      setIsMarkingReady(false);
    }
  };

  // Play audio sound via Web Audio API (no external asset downloads)
  const playBeep = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1175, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // AudioContext may be restricted by browser policy before first user gesture
    }
  };

  const handleScanSubmit = async (e?: React.FormEvent, manualBarcode?: string) => {
    if (e) e.preventDefault();
    const barcodeToVerify = (manualBarcode || barcodeInput).trim();
    if (!barcodeToVerify || !selectedOrderNumber) return;

    setIsScanning(true);
    setLastScanResult(null);

    try {
      const res = await scanPickItemBarcode({
        barcode: barcodeToVerify,
        orderNumber: selectedOrderNumber,
      });

      if (res.success && res.data) {
        playBeep('success');
        setLastScanResult({
          type: res.data.alreadyPicked ? 'already_picked' : 'success',
          message: res.data.message || 'Item verified successfully!',
          item: res.data.item,
        });

        if (res.data.isOrderComplete && res.data.bagSealCode) {
          setCompletedBagCode(res.data.bagSealCode);
          setIsReadyForDelivery(true);
          if (onOrderCompleted) {
            onOrderCompleted(selectedOrderNumber, res.data.bagSealCode);
          }
        }

        // Refresh local items
        await loadPickList(selectedOrderNumber);
        setBarcodeInput('');
      } else {
        playBeep('error');
        setLastScanResult({
          type: 'error',
          message: res.error || `Barcode "${barcodeToVerify}" does not belong to this order!`,
        });
      }
    } catch (err: any) {
      playBeep('error');
      setLastScanResult({
        type: 'error',
        message: err.message || 'Scanner request failed.',
      });
    } finally {
      setIsScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Toggle physical camera
  const toggleCamera = async () => {
    if (cameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } catch (err) {
        alert('Camera access denied or unavailable. You can use the handheld laser input or 1-click test buttons.');
      }
    }
  };

  const items = pickListData?.items || [];
  const totalItems = pickListData?.totalItems || 0;
  const pickedItems = pickListData?.pickedItems || 0;
  const progressPercent = pickListData?.progressPercent || 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#007a55] flex items-center justify-center border border-emerald-200">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Dark Store Pick & Pack Scanner</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-[#007a55] uppercase tracking-wide">
                  Live Barcode Validation
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Scan product SKUs or barcodes before packing. Prevents wrong-item dispatch with audio-visual alerts.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-[#007a55]'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
              title={soundEnabled ? 'Buzzer sound enabled' : 'Buzzer sound muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Sound ON' : 'Muted'}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                cameraActive
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{cameraActive ? 'Stop Camera' : 'Open Camera'}</span>
            </button>

            <button
              onClick={() => selectedOrderNumber && loadPickList(selectedOrderNumber)}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              title="Refresh pick list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingOrder ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Order Selector Tabs */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">
            Active Orders:
          </span>
          {ordersInPicking.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No orders currently waiting to be picked.</span>
          ) : (
            ordersInPicking.map((ord) => {
              const cleanOrdNum = ord.orderNumber.replace(/^#/, '');
              const cleanSelected = (selectedOrderNumber || '').replace(/^#/, '');
              const isSelected = cleanOrdNum === cleanSelected;
              return (
                <button
                  key={ord.orderNumber}
                  onClick={() => setSelectedOrderNumber(cleanOrdNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#007a55] text-white shadow-xs ring-2 ring-[#007a55]/20'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>#{cleanOrdNum}</span>
                  {ord.readyForPickup && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" title="Ready for Delivery" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Grid: Scanner Left, Pick List Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Barcode Gun / Camera Reticle (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">
                  Laser Scanner Ready
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Order: #{selectedOrderNumber || 'NONE'}
              </span>
            </div>

            {/* Camera Viewport or Digital Reticle */}
            <div className="relative w-full aspect-4/3 bg-slate-950 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
              {cameraActive ? (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <QrCode className="w-16 h-16 text-slate-600 mx-auto opacity-40 animate-pulse" />
                  <p className="text-xs font-mono text-slate-400">
                    Handheld Laser Scanner active.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Point your barcode gun at product or test with buttons below.
                  </p>
                </div>
              )}

              {/* Laser Scanning Animation Beam */}
              <div className="absolute inset-x-0 h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-bounce pointer-events-none" />

              {/* Target Reticle corners */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />
            </div>

            {/* Handheld Gun Barcode Input Form */}
            <form onSubmit={handleScanSubmit} className="mt-4 space-y-2">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Barcode / SKU Input (Gun or Keyboard):
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="e.g. DAI-AMU-BUT-500"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  disabled={isScanning || !selectedOrderNumber}
                />
                <button
                  type="submit"
                  disabled={isScanning || !barcodeInput.trim()}
                  className="px-4 py-2 bg-[#007a55] hover:bg-[#006345] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isScanning ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>

            {/* Real-time Scan Result Banner */}
            {lastScanResult && (
              <div
                className={`mt-4 p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                  lastScanResult.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : lastScanResult.type === 'already_picked'
                    ? 'bg-blue-950/80 border-blue-500/50 text-blue-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                }`}
              >
                {lastScanResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : lastScanResult.type === 'already_picked' ? (
                  <Package className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {lastScanResult.type === 'success'
                      ? '✓ Barcode Matched & Verified!'
                      : lastScanResult.type === 'already_picked'
                      ? 'Notice: Already Picked'
                      : '⚠️ Mismatch Error!'}
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-90">{lastScanResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Quick-Scan Helper Pill Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>FEFO Expiry & Bag Verification Guide</span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Dark store warehouse staff must pick the earliest expiry batch first. Scanning auto-increments quantity and locks item into the order bag.
            </p>
          </div>
        </div>

        {/* Right Column: Order Items Pick Checklist (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Order Progress Summary Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Order Pick Progress
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-0.5">
                  Order #{(selectedOrderNumber || '—').replace(/^#/, '')}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-[#007a55]">
                  {pickedItems} / {totalItems}
                </span>
                <span className="text-xs text-gray-400 ml-1">items picked</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#007a55] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Bag Completed / Seal Banner */}
            {completedBagCode && (
              <div className="mt-4 rounded-2xl bg-white border border-emerald-200/90 shadow-xs overflow-hidden">
                {/* Header Strip */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-emerald-50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black uppercase tracking-wider text-emerald-950">
                          Order Bag Packed & Sealed
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          100% Verified
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-700 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-500">Bag Seal:</span>
                        <button
                          type="button"
                          onClick={() => handleCopySeal(completedBagCode)}
                          className="font-bold text-emerald-900 bg-white hover:bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300/80 shadow-2xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                          title="Click to copy seal code"
                        >
                          <span>{completedBagCode}</span>
                          {copiedCode ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Delivery Status Pill */}
                  <div>
                    {pickListData?.pickList?.deliveryStatus === 'DELIVERED' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Delivered to Customer</span>
                      </span>
                    ) : pickListData?.pickList?.deliveryStatus === 'IN_TRANSIT' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                        <Bike className="w-3.5 h-3.5 text-sky-600" />
                        <span>Out for Delivery</span>
                      </span>
                    ) : pickListData?.pickList?.deliveryStatus === 'REACHED_STORE' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Rider at Store</span>
                      </span>
                    ) : pickListData?.pickList?.assignedRiderName ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                        <Bike className="w-3.5 h-3.5 text-purple-600" />
                        <span>Assigned to {pickListData.pickList.assignedRiderName}</span>
                      </span>
                    ) : isReadyForDelivery ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span>Broadcasting to Delivery Partners</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
                        <Package className="w-3.5 h-3.5 text-gray-500" />
                        <span>Packed • Awaiting Broadcast</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Delivery Information / Status Note */}
                <div className="px-4 py-3 bg-white text-xs">
                  {pickListData?.pickList?.assignedRiderName ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-50/50 border border-purple-200/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                          {pickListData.pickList.assignedRiderName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">
                            {pickListData.pickList.assignedRiderName}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            {pickListData.pickList.assignedRiderPhone || 'Phone hidden'} • Status: {pickListData.pickList.deliveryStatus || 'ASSIGNED'}
                          </div>
                        </div>
                      </div>
                      {pickListData.pickList.assignedRiderPhone && (
                        <a
                          href={`tel:${pickListData.pickList.assignedRiderPhone}`}
                          className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-800 text-[11px] font-bold flex items-center gap-1 w-fit hover:bg-purple-50 transition"
                        >
                          <Phone className="w-3 h-3 text-purple-600" />
                          <span>Call Rider</span>
                        </a>
                      )}
                    </div>
                  ) : isReadyForDelivery ? (
                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-amber-900 flex items-start gap-2">
                      <Radio className="w-4 h-4 text-amber-600 mt-0.5 shrink-0 animate-pulse" />
                      <div className="text-[11px] leading-relaxed">
                        <strong>Live Broadcast Pool Active:</strong> This order is visible to all online delivery partners in their dedicated portal. The first partner to click Accept gets assigned via atomic first-acceptance-wins logic.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 text-gray-600 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div className="text-[11px] leading-relaxed">
                        All items have been verified. Click <strong>Mark Ready for Delivery</strong> to immediately broadcast this order to nearby online delivery partners.
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleMarkReadyForDelivery}
                    disabled={isMarkingReady || isReadyForDelivery}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-xs transition ${
                      isReadyForDelivery
                        ? 'bg-amber-600 opacity-90 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                    }`}
                  >
                    {isMarkingReady ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isReadyForDelivery ? (
                      <Radio className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Bike className="w-4 h-4" />
                    )}
                    <span>
                      {isReadyForDelivery
                        ? pickListData?.pickList?.assignedRiderName
                          ? '✓ Rider Assigned'
                          : '📡 Broadcasting to Fleet'
                        : '🚀 Mark Ready for Delivery'}
                    </span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                  >
                    <Printer className="w-4 h-4 text-gray-500" />
                    <span>Print Label</span>
                  </button>

                  {onSwitchToFleet && (
                    <button
                      onClick={onSwitchToFleet}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                    >
                      <Bike className="w-4 h-4 text-emerald-400" />
                      <span>Rider Fleet Hub</span>
                    </button>
                  )}

                  <a
                    href="/delivery/login"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-[#007a55] flex items-center gap-1.5 transition sm:ml-auto"
                    title="Open Dedicated Delivery Partner Portal in a new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Partner Portal</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Items Checklist Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Items to Pick & Verify
                </h4>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">
                Zone: {pickListData?.pickList?.zone || 'Zone A-01-R1'}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                {isLoadingOrder ? 'Loading pick list items...' : 'No items found for this order.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((it: any) => {
                  const isPicked = it.status === 'PICKED';
                  return (
                    <div
                      key={it.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isPicked ? 'bg-emerald-50/30' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Checkbox / Icon */}
                        <div className="mt-0.5">
                          {isPicked ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold text-xs ${
                                isPicked ? 'text-gray-500 line-through' : 'text-gray-900'
                              }`}
                            >
                              {it.productName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-600">
                              Qty: {it.quantityRequested}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-gray-400" />
                              {it.sku}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              Bin: {it.batchNumber || 'Aisle 2 - C4'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action: 1-Click Scan Test Button */}
                      <div className="flex items-center gap-2 sm:self-center shrink-0">
                        {isPicked ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                            ✓ Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleScanSubmit(undefined, it.sku)}
                            disabled={isScanning}
                            className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-[#007a55] text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                          >
                            <Scan className="w-3.5 h-3.5" />
                            <span>Simulate Scan</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

