
const KEY = 'am-professional-v1';

const SUPABASE_URL = 'https://mtwlyaauzjlzfpezfzap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MOehj93WpdBVu99gwF2Ndw_azfQMESE';

const cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
let db, cart = [];

const money = (n, c = 'PKR') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: 2
  }).format(n || 0);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

async function boot() {
  try {
    const seed = await (await fetch('workbook-seed-data.json')).json();

    try {
      db = JSON.parse(localStorage.getItem(KEY)) || seed;
    } catch {
      db = seed;
    }

    db.orders ??= [];
    db.deals ??= [];
    db.wastage ??= [];
    db.supportMessages ??= [];
    db.storeEta ??= 45;
    db.deliveryFee ??= 0;
    db.deliveryDiscount ??= 50;
    db.defaultGst ??= 0;
    db.storeDisplayName ??= 'Avenuex.Online-Store';

    Object.keys(db.rates || { PKR: 1 }).forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      $('currency').append(o);
    });

    $('currency').value = db.currency || 'PKR';
    $('brand').textContent = db.storeDisplayName;

    render();
    wire();
  } catch (e) {
    console.error(e);
    alert('Store data could not load. Check workbook-seed-data.json.');
  }
}

function available(p) {
  const sold = (db.sales || [])
    .filter(s => s.code === p.code && !s.voided)
    .reduce((a, s) => a + (+s.qty || 0), 0);

  const returned = (db.sales || [])
    .filter(s => s.code === p.code && !s.voided)
    .reduce((a, s) => a + (+s.returnQty || 0), 0);

  const waste = (db.wastage || [])
    .filter(w => w.code === p.code)
    .reduce((a, w) => a + (+w.qty || 0), 0);

  return (+p.opening || 0) + (+p.stockIn || 0) - sold + returned - waste;
}

function fx(v, from, to) {
  const pkr = v * (db.rates?.[from] || 1);
  return pkr / (db.rates?.[to] || 1);
}

function render() {
  const c = $('currency').value || 'PKR';

  $('deals').innerHTML = (db.deals || []).map((d, i) => `
    <article class="product">
      ${d.image
        ? `<img src="${d.image}" alt="${esc(d.name)}" style="width:100%;height:130px;object-fit:contain">`
        : '<div class="productmark">DEAL</div>'}
      <b>${esc(d.name)}</b>
      <small>${(d.items || []).map(it => {
        const p = db.products.find(x => x.code === it.code);
        return esc(p?.name || it.code) + ' × ' + it.qty;
      }).join(' + ')}</small>
      <strong>${money(fx(d.price, 'PKR', c), c)}</strong>
      <button class="primary" data-deal="${i}">Add deal</button>
    </article>
  `).join('') || '<p class="hint">No active deals right now.</p>';

  $('products').innerHTML = (db.products || []).map(p => `
    <article class="product">
      ${p.image
        ? `<img src="${p.image}" alt="${esc(p.name)}" style="width:100%;height:130px;object-fit:contain">`
        : `<div class="productmark">${esc((p.name || 'P').slice(0, 1))}</div>`}
      <b>${esc(p.name)}</b>
      <small>${esc(p.brand || '')}</small>
      <strong>${money(fx(p.rate, 'PKR', c), c)}</strong>
      <small>${available(p) > 0 ? available(p) + ' available' : 'Out of stock'}</small>
      <button class="primary" data-product="${esc(p.code)}"
        ${available(p) <= 0 ? 'disabled' : ''}>Add to cart</button>
    </article>
  `).join('');

  document.querySelectorAll('[data-product]').forEach(b =>
    b.onclick = () => addProduct(b.dataset.product)
  );

  document.querySelectorAll('[data-deal]').forEach(b =>
    b.onclick = () => addDeal(+b.dataset.deal)
  );

  $('supportContacts').innerHTML = [
    ...(db.supportPhones || []).filter(Boolean).map(n =>
      `<a href="https://wa.me/${esc(n.replace(/\D/g, ''))}" target="_blank">WhatsApp ${esc(n)}</a>`
    ),
    ...(db.supportEmails || []).filter(Boolean).map(e =>
      `<a href="mailto:${esc(e)}">${esc(e)}</a>`
    )
  ].join(' · ');

  updateCount();
}

