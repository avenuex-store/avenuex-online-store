
'use strict';

/* AVENUEx — ACCOUNTS MANAGEMENT
   Supabase-connected business management
*/

const SUPABASE_URL = 'https://mtwlyaauzjlzfpezfzap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MOehj93WpdBVu99gwF2Ndw_azfQMESE';
const DB_KEY = 'avenuex-business-v1';

let supabaseClient;
let state = {
  products: [],
  sales: [],
  purchases: [],
  customers: [],
  suppliers: [],
  orders: [],
  settings: {}
};

const $ = id => document.getElementById(id);
const n = value => Number(value) || 0;
const uid = () => crypto.randomUUID();

function saveLocal() {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
}

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    state = { ...state, ...saved };
  } catch (error) {
    console.error('Local database error:', error);
  }
}

async function connectCloud() {
  if (supabaseClient) return supabaseClient;

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  return supabaseClient;
}

async function login(email, password) {
  try {
    await connectCloud();

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) throw error;

    showMessage('Admin login successful');
    await syncAll();
    return data.user;
  } catch (error) {
    showMessage(error.message);
    return null;
  }
}

async function logout() {
  await connectCloud();
  await supabaseClient.auth.signOut();
  showMessage('Logged out');
}

async function requireAdmin() {
  await connectCloud();

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Admin login required');

  return data.session;
}

function showMessage(message) {
  console.log(message);
  const area = $('message');
  if (area) area.textContent = message;
}

async function saveProduct(product) {
  const sku = String(product.sku || product.code || '').trim();
  const name = String(product.name || '').trim();

  if (!sku || !name) throw new Error('SKU and product name required');

  const item = {
    ...product,
    id: product.id || uid(),
    sku,
    name,
    purchase_price: n(product.purchase_price ?? product.purchase),
    sale_price: n(product.sale_price ?? product.rate),
    stock_quantity: n(product.stock_quantity ?? product.stock)
  };

  const index = state.products.findIndex(p => p.sku === sku);

  if (index >= 0) state.products[index] = item;
  else state.products.push(item);

  saveLocal();
  await syncProduct(item);
  render();
  return item;
}

async function syncProduct(product) {
  await requireAdmin();

  const row = {
    sku: String(product.sku || product.code),
    name: product.name,
    purchase_price: n(product.purchase_price ?? product.purchase),
    sale_price: n(product.sale_price ?? product.rate),
    stock_quantity: n(product.stock_quantity ?? product.stock),
    is_active: true
  };

  const { error } = await supabaseClient
    .from('products')
    .upsert(row, { onConflict: 'sku' });

  if (error) throw error;
}

async function syncAllProducts() {
  await requireAdmin();

  let success = 0;
  let failed = 0;

  for (const product of state.products) {
    try {
      await syncProduct(product);
      success++;
    } catch (error) {
      failed++;
      console.error(product.name, error);
    }
  }

  showMessage(`Products synced: ${success}; Failed: ${failed}`);
}

async function loadCloudProducts() {
  await connectCloud();

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  state.products = data || [];
  saveLocal();
  render();
}

async function saveSale(sale) {
  await requireAdmin();

  const total = n(sale.total);
  const record = {
    ...sale,
    id: sale.id || uid(),
    total,
    created_at: new Date().toISOString()
  };

  state.sales.push(record);
  saveLocal();

  const { error } = await supabaseClient
    .from('sales')
    .insert(record);

  if (error) {
    console.error('Cloud sale sync failed:', error);
    showMessage('Sale saved locally; cloud sync failed: ' + error.message);
    return false;
  }

  render();
  return true;
}

async function syncAll() {
  try {
    await syncAllProducts();
    await syncOrders();
  } catch (error) {
    showMessage('Sync failed: ' + error.message);
  }
}

async function syncOrders() {
  await requireAdmin();

  const { data, error } = await supabaseClient
    .from('orders')
    .select('*,order_items(id,product_id,product_name,sku,quantity)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  state.orders = data || [];
  saveLocal();
  render();
}

async function updateOrderStatus(id, status) {
  await requireAdmin();

  const { error } = await supabaseClient
    .from('orders')
    .update({ status })
    .eq('id', id);

  if (error) throw error;

  await syncOrders();
}

function render() {
  const products = $('productsTable');

  if (products) {
    products.innerHTML = state.products.map(p => `
      <tr>
        <td>${escapeHTML(p.sku || p.code)}</td>
        <td>${escapeHTML(p.name)}</td>
        <td>${escapeHTML(p.brand || '')}</td>
        <td>${n(p.stock_quantity ?? p.stock)}</td>
        <td>${n(p.sale_price ?? p.rate)}</td>
      </tr>
    `).join('');
  }

  const count = $('productCount');
  if (count) count.textContent = state.products.length;

  const orderCount = $('orderCount');
  if (orderCount) orderCount.textContent = state.orders.length;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'avenuex-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function init() {
  loadLocal();
  render();

  try {
    await connectCloud();
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
      await syncAll();
    }
  } catch (error) {
    console.error('AVENUEx initialization:', error);
  }
}

window.AvenueX = {
  login,
  logout,
  saveProduct,
  syncProduct,
  syncAllProducts,
  loadCloudProducts,
  saveSale,
  syncOrders,
  updateOrderStatus,
  exportBackup,
  get data() {
    return state;
  }
};

document.addEventListener('DOMContentLoaded', init);
