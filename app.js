let currentMulti = 1;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

window.onload = async () => {
  await DB.init();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  loadHome();
};

function navigate(tab, btn) {
  document.querySelectorAll('.ni').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.sc').forEach(s => s.classList.remove('on'));
  document.getElementById('sc-' + tab).classList.add('on');
  
  if (tab === 'home') loadHome();
  if (tab === 'cal') initCalendar();
  if (tab === 'stamp') loadStampTab();
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
const fileToBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result); reader.onerror = e => reject(e);
});

function getLocalDateStr(dateObj = new Date()) {
  const offset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

// ==========================================
// 1. 홈 (티켓 뷰 & 수정)
// ==========================================
async function loadHome() {
  const records = await DB.getAll('records');
  const shows = await DB.getAll('shows');
  const showMap = shows.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});
  
  const today = getLocalDateStr();
  const upcoming = records.filter(r => r.date >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
  const container = document.getElementById('home-ticket-list');

  if(upcoming.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:50px 20px; color:var(--mu);">다가올 일정이 없습니다.</div>';
    return;
  }

  container.innerHTML = upcoming.map(r => {
    let ddayStr = r.date === today ? 'TODAY' : 'D-' + Math.floor((new Date(r.date) - new Date(today)) / 86400000);
    let imgStyle = r.image ? `background-image: url('${r.image}')` : `background: var(--pll);`;
    return `
      <div class="ticket-origin">
        <div class="tk-img-part" style="${imgStyle}"></div>
        <div class="tk-info-part">
          <div class="tk-dday">${ddayStr}</div>
          <div class="tk-title">${showMap[r.showId] || '알 수 없음'}</div>
          <div class="tk-row"><span class="tk-label">일시</span> ${r.date} ${r.time}</div>
          <div class="tk-row"><span class="tk-label">캐스팅</span> ${r.cast || '-'}</div>
          <div class="tk-row"><span class="tk-label">좌석</span> ${r.seat || '-'}</div>
          <button class="tk-edit-btn" onclick="openRecordModal('${r.id}')">수정</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 2. 캘린더
// ==========================================
async function initCalendar() {
  const shows = await DB.getAll('shows');
  document.getElementById('filter-show').innerHTML = `<option value="all">모든 공연</option>` + shows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  updateActorFilter();
}

async function updateActorFilter() {
  const records = await DB.getAll('records');
  const selectedShow = document.getElementById('filter-show').value;
  let actors = new Set();
  records.forEach(r => {
    if ((selectedShow === 'all' || r.showId === selectedShow) && r.cast) r.cast.split(',').forEach(a => actors.add(a.trim()));
  });
  document.getElementById('filter-actor').innerHTML = `<option value="all">전체 배우</option>` + [...actors].map(a => `<option value="${a}">${a}</option>`).join('');
  loadCalendar();
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  loadCalendar();
}

async function loadCalendar() {
  document.getElementById('cal-month-label').textContent = `${currentYear}년 ${currentMonth + 1}월`;
  const records = await DB.getAll('records');
  const shows = await DB.getAll('shows');
  const selShow = document.getElementById('filter-show').value;
  const selActor = document.getElementById('filter-actor').value;

  const filtered = records.filter(r => {
    const mShow = selShow === 'all' || r.showId === selShow;
    const mActor = selActor === 'all' || (r.cast && r.cast.includes(selActor));
    return mShow && mActor;
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayStr = getLocalDateStr();
  
  let html = '';
  for(let i=0; i<firstDay; i++) html += `<div class="cal-cell" style="background:var(--bg);"></div>`;
  
  for(let d=1; d<=daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayRecords = filtered.filter(r => r.date === dateStr);
    
    const badges = dayRecords.map(r => {
      const sInfo = shows.find(s => s.id === r.showId) || { name: '알수없음', color: '#888' };
      return `<div class="cal-badge" style="background-color: ${sInfo.color};">${sInfo.name}</div>`;
    }).join('');
    
    let isToday = dateStr === todayStr ? 'background:var(--navy); color:#fff;' : '';
    html += `
      <div class="cal-cell" onclick="openRecordModal(null, '${dateStr}')">
        <div class="cal-date" style="${isToday}">${d}</div>
        <div style="width:100%;">${badges}</div>
      </div>
    `;
  }
  document.getElementById('calendar-grid').innerHTML = html;
}

// ==========================================
// 3. 공연 CRUD & 도장판 탭 연동
// ==========================================
function addRewardRow(n = '', label = '') {
  const container = document.getElementById('reward-rows-container');
  const row = document.createElement('div'); row.className = 'trow';
  row.innerHTML = `
    <input class="inp" type="number" placeholder="회차" min="1" style="width:70px; margin-bottom:0;" value="${n}">
    <input class="inp" type="text" placeholder="혜택 (예: 40% 할인권)" style="flex:1; margin-bottom:0;" value="${label}">
    <button class="rbtn" style="background:var(--mu2);" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

async function openShowModal(editId = null) {
  document.getElementById('reward-rows-container').innerHTML = '';
  const btnArea = document.getElementById('show-action-btns');

  if (editId) {
    document.getElementById('show-modal-title').textContent = '공연 수정';
    const shows = await DB.getAll('shows');
    const show = shows.find(s => s.id === editId);
    document.getElementById('edit-show-id').value = show.id;
    document.getElementById('add-show-name').value = show.name;
    document.getElementById('add-show-color-picker').value = show.color;
    document.getElementById('add-show-color-hex').value = show.color;
    (show.rewards || []).forEach(r => addRewardRow(r.n, r.label));
    btnArea.innerHTML = `
      <button class="mbtn d" onclick="deleteShow('${show.id}')">삭제</button>
      <button class="mbtn p" onclick="saveShow()">저장</button>
    `;
  } else {
    document.getElementById('show-modal-title').textContent = '새 공연 추가';
    document.getElementById('edit-show-id').value = '';
    document.getElementById('add-show-name').value = '';
    document.getElementById('add-show-color-picker').value = '#7C5CBF';
    document.getElementById('add-show-color-hex').value = '#7C5CBF';
    btnArea.innerHTML = `
      <button class="mbtn s" onclick="closeModal('m-show')">취소</button>
      <button class="mbtn p" onclick="saveShow()">추가하기</button>
    `;
  }
  openModal('m-show');
}

async function saveShow() {
  const idInput = document.getElementById('edit-show-id').value;
  const name = document.getElementById('add-show-name').value.trim();
  const color = document.getElementById('add-show-color-hex').value;
  if (!name) return alert('공연명을 입력해주세요.');

  const rewards = [];
  document.querySelectorAll('#reward-rows-container .trow').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value && inputs[1].value) rewards.push({ n: parseInt(inputs[0].value), label: inputs[1].value.trim() });
  });

  const showData = {
    id: idInput || Date.now().toString(),
    name, color, rewards,
    walletLogs: idInput ? (await DB.getAll('shows')).find(s => s.id === idInput).walletLogs || [] : []
  };

  await DB.put('shows', showData);
  closeModal('m-show');
  loadStampTab();
  if (idInput) showStampDetail(idInput); // Refresh detail if editing
}

