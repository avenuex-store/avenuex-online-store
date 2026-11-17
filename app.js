async function syncProductToSupabase(p) {
  try {
    if (!cloud) throw new Error('Supabase connection missing');

    const { data: sessionData, error: sessionError } =
      await cloud.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData?.session;
    if (!session) throw new Error('Admin login session not found');

    const { data: profile, error: profileError } = await cloud
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError) throw profileError;
    if (profile?.role !== 'admin') {
      throw new Error('This account is not an admin');
    }

    const sku = String(p.code || '').trim();
    const name = String(p.name || '').trim();

    if (!sku || !name) {
      throw new Error('Product SKU or name is missing');
    }

    const row = {
      sku: sku,
      name: name,
      purchase_price: Number(p.purchase) || 0,
      sale_price: Number(p.rate) || 0,
      stock_quantity: Number(productStock(p)) || 0,
      is_active: true
    };

    const { error } = await cloud
      .from('products')
      .upsert(row, { onConflict: 'sku' });

    if (error) throw error;

    console.log('PRODUCT SYNC SUCCESS:', sku, name);
    return true;

  } catch (error) {
    console.error('PRODUCT SYNC FAILED:', error);
    notify('Product sync failed: ' + error.message, 'error');
    return false;
  }
}


async function syncProductsToSupabase() {
  try {
    if (!cloud) throw new Error('Supabase connection missing');

    if (!db?.products?.length) {
      throw new Error('Website product list is empty');
    }

    let success = 0;
    let failed = 0;

    for (const product of db.products) {
      const result = await syncProductToSupabase(product);

      if (result) success++;
      else failed++;
    }

    console.log('SYNC SUMMARY:', { success, failed });

    if (failed === 0) {
      notify(success + ' products synced successfully.');
      return true;
    }

    notify(success + ' synced, ' + failed + ' failed. Check Console.', 'error');
    return false;

  } catch (error) {
    console.error('SYNC ERROR:', error);
    notify(error.message, 'error');
    return false;
  }
}
