(() => {
  const els = {
    openCameraBtn: document.getElementById('openCameraBtn'),
    captureBtn: document.getElementById('captureBtn'),
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
    isScrapped: document.getElementById('isScrapped'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
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
  };

  const LS_KEY = 'asset_records_v1';
  let mediaStream = null;

  function setStatus(text) {
    els.status.textContent = '狀態：' + text;
  }

  function formatDateTime(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function getRecords() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('load records failed', e);
      return [];
    }
  }

  function setRecords(records) {
    localStorage.setItem(LS_KEY, JSON.stringify(records));
  }

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
    try {
      stopCamera();
      const envId = await pickEnvironmentCamera();
      const constraints = {
        audio: false,
        video: envId ? { deviceId: { exact: envId } } : { facingMode: { ideal: 'environment' } }
      };
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      els.video.srcObject = mediaStream;
      els.captureBtn.disabled = false;
      setStatus(envId ? '相機已開啟（後鏡頭）' : '相機已開啟');
    } catch (err) {
      console.error('Camera error:', err);
      setStatus('啟用後鏡頭失敗，嘗試使用預設鏡頭');
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        els.video.srcObject = mediaStream;
        els.captureBtn.disabled = false;
        setStatus('相機已開啟（後鏡頭）');
      } catch (err2) {
        console.error('Fallback camera error:', err2);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          els.video.srcObject = mediaStream;
          els.captureBtn.disabled = false;
          setStatus('相機已開啟（預設鏡頭）');
        } catch (err3) {
          console.error('Default camera error:', err3);
          setStatus('無法啟用相機，請檢查權限或裝置');
        }
      }
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
      els.captureBtn.disabled = true;
    }
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

  async function recognizeFromCanvas() {
    const dataURL = els.canvas.toDataURL('image/png');
    setStatus('辨識中...');
    try {
      const result = await Tesseract.recognize(dataURL, 'eng', {
        tessedit_char_whitelist: '0123456789',
      });
      const raw = result.data.text || '';
      const digitsOnly = (raw.match(/[0-9]/g) || []).join('');
      if (!digitsOnly) {
        setStatus('未偵測到數字，請調整影像再試');
        return;
      }
      els.assetNumber.value = digitsOnly;
      els.scanDateTime.value = formatDateTime(new Date());
      setStatus('辨識完成');
    } catch (e) {
      console.error(e);
      setStatus('辨識失敗，請重試');
    }
  }

  function onCapture() {
    drawToCanvasFromVideo();
    recognizeFromCanvas();
  }

  function onFileSelected(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        drawImageToCanvas(img);
        recognizeFromCanvas();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function resetForm() {
    els.assetNumber.value = '';
    els.deviceName.value = '';
    els.serialNumber.value = '';
    els.unit.value = '';
    els.isManaged.checked = false;
    els.scanDateTime.value = '';
    els.isScrapped.checked = false;
    els.editingId.value = '';
    setStatus('表單已清除');
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
      const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (!m) return null;
      const [_, y, mo, d, h, mi, se] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime();
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

    els.recordsTableBody.innerHTML = filtered.map(r => {
      return `<tr data-id="${r.id}">
        <td>${escapeHtml(r.assetNumber)}</td>
        <td>${escapeHtml(r.deviceName)}</td>
        <td>${escapeHtml(r.serialNumber)}</td>
        <td>${escapeHtml(r.unit)}</td>
        <td>${r.isManaged ? '是' : '否'}</td>
        <td>${escapeHtml(r.scanDateTime)}</td>
        <td>${r.isScrapped ? '是' : '否'}</td>
        <td>
          <button class="action-btn edit" data-action="edit">編輯</button>
          <button class="action-btn delete" data-action="delete">刪除</button>
        </td>
      </tr>`;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[s]);
  }

  function handleTableClick(ev) {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const tr = ev.target.closest('tr');
    const id = tr?.dataset?.id;
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
      els.isScrapped.checked = !!rec.isScrapped;
      els.editingId.value = rec.id;
      setStatus('已載入紀錄至表單，可編修後保存');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'delete') {
      if (!confirm('確定刪除這筆紀錄？')) return;
      const records = getRecords().filter(r => r.id !== id);
      setRecords(records);
      renderRecords(els.searchInput.value);
      setStatus('紀錄已刪除');
    }
  }

  function onSave(ev) {
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

    (function deriveScanTs() {
      const s = record.scanDateTime;
      const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (m) {
        const [_, y, mo, d, h, mi, se] = m;
        record.scanTimestamp = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime();
      } else {
        record.scanTimestamp = Date.now();
      }
    })();

    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) records[idx] = record; else records.push(record);
    setRecords(records);
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
    const m = String(str || '').match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const [_, y, mo, d, h, mi, se] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime();
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
    const rec = { assetNumber, deviceName, serialNumber, unit, isManaged, isScrapped, scanDateTime };
    rec.scanTimestamp = deriveTimestamp(scanDateTime);
    return rec;
  }

  function onImport() {
    const file = els.importExcel?.files?.[0];
    if (!file) { alert('請選擇Excel檔'); return; }
    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
    const reader = new FileReader();
    reader.onload = (e) => {
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

      let records = getRecords();
      const index = new Map(records.map(r => [String(r.assetNumber), r]));
      let added = 0, updated = 0, skipped = 0;

      imported.forEach(rec => {
        const existing = index.get(rec.assetNumber);
        if (mode === 'merge') {
          if (existing) { skipped++; return; }
          rec.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          records.push(rec);
          index.set(rec.assetNumber, rec);
          added++;
        } else { // update
          if (existing) {
            const keep = existing;
            const updatedRec = {
              id: keep.id,
              assetNumber: keep.assetNumber,
              deviceName: rec.deviceName || keep.deviceName,
              serialNumber: rec.serialNumber || keep.serialNumber,
              unit: rec.unit || keep.unit,
              isManaged: typeof rec.isManaged === 'boolean' ? rec.isManaged : keep.isManaged,
              scanDateTime: rec.scanDateTime || keep.scanDateTime,
              scanTimestamp: typeof rec.scanTimestamp === 'number' ? rec.scanTimestamp : (keep.scanTimestamp ?? deriveTimestamp(rec.scanDateTime || keep.scanDateTime)),
              isScrapped: typeof rec.isScrapped === 'boolean' ? rec.isScrapped : keep.isScrapped,
            };
            records = records.map(r => r.assetNumber === updatedRec.assetNumber ? updatedRec : r);
            updated++;
          } else {
            rec.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            records.push(rec);
            index.set(rec.assetNumber, rec);
            added++;
          }
        }
      });

      setRecords(records);
      renderRecords(els.searchInput.value);
      setStatus(`匯入完成：新增 ${added}，更新 ${updated}，跳過 ${skipped}`);
      if (els.importExcel) els.importExcel.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  // Event bindings
  els.openCameraBtn.addEventListener('click', startCamera);
  els.captureBtn.addEventListener('click', onCapture);
  els.imageInput.addEventListener('change', onFileSelected);
  els.resetBtn.addEventListener('click', resetForm);
  els.saveBtn.addEventListener('click', onSave);
  els.searchInput.addEventListener('input', () => renderRecords(els.searchInput.value));
  if (els.startDateFilter) els.startDateFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  if (els.endDateFilter) els.endDateFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  if (els.unitFilter) els.unitFilter.addEventListener('input', () => renderRecords(els.searchInput.value));
  if (els.isScrappedFilter) els.isScrappedFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  if (els.isManagedFilter) els.isManagedFilter.addEventListener('change', () => renderRecords(els.searchInput.value));
  els.assetNumber.addEventListener('input', () => {
    const num = els.assetNumber.value.trim();
    if (!num) return;
    const isDup = getRecords().some(r => r.assetNumber === num && r.id !== els.editingId.value);
    if (isDup) setStatus('偵測到重複資產編號'); else setStatus('就緒');
  });
  document.getElementById('recordsTable').addEventListener('click', handleTableClick);
  els.exportBtn.addEventListener('click', exportToExcel);
  if (els.importBtn) els.importBtn.addEventListener('click', onImport);

  // PWA install prompt
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

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  // Init
  els.scanDateTime.value = '';
  renderRecords('');
  window.addEventListener('beforeunload', stopCamera);
})();