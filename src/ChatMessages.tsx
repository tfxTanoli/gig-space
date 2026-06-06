import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, update, get, increment, remove, query, orderByChild, equalTo } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import { useAuth } from './AuthContext';
import { UserAvatar } from './UserAvatar';
import {
  Send, ImagePlus, ArrowLeft, X,
  Tag, CheckCircle, ChevronLeft, ChevronRight, Loader2, Trash2,
} from 'lucide-react';

const MessagesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.57641 12.7014C1.69894 13.0105 1.72622 13.3492 1.65474 13.6739L0.767243 16.4156C0.738646 16.5546 0.74604 16.6987 0.788722 16.834C0.831405 16.9694 0.907961 17.0916 1.01113 17.1891C1.1143 17.2866 1.24067 17.3562 1.37824 17.3911C1.51582 17.4261 1.66004 17.4253 1.79724 17.3889L4.64141 16.5572C4.94784 16.4965 5.26518 16.523 5.55724 16.6339C7.33673 17.4649 9.35255 17.6407 11.249 17.1303C13.1455 16.6199 14.8008 15.4561 15.9228 13.8442C17.0448 12.2323 17.5615 10.2759 17.3817 8.3202C17.2018 6.36449 16.337 4.53514 14.9398 3.15491C13.5426 1.77468 11.7028 0.932277 9.74506 0.776325C7.78729 0.620374 5.83735 1.1609 4.23928 2.30253C2.6412 3.44416 1.49769 5.11353 1.01049 7.01611C0.523289 8.91869 0.723717 10.9322 1.57641 12.7014Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
import { toast } from 'sonner';
import { startElementsCheckout, verifyPaymentIntent } from './stripe/paymentHelpers';
import PaymentModal from './components/PaymentModal';
import { sendNotification } from './notifications/notificationHelpers';

/* â”€â”€ Types â”€â”€ */

interface Conversation {
  id: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  buyerPhotoURL: string;
  sellerPhotoURL: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadBuyer: number;
  unreadSeller: number;
}

interface OfferData {
  serviceId: string;
  serviceTitle: string;
  serviceImage?: string | null;
  description: string;
  price: number;
  priceUnit: 'per_project' | 'per_hour';
}

interface ServiceContextData {
  serviceId: string;
  serviceTitle: string;
  serviceImage?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  text?: string;
  imageURL?: string;
  type?: 'offer' | 'service_inquiry';
  offer?: OfferData;
  offerStatus?: 'pending' | 'accepted';
  serviceContext?: ServiceContextData;
  timestamp: number;
}

interface SellerService {
  id: string;
  title: string;
  images?: string[];
  priceMin: number;
  priceMax?: number | null;
  priceType: 'per_project' | 'per_hour';
  status: string;
  createdAt: number;
}

interface ChatMessagesProps {
  mode: 'buyer' | 'seller';
  startChatWithUserId?: string | null;
  startChatWithName?: string;
  startChatWithPhoto?: string;
  onStartChatHandled?: () => void;
  serviceContext?: ServiceContextData;
  onServiceContextHandled?: () => void;
}

