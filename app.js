
/* =========================================================
   ACCOUNTS MANAGEMENT — AVENUEx
   Complete app.js replacement
   Local business data + Supabase admin login + cloud orders
   Automatic product/SKU sync
========================================================= */

'use strict';

const KEY = 'am-professional-v1';
const SUPABASE_URL = 'https://mtwlyaauzjlzfpezfzap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MOehj93WpdBVu99gwF2Ndw_azfQMESE';
const PLACE_ORDER_URL = SUPABASE_URL + '/functions/v1/place-order';

const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const money = (n, c = 'PKR') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2
    }).format(Number(n) || 0);
  } catch {
    return `${c} ${(Number(n) || 0).toFixed(2)}`;
  }
};
const num = v => Number(v) || 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const today = () => new Date().toISOString().slice(0, 10);

const DEFAULTS = {
  businessName: 'Accounts Management',
  currency: 'PKR',
  currencies: {
    PKR: 1, USD: 278, EUR: 300, GBP: 350,
    AED: 75.7, SAR: 74.1, CAD: 201, AUD: 181
  },
  threshold: 10,
  products: [],
  sales: [],
  orders: [],
  deals: [],
  riders: [],
  wastage: [],
  support: [],
  openingReceivable: 0,
  settings: {}
};

let db = null;
let cart = [];
let posLines = [];
let cloud = null;
let currentUser = null;
let editingProductId = null;
let selectedProductImage = '';
let selectedDealImage = '';

function normalizeDB(data = {}) {
  return {
    ...DEFAULTS,
    ...data,
    currencies: { ...DEFAULTS.currencies, ...(data.currencies || {}) },
    products: Array.isArray(data.products) ? data.products : [],
    sales: Array.isArray(data.sales) ? data.sales : [],
    orders: Array.isArray(data.orders) ? data.orders : [],
    deals: Array.isArray(data.deals) ? data.deals : [],
    riders: Array.isArray(data.riders) ? data.riders : [],
    wastage: Array.isArray(data.wastage) ? data.wastage : [],
    support: Array.isArray(data.support) ? data.support : [],
    settings: data.settings || {}
  };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
  renderDashboard();
}

async function loadDatabase() {
  const existing = localStorage.getItem(KEY);
  if (existing) {
    try {
      db = normalizeDB(JSON.parse(existing));
      return;
    } catch (e) {
      console.error('Local database could not be read:', e);
    }
  }

  try {
    const response = await fetch('workbook-seed-data.json');
    if (response.ok) {
      const seed = await response.json();
      db = normalizeDB(seed);
    } else {
      db = normalizeDB();
    }
  } catch {
    db = normalizeDB();
  }

  save();
}

function notify(message, type = 'info') {
  let el = $('appNotice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appNotice';
    Object.assign(el.style, {
      position: 'fixed', right: '20px', bottom: '20px',
      zIndex: '99999', padding: '13px 20px',
      borderRadius: '9px', color: '#fff',
      boxShadow: '0 5px 25px #0003', maxWidth: '360px'
    });
    document.body.appendChild(el);
  }
  el.style.background = type === 'error' ? '#b42318' : '#173b70';
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.style.display = 'none', 3500);
}

function productStock(p) {
  return num(p.opening) + num(p.stockIn) -
    db.sales.reduce((total, sale) => {
      if (sale.productId === p.id || sale.code === p.code) {
        return total + num(sale.quantity) - num(sale.returnQty);
      }
      return total;
    }, 0) -
    db.wastage.reduce((total, w) =>
      w.code === p.code ? total + num(w.quantity) : total, 0);
}

function findProduct(code) {
  return db.products.find(p =>
    String(p.code).toLowerCase() === String(code).toLowerCase() ||
    String(p.id) === String(code)
  );
}

/* ---------------- SUPABASE ---------------- */

