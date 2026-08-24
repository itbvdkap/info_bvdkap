// Global Application State
let activeTab = 'submit';
let adminToken = localStorage.getItem('anphu_token') || null;
let adminUser = JSON.parse(localStorage.getItem('anphu_user') || 'null');
let departmentsList = [];
let categoriesList = [];
let chartCat = null;
let chartDept = null;
let lastSubmittedTrackingCode = '';

// DOM Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await loadMetadata();
  checkAuthAndInit();
});

// Load Dropdown Metadata (Departments & Categories)
async function loadMetadata() {
  try {
    const [resDept, resCat] = await Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]);

    if (resDept.success) {
      departmentsList = resDept.data;
      populateDeptDropdowns();
    }
    if (resCat.success) {
      categoriesList = resCat.data;
      populateCatDropdowns();
    }
  } catch (err) {
    console.error('Lỗi nạp danh mục:', err);
  }
}

function populateDeptDropdowns() {
  const deptSelect = document.getElementById('departmentId');
  const filterDept = document.getElementById('filterDepartment');

  let htmlForm = '<option value="">-- Chọn Khoa/Phòng liên quan --</option>';
  let htmlFilter = '<option value="all">-- Tất cả Khoa/Phòng --</option>';

  departmentsList.forEach(d => {
    htmlForm += `<option value="${d.id}">${d.name} (${d.code})</option>`;
    htmlFilter += `<option value="${d.id}">${d.name}</option>`;
  });

  if (deptSelect) deptSelect.innerHTML = htmlForm;
  if (filterDept) filterDept.innerHTML = htmlFilter;
}

function populateCatDropdowns() {
  const catSelect = document.getElementById('categoryId');
  const filterCat = document.getElementById('filterCategory');

  let htmlForm = '<option value="">-- Chọn loại báo cáo / ý kiến --</option>';
  let htmlFilter = '<option value="all">-- Tất cả Phân loại --</option>';

  categoriesList.forEach(c => {
    htmlForm += `<option value="${c.id}">${c.name}</option>`;
    htmlFilter += `<option value="${c.id}">${c.name}</option>`;
  });

  if (catSelect) catSelect.innerHTML = htmlForm;
  if (filterCat) filterCat.innerHTML = htmlFilter;
}

// Tab Switching
function switchTab(tabName) {
  activeTab = tabName;

  document.getElementById('tabSubmit').classList.add('hidden');
  document.getElementById('tabTrack').classList.add('hidden');
  document.getElementById('tabAdmin').classList.add('hidden');

  const btnSubmit = document.getElementById('tabBtnSubmit');
  const btnTrack = document.getElementById('tabBtnTrack');
  const btnAdmin = document.getElementById('tabBtnAdmin');

  [btnSubmit, btnTrack, btnAdmin].forEach(btn => {
    btn.className = 'px-4 py-2 rounded-lg transition-all flex items-center space-x-2 text-sky-100 hover:text-white';
  });

  if (tabName === 'submit') {
    document.getElementById('tabSubmit').classList.remove('hidden');
    btnSubmit.className = 'px-4 py-2 rounded-lg transition-all flex items-center space-x-2 bg-white text-sky-800 shadow font-bold';
  } else if (tabName === 'track') {
    document.getElementById('tabTrack').classList.remove('hidden');
    btnTrack.className = 'px-4 py-2 rounded-lg transition-all flex items-center space-x-2 bg-white text-sky-800 shadow font-bold';
    renderDeviceHistory();
  } else if (tabName === 'admin') {
    document.getElementById('tabAdmin').classList.remove('hidden');
    btnAdmin.className = 'px-4 py-2 rounded-lg transition-all flex items-center space-x-2 bg-white text-sky-800 shadow font-bold';
    checkAuthAndInit();
  }
}

// Toggle Anonymous Input Fields
function toggleAnonFields() {
  const isAnon = document.getElementById('isAnonymous').checked;
  const senderFields = document.getElementById('senderFields');
  if (isAnon) {
    senderFields.classList.add('hidden');
  } else {
    senderFields.classList.remove('hidden');
  }
}

// Attachment & Camera State Management
let selectedAttachmentFile = null;
let cameraStream = null;

function handleFileSelected(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  selectedAttachmentFile = file;
  renderAttachmentPreview(file);
}

function renderAttachmentPreview(file) {
  const previewBox = document.getElementById('attachmentPreviewBox');
  const fileNameSpan = document.getElementById('attachmentFileName');
  const fileSizeSpan = document.getElementById('attachmentFileSize');
  const previewImgDiv = document.getElementById('attachmentPreviewImg');
  const defaultIcon = document.getElementById('attachmentDefaultIcon');

  if (!previewBox) return;

  fileNameSpan.innerText = file.name || 'Ảnh chụp từ Camera';
  const sizeKb = (file.size / 1024).toFixed(1);
  fileSizeSpan.innerText = `${sizeKb > 1024 ? (Number(sizeKb) / 1024).toFixed(2) + ' MB' : sizeKb + ' KB'}`;

  if (file.type && file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    previewImgDiv.style.backgroundImage = `url('${url}')`;
    if (defaultIcon) defaultIcon.classList.add('hidden');
  } else {
    previewImgDiv.style.backgroundImage = 'none';
    if (defaultIcon) defaultIcon.classList.remove('hidden');
  }

  previewBox.classList.remove('hidden');
}

