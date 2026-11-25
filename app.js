// Elemen DOM
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const sourceVideo = document.getElementById('sourceVideo');
const sourceImage = document.getElementById('sourceImage');

const gpsStatusBadge = document.getElementById('gpsStatusBadge');
const statusText = document.getElementById('statusText');
const processTimer = document.getElementById('processTimer');
const btnDownloadResult = document.getElementById('btnDownloadResult');

// Kontrol Input
const manualDate = document.getElementById('manualDate');
const manualTime = document.getElementById('manualTime');
const fullName = document.getElementById('fullName');
const addressText = document.getElementById('addressText');
const simulateGps = document.getElementById('simulateGps');
const fontScale = document.getElementById('fontScale');
const fontScaleVal = document.getElementById('fontScaleVal');

const logoOpacity = document.getElementById('logoOpacity');
const logoOpacityVal = document.getElementById('logoOpacityVal');

const showMap = document.getElementById('showMap');
const mapScale = document.getElementById('mapScale');
const mapScaleVal = document.getElementById('mapScaleVal');
const mapOpacity = document.getElementById('mapOpacity');
const mapOpacityVal = document.getElementById('mapOpacityVal');

// Readout GPS
const dispCoord = document.getElementById('dispCoord');
const dispSpeed = document.getElementById('dispSpeed');
const dispAlt = document.getElementById('dispAlt');

// State Aplikasi
let mediaMode = 'placeholder'; // 'placeholder' | 'camera' | 'gallery-image' | 'gallery-video'
let currentStream = null;
let facingMode = 'environment'; // 'environment' (belakang) | 'user' (depan)
let logoImage = null;
let logoPosition = 'top-right';
let mapPosition = 'bottom-left';

// Hasil Terakhir untuk Tombol "Unduh Hasil"
let lastExport = null; // { blob, filename, label }

let gpsState = {
  lat: -6.4167,
  lng: 107.4567,
  speedKmh: 0.0,
  altitude: 25.0,
  accuracy: 3.0
};

// Peta Tile Offscreen
let mapTileImg = null;
let lastTileKey = '';

// Pemrosesan Video
let mediaRecorder = null;
let recordedChunks = [];
let isProcessingVideo = false;
let processStartTime = 0;
let processInterval = null;

// Inisialisasi Awal
function init() {
  canvas.width = 720;
  canvas.height = 1280;
  syncDateTimeNow();
  updateGpsUI();
  startGpsWatcher();
  loadMapTile(gpsState.lat, gpsState.lng);
  requestAnimationFrame(renderLoop);
}

// Sinkronkan tanggal & jam sekarang ke input manual
function syncDateTimeNow() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  manualDate.value = `${yyyy}-${mm}-${dd}`;
  manualTime.value = `${hh}:${min}:${ss}`;
}

document.getElementById('btnSyncNow').addEventListener('click', syncDateTimeNow);