async function deleteShow(id) {
  if(!confirm('이 공연과 관련된 모든 관람 기록이 삭제됩니다. 계속하시겠습니까?')) return;
  // IndexedDB delete logic
  const tx = dbInstance.transaction(['shows', 'records'], 'readwrite');
  tx.objectStore('shows').delete(id);
  const recStore = tx.objectStore('records');
  const records = await DB.getAll('records');
  records.filter(r => r.showId === id).forEach(r => recStore.delete(r.id));
  
  closeModal('m-show');
  loadStampTab();
}

async function loadStampTab() {
  const shows = await DB.getAll('shows');
  const listArea = document.getElementById('stamp-list-area');
  document.getElementById('stamp-detail-area').style.display = 'none';
  listArea.style.display = 'block';

  if(shows.length === 0) return listArea.innerHTML = '<div style="text-align:center; color:var(--mu);">등록된 공연이 없습니다.</div>';

  listArea.innerHTML = shows.map(s => `
    <div class="ticket-origin" style="padding: 16px; align-items:center; cursor:pointer;" onclick="showStampDetail('${s.id}')">
      <div style="width:16px; height:16px; border-radius:50%; background:${s.color}; margin-right:12px;"></div>
      <div style="font-weight:800; color:var(--navy); flex:1;">${s.name}</div>
    </div>
  `).join('');
}