function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export default function ChatMessages({
  mode,
  startChatWithUserId,
  startChatWithName,
  startChatWithPhoto,
  onStartChatHandled,
  serviceContext,
  onServiceContextHandled,
}: ChatMessagesProps) {
  const { user, userProfile } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Offer modal state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerStep, setOfferStep] = useState<1 | 2>(1);
  const [sellerServices, setSellerServices] = useState<SellerService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<SellerService | null>(null);
  const [offerDescription, setOfferDescription] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerPriceUnit, setOfferPriceUnit] = useState<'per_project' | 'per_hour'>('per_project');
  const [sendingOffer, setSendingOffer] = useState(false);

  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentOffer, setPaymentOffer] = useState<{ amount: number; title: string } | null>(null);

  const [otherUserInfo, setOtherUserInfo] = useState<{ username: string; lastSeen: number | null; online: boolean } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const isFirstMsgLoad = useRef(true);

  // â”€â”€ Real-time conversation list â”€â”€
  useEffect(() => {
    if (!user) return;

    const convIdsRef = ref(database, `userConversations/${user.uid}`);
    const convListeners: Record<string, () => void> = {};
    const convMap: Record<string, Conversation> = {};

    const flush = () => {
      setConversations(
        Object.values(convMap)
          .filter((c) => mode === 'seller' ? c.sellerId === user.uid : c.buyerId === user.uid)
          .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
      );
      setConvLoading(false);
    };

    const idsUnsub = onValue(
      convIdsRef,
      (snap) => {
        if (!snap.exists()) {
          setConversations([]);
          setConvLoading(false);
          return;
        }
        const ids = Object.keys(snap.val());

        Object.keys(convListeners).forEach((id) => {
          if (!ids.includes(id)) {
            convListeners[id]();
            delete convListeners[id];
            delete convMap[id];
          }
        });

        ids.forEach((id) => {
          if (convListeners[id]) return;
          const convRef = ref(database, `conversations/${id}`);
          convListeners[id] = onValue(
            convRef,
            (convSnap) => {
              if (convSnap.exists()) {
                convMap[id] = { id, ...convSnap.val() };
              } else {
                delete convMap[id];
              }
              flush();
            },
            () => {
              delete convMap[id];
              flush();
            }
          );
        });
      },
      (_err) => {
        setConversations([]);
        setConvLoading(false);
      }
    );

    return () => {
      idsUnsub();
      Object.values(convListeners).forEach((u) => u());
    };
  }, [user]);

  // â”€â”€ Open or create conversation when startChatWithUserId is provided â”€â”€
  useEffect(() => {
    if (!startChatWithUserId || !user || !userProfile) return;
    if (startChatWithUserId === user.uid) {
      onStartChatHandled?.();
      return;
    }

    const open = async () => {
      const convId = getConversationId(user.uid, startChatWithUserId);
      try {
        const isBuyer = mode === 'buyer';
        const convData = {
          buyerId:        isBuyer ? user.uid                     : startChatWithUserId,
          sellerId:       isBuyer ? startChatWithUserId          : user.uid,
          buyerName:      isBuyer ? (userProfile.name || '')     : (startChatWithName || ''),
          sellerName:     isBuyer ? (startChatWithName || '')    : (userProfile.name || ''),
          buyerPhotoURL:  isBuyer ? (userProfile.photoURL || '') : (startChatWithPhoto || ''),
          sellerPhotoURL: isBuyer ? (startChatWithPhoto || '')   : (userProfile.photoURL || ''),
          lastMessage: '',
          lastMessageAt: Date.now(),
          unreadBuyer: 0,
          unreadSeller: 0,
        };
        const convSnap = await get(ref(database, `conversations/${convId}`));
        const updates: Record<string, unknown> = {
          [`userConversations/${convData.buyerId}/${convId}`]:  true,
          [`userConversations/${convData.sellerId}/${convId}`]: true,
        };
        if (!convSnap.exists()) {
          updates[`conversations/${convId}`] = convData;
        }
        await update(ref(database), updates);
      } catch (err) {
        console.error('open() error:', err);
      }
      setSelectedConvId(convId);
      onStartChatHandled?.();
    };

    open();
  }, [startChatWithUserId, user, userProfile, mode, onStartChatHandled]);

  // â”€â”€ Real-time messages for selected conversation â”€â”€
  useEffect(() => {
    if (!selectedConvId || !user) {
      setMessages([]);
      return;
    }

    isFirstMsgLoad.current = true;

    const msgsRef = ref(database, `messages/${selectedConvId}`);
    const unsub = onValue(msgsRef, (snap) => {
      const msgs: Message[] = [];
      snap.forEach((child) => { msgs.push({ id: child.key!, ...child.val() }); });
      setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
    });

    const unreadField = mode === 'buyer' ? 'unreadBuyer' : 'unreadSeller';
    update(ref(database, `conversations/${selectedConvId}`), { [unreadField]: 0 });

    return () => unsub();
  }, [selectedConvId, user, mode]);

  // â”€â”€ Other user real-time info (username, lastSeen) â”€â”€
  useEffect(() => {
    const conv = conversations.find((c) => c.id === selectedConvId) ?? null;
    if (!conv) { setOtherUserInfo(null); return; }
    const otherId = mode === 'buyer' ? conv.sellerId : conv.buyerId;
    const userRef = ref(database, `users/${otherId}`);
    const unsub = onValue(userRef, (snap) => {
      const d = snap.val();
      setOtherUserInfo({
        username: d?.username ?? '',
        lastSeen: typeof d?.lastSeen === 'number' ? d.lastSeen : null,
        online: d?.online === true,
      });
    });
    return () => unsub();
  }, [selectedConvId, conversations, mode]);

  // â”€â”€ Auto-scroll â”€â”€
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: isFirstMsgLoad.current ? 'auto' : 'smooth' });
    isFirstMsgLoad.current = false;
  }, [messages]);

  const autoResizeInput = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  /* â”€â”€ Image helpers â”€â”€ */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* â”€â”€ Send regular message â”€â”€ */
  const sendMessage = async () => {
    if (!user || !userProfile || !selectedConvId) return;
    if (!inputText.trim() && !imageFile) return;
    if (sending) return;
    setSending(true);

    // Capture everything that might be affected by stale closures BEFORE any await
    const messageText = inputText.trim();
    const conv = conversations.find((c) => c.id === selectedConvId);
    const recipientId = conv ? (mode === 'buyer' ? conv.sellerId : conv.buyerId) : null;

    try {
      const msgId = push(ref(database, `messages/${selectedConvId}`)).key!;

      let imageURL: string | undefined;
      if (imageFile) {
        const imgRef = storageRef(storage, `chat/${selectedConvId}/${msgId}`);
        await uploadBytes(imgRef, imageFile);
        imageURL = await getDownloadURL(imgRef);
      }

      const msgData: Record<string, unknown> = {
        senderId: user.uid,
        senderName: userProfile.name,
        senderPhotoURL: userProfile.photoURL || '',
        timestamp: Date.now(),
      };
      if (messageText) msgData.text = messageText;
      if (imageURL) msgData.imageURL = imageURL;

      // Attach service context (buyer messaging from a service page)
      if (serviceContext?.serviceId) {
        msgData.type = 'service_inquiry';
        msgData.serviceContext = {
          serviceId: serviceContext.serviceId,
          serviceTitle: serviceContext.serviceTitle,
          serviceImage: serviceContext.serviceImage ?? null,
        };
      }

      const otherUnreadField = mode === 'buyer' ? 'unreadSeller' : 'unreadBuyer';
      const lastMsg = imageURL && !messageText ? 'ðŸ“· Image' : messageText;

      await update(ref(database), {
        [`messages/${selectedConvId}/${msgId}`]: msgData,
        [`conversations/${selectedConvId}/lastMessage`]: lastMsg,
        [`conversations/${selectedConvId}/lastMessageAt`]: Date.now(),
        [`conversations/${selectedConvId}/lastMessageBy`]: user.uid,
        [`conversations/${selectedConvId}/${otherUnreadField}`]: increment(1),
      });

      // Notify the other participant (fire-and-forget â€” non-critical)
      if (recipientId) {
        sendNotification(recipientId, {
          type: 'message',
          title: `New message from ${userProfile.name}`,
          body: '',
          senderId: user.uid,
          senderName: userProfile.name,
          senderPhotoURL: userProfile.photoURL || '',
          conversationId: selectedConvId,
        }).catch(console.error);
      }

      setInputText('');
      if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
      clearImage();
      // Clear service context after it's been sent once
      if (serviceContext?.serviceId) {
        onServiceContextHandled?.();
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* â”€â”€ Offer modal helpers â”€â”€ */
  const openOfferModal = () => {
    if (!user) return;
    setShowOfferModal(true);
    setOfferStep(1);
    setSelectedService(null);
    setOfferDescription('');
    setOfferPrice('');
    setOfferPriceUnit('per_project');

    setServicesLoading(true);
    const q = query(ref(database, 'services'), orderByChild('sellerId'), equalTo(user.uid));
    get(q).then((snap) => {
      const result: SellerService[] = [];
      snap.forEach((child) => {
        const val = child.val();
        result.push({ id: child.key!, ...val });
      });
      setSellerServices(
        result
          .filter((s) => s.status === 'active')
          .sort((a, b) => b.createdAt - a.createdAt)
      );
      setServicesLoading(false);
    });
  };

  const closeOfferModal = () => {
    setShowOfferModal(false);
    setSelectedService(null);
    setOfferDescription('');
    setOfferPrice('');
    setOfferStep(1);
  };

  const selectService = (service: SellerService) => {
    setSelectedService(service);
    setOfferPrice(String(service.priceMin));
    setOfferPriceUnit(service.priceType);
    setOfferStep(2);
  };

  const sendOffer = async () => {
    if (!user || !userProfile || !selectedConvId || !selectedService) return;
    const price = parseFloat(offerPrice);
    if (isNaN(price) || price <= 0) return;
    setSendingOffer(true);
    try {
      const msgId = push(ref(database, `messages/${selectedConvId}`)).key!;
      const msgData = {
        senderId: user.uid,
        senderName: userProfile.name,
        senderPhotoURL: userProfile.photoURL || '',
        type: 'offer',
        offer: {
          serviceId: selectedService.id,
          serviceTitle: selectedService.title,
          serviceImage: selectedService.images?.[0] ?? null,
          description: offerDescription.trim(),
          price,
          priceUnit: offerPriceUnit,
        },
        offerStatus: 'pending',
        timestamp: Date.now(),
      };

      await update(ref(database), {
        [`messages/${selectedConvId}/${msgId}`]: msgData,
        [`conversations/${selectedConvId}/lastMessage`]: 'ðŸ“‹ Sent an offer',
        [`conversations/${selectedConvId}/lastMessageAt`]: Date.now(),
        [`conversations/${selectedConvId}/lastMessageBy`]: user.uid,
        [`conversations/${selectedConvId}/unreadBuyer`]: increment(1),
      });

      // Notify the buyer about the new offer (fire-and-forget)
      const offerConv = conversations.find((c) => c.id === selectedConvId);
      if (offerConv) {
        sendNotification(offerConv.buyerId, {
          type: 'offer',
          title: `${userProfile.name} sent you an offer`,
          body: `$${price} offer for "${selectedService.title}"`,
          senderId: user.uid,
          senderName: userProfile.name,
          senderPhotoURL: userProfile.photoURL || '',
          conversationId: selectedConvId,
          serviceId: selectedService.id,
        }).catch(console.error);
      }

      closeOfferModal();
    } catch (err) {
      console.error('Send offer error:', err);
    } finally {
      setSendingOffer(false);
    }
  };

  /* â”€â”€ Accept offer (buyer) â€” opens embedded Stripe checkout modal â”€â”€ */
  const acceptOffer = async (msg: Message) => {
    if (!user || !userProfile || !selectedConvId || !msg.offer) return;
    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!conv) return;
    if (acceptingOfferId) return; // prevent double-click

    // Persist seller info so BuyerDashboard can send the seller notification
    // after Stripe redirects back with ?payment_success=true
    try {
      sessionStorage.setItem(
        'pendingOfferNotif',
        JSON.stringify({
          sellerId: conv.sellerId,
          sellerName: conv.sellerName,
          sellerPhotoURL: conv.sellerPhotoURL || '',
          conversationId: selectedConvId,
          price: msg.offer.price,
          serviceTitle: msg.offer.serviceTitle,
        })
      );
    } catch {
      // sessionStorage unavailable â€” skip seller notification
    }

    setAcceptingOfferId(msg.id);
    try {
      const clientSecret = await startElementsCheckout({
        conversationId: selectedConvId,
        messageId: msg.id,
        serviceTitle: msg.offer.serviceTitle,
        serviceId: msg.offer.serviceId,
        sellerName: conv.sellerName,
        sellerId: conv.sellerId,
        offerAmount: msg.offer.price,
        priceUnit: msg.offer.priceUnit,
        serviceImage: msg.offer.serviceImage ?? null,
      });
      setPaymentClientSecret(clientSecret);
      setPaymentOffer({ amount: msg.offer.price, title: msg.offer.serviceTitle });
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const handlePaymentSuccess = (paymentIntentId: string) => {
    const offer = paymentOffer;
    setPaymentClientSecret(null);
    setPaymentOffer(null);
    toast.success('Payment successful! Your order is now in progress.');
    // Trigger backend to create the order + set offerStatus to 'accepted' in Firebase.
    // This is the inline-payment equivalent of verifyCheckoutSession for the old redirect flow.
    if (paymentIntentId) {
      verifyPaymentIntent(paymentIntentId).catch(console.error);
    }
    if (user && userProfile && offer) {
      sendNotification(user.uid, {
        type: 'offer_accepted',
        title: 'Payment successful',
        body: 'Your payment was processed. Your order is now in progress.',
        senderId: user.uid,
        senderName: userProfile.name || '',
        senderPhotoURL: userProfile.photoURL || '',
      }).catch(console.error);
      try {
        const raw = sessionStorage.getItem('pendingOfferNotif');
        if (raw) {
          const pending = JSON.parse(raw) as {
            sellerId: string; sellerName: string; sellerPhotoURL: string;
            conversationId: string; price: number; serviceTitle: string;
          };
          sendNotification(pending.sellerId, {
            type: 'offer_accepted',
            title: 'Your offer was accepted',
            body: `${userProfile.name || 'A buyer'} accepted your $${pending.price} offer for "${pending.serviceTitle}"`,
            senderId: user.uid,
            senderName: userProfile.name || '',
            senderPhotoURL: userProfile.photoURL || '',
            conversationId: pending.conversationId,
          }).catch(console.error);
          sessionStorage.removeItem('pendingOfferNotif');
        }
      } catch {
        sessionStorage.removeItem('pendingOfferNotif');
      }
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;

  const getOtherPerson = (conv: Conversation) =>
    mode === 'buyer'
      ? { name: conv.sellerName, photoURL: conv.sellerPhotoURL }
      : { name: conv.buyerName, photoURL: conv.buyerPhotoURL };

  const unreadCount = (conv: Conversation) =>
    mode === 'buyer' ? (conv.unreadBuyer || 0) : (conv.unreadSeller || 0);

  const formatMsgTimestamp = (ts: number) => {
    const d = new Date(ts);
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date}, ${time}`;
  };

  const formatLastSeen = (online: boolean, lastSeen: number | null): string => {
    if (online) return 'Online now';
    if (!lastSeen) return '';
    const diff = Date.now() - lastSeen;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Last seen just now';
    if (mins < 60) return `Last seen ${mins}m ago`;
    const hrs = Math.floor(diff / 3_600_000);
    if (hrs < 24) return `Last seen ${hrs}h ago`;
    const days = Math.floor(diff / 86_400_000);
    return `Last seen ${days}d ago`;
  };

  const handleDeleteConversation = async () => {
    if (!user || !selectedConvId) return;
    if (!window.confirm('Remove this conversation from your inbox?')) return;
    const convIdToDelete = selectedConvId;
    // Optimistic update: wipe both sides of the UI instantly
    setSelectedConvId(null);
    setConversations(prev => prev.filter(c => c.id !== convIdToDelete));
    // Persist to Firebase in the background
    remove(ref(database, `userConversations/${user.uid}/${convIdToDelete}`)).catch(console.error);
  };

  return (
    <>
      {/* â”€â”€ Payment modal (buyer) â”€â”€ */}
      {paymentClientSecret && paymentOffer && (
        <PaymentModal
          clientSecret={paymentClientSecret}
          offerAmount={paymentOffer.amount}
          serviceTitle={paymentOffer.title}
          onClose={() => { setPaymentClientSecret(null); setPaymentOffer(null); }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* â”€â”€ Offer modal (seller only) â”€â”€ */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeOfferModal} />
          <div
            className="relative z-10 bg-surface border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
              {offerStep === 2 && (
                <button
                  onClick={() => { setOfferStep(1); setSelectedService(null); }}
                  className="text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="text-white font-semibold text-sm flex-1">
                {offerStep === 1 ? 'Select a service' : 'Create offer'}
              </h3>
              <button
                onClick={closeOfferModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1 â€” service list */}
            {offerStep === 1 && (
              <div className="flex-1 overflow-y-auto p-5">
                {servicesLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <p className="text-slate-500 text-sm">Loading your servicesâ€¦</p>
                  </div>
                ) : sellerServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                    <Tag className="w-10 h-10 text-slate-700" />
                    <p className="text-slate-400 text-sm">No active services found.</p>
                    <p className="text-slate-600 text-xs">
                      Create and activate a service post first to send offers.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sellerServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => selectService(service)}
                        className="w-full flex items-center gap-3 bg-background border border-slate-800 hover:border-slate-600 rounded-xl p-3 transition-colors text-left"
                      >
                        <div className="w-14 h-14 shrink-0 rounded-lg bg-surface-raised overflow-hidden">
                          {service.images?.[0] ? (
                            <img
                              src={service.images[0]}
                              alt={service.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Tag className="w-5 h-5 text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium line-clamp-1">{service.title}</p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            from ${service.priceMin}
                            {service.priceType === 'per_hour' ? '/hr' : '/project'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2 â€” offer details */}
            {offerStep === 2 && selectedService && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Selected service preview */}
                <div className="flex items-center gap-3 bg-background border border-slate-800 rounded-xl p-3">
                  <div className="w-12 h-12 shrink-0 rounded-lg bg-surface-raised overflow-hidden">
                    {selectedService.images?.[0] ? (
                      <img
                        src={selectedService.images[0]}
                        alt={selectedService.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium line-clamp-1">{selectedService.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">Selected service</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Offer description
                  </label>
                  <textarea
                    value={offerDescription}
                    onChange={(e) => setOfferDescription(e.target.value)}
                    placeholder="Describe what's included in this offerâ€¦"
                    rows={3}
                    className="w-full bg-background border border-slate-700 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-primary transition-colors placeholder-slate-600 resize-none"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Price
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1 bg-background border border-slate-700 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
                      <span className="text-slate-500 pl-4 pr-1 text-sm select-none">$</span>
                      <input
                        type="number"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        className="flex-1 bg-transparent text-white text-sm py-2.5 pr-4 focus:outline-none"
                        placeholder="0"
                        min="1"
                      />
                    </div>
                    <select
                      value={offerPriceUnit}
                      onChange={(e) =>
                        setOfferPriceUnit(e.target.value as 'per_project' | 'per_hour')
                      }
                      className="bg-background border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="per_project">/ project</option>
                      <option value="per_hour">/ hour</option>
                    </select>
                  </div>
                </div>

                {/* Send */}
                <button
                  onClick={sendOffer}
                  disabled={sendingOffer || !offerPrice || parseFloat(offerPrice) <= 0}
                  className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                >
                  {sendingOffer ? 'Sendingâ€¦' : 'Send offer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Main chat layout â”€â”€ */}
      <div className="flex rounded-xl border border-slate-800 overflow-hidden flex-1 min-h-0 h-full">
        {/* Left: Conversation list */}
        <div
          className={`w-full md:w-72 shrink-0 border-r border-slate-800 bg-surface flex flex-col ${
            selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-800 shrink-0">
            <h3 className="text-sm font-semibold text-white">Conversations</h3>
          </div>

          {convLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500 text-sm">Loadingâ€¦</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <MessagesIcon className="w-10 h-10 text-slate-700" />
              <p className="text-slate-500 text-sm">No conversations yet.</p>
              {mode === 'buyer' && (
                <p className="text-slate-600 text-xs">
                  Browse services and click "Message seller" to start chatting.
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {conversations.map((conv) => {
                const other  = getOtherPerson(conv);
                const unread = unreadCount(conv);
                const sel    = selectedConvId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 transition-colors text-left relative ${
                      sel ? 'bg-blue-600/10' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {sel && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-r" />
                    )}
                    <UserAvatar photoURL={other.photoURL} name={other.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${
                            unread > 0 ? 'text-white font-semibold' : 'text-slate-300 font-medium'
                          }`}
                        >
                          {other.name || 'Unknown'}
                        </p>
                        {unread > 0 && (
                          <span className="shrink-0 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.lastMessage || 'Start a conversation'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Chat thread */}
        <div
          className={`flex-1 flex flex-col min-w-0 bg-background ${
            selectedConvId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!selectedConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <MessagesIcon className="w-12 h-12 text-slate-700" />
              <p className="text-slate-500 text-sm">Select a conversation to start chatting</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-5 px-4 py-3 border-b border-slate-800 bg-surface shrink-0 min-h-[64px]">
                <button
                  onClick={() => setSelectedConvId(null)}
                  className="md:hidden text-slate-400 hover:text-white transition-colors mr-1 shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedConv &&
                  (() => {
                    const { name, photoURL } = getOtherPerson(selectedConv);
                    const online = otherUserInfo?.online === true;
                    const lastSeenText = formatLastSeen(online, otherUserInfo?.lastSeen ?? null);
                    return (
                      <>
                        {/* Avatar with online dot */}
                        <div className="relative shrink-0">
                          <UserAvatar photoURL={photoURL} name={name} size="sm" />
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                              online ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        {/* Name, username, last seen */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-white">
                              {name || 'Unknown'}
                            </p>
                            {otherUserInfo?.username && (
                              <span className="text-xs text-slate-500">
                                @{otherUserInfo.username}
                              </span>
                            )}
                          </div>
                          {lastSeenText && (
                            <p className={`text-[11px] ${online ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {lastSeenText}
                            </p>
                          )}
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={handleDeleteConversation}
                          title="Delete conversation"
                          className="shrink-0 text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    );
                  })()}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-600 text-sm">No messages yet â€” say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;

                    /* â”€â”€ Offer card â”€â”€ */
                    if (msg.type === 'offer' && msg.offer) {
                      const isAccepted = msg.offerStatus === 'accepted';
                      return (
                        <div
                          key={msg.id}
                          className="flex gap-2 items-start"
                        >
                          <div className="relative shrink-0">
                            <UserAvatar
                              photoURL={msg.senderPhotoURL}
                              name={msg.senderName}
                              size="sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-medium text-slate-400">
                                {isMe ? 'Me' : (msg.senderName || 'Unknown')}
                              </span>
                              <span className="text-[11px] text-slate-500 shrink-0">
                                {formatMsgTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            <div className="bg-surface border border-slate-700 rounded-2xl overflow-hidden w-72 shadow-lg">
                              {/* Service image */}
                              {msg.offer.serviceImage && (
                                <img
                                  src={msg.offer.serviceImage}
                                  alt={msg.offer.serviceTitle}
                                  className="w-full h-36 object-cover"
                                />
                              )}
                              <div className="p-4">
                                {/* Offer label */}
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Tag className="w-3 h-3 text-primary" />
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                    Offer
                                  </span>
                                </div>

                                {/* Title */}
                                <h4 className="text-white font-semibold text-sm leading-snug">
                                  {msg.offer.serviceTitle}
                                </h4>

                                {/* Description */}
                                {msg.offer.description && (
                                  <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                                    {msg.offer.description}
                                  </p>
                                )}

                                {/* Price */}
                                <p className="text-white font-bold text-xl mt-3">
                                  ${msg.offer.price}
                                  <span className="text-slate-400 font-normal text-sm ml-1">
                                    {msg.offer.priceUnit === 'per_hour' ? '/ hr' : '/ project'}
                                  </span>
                                </p>

                                {/* Action area */}
                                {isAccepted ? (
                                  <div className="mt-3 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-emerald-400 text-xs font-medium">
                                      Order placed
                                    </span>
                                  </div>
                                ) : mode === 'buyer' && !isMe ? (
                                  <button
                                    onClick={() => acceptOffer(msg)}
                                    disabled={acceptingOfferId === msg.id}
                                    className="mt-3 w-full bg-primary hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                                  >
                                    {acceptingOfferId === msg.id ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Loading paymentâ€¦
                                      </>
                                    ) : (
                                      `Accept & Pay $${msg.offer.price}`
                                    )}
                                  </button>
                                ) : (
                                  <p className="text-slate-500 text-xs mt-3 italic">
                                    {isMe
                                      ? 'Waiting for buyer to respondâ€¦'
                                      : 'Offer from buyer'}
                                  </p>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    }

                    /* â”€â”€ Service inquiry message â”€â”€ */
                    if (msg.type === 'service_inquiry' && msg.serviceContext) {
                      return (
                        <div
                          key={msg.id}
                          className="flex gap-2 items-start"
                        >
                          <div className="relative shrink-0">
                            <UserAvatar
                              photoURL={msg.senderPhotoURL}
                              name={msg.senderName}
                              size="sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-medium text-slate-400">
                                {isMe ? 'Me' : (msg.senderName || 'Unknown')}
                              </span>
                              <span className="text-[11px] text-slate-500 shrink-0">
                                {formatMsgTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            {/* Service card */}
                            <div
                              className={`rounded-2xl overflow-hidden border w-64 rounded-bl-md ${
                                isMe
                                  ? 'border-blue-500/40 bg-blue-600/10'
                                  : 'border-slate-700 bg-surface'
                              }`}
                            >
                              {msg.serviceContext.serviceImage && (
                                <img
                                  src={msg.serviceContext.serviceImage}
                                  alt={msg.serviceContext.serviceTitle}
                                  className="w-full h-28 object-cover"
                                />
                              )}
                              <div className="px-3 py-2.5">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                                  Service inquiry
                                </p>
                                <p className="text-white text-xs font-semibold line-clamp-2 leading-snug">
                                  {msg.serviceContext.serviceTitle}
                                </p>
                              </div>
                              {/* Buyer's message text */}
                              {msg.text && (
                                <div
                                  className={`px-3 pb-3 pt-0 text-sm leading-relaxed border-t ${
                                    isMe
                                      ? 'text-blue-100 border-blue-500/20'
                                      : 'text-slate-200 border-slate-700/60'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    /* â”€â”€ Regular message â”€â”€ */
                    return (
                      <div
                        key={msg.id}
                        className="flex gap-2 items-start"
                      >
                        <div className="relative shrink-0">
                          <UserAvatar
                            photoURL={msg.senderPhotoURL}
                            name={msg.senderName}
                            size="sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          {/* Name + timestamp on same row */}
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-slate-400">
                              {isMe ? 'Me' : (msg.senderName || 'Unknown')}
                            </span>
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {formatMsgTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          {msg.imageURL && (
                            <a
                              href={msg.imageURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={msg.imageURL}
                                alt="Shared"
                                className="max-w-[240px] max-h-[280px] rounded-2xl object-cover hover:opacity-90 transition-opacity"
                              />
                            </a>
                          )}
                          {msg.text && (
                            <div
                              className={`px-3 py-2 rounded-2xl rounded-bl-md text-sm leading-relaxed break-words w-fit max-w-[80%] ${
                                isMe ? 'bg-blue-600 text-white' : 'bg-surface-raised text-slate-200'
                              }`}
                            >
                              {msg.text}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Service context preview strip */}
              {serviceContext?.serviceId && (
                <div className="px-4 py-2 border-t border-slate-800 bg-surface shrink-0">
                  <div className="flex items-center gap-2.5 bg-background border border-slate-700 rounded-xl p-2.5">
                    {serviceContext.serviceImage && (
                      <img
                        src={serviceContext.serviceImage}
                        alt={serviceContext.serviceTitle}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        Service inquiry
                      </p>
                      <p className="text-white text-xs font-medium truncate">
                        {serviceContext.serviceTitle}
                      </p>
                    </div>
                    <button
                      onClick={onServiceContextHandled}
                      className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 p-0.5"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Image preview strip */}
              {imagePreview && (
                <div className="px-4 py-2 border-t border-slate-800 bg-surface shrink-0">
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-20 w-auto rounded-lg object-cover"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {/* Input bar */}
              <div className="p-3 border-t border-slate-800 flex items-end gap-2 bg-surface shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                  title="Attach image"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>

                {/* Create Offer button â€” seller only, when a conversation is open */}
                {mode === 'seller' && (
                  <button
                    type="button"
                    onClick={openOfferModal}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                    title="Create offer"
                  >
                    <Tag className="w-5 h-5" />
                  </button>
                )}

                <textarea
                  ref={chatInputRef}
                  value={inputText}
                  onChange={(e) => { setInputText(e.target.value); autoResizeInput(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder={imageFile ? 'Add a captionâ€¦' : 'Type a messageâ€¦'}
                  className="flex-1 bg-background border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-5 overflow-hidden"
                  rows={1}
                  style={{ minHeight: '40px' }}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending || (!inputText.trim() && !imageFile)}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                  title="Send"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