// Sensor GPS Real-Time
function startGpsWatcher() {
  if (!('geolocation' in navigator)) {
    gpsStatusBadge.textContent = 'GPS Tidak Didukung';
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      if (simulateGps.checked) return;
      const { latitude, longitude, speed, altitude, accuracy } = pos.coords;
      gpsState.lat = latitude;
      gpsState.lng = longitude;
      gpsState.speedKmh = speed !== null ? speed * 3.6 : 0;
      gpsState.altitude = altitude !== null ? altitude : 0;
      gpsState.accuracy = accuracy !== null ? accuracy : 3.0;

      gpsStatusBadge.textContent = 'GPS: Aktif';
      gpsStatusBadge.className = 'badge badge-ok';
      updateGpsUI();
    },
    (err) => {
      gpsStatusBadge.textContent = `GPS: ${err.message}`;
      gpsStatusBadge.className = 'badge badge-warn';
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

// Simulasi Gerak GPS (untuk tes dalam ruangan)
const fakeLatInput = document.getElementById('fakeLat');
const fakeLngInput = document.getElementById('fakeLng');
const moveFakeCoord = document.getElementById('moveFakeCoord');

// Terapkan koordinat fake manual saat tombol diklik
document.getElementById('btnApplyFakeCoord').addEventListener('click', () => {
  const parsedLat = parseFloat(fakeLatInput.value.replace(',', '.'));
  const parsedLng = parseFloat(fakeLngInput.value.replace(',', '.'));

  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
    statusText.textContent = 'Format Latitude / Longitude fake tidak valid.';
    return;
  }

  gpsState.lat = parsedLat;
  gpsState.lng = parsedLng;
  gpsState.speedKmh = 24.0;
  gpsState.altitude = 70.0;
  lastTileKey = '';
  gpsStatusBadge.textContent = 'GPS: Fake Aktif';
  gpsStatusBadge.className = 'badge badge-ok';
  updateGpsUI();
  statusText.textContent = `Koordinat fake dipasang: ${gpsState.lat.toFixed(6)}, ${gpsState.lng.toFixed(6)}`;
});

// Gerakkan koordinat fake / simulasi secara berkala
setInterval(() => {
  const isFakeMode = simulateGps.checked || gpsStatusBadge.textContent.includes('Fake');
  if (!isFakeMode || !moveFakeCoord.checked) return;

  // Geser halus mengikuti jalur/arah
  gpsState.lat -= 0.000045 + (Math.random() - 0.5) * 0.00003;
  gpsState.lng += 0.000055 + (Math.random() - 0.5) * 0.00003;
  gpsState.speedKmh = Math.max(5, Math.min(65, gpsState.speedKmh + (Math.random() - 0.48) * 6));
  gpsState.altitude = Math.max(10, gpsState.altitude + (Math.random() - 0.5) * 1.5);
  gpsState.accuracy = 2.5 + Math.random() * 2.0;

  fakeLatInput.value = gpsState.lat.toFixed(6);
  fakeLngInput.value = gpsState.lng.toFixed(6);

  gpsStatusBadge.textContent = 'GPS: Fake Bergerak';
  gpsStatusBadge.className = 'badge badge-ok';
  updateGpsUI();
}, 1200);


function updateGpsUI() {
  dispCoord.textContent = `${gpsState.lat.toFixed(6)}, ${gpsState.lng.toFixed(6)}`;
  dispSpeed.textContent = `${gpsState.speedKmh.toFixed(1)} km/h`;
  dispAlt.textContent = `${gpsState.altitude.toFixed(1)} m`;
  loadMapTile(gpsState.lat, gpsState.lng);
}

// Reverse Geocoding (Ambil Alamat Otomatis dari Koordinat)
document.getElementById('btnFetchAddress').addEventListener('click', async () => {
  statusText.textContent = 'Mengambil alamat dari koordinat...';
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${gpsState.lat}&lon=${gpsState.lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.display_name) {
      addressText.value = data.display_name;
      statusText.textContent = 'Alamat berhasil diperbarui.';
    }
  } catch (e) {
    statusText.textContent = 'Gagal memuat alamat otomatis (cek koneksi internet).';
  }
});

// Konversi Koordinat ke Tile OpenStreetMap untuk Peta Mini
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const ytile = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x: xtile, y: ytile };
}

function loadMapTile(lat, lng) {
  const zoom = 16;
  const { x, y } = latLngToTile(lat, lng, zoom);
  const key = `${zoom}/${x}/${y}`;
  if (key === lastTileKey) return;
  lastTileKey = key;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    mapTileImg = img;
  };
  img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

document.getElementById('btnRefreshMap').addEventListener('click', () => {
  lastTileKey = '';
  loadMapTile(gpsState.lat, gpsState.lng);
});

// Hentikan Stream Kamera dengan Bersih
function stopCurrentStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (_) {}
    });
    currentStream = null;
  }
  sourceVideo.pause();
  sourceVideo.srcObject = null;
}

// Buka Kamera & Bisa Bulak-Balik Depan (user) <-> Belakang (environment)
async function openCamera() {
  const prevStream = currentStream;
  const targetFacing = facingMode;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.textContent =
      'Kamera tidak tersedia di konteks ini. Pastikan dibuka lewat HTTPS atau localhost, atau gunakan "Pilih Foto/Video Galeri".';
    return;
  }

  if (prevStream) {
    prevStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (_) {}
    });
    currentStream = null;
    sourceVideo.pause();
    sourceVideo.srcObject = null;
    await new Promise((r) => setTimeout(r, 250));
  }

  const constraintCandidates = [
    {
      video: {
        facingMode: { exact: targetFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    },
    {
      video: {
        facingMode: { exact: targetFacing }
      },
      audio: false
    },
    {
      video: {
        facingMode: targetFacing
      },
      audio: false
    },
    {
      video: true,
      audio: false
    }
  ];

  let lastError = null;
  for (const constraints of constraintCandidates) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStream = stream;
      sourceVideo.srcObject = stream;
      sourceVideo.loop = false;
      sourceVideo.muted = true;

      await new Promise((resolve) => {
        if (sourceVideo.readyState >= 2) return resolve();
        sourceVideo.onloadedmetadata = () => resolve();
        setTimeout(resolve, 1000);
      });

      await sourceVideo.play();
      mediaMode = 'camera';
      document.getElementById('btnSwitchCam').disabled = false;

      const labelKamera = targetFacing === 'user' ? 'Kamera Depan' : 'Kamera Belakang';
      statusText.textContent = `${labelKamera} aktif. Klik "Balik Kamera" untuk menukar.`;
      return;
    } catch (err) {
      lastError = err;
    }
  }

  facingMode = targetFacing === 'user' ? 'environment' : 'user';
  statusText.textContent =
    `Gagal pindah kamera (${lastError ? lastError.name + ': ' + lastError.message : 'tidak didukung'}).`;
}