async function loadSupabase() {
  if (window.supabase) {
    cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return cloud;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return cloud;
}

/* AUTOMATIC PRODUCT / SKU SYNC */

async function syncProductToSupabase(p) {
  if (!cloud || !currentUser) {
    notify('Product saved locally. Admin cloud login required for sync.', 'error');
    return false;
  }

  const sku = String(p.code || '').trim();
  const name = String(p.name || '').trim();

  if (!sku || !name) {
    notify('Product SKU and name are required for cloud sync.', 'error');
    return false;
  }

  const row = {
    sku,
    name,
    purchase_price: num(p.purchase),
    sale_price: num(p.rate),
    stock_quantity: productStock(p),
    is_active: true
  };

  const { error } = await cloud
    .from('products')
    .upsert(row, { onConflict: 'sku' });

  if (error) {
    console.error('Product sync error:', error);
    notify('Product saved locally; Supabase sync failed: ' + error.message, 'error');
    return false;
  }

  notify('Product saved and SKU synced to Supabase.');
  return true;
}

async function syncProductsToSupabase() {
  if (!cloud || !currentUser) {
    notify('Please login as admin before syncing products.', 'error');
    return false;
  }

  if (!db?.products?.length) {
    notify('Website product list is empty.', 'error');
    return false;
  }

  let success = 0;
  let failed = 0;

  for (const p of db.products) {
    const result = await syncProductToSupabase(p);
    if (result) success++;
    else failed++;
  }

  if (failed === 0) {
    notify(`${success} products synced successfully.`);
  } else {
    notify(`${success} synced; ${failed} failed. Check console.`, 'error');
  }

  return failed === 0;
}

function showLogin() {
  if ($('cloudLogin')) return;

  const panel = document.createElement('div');
  panel.id = 'cloudLogin';
  Object.assign(panel.style, {
    position: 'fixed', inset: '0', zIndex: '100000',
    background: '#0d1b32', display: 'grid',
    placeItems: 'center', padding: '20px'
  });

  panel.innerHTML = `
    <form id="cloudLoginForm" style="background:white;padding:30px;border-radius:14px;width:min(420px,100%);color:#15243b">
      <h2 style="margin-top:0">Accounts Management</h2>
      <p>Admin Login</p>
      <label>Email</label>
      <input id="cloudEmail" type="email" required value="hadidaniish@gmail.com"
        style="display:block;width:100%;padding:12px;margin:7px 0 16px;box-sizing:border-box">
      <label>Password</label>
      <input id="cloudPassword" type="password" required
        style="display:block;width:100%;padding:12px;margin:7px 0 16px;box-sizing:border-box">
      <button type="submit" style="width:100%;padding:13px;background:#173b70;color:white;border:0;border-radius:7px;cursor:pointer">Sign in</button>
      <p id="cloudLoginError" style="color:#b42318"></p>
    </form>`;
  document.body.appendChild(panel);

  $('cloudLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const error = $('cloudLoginError');
    error.textContent = 'Signing in...';

    try {
      const { error: authError } = await cloud.auth.signInWithPassword({
        email: $('cloudEmail').value.trim(),
        password: $('cloudPassword').value
      });
      if (authError) throw authError;

      const ok = await verifyAdmin();
      if (!ok) {
        await cloud.auth.signOut();
        throw new Error('This account does not have admin access.');
      }

      panel.remove();
      notify('Admin login successful.');

      await syncProductsToSupabase();
      await syncCloudOrders();
    } catch (err) {
      error.textContent = err.message || 'Login failed.';
    }
  });
}

async function verifyAdmin() {
  const { data: sessionData } = await cloud.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return false;

  const { data, error } = await cloud
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Profile verification:', error);
    return false;
  }

  if (!data || data.role !== 'admin') return false;
  currentUser = user;
  return true;
}

async function requireAdmin() {
  try {
    await loadSupabase();
    const { data } = await cloud.auth.getSession();

    if (!data?.session) {
      showLogin();
      return false;
    }

    if (!(await verifyAdmin())) {
      await cloud.auth.signOut();
      showLogin();
      return false;
    }

    return true;
  } catch (e) {
    console.error(e);
    notify('Cloud connection failed. Local mode is still available.', 'error');
    return false;
  }
}

async function syncCloudOrders() {
  if (!cloud || !currentUser) return;

  try {
    const { data: orders, error } = await cloud
      .from('orders')
      .select('id,customer_name,phone,address,total,status,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    for (const order of orders || []) {
      const { data: items, error: itemError } = await cloud
        .from('order_items')
        .select('id,product_name,quantity,price,total')
        .eq('order_id', order.id);

      if (itemError) throw itemError;

      const old = db.orders.find(o => String(o.cloudOrderId) === String(order.id));

      const mapped = {
        ...(old || {}),
        cloudOrderId: order.id,
        customer: order.customer_name,
        phone: order.phone,
        address: order.address,
        total: num(order.total),
        status: order.status || 'Pending',
        date: order.created_at,
        items: (items || []).map(i => ({
          name: i.product_name,
          quantity: num(i.quantity),
          price: num(i.price),
          total: num(i.total)
        })),
        source: 'Online'
      };

      if (old) Object.assign(old, mapped);
      else db.orders.push(mapped);
    }

    save();
    renderOrders();
  } catch (e) {
    console.error('Order sync:', e);
    notify('Could not sync online orders: ' + e.message, 'error');
  }
}

async function saveCloudOrderStatus(order, status) {
  if (!order.cloudOrderId || !cloud) return true;

  const { error } = await cloud
    .from('orders')
    .update({ status })
    .eq('id', order.cloudOrderId);

  if (error) {
    notify('Cloud status update failed: ' + error.message, 'error');
    return false;
  }
  return true;
}

/* ---------------- NAVIGATION ---------------- */

