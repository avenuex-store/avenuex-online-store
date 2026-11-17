
const SUPABASE_URL = 'https://mtwlyaauzjlzfpezfzap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MOehj93WpdBVu99gwF2Ndw_azfQMESE';
let cloud, adminSession = null;

async function loadSupabaseSDK(){
  if(window.supabase?.createClient) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload=resolve;
    s.onerror=()=>reject(new Error('Supabase SDK load nahi hua.'));
    document.head.appendChild(s);
  });
  if(!window.supabase?.createClient) throw new Error('Supabase SDK unavailable.');
}

async function requireCloudAdmin(){
  await loadSupabaseSDK();
  cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

  const {data,error}=await cloud.auth.getSession();
  if(error) throw error;

  if(data.session){
    adminSession=data.session;
    await verifyAdminProfile();
    return;
  }

  await new Promise(resolve=>{
    const old=document.getElementById('cloudLogin');
    if(old) old.remove();

    const wrap=document.createElement('div');
    wrap.id='cloudLogin';
    wrap.style='position:fixed;inset:0;z-index:99999;background:#0d1b32;display:grid;place-items:center;padding:20px;font-family:Arial';
    wrap.innerHTML=`
      <form id="cloudLoginForm" style="background:white;padding:30px;border-radius:16px;width:min(100%,390px);box-shadow:0 15px 50px #0005">
        <h2 style="margin:0 0 8px;color:#15243b">AvenueX Admin Login</h2>
        <p style="color:#64748b">Sign in to manage your business.</p>
        <label style="display:block;margin:18px 0 6px">Email</label>
        <input id="cloudEmail" type="email" required value="hadidaniish@gmail.com" style="width:100%;padding:12px;border:1px solid #ccd5e2;border-radius:8px">
        <label style="display:block;margin:14px 0 6px">Password</label>
        <input id="cloudPassword" type="password" required style="width:100%;padding:12px;border:1px solid #ccd5e2;border-radius:8px">
        <p id="cloudLoginError" style="color:#c33;font-size:13px"></p>
        <button id="cloudLoginButton" style="width:100%;padding:13px;background:#17396b;color:white;border:0;border-radius:8px;font-weight:bold;cursor:pointer">Secure Login</button>
      </form>`;
    document.body.appendChild(wrap);

    document.getElementById('cloudLoginForm').onsubmit=async e=>{
      e.preventDefault();
      const btn=document.getElementById('cloudLoginButton');
      const err=document.getElementById('cloudLoginError');
      btn.disabled=true;
      btn.textContent='Signing in...';
      err.textContent='';

      const {data,error}=await cloud.auth.signInWithPassword({
        email:document.getElementById('cloudEmail').value.trim(),
        password:document.getElementById('cloudPassword').value
      });

      if(error){
        err.textContent=error.message;
        btn.disabled=false;
        btn.textContent='Secure Login';
        return;
      }

      adminSession=data.session;
      try{
        await verifyAdminProfile();
        wrap.remove();
        resolve();
      }catch(ex){
        await cloud.auth.signOut();
        adminSession=null;
        err.textContent=ex.message;
        btn.disabled=false;
        btn.textContent='Secure Login';
      }
    };
  });
}

async function verifyAdminProfile(){
  const {data,error}=await cloud.from('profiles')
    .select('id,role')
    .eq('id',adminSession.user.id)
    .single();

  if(error) throw new Error('Admin profile verify nahi hua: '+error.message);
  if(data.role!=='admin') throw new Error('Is account ko Admin access nahi hai.');
}

async function syncCloudOrders(){
  if(!cloud||!adminSession)return;

  const {data:orders,error}=await cloud.from('orders')
    .select('*')
    .order('id',{ascending:false});

  if(error) throw new Error('Cloud orders load nahi huay: '+error.message);
  if(!orders?.length)return;

  const ids=orders.map(o=>o.id);
  const {data:items,error:itemError}=await cloud.from('order_items')
    .select('*')
    .in('order_id',ids);

  if(itemError) throw new Error('Order items load nahi huay: '+itemError.message);

  db.orders??=[];

  for(const c of orders){
    const existing=db.orders.find(o=>o.cloudOrderId===c.id);
    const lines=(items||[]).filter(i=>i.order_id===c.id).map(i=>{
      const p=db.products.find(p=>p.name.trim().toLowerCase()===(i.product_name||'').trim().toLowerCase());
      return {
        code:p?.code||'',
        name:i.product_name||'Unknown item',
        qty:Number(i.quantity)||0,
        rate:Number(i.price)||0
      };
    });

    const cloudStatus=String(c.status||'Placed');
    const record={
      id:existing?.id||('CLOUD-'+c.id.slice(0,8)),
      cloudOrderId:c.id,
      customer:c.customer_name||'Customer',
      phone:c.phone||'',
      address:c.address||'',
      location:c.address||'',
      currency:'PKR',
      fxRate:1,
      payment:'Cash on Delivery',
      items:lines,
      total:Number(c.total)||0,
      subtotal:Number(c.total)||0,
      gst:0,
      deliveryFee:0,
      deliveryDiscount:0,
      status:cloudStatus,
      placedAt:c.created_at||new Date().toISOString(),
      date:(c.created_at||new Date().toISOString()).slice(0,10),
      converted:existing?.converted||false,
      bill:existing?.bill||'',
      returnedQty:existing?.returnedQty||0,
      cashCollected:existing?.cashCollected||false,
      refundStatus:existing?.refundStatus||'Not returned',
      ...(existing||{})
    };

    const index=db.orders.findIndex(o=>o.cloudOrderId===c.id);
    if(index>=0) db.orders[index]=record;
    else db.orders.push(record);
  }

  save();
}

async function saveCloudOrderStatus(o,status){
  if(!o.cloudOrderId)return true;
  const {error}=await cloud.from('orders')
    .update({status})
    .eq('id',o.cloudOrderId);
  if(error){
    alert('Cloud status update failed: '+error.message);
    return false;
  }
  o.status=status;
  return true;
}