document.getElementById('btnStartCam').addEventListener('click', openCamera);
document.getElementById('btnSwitchCam').addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  openCamera();
});

// Pilih Foto atau Video Polos dari Galeri
document.getElementById('galleryInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    statusText.textContent = 'Tidak ada file yang dipilih dari galeri.';
    return;
  }

  stopCurrentStream();
  document.getElementById('btnSwitchCam').disabled = true;

  const lowerName = (file.name || '').toLowerCase();
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(lowerName);
  const isVideo =
    file.type.startsWith('video/') ||
    /\.(mp4|3gp|mkv|webm|mov|avi)$/i.test(lowerName);

  const url = URL.createObjectURL(file);

  if (isImage) {
    sourceImage.onload = () => {
      mediaMode = 'gallery-image';
      statusText.textContent = `Foto galeri dimuat: ${file.name}. Klik "Simpan Foto" atau "Unduh Hasil".`;
    };
    sourceImage.onerror = () => {
      statusText.textContent = `Gagal memuat gambar (${file.name}). Format mungkin belum didukung browser/WebView ini.`;
    };
    sourceImage.src = url;
  } else if (isVideo) {
    sourceVideo.srcObject = null;
    sourceVideo.src = url;
    sourceVideo.loop = true;
    sourceVideo.onloadedmetadata = () => {
      sourceVideo.play().catch(() => {});
      mediaMode = 'gallery-video';
      statusText.textContent = `Video galeri dimuat: ${file.name}. Klik "Proses Video" lalu "Selesai & Unduh".`;
    };
    sourceVideo.onerror = () => {
      statusText.textContent = `Gagal memuat video (${file.name}). Codec/format mungkin belum didukung.`;
    };
  } else {
    statusText.textContent = `File "${file.name}" tidak dikenali sebagai foto atau video.`;
  }

  e.target.value = '';
});

// Upload & Atur Logo
document.getElementById('logoInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    logoImage = img;
    statusText.textContent = 'Logo berhasil dipasang.';
  };
  img.src = URL.createObjectURL(file);
  e.target.value = '';
});

document.getElementById('btnClearLogo').addEventListener('click', () => {
  logoImage = null;
});

// Tombol 6 Posisi Logo
document.querySelectorAll('#logoPosGrid .pos-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#logoPosGrid .pos-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    logoPosition = btn.dataset.pos;
  });
});

// Tombol 6 Posisi Peta
document.querySelectorAll('#mapPosGrid .pos-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#mapPosGrid .pos-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    mapPosition = btn.dataset.pos;
  });
});

fontScale.addEventListener('input', () => {
  fontScaleVal.textContent = `${fontScale.value}%`;
});

logoOpacity.addEventListener('input', () => {
  logoOpacityVal.textContent = `${logoOpacity.value}%`;
});

mapScale.addEventListener('input', () => {
  mapScaleVal.textContent = `${mapScale.value}%`;
});

mapOpacity.addEventListener('input', () => {
  mapOpacityVal.textContent = `${mapOpacity.value}%`;
});

// Hitung Koordinat X, Y untuk 6 Posisi
function calcPosXY(pos, itemW, itemH, canvasW, canvasH, pad) {
  let x = pad;
  let y = pad;

  if (pos.includes('center')) x = (canvasW - itemW) / 2;
  if (pos.includes('right')) x = canvasW - itemW - pad;
  if (pos.includes('bottom')) y = canvasH - itemH - pad;

  return { x, y };
}

// Format koordinat gaya 6,4062S 107,4631E ±3,00m
function formatCoordCompact(lat, lng, acc = 3.0) {
  const latHem = lat < 0 ? 'S' : 'N';
  const lngHem = lng < 0 ? 'W' : 'E';
  const latAbs = Math.abs(lat).toFixed(4).replace('.', ',');
  const lngAbs = Math.abs(lng).toFixed(4).replace('.', ',');
  const accStr = Number(acc).toFixed(2).replace('.', ',');
  return `${latAbs}${latHem} ${lngAbs}${lngHem} ±${accStr}m`;
}

