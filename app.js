
'use strict';

/* =====================================================
   AVENUEx — ACCOUNTS MANAGEMENT
   Supabase Admin + Products + POS + Sales + Cloud Orders
===================================================== */

const KEY = 'am-professional-v1';
const SUPABASE_URL = 'https://mtwlyaauzjlzfpezfzap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MOehj93WpdBVu99gwF2Ndw_azfQMESE';
const PLACE_ORDER_URL = SUPABASE_URL + '/functions/v1/place-order';

const $ = id => document.getElementById(id);
const num = value => Number(value) || 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const DEFAULTS = {
  businessName: 'Accounts Management',
  currency: 'PKR',
  products: [],
  sales: [],
  orders: [],
  settings: {}
};

let db = null;
let cloud = null;
let currentUser = null;
let cart = [];

function money(value) {
  return 'Rs ' + num(value).toLocaleString('en-PK', {
    maximumFractionDigits: 2
  });
}

function notify(message) {
  alert(message);
}

function loadDatabase() {
  try {
    const saved = localStorage.getItem(KEY);
    db = saved ? { ...DEFAULTS, ...JSON.parse(saved) } : structuredClone(DEFAULTS);
    db.products ||= [];
    db.sales ||= [];
    db.orders ||= [];
  } catch (error) {
    console.error(error);
    db = structuredClone(DEFAULTS);
  }
}

function saveDatabase() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

async function loadSupabase() {
  if (cloud) return cloud;

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Supabase library failed to load'));
      document.head.appendChild(script);
    });
  }

  cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return cloud;
}

async function verifyAdmin(email, password) {
  try {
    await loadSupabase();

    const { data, error } = await cloud.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;
    await syncProductsToSupabase();
    await syncCloudOrders();

    notify('Admin login successful');
    return true;
  } catch (error) {
    notify('Login failed: ' + error.message);
    return false;
  }
}

async function logoutAdmin() {
  if (cloud) await cloud.auth.signOut();
  currentUser = null;
  notify('Logged out');
}

async function requireAdmin() {
  await loadSupabase();

  const { data, error } = await cloud.auth.getSession();

  if (error) throw error;

  if (!data.session) {
    throw new Error('Please login as admin first');
  }

  currentUser = data.session.user;
  return true;
}

function productSKU(product) {
  return String(product.sku || product.code || '').trim();
}

async function syncProductToSupabase(product) {
  try {
    await requireAdmin();

    const sku = productSKU(product);
    const name = String(product.name || '').trim();

    if (!sku || !name) {
      throw new Error('Product SKU and name are required');
    }

    const row = {
      sku,
      name,
      purchase_price: num(product.purchase_price ?? product.purchase ?? product.purchasePrice),
      sale_price: num(product.sale_price ?? product.rate ?? product.salePrice),
      stock_quantity: num(product.stock_quantity ?? product.stock ?? product.quantity),
      is_active: product.is_active !== false
    };

    const { error } = await cloud
      .from('products')
      .upsert(row, { onConflict: 'sku' });

    if (error) throw error;

    console.log('PRODUCT SYNC SUCCESS:', sku);
    return true;
  } catch (error) {
    console.error('PRODUCT SYNC FAILED:', error.message);
    return false;
  }
}

