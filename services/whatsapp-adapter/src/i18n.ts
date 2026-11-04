export type SupportedLanguage = 'en' | 'hi' | 'hi-Latn';

export interface LocalizedMessages {
  greeting: string;
  cartHeader: string;
  cartEmpty: string;
  itemAdded: (product: string, variant: string, price: number, count: number, total: number) => string;
  itemOutOfStock: (product: string, variant: string) => string;
  alternativeSuggested: (product: string, altName: string, price: number) => string;
  orderConfirmed: (orderNumber: string, total: number, address: string) => string;
  orderCancellation: (orderNumber: string) => string;
  chooseLanguage: string;
}

export const LOCALIZED_STRINGS: Record<SupportedLanguage, LocalizedMessages> = {
  en: {
    greeting: `👋 *Welcome to FreshCart Omnichannel Grocery!*\n\nHow can I help you today? You can:\n• Send a shopping list (e.g. *"2 Amul milk, 1 Aashirvaad atta, 500g paneer"*)\n• Send a voice note 🎙️\n• Upload a photo of your handwritten grocery note 📸\n• Type *LANGUAGE* to change language`,
    cartHeader: `🛒 *Your FreshCart Basket:*`,
    cartEmpty: `Your basket is currently empty. Reply with items you'd like to add!`,
    itemAdded: (product, variant, price, count, total) =>
      `Added *${product} (${variant})* to your cart! 🛒\n\n💰 Price: *₹${price.toFixed(2)}*\n📦 Items in cart: ${count} (Subtotal: ₹${total.toFixed(2)})\n\nReply with more items, or type *CONFIRM* to checkout!`,
    itemOutOfStock: (product, variant) =>
      `⚠️ *${product} (${variant})* is currently out of stock. We've recorded an instant alert and will notify you when fresh stock arrives!`,
    alternativeSuggested: (product, altName, price) =>
      `⚠️ *${product}* is temporarily out of stock.\n\n✨ *Recommended In-Stock Alternative:*\n*${altName}* (₹${price.toFixed(2)})\n\nReply *YES* to accept or *NO* to skip.`,
    orderConfirmed: (orderNumber, total, address) =>
      `🎉 *Order Confirmed!* #${orderNumber}\n\n💵 *Grand Total:* ₹${total.toFixed(2)}\n📍 *Delivery Address:* ${address}\n⚡ *Express Delivery:* 15-30 Mins from nearest dark store\n\nTrack your order in real-time or pay via UPI deep-link. Thank you for shopping with FreshCart!`,
    orderCancellation: (orderNumber) =>
      `Order #${orderNumber} has been cancelled as requested. Any paid amount will be refunded directly to your FreshCart Wallet.`,
    chooseLanguage: `🌐 *Select Your Preferred Language / भाषा चुनें:*\n\n1️⃣ English\n2️⃣ हिंदी (Hindi)\n3️⃣ Hinglish (Hindi in English Script)\n\n*(Reply with 1, 2, or 3)*`,
  },
  hi: {
    greeting: `🙏 *फ्रेशकार्ट ग्रोसरी में आपका स्वागत है!*\n\nआज हम आपकी क्या मदद कर सकते हैं?\n• अपनी किराने की सूची भेजें (जैसे: *"२ पैकेट अमूल दूध, १ किलो आशीर्वाद आटा, ५०० ग्राम पनीर"*)\n• वॉयस नोट भेजें 🎙️\n• अपनी हस्तलिखित पर्ची की फोटो भेजें 📸\n• भाषा बदलने के लिए *LANGUAGE* लिखें`,
    cartHeader: `🛒 *आपकी फ्रेशकार्ट टोकरी:*`,
    cartEmpty: `आपकी टोकरी अभी खाली है। जो सामान चाहिए, उसका नाम लिखकर भेजें!`,
    itemAdded: (product, variant, price, count, total) =>
      `*${product} (${variant})* आपकी टोकरी में जोड़ दिया गया है! 🛒\n\n💰 कीमत: *₹${price.toFixed(2)}*\n📦 कुल सामान: ${count} (कुल राशि: ₹${total.toFixed(2)})\n\nऔर सामान जोड़ने के लिए नाम भेजें, या आर्डर करने के लिए *CONFIRM* लिखें!`,
    itemOutOfStock: (product, variant) =>
      `⚠️ *${product} (${variant})* अभी स्टॉक में उपलब्ध नहीं है। स्टॉक आते ही हम आपको तुरंत सूचित करेंगे!`,
    alternativeSuggested: (product, altName, price) =>
      `⚠️ *${product}* अभी उपलब्ध नहीं है।\n\n✨ *उपलब्ध विकल्प:*\n*${altName}* (₹${price.toFixed(2)})\n\nस्वीकार करने के लिए *हाँ* या छोड़ने के लिए *नहीं* लिखें।`,
    orderConfirmed: (orderNumber, total, address) =>
      `🎉 *ऑर्डर स्वीकार कर लिया गया है!* #${orderNumber}\n\n💵 *कुल राशि:* ₹${total.toFixed(2)}\n📍 *डिलीवरी पता:* ${address}\n⚡ *सुपरफास्ट डिलीवरी:* १५-३० मिनट में आपके घर!\n\nफ्रेशकार्ट से खरीदारी करने के लिए धन्यवाद!`,
    orderCancellation: (orderNumber) =>
      `ऑर्डर #${orderNumber} रद्द कर दिया गया है। भुगतान की गई राशि सीधे आपके फ्रेशकार्ट वॉलेट में वापस कर दी जाएगी।`,
    chooseLanguage: `🌐 *अपनी पसंदीदा भाषा चुनें:*\n\n1️⃣ English\n2️⃣ हिंदी (Hindi)\n3️⃣ Hinglish\n\n*(१, २, या ३ लिखकर जवाब दें)*`,
  },
  'hi-Latn': {
    greeting: `🙏 *FreshCart me aapka swagat hai!*\n\nHum aapki kya madad kar sakte hain?\n• Apni grocery list bhejein (jaise: *"2 packet Amul doodh, 1kg Aashirvaad atta, 500g paneer"*)\n• Voice note bhejein 🎙️\n• Apni handwritten list ki photo bhejein 📸\n• Bhasha badalne ke liye *LANGUAGE* type karein`,
    cartHeader: `🛒 *Aapka FreshCart Basket:*`,
    cartEmpty: `Aapka basket abhi khali hai. Kuch samaan mangwane ke liye naam bhejein!`,
    itemAdded: (product, variant, price, count, total) =>
      `*${product} (${variant})* aapke cart me add ho gaya hai! 🛒\n\n💰 Price: *₹${price.toFixed(2)}*\n📦 Items in cart: ${count} (Subtotal: ₹${total.toFixed(2)})\n\nAur samaan add karein ya order place karne ke liye *CONFIRM* type karein!`,
    itemOutOfStock: (product, variant) =>
      `⚠️ *${product} (${variant})* abhi stock me available nahi hai. Fresh stock aate hi hum aapko notify karenge!`,
    alternativeSuggested: (product, altName, price) =>
      `⚠️ *${product}* out of stock hai.\n\n✨ *In-Stock Alternative:*\n*${altName}* (₹${price.toFixed(2)})\n\nAdd karne ke liye *HAAN* ya skip karne ke liye *NAHI* type karein.`,
    orderConfirmed: (orderNumber, total, address) =>
      `🎉 *Order Confirm Ho Gaya!* #${orderNumber}\n\n💵 *Total Bill:* ₹${total.toFixed(2)}\n📍 *Delivery Address:* ${address}\n⚡ *Express Delivery:* 15-30 Mins me aapke darwaze par!\n\nFreshCart se shopping karne ke liye shukriya!`,
    orderCancellation: (orderNumber) =>
      `Order #${orderNumber} cancel ho gaya hai. Aapka refund FreshCart Wallet me credit ho jayega.`,
    chooseLanguage: `🌐 *Apni preferred language select karein:*\n\n1️⃣ English\n2️⃣ हिंदी (Hindi)\n3️⃣ Hinglish\n\n*(1, 2, ya 3 reply karein)*`,
  },
};

