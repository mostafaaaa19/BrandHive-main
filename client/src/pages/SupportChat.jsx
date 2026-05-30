import { useState, useRef, useEffect } from 'react';
import { Send, Phone, Info, Paperclip, Smile } from 'lucide-react';
import { chatAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function SupportChat() {
  const { isRTL } = useLanguage();

  const QUICK_ACTIONS = [
    isRTL ? 'تتبع طلبي' : 'Track my order',
    isRTL ? 'طلب استرجاع' : 'Return request',
    isRTL ? 'إلغاء الطلب' : 'Cancel order',
    isRTL ? 'مشكلة في الدفع' : 'Payment issue'
  ];

  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'them',
      text: isRTL
        ? 'مرحباً بك في مركز دعم BrandHive! 🐝 كيف يمكننا مساعدتك اليوم؟'
        : 'Welcome to BrandHive Support! 🐝 How can we help you today?',
      time: new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    setAiLoading(true);

    const newHistory = [
      ...chatHistory,
      { role: 'user', content: currentInput }
    ];
    setChatHistory(newHistory);

    try {
      const res = await chatAPI.sendMessage(newHistory, isRTL ? 'ar' : 'en');
      const aiText = res?.reply ||
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

  const supportName = isRTL ? 'دعم براند هايف' : 'BrandHive Support';
  const supportAvatar = '🛡️';

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : ''}`}>
      <div className="page-container py-6">
        <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-card-hover dark:shadow-none dark:border dark:border-dark-border overflow-hidden flex flex-col w-full" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
          {/* Chat Header */}
          <div className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-brand-cream dark:bg-dark-bg flex items-center justify-center text-xl">
                {supportAvatar}
              </div>
              <div className={`absolute -bottom-0.5 ${isRTL ? '-left-0.5' : '-right-0.5'} w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-dark-surface`}></div>
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="font-semibold text-gray-900 dark:text-dark-text">{supportName}</p>
              <p className="text-xs text-gray-500 dark:text-dark-muted">
                {isRTL ? '● متصل · متوسط الرد 5 دقائق' : '● Online · avg. reply 5 min'}
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
                    {supportAvatar}
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
  );
}