// Format tanggal lengkap bahasa Indonesia
function formatFullDateTimeId(dateVal, timeVal) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const [y, m, d] = (dateVal || '2026-11-24').split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dayName = days[dt.getDay()] || '';
  const monthName = months[(m || 1) - 1] || '';
  const timeStr = timeVal || '23:18:00';

  return `${dayName}, ${d} ${monthName} ${y} ${timeStr}`;
}

// Gambar Pin / Tetesan Merah Peta
function drawRedPin(context, x, y, size) {
  context.save();
  context.fillStyle = '#ef4444';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;

  context.beginPath();
  context.arc(x, y - size * 0.6, size * 0.45, Math.PI, 0, false);
  context.lineTo(x, y);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(x, y - size * 0.6, size * 0.16, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

// Loop Render Utama ke Canvas
function renderLoop() {
  if (mediaMode === 'camera' || mediaMode === 'gallery-video') {
    if (sourceVideo.videoWidth && sourceVideo.videoHeight) {
      canvas.width = sourceVideo.videoWidth;
      canvas.height = sourceVideo.videoHeight;
      ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
    }
  } else if (mediaMode === 'gallery-image') {
    if (sourceImage.naturalWidth && sourceImage.naturalHeight) {
      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    }
  } else {
    canvas.width = 720;
    canvas.height = 1080;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Buka Kamera atau Pilih Foto/Video Galeri', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
  }

  drawOverlays();
  requestAnimationFrame(renderLoop);
}

// Gambar Layer Overlay: Logo, Peta Mini (Ukuran, 6 Posisi, Opacity), & Teks Rata Kanan
function drawOverlays() {
  const w = canvas.width;
  const h = canvas.height;
  const pad = Math.round(w * 0.025);
  const textScale = Number(fontScale.value) / 100;

  // 1. Gambar Logo (6 Posisi + Opacity)
  if (logoImage) {
    const logoW = Math.round(w * 0.18);
    const ratio = logoImage.naturalHeight / logoImage.naturalWidth;
    const logoH = Math.round(logoW * ratio);
    const { x: lx, y: ly } = calcPosXY(logoPosition, logoW, logoH, w, h, pad);

    ctx.save();
    ctx.globalAlpha = Number(logoOpacity.value) / 100;
    ctx.drawImage(logoImage, lx, ly, logoW, logoH);
    ctx.restore();
  }

  // 2. Gambar Peta Mini (Ukuran, 6 Posisi + Opacity + Pin Merah)
  if (showMap.checked) {
    const mScale = Number(mapScale.value) / 100;
    const mapCardSize = Math.round(Math.min(w, h) * 0.24 * mScale);
    const { x: mapCardX, y: mapCardY } = calcPosXY(mapPosition, mapCardSize, mapCardSize, w, h, pad);
    const borderW = Math.max(3, Math.round(mapCardSize * 0.03));

    ctx.save();
    ctx.globalAlpha = Number(mapOpacity.value) / 100;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mapCardX, mapCardY, mapCardSize, mapCardSize);

    const innerX = mapCardX + borderW;
    const innerY = mapCardY + borderW;
    const innerW = mapCardSize - borderW * 2;
    const innerH = mapCardSize - borderW * 2;

    ctx.beginPath();
    ctx.rect(innerX, innerY, innerW, innerH);
    ctx.clip();

    if (mapTileImg) {
      ctx.drawImage(mapTileImg, innerX, innerY, innerW, innerH);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(innerX, innerY, innerW, innerH);
    }

    drawRedPin(
      ctx,
      innerX + innerW / 2,
      innerY + innerH / 2,
      Math.max(20, innerW * 0.26)
    );
    ctx.restore();
  }

  // 3. Susun Baris Tulisan Terpisah di Kanan Bawah (Rata Kanan, Tanpa Kotak Gelap)
  const baseFont = Math.max(13, Math.round(w * 0.023 * textScale));
  const lineHeight = Math.round(baseFont * 1.28);

  const dateTimeLine = formatFullDateTimeId(manualDate.value, manualTime.value);
  const coordLine = formatCoordCompact(gpsState.lat, gpsState.lng, gpsState.accuracy);

  const addressParts = (addressText.value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);

  const altLine = `Altitude:${gpsState.altitude.toFixed(1)}msnm`;
  const speedLine = `Speed:${gpsState.speedKmh.toFixed(1)}km/h`;
  const nameLine = fullName.value.trim() || '-';

  const textLines = [
    dateTimeLine,
    coordLine,
    ...addressParts,
    altLine,
    speedLine,
    nameLine
  ];

  const rightX = w - pad;
  const totalTextH = textLines.length * lineHeight;
  let currentY = h - pad - totalTextH + baseFont * 0.8;

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.font = `500 ${baseFont}px sans-serif`;

  for (const line of textLines) {
    ctx.fillText(line, rightX, currentY);
    currentY += lineHeight;
  }
  ctx.restore();
}

// Helper memicu unduhan file
function triggerFileDownload(blob, filename, labelText) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
  }, 500);

  statusText.innerHTML = `${labelText} — <a href="${url}" download="${filename}" style="color:#38bdf8;font-weight:700;text-decoration:underline;">Klik di sini jika belum terunduh</a>`;
}