export class I18nManager {
  /**
   * Detects customer's preferred language from text content
   */
  public static detectLanguage(text: string, currentPreference?: SupportedLanguage): SupportedLanguage {
    if (!text) return currentPreference || 'en';
    const trimmed = text.trim().toLowerCase();

    // Explicit commands
    if (trimmed === 'hindi' || trimmed === '2' || /[\u0900-\u097F]/.test(text)) {
      return 'hi';
    }
    if (trimmed === 'hinglish' || trimmed === '3') {
      return 'hi-Latn';
    }
    if (trimmed === 'english' || trimmed === '1') {
      return 'en';
    }

    // Hinglish heuristics (common colloquial phrases)
    const hinglishKeywords = [
      'namaste', 'pranam', 'kripya', 'chahiye', 'bhejo', 'doodh',
      'tamatar', 'pyaaz', 'cheeni', 'chai', 'bhai', 'haan', 'nahi',
      'karo', 'karna', 'shukriya', 'dhanyawad', 'aur', 'kitna'
    ];
    if (hinglishKeywords.some((kw) => trimmed.includes(kw))) {
      return 'hi-Latn';
    }

    return currentPreference || 'en';
  }

  /**
   * Gets localized message bundle
   */
  public static getStrings(lang?: string): LocalizedMessages {
    if (lang === 'hi') return LOCALIZED_STRINGS.hi;
    if (lang === 'hi-Latn') return LOCALIZED_STRINGS['hi-Latn'];
    return LOCALIZED_STRINGS.en;
  }
}