function navigate(page) {
  all('[data-page]').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );

  all('.page').forEach(el =>
    el.classList.toggle('active', el.id === page)
  );

  const heading = page.charAt(0).toUpperCase() + page.slice(1);
  if ($('heading')) $('heading').textContent = heading;
  if ($('crumb')) $('crumb').textContent = heading;

  if (page === 'dashboard') renderDashboard();
  if (page === 'inventory') renderInventory();
  if (page === 'sales') renderSales();
  if (page === 'online') renderOnline();
  if (page === 'reports') renderReports();
  if (page === 'settings') renderSettings();
}

/* ---------------- DASHBOARD ---------------- */

function renderDashboard() {
  if (!db) return;

  const totalSales = db.sales.reduce((s, x) => s + num(x.net), 0);
  const units = db.sales.reduce((s, x) => s + num(x.quantity), 0);
  const receivable = db.sales.reduce((s, x) => s + num(x.balance), 0);

  if ($('statSales')) $('statSales').textContent = money(totalSales, db.currency);
  if ($('statProducts')) $('statProducts').textContent = db.products.length;
  if ($('statUnits')) $('statUnits').textContent = units;
  if ($('statReceivable')) $('statReceivable').textContent = money(receivable, db.currency);

  if ($('recent')) {
    $('recent').innerHTML = db.sales.slice(-8).reverse().map(s => `
      <tr>
        <td>${esc(s.date)}</td>
        <td>${esc(s.customer || 'Walk-in')}</td>
        <td>${esc(s.name || '')}</td>
        <td>${num(s.quantity)}</td>
        <td>${money(s.net, s.currency || db.currency)}</td>
      </tr>`).join('') || '<tr><td colspan="5">No sales yet</td></tr>';
  }
}

/* ---------------- POS ---------------- */

function addPosLine() {
  posLines.push({ id: uid(), code: '', quantity: 1, discount: 0 });
  renderPosLines();
}

function renderPosLines() {
  if (!$('billRows')) return;

  $('billRows').innerHTML = posLines.map(line => {
    const p = findProduct(line.code);
    const rate = num(p?.rate);
    const qty = num(line.quantity);
    const gross = rate * qty;
    const net = Math.max(0, gross - num(line.discount));

    return `<tr data-line="${line.id}">
      <td>
        <select class="pos-code">
          <option value="">Select product</option>
          ${db.products.map(x => `<option value="${esc(x.code)}" ${String(x.code) === String(line.code) ? 'selected' : ''}>${esc(x.code)} — ${esc(x.name)}</option>`).join('')}
        </select>
      </td>
      <td>${p ? money(rate, db.currency) : '—'}</td>
      <td><input class="pos-qty" type="number" min="1" value="${qty}"></td>
      <td><input class="pos-discount" type="number" min="0" value="${num(line.discount)}"></td>
      <td>${money(net, db.currency)}</td>
      <td><button type="button" class="remove-line">×</button></td>
    </tr>`;
  }).join('');

  all('.pos-code').forEach(el => el.addEventListener('change', e => {
    const line = posLines.find(x => x.id === e.target.closest('tr').dataset.line);
    line.code = e.target.value;
    renderPosLines();
  }));

  all('.pos-qty,.pos-discount').forEach(el => el.addEventListener('input', e => {
    const tr = e.target.closest('tr');
    const line = posLines.find(x => x.id === tr.dataset.line);
    if (el.classList.contains('pos-qty')) line.quantity = num(el.value);
    else line.discount = num(el.value);
    updatePosTotals();
  }));

  all('.remove-line').forEach(el => el.addEventListener('click', e => {
    const id = e.target.closest('tr').dataset.line;
    posLines = posLines.filter(x => x.id !== id);
    renderPosLines();
    updatePosTotals();
  }));

  updatePosTotals();
}

function getPosTotals() {
  let gross = 0, discount = 0;
  posLines.forEach(line => {
    const p = findProduct(line.code);
    gross += num(p?.rate) * num(line.quantity);
    discount += num(line.discount);
  });

  const special = num($('posSpecialDiscount')?.value);
  const gstRate = num($('posGst')?.value);
  const taxable = Math.max(0, gross - discount - special);
  const gst = taxable * gstRate / 100;
  const delivery = num($('posDeliveryFee')?.value);
  const total = taxable + gst + delivery;
  const received = num($('received')?.value);

  return { gross, discount: discount + special, gst, delivery, total, received, balance: total - received };
}

function updatePosTotals() {
  const t = getPosTotals();
  const values = {
    gross: t.gross,
    discount: t.discount,
    gstTotal: t.gst,
    billTotal: t.total,
    balance: t.balance
  };

  Object.entries(values).forEach(([id, value]) => {
    if ($(id)) $(id).textContent = money(value, db.currency);
  });
}

function clearBill() {
  posLines = [];
  ['customer', 'customerPhone', 'received', 'posSpecialDiscount', 'posDeliveryFee']
    .forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('posGst')) $('posGst').value = db.settings.defaultGst || 0;
  addPosLine();
}

