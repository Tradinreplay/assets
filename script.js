(() => {
  const SUPABASE_URL = 'https://pfeiiqqbktgdjldkiixa.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZWlpcXFia3RnZGpsZGtpaXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTA0OTAsImV4cCI6MjA4MTEyNjQ5MH0.CpQRpgv4Ov0yv1mEZH4zgd2vFYFEcRVG4SzFiXHRn8M';
  
  // Initialize Supabase
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  // Admin Configuration
  const ADMIN_PASSWORD = 'admin'; // Default password, change this if needed

  const els = {
    imageInput: document.getElementById('imageInput'),
    video: document.getElementById('video'),
    canvas: document.getElementById('canvas'),
    status: document.getElementById('status'),
    assetNumber: document.getElementById('assetNumber'),
    deviceName: document.getElementById('deviceName'),
    serialNumber: document.getElementById('serialNumber'),
    unit: document.getElementById('unit'),
    isManaged: document.getElementById('isManaged'),
    scanDateTime: document.getElementById('scanDateTime'),
    scrapDateTime: document.getElementById('scrapDateTime'),
    scrapBy: document.getElementById('scrapBy'),
    acquisitionYear: document.getElementById('acquisitionYear'),
    custodian: document.getElementById('custodian'),
    location: document.getElementById('location'),
    remarks: document.getElementById('remarks'),
    isScrapped: document.getElementById('isScrapped'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    modifyModeBtn: document.getElementById('modifyModeBtn'),
    editingId: document.getElementById('editingId'),
    searchInput: document.getElementById('searchInput'),
    startDateFilter: document.getElementById('startDateFilter'),
    endDateFilter: document.getElementById('endDateFilter'),
    unitFilter: document.getElementById('unitFilter'),
    isScrappedFilter: document.getElementById('isScrappedFilter'),
    isManagedFilter: document.getElementById('isManagedFilter'),
    exportBtn: document.getElementById('exportBtn'),
    importExcel: document.getElementById('importExcel'),
    importBtn: document.getElementById('importBtn'),
    installBtn: document.getElementById('installBtn'),
    recordsTableBody: document.querySelector('#recordsTable tbody'),
    recordsListContainer: document.getElementById('records-list-container'),
    homeView: document.getElementById('home-view'),
    appView: document.getElementById('app-view'),
    sectionCamera: document.getElementById('section-camera'),
    sectionForm: document.getElementById('section-form'),
    sectionRecords: document.getElementById('section-records'),
    btnAutoScan: document.getElementById('btn-auto-scan'),
    btnManualInput: document.getElementById('btn-manual-input'),
    btnRecords: document.getElementById('btn-records'),
    fixTimeBtn: document.getElementById('fixTimeBtn'),
  };

  let localRecords = [];
  let mediaStream = null;
  let isModifyMode = false;

  // --- Helper: Admin Check ---
  function checkAdmin() {
    if (isModifyMode) return true;
    const input = prompt('請輸入管理者密碼以繼續操作：');
    if (input === ADMIN_PASSWORD) {
      return true;
    }
    alert('密碼錯誤，操作已取消。');
    return false;
  }

  function toggleModifyMode() {
    if (isModifyMode) {
      isModifyMode = false;
      els.modifyModeBtn.textContent = '進入修改模式';
      els.modifyModeBtn.style.backgroundColor = ''; // Reset style
      setStatus('已退出修改模式');
    } else {
      const input = prompt('請輸入管理者密碼以進入修改模式：');
      if (input === ADMIN_PASSWORD) {
        isModifyMode = true;
        els.modifyModeBtn.textContent = '退出修改模式';
        els.modifyModeBtn.style.backgroundColor = '#d32f2f'; // Red to indicate active/danger
        setStatus('已進入修改模式');
      } else {
        alert('密碼錯誤');
      }
    }
  }

  // --- Data Mapping Helpers ---
  function toLocalRecord(dbRecord) {
    const {
      id, asset_number, device_name, serial_number, unit, is_managed,
      scan_date_time, scan_timestamp, is_scrapped, scrap_date_time, scrap_by, remarks,
      acquisition_year, custodian, location,
      ...rest
    } = dbRecord;

    return {
      id,
      assetNumber: asset_number,
      deviceName: device_name,
      serialNumber: serial_number,
      unit: unit,
      isManaged: is_managed,
      scanDateTime: scan_date_time,
      scanTimestamp: scan_timestamp,
      isScrapped: is_scrapped,
      scrapDateTime: scrap_date_time,
      scrapBy: scrap_by,
      remarks: remarks,
      acquisitionYear: acquisition_year,
      custodian: custodian,
      location: location,
      ...rest
    };
  }

  function toDbRecord(r) {
    const {
      id, assetNumber, deviceName, serialNumber, unit, isManaged,
      scanDateTime, scanTimestamp, isScrapped, scrapDateTime, scrapBy, remarks,
      acquisitionYear, custodian, location,
      ...rest
    } = r;

    return {
      id,
      asset_number: assetNumber,
      device_name: deviceName,
      serial_number: serialNumber,
      unit: unit,
      is_managed: isManaged,
      scan_date_time: scanDateTime,
      scan_timestamp: scanTimestamp,
      is_scrapped: isScrapped,
      scrap_date_time: scrapDateTime,
      scrap_by: scrapBy,
      remarks: remarks,
      acquisition_year: acquisitionYear,
      custodian: custodian,
      location: location,
      updated_at: getTaipeiNow().toISOString().replace('Z', '+08:00'),
      ...rest
    };
  }

  function setStatus(text) {
    els.status.textContent = '狀態：' + text;
  }

  function getTaipeiNow() {
    const d = new Date();
    const offset = 8; // Taipei UTC+8
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600 * 1000 * offset));
  }

  function formatDateTime(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // --- Data Access ---
  async function fetchRecords() {
    if (!supabase) {
        console.error('Supabase client not initialized');
        return;
    }
    const { data, error } = await supabase
      .from('asset_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Sync error:', error);
      setStatus('同步失敗: ' + error.message);
      return;
    }
    
    if (data) {
      localRecords = data.map(toLocalRecord);
      renderRecords(els.searchInput.value);
    }
  }

  function getRecords() {
    return localRecords;
  }

  // --- Camera Functions ---
  async function pickEnvironmentCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const envDevice = videoDevices.find(d => /back|rear|environment/i.test(d.label));
      return envDevice?.deviceId || null;
    } catch (e) {
      return null;
    }
  }

  async function startCamera() {
    stopCamera();

    // Constraints for rear camera
    // Try ideal resolution first, but allow fallback
    const constraints = {
      audio: false,
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Initial camera request failed, trying fallback constraints...', err);
      // Fallback: minimal constraints
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: false, 
          video: { facingMode: 'environment' } 
        });
      } catch (err2) {
        console.error('Camera error:', err2);
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
            alert('無法開啟相機：存取被拒絕。請檢查瀏覽器權限設定。');
        } else if (err2.name === 'NotFoundError') {
            alert('找不到相機裝置。');
        } else {
            alert('開啟相機時發生錯誤：' + err2.message);
        }
        setStatus('無法啟用相機');
        return;
      }
    }

    if (mediaStream) {
      els.video.srcObject = mediaStream;
      // iOS specific: explicit play() is often required even with autoplay
      try {
        await els.video.play();
      } catch (e) {
        console.error('Video play failed:', e);
      }
      setStatus('相機已開啟');
      startAutoScan();
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    stopAutoScan();
  }

  function drawToCanvasFromVideo() {
    const ctx = els.canvas.getContext('2d');
    const w = els.video.videoWidth || 640;
    const h = els.video.videoHeight || 480;
    els.canvas.width = w;
    els.canvas.height = h;
    ctx.drawImage(els.video, 0, 0, w, h);
  }

  function drawImageToCanvas(img) {
    const ctx = els.canvas.getContext('2d');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    els.canvas.width = w;
    els.canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
  }

  // --- Recognition Logic ---
  let autoScanTimer = null;
  let isRecognizing = false;

  async function extractDigitsFromCanvas() {
    if (isRecognizing) return null;
    isRecognizing = true;
    try {
      const dataURL = els.canvas.toDataURL('image/png');
      const result = await Tesseract.recognize(dataURL, 'eng', { tessedit_char_whitelist: '0123456789' });
      const raw = result?.data?.text || '';
      const digits = (raw.match(/[0-9]/g) || []).join('');
      return digits || '';
    } catch (e) {
      console.error('OCR error:', e);
      return '';
    } finally {
      isRecognizing = false;
    }
  }

  function tryDecodeQRFromCanvas() {
    try {
      const ctx = els.canvas.getContext('2d');
      const w = els.canvas.width;
      const h = els.canvas.height;
      if (!w || !h) return null;
      const imageData = ctx.getImageData(0, 0, w, h);
      const qr = window.jsQR ? jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' }) : null;
      return qr && qr.data ? qr : null;
    } catch (e) {
      console.error('QR decode error:', e);
      return null;
    }
  }

  async function autoScanTick() {
    if (!mediaStream) return;
    if ((els.assetNumber.value || '').trim()) { stopAutoScan(); return; }
    drawToCanvasFromVideo();

    const qr = tryDecodeQRFromCanvas();
    if (qr) {
      const text = String(qr.data || '').trim();
      const digits = (text.match(/\d+/g) || []).join('');
      if (digits) {
        els.assetNumber.value = digits;
        els.scanDateTime.value = formatDateTime(new Date());
        setStatus('QR碼辨識完成');
        stopAutoScan();
        return;
      } else {
        setStatus('QR碼已解碼：' + (text.length > 30 ? text.slice(0,30)+'…' : text));
      }
    }

    const digits = await extractDigitsFromCanvas();
    if (!digits) return;
    els.assetNumber.value = digits;
    els.scanDateTime.value = formatDateTime(new Date());
    setStatus('自動辨識完成');
    stopAutoScan();
  }

  function startAutoScan() {
    stopAutoScan();
    autoScanTimer = setInterval(autoScanTick, 1200);
  }

  function stopAutoScan() {
    if (autoScanTimer) {
      clearInterval(autoScanTimer);
      autoScanTimer = null;
    }
  }

  function onFileSelected(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        drawImageToCanvas(img);
        // Manual recognize trigger
        setStatus('辨識中...');
        const qr = tryDecodeQRFromCanvas();
        if (qr) {
             const text = String(qr.data || '').trim();
             const digits = (text.match(/\d+/g) || []).join('');
             if(digits) {
                 els.assetNumber.value = digits;
                 els.scanDateTime.value = formatDateTime(new Date());
                 setStatus('QR碼辨識完成');
                 return;
             }
        }
        const digits = await extractDigitsFromCanvas();
        if(digits) {
            els.assetNumber.value = digits;
            els.scanDateTime.value = formatDateTime(new Date());
            setStatus('辨識完成');
        } else {
            setStatus('未偵測到數字');
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // --- Form & List Logic ---

  function resetForm() {
    els.assetNumber.value = '';
    els.deviceName.value = '';
    els.serialNumber.value = '';
    els.unit.value = '';
    els.isManaged.checked = false;
    els.scanDateTime.value = '';
    if (els.scrapDateTime) els.scrapDateTime.value = '';
    if (els.scrapBy) els.scrapBy.value = '';
    if (els.acquisitionYear) els.acquisitionYear.value = '';
    if (els.custodian) els.custodian.value = '';
    if (els.location) els.location.value = '';
    if (els.remarks) els.remarks.value = '';
    els.isScrapped.checked = false;
    els.editingId.value = '';
    setStatus('表單已清除');
    startAutoScan();
  }

  function renderRecords(filterText = '') {
    const records = getRecords();
    const keyword = (filterText || '').trim().toLowerCase();
    const unitKeyword = (els.unitFilter?.value || '').trim().toLowerCase();
    const scrappedFilter = els.isScrappedFilter?.value || '';
    const managedFilter = els.isManagedFilter?.value || '';
    const startDateStr = els.startDateFilter?.value || '';
    const endDateStr = els.endDateFilter?.value || '';

    const startTs = startDateStr ? new Date(startDateStr + 'T00:00:00').getTime() : null;
    const endTs = endDateStr ? new Date(endDateStr + 'T23:59:59').getTime() : null;

    function parseScanTs(r) {
      if (typeof r.scanTimestamp === 'number') return r.scanTimestamp;
      const s = r.scanDateTime || '';
      const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (!m) return null;
      const [_, y, mo, d, h, mi, se] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se || 0)).getTime();
    }

    const filtered = records.filter(r => {
      if (keyword) {
        const hit = String(r.assetNumber || '').toLowerCase().includes(keyword) ||
                    String(r.unit || '').toLowerCase().includes(keyword) ||
                    String(r.deviceName || '').toLowerCase().includes(keyword) ||
                    String(r.serialNumber || '').toLowerCase().includes(keyword);
        if (!hit) return false;
      }
      if (unitKeyword) {
        const unitHit = String(r.unit || '').toLowerCase().includes(unitKeyword);
        if (!unitHit) return false;
      }
      if (scrappedFilter === 'true' && !r.isScrapped) return false;
      if (scrappedFilter === 'false' && !!r.isScrapped) return false;
      if (managedFilter === 'true' && !r.isManaged) return false;
      if (managedFilter === 'false' && !!r.isManaged) return false;

      if (startTs != null || endTs != null) {
        const ts = parseScanTs(r);
        if (startTs != null && (ts == null || ts < startTs)) return false;
        if (endTs != null && (ts == null || ts > endTs)) return false;
      }
      return true;
    });

    // Render Cards List
    els.recordsListContainer.innerHTML = filtered.map(r => {
      // Color Logic
      let statusClass = 'status-normal';
      if (r.isScrapped) {
        statusClass = 'status-scrapped';
      } else if (r.isManaged) {
        statusClass = 'status-managed';
      }
      
      const labelMap = {
        assetNumber: '資產編號',
        deviceName: '設備名稱',
        serialNumber: '機身編號',
        unit: '單位',
        isManaged: '列管資產',
        scanDateTime: '掃描時間',
        isScrapped: '完成報廢',
        scrapDateTime: '報廢時間',
        scrapBy: '報廢人',
        remarks: '備註',
        acquisitionYear: '取得年限',
        custodian: '保管人',
        location: '設備位置',
        created_at: '建立時間',
        updated_at: '更新時間'
      };

      const knownOrder = ['assetNumber', 'deviceName', 'serialNumber', 'unit', 'acquisitionYear', 'custodian', 'location', 'isManaged', 'scanDateTime', 'isScrapped', 'scrapDateTime', 'scrapBy', 'remarks'];
      const allKeys = Object.keys(r);
      const otherKeys = allKeys.filter(k => !knownOrder.includes(k) && k !== 'id' && k !== 'scanTimestamp' && k !== 'created_at' && k !== 'updated_at');
      const sortedKeys = [...knownOrder, ...otherKeys];

      let rowsHtml = '';
      sortedKeys.forEach(key => {
        const val = r[key];
        if (key === 'id' || key === 'scanTimestamp' || key === 'created_at' || key === 'updated_at') return;
        if (val === null || val === undefined || val === '') return;

        let displayVal = escapeHtml(String(val));
        const label = labelMap[key] || key;

        if (key === 'isManaged') {
             displayVal = val ? '<span class="tag tag-managed">是</span>' : '否';
        } else if (key === 'isScrapped') {
             displayVal = val ? '<span class="tag tag-scrapped">是</span>' : '否';
        } else if (typeof val === 'boolean') {
             displayVal = val ? '是' : '否';
        }

        rowsHtml += `
          <div class="card-row">
            <span class="card-label">${escapeHtml(label)}</span>
            <span class="card-value">${displayVal}</span>
          </div>
        `;
      });

      return `
        <div class="record-card ${statusClass}" data-id="${r.id}" onclick="this.classList.toggle('expanded')">
          <div class="card-header">
            <span class="header-title">${escapeHtml(r.assetNumber)}</span>
            <span class="header-unit">${escapeHtml(r.unit)}</span>
          </div>
          <div class="card-details">
            ${rowsHtml}
            <div class="card-actions">
              <button class="action-btn edit" data-action="edit" onclick="event.stopPropagation()">編輯</button>
              <button class="action-btn delete" data-action="delete" onclick="event.stopPropagation()">刪除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[s]);
  }

  async function handleTableClick(ev) {
    const btn = ev.target.closest('button');
    if (!btn) return;
    // Check if click came from table tr or card div
    const container = ev.target.closest('tr') || ev.target.closest('.record-card');
    const id = container?.dataset?.id;
    if (!id) return;
    const action = btn.dataset.action;
    
    if (action === 'edit') {
      const rec = getRecords().find(r => r.id === id);
      if (!rec) return;
      els.assetNumber.value = rec.assetNumber || '';
      els.deviceName.value = rec.deviceName || '';
      els.serialNumber.value = rec.serialNumber || '';
      els.unit.value = rec.unit || '';
      els.isManaged.checked = !!rec.isManaged;
      els.scanDateTime.value = rec.scanDateTime || '';
      if (els.scrapDateTime) els.scrapDateTime.value = rec.scrapDateTime || '';
      if (els.scrapBy) els.scrapBy.value = rec.scrapBy || '';
      if (els.acquisitionYear) els.acquisitionYear.value = rec.acquisitionYear || '';
      if (els.custodian) els.custodian.value = rec.custodian || '';
      if (els.location) els.location.value = rec.location || '';
      if (els.remarks) els.remarks.value = rec.remarks || '';
      els.isScrapped.checked = !!rec.isScrapped;
      els.editingId.value = rec.id;
      setStatus('已載入紀錄至表單，可編修後保存');
      navigateToApp('manual'); // Switch to manual view (Form)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'delete') {
      // Admin check
      if (!checkAdmin()) return;

      if (!confirm('確定刪除這筆紀錄？')) return;
      
      setStatus('刪除中...');
      const { error } = await supabase.from('asset_records').delete().eq('id', id);
      
      if (error) {
          console.error(error);
          alert('刪除失敗');
          setStatus('刪除失敗');
          return;
      }

      // Update local state
      localRecords = localRecords.filter(r => r.id !== id);
      renderRecords(els.searchInput.value);
      setStatus('紀錄已刪除');
    }
  }

  async function onSave(ev) {
    ev.preventDefault();

    const record = {
      id: els.editingId.value || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      assetNumber: els.assetNumber.value.trim(),
      deviceName: els.deviceName.value.trim(),
      serialNumber: els.serialNumber.value.trim(),
      unit: els.unit.value.trim(),
      isManaged: !!els.isManaged.checked,
      scanDateTime: els.scanDateTime.value || formatDateTime(new Date()),
      isScrapped: !!els.isScrapped.checked,
      scrapDateTime: (els.isScrapped.checked
        ? (els.scrapDateTime?.value?.trim() || formatDateTime(new Date()))
        : ''),
      scrapBy: (els.isScrapped.checked ? (els.scrapBy?.value?.trim() || '') : ''),
      acquisitionYear: els.acquisitionYear?.value?.trim() || '',
      custodian: els.custodian?.value?.trim() || '',
      location: els.location?.value?.trim() || '',
      remarks: els.remarks?.value?.trim() || '',
    };

    if (!record.assetNumber) {
      alert('請先辨識或輸入資產編號');
      return;
    }

    const records = getRecords();
    const hasDup = records.some(r => r.assetNumber === record.assetNumber && r.id !== record.id);
    if (hasDup) {
      alert('資產編號重複，請改為編輯既有紀錄或更改編號。');
      setStatus('偵測到重複資產編號');
      return;
    }

    // Admin check before saving (creating or updating)
    if (!checkAdmin()) return;

    // Derive timestamp
    (function deriveScanTs() {
      const s = record.scanDateTime;
      const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (m) {
        const [_, y, mo, d, h, mi, se] = m;
        record.scanTimestamp = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se || 0)).getTime();
      } else {
        record.scanTimestamp = Date.now();
      }
    })();

    setStatus('儲存中...');
    const dbRecord = toDbRecord(record);
    const { error } = await supabase.from('asset_records').upsert(dbRecord);

    if (error) {
        console.error(error);
        alert('儲存失敗: ' + error.message);
        setStatus('儲存失敗');
        return;
    }

    // Update local
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) records[idx] = { ...records[idx], ...record }; else records.push(record);
    localRecords = records;
    
    renderRecords(els.searchInput.value);
    setStatus(idx >= 0 ? '紀錄已更新' : '紀錄已保存');
    resetForm();
  }

  function exportToExcel() {
    const records = getRecords();
    const rows = records.map(r => ({
      '資產編號': r.assetNumber,
      '設備名稱': r.deviceName,
      '機身編號': r.serialNumber,
      '單位': r.unit,
      '列管資產': r.isManaged ? '是' : '否',
      '掃描日期時間': r.scanDateTime,
      '完成報廢': r.isScrapped ? '是' : '否',
      '報廢日期時間': r.scrapDateTime || '',
      '報廢人': r.scrapBy || '',
      '取得年限': r.acquisitionYear || '',
      '保管人': r.custodian || '',
      '設備位置': r.location || '',
      '備註': r.remarks || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '資產紀錄');
    XLSX.writeFile(wb, '資產辨識.xlsx');
    setStatus('已匯出Excel');
  }

  function parseBool(val) {
    const s = String(val ?? '').trim().toLowerCase();
    if (['true','1','y','yes','是'].includes(s)) return true;
    if (['false','0','n','no','否'].includes(s)) return false;
    return !!val;
  }

  function deriveTimestamp(str) {
    const m = String(str || '').match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [_, y, mo, d, h, mi, se] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se || 0)).getTime();
    }
    const d = new Date(str);
    return isNaN(d) ? Date.now() : d.getTime();
  }

  function normalizeImportedRow(row) {
    const assetNumber = String(row['資產編號'] ?? row['assetNumber'] ?? row['AssetNumber'] ?? row['Asset Number'] ?? row['asset_no'] ?? '').trim();
    const deviceName = String(row['設備名稱'] ?? row['deviceName'] ?? row['Device Name'] ?? '').trim();
    const serialNumber = String(row['機身編號'] ?? row['serialNumber'] ?? row['Serial Number'] ?? '').trim();
    const unit = String(row['單位'] ?? row['unit'] ?? row['Unit'] ?? '').trim();
    const isManaged = parseBool(row['列管資產'] ?? row['isManaged'] ?? row['Managed'] ?? row['managed']);
    const isScrapped = parseBool(row['完成報廢'] ?? row['isScrapped'] ?? row['Scrapped'] ?? row['scrapped']);
    const scanDateTimeRaw = String(row['掃描日期時間'] ?? row['scanDateTime'] ?? row['Scan Date Time'] ?? row['Scan DateTime'] ?? row['scan_time'] ?? '').trim();
    const scanDateTime = scanDateTimeRaw || formatDateTime(new Date());
    const scrapDateTimeRaw = String(row['報廢日期時間'] ?? row['scrapDateTime'] ?? row['Scrap Date Time'] ?? row['Scrap DateTime'] ?? '').trim();
    const scrapDateTime = scrapDateTimeRaw || '';
    const scrapByRaw = String(row['報廢人'] ?? row['scrapBy'] ?? row['Scrapped By'] ?? row['Disposed By'] ?? '').trim();
    const scrapBy = scrapByRaw || '';
    const acquisitionYear = String(row['取得年限'] ?? row['acquisitionYear'] ?? row['Acquisition Year'] ?? '').trim();
    const custodian = String(row['保管人'] ?? row['custodian'] ?? row['Custodian'] ?? '').trim();
    const location = String(row['設備位置'] ?? row['location'] ?? row['Location'] ?? '').trim();
    const remarks = String(row['備註'] ?? row['remarks'] ?? row['Remarks'] ?? row['comment'] ?? row['note'] ?? '').trim();
    const rec = { assetNumber, deviceName, serialNumber, unit, isManaged, isScrapped, scanDateTime, scrapDateTime, scrapBy, acquisitionYear, custodian, location, remarks };
    rec.scanTimestamp = deriveTimestamp(scanDateTime);
    return rec;
  }

  function onImport() {
    const file = els.importExcel?.files?.[0];
    if (!file) { alert('請選擇Excel檔'); return; }

    // Admin check for Import
    if (!checkAdmin()) return;

    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      let wb;
      try {
        wb = XLSX.read(data, { type: 'array' });
      } catch (err) {
        console.error(err);
        alert('讀取Excel失敗，請確認檔案格式');
        return;
      }
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const imported = rows.map(normalizeImportedRow).filter(r => !!r.assetNumber);

      let records = [...localRecords]; // Copy current
      const index = new Map(records.map(r => [String(r.assetNumber), r]));
      const toUpsert = [];
      
      let added = 0, updated = 0, skipped = 0;

      imported.forEach(rec => {
        const existing = index.get(rec.assetNumber);
        if (mode === 'merge') {
          if (existing) { skipped++; return; }
          rec.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          toUpsert.push(rec);
          records.push(rec);
          index.set(rec.assetNumber, rec);
          added++;
        } else { // update
          if (existing) {
            const keep = existing;
            const updatedRec = {
              ...keep,
              deviceName: rec.deviceName || keep.deviceName,
              serialNumber: rec.serialNumber || keep.serialNumber,
              unit: rec.unit || keep.unit,
              acquisitionYear: rec.acquisitionYear || keep.acquisitionYear,
              custodian: rec.custodian || keep.custodian,
              location: rec.location || keep.location,
              isManaged: typeof rec.isManaged === 'boolean' ? rec.isManaged : keep.isManaged,
              scanDateTime: rec.scanDateTime || keep.scanDateTime,
              scanTimestamp: typeof rec.scanTimestamp === 'number' ? rec.scanTimestamp : (keep.scanTimestamp ?? deriveTimestamp(rec.scanDateTime || keep.scanDateTime)),
              isScrapped: typeof rec.isScrapped === 'boolean' ? rec.isScrapped : keep.isScrapped,
              scrapDateTime: (typeof rec.isScrapped === 'boolean' ? (rec.isScrapped ? (rec.scrapDateTime || keep.scrapDateTime || '') : '') : (rec.scrapDateTime || keep.scrapDateTime || '')),
              scrapBy: (typeof rec.isScrapped === 'boolean'
                ? (rec.isScrapped ? ((rec.scrapBy || keep.scrapBy || '').trim()) : '')
                : ((rec.scrapBy || keep.scrapBy || '').trim())),
              updated_at: getTaipeiNow().toISOString().replace('Z', '+08:00')
            };
            toUpsert.push(updatedRec);
            records = records.map(r => r.assetNumber === updatedRec.assetNumber ? updatedRec : r);
            updated++;
          } else {
            rec.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            toUpsert.push(rec);
            records.push(rec);
            index.set(rec.assetNumber, rec);
            added++;
          }
        }
      });

      if (toUpsert.length > 0) {
          setStatus(`正在匯入 ${toUpsert.length} 筆資料至雲端...`);
          const dbRecords = toUpsert.map(toDbRecord);
          // Batch upsert might be limited by payload size, but for simple usage assume it fits or split if needed
          // Supabase upsert
          const { error } = await supabase.from('asset_records').upsert(dbRecords);
          if (error) {
              console.error(error);
              alert('匯入雲端失敗: ' + error.message);
              setStatus('匯入雲端失敗');
              return;
          }
      }

      localRecords = records;
      renderRecords(els.searchInput.value);
      setStatus(`匯入完成：新增 ${added}，更新 ${updated}，跳過 ${skipped}`);
      if (els.importExcel) els.importExcel.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  // --- View Switching ---
  function showHome() {
    stopCamera();
    els.homeView.style.display = 'flex';
    els.appView.style.display = 'none';
  }

  function showApp(mode) {
    els.homeView.style.display = 'none';
    els.appView.style.display = 'block';
    
    // Hide all sections first
    els.sectionCamera.style.display = 'none';
    els.sectionForm.style.display = 'none';
    els.sectionRecords.style.display = 'none';

    if (mode === 'auto') {
      els.sectionCamera.style.display = 'block';
      els.sectionForm.style.display = 'block';
      startCamera();
    } else if (mode === 'manual') {
      els.sectionForm.style.display = 'block';
      stopCamera();
    } else if (mode === 'records') {
      els.sectionRecords.style.display = 'block';
      stopCamera();
    }
  }

  // Handle History API for Back Button
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view === 'app') {
       // If somehow we popped into app view (e.g. forward), restore it
       // But typically we pop to home (null or view='home')
       showApp(e.state.mode);
    } else {
       // Default to home
       showHome();
    }
  });

  // Modify View Switching to use History
  function navigateToApp(mode) {
    history.pushState({ view: 'app', mode: mode }, '', '#app');
    showApp(mode);
  }

  // --- Events ---
  // View Switching Events
  els.btnAutoScan.addEventListener('click', () => navigateToApp('auto'));
  els.btnManualInput.addEventListener('click', () => navigateToApp('manual'));
  els.btnRecords.addEventListener('click', () => navigateToApp('records'));

  els.imageInput.addEventListener('change', onFileSelected);
  els.resetBtn.addEventListener('click', resetForm);
  els.modifyModeBtn.addEventListener('click', toggleModifyMode);
  els.saveBtn.addEventListener('click', onSave);
  els.searchInput.addEventListener('input', () => renderRecords(els.searchInput.value));
  if (els.startDateFilter) els.startDateFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  if (els.endDateFilter) els.endDateFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  if (els.unitFilter) els.unitFilter.addEventListener('input', () => renderRecords(els.searchInput.value));
  if (els.isScrappedFilter) els.isScrappedFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  if (els.isManagedFilter) els.isManagedFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  els.assetNumber.addEventListener('input', () => {
    const num = els.assetNumber.value.trim();
    if (!num) {
      startAutoScan();
      setStatus('就緒');
      return;
    }
    stopAutoScan();
    const isDup = getRecords().some(r => r.assetNumber === num && r.id !== els.editingId.value);
    if (isDup) setStatus('偵測到重複資產編號'); else setStatus('就緒');
  });
  document.getElementById('records-list-container').addEventListener('click', handleTableClick);
  document.getElementById('recordsTable').addEventListener('click', handleTableClick);
  els.exportBtn.addEventListener('click', exportToExcel);
  if (els.importBtn) els.importBtn.addEventListener('click', onImport);

  // --- Fix Time Tool ---
  if (els.fixTimeBtn) {
    els.fixTimeBtn.addEventListener('click', async () => {
      // Admin check
      if (!checkAdmin()) return;
      
      if (!confirm('警告：這將會把「所有」資料庫中的紀錄時間（掃描時間與報廢時間）加上 8 小時，並將 updated_at 更新為現在的台北時間。\n\n請只在確定您的舊資料是 UTC 時間（比台北慢8小時）時執行此操作。\n\n確定要繼續嗎？')) return;

      setStatus('正在讀取所有資料...');
      const { data: allRecords, error } = await supabase.from('asset_records').select('*');
      
      if (error) {
        alert('讀取失敗: ' + error.message);
        return;
      }

      if (!allRecords || allRecords.length === 0) {
        alert('沒有資料可更新');
        return;
      }

      setStatus(`準備更新 ${allRecords.length} 筆資料...`);
      let updatedCount = 0;
      const updates = [];

      for (const r of allRecords) {
        const updatesForRec = { id: r.id };
        let changed = false;

        // Helper to add 8h to a date string YYYY/MM/DD HH:mm
        const shift8h = (str) => {
           if (!str) return str;
           // Try parsing
           const m = str.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
           if (!m) return str; // Can't parse, leave it
           
           const [_, y, mo, d, h, mi, se] = m;
           // Create date object as if it were UTC (or just add 8 hours to hours)
           // If we assume the string is literally "12:00" and we want "20:00"
           const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se || 0));
           date.setHours(date.getHours() + 8);
           
           const pad = (n) => String(n).padStart(2, '0');
           return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        if (r.scan_date_time) {
          const newDt = shift8h(r.scan_date_time);
          if (newDt !== r.scan_date_time) {
             updatesForRec.scan_date_time = newDt;
             // Also update timestamp number if it exists
             // We can just let deriveTimestamp handle it on next load, or update it here.
             // But 'scan_timestamp' column might be used.
             const m = newDt.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
             if (m) {
                const [_, y, mo, d, h, mi, se] = m;
                updatesForRec.scan_timestamp = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se || 0)).getTime();
             }
             changed = true;
          }
        }

        if (r.is_scrapped && r.scrap_date_time) {
           const newScrapDt = shift8h(r.scrap_date_time);
           if (newScrapDt !== r.scrap_date_time) {
              updatesForRec.scrap_date_time = newScrapDt;
              changed = true;
           }
        }

        if (changed) {
           updatesForRec.updated_at = getTaipeiNow().toISOString().replace('Z', '+08:00');
           updates.push(updatesForRec);
        }
      }

      if (updates.length === 0) {
        setStatus('沒有資料需要變更');
        return;
      }

      setStatus(`正在寫入 ${updates.length} 筆更新...`);
      // Supabase upsert batch
      const { error: upsertError } = await supabase.from('asset_records').upsert(updates);
      
      if (upsertError) {
         console.error(upsertError);
         alert('更新失敗: ' + upsertError.message);
         setStatus('更新失敗');
      } else {
         setStatus(`成功校正 ${updates.length} 筆資料`);
         fetchRecords(); // Reload
      }
    });
  }
  
  if (document.getElementById('refreshBtn')) {
    document.getElementById('refreshBtn').addEventListener('click', async () => {
      if (confirm('確定要登出並清除所有暫存資料嗎？網頁將會重新載入。')) {
         setStatus('正在清除資料並重新載入...');

         // 1. Supabase SignOut
         if (supabase) {
           await supabase.auth.signOut();
         }
         
         // 2. Clear Storage
         localStorage.clear();
         sessionStorage.clear();

         // 3. Clear Cookies
         document.cookie.split(";").forEach((c) => {
           document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
         });

         // 4. Clear Caches
         if ('caches' in window) {
           const keys = await caches.keys();
           await Promise.all(keys.map(key => caches.delete(key)));
         }

         // 5. Unregister Service Workers
         if ('serviceWorker' in navigator) {
           const registrations = await navigator.serviceWorker.getRegistrations();
           for (const registration of registrations) {
             await registration.unregister();
           }
         }

         // 6. Reload
         window.location.reload();
      }
    });
  }

  els.isScrapped.addEventListener('change', () => {
    if (els.isScrapped.checked) {
      const now = new Date();
      const dt = formatDateTime(now);
      if (els.scrapDateTime) els.scrapDateTime.value = dt;
      setStatus('已勾選報廢，已填入日期時間');
    } else {
      if (els.scrapDateTime) els.scrapDateTime.value = '';
      if (els.scrapBy) els.scrapBy.value = '';
      setStatus('取消報廢勾選，已清除日期時間與報廢人');
    }
  });

  // PWA
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (els.installBtn) els.installBtn.style.display = 'inline-block';
  });
  if (els.installBtn) {
    els.installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setStatus(choice.outcome === 'accepted' ? '已安裝至主頁' : '使用者取消安裝');
      deferredPrompt = null;
      els.installBtn.style.display = 'none';
    });
  }

  // SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  // Start
  els.scanDateTime.value = '';
  // startCamera();
  window.addEventListener('beforeunload', stopCamera);
  
  // Initial Sync
  setStatus('連線 Supabase 中...');
  fetchRecords().then(() => {
      // ready
  });

})();
