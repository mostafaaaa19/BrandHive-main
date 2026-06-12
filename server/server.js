const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const https = require('https');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dotenv.config({ path: __dirname + '/.env' });

// Windows: link-local/system DNS often fails Node SRV lookups for MongoDB Atlas
if (process.env.MONGO_URI?.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'https://brand-hivee.vercel.app',
    'https://brandhive.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/brand', require('./routes/brands'));
app.use('/product', require('./routes/products'));
app.use('/orders', require('./routes/orders'));
app.use('/users', require('./routes/users'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'BrandHive API is running', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'BrandHive API — use the React app at http://localhost:5173',
    endpoints: ['/health', '/auth', '/brand', '/product', '/orders', '/users', '/chat/ai'],
  });
});

const getOfflineChatReply = (messages, language) => {
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
  const text = (lastUser?.content || '').toLowerCase();

  const isAr = language === 'ar';

  if (text.includes('track') || text.includes('order') || text.includes('تتبع') || text.includes('طلب')) {
    return isAr
      ? 'لتتبع طلبك، افتح حسابك ← طلباتي. إذا احتجت مساعدة إضافية، أرسل رقم الطلب وسيتواصل معك فريق الدعم.'
      : 'To track your order, go to your account → My Orders. If you need more help, send your order number and our team will follow up.';
  }
  if (text.includes('return') || text.includes('استرجاع')) {
    return isAr
      ? 'طلبات الاسترجاع متاحة خلال 14 يوماً. افتح الطلب من "طلباتي" واختر طلب استرجاع، أو اترك تفاصيل الطلب هنا.'
      : 'Returns are available within 14 days. Open the order from My Orders and request a return, or leave your order details here.';
  }
  if (text.includes('cancel') || text.includes('إلغاء')) {
    return isAr
      ? 'يمكن إلغاء الطلب قبل الشحن من صفحة "طلباتي". أرسل رقم الطلب إن لم يظهر لك خيار الإلغاء.'
      : 'You can cancel before shipping from My Orders. Send your order number if you do not see a cancel option.';
  }
  if (text.includes('payment') || text.includes('pay') || text.includes('دفع')) {
    return isAr
      ? 'نقبل Paymob والبطاقات وفوري وفودافون كاش والدفع عند الاستلام. إذا فشل الدفع، جرّب مرة أخرى من الطلب أو تواصل مع الدعم.'
      : 'We accept Paymob, cards, Fawry, Vodafone Cash, and cash on delivery. If payment failed, retry from your order or contact support.';
  }

  return isAr
    ? 'شكراً لتواصلك مع BrandHive. تم استلام رسالتك وسيرد فريق الدعم قريباً.'
    : 'Thanks for contacting BrandHive. Your message was received and our support team will reply soon.';
};

app.post('/chat/ai', async (req, res) => {
  const { messages, language } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ reply: getOfflineChatReply(messages, language), offline: true });
  }

  try {
    const payload = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: language === 'ar'
        ? 'أنت مساعد دعم عملاء لمنصة BrandHive، أكبر سوق للعلامات التجارية المحلية في مصر. ساعد العملاء في تتبع الطلبات والمنتجات والمرتجعات وطرق الدفع والتوصيل. كن ودوداً وموجزاً. الرد باللغة العربية دائماً.'
        : 'You are a helpful customer support assistant for BrandHive, Egypt #1 local marketplace. Help customers with order tracking, products, returns, payment methods (Paymob, Fawry, Cash on Delivery), and delivery across 27 Egyptian governorates. Be friendly and concise. Always respond in English.',
      messages: messages || [],
    });

    const data = await new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
        },
        (response) => {
          let body = '';
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (response.statusCode >= 400) {
                const error = new Error(parsed.error?.message || 'Anthropic API error');
                error.response = { data: parsed };
                reject(error);
              } else {
                resolve(parsed);
              }
            } catch (parseErr) {
              reject(parseErr);
            }
          });
        }
      );
      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    const text = data?.content?.[0]?.text || 'Sorry, something went wrong.';
    res.json({ reply: text });
  } catch (err) {
    console.error('AI chat error:', err.response?.data || err.message);
    res.json({
      reply: getOfflineChatReply(messages, language),
      offline: true,
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// DB Connection + Server Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/brandhive';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 BrandHive API running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Starting server without database...');
    app.listen(PORT, () => {
      console.log(`🚀 BrandHive API running on http://localhost:${PORT} (no DB)`);
    });
  });

module.exports = app;
