import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, CheckCircle, Package,
  Clock, Truck, RotateCcw, X, Upload,
  FileText, FileArchive, Film, ImageIcon, Download,
  Star, Loader2,
} from 'lucide-react';
import { ref, onValue, push, update, increment } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import { useAuth } from './AuthContext';
import { UserAvatar } from './UserAvatar';
import ReviewModal from './ReviewModal';

export interface DeliveryFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  buyerPhoto?: string | null;
  sellerPhoto?: string | null;
  serviceId: string;
  serviceTitle: string;
  serviceImage?: string | null;
  price: number;
  priceType: 'per_project' | 'per_hour';
  message?: string;
  status: 'pending' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';
  createdAt: number;
  deliveryMessage?: string;
  deliveryFiles?: DeliveryFile[];
}

interface OrderMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  text: string;
  timestamp: number;
}

interface ReviewData {
  rating: number;
  text: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto: string;
  reviewedUserId: string;
  timestamp: number;
}

const statusConfig: Record<
  string,
  { label: string; color: string; Icon: React.ElementType }
> = {
  pending:     { label: 'Pending',     color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',    Icon: Clock       },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20   text-blue-400   border-blue-500/30',      Icon: Package     },
  delivered:   { label: 'Delivered',   color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',    Icon: Truck       },
  completed:   { label: 'Completed',   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', Icon: CheckCircle },
  cancelled:   { label: 'Cancelled',   color: 'bg-slate-700/80  text-slate-400  border-slate-600',        Icon: Package     },
};

const STEPS: Array<{ key: Order['status']; label: string }> = [
  { key: 'pending',     label: 'Ordered'     },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'delivered',   label: 'Delivered'   },
  { key: 'completed',   label: 'Completed'   },
];
const STEP_ORDER = ['pending', 'in_progress', 'delivered', 'completed'];

const ACCEPTED_TYPES =
  '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.zip,.rar,.7z,.mp4,.mov,.avi,.mkv,.wmv,.doc,.docx,.xls,.xlsx';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-400" />;
  if (type.startsWith('video/')) return <Film className="w-4 h-4 text-purple-400" />;
  if (type === 'application/pdf') return <FileText className="w-4 h-4 text-red-400" />;
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('compressed'))
    return <FileArchive className="w-4 h-4 text-yellow-400" />;
  return <FileText className="w-4 h-4 text-slate-400" />;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-700 text-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