function removeSelectedAttachment() {
  selectedAttachmentFile = null;
  const previewBox = document.getElementById('attachmentPreviewBox');
  if (previewBox) previewBox.classList.add('hidden');

  const fileInput = document.getElementById('feedbackAttachment');
  if (fileInput) fileInput.value = '';
}

// Live Camera Modal Control (HTML5 WebRTC)
async function openCameraModal() {
  const modal = document.getElementById('modalCamera');
  const video = document.getElementById('cameraVideo');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = cameraStream;
    modal.classList.remove('hidden');
  } catch (err) {
    alert('⚠️ Không thể mở Camera trên thiết bị này: ' + (err.message || 'Chưa cấp quyền truy cập Camera.'));
  }
}

function closeCameraModal() {
  const modal = document.getElementById('modalCamera');
  const video = document.getElementById('cameraVideo');

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (video) video.srcObject = null;
  modal.classList.add('hidden');
}

function capturePhotoFromCamera() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');

  if (!video || !canvas) return;

  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) {
      alert('❌ Lỗi chụp ảnh!');
      return;
    }
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const photoFile = new File([blob], `CAMERA_${timestamp}.jpg`, { type: 'image/jpeg' });

    selectedAttachmentFile = photoFile;
    renderAttachmentPreview(photoFile);
    closeCameraModal();
  }, 'image/jpeg', 0.85);
}

// Submit Employee Feedback Form
async function handleFormSubmit(e) {
  e.preventDefault();
  const btnSubmit = document.getElementById('btnSubmitFeedback');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>ĐANG GỬI BÁO CÁO...</span>';

  try {
    const isAnon = document.getElementById('isAnonymous').checked;
    const categoryId = document.getElementById('categoryId').value;
    const departmentId = document.getElementById('departmentId').value;
    const priority = document.querySelector('input[name="priority"]:checked').value;
    const title = document.getElementById('feedbackTitle').value;
    const content = document.getElementById('feedbackContent').value;
    const fileInput = document.getElementById('feedbackAttachment');

    let attachmentUrl = null;

    const fileToUpload = selectedAttachmentFile || (fileInput.files.length > 0 ? fileInput.files[0] : null);

    // 1. If file attached or photo captured, upload to Supabase Storage CDN via /api/upload
    if (fileToUpload) {
      btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-spin"></i> <span>ĐANG TẢI ẢNH/FILE LÊN SUPABASE STORAGE...</span>';

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(fileToUpload);
      });

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileToUpload.name,
          mimetype: fileToUpload.type,
          base64
        })
      });

      const uploadData = await uploadRes.json();
      if (uploadData.success && uploadData.url) {
        attachmentUrl = uploadData.url;
      } else {
        alert('❌ Lỗi tải tệp đính kèm: ' + (uploadData.message || 'Không thể tải tệp lên Cloud Storage.'));
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>GỬI BÁO CÁO CHO LÃNH ĐẠO</span>';
        return;
      }
    }

    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>ĐANG GỬI BÁO CÁO...</span>';

    const payload = {
      is_anonymous: isAnon,
      category_id: categoryId,
      department_id: departmentId,
      priority,
      title,
      content,
      attachment_url: attachmentUrl
    };

    if (!isAnon) {
      payload.sender_name = document.getElementById('senderName').value;
      payload.sender_phone = document.getElementById('senderPhone').value;
      payload.sender_email = document.getElementById('senderEmail').value;
    }

    const res = await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      lastSubmittedTrackingCode = data.tracking_code;

      // Find department and category name for local history card
      const deptObj = departmentsList.find(d => String(d.id) === String(departmentId));
      const catObj = categoriesList.find(c => String(c.id) === String(categoryId));

      saveToDeviceHistory({
        tracking_code: data.tracking_code,
        title,
        priority,
        department_name: deptObj ? deptObj.name : 'N/A',
        category_name: catObj ? catObj.name : 'N/A',
        created_at: new Date().toISOString()
      });

      document.getElementById('displayTrackingCode').innerText = data.tracking_code;
      document.getElementById('modalSuccess').classList.remove('hidden');
      document.getElementById('feedbackForm').reset();
      removeSelectedAttachment();
      toggleAnonFields();
    } else {
      alert('❌ Error: ' + (data.message || 'Không thể gửi báo cáo.'));
    }
  } catch (err) {
    alert('❌ Lỗi kết nối mạng khi gửi báo cáo!');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>GỬI BÁO CÁO CHO LÃNH ĐẠO</span>';
  }
}

