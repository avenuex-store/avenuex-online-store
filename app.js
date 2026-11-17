async function syncProductToSupabase(product) {
  try {
    if (!cloud) await loadSupabase();

    const { data: { session }, error: sessionError } =
      await cloud.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session) throw new Error('Admin login required');

    const sku = String(product.code || product.sku || '').trim();
    const name = String(product.name || '').trim();

    if (!sku || !name) {
      throw new Error('Product SKU and name are required');
    }

    const row = {
      sku,
      name,
      purchase_price: Number(product.purchase || product.purchasePrice || 0),
      sale_price: Number(product.rate || product.salePrice || 0),
      stock_quantity: Number(product.stock || product.quantity || 0),
      is_active: true
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
  let success = 0;
  let failed = 0;

  for (const product of (db.products || [])) {
    const result = await syncProductToSupabase(product);
    if (result) success++;
    else failed++;
  }

  alert(`Sync complete\nSuccessful: ${success}\nFailed: ${failed}`);
}
