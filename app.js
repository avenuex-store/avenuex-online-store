
'use strict';

/* =====================================================
   AVENUEx — ACCOUNTS MANAGEMENT
   COMPLETE CLOUD SYNC VERSION
   Original local database + Supabase
===================================================== */

const SUPABASE_URL = 'https://mtwlyaauzjlzfpezfzap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MOehj93WpdBVu99gwF2Ndw_azfQMESE';

/* IMPORTANT: Original website database key */
const DB_KEY = 'am-professional-v1';

const $ = id => document.getElementById(id);
const n = value => Number(value) || 0;
const uid = () => crypto.randomUUID();

let supabaseClient = null;
let syncRunning = false;
let syncTimer = null;

let state = {
  products: [],
  sales: [],
  purchases: [],
  customers: [],
  suppliers: [],
  orders: [],
  settings: {}
};

/* =====================================================
   LOCAL DATABASE
===================================================== */

function readLocalDatabase() {
  const keys = [
    'am-professional-v1',
    'avenuex-business-v1'
  ];

  for (const key of keys) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');

      if (saved && typeof saved === 'object') {
        return saved;
      }
    } catch (error) {
      console.error('Database read error:', key, error);
    }
  }

  return {};
}

function loadLocal() {
  const saved = readLocalDatabase();

  state = {
    ...state,
    ...saved,
    products: Array.isArray(saved.products) ? saved.products : [],
    sales: Array.isArray(saved.sales) ? saved.sales : [],
    purchases: Array.isArray(saved.purchases) ? saved.purchases : [],
    customers: Array.isArray(saved.customers) ? saved.customers : [],
    suppliers: Array.isArray(saved.suppliers) ? saved.suppliers : [],
    orders: Array.isArray(saved.orders) ? saved.orders : [],
    settings: saved.settings || {}
  };
}

function saveLocal() {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
}

/* =====================================================
   SUPABASE CONNECTION
===================================================== */

async function connectCloud() {
  if (supabaseClient) return supabaseClient;

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src =
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

      script.onload = resolve;
      script.onerror = () =>
        reject(new Error('Supabase library could not load'));

      document.head.appendChild(script);
    });
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  return supabaseClient;
}

async function requireAdmin() {
  await connectCloud();

  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) throw error;

  if (!data.session) {
    throw new Error('Please login with your admin account first');
  }

  return data.session;
}

/* =====================================================
   LOGIN / LOGOUT
===================================================== */

async function login(email, password) {
  try {
    await connectCloud();

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: String(email).trim(),
        password
      });

    if (error) throw error;

    showMessage('Admin login successful');

    await syncAllProducts();
    await syncOrders();

    return data.user;

  } catch (error) {
    showMessage('Login failed: ' + error.message);
    console.error(error);
    return null;
  }
}

async function logout() {
  try {
    await connectCloud();

    const { error } =
      await supabaseClient.auth.signOut();

    if (error) throw error;

    showMessage('Logged out successfully');

  } catch (error) {
    showMessage(error.message);
  }
}

/* =====================================================
   MESSAGE
===================================================== */

function showMessage(message) {
  console.log('AVENUEx:', message);

  const area = $('message');

  if (area) area.textContent = message;
}

/* =====================================================
   PRODUCT FIELD MAPPING
   Reads the existing Stock Master product fields
===================================================== */

function getSKU(product) {
  return String(
    product.sku ??
    product.code ??
    product.productCode ??
    product.itemCode ??
    ''
  ).trim();
}

function getProductName(product) {
  return String(
    product.name ??
    product.productName ??
    product.itemName ??
    ''
  ).trim();
}

function getStock(product) {
  if (product.stock_quantity !== undefined) {
    return n(product.stock_quantity);
  }

  if (product.stock !== undefined) {
    return n(product.stock);
  }

  if (product.quantity !== undefined) {
    return n(product.quantity);
  }

  return n(product.opening) + n(product.stockIn);
}

function makeProductRow(product) {
  const sku = getSKU(product);
  const name = getProductName(product);

  if (!sku || !name) return null;

  return {
    sku,
    name,

    purchase_price: n(
      product.purchase_price ??
      product.purchase ??
      product.purchasePrice ??
      product.purchaseRate
    ),

    sale_price: n(
      product.sale_price ??
      product.rate ??
      product.salePrice ??
      product.sellingPrice
    ),

    stock_quantity: getStock(product),

    is_active: product.is_active !== false
  };
}

/* =====================================================
   SINGLE PRODUCT CLOUD SYNC
===================================================== */

async function syncProduct(product) {
  await requireAdmin();

  const row = makeProductRow(product);

  if (!row) {
    throw new Error('Product SKU or name is missing');
  }

  const { error } = await supabaseClient
    .from('products')
    .upsert(row, {
      onConflict: 'sku'
    });

  if (error) throw error;

  console.log('PRODUCT SYNCED:', row.sku, row.name);

  return true;
}

/* =====================================================
   ALL STOCK MASTER PRODUCTS CLOUD SYNC
===================================================== */

async function syncAllProducts() {
  if (syncRunning) return;

  syncRunning = true;

  try {
    await requireAdmin();

    loadLocal();

    const products = state.products || [];

    if (!products.length) {
      showMessage(
        'No products found in local Stock Master database'
      );
      return;
    }

    const rows = products
      .map(makeProductRow)
      .filter(Boolean);

    if (!rows.length) {
      showMessage(
        'Products found, but SKU or product names are missing'
      );
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);

      const { error } = await supabaseClient
        .from('products')
        .upsert(batch, {
          onConflict: 'sku'
        });

      if (error) {
        console.error('Cloud batch failed:', error);
        failed += batch.length;
      } else {
        success += batch.length;
      }
    }

    const message =
      `Product sync complete. Success: ${success}, Failed: ${failed}`;

    showMessage(message);

    console.log(message);

    return { success, failed };

  } catch (error) {
    showMessage('Product sync failed: ' + error.message);
    console.error(error);

    return {
      success: 0,
      failed: state.products.length
    };

  } finally {
    syncRunning = false;
  }
}

