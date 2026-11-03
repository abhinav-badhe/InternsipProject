export type WhatsAppIntentType =
  | 'GREETING'
  | 'SEARCH_PRODUCT'
  | 'CATEGORY_DISAMBIGUATION'
  | 'ADD_TO_CART'
  | 'VIEW_CART'
  | 'CONFIRM_CHECKOUT'
  | 'APPROVE_SUBSTITUTION'
  | 'REJECT_SUBSTITUTION'
  | 'HUMAN_SUPPORT'
  | 'UNKNOWN';

export interface WhatsAppInboundMessage {
  messageId: string;
  fromPhoneNumber: string;
  senderName?: string;
  text: string;
  timestamp: string;
  messageType?: 'text' | 'audio' | 'image' | 'location' | 'interactive';
  isVoiceNote?: boolean;
  isPhotoOcr?: boolean;
  ocrLines?: string[];
  mediaId?: string;
  audioTranscript?: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
}

export interface InteractiveOption {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppOutboundMessage {
  toPhoneNumber: string;
  type: 'text' | 'buttons' | 'list';
  headerText?: string;
  bodyText: string;
  footerText?: string;
  options?: InteractiveOption[];
}

export interface WhatsAppSessionState {
  sessionId: string;
  phoneNumber: string;
  customerId?: string;
  stage:
    | 'IDLE'
    | 'DISAMBIGUATING_CATEGORY'
    | 'SELECTING_BRAND'
    | 'SELECTING_VARIANT'
    | 'REVIEWING_CART'
    | 'AWAITING_CONFIRMATION'
    | 'AWAITING_SUBSTITUTION_APPROVAL';
  pendingDisambiguation?: {
    query: string;
    matchedCategories: Array<{ id: string; name: string }>;
  };
  cartItems: Array<{
    sku: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
  }>;
  pendingSubstitution?: {
    orderId: string;
    originalSku: string;
    originalProductName: string;
    proposedSku: string;
    proposedProductName: string;
    priceDifference: number;
  };
  lastMessageAt: string;
}