function qtyFor(code) {
  return cart.reduce((a, x) =>
    a + (x.items
      ? x.items.filter(i => i.code === code)
          .reduce((b, i) => b + i.qty * x.qty, 0)
      : (x.code === code ? x.qty : 0)), 0);
}

function addProduct(code) {
  const p = db.products.find(x => x.code === code);
  if (!p || qtyFor(code) + 1 > available(p))
    return alert('Not enough stock.');

  const x = cart.find(x => x.code === code);
  if (x) x.qty++;
  else cart.push({ code, name: p.name, qty: 1, rate: p.rate });

  updateCount();
}

function addDeal(i) {
  const d = db.deals[i];
  if (!d) return;

  for (const it of d.items) {
    const p = db.products.find(x => x.code === it.code);
    if (!p || qtyFor(it.code) + it.qty > available(p))
      return alert('Deal stock is not available.');
  }

  cart.push({
    name: d.name,
    items: d.items.map(x => ({ ...x })),
    qty: 1,
    rate: d.price
  });

  updateCount();
}

function expand() {
  const out = [];

  for (const x of cart) {
    if (x.items) {
      const sum = x.items.reduce((a, it) =>
        a + (db.products.find(p => p.code === it.code)?.rate || 0) * it.qty, 0);

      for (const it of x.items) {
        const p = db.products.find(p => p.code === it.code);
        out.push({
          code: it.code,
          name: p?.name || it.code,
          qty: it.qty * x.qty,
          rate: sum ? x.rate * (p?.rate || 0) / sum : x.rate / x.items.length
        });
      }
    } else {
      out.push({ ...x });
    }
  }

  return out;
}

function totals() {
  const sub = cart.reduce((a, x) => a + x.rate * x.qty, 0);
  const gst = sub * (+db.defaultGst || 0) / 100;
  const fee = Math.max(0, +db.deliveryFee || 0);
  const discount = Math.min(fee, Math.max(0, +db.deliveryDiscount || 0));

  return { sub, gst, fee, discount, total: sub + gst + fee - discount };
}

function updateCount() {
  $('cartCount').textContent = cart.reduce((a, x) => a + x.qty, 0);
}

function showCart() {
  if (!cart.length) return alert('Your cart is empty.');

  const c = $('currency').value || 'PKR';

  $('cartLines').innerHTML = cart.map((x, i) => `
    <div class="cartline">
      <span><b>${esc(x.name)}</b><br>
        <small>${money(fx(x.rate, 'PKR', c), c)} each</small>
      </span>
      <span>
        <button data-minus="${i}">−</button> ${x.qty}
        <button data-plus="${i}">+</button>
        <button data-remove="${i}">×</button>
      </span>
    </div>
  `).join('');

  const t = totals();
  $('cartTotal').textContent =
    `Subtotal ${money(fx(t.sub, 'PKR', c), c)} · GST ${money(fx(t.gst, 'PKR', c), c)} · Delivery ${money(fx(t.fee - t.discount, 'PKR', c), c)} · Total ${money(fx(t.total, 'PKR', c), c)}`;

  document.querySelectorAll('[data-minus]').forEach(b => {
    b.onclick = () => {
      const i = +b.dataset.minus;
      if (--cart[i].qty <= 0) cart.splice(i, 1);
      showCart();
      updateCount();
    };
  });

  document.querySelectorAll('[data-plus]').forEach(b => {
    b.onclick = () => {
      const x = cart[+b.dataset.plus];

      if (x.items) {
        for (const it of x.items) {
          const p = db.products.find(p => p.code === it.code);
          if (!p || qtyFor(it.code) + it.qty > available(p))
            return alert('Not enough stock for this deal.');
        }
      } else {
        const p = db.products.find(p => p.code === x.code);
        if (!p || qtyFor(x.code) + 1 > available(p))
          return alert('Not enough stock.');
      }

      x.qty++;
      showCart();
      updateCount();
    };
  });

  document.querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = () => {
      cart.splice(+b.dataset.remove, 1);
      showCart();
      updateCount();
    };
  });

  $('cartDialog').showModal();
}

