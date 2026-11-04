import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Home,
  Briefcase,
  Plus,
  Check,
  Trash2,
  Navigation,
  Compass,
  Crosshair,
  ExternalLink,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CustomerSavedAddress,
  fetchCustomerAddresses,
  saveCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  getStoredCustomerSession,
} from '../api/client';

interface AddressSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAddress: CustomerSavedAddress | null;
  onSelectAddress: (address: CustomerSavedAddress) => void;
}

export const AddressSelectorModal: React.FC<AddressSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedAddress,
  onSelectAddress,
}) => {
  const [addresses, setAddresses] = useState<CustomerSavedAddress[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [label, setLabel] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [pincode, setPincode] = useState('560102');
  const [isDefault, setIsDefault] = useState(false);

  // Map & GPS Pin State
  const [lat, setLat] = useState<number>(12.914142);
  const [lng, setLng] = useState<number>(77.641151);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Locality quick-pick presets in Bengaluru
  const presets = [
    { name: 'HSR Layout', lat: 12.914142, lng: 77.641151, street: '12th Main Road, HSR Sector 2', pin: '560102' },
    { name: 'Bellandur / ORR', lat: 12.927923, lng: 77.683058, street: 'Outer Ring Road, Near TechVillage', pin: '560103' },
    { name: 'Koramangala', lat: 12.935242, lng: 77.624512, street: '80 Feet Road, 4th Block', pin: '560034' },
    { name: 'Indiranagar', lat: 12.978411, lng: 77.640825, street: '100 Feet Road, HAL 2nd Stage', pin: '560038' },
    { name: 'Whitefield', lat: 12.969820, lng: 77.750012, street: 'ITPL Main Road, Whitefield', pin: '560066' },
  ];

  useEffect(() => {
    if (isOpen) {
      loadAddresses();
      const session = getStoredCustomerSession();
      if (session?.user?.phone && !phone) {
        setPhone(session.user.phone);
      }
      if (session?.user?.fullName && session.user.fullName !== 'Customer' && !recipientName) {
        setRecipientName(session.user.fullName);
      }
    }
  }, [isOpen]);

  // Initialize or update Leaflet Map when opening "Add New Address" form
  useEffect(() => {
    if (!isAddingNew || !mapContainerRef.current) return;

    // Cleanup previous map instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    // Custom emerald pin with pulsing locator dot
    const pinIcon = L.divIcon({
      className: 'freshcart-doorstep-pin',
      html: `
        <div style="position: relative; width: 36px; height: 36px;">
          <div style="
            background: #007a55;
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          ">
            <div style="
              width: 10px;
              height: 10px;
              background-color: #ffffff;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
          <div style="
            position: absolute;
            bottom: -6px;
            left: 12px;
            width: 12px;
            height: 6px;
            background: rgba(0,0,0,0.25);
            border-radius: 50%;
            filter: blur(1px);
          "></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    });

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: pinIcon,
    }).addTo(map);
    markerRef.current = marker;

    marker.bindPopup('<b>Exact Doorstep Location</b><br/>Drag to fine-tune your entrance').openPopup();

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setLat(pos.lat);
      setLng(pos.lng);
      reverseGeocode(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      marker.openPopup();
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    // Invalidate map size after animation
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isAddingNew]);

  const loadAddresses = async () => {
    const list = await fetchCustomerAddresses();
    setAddresses(list);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await res.json();
      if (data && data.address) {
        const road = data.address.road || data.address.suburb || data.address.neighbourhood || '';
        const suburb = data.address.suburb || data.address.city_district || '';
        const pin = data.address.postcode || '';
        if (road || suburb) {
          setStreet(`${road}${road && suburb ? ', ' : ''}${suburb}`);
        }
        if (pin && !pincode) {
          setPincode(pin);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
        }
        reverseGeocode(latitude, longitude);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation notice:', err.message);
        setIsLocating(false);
        alert('Could not access current GPS position. Please drag the pin on the map to set your location.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSelectPreset = (p: typeof presets[0]) => {
    setLat(p.lat);
    setLng(p.lng);
    setStreet(p.street);
    setPincode(p.pin);
    if (markerRef.current) {
      markerRef.current.setLatLng([p.lat, p.lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([p.lat, p.lng], 16);
    }
  };

  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !street || !pincode) {
      alert('Please fill in Recipient Name, Street Address, and Pincode.');
      return;
    }

    const session = getStoredCustomerSession();
    const activePhone = phone || session?.user?.phone || '+917745860406';

    setIsSaving(true);
    try {
      const newAddr = await saveCustomerAddress({
        id: `addr_${Date.now()}`,
        label,
        recipientName,
        phone: activePhone,
        flatNumber,
        street,
        landmark,
        city,
        pincode,
        isDefault,
        lat,
        lng,
      });

      onSelectAddress(newAddr);
      setIsAddingNew(false);
      setFlatNumber('');
      setStreet('');
      setLandmark('');
      setIsDefault(false);
      await loadAddresses();
    } catch (err: any) {
      alert(`Failed to save address: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (confirm('Are you sure you want to delete this saved address?')) {
      await deleteCustomerAddress(id);
      await loadAddresses();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#007a55]" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Delivery Addresses</h3>
              <p className="text-xs text-slate-500">Select or mark exact doorstep location on map</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {!isAddingNew ? (
            <>
              {/* Add New Address Button */}
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-[#007a55]/40 hover:border-[#007a55] hover:bg-emerald-50/50 text-[#007a55] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Delivery Address & Mark on Map</span>
              </button>

              {/* Saved Addresses List */}
              <div className="space-y-3 pt-2">
                {addresses.map((addr) => {
                  const isSelected =
                    selectedAddress?.id === addr.id ||
                    (selectedAddress?.street === addr.street && selectedAddress?.pincode === addr.pincode);
                  return (
                    <div
                      key={addr.id || addr.street}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-[#007a55] bg-emerald-50/40 shadow-xs ring-1 ring-[#007a55]/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      onClick={() => {
                        onSelectAddress(addr);
                        onClose();
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              addr.label === 'HOME'
                                ? 'bg-blue-100 text-blue-800'
                                : addr.label === 'WORK'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {addr.label === 'HOME' ? (
                              <Home className="w-3 h-3" />
                            ) : addr.label === 'WORK' ? (
                              <Briefcase className="w-3 h-3" />
                            ) : (
                              <MapPin className="w-3 h-3" />
                            )}
                            <span>{addr.label}</span>
                          </span>

                          {addr.isDefault ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (addr.id) {
                                  await setDefaultCustomerAddress(addr.id);
                                  await loadAddresses();
                                }
                              }}
                              className="text-[10px] text-slate-500 hover:text-[#007a55] underline cursor-pointer"
                            >
                              Set as Default
                            </button>
                          )}

                          {/* GPS Coordinates Badge if set */}
                          {addr.lat && addr.lng && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                              <Crosshair className="w-2.5 h-2.5 text-[#007a55]" />
                              <span>Map Pin Locked ({Number(addr.lat).toFixed(4)}, {Number(addr.lng).toFixed(4)})</span>
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#007a55] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900">{addr.recipientName}</div>
                        <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {addr.flatNumber ? `${addr.flatNumber}, ` : ''}
                          {addr.street}
                          {addr.landmark ? `, Near ${addr.landmark}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {addr.city} — {addr.pincode} • Phone: {addr.phone}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-[#007a55] font-bold flex items-center gap-1">
                          {isSelected ? '✓ Selected Delivery Address' : 'Tap to select this address'}
                        </span>

                        <div className="flex items-center gap-2">
                          {addr.lat && addr.lng && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${addr.lat},${addr.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-[#007a55] p-1 flex items-center gap-1 text-[10px]"
                              title="Preview Doorstep GPS on Google Maps"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="hidden sm:inline">Map</span>
                            </a>
                          )}

                          {addr.id && !addr.isDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(addr.id);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              title="Delete Address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Add New Address Form with Interactive Map Pin-Picker */
            <form onSubmit={handleAddNewSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[#007a55]" />
                  <span>Mark Doorstep Location & Details</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-xs text-[#007a55] font-semibold hover:underline cursor-pointer"
                >
                  Back to List
                </button>
              </div>

              {/* Interactive Map Container */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    📍 Pin Exact Doorstep Location
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="text-[11px] font-bold text-[#007a55] hover:text-[#005a3e] bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Crosshair className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>{isLocating ? 'Detecting GPS...' : 'Use Current Location'}</span>
                  </button>
                </div>

                {/* Map Div */}
                <div
                  ref={mapContainerRef}
                  className="w-full h-48 sm:h-52 rounded-xl overflow-hidden border border-slate-300 relative shadow-inner z-0"
                  style={{ minHeight: '190px' }}
                />

                {/* Live GPS Coordinates Indicator */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-mono">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-[#007a55]" />
                    <span className="font-semibold text-slate-800">
                      GPS: {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                  </span>
                  <span className="text-emerald-700 font-sans font-bold text-[10px]">
                    ✓ Pin Draggable on Map
                  </span>
                </div>

                {/* Quick Locality Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar">
                  <span className="text-[10px] text-slate-500 font-bold shrink-0">Quick Locality:</span>
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className="text-[10px] font-medium bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#007a55] border border-slate-200 rounded-md px-2 py-0.5 shrink-0 transition-colors cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address Label Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['HOME', 'WORK', 'OTHER'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLabel(t)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        label === t
                          ? 'border-[#007a55] bg-emerald-50 text-[#007a55]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'HOME' ? (
                        <Home className="w-3.5 h-3.5" />
                      ) : t === 'WORK' ? (
                        <Briefcase className="w-3.5 h-3.5" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abhinav Badhe"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                  />
                </div>
              </div>

              {/* Flat & Street */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Flat / House / Floor No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flat 402, 4th Floor, Tower B"
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Street Address & Locality (Auto-fills from Map Pin) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12th Main Road, Sector 2, HSR Layout"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                />
              </div>

              {/* Landmark, City & Pincode */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    placeholder="Near BDA Complex"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#007a55]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultAddrCheck"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-[#007a55] focus:ring-[#007a55]"
                />
                <label htmlFor="defaultAddrCheck" className="text-xs text-slate-600 cursor-pointer">
                  Make this my default delivery address
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#007a55] hover:bg-[#006345] text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save & Lock Doorstep Pin'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