/* =====================================================
   LOAD PRODUCTS FROM CLOUD
===================================================== */

async function loadCloudProducts() {
  try {
    await requireAdmin();

    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    showMessage(
      `${(data || []).length} cloud products loaded`
    );

    return data || [];

  } catch (error) {
    showMessage('Cloud loading failed: ' + error.message);
    return [];
  }
}

/* =====================================================
   ORDERS CLOUD SYNC
===================================================== */

async function syncOrders() {
  try {
    await requireAdmin();

    const { data, error } = await supabaseClient
      .from('orders')
      .select(
        '*,order_items(id,product_id,product_name,sku,quantity)'
      )
      .order('created_at', {
        ascending: false
      });

    if (error) throw error;

    state.orders = data || [];

    saveLocal();
    render();

    showMessage(
      `${state.orders.length} cloud orders loaded`
    );

    return state.orders;

  } catch (error) {
    console.error('Order sync failed:', error);
    showMessage('Order sync failed: ' + error.message);
    return [];
  }
}

async function updateOrderStatus(id, status) {
  try {
    await requireAdmin();

    const { error } = await supabaseClient
      .from('orders')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    await syncOrders();

    showMessage('Order status updated');

  } catch (error) {
    showMessage(error.message);
  }
}

/* =====================================================
   SAVE PRODUCT
===================================================== */

async function saveProduct(product) {
  const row = makeProductRow(product);

  if (!row) {
    throw new Error('Product SKU and name are required');
  }

  const index = state.products.findIndex(
    p => getSKU(p) === row.sku
  );

  const item = {
    ...product,
    sku: row.sku,
    name: row.name
  };

  if (index >= 0) {
    state.products[index] = item;
  } else {
    state.products.push({
      id: product.id || uid(),
      ...item
    });
  }

  saveLocal();
  render();

  try {
    await syncProduct(item);
    showMessage('Product saved and synced to cloud');
  } catch (error) {
    showMessage(
      'Product saved locally. Cloud sync pending: ' +
      error.message
    );
  }

  return item;
}

/* =====================================================
   SALES LOCAL SAVE
   Cloud sales table is not assumed because its schema
   has not been confirmed.
===================================================== */

async function saveSale(sale) {
  const record = {
    ...sale,
    id: sale.id || uid(),
    total: n(sale.total),
    created_at: new Date().toISOString()
  };

  state.sales.push(record);

  saveLocal();
  render();

  showMessage('Sale saved locally');

  return true;
}

/* =====================================================
   GENERAL SYNC
===================================================== */

async function syncAll() {
  try {
    const products = await syncAllProducts();
    const orders = await syncOrders();

    return {
      products,
      orders
    };

  } catch (error) {
    showMessage('Cloud sync error: ' + error.message);
    console.error(error);
  }
}

/* =====================================================
   RENDER
===================================================== */

function render() {
  const productsTable = $('productsTable');

  if (productsTable) {
    productsTable.innerHTML = state.products.map(p => `
      <tr>
        <td>${escapeHTML(getSKU(p))}</td>
        <td>${escapeHTML(getProductName(p))}</td>
        <td>${escapeHTML(p.brand || '')}</td>
        <td>${getStock(p)}</td>
        <td>${n(p.sale_price ?? p.rate ?? p.salePrice)}</td>
      </tr>
    `).join('');
  }

  const productCount = $('productCount');

  if (productCount) {
    productCount.textContent = state.products.length;
  }

  const orderCount = $('orderCount');

  if (orderCount) {
    orderCount.textContent = state.orders.length;
  }
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

/* =====================================================
   BACKUP
===================================================== */

function exportBackup() {
  const blob = new Blob(
    [JSON.stringify(state, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'avenuex-backup.json';
  link.click();

  URL.revokeObjectURL(url);
}

/* =====================================================
   AUTOMATIC LOCAL DATABASE CHANGE DETECTION
===================================================== */

function enableAutomaticSync() {
  const originalSetItem =
    Storage.prototype.setItem;

  if (Storage.prototype.__avenuexPatched) return;

  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);

    if (
      key === DB_KEY ||
      key === 'avenuex-business-v1'
    ) {
      clearTimeout(syncTimer);

      syncTimer = setTimeout(async () => {
        try {
          const { data } =
            await supabaseClient.auth.getSession();

          if (data.session) {
            await syncAllProducts();
          }
        } catch (error) {
          console.error('Automatic sync:', error);
        }
      }, 2000);
    }
  };

  Storage.prototype.__avenuexPatched = true;
}

/* =====================================================
   INITIALIZATION
===================================================== */

async function init() {
  loadLocal();
  render();

  try {
    await connectCloud();

    enableAutomaticSync();

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    if (data.session) {
      await syncAll();
    }

    supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        if (
          session &&
          event === 'SIGNED_IN'
        ) {
          setTimeout(syncAll, 500);
        }
      }
    );

    console.log('AVENUEx Cloud System Ready');

  } catch (error) {
    console.error(
      'AVENUEx Cloud Initialization:',
      error.message
    );
  }
}

/* =====================================================
   PUBLIC APP FUNCTIONS
===================================================== */

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
  syncAll,
  exportBackup,

  get data() {
    loadLocal();
    return state;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
