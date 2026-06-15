import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { confirmPaymobReturn, parsePaymobReturnSuccess } from '../services/api';

export default function PaymentReturnPage() {
  const { isRTL } = useLanguage();
  const [params] = useSearchParams();
  const orderId = params.get('orderId') || '';
  const [confirming, setConfirming] = useState(Boolean(orderId));
  const [confirmedStatus, setConfirmedStatus] = useState(null);

  const isSuccess = useMemo(() => {
    if (confirmedStatus === 'paid') return true;
    if (confirmedStatus === 'failed') return false;
    return parsePaymobReturnSuccess(params);
  }, [confirmedStatus, params]);

  useEffect(() => {
    if (!orderId) {
      setConfirming(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await confirmPaymobReturn(orderId, params);
        if (!cancelled) {
          setConfirmedStatus(result?.success ? 'paid' : 'failed');
        }
      } catch {
        if (!cancelled) {
          setConfirmedStatus(parsePaymobReturnSuccess(params) ? 'paid' : 'failed');
        }
      } finally {
        if (!cancelled) setConfirming(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, params.toString()]);

  return (
    <div className="min-h-screen bg-brand-cream dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-card-hover p-10 max-w-md w-full text-center">
        {isSuccess ? (
          <CheckCircle className="mx-auto text-emerald-500 mb-4" size={56} />
        ) : (
          <XCircle className="mx-auto text-amber-500 mb-4" size={56} />
        )}
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-3">
          {confirming
            ? isRTL
              ? 'جاري تأكيد الدفع...'
              : 'Confirming payment...'
            : isSuccess
              ? isRTL
                ? 'تم الدفع بنجاح'
                : 'Payment successful'
              : isRTL
                ? 'تمت العودة من بوابة الدفع'
                : 'Returned from payment gateway'}
        </h1>
        <p className="text-gray-600 dark:text-dark-muted mb-6 text-sm">
          {confirming
            ? isRTL
              ? 'انتظر لحظة بينما نحدّث حالة طلبك.'
              : 'Please wait while we update your order status.'
            : isSuccess
              ? isRTL
                ? 'شكراً لك! يمكنك متابعة حالة طلبك من صفحة الطلبات.'
                : 'Thank you! You can track your order from the orders page.'
              : isRTL
                ? 'إذا لم يكتمل الدفع، جرّب مرة أخرى من صفحة طلباتك أو اختر الدفع عند الاستلام.'
                : 'If payment did not complete, retry from your orders page or choose cash on delivery.'}
        </p>
        {orderId && (
          <p className="text-xs text-gray-500 dark:text-dark-muted mb-6">
            {isRTL ? 'رقم الطلب:' : 'Order:'} #{orderId.slice(-6).toUpperCase()}
          </p>
        )}
        <Link to="/account?tab=orders" className="btn-primary inline-block">
          {isRTL ? 'عرض طلباتي' : 'View my orders'}
        </Link>
      </div>
    </div>
  );
}