// Tombol "Unduh Hasil" (mengunduh hasil foto atau video terakhir)
btnDownloadResult.addEventListener('click', () => {
  if (!lastExport || !lastExport.blob) {
    statusText.textContent = 'Belum ada hasil. Klik "Simpan Foto" atau "Proses Video" dulu.';
    return;
  }
  triggerFileDownload(lastExport.blob, lastExport.filename, lastExport.label);
});

// Simpan Hasil Foto (Dari Kamera maupun Galeri)
document.getElementById('btnCapturePhoto').addEventListener('click', () => {
  try {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          statusText.textContent = 'Gagal membuat file foto.';
          return;
        }
        const filename = `Timestamp_Foto_${Date.now()}.jpg`;
        const label = 'Foto ber-timestamp siap diunduh';
        lastExport = { blob, filename, label };
        btnDownloadResult.disabled = false;
        triggerFileDownload(blob, filename, label);
      },
      'image/jpeg',
      0.95
    );
  } catch (err) {
    statusText.textContent = 'Gagal mengekspor foto: ' + err.message;
  }
});

// Deteksi mimeType video yang didukung perangkat
function getSupportedVideoMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

// Proses Video Galeri / Kamera
document.getElementById('btnProcessVideo').addEventListener('click', () => {
  if (!isProcessingVideo) {
    startVideoProcessing();
  } else {
    stopVideoProcessing();
  }
});

function startVideoProcessing() {
  if (typeof MediaRecorder === 'undefined') {
    statusText.textContent = 'Perangkat/browser ini tidak mendukung pemrosesan MediaRecorder.';
    return;
  }

  const canvasStream = canvas.captureStream(30);

  if (mediaMode === 'camera' && currentStream) {
    currentStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
  } else if (mediaMode === 'gallery-video' && sourceVideo.captureStream) {
    try {
      const vidStream = sourceVideo.captureStream();
      vidStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    } catch (_) {}
    sourceVideo.currentTime = 0;
    sourceVideo.play();
  }

  const mimeType = getSupportedVideoMimeType();
  recordedChunks = [];

  try {
    mediaRecorder = mimeType
      ? new MediaRecorder(canvasStream, { mimeType })
      : new MediaRecorder(canvasStream);
  } catch (err) {
    statusText.textContent = 'Gagal memulai pemrosesan video: ' + err.message;
    return;
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    const finalType = mediaRecorder.mimeType || mimeType || 'video/webm';
    const ext = finalType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(recordedChunks, { type: finalType });

    if (!blob.size) {
      statusText.textContent = 'Data video kosong. Coba proses beberapa detik lalu klik Selesai & Unduh.';
      return;
    }

    const filename = `Timestamp_Video_${Date.now()}.${ext}`;
    const label = 'Video ber-timestamp selesai diproses';
    lastExport = { blob, filename, label };
    btnDownloadResult.disabled = false;
    triggerFileDownload(blob, filename, label);
  };

  mediaRecorder.start(250);
  isProcessingVideo = true;
  processStartTime = Date.now();
  processTimer.classList.remove('hidden');
  document.getElementById('btnProcessVideo').textContent = 'Selesai & Unduh';
  statusText.textContent = 'Sedang memproses video ber-timestamp...';

  processInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - processStartTime) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    processTimer.textContent = `${m}:${s}`;
  }, 500);
}

function stopVideoProcessing() {
  if (mediaRecorder && isProcessingVideo) {
    mediaRecorder.stop();
  }
  isProcessingVideo = false;
  clearInterval(processInterval);
  processTimer.classList.add('hidden');
  document.getElementById('btnProcessVideo').textContent = 'Proses Video';
}

init();