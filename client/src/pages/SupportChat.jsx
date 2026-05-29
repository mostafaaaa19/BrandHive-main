import { useState, useRef, useEffect } from 'react';
import { Send, Search, MoreVertical, Phone, Info, Paperclip, Smile, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

export default function SupportChat() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  const CONVERSATIONS = [
    {
      id: 1,
      name: isRTL ? 'دعم براند هايف' : 'BrandHive Support',
      avatar: '🛡️',
      lastMsg: isRTL ? 'مرحباً! كيف يمكننا مساعدتك اليوم؟' : 'Hello! How can we help you today?',
      time: isRTL ? 'منذ دقيقتين' : '2 min ago',
      unread: 2,
      online: true,
      isSupport: true,
      messages: [
        { id: 1, from: 'them', text: 'مرحباً بك في مركز دعم BrandHive! كيف يمكننا مساعدتك اليوم؟', time: '10:23 AM', isArabic: true },
        { id: 2, from: 'them', text: 'Hello! Welcome to BrandHive support center. How can we help you today?', time: '10:23 AM' },
        { id: 3, from: 'me', text: isRTL ? 'مرحباً! لقد طلبت فازة فرعونية قبل 3 أيام ولم أستلم معلومات التتبع بعد.' : 'Hello! I placed order #BH-8821 three days ago and haven\'t received tracking info yet.', time: '10:25 AM' },
        { id: 4, from: 'them', text: isRTL ? 'لا مشكلة — سأتحقق من ذلك! طلبك قيد التحضير للشحن.' : 'No problem — let me check that for you! Your order #BH-8821 (Pharaonic Vase from Luxor Crafts) is being prepared for shipment.', time: '10:26 AM' },
        { id: 5, from: 'them', isCard: true, cardData: { id: '#BH-8821', status: isRTL ? 'جاري التجهيز للشحن' : 'Preparing for Shipment', courier: isRTL ? 'بوسطة إكسبريس' : 'Bosta Express', eta: isRTL ? '13–14 مارس' : 'Mar 13–14' }, time: '10:26 AM' },
        { id: 6, from: 'me', text: isRTL ? 'ممتاز، شكراً جزيلاً!' : 'Perfect, thank you so much!', time: '10:28 AM' },
        { id: 7, from: 'them', text: isRTL ? 'على الرحب والسعة! هل هناك شيء آخر يمكنني مساعدتك به؟' : 'You\'re welcome! Is there anything else I can help you with?', time: '10:29 AM' },
      ]
    },
    {
      id: 2,
      name: isRTL ? 'لوكسر كرافتس' : 'Luxor Crafts',
      avatar: '🏺',
      lastMsg: isRTL ? 'تم شحن طلبك!' : 'Your order has shipped!',
      time: isRTL ? 'منذ ساعة' : '1 hr ago',
      unread: 0,
      online: false,
      messages: [
        { id: 1, from: 'them', text: isRTL ? 'أخبار رائعة! تم شحن طلبك! 📦' : 'Great news! Your order has shipped! 📦', time: '9:00 AM' },
        { id: 2, from: 'them', text: isRTL ? 'رقم التتبع: BOSTA123456789. الوصول المتوقع: 13-14 مارس.' : 'Tracking number: BOSTA123456789. Expected delivery: March 13-14.', time: '9:01 AM' },
        { id: 3, from: 'me', text: isRTL ? 'رائع، شكراً لك!' : 'Amazing, thank you!', time: '9:05 AM' },
      ]
    },
  ];

  const QUICK_ACTIONS = [
    isRTL ? 'تتبع طلبي' : 'Track my order',
    isRTL ? 'طلب استرجاع' : 'Return request',
    isRTL ? 'إلغاء الطلب' : 'Cancel order',
    isRTL ? 'مشكلة في الدفع' : 'Payment issue'
  ];

  const [activeConv, setActiveConv] = useState(CONVERSATIONS[0]);
  const [messages, setMessages] = useState(CONVERSATIONS[0].messages);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [showConvList, setShowConvList] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConv = (conv) => {
    setActiveConv(conv);
    setMessages(conv.messages);
    setShowConvList(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || aiLoading) return;

    const userMsg = {
      id: messages.length + 1,
      from: 'me',
      text: input,
      time: new Date().toLocaleTimeString(
        isRTL ? 'ar-EG' : 'en-US',
        { hour: '2-digit', minute: '2-digit' }
      ),
    };

    const currentInput = input;
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Only call AI for the BrandHive support conversation
    if (!activeConv.isSupport) return;

    setAiLoading(true);

    const newHistory = [
      ...chatHistory,
      { role: 'user', content: currentInput }
    ];
    setChatHistory(newHistory);

    try {
      const response = await fetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            system: `You are a helpful customer support assistant for BrandHive, Egypt's #1 local marketplace.
You help customers with:
- Order tracking and status
- Product information
- Returns and refunds policy
- Seller information
- Payment methods (Paymob, Fawry, Cash on Delivery)
- Delivery across all 27 Egyptian governorates
- General questions about BrandHive platform
Always be friendly, helpful, and concise.
${isRTL ? 'الرد باللغة العربية دائماً.' : 'Always respond in English.'}`,
            messages: newHistory,
          }),
        }
      );

      const data = await response.json();
      const aiText = data?.content?.[0]?.text ||
        (isRTL
          ? 'عذراً، حدث خطأ. يرجى المحاولة مجدداً.'
          : 'Sorry, something went wrong. Please try again.'
        );

      const aiMsg = {
        id: messages.length + 2,
        from: 'them',
        text: aiText,
        time: new Date().toLocaleTimeString(
          isRTL ? 'ar-EG' : 'en-US',
          { hour: '2-digit', minute: '2-digit' }
        ),
      };

      setMessages(prev => [...prev, aiMsg]);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: aiText }
      ]);

    } catch {
      const errMsg = {
        id: messages.length + 2,
        from: 'them',
        text: isRTL
          ? 'عذراً، لا يمكن الاتصال بالدعم الآن. يرجى المحاولة لاحقاً.'
          : 'Sorry, support is unavailable right now. Please try again later.',
        time: new Date().toLocaleTimeString(
          isRTL ? 'ar-EG' : 'en-US',
          { hour: '2-digit', minute: '2-digit' }
        ),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setAiLoading(false);
    }
  };

  const filteredConvs = CONVERSATIONS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : ''}`}>
      <div className="page-container py-6">
        <div className={`bg-white dark:bg-dark-surface rounded-3xl shadow-card-hover dark:shadow-none dark:border dark:border-dark-border overflow-hidden flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
            {/* Conversations List */}
            <div className={`${showConvList ? 'flex' : 'hidden md:flex'} md:w-80 w-full flex-col ${isRTL ? 'border-l' : 'border-r'} border-gray-100 dark:border-dark-border`}>
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-dark-border">
                <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <h2 className="font-display font-bold text-gray-900 dark:text-dark-text">{isRTL ? 'المحادثات' : 'Messages'}</h2>
                  <span className="text-xs bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy px-2 py-1 rounded-full font-semibold">
                    {CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0)} {isRTL ? 'غير مقروءة' : 'Unread'}
                  </span>
                </div>
                <div className="relative">
                  <Search size={14} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted`} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={isRTL ? 'ابحث في الرسائل...' : 'Search messages...'}
                    className={`w-full ${isRTL ? 'pr-8 pl-3 text-right' : 'pl-8 pr-3'} py-2 bg-gray-50 dark:bg-dark-bg rounded-xl text-sm focus:outline-none focus:bg-white dark:focus:bg-dark-surface focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20 dark:text-dark-text dark:placeholder-dark-muted`}
                  />
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {filteredConvs.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => selectConv(conv)}
                    className={`w-full flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-dark-bg/50 transition-colors ${isRTL ? 'flex-row-reverse text-right' : 'text-left'} border-b border-gray-50 dark:border-dark-border/50 ${
                      activeConv.id === conv.id ? (isRTL ? 'bg-brand-cream dark:bg-dark-bg border-r-4 border-brand-gold' : 'bg-brand-cream dark:bg-dark-bg border-l-4 border-brand-navy dark:border-l-brand-gold') : (isRTL ? 'border-r-4 border-transparent' : 'border-l-4 border-transparent')
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-2xl bg-brand-cream dark:bg-dark-surface flex items-center justify-center text-2xl">
                        {conv.avatar}
                      </div>
                      {conv.online && (
                        <div className={`absolute -bottom-0.5 ${isRTL ? '-left-0.5' : '-right-0.5'} w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-dark-surface`}></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center justify-between mb-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate">{conv.name}</p>
                        <span className="text-xs text-gray-400 dark:text-dark-muted flex-shrink-0">{conv.time}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-muted truncate">{conv.lastMsg}</p>
                    </div>
                    {conv.unread > 0 && (
                      <div className="w-5 h-5 bg-brand-navy dark:bg-brand-gold rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white dark:text-brand-navy text-xs font-bold">{conv.unread}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Window */}
            <div className={`${!showConvList ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
              {/* Chat Header */}
              <div className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowConvList(true)} className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg text-gray-900 dark:text-dark-text">
                  <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
                </button>
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-brand-cream dark:bg-dark-bg flex items-center justify-center text-xl">
                    {activeConv.avatar}
                  </div>
                  {activeConv.online && (
                    <div className={`absolute -bottom-0.5 ${isRTL ? '-left-0.5' : '-right-0.5'} w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-dark-surface`}></div>
                  )}
                </div>
                <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="font-semibold text-gray-900 dark:text-dark-text">{activeConv.name}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted">
                    {activeConv.online ? (isRTL ? '● متصل' : '● Online') : (isRTL ? '○ غير متصل' : '○ Offline')}
                    {activeConv.isSupport && (isRTL ? ' · متوسط الرد 5 دقائق' : ' · avg. reply 5 min')}
                  </p>
                </div>
                <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors">
                    <Phone size={16} />
                  </button>
                  <button className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors">
                    <Info size={16} />
                  </button>
                </div>
              </div>

              {/* Date separator */}
              <div className={`flex items-center gap-3 px-5 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1 h-px bg-gray-100 dark:bg-dark-border"></div>
                <span className="text-xs text-gray-400 dark:text-dark-muted flex-shrink-0">
                  {isRTL ? 'اليوم · 10 مارس 2025' : 'Today · March 10, 2025'}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-dark-border"></div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${msg.from === 'me' ? (isRTL ? 'flex-row' : 'flex-row-reverse') : (isRTL ? 'flex-row-reverse' : 'flex-row')}`}
                  >
                    {msg.from !== 'me' && (
                      <div className="w-8 h-8 rounded-xl bg-brand-cream dark:bg-dark-bg flex items-center justify-center text-lg flex-shrink-0 mb-0.5">
                        {activeConv.avatar}
                      </div>
                    )}
                    <div className={`max-w-[75%] ${msg.from === 'me' ? (isRTL ? 'items-start' : 'items-end') : (isRTL ? 'items-end' : 'items-start')} flex flex-col gap-1`}>
                      {msg.isCard ? (
                        <div className={`bg-brand-cream dark:bg-dark-bg border border-brand-gold/30 dark:border-brand-gold/50 rounded-2xl p-4 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                          <p className="font-bold text-brand-navy dark:text-brand-gold mb-2">{msg.cardData.id} · {isRTL ? 'الحالة' : 'Status'}</p>
                          <p className="font-semibold text-gray-900 dark:text-dark-text">{msg.cardData.status}</p>
                          <p className="text-gray-600 dark:text-dark-muted text-xs mt-1">{msg.cardData.courier} · {isRTL ? 'وصول متوقع' : 'ETA'} {msg.cardData.eta}</p>
                        </div>
                      ) : (
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.from === 'me'
                            ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy rounded-br-sm'
                            : 'bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-bl-sm'
                        } ${isRTL || msg.isArabic ? 'text-right' : ''}`}>
                          {msg.text}
                        </div>
                      )}
                      <span className="text-xs text-gray-400 dark:text-dark-muted px-1">{msg.time}</span>
                    </div>
                  </div>
                ))}

                {/* AI typing indicator */}
                {aiLoading && (
                  <div className="flex justify-start mb-3">
                    <div className="bg-white dark:bg-dark-surface rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-[70%]">
                      <div className="flex gap-1 items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              {activeConv.isSupport && (
                <div className={`px-5 py-2 flex gap-2 overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {QUICK_ACTIONS.map(action => (
                    <button
                      key={action}
                      onClick={() => setInput(action)}
                      className="flex-shrink-0 px-3 py-1.5 bg-brand-cream dark:bg-dark-bg text-brand-navy dark:text-brand-gold text-xs font-medium rounded-xl hover:bg-brand-navy/10 dark:hover:bg-brand-gold/10 transition-colors border border-brand-navy/20 dark:border-brand-gold/20"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-4 pt-2">
                <div className={`flex items-center gap-2 bg-gray-50 dark:bg-dark-bg rounded-2xl p-1 border border-gray-200 dark:border-dark-border focus-within:border-brand-navy dark:focus-within:border-brand-gold focus-within:bg-white dark:focus-within:bg-dark-surface transition-all ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button className="p-2 rounded-xl text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors flex-shrink-0">
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                    className={`flex-1 bg-transparent text-sm focus:outline-none py-2 text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-muted ${isRTL ? 'text-right' : ''}`}
                  />
                  <button className="p-2 rounded-xl text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors flex-shrink-0">
                    <Smile size={16} />
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || aiLoading}
                    className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                      input.trim() ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy hover:bg-opacity-90 shadow-sm' : 'bg-gray-200 dark:bg-dark-bg text-gray-400 dark:text-dark-muted cursor-not-allowed'
                    }`}
                  >
                    <Send size={15} className={isRTL ? 'rotate-180' : ''} />
                  </button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