function checkout() {
  if (!cart.length) return;

  const c = $('currency').value || 'PKR';
  const t = totals();

  $('checkoutSummary').textContent =
    `${cart.map(x => x.name + ' × ' + x.qty).join(' | ')} · Total ${money(fx(t.total, 'PKR', c), c)}`;

  $('eta').value = db.storeEta === 'custom'
    ? 'Delivery time confirmed by merchant'
    : `${db.storeEta || 45} minutes`;

  $('paymentDetails').textContent = '';

  const names = db.bankNames?.length
    ? db.bankNames
    : (db.bankName ? [db.bankName] : []);

  $('oBank').innerHTML =
    '<option value="">Select bank</option>' +
    names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');

  $('bankChoiceWrap').hidden = true;
  $('cartDialog').close();
  $('checkoutDialog').showModal();
}

function renderTracking() {
  const phone = $('trackPhone').value.trim().replace(/\D/g, '');
  const orders = (db.orders || [])
    .filter(o => phone && String(o.phone || '').replace(/\D/g, '') === phone)
    .slice().reverse();

  $('trackingResults').innerHTML = orders.length
    ? orders.map(o => `
      <article class="rider-card tracking-card">
        <div>
          <b>${esc(o.id)} · ${esc(o.status)}</b>
          <small>${esc(o.date || '')} · ${esc((o.items || []).map(i => i.name + ' × ' + i.qty).join(', '))}</small>
          <small>Delivery promise: ${o.etaMinutes ? o.etaMinutes + ' minutes' : 'Merchant will confirm'}</small>
          <small>Rider: <b>${esc(o.rider || 'Not assigned yet')}</b>
          ${o.riderBike ? ' · Bike ' + esc(o.riderBike) : ''}</small>
          <small>${o.riderPhone ? 'Rider phone: ' + esc(o.riderPhone) : 'Rider contact will appear after assignment'}</small>
          ${o.riderDetails ? `<small>${esc(o.riderDetails)}</small>` : ''}
        </div>
      </article>
    `).join('')
    : '<p class="hint">No orders found for this phone number.</p>';
}