function saveSale(printAfter = false) {
  const valid = posLines.filter(x => x.code && num(x.quantity) > 0);
  if (!valid.length) return notify('Please add a product first.', 'error');

  for (const line of valid) {
    const p = findProduct(line.code);
    if (!p) return notify('A selected product was not found.', 'error');
    if (num(line.quantity) > productStock(p)) {
      return notify(`Insufficient stock: ${p.name}. Available: ${productStock(p)}`, 'error');
    }
  }

  const t = getPosTotals();
  const customer = $('customer')?.value.trim() || 'Walk-in';
  const billNo = 'BILL-' + Date.now();

  valid.forEach(line => {
    const p = findProduct(line.code);
    const gross = num(p.rate) * num(line.quantity);
    const net = Math.max(0, gross - num(line.discount));
    db.sales.push({
      id: uid(),
      billNo,
      date: $('saleDate')?.value || today(),
      customer,
      phone: $('customerPhone')?.value || '',
      productId: p.id,
      code: p.code,
      name: p.name,
      brand: p.brand || '',
      quantity: num(line.quantity),
      rate: num(p.rate),
      purchase: num(p.purchase),
      discount: num(line.discount),
      gross,
      net,
      received: t.received,
      balance: t.balance,
      payment: $('payment')?.value || 'Cash',
      channel: $('saleChannel')?.value || 'Shop',
      cashier: $('cashier')?.value || '',
      currency: db.currency,
      returnQty: 0,
      returnAmount: 0
    });
  });

  save();
  renderSales();
  renderInventory();
  notify('Sale saved successfully.');

  if (printAfter) printBill(billNo);
  clearBill();
}

function printBill(billNo) {
  const rows = db.sales.filter(s => s.billNo === billNo);
  if (!rows.length) return;

  const total = rows.reduce((s, x) => s + num(x.net), 0);
  const w = window.open('', '_blank');
  if (!w) return notify('Please allow pop-ups to print.', 'error');

  w.document.write(`
    <html><head><title>${esc(billNo)}</title>
    <style>body{font:14px Arial;padding:20px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style>
    </head><body>
    <h2>${esc(db.businessName)}</h2><p>${esc(billNo)}</p>
    <table><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
    ${rows.map(x => `<tr><td>${esc(x.name)}</td><td>${x.quantity}</td><td>${money(x.rate, db.currency)}</td><td>${money(x.net, db.currency)}</td></tr>`).join('')}
    </table><h3>Total: ${money(total, db.currency)}</h3>
    </body></html>`);
  w.document.close();
  w.print();
}

/* ---------------- INVENTORY ---------------- */

function renderInventory() {
  if (!$('stockRows')) return;

  $('stockRows').innerHTML = db.products.map(p => `
    <tr>
      <td><input type="checkbox" class="product-check" value="${esc(p.id)}"></td>
      <td>${esc(p.code)}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.brand || '')}</td>
      <td>${esc(p.unit || '')}</td>
      <td>${num(p.opening)}</td>
      <td>${num(p.stockIn)}</td>
      <td>${productStock(p)}</td>
      <td>${money(p.purchase, db.currency)}</td>
      <td>${money(p.rate, db.currency)}</td>
      <td><button data-edit-product="${esc(p.id)}">Edit</button></td>
    </tr>`).join('') || '<tr><td colspan="11">No products found</td></tr>';

  all('[data-edit-product]').forEach(btn =>
    btn.addEventListener('click', () => editProduct(btn.dataset.editProduct))
  );
}

function openProductDialog(p = null) {
  editingProductId = p?.id || null;
  selectedProductImage = p?.image || '';

  if ($('productDialogTitle')) $('productDialogTitle').textContent = p ? 'Edit Product' : 'New Product';

  const fields = {
    pCode: p?.code, pName: p?.name, pBrand: p?.brand,
    pUnit: p?.unit, pOpening: p?.opening, pStockIn: p?.stockIn,
    pPurchase: p?.purchase, pRate: p?.rate
  };

  Object.entries(fields).forEach(([id, value]) => {
    if ($(id)) $(id).value = value ?? '';
  });

  if ($('productDialog')?.showModal) $('productDialog').showModal();
  else if ($('productDialog')) $('productDialog').setAttribute('open', '');
}

function editProduct(id) {
  const p = db.products.find(x => String(x.id) === String(id));
  if (p) openProductDialog(p);
}

/* SAVE PRODUCT + AUTOMATIC SUPABASE SKU SYNC */