export default function OrderDetail({
  order,
  mode,
  onBack,
}: {
  order: Order;
  mode: 'buyer' | 'seller';
  onBack: () => void;
}) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const isFirstLoad = useRef(true);

  /* delivery modal state */
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deliveryError, setDeliveryError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* review state */
  const [buyerReview, setBuyerReview] = useState<ReviewData | null>(null);
  const [sellerReview, setSellerReview] = useState<ReviewData | null>(null);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  /* toast */
  const [toast, setToast] = useState<string | null>(null);

  /* ── Order messages listener ── */
  useEffect(() => {
    isFirstLoad.current = true;
    const unsub = onValue(ref(database, `orderMessages/${order.id}`), (snap) => {
      const msgs: OrderMessage[] = [];
      snap.forEach((child) => msgs.push({ id: child.key!, ...child.val() }));
      setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
    });
    return () => unsub();
  }, [order.id]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({
      behavior: isFirstLoad.current ? 'auto' : 'smooth',
    });
    isFirstLoad.current = false;
  }, [messages]);

  /* ── Reviews listener (only for completed orders) ── */
  useEffect(() => {
    if (order.status !== 'completed') {
      setReviewsLoaded(true);
      return;
    }
    const unsub = onValue(ref(database, `reviews/${order.id}`), (snap) => {
      const data = snap.val() ?? {};
      setBuyerReview(data.buyerReview ?? null);
      setSellerReview(data.sellerReview ?? null);
      setReviewsLoaded(true);
    });
    return () => unsub();
  }, [order.id, order.status]);

  /* ── Delivery modal: body-scroll lock + Escape ── */
  useEffect(() => {
    if (!showDeliveryModal) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDeliveryModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeliveryModal]);

  /* ── Helpers ── */
  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const closeDeliveryModal = () => {
    if (uploading) return;
    setShowDeliveryModal(false);
    setDeliveryNote('');
    setSelectedFiles([]);
    setDeliveryError('');
  };

  const sendMessage = async () => {
    if (!user || !userProfile || !text.trim() || sending) return;
    setSending(true);
    try {
      const msgId = push(ref(database, `orderMessages/${order.id}`)).key!;
      await update(ref(database), {
        [`orderMessages/${order.id}/${msgId}`]: {
          senderId: user.uid,
          senderName: userProfile.name,
          senderPhotoURL: userProfile.photoURL || '',
          text: text.trim(),
          timestamp: Date.now(),
        },
      });
      setText('');
      if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  };

  const updateOrderStatus = async (newStatus: Order['status']) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await update(ref(database, `orders/${order.id}`), { status: newStatus });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !names.has(f.name))];
    });
    e.target.value = '';
  };

  const removeFile = (idx: number) =>
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));

  const submitDelivery = async () => {
    if (uploading) return;
    if (!deliveryNote.trim() && selectedFiles.length === 0) {
      setDeliveryError('Please add a message or attach at least one file.');
      return;
    }
    setDeliveryError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadedFiles: DeliveryFile[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const path = `deliveries/${order.id}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        uploadedFiles.push({ name: file.name, url, type: file.type, size: file.size });
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }
      await update(ref(database, `orders/${order.id}`), {
        status: 'delivered',
        deliveryMessage: deliveryNote.trim() || null,
        deliveryFiles: uploadedFiles.length ? uploadedFiles : null,
      });
      setShowDeliveryModal(false);
      setDeliveryNote('');
      setSelectedFiles([]);
      showToastMsg('Delivery submitted successfully!');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const submitReview = async (rating: number, reviewText: string) => {
    if (!user || !userProfile) return;
    const reviewedUserId = mode === 'buyer' ? order.sellerId : order.buyerId;
    const reviewKey = mode === 'buyer' ? 'buyerReview' : 'sellerReview';
    const reviewData: ReviewData = {
      rating,
      text: reviewText,
      reviewerId: user.uid,
      reviewerName: userProfile.name,
      reviewerPhoto: userProfile.photoURL || '',
      reviewedUserId,
      timestamp: Date.now(),
    };
    const updates: Record<string, unknown> = {
      [`reviews/${order.id}/${reviewKey}`]: reviewData,
      [`userRatings/${reviewedUserId}/totalStars`]: increment(rating),
      [`userRatings/${reviewedUserId}/reviewCount`]: increment(1),
    };

    // Denormalize buyer reviews so ServiceDetail can display them per service
    if (mode === 'buyer') {
      updates[`serviceReviews/${order.serviceId}/${order.id}`] = {
        ...reviewData,
        serviceTitle: order.serviceTitle,
      };
    }

    await update(ref(database), updates);
  };

  /* ── Derived values ── */
  const cfg = statusConfig[order.status] ?? statusConfig.pending;
  const { Icon } = cfg;
  const currentStepIdx = STEP_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  const hasDelivery =
    (order.status === 'delivered' || order.status === 'completed') &&
    (order.deliveryMessage || (order.deliveryFiles && order.deliveryFiles.length > 0));

  const canBuyerReview =
    mode === 'buyer' &&
    order.status === 'completed' &&
    reviewsLoaded &&
    !buyerReview;

  const canSellerReview =
    mode === 'seller' &&
    order.status === 'completed' &&
    reviewsLoaded &&
    !!buyerReview &&
    !sellerReview;

  const sellerWaitsForBuyerReview =
    mode === 'seller' &&
    order.status === 'completed' &&
    reviewsLoaded &&
    !buyerReview;

  return (
    <>
      {/* ── Success toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 pointer-events-none whitespace-nowrap">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Delivery Modal ── */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeDeliveryModal}
          />
          <div
            className="relative z-10 bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Deliver your work</h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {order.buyerName} is waiting for your delivery
                  </p>
                </div>
              </div>
              <button
                onClick={closeDeliveryModal}
                disabled={uploading}
                aria-label="Close"
                className="text-slate-400 hover:text-white disabled:opacity-40 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Delivery message */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">
                  Delivery message{' '}
                  <span className="text-slate-600 font-normal text-xs">(optional)</span>
                </label>
                <textarea
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Describe what you've delivered, any notes for the buyer, or next steps…"
                  rows={3}
                  disabled={uploading}
                  className="w-full bg-[#0E1422] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none transition-colors disabled:opacity-60 leading-relaxed"
                />
              </div>

              {/* File drop zone */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">
                  Attachments{' '}
                  <span className="text-slate-600 font-normal text-xs">(optional)</span>
                </label>
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-colors ${
                    uploading
                      ? 'border-slate-700 cursor-not-allowed opacity-60'
                      : 'border-slate-700 hover:border-blue-500/60 cursor-pointer'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-300 text-sm font-medium">Click to attach files</p>
                    <p className="text-slate-600 text-xs mt-0.5">
                      Images, PDFs, ZIP/RAR, videos, docs &amp; more
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Selected file list */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-[#0E1422] border border-slate-800 rounded-lg px-3 py-2.5"
                    >
                      {fileIcon(file.type)}
                      <span className="flex-1 min-w-0 text-sm text-white truncate">{file.name}</span>
                      <span className="text-xs text-slate-500 shrink-0">{formatBytes(file.size)}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        disabled={uploading}
                        aria-label="Remove file"
                        className="text-slate-600 hover:text-red-400 disabled:opacity-40 transition-colors shrink-0 ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload progress */}
              {uploading && (
                <div className="bg-[#0E1422] border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      Uploading files…
                    </span>
                    <span className="text-blue-400 font-medium tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Validation error */}
              {deliveryError && (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5 shrink-0" />
                  {deliveryError}
                </p>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 pb-5 pt-4 border-t border-slate-800 flex gap-3 shrink-0">
              <button
                onClick={closeDeliveryModal}
                disabled={uploading}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDelivery}
                disabled={uploading}
                className="flex-1 bg-primary hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    Submit delivery
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={submitReview}
        targetName={mode === 'buyer' ? order.sellerName : order.buyerName}
        title={mode === 'buyer' ? 'Review the seller' : 'Review the buyer'}
      />

      {/* ── Page content ── */}
      <div className="flex flex-col gap-5 min-h-0">

        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </button>

        {/* ── Order info card ── */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">

          {/* Top: image + meta */}
          <div className="flex flex-col sm:flex-row gap-4 p-5">
            <div className="w-full sm:w-28 h-24 shrink-0 rounded-lg bg-[#0E1422] overflow-hidden">
              {order.serviceImage ? (
                <img src={order.serviceImage} alt={order.serviceTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-slate-600" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-white font-bold text-base leading-snug flex-1 min-w-0 pr-2">
                  {order.serviceTitle}
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 shrink-0 ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                <span className="text-white font-bold text-sm">
                  ${order.price}
                  <span className="text-slate-400 font-normal ml-0.5">
                    {order.priceType === 'per_hour' ? '/hr' : '/project'}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <UserAvatar photoURL={order.sellerPhoto ?? undefined} name={order.sellerName} size="sm" />
                  Seller: <span className="text-white">{order.sellerName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <UserAvatar photoURL={order.buyerPhoto ?? undefined} name={order.buyerName} size="sm" />
                  Buyer: <span className="text-white">{order.buyerName}</span>
                </span>
                <span>
                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>

              {order.message && (
                <p className="text-slate-500 text-xs italic leading-relaxed">"{order.message}"</p>
              )}
            </div>
          </div>

          {/* Status timeline */}
          {!isCancelled && (
            <div className="px-5 pb-5 border-t border-slate-800 pt-4">
              <div className="flex items-center gap-0">
                {STEPS.map((step, idx) => {
                  const done = currentStepIdx >= idx;
                  const active = currentStepIdx === idx;
                  const isLast = idx === STEPS.length - 1;
                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          done ? 'bg-primary border-primary' : 'bg-[#0E1422] border-slate-700'
                        } ${active ? 'ring-2 ring-primary/30' : ''}`}>
                          {done && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${done ? 'text-white' : 'text-slate-600'}`}>
                          {step.label}
                        </span>
                      </div>
                      {!isLast && (
                        <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${currentStepIdx > idx ? 'bg-primary' : 'bg-slate-700'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="px-5 pb-5 border-t border-slate-800 pt-4 flex flex-wrap gap-3 items-center">

            {/* Seller states */}
            {mode === 'seller' && order.status === 'delivered' && (
              <p className="text-slate-400 text-sm italic">Waiting for buyer to accept the delivery…</p>
            )}
            {mode === 'seller' && order.status === 'completed' && sellerWaitsForBuyerReview && (
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-emerald-400 text-sm font-medium">Order completed</p>
                <span className="text-slate-600 text-xs">· Waiting for buyer's review to unlock yours</span>
              </div>
            )}
            {mode === 'seller' && order.status === 'completed' && !sellerWaitsForBuyerReview && !canSellerReview && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-emerald-400 text-sm font-medium">Order completed</p>
              </div>
            )}

            {/* Buyer states */}
            {mode === 'buyer' && order.status === 'delivered' && (
              <>
                <button
                  onClick={() => updateOrderStatus('completed')}
                  disabled={updatingStatus}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept delivery
                </button>
                <button
                  onClick={() => updateOrderStatus('in_progress')}
                  disabled={updatingStatus}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Request revision
                </button>
              </>
            )}
            {mode === 'buyer' && order.status === 'completed' && !canBuyerReview && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-emerald-400 text-sm font-medium">Order completed</p>
              </div>
            )}
            {mode === 'buyer' && order.status === 'in_progress' && (
              <button
                onClick={() => updateOrderStatus('cancelled')}
                disabled={updatingStatus}
                className="text-slate-500 hover:text-red-400 text-sm transition-colors ml-auto"
              >
                Cancel order
              </button>
            )}

            {isCancelled && (
              <p className="text-slate-500 text-sm">This order was cancelled.</p>
            )}

            {/* Review prompts */}
            {canBuyerReview && (
              <button
                onClick={() => setShowReviewModal(true)}
                className="ml-auto flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Star className="w-4 h-4 fill-amber-400" />
                Leave a review
              </button>
            )}
            {canSellerReview && (
              <button
                onClick={() => setShowReviewModal(true)}
                className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Star className="w-4 h-4 fill-amber-400" />
                Leave a review
              </button>
            )}
          </div>

          {/* ── Delivery package ── */}
          {hasDelivery && (
            <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" />
                <h4 className="text-white text-sm font-semibold">Delivery</h4>
              </div>

              {order.deliveryMessage && (
                <p className="text-slate-300 text-sm leading-relaxed bg-[#0E1422] rounded-xl px-4 py-3 border border-slate-800">
                  {order.deliveryMessage}
                </p>
              )}

              {order.deliveryFiles && order.deliveryFiles.length > 0 && (
                <div className="space-y-2">
                  {order.deliveryFiles.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.name}
                      className="flex items-center gap-3 bg-[#0E1422] border border-slate-800 hover:border-slate-600 rounded-lg px-3 py-2.5 transition-colors group"
                    >
                      {fileIcon(file.type)}
                      <span className="flex-1 min-w-0 text-sm text-white truncate group-hover:text-blue-400 transition-colors">
                        {file.name}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{formatBytes(file.size)}</span>
                      <Download className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors shrink-0 ml-1" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Reviews section ── */}
          {order.status === 'completed' && reviewsLoaded && (buyerReview || sellerReview) && (
            <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h4 className="text-white text-sm font-semibold">Reviews</h4>
              </div>

              {buyerReview && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Buyer's review
                  </p>
                  <div className="bg-[#0E1422] rounded-xl px-4 py-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          photoURL={buyerReview.reviewerPhoto}
                          name={buyerReview.reviewerName}
                          size="sm"
                        />
                        <span className="text-white text-xs font-medium">{buyerReview.reviewerName}</span>
                      </div>
                      <RatingStars rating={buyerReview.rating} />
                    </div>
                    {buyerReview.text && (
                      <p className="text-slate-400 text-xs leading-relaxed pl-7">{buyerReview.text}</p>
                    )}
                  </div>
                </div>
              )}

              {sellerReview && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Seller's review
                  </p>
                  <div className="bg-[#0E1422] rounded-xl px-4 py-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          photoURL={sellerReview.reviewerPhoto}
                          name={sellerReview.reviewerName}
                          size="sm"
                        />
                        <span className="text-white text-xs font-medium">{sellerReview.reviewerName}</span>
                      </div>
                      <RatingStars rating={sellerReview.rating} />
                    </div>
                    {sellerReview.text && (
                      <p className="text-slate-400 text-xs leading-relaxed pl-7">{sellerReview.text}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Order chat ── */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 shrink-0">
            <h3 className="text-white text-sm font-semibold">Order chat</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Discuss this order with {mode === 'buyer' ? 'the seller' : 'the buyer'}
            </p>
          </div>

          <div className="overflow-y-auto p-4 flex flex-col gap-3 min-h-[200px] max-h-[380px]">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-10">
                <p className="text-slate-600 text-sm text-center">
                  No messages yet.<br />
                  Use this chat to discuss the order.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && (
                      <UserAvatar photoURL={msg.senderPhotoURL} name={msg.senderName} size="sm" />
                    )}
                    <div className={`flex flex-col gap-1 max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-[#1A2035] text-slate-200 rounded-bl-md'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[11px] text-slate-600 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isCancelled && (
            <div className="border-t border-slate-800 shrink-0">
              {/* Deliver Now banner — replaces inline form */}
              {mode === 'seller' && (order.status === 'in_progress' || order.status === 'pending') && (
                <div className="px-3 py-2.5 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between gap-3">
                  <p className="text-slate-400 text-xs">Ready to submit your work?</p>
                  <button
                    onClick={() => setShowDeliveryModal(true)}
                    className="flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Deliver Now
                  </button>
                </div>
              )}

              {/* Chat input */}
              <div className="p-3 flex items-end gap-2 bg-[#111827]">
                <textarea
                  ref={chatInputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="Message about this order…"
                  rows={1}
                  className="flex-1 bg-[#0E1422] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-5 overflow-hidden"
                  style={{ minHeight: '40px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !text.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
