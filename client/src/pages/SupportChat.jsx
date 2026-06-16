import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Phone, Info, Paperclip, Smile } from 'lucide-react';
import {
  chatAPI,
  supportAPI,
  fetchMySupportTickets,
  rememberSupportTicketId,
  extractSupportTicketId,
  supportTicketsToChatMessages,
  saveLocalSupportTicket,
  saveBrandInquiryMessage,
  getInstantSupportReply,
  isAutoHandledSupportIntent,
  autoResolveSupportTicket,
} from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const supportSessionKey = (userId) =>
  `brandhive_support_session_${userId || 'guest'}`;

export default function SupportChat() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [brandContext, setBrandContext] = useState(
    location.state?.brandId ? location.state : null
  );

  const QUICK_ACTIONS = [
    isRTL ? 'تتبع طلبي' : 'Track my order',
    isRTL ? 'طلب استرجاع' : 'Return request',
    isRTL ? 'إلغاء الطلب' : 'Cancel order',
    isRTL ? 'مشكلة في الدفع' : 'Payment issue',
  ];

  const welcomeMessage = {
    id: 0,
    from: 'them',
    text: isRTL
      ? 'مرحباً بك في مركز دعم BrandHive! 🐝 كيف يمكننا مساعدتك اليوم؟'
      : 'Welcome to BrandHive Support! 🐝 How can we help you today?',
    time: new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOffline, setAiOffline] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const brandContextRef = useRef(brandContext);

  useEffect(() => {
    brandContextRef.current = brandContext;
  }, [brandContext]);

  const clearBrandContext = useCallback(() => {
    setBrandContext(null);
    brandContextRef.current = null;
    setInput('');
    navigate('/chat', { replace: true, state: null });
  }, [navigate]);

  const loadTicketHistory = async () => {
    if (!user?.email) return;

    setHistoryLoading(true);
    try {
      const tickets = await fetchMySupportTickets(user);
      if (tickets.length === 0) return;

      const locale = isRTL ? 'ar-EG' : 'en-US';
      const history = supportTicketsToChatMessages(tickets, locale);
      setMessages((prev) => {
        const historyKeys = new Set(
          history.map((entry) => `${entry.from}:${entry.text}`)
        );
        const pendingReplies = prev.filter(
          (entry) =>
            entry.from === 'them' &&
            entry.isAutoReply &&
            !historyKeys.has(`${entry.from}:${entry.text}`)
        );
        return [welcomeMessage, ...history, ...pendingReplies];
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadTicketHistory();
  }, [user?.email, isRTL]);

  useEffect(() => {
    const onFocus = () => loadTicketHistory();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.email, isRTL]);

  useEffect(() => {
    if (!user?.email) return undefined;

    const interval = setInterval(() => {
      loadTicketHistory();
    }, 10000);

    return () => clearInterval(interval);
  }, [user?.email, isRTL]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const MIN_SUPPORT_API_LENGTH = 20;

  const getActiveSupportSession = () => {
    const userId = user?.id || user?._id;
    try {
      return sessionStorage.getItem(supportSessionKey(userId));
    } catch {
      return null;
    }
  };

  const rememberSupportSession = (ticketId) => {
    const userId = user?.id || user?._id;
    if (!ticketId || !userId) return;
    try {
      sessionStorage.setItem(supportSessionKey(userId), String(ticketId));
    } catch {
      // ignore storage errors
    }
  };

  const submitSupportTicket = (messageText, brand) => {
    const taggedMessage = brand?.brandName
      ? `[${brand.brandName}] ${messageText}`
      : messageText;

    const apiMessage =
      taggedMessage.length >= MIN_SUPPORT_API_LENGTH
        ? taggedMessage
        : taggedMessage +
          '\u200b'.repeat(MIN_SUPPORT_API_LENGTH - taggedMessage.length);

    return supportAPI.sendMessage({
      fullName: user?.name || 'Guest',
      email: user?.email || 'guest@brandhive.com',
      message: apiMessage,
    });
  };

  const appendAssistantMessage = (replyText) => {
    const aiMsg = {
      id: Date.now(),
      from: 'them',
      text: replyText,
      time: new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isAutoReply: true,
    };
    setMessages((prev) => [...prev, aiMsg]);
    setChatHistory((prev) => [
      ...prev,
      { role: 'assistant', content: replyText },
    ]);
    return aiMsg;
  };

  const persistAutoResolvedChat = async (messageText, replyText) => {
    const userId = user?.id || user?._id;
    const localTicketId = `auto-${Date.now()}`;
    const ticketMeta = {
      email: user?.email,
      fullName: user?.name || 'Guest',
      message: messageText,
      userId,
    };

    await saveLocalSupportTicket({
      userId,
      email: user?.email,
      fullName: user?.name || 'Guest',
      message: messageText,
      railwayTicketId: localTicketId,
    });
    await autoResolveSupportTicket({
      ticketId: localTicketId,
      reply: replyText,
      ticketMeta,
    });
  };

  const sendMessage = async (textOverride) => {
    const messageText = (textOverride ?? input).trim();
    if (!messageText || aiLoading) return;

    const userMsg = {
      id: Date.now(),
      from: 'me',
      text: messageText,
      time: new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const currentInput = messageText;
    const activeBrand = brandContextRef.current;
    const language = isRTL ? 'ar' : 'en';
    const autoHandled = isAutoHandledSupportIntent(currentInput);

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const historyForAi = [...chatHistory, { role: 'user', content: currentInput }];
    setChatHistory(historyForAi);
    setAiLoading(true);

    try {
      if (autoHandled) {
        const replyText = getInstantSupportReply(currentInput, language);
        appendAssistantMessage(replyText);
        await persistAutoResolvedChat(currentInput, replyText);
        return;
      }

      const shouldOpenTicket =
        !getActiveSupportSession() || Boolean(activeBrand?.brandId);

      const ticketPromise = shouldOpenTicket
        ? submitSupportTicket(currentInput, activeBrand)
        : Promise.resolve(null);

      const [ticketResult, aiResult] = await Promise.allSettled([
        ticketPromise,
        chatAPI.sendMessage(historyForAi, language),
      ]);

      const replyText =
        aiResult.status === 'fulfilled'
          ? aiResult.value?.reply ||
            getInstantSupportReply(currentInput, language)
          : getInstantSupportReply(currentInput, language);

      setAiOffline(
        aiResult.status === 'fulfilled' ? Boolean(aiResult.value?.offline) : true
      );

      appendAssistantMessage(replyText);

      if (ticketResult.status === 'fulfilled' && ticketResult.value) {
        const ticketId = extractSupportTicketId(ticketResult.value);
        const userId = user?.id || user?._id;
        rememberSupportTicketId(userId, ticketId);
        rememberSupportSession(ticketId);

        const ticketMeta = {
          email: user?.email,
          fullName: user?.name || 'Guest',
          message: currentInput,
          userId,
        };

        if (activeBrand?.brandId) {
          await saveBrandInquiryMessage({
            brandId: activeBrand.brandId,
            brandName: activeBrand.brandName,
            userId,
            email: user?.email,
            fullName: user?.name || 'Guest',
            message: currentInput,
            railwayTicketId: ticketId,
          });
          clearBrandContext();
        } else {
          await saveLocalSupportTicket({
            userId,
            email: user?.email,
            fullName: user?.name || 'Guest',
            message: currentInput,
            railwayTicketId: ticketId,
          });

          await autoResolveSupportTicket({
            ticketId,
            reply: replyText,
            ticketMeta,
          });
        }
      } else if (!shouldOpenTicket) {
        await persistAutoResolvedChat(currentInput, replyText);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const supportName = brandContext?.brandName
    ? isRTL
      ? `رسالة إلى ${brandContext.brandName}`
      : `Message ${brandContext.brandName}`
    : isRTL
      ? 'دعم براند هايف'
      : 'BrandHive Support';
  const supportAvatar = brandContext?.brandName ? '🏪' : '🛡️';
  const inputPlaceholder = brandContext?.brandName
    ? isRTL
      ? `اكتب رسالتك إلى ${brandContext.brandName}...`
      : `Type your message to ${brandContext.brandName}...`
    : isRTL
      ? 'اكتب رسالة...'
      : 'Type a message...';

  return (
    <div
      className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : ''}`}
    >
      <div className="page-container py-6">
        <div
          className="bg-white dark:bg-dark-surface rounded-3xl shadow-card-hover dark:shadow-none dark:border dark:border-dark-border overflow-hidden flex flex-col w-full"
          style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}
        >
          <div
            className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-dark-border`}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-brand-cream dark:bg-dark-bg flex items-center justify-center text-xl">
                {supportAvatar}
              </div>
              <div
                className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-dark-surface`}
              />
            </div>
            <div className={`flex-1 text-start`}>
              <p className="font-semibold text-gray-900 dark:text-dark-text">
                {supportName}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-muted">
                {brandContext?.brandName
                  ? isRTL
                    ? '● سيتم إرسال رسالتك الأولى للماركة'
                    : '● Your first message opens a ticket with this brand'
                  : aiOffline
                  ? isRTL
                    ? '● وضع مساعد أساسي — شغّل npm run dev:all للـ AI'
                    : '● Basic assistant mode — run npm run dev:all for live AI'
                  : isRTL
                    ? '● مساعد AI متصل'
                    : '● AI assistant online'}
              </p>
            </div>
            <div
              className={`flex items-center gap-1`}
            >
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              >
                <Phone size={16} />
              </button>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              >
                <Info size={16} />
              </button>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 px-5 py-3`}
          >
            <div className="flex-1 h-px bg-gray-100 dark:bg-dark-border" />
            <span className="text-xs text-gray-400 dark:text-dark-muted flex-shrink-0">
              {isRTL ? 'اليوم · 10 مارس 2025' : 'Today · March 10, 2025'}
            </span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-dark-border" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3">
            {historyLoading && (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-400 dark:text-dark-muted mt-2">
                  {isRTL
                    ? 'جاري تحميل محادثاتك...'
                    : 'Loading your conversations...'}
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 w-full ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.from !== 'me' && (
                  <div className="w-8 h-8 rounded-xl bg-brand-cream dark:bg-dark-bg flex items-center justify-center text-lg flex-shrink-0 mb-0.5">
                    {supportAvatar}
                  </div>
                )}
                <div
                  className={`max-w-[75%] ${msg.from === 'me' ? (isRTL ? 'items-start' : 'items-end') : isRTL ? 'items-end' : 'items-start'} flex flex-col gap-1`}
                >
                  {msg.isCard ? (
                    <div
                      className={`bg-brand-cream dark:bg-dark-bg border border-brand-gold/30 dark:border-brand-gold/50 rounded-2xl p-4 text-sm text-start`}
                    >
                      <p className="font-bold text-brand-navy dark:text-brand-gold mb-2">
                        {msg.cardData.id} · {isRTL ? 'الحالة' : 'Status'}
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-dark-text">
                        {msg.cardData.status}
                      </p>
                      <p className="text-gray-600 dark:text-dark-muted text-xs mt-1">
                        {msg.cardData.courier} · {isRTL ? 'وصول متوقع' : 'ETA'}{' '}
                        {msg.cardData.eta}
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.from === 'me'
                          ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy rounded-br-sm'
                          : msg.isAdminReply
                            ? 'bg-brand-gold/10 border border-brand-gold/30 text-gray-900 dark:text-dark-text rounded-bl-sm'
                            : 'bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-bl-sm'
                      } ${isRTL || msg.isArabic ? 'text-right' : ''}`}
                    >
                      {msg.text}
                    </div>
                  )}
                  <span className="text-xs text-gray-400 dark:text-dark-muted px-1">
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white dark:bg-dark-surface rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-[70%]">
                  <div className="flex gap-1 items-center">
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div
            className={`px-5 py-2 flex gap-2 overflow-x-auto`}
          >
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => sendMessage(action)}
                disabled={aiLoading}
                className="flex-shrink-0 px-3 py-1.5 bg-brand-cream dark:bg-dark-bg text-brand-navy dark:text-brand-gold text-xs font-medium rounded-xl hover:bg-brand-navy/10 dark:hover:bg-brand-gold/10 transition-colors border border-brand-navy/20 dark:border-brand-gold/20 disabled:opacity-50"
              >
                {action}
              </button>
            ))}
          </div>

          <div className="px-4 pb-4 pt-2">
            <div
              className={`flex items-center gap-2 bg-gray-50 dark:bg-dark-bg rounded-2xl p-1 border border-gray-200 dark:border-dark-border focus-within:border-brand-navy dark:focus-within:border-brand-gold focus-within:bg-white dark:focus-within:bg-dark-surface transition-all`}
            >
              <button
                type="button"
                className="p-2 rounded-xl text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors flex-shrink-0"
              >
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={inputPlaceholder}
                className={`flex-1 bg-transparent text-sm focus:outline-none py-2 text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-muted ${isRTL ? 'text-right' : ''}`}
              />
              <button
                type="button"
                className="p-2 rounded-xl text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors flex-shrink-0"
              >
                <Smile size={16} />
              </button>
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || aiLoading}
                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                  input.trim()
                    ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy hover:bg-opacity-90 shadow-sm'
                    : 'bg-gray-200 dark:bg-dark-bg text-gray-400 dark:text-dark-muted cursor-not-allowed'
                }`}
              >
                <Send size={15} className="rtl-flip" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