async function saveProduct(e) {
  e.preventDefault();

  const code = $('pCode')?.value.trim();
  const name = $('pName')?.value.trim();

  if (!code || !name) {
    return notify('Product code and name are required.', 'error');
  }

  const duplicate = db.products.find(p =>
    String(p.code) === code && String(p.id) !== String(editingProductId)
  );

  if (duplicate) {
    return notify('This product code already exists.', 'error');
  }

  const oldProduct = editingProductId
    ? db.products.find(p => String(p.id) === String(editingProductId))
    : null;

  const oldCode = oldProduct?.code;

  const product = {
    id: editingProductId || uid(),
    code,
    name,
    brand: $('pBrand')?.value || '',
    unit: $('pUnit')?.value || '',
    opening: num($('pOpening')?.value),
    stockIn: num($('pStockIn')?.value),
    purchase: num($('pPurchase')?.value),
    rate: num($('pRate')?.value),
    image: selectedProductImage
  };

  if (editingProductId) {
    const index = db.products.findIndex(
      p => String(p.id) === String(editingProductId)
    );
    if (index !== -1) db.products[index] = product;
  } else {
    db.products.push(product);
  }

  save();
  renderInventory();
  $('productDialog')?.close();

  // If SKU changed, deactivate the old cloud SKU.
  if (oldCode && String(oldCode) !== String(code) && cloud && currentUser) {
    const { error } = await cloud
      .from('products')
      .update({ is_active: false })
      .eq('sku', String(oldCode));

    if (error) {
      console.error('Old SKU deactivation error:', error);
      notify('New product saved, but old SKU could not be deactivated.', 'error');
    }
  }

  await syncProductToSupabase(product);
}

function deleteSelectedProducts() {
  const ids = all('.product-check:checked').map(x => x.value);
  if (!ids.length) return notify('Select products first.', 'error');
  if (!confirm(`Delete ${ids.length} selected products?`)) return;

  const removed = db.products.filter(p => ids.includes(String(p.id)));

  db.products = db.products.filter(p => !ids.includes(String(p.id)));
  save();
  renderInventory();

  // Deactivate deleted products in Supabase.
  if (cloud && currentUser) {
    removed.forEach(async p => {
      const { error } = await cloud
        .from('products')
        .update({ is_active: false })
        .eq('sku', String(p.code));

      if (error) console.error('Cloud product deactivation:', error);
    });
  }
}

function importProductsCSV(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(',').map(x => x.trim().toLowerCase());

    lines.forEach(line => {
      const cells = line.split(',');
      const row = {};
      headers.forEach((h, i) => row[h] = (cells[i] || '').trim());

      const code = row.code || row.sku;
      if (!code) return;

      const p = {
        id: uid(), code,
        name: row.name || row.product || code,
        brand: row.brand || '',
        unit: row.unit || '',
        opening: num(row.opening),
        stockIn: num(row.stockin || row.stock_in),
        purchase: num(row.purchase || row.purchaserate),
        rate: num(row.rate || row.salerate)
      };

      const old = findProduct(code);
      if (old) Object.assign(old, p, { id: old.id });
      else db.products.push(p);
    });

    save();
    renderInventory();
    notify('CSV import completed.');

    if (cloud && currentUser) {
      await syncProductsToSupabase();
    }
  };
  reader.readAsText(file);
}

/* ---------------- SALES ---------------- */

function renderSales() {
  if (!$('salesRows')) return;

  $('salesRows').innerHTML = db.sales.slice().reverse().map(s => `
    <tr>
      <td><input type="checkbox" class="sale-check" value="${esc(s.id)}"></td>
      <td>${esc(s.date)}</td>
      <td>${esc(s.billNo || '')}</td>
      <td>${esc(s.customer || '')}</td>
      <td>${esc(s.name || '')}</td>
      <td>${num(s.quantity)}</td>
      <td>${money(s.net, s.currency || db.currency)}</td>
      <td>${esc(s.payment || '')}</td>
      <td>${money(s.balance, s.currency || db.currency)}</td>
    </tr>`).join('') || '<tr><td colspan="9">No sales recorded</td></tr>';
}

function deleteSelectedSales() {
  const ids = all('.sale-check:checked').map(x => x.value);
  if (!ids.length) return notify('Select sales first.', 'error');
  if (!confirm(`Delete ${ids.length} selected sales records?`)) return;

  db.sales = db.sales.filter(s => !ids.includes(String(s.id)));
  save();
  renderSales();
  renderInventory();
}

function exportCSV(rows, filename) {
  if (!rows.length) return notify('No data to export.', 'error');

  const headers = [...new Set(rows.flatMap(x => Object.keys(x)))];
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h =>
      `"${String(row[h] ?? '').replace(/"/g, '""')}"`
    ).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- ONLINE STORE ---------------- */

function renderOnline() {
  if ($('storeBrandName')) $('storeBrandName').textContent = db.storeDisplayName || db.businessName;

  if ($('storeCurrency')) $('storeCurrency').value = db.currency;

  if ($('storeProducts')) {
    $('storeProducts').innerHTML = db.products.map(p => `
      <div class="store-product">
        ${p.image ? `<img src="${p.image}" alt="${esc(p.name)}" style="max-width:100%;height:120px;object-fit:contain">` : ''}
        <h3>${esc(p.name)}</h3>
        <p>${money(p.rate, db.currency)}</p>
        <button data-cart-add="${esc(p.code)}">Add to Cart</button>
      </div>`).join('');
  }

  all('[data-cart-add]').forEach(btn =>
    btn.addEventListener('click', () => addToCart(btn.dataset.cartAdd))
  );

  renderCart();
  renderOrders();
  renderDeals();
}

