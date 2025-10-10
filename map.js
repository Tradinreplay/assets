// ========== Supabase 設定 ==========
const SUPABASE_URL = 'https://fqoxszrfvvfzqkbuyjkt.supabase.co'; // ← 改成你的 Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxb3hzenJmdnZmenFrYnV5amt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTk1MTYsImV4cCI6MjA3MDgzNTUxNn0.MHnVGYjUxUpDv11ej2xqByV-WXA_Sub9hQuXbKtBEC4'; // ← 改成你的 anon key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ========== 地圖初始化 ==========
const map = L.map("map", {
  center: [23.9739, 120.9820], // 台灣中心
  zoom: 8,
});

// Google 混合圖層 (衛星 + 標籤)
const googleHybrid = L.tileLayer(
  "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  {
    attribution: "© Google",
    subdomains: ["0", "1", "2", "3"],
    maxZoom: 20,
  }
).addTo(map);

// ========== 狀態顯示 ==========
const statusBox = L.control({ position: "topright" });
statusBox.onAdd = function () {
  this._div = L.DomUtil.create("div", "status-box");
  this.update();
  return this._div;
};
statusBox.update = function (email = "未登入", writeStatus = "未寫入") {
  this._div.innerHTML = `
    <div style="background:white;padding:8px;border-radius:6px;box-shadow:0 0 6px rgba(0,0,0,0.3)">
      <b>登入狀態：</b> ${email}<br>
      <b>寫入狀態：</b> ${writeStatus}
    </div>`;
};
statusBox.addTo(map);

// ========== 全域變數 ==========
let currentUser = null;
let myMarker = null;
let allMarkers = {}; // 其他使用者標記

// ========== 監聽登入狀態 ==========
supabase.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    currentUser = session.user;
    statusBox.update(currentUser.email, "等待定位...");
  } else {
    currentUser = null;
    statusBox.update("未登入", "未寫入");
  }
});

// ========== 登入 / 登出 ==========
async function signInWithEmail() {
  const email = prompt("請輸入登入 Email：");
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) {
    alert("登入失敗：" + error.message);
  } else {
    alert("驗證信已寄出，請前往信箱點擊登入連結。");
  }
}

async function signOut() {
  await supabase.auth.signOut();
  alert("已登出");
}

// ========== 寫入位置 ==========
async function writeLocation(lat, lon) {
  if (!currentUser) {
    statusBox.update("未登入", "⚠️ 無法寫入：未登入");
    return;
  }
  try {
    const { error } = await supabase.from("locations").insert([
      {
        email: currentUser.email,
        latitude: lat,
        longitude: lon,
        timestamp: new Date().toISOString(),
      },
    ]);
    if (error) {
      statusBox.update(currentUser.email, `⚠️ 寫入失敗：${error.message}`);
    } else {
      statusBox.update(currentUser.email, "✅ 寫入成功");
    }
  } catch (err) {
    statusBox.update(currentUser.email, `⚠️ 錯誤：${err.message}`);
  }
}

// ========== 自己位置追蹤 ==========
function startTracking() {
  if (!navigator.geolocation) {
    alert("瀏覽器不支援定位功能。");
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (myMarker) {
        myMarker.setLatLng([lat, lon]);
      } else {
        myMarker = L.marker([lat, lon], {
          icon: L.icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            iconSize: [32, 32],
          }),
        }).addTo(map).bindPopup("你的位置");
      }

      map.setView([lat, lon]);
      writeLocation(lat, lon);
    },
    (err) => {
      statusBox.update("定位失敗", err.message);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

// ========== 取得所有使用者位置 ==========
async function loadAllLocations() {
  try {
    const { data, error } = await supabase
      .from("locations")
      .select("email, latitude, longitude, timestamp")
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("讀取失敗：", error.message);
      return;
    }

    // 清除舊的標記
    for (const email in allMarkers) {
      map.removeLayer(allMarkers[email]);
    }
    allMarkers = {};

    // 依使用者最新資料顯示
    const latest = {};
    for (const row of data) {
      if (!latest[row.email]) latest[row.email] = row;
    }

    for (const email in latest) {
      const loc = latest[email];
      if (!loc.latitude || !loc.longitude) continue;

      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: L.icon({
          iconUrl: email === currentUser?.email
            ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          iconSize: [32, 32],
        }),
      }).addTo(map);

      marker.bindPopup(
        `<b>${email}</b><br>${new Date(loc.timestamp).toLocaleString()}`
      );
      allMarkers[email] = marker;
    }
  } catch (err) {
    console.error("讀取所有使用者位置失敗：", err);
  }
}

// ========== 即時訂閱所有人位置變化 ==========
supabase
  .channel("realtime:locations")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "locations" },
    (payload) => {
      loadAllLocations(); // 有變化就重新載入
    }
  )
  .subscribe();

// ========== UI 按鈕 ==========
const authControl = L.control({ position: "topleft" });
authControl.onAdd = function () {
  const div = L.DomUtil.create("div", "auth-buttons");
  div.innerHTML = `
    <button id="loginBtn">登入</button>
    <button id="logoutBtn">登出</button>
    <button id="trackBtn">開始定位</button>
    <button id="refreshBtn">更新所有使用者</button>
  `;
  div.style.background = "white";
  div.style.padding = "6px";
  div.style.borderRadius = "6px";
  div.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";
  return div;
};
authControl.addTo(map);

document.addEventListener("click", (e) => {
  if (e.target.id === "loginBtn") signInWithEmail();
  if (e.target.id === "logoutBtn") signOut();
  if (e.target.id === "trackBtn") startTracking();
  if (e.target.id === "refreshBtn") loadAllLocations();
});

// ========== CSS ==========
const css = document.createElement("style");
css.innerHTML = `
  .leaflet-control-container button {
    margin: 2px;
    padding: 4px 8px;
    border: 1px solid #ccc;
    background: #f8f8f8;
    cursor: pointer;
    border-radius: 4px;
  }
  .leaflet-control-container button:hover {
    background: #e6e6e6;
  }
`;
document.head.appendChild(css);
