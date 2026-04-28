import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, CheckCircle, Package,
  Clock, Truck, RotateCcw, X, Upload,
  FileText, FileArchive, Film, ImageIcon, Download,
} from 'lucide-react';
import { ref, onValue, push, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import { useAuth } from './AuthContext';
import { UserAvatar } from './UserAvatar';

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

const statusConfig: Record<
  string,
  { label: string; color: string; Icon: React.ElementType }
> = {
  pending:     { label: 'Pending',     color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',  Icon: Clock       },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20   text-blue-400   border-blue-500/30',    Icon: Package     },
  delivered:   { label: 'Delivered',   color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',  Icon: Truck       },
  completed:   { label: 'Completed',   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', Icon: CheckCircle },
  cancelled:   { label: 'Cancelled',   color: 'bg-slate-700/80  text-slate-400  border-slate-600',      Icon: Package     },
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
  const isFirstLoad = useRef(true);

  /* delivery form state */
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /* reset delivery form when order is no longer actionable by seller */
  useEffect(() => {
    if (order.status !== 'in_progress' && order.status !== 'pending') {
      setShowDeliveryForm(false);
      setSelectedFiles([]);
      setDeliveryNote('');
    }
  }, [order.status]);

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
      setShowDeliveryForm(false);
      setDeliveryNote('');
      setSelectedFiles([]);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const cfg = statusConfig[order.status] ?? statusConfig.pending;
  const { Icon } = cfg;
  const currentStepIdx = STEP_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  const hasDelivery =
    (order.status === 'delivered' || order.status === 'completed') &&
    (order.deliveryMessage || (order.deliveryFiles && order.deliveryFiles.length > 0));

  return (
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

        {/* Top section */}
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
          {/* Seller */}
          {mode === 'seller' && order.status === 'delivered' && (
            <p className="text-slate-400 text-sm italic">Waiting for buyer to accept the delivery…</p>
          )}
          {mode === 'seller' && order.status === 'completed' && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-emerald-400 text-sm font-medium">Order completed</p>
            </div>
          )}

          {/* Buyer */}
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
          {mode === 'buyer' && order.status === 'completed' && (
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
        </div>

        {/* ── Delivery package (shown when delivered / completed) ── */}
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
            {/* Delivery form — expands above input when seller clicks Deliver */}
            {mode === 'seller' && (order.status === 'in_progress' || order.status === 'pending') && showDeliveryForm && (
              <div className="p-4 border-b border-slate-800 space-y-3 bg-[#0E1422]">
                <div className="flex items-center justify-between">
                  <h4 className="text-white text-sm font-semibold flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    Deliver your work
                  </h4>
                  <button onClick={() => setShowDeliveryForm(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Add a delivery note for the buyer (optional)…"
                  rows={2}
                  className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />

                {/* File drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-slate-500 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Click to attach files</p>
                    <p className="text-slate-600 text-xs">Images, PDFs, ZIP/RAR, videos, docs &amp; more</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-[#111827] border border-slate-800 rounded-lg px-3 py-2">
                        {fileIcon(file.type)}
                        <span className="flex-1 min-w-0 text-sm text-white truncate">{file.name}</span>
                        <span className="text-xs text-slate-500 shrink-0">{formatBytes(file.size)}</span>
                        <button onClick={() => removeFile(idx)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploading && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Uploading…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={submitDelivery}
                    disabled={uploading}
                    className="bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Truck className="w-4 h-4" />
                    {uploading ? 'Submitting…' : 'Submit delivery'}
                  </button>
                  <button
                    onClick={() => { setShowDeliveryForm(false); setSelectedFiles([]); setDeliveryNote(''); }}
                    disabled={uploading}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Deliver order banner */}
            {mode === 'seller' && (order.status === 'in_progress' || order.status === 'pending') && !showDeliveryForm && (
              <div className="px-3 py-2.5 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between gap-3">
                <p className="text-slate-400 text-xs">Ready to submit your work?</p>
                <button
                  onClick={() => setShowDeliveryForm(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Deliver order
                </button>
              </div>
            )}

            {/* Chat input row */}
            <div className="p-3 flex items-end gap-2 bg-[#111827]">

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Message about this order…"
                rows={1}
                className="flex-1 bg-[#0E1422] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-5"
                style={{ minHeight: '40px', maxHeight: '120px' }}
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
  );
}