function addToCart(code) {
  const p = findProduct(code);
  if (!p) return;

  const old = cart.find(x => x.code === code);
  if (old) old.quantity++;
  else cart.push({ code, name: p.name, price: num(p.rate), quantity: 1 });

  renderCart();
}

function renderCart() {
  if ($('cartCount')) $('cartCount').textContent = cart.reduce((s, x) => s + x.quantity, 0);

  if ($('cartRows')) {
    $('cartRows').innerHTML = cart.map((x, i) => `
      <tr><td>${esc(x.name)}</td>
      <td><input type="number" min="1" value="${x.quantity}" data-cart-qty="${i}"></td>
      <td>${money(x.price * x.quantity, db.currency)}</td>
      <td><button data-cart-remove="${i}">×</button></td></tr>`).join('');
  }

  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  if ($('cartTotal')) $('cartTotal').textContent = money(total, db.currency);

  all('[data-cart-qty]').forEach(el => el.addEventListener('change', () => {
    cart[num(el.dataset.cartQty)].quantity = Math.max(1, num(el.value));
    renderCart();
  }));

  all('[data-cart-remove]').forEach(el => el.addEventListener('click', () => {
    cart.splice(num(el.dataset.cartRemove), 1);
    renderCart();
  }));
}

async function submitOnlineOrder(e) {
  e.preventDefault();
  if (!cart.length) return notify('Your cart is empty.', 'error');

  const payload = {
    customer_name: $('oName')?.value.trim(),
    phone: $('oPhone')?.value.trim(),
    address: $('oAddress')?.value.trim(),
    items: cart.map(x => ({ name: x.name, quantity: x.quantity }))
  };

  if (!payload.customer_name || !payload.phone || !payload.address) {
    return notify('Please complete customer details.', 'error');
  }

  const button = $('placeOrder');
  if (button) button.disabled = true;

  try {
    const response = await fetch(PLACE_ORDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error || 'Order could not be placed.');

    notify('Online order submitted successfully.');
    cart = [];
    renderCart();
    $('checkoutDialog')?.close();
    $('checkoutForm')?.reset();
  } catch (err) {
    notify(err.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function renderOrders() {
  if (!$('ordersRows')) return;

  $('ordersRows').innerHTML = db.orders.slice().reverse().map(o => `
    <tr>
      <td>${esc(o.date ? new Date(o.date).toLocaleString() : '')}</td>
      <td>${esc(o.customer || '')}</td>
      <td>${esc(o.phone || '')}</td>
      <td>${esc(o.address || '')}</td>
      <td>${money(o.total, db.currency)}</td>
      <td>${esc(o.status || 'Pending')}</td>
      <td>
        <button data-order-status="${esc(o.cloudOrderId || o.id)}" data-status="Accepted">Accept</button>
        <button data-order-status="${esc(o.cloudOrderId || o.id)}" data-status="Rejected">Reject</button>
        <button data-order-status="${esc(o.cloudOrderId || o.id)}" data-status="Completed">Complete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7">No online orders</td></tr>';

  all('[data-order-status]').forEach(btn => btn.addEventListener('click', async () => {
    const order = db.orders.find(o =>
      String(o.cloudOrderId || o.id) === btn.dataset.orderStatus
    );
    if (!order) return;

    const status = btn.dataset.status;
    if (order.cloudOrderId && !(await saveCloudOrderStatus(order, status))) return;

    order.status = status;
    save();
    renderOrders();
    notify('Order status updated.');
  }));
}

function renderDeals() {
  if ($('dealAdminList')) {
    $('dealAdminList').innerHTML = db.deals.map((d, i) => `
      <div>${esc(d.name)} — ${money(d.price, db.currency)}
      <button data-delete-deal="${i}">Delete</button></div>`).join('');
  }

  all('[data-delete-deal]').forEach(btn => btn.addEventListener('click', () => {
    db.deals.splice(num(btn.dataset.deleteDeal), 1);
    save();
    renderDeals();
  }));
}

/* ---------------- REPORTS ---------------- */

function renderReports() {
  const sales = db.sales;
  const cash = sales.filter(s => s.payment === 'Cash').reduce((a, s) => a + num(s.net), 0);
  const card = sales.filter(s => s.payment === 'Card').reduce((a, s) => a + num(s.net), 0);
  const discounts = sales.reduce((a, s) => a + num(s.discount), 0);
  const returns = sales.reduce((a, s) => a + num(s.returnQty), 0);
  const refunds = sales.reduce((a, s) => a + num(s.returnAmount), 0);

  const values = {
    cashReport: cash,
    cardReport: card,
    discountReport: discounts,
    returnsReport: returns,
    refundsReport: refunds
  };

  Object.entries(values).forEach(([id, value]) => {
    if ($(id)) $(id).textContent = money(value, db.currency);
  });

  if ($('monthRows')) {
    const months = {};
    sales.forEach(s => {
      const month = String(s.date || '').slice(0, 7) || 'Unknown';
      months[month] = (months[month] || 0) + num(s.net);
    });

    $('monthRows').innerHTML = Object.entries(months).sort().reverse().map(([m, total]) =>
      `<tr><td>${esc(m)}</td><td>${money(total, db.currency)}</td></tr>`
    ).join('');
  }
}

/* ---------------- SETTINGS ---------------- */

function renderSettings() {
  const fields = {
    businessName: db.businessName,
    baseCurrency: db.currency,
    threshold: db.threshold,
    whatsapp: db.settings.whatsapp,
    bankName: db.settings.bankName,
    bankTitle: db.settings.bankTitle,
    bankNumber: db.settings.bankNumber,
    bankIban: db.settings.bankIban,
    storeEta: db.settings.storeEta,
    deliveryFee: db.settings.deliveryFee,
    deliveryDiscount: db.settings.deliveryDiscount,
    defaultGst: db.settings.defaultGst,
    storeDisplayName: db.storeDisplayName,
    receiptWidth: db.settings.receiptWidth
  };

  Object.entries(fields).forEach(([id, value]) => {
    if ($(id)) $(id).value = value ?? '';
  });

  if ($('rateInputs')) {
    $('rateInputs').innerHTML = Object.entries(db.currencies).map(([code, rate]) => `
      <label>${esc(code)}
      <input type="number" step="any" data-rate="${esc(code)}" value="${num(rate)}"></label>
    `).join('');
  }

  renderRiders();
  renderWastage();
}

function saveSettings(e) {
  e?.preventDefault();

  db.businessName = $('businessName')?.value || db.businessName;
  db.currency = $('baseCurrency')?.value || db.currency;
  db.threshold = num($('threshold')?.value);
  db.storeDisplayName = $('storeDisplayName')?.value || db.businessName;

  const settingIds = [
    'whatsapp', 'bankName', 'bankTitle', 'bankNumber', 'bankIban',
    'storeEta', 'deliveryFee', 'deliveryDiscount', 'defaultGst', 'receiptWidth'
  ];

  settingIds.forEach(id => {
    if ($(id)) db.settings[id] = $(id).value;
  });

  all('[data-rate]').forEach(el => {
    db.currencies[el.dataset.rate] = num(el.value);
  });

  save();
  notify('Settings saved.');
}

function renderRiders() {
  if (!$('riderList')) return;
  $('riderList').innerHTML = db.riders.map((r, i) => `
    <div>${esc(r.name)} — ${esc(r.phone)}
    <button data-remove-rider="${i}">Remove</button></div>`).join('');

  all('[data-remove-rider]').forEach(btn => btn.addEventListener('click', () => {
    db.riders.splice(num(btn.dataset.removeRider), 1);
    save();
    renderRiders();
  }));
}

function addRider() {
  const name = $('newRiderName')?.value.trim();
  if (!name) return notify('Enter rider name.', 'error');

  db.riders.push({
    name,
    bike: $('newRiderBike')?.value || '',
    phone: $('newRiderPhone')?.value || '',
    details: $('newRiderDetails')?.value || ''
  });

  save();
  renderRiders();
  ['newRiderName', 'newRiderBike', 'newRiderPhone', 'newRiderDetails']
    .forEach(id => { if ($(id)) $(id).value = ''; });
}

function renderWastage() {
  if (!$('wasteRows')) return;
  $('wasteRows').innerHTML = db.wastage.map(w => `
    <tr><td>${esc(w.date)}</td><td>${esc(w.code)}</td>
    <td>${num(w.quantity)}</td><td>${esc(w.reason)}</td></tr>`).join('');
}

function recordWastage() {
  const code = $('wasteCode')?.value;
  const quantity = num($('wasteQty')?.value);
  const p = findProduct(code);

  if (!p || quantity <= 0) return notify('Select a product and valid quantity.', 'error');
  if (quantity > productStock(p)) return notify('Wastage quantity exceeds available stock.', 'error');

  db.wastage.push({
    date: today(),
    code,
    quantity,
    reason: $('wasteReason')?.value || ''
  });

  save();
  renderWastage();
  renderInventory();
  notify('Wastage recorded.');
}

/* ---------------- BACKUP ---------------- */

function downloadBackup() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `accounts-management-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeDB(JSON.parse(reader.result));
      if (!confirm('Replace current local data with this backup?')) return;
      db = imported;
      save();
      renderAll();
      notify('Backup restored.');

      if (cloud && currentUser) syncProductsToSupabase();
    } catch {
      notify('Invalid backup file.', 'error');
    }
  };
  reader.readAsText(file);
}

/* ---------------- EVENT BINDINGS ---------------- */

function bind(id, event, fn) {
  if ($(id)) $(id).addEventListener(event, fn);
}

function bindEvents() {
  all('[data-page]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.page))
  );

  bind('addLine', 'click', addPosLine);
  bind('clearBill', 'click', clearBill);
  bind('saveSale', 'click', () => saveSale(false));
  bind('savePrintSale', 'click', () => saveSale(true));

  ['received', 'posGst', 'posSpecialDiscount', 'posDeliveryFee']
    .forEach(id => bind(id, 'input', updatePosTotals));

  bind('newProduct', 'click', () => openProductDialog());
  bind('productForm', 'submit', saveProduct);
  bind('deleteSelectedProducts', 'click', deleteSelectedProducts);

  bind('selectAllProducts', 'change', e =>
    all('.product-check').forEach(x => x.checked = e.target.checked)
  );

  bind('csvFile', 'change', e => {
    if (e.target.files[0]) importProductsCSV(e.target.files[0]);
  });

  bind('deleteSelectedSales', 'click', deleteSelectedSales);
  bind('selectAllSales', 'change', e =>
    all('.sale-check').forEach(x => x.checked = e.target.checked)
  );

  bind('salesCsv', 'click', () => exportCSV(db.sales, 'sales.csv'));
  bind('backup', 'click', downloadBackup);

  bind('saveSettings', 'click', saveSettings);
  bind('addRider', 'click', addRider);
  bind('recordWaste', 'click', recordWastage);

  bind('viewCart', 'click', () => $('cartDialog')?.showModal());
  bind('cartCheckout', 'click', () => {
    $('cartDialog')?.close();
    $('checkoutDialog')?.showModal();
  });
  bind('checkoutForm', 'submit', submitOnlineOrder);

  bind('saveDeal', 'click', () => {
    const name = $('dealName')?.value.trim();
    const price = num($('dealPrice')?.value);
    if (!name || price <= 0) return notify('Enter deal name and price.', 'error');

    db.deals.push({ name, price, code: $('dealCodeSelect')?.value || '' });
    save();
    renderDeals();
    notify('Deal saved.');
  });

  bind('deleteAllDeals', 'click', () => {
    if (!confirm('Delete all deals?')) return;
    db.deals = [];
    save();
    renderDeals();
  });

  bind('globalCurrency', 'change', e => {
    db.currency = e.target.value;
    save();
    renderAll();
  });

  bind('baseCurrency', 'change', e => {
    db.currency = e.target.value;
  });

  bind('resetBusinessData', 'click', () => {
    if (!confirm('This will permanently clear local business data. Continue?')) return;
    localStorage.removeItem(KEY);
    location.reload();
  });

  bind('enableAlerts', 'change', e => {
    if (e.target.checked && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if ($('alertStatus')) $('alertStatus').textContent = permission;
      });
    }
  });

  bind('setAppPassword', 'click', () => {
    const password = prompt('Set a local app password:');
    if (password) {
      localStorage.setItem('am-local-password', password);
      if ($('passwordStatus')) $('passwordStatus').textContent = 'Password set';
    }
  });

  bind('removeAppPassword', 'click', () => {
    localStorage.removeItem('am-local-password');
    if ($('passwordStatus')) $('passwordStatus').textContent = 'Password removed';
  });

  bind('pImage', 'change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      selectedProductImage = reader.result;
      if ($('pImagePreview')) $('pImagePreview').src = selectedProductImage;
    };
    reader.readAsDataURL(file);
  });

  bind('dealImage', 'change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      selectedDealImage = reader.result;
      if ($('dealImagePreview')) $('dealImagePreview').src = selectedDealImage;
    };
    reader.readAsDataURL(file);
  });

  bind('getLocation', 'click', () => {
    if (!navigator.geolocation) return notify('Location is not supported.', 'error');
    if ($('locationStatus')) $('locationStatus').textContent = 'Getting location...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const address = `${pos.coords.latitude}, ${pos.coords.longitude}`;
        if ($('oAddress')) $('oAddress').value += ` Location: ${address}`;
        if ($('locationStatus')) $('locationStatus').textContent = 'Location added';
      },
      () => {
        if ($('locationStatus')) $('locationStatus').textContent = 'Location unavailable';
      }
    );
  });
}

/* ---------------- RENDER ALL ---------------- */

function renderAll() {
  renderDashboard();
  renderPosLines();
  renderInventory();
  renderSales();
  renderOnline();
  renderReports();
  renderSettings();

  if ($('globalCurrency')) $('globalCurrency').value = db.currency;
  if ($('saleDate')) $('saleDate').value ||= today();
  if ($('posCurrency')) $('posCurrency').value = db.currency;
}

async function init() {
  await loadDatabase();
  bindEvents();
  renderAll();

  if (!posLines.length) addPosLine();

  // Supabase admin login and product/order sync
  await requireAdmin();

  // Keep online orders refreshed while the admin page is open
  if (cloud && currentUser) {
    setInterval(() => syncCloudOrders(), 60000);
  }

  console.log('Accounts Management initialized.');
}

document.addEventListener('DOMContentLoaded', init);
