const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const buildOrderInvoiceHtml = (
  order,
  { isRTL = false, customerEmail = '' } = {}
) => {
  if (!order) return '';

  const orderId = order._id || order.id || order.orderId || '';
  const orderNumber =
    order.orderNumber ||
    order.invoiceNumber ||
    `BH-${String(orderId).slice(-6).toUpperCase()}`;
  const items = order.items || order.products || [];
  const total = Number(order.totalAmount || order.total || order.amount || 0);
  const subtotal = Number(order.subtotal ?? total);
  const shipping = Number(order.shippingFee || order.shipping || 0);
  const discount = Number(order.couponDiscount || order.discount || 0);
  const address = order.shippingAddress || {};
  const status = order.status || order.orderStatus || 'pending';
  const paymentMethod = order.paymentMethod || 'Cash on Delivery';
  const date = new Date(order.createdAt || order.date || Date.now()).toLocaleString(
    isRTL ? 'ar-EG' : 'en-US',
    { dateStyle: 'medium', timeStyle: 'short' }
  );

  const labels = isRTL
    ? {
        title: 'فاتورة BrandHive',
        orderNo: 'رقم الطلب',
        date: 'التاريخ',
        status: 'الحالة',
        customer: 'العميل',
        product: 'المنتج',
        qty: 'الكمية',
        price: 'السعر',
        lineTotal: 'الإجمالي',
        subtotal: 'المجموع الفرعي',
        shipping: 'الشحن',
        discount: 'الخصم',
        total: 'الإجمالي',
        payment: 'طريقة الدفع',
        address: 'عنوان التوصيل',
        print: 'طباعة / حفظ PDF',
        note: 'فاتورة من التطبيق — إرسال البريد غير مفعّل على السيرفر حالياً.',
      }
    : {
        title: 'BrandHive Invoice',
        orderNo: 'Order No.',
        date: 'Date',
        status: 'Status',
        customer: 'Customer',
        product: 'Product',
        qty: 'Qty',
        price: 'Price',
        lineTotal: 'Total',
        subtotal: 'Subtotal',
        shipping: 'Shipping',
        discount: 'Discount',
        total: 'Grand Total',
        payment: 'Payment',
        address: 'Shipping Address',
        print: 'Print / Save PDF',
        note: 'In-app invoice — server email delivery is not configured yet.',
      };

  const customerName =
    address.fullName ||
    order.user?.name ||
    order.customerName ||
    'Customer';

  const itemsHtml = items.length
    ? items
        .map((item) => {
          const name =
            item.productName || item.product?.name || item.name || 'Product';
          const qty = Number(item.quantity || 1);
          const unit = Number(item.unitPrice || item.price || 0);
          const line = Number(item.itemTotal || unit * qty);
          return `<tr>
            <td>${escapeHtml(name)}</td>
            <td>${qty}</td>
            <td>${unit.toLocaleString()} EGP</td>
            <td>${line.toLocaleString()} EGP</td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="4">${isRTL ? 'لا توجد منتجات' : 'No items'}</td></tr>`;

  const addressHtml = address.fullName
    ? `${escapeHtml(address.fullName)}<br/>
       ${escapeHtml(address.street || '')}${address.city ? `, ${escapeHtml(address.city)}` : ''}<br/>
       ${escapeHtml(address.governorate || '')}${address.country ? `, ${escapeHtml(address.country)}` : ''}<br/>
       ${escapeHtml(address.phone || '')}`
    : (isRTL ? 'غير متوفر' : 'N/A');

  return `<!DOCTYPE html>
<html lang="${isRTL ? 'ar' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.title)} — ${escapeHtml(orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ${isRTL ? 'Tahoma, Arial' : 'Segoe UI, Arial'}, sans-serif; margin: 0; padding: 32px; color: #111; background: #fff; direction: ${isRTL ? 'rtl' : 'ltr'}; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #c9a227; padding-bottom: 16px; }
    .brand { font-size: 28px; font-weight: 800; color: #0f172a; }
    .brand span { color: #c9a227; }
    .meta { text-align: start; font-size: 13px; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #f8f7f4; border-radius: 12px; padding: 14px 16px; font-size: 13px; line-height: 1.6; }
    .card h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: start; }
    th { background: #0f172a; color: #fff; font-size: 12px; }
    .totals { max-width: 320px; margin-inline-start: auto; font-size: 14px; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals .grand { font-size: 18px; font-weight: 800; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 10px; }
    .note { margin-top: 24px; font-size: 12px; color: #666; }
    .actions { margin-bottom: 20px; }
    button { background: #0f172a; color: #fff; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; font-size: 14px; }
    @media print { .actions { display: none; } body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">${escapeHtml(labels.print)}</button>
  </div>
  <div class="header">
    <div class="brand">Brand<span>Hive</span></div>
    <div class="meta">
      <div><strong>${escapeHtml(labels.orderNo)}:</strong> ${escapeHtml(orderNumber)}</div>
      <div><strong>${escapeHtml(labels.date)}:</strong> ${escapeHtml(date)}</div>
      <div><strong>${escapeHtml(labels.status)}:</strong> ${escapeHtml(status)}</div>
    </div>
  </div>
  <div class="grid">
    <div class="card">
      <h3>${escapeHtml(labels.customer)}</h3>
      <div>${escapeHtml(customerName)}</div>
      ${customerEmail ? `<div>${escapeHtml(customerEmail)}</div>` : ''}
    </div>
    <div class="card">
      <h3>${escapeHtml(labels.address)}</h3>
      <div>${addressHtml}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(labels.product)}</th>
        <th>${escapeHtml(labels.qty)}</th>
        <th>${escapeHtml(labels.price)}</th>
        <th>${escapeHtml(labels.lineTotal)}</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    <div><span>${escapeHtml(labels.subtotal)}</span><span>${subtotal.toLocaleString()} EGP</span></div>
    ${shipping ? `<div><span>${escapeHtml(labels.shipping)}</span><span>${shipping.toLocaleString()} EGP</span></div>` : ''}
    ${discount ? `<div><span>${escapeHtml(labels.discount)}</span><span>-${discount.toLocaleString()} EGP</span></div>` : ''}
    <div class="grand"><span>${escapeHtml(labels.total)}</span><span>${total.toLocaleString()} EGP</span></div>
    <div><span>${escapeHtml(labels.payment)}</span><span>${escapeHtml(paymentMethod)}</span></div>
  </div>
  <p class="note">${escapeHtml(labels.note)}</p>
</body>
</html>`;
};

export const openInvoiceHtml = (html) => {
  if (!html) return false;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');

  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return true;
  }

  URL.revokeObjectURL(url);
  return false;
};

export const openLocalOrderInvoice = (order, options = {}) => {
  const html = buildOrderInvoiceHtml(order, options);
  return openInvoiceHtml(html);
};

const extractOrderData = (response) =>
  response?.data?.data ||
  response?.data?.order ||
  response?.data ||
  null;

export const resolveOrderInvoice = async ({
  orderId,
  orderFallback = null,
  fetchOrder,
  isRTL = false,
  customerEmail = '',
}) => {
  let orderData = orderFallback;
  const id = String(orderId || '');

  if (
    fetchOrder &&
    (!orderData ||
      String(orderData._id || orderData.id || orderData.orderId || '') !== id)
  ) {
    const detailRes = await fetchOrder(orderId);
    orderData = extractOrderData(detailRes) || orderData;
  }

  if (!orderData) {
    return { type: 'error' };
  }

  return {
    type: 'local',
    html: buildOrderInvoiceHtml(orderData, { isRTL, customerEmail }),
  };
};

export const showOrderInvoice = async ({
  orderId,
  orderFallback = null,
  fetchOrder,
  isRTL = false,
  customerEmail = '',
  onBlocked,
}) => {
  if (orderFallback) {
    const html = buildOrderInvoiceHtml(orderFallback, { isRTL, customerEmail });
    if (openInvoiceHtml(html)) {
      return { type: 'local' };
    }
  }

  const previewWin = window.open('about:blank', '_blank');
  if (previewWin) {
    previewWin.document.open();
    previewWin.document.write(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;color:#444"><p>${
        isRTL ? 'جاري تحميل الفاتورة...' : 'Loading invoice...'
      }</p></body></html>`
    );
    previewWin.document.close();
  }

  const result = await resolveOrderInvoice({
    orderId,
    orderFallback,
    fetchOrder,
    isRTL,
    customerEmail,
  });

  if (result.type === 'local' && result.html) {
    if (previewWin && !previewWin.closed) {
      previewWin.document.open();
      previewWin.document.write(result.html);
      previewWin.document.close();
      return result;
    }
    if (openInvoiceHtml(result.html)) {
      return result;
    }
  }

  previewWin?.close();
  onBlocked?.();
  return { type: 'error' };
};