// 다크 테마 지갑 상세 뷰 렌더링
async function showStampDetail(showId) {
  const shows = await DB.getAll('shows');
  const records = await DB.getAll('records');
  const show = shows.find(s => s.id === showId);
  const showRecords = records.filter(r => r.showId === showId);
  
  // 총 도장 수 계산
  const totalStamps = showRecords.reduce((sum, r) => sum + (Number(r.multi)||1), 0);
  
  // 지갑 데이터 계산
  const walletMap = {};
  (show.rewards || []).forEach(r => {
    walletMap[r.label] = { 
      earned: Math.floor(totalStamps / r.n), // 조건 달성 시 획득량
      used: showRecords.filter(rec => rec.usedDiscount === r.label).length, // 사용한 기록 수
      manualAdd: 0, manualSub: 0 
    };
  });
  
  // 수동 조작 합산
  (show.walletLogs || []).forEach(log => {
    if(!walletMap[log.label]) walletMap[log.label] = { earned:0, used:0, manualAdd:0, manualSub:0 };
    if(log.type === 'add') walletMap[log.label].manualAdd += log.amount;
    if(log.type === 'sub') walletMap[log.label].manualSub += log.amount;
  });

  // UI 조립: 재관람 혜택 목록
  const rewardsText = (show.rewards || []).map(r => `• ${r.n}회 관람 시 : ${r.label}`).join('<br>') || '설정된 혜택 없음';

  // UI 조립: 지갑 현황 카드
  let walletHtml = '';
  Object.keys(walletMap).forEach(label => {
    const stat = walletMap[label];
    const finalTotal = stat.earned + stat.manualAdd;
    const finalUsed = stat.used + stat.manualSub;
    const current = finalTotal - finalUsed;
    walletHtml += `
      <div class="wallet-card">
        <div class="wc-head">${label}</div>
        <div class="wc-body">
          <div class="wc-stat"><span class="lbl">현재</span><span class="val">${current}</span></div>
          <div class="wc-stat"><span class="lbl">최종</span><span class="val">${finalTotal}</span></div>
        </div>
      </div>
    `;
  });

  // UI 조립: 도장판 현황 (판별 분리)
  const maxReward = (show.rewards && show.rewards.length > 0) ? Math.max(...show.rewards.map(r=>r.n)) : 10; // 기본 10판
  const boardSize = maxReward;
  const currentBoardIdx = Math.floor(totalStamps / boardSize) + 1;
  const currentBoardStamps = totalStamps % boardSize;
  const remaining = boardSize - currentBoardStamps;

  const boardHtml = `
    <div class="board-card">
      <div class="board-head">
        <span style="color:#fff; font-weight:700;">${currentBoardIdx}번째 도장판</span>
        <span>다음 혜택까지 ${remaining}개 남음</span>
      </div>
      <div style="font-size:12px; color:#8F9BB3;">현재 ${currentBoardStamps} / 최종 ${totalStamps}</div>
      <div class="board-progress"><div class="board-fill" style="width: ${(currentBoardStamps/boardSize)*100}%"></div></div>
    </div>
  `;

  document.getElementById('stamp-list-area').style.display = 'none';
  const detailArea = document.getElementById('stamp-detail-area');
  detailArea.style.display = 'block';
  
  detailArea.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
      <button class="rbtn dark" onclick="loadStampTab()">← 목록</button>
      <button class="rbtn dark" onclick="openShowModal('${show.id}')">설정(수정)</button>
    </div>

    <div class="dark-box">
      <div class="d-title">🎁 재관람 혜택</div>
      <div style="font-size:12px; color:#8F9BB3; line-height:1.6;">${rewardsText}</div>
    </div>

    <div class="dark-box">
      <div class="d-title">지갑 현황 <button class="rbtn dark" onclick="openWalletModal('${show.id}')">+ 추가/차감</button></div>
      <div class="wallet-grid">${walletHtml || '<div style="color:#8F9BB3; font-size:12px;">내역 없음</div>'}</div>
    </div>

    <div class="dark-box">
      <div class="d-title">도장판 현황</div>
      ${boardHtml}
    </div>
  `;
}

// ==========================================
// 4. 지갑 수동 제어 모달
// ==========================================
async function openWalletModal(showId) {
  const shows = await DB.getAll('shows');
  const show = shows.find(s => s.id === showId);
  document.getElementById('w-show-id').value = showId;
  
  const labels = show.rewards ? show.rewards.map(r => r.label) : [];
  if(labels.length === 0) return alert('설정된 도장판 혜택이 없어 조작할 수 없습니다. 공연 설정을 먼저 수정하세요.');
  
  document.getElementById('w-label').innerHTML = labels.map(l => `<option value="${l}">${l}</option>`).join('');
  document.getElementById('w-amount').value = 1;
  openModal('m-wallet');
}

async function saveWalletManual() {
  const showId = document.getElementById('w-show-id').value;
  const label = document.getElementById('w-label').value;
  const type = document.getElementById('w-type').value;
  const amount = parseInt(document.getElementById('w-amount').value);

  const shows = await DB.getAll('shows');
  const show = shows.find(s => s.id === showId);
  if(!show.walletLogs) show.walletLogs = [];
  
  show.walletLogs.push({ id: Date.now().toString(), label, type, amount });
  await DB.put('shows', show);
  
  closeModal('m-wallet');
  showStampDetail(showId);
}

// ==========================================
// 5. 관람 기록 추가/수정 모달 연동
// ==========================================
function selectMulti(val, btn) {
  currentMulti = val;
  document.querySelectorAll('#r-multi .tgl').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

// 공연 선택 시 해당 공연의 도장판/할인권 종 업데이트
async function updateRecordFormDeps(selectedDiscount = '') {
  const showId = document.getElementById('r-show').value;
  if(!showId) return;
  const shows = await DB.getAll('shows');
  const show = shows.find(s => s.id === showId);
  
  const discSel = document.getElementById('r-discount');
  const opts = `<option value="">사용 안 함</option>` + (show.rewards || []).map(r => `<option value="${r.label}">${r.label}</option>`).join('');
  discSel.innerHTML = opts;
  if(selectedDiscount) discSel.value = selectedDiscount;

  // 도장판은 단순히 시각적 구분을 위해 기본값 제공
  document.getElementById('r-pad').innerHTML = `<option value="auto">자동 누적 판</option>`;
}

async function openRecordModal(editId = null, defaultDate = null) {
  const shows = await DB.getAll('shows');
  if (shows.length === 0) return alert('공연을 먼저 추가해주세요.');

  document.getElementById('r-show').innerHTML = shows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const btnArea = document.getElementById('record-action-btns');

  if (editId) {
    document.getElementById('record-modal-title').textContent = '관람 기록 수정';
    const records = await DB.getAll('records');
    const r = records.find(x => x.id === editId);
    
    document.getElementById('edit-record-id').value = r.id;
    document.getElementById('r-show').value = r.showId;
    document.getElementById('r-date').value = r.date;
    document.getElementById('r-time').value = r.time || '';
    document.getElementById('r-cast').value = r.cast || '';
    document.getElementById('r-seat').value = r.seat || '';
    document.getElementById('r-memo').value = r.memo || '';
    document.getElementById('r-image-preview').textContent = r.image ? '(기존 이미지가 유지됩니다. 새로 첨부 시 교체)' : '';
    selectMulti(r.multi || 1, document.querySelectorAll('#r-multi .tgl')[r.multi ? r.multi-1 : 0]);
    
    await updateRecordFormDeps(r.usedDiscount);
    
    btnArea.innerHTML = `
      <button class="mbtn d" onclick="deleteRecord('${r.id}')">삭제</button>
      <button class="mbtn p" onclick="saveRecord()">저장</button>
    `;
  } else {
    document.getElementById('record-modal-title').textContent = '새 관람 등록';
    document.getElementById('edit-record-id').value = '';
    document.getElementById('r-date').value = defaultDate || getLocalDateStr();
    document.getElementById('r-time').value = '';
    document.getElementById('r-cast').value = '';
    document.getElementById('r-seat').value = '';
    document.getElementById('r-memo').value = '';
    document.getElementById('r-image').value = '';
    document.getElementById('r-image-preview').textContent = '';
    selectMulti(1, document.querySelectorAll('#r-multi .tgl')[0]);
    
    await updateRecordFormDeps();

    btnArea.innerHTML = `
      <button class="mbtn s" onclick="closeModal('m-record')">취소</button>
      <button class="mbtn p" onclick="saveRecord()">등록하기</button>
    `;
  }
  openModal('m-record');
}

async function saveRecord() {
  const idInput = document.getElementById('edit-record-id').value;
  const fileInput = document.getElementById('r-image');
  let base64Image = null;
  
  if (fileInput.files.length > 0) {
    base64Image = await fileToBase64(fileInput.files[0]);
  } else if (idInput) {
    // 수정 시 기존 이미지 유지
    const records = await DB.getAll('records');
    const existing = records.find(r => r.id === idInput);
    if(existing) base64Image = existing.image;
  }

  const recordData = {
    id: idInput || Date.now().toString(),
    showId: document.getElementById('r-show').value,
    date: document.getElementById('r-date').value,
    time: document.getElementById('r-time').value,
    cast: document.getElementById('r-cast').value,
    usedDiscount: document.getElementById('r-discount').value,
    seat: document.getElementById('r-seat').value,
    memo: document.getElementById('r-memo').value,
    multi: currentMulti,
    image: base64Image
  };

  await DB.put('records', recordData);
  closeModal('m-record');
  
  // 현재 떠있는 화면 리로드
  if(document.getElementById('sc-cal').classList.contains('on')) loadCalendar();
  else loadHome();
}

async function deleteRecord(id) {
  if(!confirm('이 기록을 삭제할까요? (차감/적립된 혜택 개수도 복구됩니다)')) return;
  const tx = dbInstance.transaction('records', 'readwrite');
  tx.objectStore('records').delete(id);
  closeModal('m-record');
  if(document.getElementById('sc-cal').classList.contains('on')) loadCalendar();
  else loadHome();
}

// 백업 기능 생략 (이전 코드와 동일 유지)
async function exportData() {
  const shows = await DB.getAll('shows');
  const records = await DB.getAll('records');
  const data = JSON.stringify({ shows, records });
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tracker_backup.json`;
  a.click();
}
async function importData(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if(data.shows) for(let s of data.shows) await DB.put('shows', s);
      if(data.records) for(let r of data.records) await DB.put('records', r);
      alert('복원 완료!'); loadHome();
    } catch(err) { alert('오류 발생'); }
  };
  reader.readAsText(file);
}
