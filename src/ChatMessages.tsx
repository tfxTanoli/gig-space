import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, update, get, increment } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import { useAuth } from './AuthContext';
import { UserAvatar } from './UserAvatar';
import { Send, ImagePlus, ArrowLeft, MessageSquare, X } from 'lucide-react';

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

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  text?: string;
  imageURL?: string;
  timestamp: number;
}

interface ChatMessagesProps {
  mode: 'buyer' | 'seller';
  startChatWithUserId?: string | null;
  startChatWithName?: string;
  startChatWithPhoto?: string;
  onStartChatHandled?: () => void;
}

function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export default function ChatMessages({ mode, startChatWithUserId, startChatWithName, startChatWithPhoto, onStartChatHandled }: ChatMessagesProps) {
  const { user, userProfile } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstMsgLoad = useRef(true);

  // ── Real-time conversation list ──
  useEffect(() => {
    if (!user) return;

    const convIdsRef = ref(database, `userConversations/${user.uid}`);
    const convListeners: Record<string, () => void> = {};
    const convMap: Record<string, Conversation> = {};

    const flush = () => {
      setConversations(
        Object.values(convMap).sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
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

        Object.keys(convListeners).forEach(id => {
          if (!ids.includes(id)) {
            convListeners[id]();
            delete convListeners[id];
            delete convMap[id];
          }
        });

        ids.forEach(id => {
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
            () => { delete convMap[id]; flush(); }
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
      Object.values(convListeners).forEach(u => u());
    };
  }, [user]);

  // ── Open or create conversation when startChatWithUserId is provided ──
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

  // ── Real-time messages for selected conversation ──
  useEffect(() => {
    if (!selectedConvId || !user) {
      setMessages([]);
      return;
    }

    isFirstMsgLoad.current = true;

    const msgsRef = ref(database, `messages/${selectedConvId}`);
    const unsub = onValue(msgsRef, (snap) => {
      const msgs: Message[] = [];
      snap.forEach(child => { msgs.push({ id: child.key!, ...child.val() }); });
      setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
    });

    const unreadField = mode === 'buyer' ? 'unreadBuyer' : 'unreadSeller';
    update(ref(database, `conversations/${selectedConvId}`), { [unreadField]: 0 });

    return () => unsub();
  }, [selectedConvId, user, mode]);

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: isFirstMsgLoad.current ? 'auto' : 'smooth' });
    isFirstMsgLoad.current = false;
  }, [messages]);

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

  const sendMessage = async () => {
    if (!user || !userProfile || !selectedConvId) return;
    if (!inputText.trim() && !imageFile) return;
    if (sending) return;
    setSending(true);

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
      if (inputText.trim()) msgData.text = inputText.trim();
      if (imageURL) msgData.imageURL = imageURL;

      const otherUnreadField = mode === 'buyer' ? 'unreadSeller' : 'unreadBuyer';

      await update(ref(database), {
        [`messages/${selectedConvId}/${msgId}`]: msgData,
        [`conversations/${selectedConvId}/lastMessage`]: imageURL && !inputText.trim() ? '📷 Image' : inputText.trim(),
        [`conversations/${selectedConvId}/lastMessageAt`]: Date.now(),
        [`conversations/${selectedConvId}/lastMessageBy`]: user.uid,
        [`conversations/${selectedConvId}/${otherUnreadField}`]: increment(1),
      });

      setInputText('');
      clearImage();
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

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;

  const getOtherPerson = (conv: Conversation) =>
    mode === 'buyer'
      ? { name: conv.sellerName, photoURL: conv.sellerPhotoURL }
      : { name: conv.buyerName,  photoURL: conv.buyerPhotoURL };

  const unreadCount = (conv: Conversation) =>
    mode === 'buyer' ? (conv.unreadBuyer || 0) : (conv.unreadSeller || 0);

  return (
    <div
      className="flex rounded-xl border border-slate-800 overflow-hidden flex-1"
      style={{ height: 'calc(100vh - 112px)', minHeight: '480px' }}
    >
      {/* Left: Conversation list */}
      <div className={`w-72 shrink-0 border-r border-slate-800 bg-[#111827] flex flex-col ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <h3 className="text-sm font-semibold text-white">Conversations</h3>
        </div>

        {convLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-500 text-sm">Loading…</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <MessageSquare className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No conversations yet.</p>
            {mode === 'buyer' && (
              <p className="text-slate-600 text-xs">
                Browse services and click "Contact seller" to start chatting.
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => {
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
                  {sel && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-r" />}
                  <UserAvatar photoURL={other.photoURL} name={other.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${unread > 0 ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>
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
      <div className={`flex-1 flex flex-col min-w-0 bg-[#0E1422] ${selectedConvId ? 'flex' : 'hidden md:flex'}`}>
        {!selectedConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare className="w-12 h-12 text-slate-700" />
            <p className="text-slate-500 text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-14 flex items-center gap-3 px-4 border-b border-slate-800 bg-[#111827] shrink-0">
              <button
                onClick={() => setSelectedConvId(null)}
                className="md:hidden text-slate-400 hover:text-white transition-colors mr-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {selectedConv && (() => {
                const { name, photoURL } = getOtherPerson(selectedConv);
                return (
                  <>
                    <UserAvatar photoURL={photoURL} name={name} size="sm" />
                    <p className="text-sm font-semibold text-white">{name || 'Unknown'}</p>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-slate-600 text-sm">No messages yet — say hello!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isMe && (
                        <UserAvatar photoURL={msg.senderPhotoURL} name={msg.senderName} size="sm" />
                      )}
                      <div className={`flex flex-col gap-1 max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {msg.imageURL && (
                          <a href={msg.imageURL} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={msg.imageURL}
                              alt="Shared"
                              className="max-w-[240px] max-h-[280px] rounded-2xl object-cover hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}
                        {msg.text && (
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-br-md'
                                : 'bg-[#1A2035] text-slate-200 rounded-bl-md'
                            }`}
                          >
                            {msg.text}
                          </div>
                        )}
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

            {/* Image preview strip */}
            {imagePreview && (
              <div className="px-4 py-2 border-t border-slate-800 bg-[#111827] shrink-0">
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-lg object-cover" />
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
            <div className="p-3 border-t border-slate-800 flex items-end gap-2 bg-[#111827] shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                title="Attach image"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 bg-[#0E1422] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-5"
                rows={1}
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || (!inputText.trim() && !imageFile)}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