function wire() {
  window.addEventListener('storage', e => {
    if (e.key === KEY && e.newValue) {
      try {
        db = JSON.parse(e.newValue);
        render();
        if ($('trackPhone').value) renderTracking();
      } catch {}
    }
  });

  window.addEventListener('focus', () => {
    try {
      db = JSON.parse(localStorage.getItem(KEY)) || db;
      render();
      if ($('trackPhone').value) renderTracking();
    } catch {}
  });

  $('trackOrder').onclick = renderTracking;
  $('trackPhone').addEventListener('keydown', e => {
    if (e.key === 'Enter') renderTracking();
  });

  $('currency').onchange = render;
  $('cartButton').onclick = showCart;
  $('closeCart').onclick = () => $('cartDialog').close();
  $('checkoutButton').onclick = checkout;
  $('cancelCheckout').onclick = () => $('checkoutDialog').close();

  $('locationButton').onclick = () => {
    if (!navigator.geolocation) return alert('Location not supported.');

    $('locationStatus').textContent = 'Requesting location…';

    navigator.geolocation.getCurrentPosition(p => {
      $('address').value =
        ($('address').value + ' GPS: ' +
        p.coords.latitude.toFixed(6) + ', ' +
        p.coords.longitude.toFixed(6)).trim();

      $('locationStatus').textContent =
        'Coordinates added. Add street / house details if needed.';
    }, () => {
      $('locationStatus').textContent =
        'Location unavailable; type address manually.';
    }, { enableHighAccuracy: true, timeout: 12000 });
  };

  $('payment').onchange = () => {
    $('bankChoiceWrap').hidden = $('payment').value !== 'Bank Transfer';

    $('paymentDetails').textContent =
      $('payment').value.includes('USD') ||
      $('payment').value.includes('Payoneer')
        ? (db.usdPaymentOption || 'USD payment') + ' · ' +
          (db.usdPaymentDetails || 'Merchant has not added instructions yet.')
        : ($('payment').value === 'Bank Transfer'
          ? 'Transfer to ' + (db.bankName || 'merchant bank account') +
            '. Select your bank above. Payment is manually verified.'
          : 'Online payment is not processed automatically in this version.');
  };

  $('checkoutForm').onsubmit = async e => {
    e.preventDefault();

    const submit = $('checkoutForm').querySelector('[type="submit"]');
    if (submit.disabled) return;

    const c = $('currency').value || 'PKR';
    const t = totals();
    const items = expand();
    const required = {};

    items.forEach(i => {
      required[i.code] = (required[i.code] || 0) + i.qty;
    });

    for (const code in required) {
      const p = db.products.find(p => p.code === code);
      if (!p || required[code] > available(p))
        return alert('Requested stock is not available.');
    }

    if ($('payment').value === 'Bank Transfer' && !$('oBank').value)
      return alert('Please choose the bank you will transfer from.');

    submit.disabled = true;
    submit.textContent = 'Submitting order...';

    try {
      const payload = {
        customer_name: $('customerName').value.trim(),
        phone: $('customerPhone').value.trim(),
        address: $('address').value.trim(),
        items: items.map(i => ({
          name: i.name,
          quantity: i.qty
        }))
      };

      const { data, error } = await cloud.functions.invoke(
        'place-order',
        { body: payload }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Order could not be placed.');
      }

      const o = {
        id: data.order_id,
        customer: payload.customer_name,
        phone: payload.phone,
        address: payload.address,
        location: payload.address,
        currency: c,
        fxRate: db.rates?.[c] || 1,
        payment: $('payment').value,
        bankSelected: $('payment').value === 'Bank Transfer'
          ? $('oBank').value : '',
        items,
        total: fx(data.total, 'PKR', c),
        subtotal: fx(t.sub, 'PKR', c),
        gst: fx(t.gst, 'PKR', c),
        gstRate: +db.defaultGst || 0,
        deliveryFee: fx(t.fee, 'PKR', c),
        deliveryDiscount: fx(t.discount, 'PKR', c),
        status: 'Placed',
        etaMinutes: db.storeEta === 'custom' ? null : +db.storeEta || 45,
        placedAt: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
        converted: false,
        returnedQty: 0,
        cashCollected: false,
        refundStatus: 'Not returned'
      };

      db.orders ??= [];
      db.orders.push(o);
      localStorage.setItem(KEY, JSON.stringify(db));

      cart = [];
      updateCount();
      $('checkoutDialog').close();
      $('trackPhone').value = o.phone;
      renderTracking();

      alert('Cloud order saved! Order ID: ' + data.order_id);

    } catch (err) {
      console.error('Cloud order error:', err);
      alert('Order was not confirmed. Please try again. ' +
        (err.message || 'Connection error'));
    } finally {
      submit.disabled = false;
      submit.textContent = 'Place order';
    }
  };

  $('sendSupport').onclick = () => {
    const msg = $('supportMessage').value.trim();
    if (!msg) return alert('Write your message.');

    db.supportMessages ??= [];
    db.supportMessages.push({
      id: 'MSG-' + Date.now(),
      customer: $('supportName').value.trim() || 'Customer',
      phone: $('supportPhone').value.trim(),
      type: $('supportType').value,
      message: msg,
      date: new Date().toISOString(),
      reply: '',
      status: 'Open'
    });

    localStorage.setItem(KEY, JSON.stringify(db));
    $('supportMessage').value = '';
    alert('Message saved in this browser. Cloud support sync is not connected yet.');
  };
}

boot();
