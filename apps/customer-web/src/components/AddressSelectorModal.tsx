import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Home,
  Briefcase,
  Plus,
  Check,
  Trash2,
  Navigation,
} from 'lucide-react';
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

  const loadAddresses = async () => {
    const list = await fetchCustomerAddresses();
    setAddresses(list);
  };

  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !street || !pincode) {
      alert('Please fill in Recipient Name, Street Address, and Pincode.');
      return;
    }

    const session = getStoredCustomerSession();
    const activePhone = phone || session?.user?.phone || '+917774094369';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#007a55]" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Delivery Addresses</h3>
              <p className="text-xs text-slate-500">Select or manage saved delivery locations</p>
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
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isAddingNew ? (
            <>
              {/* Add New Address Button */}
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-[#007a55]/40 hover:border-[#007a55] hover:bg-emerald-50/50 text-[#007a55] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Delivery Address</span>
              </button>

              {/* Saved Addresses List */}
              <div className="space-y-3 pt-2">
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.id === addr.id || (selectedAddress?.street === addr.street && selectedAddress?.pincode === addr.pincode);
                  return (
                    <div
                      key={addr.id || addr.street}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-[#007a55] bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      onClick={() => {
                        onSelectAddress(addr);
                        onClose();
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
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
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Default</span>
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
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#007a55] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900">{addr.recipientName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {addr.flatNumber ? `${addr.flatNumber}, ` : ''}
                          {addr.street}
                          {addr.landmark ? `, Near ${addr.landmark}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {addr.city} — {addr.pincode} • Phone: {addr.phone}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-[#007a55] font-bold">
                          {isSelected ? '✓ Active Delivery Address' : 'Tap to select'}
                        </span>
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
                  );
                })}
              </div>
            </>
          ) : (
            /* Add New Address Form */
            <form onSubmit={handleAddNewSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Add New Address</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-xs text-[#007a55] font-semibold hover:underline cursor-pointer"
                >
                  Back to List
                </button>
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
                  Flat / House / Floor No.
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
                  Street Address & Locality *
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
                    placeholder="Near Metro"
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
                  className="px-5 py-2 bg-[#007a55] hover:bg-[#006345] text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save & Deliver Here'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