function copyTrackingCode() {
  navigator.clipboard.writeText(lastSubmittedTrackingCode);
  alert('✅ Đã sao chép Mã Tra Cứu: ' + lastSubmittedTrackingCode);
}

function closeSuccessModal() {
  document.getElementById('modalSuccess').classList.add('hidden');
}

function goToTrackWithCode() {
  closeSuccessModal();
  document.getElementById('inputTrackCode').value = lastSubmittedTrackingCode;
  switchTab('track');
  handleTrackSearch();
}

// Track Search Logic
async function handleTrackSearch() {
  const code = document.getElementById('inputTrackCode').value.trim();
  if (!code) {
    alert('Vui lòng nhập Mã Tra Cứu!');
    return;
  }

  const container = document.getElementById('trackResultContainer');
  container.classList.add('hidden');

  try {
    const res = await fetch(`/api/feedbacks/track?code=${encodeURIComponent(code)}`);
    const data = await res.json();

    if (data.success) {
      const item = data.data;
      document.getElementById('resTrackingCode').innerText = item.tracking_code;
      document.getElementById('resDept').innerText = item.department_name || 'N/A';
      document.getElementById('resCat').innerText = item.category_name || 'N/A';
      document.getElementById('resTitle').innerText = item.title;
      document.getElementById('resContent').innerText = item.content;
      document.getElementById('resCreatedAt').innerText = new Date(item.created_at).toLocaleString('vi-VN');

      // Priority Badge
      let priorityText = '📌 Bình thường';
      if (item.priority === 'urgent') priorityText = '🚨 Khẩn cấp';
      else if (item.priority === 'high') priorityText = '⚠️ Quan trọng';
      document.getElementById('resPriority').innerText = priorityText;

      // Status Badge
      const badgeBox = document.getElementById('resStatusBadge');
      if (item.status === 'pending') {
        badgeBox.innerHTML = '<span class="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-xs">⏳ Mới tiếp nhận</span>';
      } else if (item.status === 'processing') {
        badgeBox.innerHTML = '<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold text-xs">⚙️ Đang xử lý</span>';
      } else if (item.status === 'resolved') {
        badgeBox.innerHTML = '<span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">✅ Đã giải quyết</span>';
      } else {
        badgeBox.innerHTML = '<span class="px-3 py-1 bg-slate-100 text-slate-800 rounded-full font-bold text-xs">❌ Từ chối / Khác</span>';
      }

      // Attachment link
      const attBox = document.getElementById('resAttachmentBox');
      if (item.attachment_url) {
        document.getElementById('resAttachmentLink').href = item.attachment_url;
        attBox.classList.remove('hidden');
      } else {
        attBox.classList.add('hidden');
      }

      // Leadership Response Box
      const responseText = document.getElementById('resResponseText');
      const responseMeta = document.getElementById('resResponseMeta');

      if (item.response_content) {
        responseText.innerText = item.response_content;
        if (item.responded_at) {
          document.getElementById('resResponseTime').innerText = new Date(item.responded_at).toLocaleString('vi-VN');
          responseMeta.classList.remove('hidden');
        }
      } else {
        responseText.innerText = 'Đang chờ Ban Giám Đốc xem xét và phản hồi...';
        responseMeta.classList.add('hidden');
      }

      container.classList.remove('hidden');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi hệ thống khi tra cứu!');
  }
}

// Admin Auth & Dashboard Init
function checkAuthAndInit() {
  const loginForm = document.getElementById('adminLoginForm');
  const dashboard = document.getElementById('adminDashboard');

  if (adminToken) {
    loginForm.classList.add('hidden');
    dashboard.classList.remove('hidden');
    document.getElementById('adminUserGreeting').innerText = adminUser?.full_name || 'Ban Giám Đốc Bệnh Viện';
    loadAdminFeedbacks();
    loadStatsAndCharts();
  } else {
    loginForm.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

// Admin Login Handle
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      adminUser = data.user;
      localStorage.setItem('anphu_token', adminToken);
      localStorage.setItem('anphu_user', JSON.stringify(adminUser));
      checkAuthAndInit();
    } else {
      alert('❌ Đăng nhập thất bại: ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi kết nối máy chủ!');
  }
}

function handleLogout() {
  adminToken = null;
  adminUser = null;
  localStorage.removeItem('anphu_token');
  localStorage.removeItem('anphu_user');
  checkAuthAndInit();
}

// Fetch & Render Admin Table Data
async function loadAdminFeedbacks() {
  if (!adminToken) return;

  const keyword = document.getElementById('filterKeyword')?.value?.trim() || '';
  const status = document.getElementById('filterStatus')?.value || 'all';
  const department_id = document.getElementById('filterDepartment')?.value || 'all';
  const category_id = document.getElementById('filterCategory')?.value || 'all';
  const priority = document.getElementById('filterPriority')?.value || 'all';
  const from_date = document.getElementById('filterFromDate')?.value || '';
  const to_date = document.getElementById('filterToDate')?.value || '';

  const queryParams = new URLSearchParams();
  if (keyword) queryParams.append('keyword', keyword);
  if (from_date) queryParams.append('from_date', from_date);
  if (to_date) queryParams.append('to_date', to_date);
  if (status && status !== 'all') queryParams.append('status', status);
  if (department_id && department_id !== 'all') queryParams.append('department_id', department_id);
  if (category_id && category_id !== 'all') queryParams.append('category_id', category_id);
  if (priority && priority !== 'all') queryParams.append('priority', priority);

  try {
    const res = await fetch(`/api/feedbacks/admin?${queryParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();

    if (data.success) {
      renderFeedbacksTable(data.data);
    } else if (res.status === 401 || res.status === 403) {
      handleLogout();
    }
  } catch (err) {
    console.error('Lỗi tải bảng admin:', err);
  }
}

function renderFeedbacksTable(items) {
  const tbody = document.getElementById('tableFeedbacks');
  const mobileContainer = document.getElementById('cardFeedbacksMobile');

  if (!items || items.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Không có dữ liệu báo cáo nào phù hợp.</td></tr>';
    if (mobileContainer) mobileContainer.innerHTML = '<div class="p-8 text-center text-slate-400 text-xs">Không có dữ liệu báo cáo nào phù hợp.</div>';
    return;
  }

  let tableHtml = '';
  let mobileHtml = '';

  items.forEach(item => {
    let priorityBadge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">Bình thường</span>';
    if (item.priority === 'urgent') priorityBadge = '<span class="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[11px]">🚨 Khẩn cấp</span>';
    else if (item.priority === 'high') priorityBadge = '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[11px]">⚠️ Quan trọng</span>';

    let statusBadge = '<span class="px-2.5 py-1 bg-amber-100 text-amber-800 font-semibold rounded-full text-[11px]">Mới tiếp nhận</span>';
    if (item.status === 'processing') statusBadge = '<span class="px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full text-[11px]">Đang xử lý</span>';
    else if (item.status === 'resolved') statusBadge = '<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-[11px]">Đã giải quyết</span>';
    else if (item.status === 'rejected') statusBadge = '<span class="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-full text-[11px]">Từ chối</span>';

    const senderText = item.is_anonymous ? '<span class="text-slate-400 font-medium">🔒 Ẩn danh</span>' : `<strong>${escapeHtml(item.sender_name || 'Nhân viên')}</strong> ${item.sender_phone ? `<br><span class="text-slate-400 text-[10px]">${item.sender_phone}</span>` : ''}`;

    const deptStr = typeof item.department_name === 'object' ? (item.department_name?.name || 'N/A') : (item.department_name || 'N/A');
    const catStr = typeof item.category_name === 'object' ? (item.category_name?.name || 'N/A') : (item.category_name || 'N/A');

    // Desktop Table Row
    tableHtml += `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3.5 font-bold text-sky-700 font-mono">${item.tracking_code}</td>
        <td class="p-3.5">${priorityBadge}</td>
        <td class="p-3.5">
          <div class="font-semibold text-slate-800">${escapeHtml(deptStr)}</div>
          <div class="text-slate-400 text-[11px]">${escapeHtml(catStr)}</div>
        </td>
        <td class="p-3.5">${senderText}</td>
        <td class="p-3.5 max-w-xs">
          <div class="font-bold text-slate-800 line-clamp-1">${escapeHtml(item.title)}</div>
          <div class="text-slate-500 text-[11px] line-clamp-2 mt-0.5">${escapeHtml(item.content)}</div>
        </td>
        <td class="p-3.5">${statusBadge}</td>
        <td class="p-3.5 text-center">
          <button onclick="openRespondModal(${item.id})" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs shadow-sm transition">
            <i class="fa-solid fa-pen-to-square"></i> Xử lý
          </button>
        </td>
      </tr>
    `;

    // Mobile Responsive Card Item
    mobileHtml += `
      <div class="p-4 space-y-2.5 hover:bg-slate-50 transition border-b border-slate-100 last:border-none">
        <div class="flex items-center justify-between">
          <span class="font-extrabold text-sky-700 text-xs font-mono">${item.tracking_code}</span>
          <div class="flex items-center space-x-1">
            ${priorityBadge}
            ${statusBadge}
          </div>
        </div>
        <div>
          <h5 class="font-bold text-slate-800 text-sm leading-snug">${escapeHtml(item.title)}</h5>
          <p class="text-slate-600 text-xs line-clamp-3 mt-1 leading-relaxed">${escapeHtml(item.content)}</p>
        </div>
        <div class="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <div class="space-y-0.5">
            <div class="font-semibold text-slate-700">🏥 ${escapeHtml(deptStr)}</div>
            <div class="text-slate-400 text-[10px]">📁 ${escapeHtml(catStr)} • ${senderText}</div>
          </div>
          <button onclick="openRespondModal(${item.id})" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow flex items-center space-x-1 shrink-0 ml-2">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>Xử lý</span>
          </button>
        </div>
      </div>
    `;
  });

  if (tbody) tbody.innerHTML = tableHtml;
  if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
}

// Fetch Stats & Render Chart.js
async function loadStatsAndCharts() {
  if (!adminToken) return;

  try {
    const res = await fetch('/api/feedbacks/stats', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();

    if (data.success) {
      const stats = data.data;
      document.getElementById('kpiTotal').innerText = stats.total;
      document.getElementById('kpiPending').innerText = stats.pending;
      document.getElementById('kpiProcessing').innerText = stats.processing;
      document.getElementById('kpiResolved').innerText = stats.resolved;
      document.getElementById('kpiUrgent').innerText = stats.urgent;

      renderCategoryChart(stats.byCategory);
      renderDepartmentChart(stats.byDepartment);
    }
  } catch (err) {
    console.error('Lỗi tải thống kê:', err);
  }
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('chartCategory').getContext('2d');
  if (chartCat) chartCat.destroy();

  const labels = data.map(d => d.category_name);
  const values = data.map(d => d.count);

  chartCat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#0284c7', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
    }
  });
}

function renderDepartmentChart(data) {
  const ctx = document.getElementById('chartDepartment').getContext('2d');
  if (chartDept) chartDept.destroy();

  const labels = data.map(d => d.department_name);
  const values = data.map(d => d.count);

  chartDept = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Số lượng ý kiến',
        data: values,
        backgroundColor: '#0369a1',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { font: { size: 10 } } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// Modal Respond Handlers
let currentEditingItem = null;

async function openRespondModal(id) {
  try {
    const res = await fetch(`/api/feedbacks/admin?keyword=`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success) {
      const item = data.data.find(i => i.id === id);
      if (!item) return;

      currentEditingItem = item;
      document.getElementById('modalFeedbackId').value = item.id;
      document.getElementById('modalTrackCode').innerText = item.tracking_code;
      document.getElementById('modalSender').innerText = item.is_anonymous ? '🔒 Ẩn danh' : `${item.sender_name || 'Nhân viên'} (${item.sender_phone || 'Không SĐT'})`;
      document.getElementById('modalDept').innerText = item.department_name || 'N/A';
      document.getElementById('modalCat').innerText = item.category_name || 'N/A';
      document.getElementById('modalTitle').innerText = item.title;
      document.getElementById('modalContent').innerText = item.content;
      document.getElementById('modalStatus').value = item.status;
      document.getElementById('modalResponseText').value = item.response_content || '';

      const attBox = document.getElementById('modalAttachmentBox');
      if (item.attachment_url) {
        document.getElementById('modalAttachmentLink').href = item.attachment_url;
        attBox.classList.remove('hidden');
      } else {
        attBox.classList.add('hidden');
      }

      // Populate Secret Audit Logging Metadata (ONLY FOR ROLE === 'ADMIN')
      const auditBox = document.getElementById('modalAuditBox');
      if (adminUser?.role === 'admin' && item.client_ip) {
        document.getElementById('modalAuditIp').innerText = item.client_ip || 'Không lưu vết';
        const uaSpan = document.getElementById('modalAuditUserAgent');
        uaSpan.innerText = item.user_agent ? (item.user_agent.length > 50 ? item.user_agent.substring(0, 50) + '...' : item.user_agent) : 'Không xác định';
        uaSpan.title = item.user_agent || '';
        auditBox.classList.remove('hidden');
      } else {
        auditBox.classList.add('hidden');
      }

      document.getElementById('modalRespond').classList.remove('hidden');
    }
  } catch (err) {
    alert('❌ Lỗi mở modal phản hồi!');
  }
}

function closeRespondModal() {
  document.getElementById('modalRespond').classList.add('hidden');
}

async function handleSaveRespond(e) {
  e.preventDefault();
  const id = document.getElementById('modalFeedbackId').value;
  const status = document.getElementById('modalStatus').value;
  const response_content = document.getElementById('modalResponseText').value;

  try {
    const res = await fetch(`/api/feedbacks/respond`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id, status, response_content })
    });
    const data = await res.json();
    if (data.success) {
      closeRespondModal();
      loadAdminFeedbacks();
      loadStatsAndCharts();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi cập nhật phản hồi!');
  }
}

// Multi-Channel Notification Settings Modal
async function openNotificationModal() {
  try {
    const res = await fetch('/api/settings', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success) {
      const s = data.data;
      // Telegram
      document.getElementById('settingTelegramEnabled').checked = s.telegram_enabled !== 'false';
      document.getElementById('settingTelegramToken').value = s.telegram_bot_token || '';
      document.getElementById('settingTelegramChatId').value = s.telegram_chat_id || '';

      // Email
      document.getElementById('settingEmailEnabled').checked = s.email_enabled === 'true';
      document.getElementById('settingEmailUser').value = s.email_user || '';
      document.getElementById('settingEmailPass').value = s.email_pass || '';
      document.getElementById('settingEmailReceiver').value = s.email_receiver || '';
      document.getElementById('settingEmailHost').value = s.email_smtp_host || 'smtp.gmail.com';
      document.getElementById('settingEmailPort').value = s.email_smtp_port || '587';

      // Zalo
      document.getElementById('settingZaloEnabled').checked = s.zalo_enabled === 'true';
      document.getElementById('settingZaloWebhook').value = s.zalo_webhook_url || '';

      document.getElementById('modalNotificationSettings').classList.remove('hidden');
    }
  } catch (err) {
    alert('❌ Lỗi tải cấu hình thông báo!');
  }
}

function closeNotificationModal() {
  document.getElementById('modalNotificationSettings').classList.add('hidden');
}

async function handleSaveNotificationSettings(e) {
  e.preventDefault();

  const settings = {
    // Telegram
    telegram_enabled: String(document.getElementById('settingTelegramEnabled').checked),
    telegram_bot_token: document.getElementById('settingTelegramToken').value.trim(),
    telegram_chat_id: document.getElementById('settingTelegramChatId').value.trim(),

    // Email / Gmail
    email_enabled: String(document.getElementById('settingEmailEnabled').checked),
    email_user: document.getElementById('settingEmailUser').value.trim(),
    email_pass: document.getElementById('settingEmailPass').value.trim(),
    email_receiver: document.getElementById('settingEmailReceiver').value.trim(),
    email_smtp_host: document.getElementById('settingEmailHost').value.trim(),
    email_smtp_port: document.getElementById('settingEmailPort').value.trim(),

    // Zalo
    zalo_enabled: String(document.getElementById('settingZaloEnabled').checked),
    zalo_webhook_url: document.getElementById('settingZaloWebhook').value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ settings })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ Cập nhật cấu hình thông báo đa kênh (Telegram/Email/Zalo) thành công!');
      closeNotificationModal();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi lưu cấu hình thông báo!');
  }
}

// Export Excel Function
function exportExcel() {
  if (!adminToken) {
    alert('Vui lòng đăng nhập lại tài khoản Admin để xuất file Excel!');
    return;
  }
  const keyword = document.getElementById('filterKeyword')?.value?.trim() || '';
  const status = document.getElementById('filterStatus')?.value || 'all';
  const department_id = document.getElementById('filterDepartment')?.value || 'all';
  const category_id = document.getElementById('filterCategory')?.value || 'all';
  const priority = document.getElementById('filterPriority')?.value || 'all';

  const queryParams = new URLSearchParams();
  queryParams.append('token', adminToken);
  if (keyword) queryParams.append('keyword', keyword);
  if (status && status !== 'all') queryParams.append('status', status);
  if (department_id && department_id !== 'all') queryParams.append('department_id', department_id);
  if (category_id && category_id !== 'all') queryParams.append('category_id', category_id);
  if (priority && priority !== 'all') queryParams.append('priority', priority);

  const url = `/api/export/excel?${queryParams.toString()}`;
  window.open(url, '_blank');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Local Storage Device History Management
const LOCAL_STORAGE_HISTORY_KEY = 'anphu_user_feedback_history';

function getDeviceHistory() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveToDeviceHistory(item) {
  const list = getDeviceHistory();
  // Avoid duplicate tracking codes
  const filtered = list.filter(i => i.tracking_code !== item.tracking_code);
  filtered.unshift(item); // Newest first
  localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(filtered.slice(0, 50))); // Keep last 50
  renderDeviceHistory();
}

function renderDeviceHistory() {
  const container = document.getElementById('deviceHistoryList');
  if (!container) return;

  const history = getDeviceHistory();
  if (!history || history.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
        Chưa có báo cáo nào được gửi từ trình duyệt này.
      </div>
    `;
    return;
  }

  let html = '';
  history.forEach(item => {
    let priorityBadge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">📌 Bình thường</span>';
    if (item.priority === 'urgent') priorityBadge = '<span class="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">🚨 Khẩn cấp</span>';
    else if (item.priority === 'high') priorityBadge = '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">⚠️ Quan trọng</span>';

    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('vi-VN') : '';

    html += `
      <div class="p-3.5 bg-slate-50 hover:bg-sky-50/50 border border-slate-200 rounded-xl transition flex flex-wrap items-center justify-between gap-3 cursor-pointer" onclick="trackFromHistory('${item.tracking_code}')">
        <div class="space-y-1 max-w-md">
          <div class="flex items-center space-x-2">
            <span class="font-extrabold text-sky-700 text-xs tracking-wider">${item.tracking_code}</span>
            ${priorityBadge}
          </div>
          <h5 class="font-bold text-slate-800 text-xs line-clamp-1">${escapeHtml(item.title)}</h5>
          <div class="text-[11px] text-slate-500">
            🏥 ${escapeHtml(item.department_name)} • 📁 ${escapeHtml(item.category_name)}
          </div>
        </div>

        <div class="flex items-center space-x-3 text-xs">
          <span class="text-[11px] text-slate-400">${dateStr}</span>
          <button onclick="event.stopPropagation(); trackFromHistory('${item.tracking_code}')" class="px-3 py-1.5 bg-white text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-600 hover:text-white shadow-sm font-semibold transition text-xs flex items-center space-x-1">
            <i class="fa-solid fa-magnifying-glass"></i>
            <span>Xem phản hồi</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function trackFromHistory(code) {
  document.getElementById('inputTrackCode').value = code;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  handleTrackSearch();
}

function clearDeviceHistory() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử ý kiến lưu trên máy này?')) {
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    renderDeviceHistory();
  }
}

// Department Catalog Manager Handlers
function openDepartmentModal() {
  renderDepartmentTable();
  document.getElementById('modalDepartmentManager').classList.remove('hidden');
}

function closeDepartmentModal() {
  document.getElementById('modalDepartmentManager').classList.add('hidden');
  resetDeptForm();
}

function renderDepartmentTable() {
  const tbody = document.getElementById('tableDeptList');
  if (!tbody) return;

  if (!departmentsList || departmentsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Chưa có dữ liệu Khoa/Phòng.</td></tr>';
    return;
  }

  let html = '';
  departmentsList.forEach(d => {
    const activeBadge = d.active !== 0
      ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">Hoạt động</span>'
      : '<span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">Tạm khóa</span>';

    html += `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 text-slate-400 font-mono">${d.id}</td>
        <td class="p-3 font-bold text-sky-700 font-mono">${escapeHtml(d.code)}</td>
        <td class="p-3 font-semibold text-slate-800">${escapeHtml(d.name)}</td>
        <td class="p-3">${activeBadge}</td>
        <td class="p-3 text-center">
          <button type="button" onclick="editDepartment(${d.id})" class="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg font-semibold transition text-xs">
            <i class="fa-solid fa-pen-to-square"></i> Sửa
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function editDepartment(id) {
  const dept = departmentsList.find(d => d.id === id);
  if (!dept) return;

  document.getElementById('deptFormId').value = dept.id;
  document.getElementById('deptFormName').value = dept.name;
  document.getElementById('deptFormCode').value = dept.code;
  document.getElementById('deptFormActive').checked = dept.active !== 0;
  document.getElementById('deptFormTitle').innerText = `✏️ Chỉnh sửa Khoa/Phòng (ID: ${dept.id})`;
}

function resetDeptForm() {
  document.getElementById('deptFormId').value = '';
  document.getElementById('deptFormName').value = '';
  document.getElementById('deptFormCode').value = '';
  document.getElementById('deptFormActive').checked = true;
  document.getElementById('deptFormTitle').innerText = '➕ Thêm Khoa/Phòng mới';
}

async function handleSaveDepartment(e) {
  e.preventDefault();
  if (!adminToken) {
    alert('Vui lòng đăng nhập lại tài khoản Admin!');
    return;
  }

  const id = document.getElementById('deptFormId').value;
  const name = document.getElementById('deptFormName').value.trim();
  const code = document.getElementById('deptFormCode').value.trim().toUpperCase();
  const active = document.getElementById('deptFormActive').checked ? 1 : 0;

  try {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id: id ? Number(id) : undefined, name, code, active })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ ' + data.message);
      resetDeptForm();
      await loadMetadata(); // Reload departmentsList & dropdowns
      renderDepartmentTable();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi hệ thống khi lưu Khoa/Phòng!');
  }
}

// Modal Export Excel Custom Handlers
function openExportModal() {
  const modal = document.getElementById('modalExportExcel');
  if (!modal) return;

  // Populate department dropdown
  const deptSelect = document.getElementById('exportDepartment');
  let deptHtml = '<option value="all">-- Tất cả Khoa / Phòng Ban --</option>';
  departmentsList.forEach(d => {
    if (d.active !== 0) deptHtml += `<option value="${d.id}">${escapeHtml(d.name)} (${d.code})</option>`;
  });
  deptSelect.innerHTML = deptHtml;

  // Populate category dropdown
  const catSelect = document.getElementById('exportCategory');
  let catHtml = '<option value="all">-- Tất cả Chuyên Mục --</option>';
  categoriesList.forEach(c => {
    catHtml += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
  });
  catSelect.innerHTML = catHtml;

  // Sync values from current filters if available
  document.getElementById('exportFromDate').value = document.getElementById('filterFromDate')?.value || '';
  document.getElementById('exportToDate').value = document.getElementById('filterToDate')?.value || '';
  document.getElementById('exportDepartment').value = document.getElementById('filterDepartment')?.value || 'all';
  document.getElementById('exportStatus').value = document.getElementById('filterStatus')?.value || 'all';
  document.getElementById('exportCategory').value = document.getElementById('filterCategory')?.value || 'all';
  document.getElementById('exportPriority').value = document.getElementById('filterPriority')?.value || 'all';

  modal.classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('modalExportExcel')?.classList.add('hidden');
}

function triggerExcelDownload() {
  if (!adminToken) {
    alert('Vui lòng đăng nhập lại tài khoản Admin để xuất file Excel!');
    return;
  }

  const from_date = document.getElementById('exportFromDate')?.value || '';
  const to_date = document.getElementById('exportToDate')?.value || '';
  const department_id = document.getElementById('exportDepartment')?.value || 'all';
  const status = document.getElementById('exportStatus')?.value || 'all';
  const category_id = document.getElementById('exportCategory')?.value || 'all';
  const priority = document.getElementById('exportPriority')?.value || 'all';

  const queryParams = new URLSearchParams();
  queryParams.append('token', adminToken);
  if (from_date) queryParams.append('from_date', from_date);
  if (to_date) queryParams.append('to_date', to_date);
  if (status && status !== 'all') queryParams.append('status', status);
  if (department_id && department_id !== 'all') queryParams.append('department_id', department_id);
  if (category_id && category_id !== 'all') queryParams.append('category_id', category_id);
  if (priority && priority !== 'all') queryParams.append('priority', priority);

  const url = `/api/export/excel?${queryParams.toString()}`;
  closeExportModal();
  window.open(url, '_blank');
}

// Category Catalog Manager Handlers
function openCategoryModal() {
  renderCategoryTable();
  document.getElementById('modalCategoryManager')?.classList.remove('hidden');
}

function closeCategoryModal() {
  document.getElementById('modalCategoryManager')?.classList.add('hidden');
  resetCatForm();
}

function renderCategoryTable() {
  const tbody = document.getElementById('tableCatList');
  if (!tbody) return;

  if (!categoriesList || categoriesList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Chưa có dữ liệu Phân Loại.</td></tr>';
    return;
  }

  let html = '';
  categoriesList.forEach(c => {
    html += `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 text-slate-400 font-mono">${c.id}</td>
        <td class="p-3 font-bold text-purple-700 font-mono">${escapeHtml(c.code)}</td>
        <td class="p-3 font-semibold text-slate-800">${escapeHtml(c.name)}</td>
        <td class="p-3 text-slate-500 text-[11px] max-w-xs truncate">${escapeHtml(c.description || '--')}</td>
        <td class="p-3 text-center">
          <button type="button" onclick="editCategory(${c.id})" class="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-lg font-semibold transition text-xs">
            <i class="fa-solid fa-pen-to-square"></i> Sửa
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function editCategory(id) {
  const cat = categoriesList.find(c => c.id === id);
  if (!cat) return;

  document.getElementById('catFormId').value = cat.id;
  document.getElementById('catFormName').value = cat.name;
  document.getElementById('catFormCode').value = cat.code;
  document.getElementById('catFormIcon').value = cat.icon || '';
  document.getElementById('catFormDesc').value = cat.description || '';
  document.getElementById('catFormTitle').innerText = `✏️ Chỉnh sửa Phân Loại (ID: ${cat.id})`;
}

function resetCatForm() {
  document.getElementById('catFormId').value = '';
  document.getElementById('catFormName').value = '';
  document.getElementById('catFormCode').value = '';
  document.getElementById('catFormIcon').value = '';
  document.getElementById('catFormDesc').value = '';
  document.getElementById('catFormTitle').innerText = '➕ Thêm Phân Loại mới';
}

async function handleSaveCategory(e) {
  e.preventDefault();
  if (!adminToken) {
    alert('Vui lòng đăng nhập lại tài khoản Admin!');
    return;
  }

  const id = document.getElementById('catFormId').value;
  const name = document.getElementById('catFormName').value.trim();
  const code = document.getElementById('catFormCode').value.trim().toUpperCase();
  const icon = document.getElementById('catFormIcon').value.trim();
  const description = document.getElementById('catFormDesc').value.trim();

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id: id ? Number(id) : undefined, name, code, icon, description })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ ' + data.message);
      resetCatForm();
      await loadMetadata(); // Reload categoriesList & dropdowns
      renderCategoryTable();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi hệ thống khi lưu Phân Loại!');
  }
}
