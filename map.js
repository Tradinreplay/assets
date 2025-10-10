// ==========================
// 🔹 Supabase 初始化
// ==========================
const SUPABASE_URL = 'https://fqoxszrfvvfzqkbuyjkt.supabase.co'; // ← 改成你的 Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxb3hzenJmdnZmenFrYnV5amt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTk1MTYsImV4cCI6MjA3MDgzNTUxNn0.MHnVGYjUxUpDv11ej2xqByV-WXA_Sub9hQuXbKtBEC4'; // ← 改成你的 anon key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================
// 🔹 地圖初始化
// ==========================
const map = L.map('map').setView([23.9739, 120.9820], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let userMarker = null;
let allMarkers = {};
const statusBox = document.getElementById('statusBox');

// ==========================
// 🔹 登入 / 登出
// ==========================
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = prompt('請輸入 Email:');

  // 🔹 從 Supabase 讀取白名單
  const { data: whitelist, error: wlError } = await supabase
    .from('allowed_emails')
    .select('email');

  if (wlError) {
    statusBox.textContent = `⚠️ 讀取白名單失敗：${wlError.message}`;
    return;
  }

  const allowedEmails = whitelist.map(row => row.email);

  // 🔹 檢查是否在白名單
  if (!allowedEmails.includes(email)) {
    statusBox.textContent = `❌ 此 Email 無登入權限`;
    return;
  }

  const password = prompt('請輸入密碼:');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    statusBox.textContent = `登入失敗：${error.message}`;
  } else {
    statusBox.textContent = `✅ 已登入：${data.user.email}`;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  statusBox.textContent = '🚪 已登出';
});

// 🔹 監控登入狀態變化
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    statusBox.textContent = `✅ 登入中：${session.user.email}`;
  } else {
    statusBox.textContent = '未登入';
  }
});

// ==========================
// 🔹 定位 + 寫入 Supabase
// ==========================
function startTracking() {
  if (!navigator.geolocation) {
    alert('你的瀏覽器不支援定位功能。');
    return;
  }

  navigator.geolocation.watchPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const speed = pos.coords.speed || 0;
    const timestamp = new Date().toISOString();

    // 顯示使用者位置
    if (userMarker) {
      userMarker.setLatLng([lat, lon]);
    } else {
      userMarker = L.marker([lat, lon]).addTo(map).bindPopup('你的位置');
    }
    map.setView([lat, lon], 15);

    // 寫入資料庫（登入狀態）
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('locations')
        .insert({
          user_id: user.id,
          latitude: lat,
          longitude: lon,
          speed: speed,
          created_at: timestamp
        });
      if (error) {
        statusBox.textContent = `⚠️ 寫入失敗：${error.message}`;
      } else {
        statusBox.textContent = `🟢 已上傳：${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    } else {
      statusBox.textContent = '⚠️ 未登入，無法寫入資料';
    }
  }, (err) => {
    console.error(err);
    statusBox.textContent = '定位失敗';
  }, { enableHighAccuracy: true });
}

startTracking();

// ==========================
// 🔹 顯示所有使用者位置
// ==========================
async function showAllUsers() {
  const { data, error } = await supabase
    .from('locations')
    .select('user_id, latitude, longitude')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach((loc) => {
    if (!allMarkers[loc.user_id]) {
      allMarkers[loc.user_id] = L.circleMarker([loc.latitude, loc.longitude], {
        color: 'blue', radius: 5
      }).addTo(map)
        .bindPopup(`使用者 ${loc.user_id.slice(0, 8)}`);
    } else {
      allMarkers[loc.user_id].setLatLng([loc.latitude, loc.longitude]);
    }
  });
}

setInterval(showAllUsers, 10000);