async function syncProductsToSupabase() {
  await requireAdmin();

  let success = 0;
  let failed = 0;

  for (const product of db.products) {
    if (await syncProductToSupabase(product)) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('PRODUCT SYNC RESULT:', { success, failed });
  return { success, failed };
}

async function loadCloudProducts() {
  await loadSupabase();

  const { data, error } = await cloud
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

async function syncCloudOrders() {
  try {
    await requireAdmin();

    const { data, error } = await cloud
      .from('orders')
      .select('*,order_items(id,product_id,product_name,sku,quantity)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    db.orders = data || [];
    saveDatabase();
    renderOrders();

    return data;
  } catch (error) {
    console.error('ORDER SYNC FAILED:', error.message);
    return [];
  }
}

async function updateCloudOrderStatus(orderId, status) {
  try {
    await requireAdmin();

    const { error } = await cloud
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;

    await syncCloudOrders();
    notify('Order status updated');
  } catch (error) {
    notify(error.message);
  }
}

function saveProduct(product) {
  const sku = productSKU(product);

  if (!sku || !String(product.name || '').trim()) {
    notify('Enter product name and SKU');
    return;
  }

  const existing = db.products.findIndex(
    item => productSKU(item) === sku
  );

  if (existing >= 0) {
    db.products[existing] = { ...db.products[existing], ...product };
  } else {
    db.products.push({
      id: uid(),
      ...product,
      sku
    });
  }

  saveDatabase();
  renderProducts();

  if (cloud) {
    syncProductToSupabase(product);
  }
}

function deleteProduct(sku) {
  db.products = db.products.filter(
    product => productSKU(product) !== String(sku)
  );

  saveDatabase();
  renderProducts();
}

function renderProducts() {
  const table = $('productsTable');
  if (!table) return;

  table.innerHTML = db.products.map(product => `
    <tr>
      <td>${escapeHTML(productSKU(product))}</td>
      <td>${escapeHTML(product.name)}</td>
      <td>${money(product.purchase_price ?? product.purchase)}</td>
      <td>${money(product.sale_price ?? product.rate)}</td>
      <td>${num(product.stock_quantity ?? product.stock ?? product.quantity)}</td>
      <td><button data-delete="${escapeHTML(productSKU(product))}">Delete</button></td>
    </tr>
  `).join('');
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function addToCart(sku, quantity = 1) {
  const product = db.products.find(item => productSKU(item) === String(sku));

  if (!product) {
    notify('Product not found');
    return;
  }

  const stock = num(product.stock_quantity ?? product.stock ?? product.quantity);

  if (stock < quantity) {
    notify('Insufficient stock');
    return;
  }

  const existing = cart.find(item => item.sku === String(sku));

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      sku: String(sku),
      name: product.name,
      price: num(product.sale_price ?? product.rate ?? product.salePrice),
      quantity
    });
  }

  renderCart();
}

function renderCart() {
  const area = $('cartRows');
  if (!area) return;

  area.innerHTML = cart.map(item => `
    <tr>
      <td>${escapeHTML(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${money(item.price)}</td>
      <td>${money(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  if ($('cartTotal')) $('cartTotal').textContent = money(total);
}

function saveSale() {
  if (!cart.length) {
    notify('Cart is empty');
    return;
  }

  for (const item of cart) {
    const product = db.products.find(p => productSKU(p) === item.sku);
    const stock = num(product?.stock_quantity ?? product?.stock ?? product?.quantity);

    if (!product || stock < item.quantity) {
      notify('Insufficient stock for ' + item.name);
      return;
    }
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  for (const item of cart) {
    const product = db.products.find(p => productSKU(p) === item.sku);
    const field = product.stock_quantity !== undefined
      ? 'stock_quantity'
      : product.stock !== undefined ? 'stock' : 'quantity';

    product[field] = num(product[field]) - item.quantity;
  }

  db.sales.push({
    id: uid(),
    date: new Date().toISOString(),
    items: structuredClone(cart),
    total
  });

  cart = [];
  saveDatabase();
  renderAll();
  notify('Sale saved: ' + money(total));
}

function renderSales() {
  const table = $('salesTable');
  if (!table) return;

  table.innerHTML = db.sales.map(sale => `
    <tr>
      <td>${escapeHTML(sale.id)}</td>
      <td>${new Date(sale.date).toLocaleString()}</td>
      <td>${money(sale.total)}</td>
    </tr>
  `).join('');
}

function renderOrders() {
  const table = $('ordersTable');
  if (!table) return;

  table.innerHTML = db.orders.map(order => `
    <tr>
      <td>${escapeHTML(order.id)}</td>
      <td>${escapeHTML(order.status || 'Pending')}</td>
      <td>${escapeHTML(order.customer_name || '')}</td>
    </tr>
  `).join('');
}

function renderDashboard() {
  if ($('totalProducts')) {
    $('totalProducts').textContent = db.products.length;
  }

  if ($('totalSales')) {
    $('totalSales').textContent = money(
      db.sales.reduce((sum, sale) => sum + num(sale.total), 0)
    );
  }

  if ($('totalOrders')) {
    $('totalOrders').textContent = db.orders.length;
  }
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderSales();
  renderOrders();
  renderCart();
}

async function submitOnlineOrder(order) {
  try {
    const response = await fetch(PLACE_ORDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      body: JSON.stringify(order)
    });

    const responseText = await response.text();
    let result = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(responseText || 'Invalid server response');
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.error || 'Order submission failed');
    }

    notify('Order submitted successfully');
    return result;
  } catch (error) {
    notify(error.message);
    return null;
  }
}

function exportBackup() {
  const blob = new Blob(
    [JSON.stringify(db, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'avenuex-backup.json';
  link.click();

  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (!imported || typeof imported !== 'object') {
        throw new Error('Invalid backup file');
      }

      db = { ...DEFAULTS, ...imported };
      db.products ||= [];
      db.sales ||= [];
      db.orders ||= [];

      saveDatabase();
      renderAll();
      notify('Backup restored');
    } catch (error) {
      notify('Import failed: ' + error.message);
    }
  };

  reader.readAsText(file);
}

function bindEvents() {
  document.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-delete]');

    if (deleteButton) {
      deleteProduct(deleteButton.dataset.delete);
    }
  });

  if ($('saveSale')) {
    $('saveSale').addEventListener('click', saveSale);
  }

  if ($('adminLogin')) {
    $('adminLogin').addEventListener('click', async () => {
      const email = $('adminEmail')?.value;
      const password = $('adminPassword')?.value;

      if (!email || !password) {
        notify('Enter email and password');
        return;
      }

      await verifyAdmin(email, password);
    });
  }

  if ($('adminLogout')) {
    $('adminLogout').addEventListener('click', logoutAdmin);
  }

  if ($('syncProducts')) {
    $('syncProducts').addEventListener('click', async () => {
      try {
        const result = await syncProductsToSupabase();
        notify(`Success: ${result.success} | Failed: ${result.failed}`);
      } catch (error) {
        notify(error.message);
      }
    });
  }

  if ($('syncOrders')) {
    $('syncOrders').addEventListener('click', syncCloudOrders);
  }

  if ($('exportBackup')) {
    $('exportBackup').addEventListener('click', exportBackup);
  }

  if ($('importBackup')) {
    $('importBackup').addEventListener('change', event => {
      if (event.target.files[0]) importBackup(event.target.files[0]);
    });
  }
}

async function init() {
  loadDatabase();
  bindEvents();
  renderAll();

  try {
    await loadSupabase();

    const { data } = await cloud.auth.getSession();

    if (data.session) {
      currentUser = data.session.user;
      await syncCloudOrders();
    }
  } catch (error) {
    console.error('SUPABASE INIT:', error.message);
  }
}

document.addEventListener('DOMContentLoaded', init);
