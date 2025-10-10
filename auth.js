// 基本設定：Supabase 專案與匿名金鑰
const SUPABASE_URL = 'https://fqoxszrfvvfzqkbuyjkt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxb3hzenJmdnZmenFrYnV5amt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTk1MTYsImV4cCI6MjA3MDgzNTUxNn0.MHnVGYjUxUpDv11ej2xqByV-WXA_Sub9hQuXbKtBEC4';

// 已取消註冊申請流程，無需 Edge Function

// 建立 Supabase 用戶端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 管理者地圖標記快取
const adminUserMarkers = new Map();

function showAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'block';
}

function hideAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

function switchTab(tab) {
  const login = document.getElementById('loginForm');
  const admin = document.getElementById('adminForm');
  if (login) login.style.display = tab === 'login' ? 'block' : 'none';
  if (admin) admin.style.display = tab === 'admin' ? 'block' : 'none';
}

// 不再需要透過 Telegram 送出申請

async function ensureProfileForCurrentUser(session) {
  const user = session?.user;
  if (!user) return { approved: false };
  // 以使用者 id 讀取/建立 profile
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, approved')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.warn('讀取 profiles 失敗', error);
  }
  if (!data) {
    const insert = await supabase.from('profiles').insert({ id: user.id, email: user.email, approved: false }).select('approved').maybeSingle();
    if (insert.error) {
      console.warn('建立 profiles 失敗', insert.error);
      return { approved: false };
    }
    return insert.data || { approved: false };
  }
  return data;
}

// 註冊流程已取消

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const resultEl = document.getElementById('loginResult');
  resultEl.textContent = '登入中...';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const session = data?.session;
    const profile = await ensureProfileForCurrentUser(session);
    // 取消核准判斷，登入後即可使用分享功能
    resultEl.textContent = '已登入，可使用分享功能。';
    document.getElementById('shareSection').style.display = 'block';
  } catch (err) {
    console.error(err);
    resultEl.textContent = '登入失敗：' + (err?.message || '未知錯誤');
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const resultEl = document.getElementById('adminResult');
  resultEl.textContent = '登入中...';
  try {
    // 嘗試登入；若失敗則建立後再登入
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // 嘗試建立管理者帳號
      const signup = await supabase.auth.signUp({ email, password });
      if (signup.error) throw signup.error;
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
      if (error) throw error;
    }
    resultEl.textContent = '管理者已登入，開始監看定位...';
    document.getElementById('adminLivePanel').style.display = 'block';
    startAdminRealtime();
  } catch (err) {
    console.error(err);
    resultEl.textContent = '登入失敗：' + (err?.message || '未知錯誤');
  }
}

function upsertAdminMarker(userId, email, lat, lng, updatedAt) {
  if (!window.L || !window.map) return;
  const key = userId || email;
  const existing = adminUserMarkers.get(key);
  const label = `${email || userId}\n${lat?.toFixed?.(6)}, ${lng?.toFixed?.(6)}\n${new Date(updatedAt).toLocaleString()}`;
  if (existing) {
    existing.setLatLng([lat, lng]);
    existing.bindPopup(label);
  } else {
    const marker = L.marker([lat, lng]).addTo(map).bindPopup(label);
    adminUserMarkers.set(key, marker);
  }
  const list = document.getElementById('adminLocationsList');
  if (list) {
    const item = document.createElement('div');
    item.textContent = `${email || userId} - (${lat}, ${lng})`;
    list.prepend(item);
    // 限制列表高度
    while (list.children.length > 50) list.removeChild(list.lastChild);
  }
}

function startAdminRealtime() {
  // 監聽 locations 表的即時更新
  const channel = supabase.channel('admin-locations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      const { user_id, lat, lng, updated_at, email } = row;
      upsertAdminMarker(user_id, email, lat, lng, updated_at);
    })
    .subscribe();
}

async function requireAdminSession() {
  const session = (await supabase.auth.getSession()).data.session;
  const email = session?.user?.email;
  if (email !== 'tzongbinn@gmail.com') {
    throw new Error('需要以管理者身份登入');
  }
  return session;
}

async function approveUser(email) {
  await requireAdminSession();
  const { data, error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('email', email)
    .select('id, approved')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function revokeUser(email) {
  await requireAdminSession();
  const { data, error } = await supabase
    .from('profiles')
    .update({ approved: false })
    .eq('email', email)
    .select('id, approved')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function shareCurrentLocation(recipientEmail) {
  const resultEl = document.getElementById('shareResult');
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('此裝置不支援定位'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    // 寫入分享記錄
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    if (!userId) throw new Error('尚未登入');
    const ins = await supabase.from('location_shares').insert({ sender_id: userId, recipient_email: recipientEmail, lat, lng });
    if (ins.error) throw ins.error;
    // 更新自己的最新位置（供管理者即時查看）
    const email = session?.user?.email;
    if (userId) {
      await supabase.from('locations').upsert({ user_id: userId, email, lat, lng, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    }
    resultEl.textContent = '已分享目前定位！';
  } catch (err) {
    console.error(err);
    resultEl.textContent = '分享定位失敗：' + (err?.message || '未知錯誤');
  }
}

async function shareRouteJson(recipientEmail, routeJsonStr) {
  const resultEl = document.getElementById('shareResult');
  try {
    let payload;
    try {
      payload = JSON.parse(routeJsonStr || '{}');
    } catch (e) {
      throw new Error('路線JSON格式錯誤');
    }
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    if (!userId) throw new Error('尚未登入');
    const ins = await supabase.from('route_shares').insert({ sender_id: userId, recipient_email: recipientEmail, route: payload });
    if (ins.error) throw ins.error;
    resultEl.textContent = '已分享路線資料！';
  } catch (err) {
    console.error(err);
    resultEl.textContent = '分享路線失敗：' + (err?.message || '未知錯誤');
  }
}

function bindAuthUI() {
  const btn = document.getElementById('authBtn');
  if (btn) btn.addEventListener('click', showAuthModal);
  const modal = document.getElementById('authModal');
  if (modal) {
    const closeEl = modal.querySelector('.close');
    if (closeEl) closeEl.addEventListener('click', hideAuthModal);
  }
  const tabAdmin = document.getElementById('tabAdmin');
  if (tabAdmin) tabAdmin.addEventListener('click', () => switchTab('admin'));
  // 管理者需登入：綁定登入事件，成功後才顯示即時監看
  const adminForm = document.getElementById('adminForm');
  if (adminForm) adminForm.addEventListener('submit', handleAdminLogin);

  const shareLocationBtn = document.getElementById('shareLocationBtn');
  const shareRouteBtn = document.getElementById('shareRouteBtn');
  if (shareLocationBtn) shareLocationBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const recipient = document.getElementById('shareRecipient').value.trim();
    if (!recipient) return;
    await shareCurrentLocation(recipient);
  });
  if (shareRouteBtn) shareRouteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const recipient = document.getElementById('shareRecipient').value.trim();
    const json = document.getElementById('shareRouteJson').value.trim();
    if (!recipient || !json) return;
    await shareRouteJson(recipient, json);
  });

  // 核准/撤銷流程已移除
}

document.addEventListener('DOMContentLoaded', () => {
  bindAuthUI();
  // 預設顯示管理者分頁（尚未登入不顯示面板）
  switchTab('admin');
});