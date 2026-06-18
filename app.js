let currentMulti = 1;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

window.onload = async () => {
  await DB.init();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  loadHome();
};

// 탭 네비게이션
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
document.querySelectorAll('.ov').forEach(o => { o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); }); });

// 파일 Base64 변환 (백업/복원을 위해)
const fileToBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

// ==========================================
// 1. 홈 (다가올 일정)
// ==========================================
async function loadHome() {
  const records = await DB.getAll('records');
  const shows = await DB.getAll('shows');
  const showMap = shows.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});
  
  const today = new Date().toISOString().split('T')[0];
  const upcoming = records.filter(r => r.date >= today).sort((a, b) => new Date(a.date) - new Date(b.date));

  const container = document.getElementById('home-ticket-list');
  if(upcoming.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:50px 20px; color:var(--mu);">다가올 일정이 없습니다.</div>';
    return;
  }

  container.innerHTML = upcoming.map(r => {
    let ddayStr = r.date === today ? 'TODAY' : 'D-' + Math.floor((new Date(r.date) - new Date(today)) / 86400000);
    let imgStyle = r.image ? `background-image: url('${r.image}')` : `background: var(--pll); display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--mu);`;
    let noImgText = r.image ? '' : '첨부된 내역서 없음';

    return `
      <div class="ticket-card">
        <div class="tk-dday">${ddayStr}</div>
        <div class="ticket-img-area" style="${imgStyle}">${noImgText}</div>
        <div class="ticket-info">
          <div class="tk-title">${showMap[r.showId] || '삭제된 공연'}</div>
          <div class="tk-row"><span class="tk-label">일시</span> ${r.date} ${r.time}</div>
          <div class="tk-row"><span class="tk-label">캐스팅</span> ${r.cast || '-'}</div>
          <div class="tk-row"><span class="tk-label">좌석</span> ${r.seat || '-'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 2. 캘린더 & 필터
// ==========================================
async function initCalendar() {
  const shows = await DB.getAll('shows');
  const showSelect = document.getElementById('filter-show');
  showSelect.innerHTML = `<option value="all">모든 공연</option>` + shows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  updateActorFilter();
}

async function updateActorFilter() {
  const records = await DB.getAll('records');
  const selectedShow = document.getElementById('filter-show').value;
  
  let actors = new Set();
  records.forEach(r => {
    if ((selectedShow === 'all' || r.showId === selectedShow) && r.cast) {
      r.cast.split(',').forEach(a => actors.add(a.trim()));
    }
  });

  const actorSelect = document.getElementById('filter-actor');
  actorSelect.innerHTML = `<option value="all">모든 캐스팅</option>` + [...actors].map(a => `<option value="${a}">${a}</option>`).join('');
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
  
  const selectedShow = document.getElementById('filter-show').value;
  const selectedActor = document.getElementById('filter-actor').value;

  const filtered = records.filter(r => {
    const matchShow = selectedShow === 'all' || r.showId === selectedShow;
    const matchActor = selectedActor === 'all' || (r.cast && r.cast.includes(selectedActor));
    return matchShow && matchActor;
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];
  
  let html = '';
  for(let i=0; i<firstDay; i++) html += `<div class="cal-cell" style="background:var(--bg);"></div>`;
  
  for(let d=1; d<=daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayRecords = filtered.filter(r => r.date === dateStr);
    
    const badges = dayRecords.map(r => {
      const sInfo = shows.find(s => s.id === r.showId) || { name: '알수없음', color: '#888' };
      return `<div class="cal-badge" style="background-color: ${sInfo.color};">${sInfo.name}</div>`;
    }).join('');
    
    let dateStyle = dateStr === todayStr ? 'background:var(--navy); color:#fff;' : '';
    html += `
      <div class="cal-cell" onclick="openRecordModal('${dateStr}')">
        <div class="cal-date" style="${dateStyle}">${d}</div>
        <div style="width:100%; display:flex; flex-direction:column; gap:2px;">${badges}</div>
      </div>
    `;
  }
  document.getElementById('calendar-grid').innerHTML = html;
}

// ==========================================
// 3. 공연 및 도장판 추가
// ==========================================
function addRewardRow() {
  const container = document.getElementById('reward-rows-container');
  const row = document.createElement('div');
  row.className = 'trow';
  row.innerHTML = `
    <input class="inp" type="number" placeholder="회차" min="1" style="width:70px; margin-bottom:0;">
    <input class="inp" type="text" placeholder="혜택 (예: 40% 할인권)" style="flex:1; margin-bottom:0;">
    <button class="rbtn" style="background:var(--mu2);" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

async function saveShow() {
  const name = document.getElementById('add-show-name').value.trim();
  const color = document.getElementById('add-show-color').value;
  if (!name) return alert('공연명을 입력해주세요.');

  const rewards = [];
  document.querySelectorAll('#reward-rows-container .trow').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value && inputs[1].value) {
      rewards.push({ n: parseInt(inputs[0].value), label: inputs[1].value.trim() });
    }
  });

  await DB.put('shows', { id: Date.now().toString(), name, color, rewards });
  closeModal('m-add-show');
  loadStampTab();
}

async function loadStampTab() {
  const shows = await DB.getAll('shows');
  const records = await DB.getAll('records');
  const listArea = document.getElementById('stamp-list-area');
  const detailArea = document.getElementById('stamp-detail-area');
  
  detailArea.style.display = 'none';
  listArea.style.display = 'block';

  if(shows.length === 0) {
    listArea.innerHTML = '<div style="text-align:center; color:var(--mu);">등록된 공연이 없습니다.</div>';
    return;
  }

  listArea.innerHTML = shows.map(s => {
    const count = records.filter(r => r.showId === s.id).reduce((sum, r) => sum + r.multi, 0);
    return `
      <div class="show-item" onclick="showStampDetail('${s.id}')">
        <div class="color-dot" style="background:${s.color}"></div>
        <div style="flex:1;">${s.name}</div>
        <div style="font-size:12px; color:var(--mu);">도장 ${count}개</div>
      </div>
    `;
  }).join('');
}

async function showStampDetail(showId) {
  const shows = await DB.getAll('shows');
  const records = await DB.getAll('records');
  const show = shows.find(s => s.id === showId);
  const showRecords = records.filter(r => r.showId === showId);
  const count = showRecords.reduce((sum, r) => sum + r.multi, 0);

  const rewardsHtml = (show.rewards || []).map(r => {
    const isDone = count >= r.n;
    return `
      <div class="rew-item" style="background: ${isDone ? 'var(--pll)' : 'var(--bg)'}">
        <span style="font-weight:700; color:${isDone ? 'var(--navy)' : 'var(--mu)'}">${r.n}회</span>
        <span>${r.label}</span>
        <span style="color:${isDone ? 'var(--navy)' : 'var(--mu2)'}">${isDone ? '✓ 달성' : '미달성'}</span>
      </div>
    `;
  }).join('');

  document.getElementById('stamp-list-area').style.display = 'none';
  const detailArea = document.getElementById('stamp-detail-area');
  detailArea.style.display = 'block';
  detailArea.innerHTML = `
    <button class="rbtn" style="background:var(--bg); color:var(--mu); margin-bottom:14px;" onclick="loadStampTab()">← 목록으로</button>
    <h3 style="color:var(--navy); margin-bottom:16px;">${show.name} 혜택 현황</h3>
    <div style="font-size:14px; font-weight:700; margin-bottom:10px;">누적 도장: ${count}개</div>
    ${rewardsHtml || '<div style="color:var(--mu); font-size:13px;">설정된 혜택이 없습니다.</div>'}
  `;
}

// ==========================================
// 4. 관람 기록 (수동)
// ==========================================
function selectMulti(val, btn) {
  currentMulti = val;
  document.querySelectorAll('#r-multi .tgl').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

async function openRecordModal(defaultDate = null) {
  const shows = await DB.getAll('shows');
  if (shows.length === 0) return alert('공연을 먼저 추가해주세요.');

  document.getElementById('r-show').innerHTML = shows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('r-date').value = defaultDate || new Date().toISOString().split('T')[0];
  document.getElementById('r-time').value = '';
  document.getElementById('r-cast').value = '';
  document.getElementById('r-seat').value = '';
  document.getElementById('r-memo').value = '';
  document.getElementById('r-image').value = '';
  selectMulti(1, document.querySelector('#r-multi .tgl'));
  
  openModal('m-record');
}

async function saveRecord() {
  const fileInput = document.getElementById('r-image');
  let base64Image = null;
  if (fileInput.files.length > 0) base64Image = await fileToBase64(fileInput.files[0]);

  await DB.put('records', {
    id: Date.now().toString(),
    showId: document.getElementById('r-show').value,
    date: document.getElementById('r-date').value,
    time: document.getElementById('r-time').value,
    cast: document.getElementById('r-cast').value,
    seat: document.getElementById('r-seat').value,
    memo: document.getElementById('r-memo').value,
    multi: currentMulti,
    image: base64Image
  });

  closeModal('m-record');
  loadHome();
}

// ==========================================
// 5. 백업 및 복원 (설정 탭)
// ==========================================
async function exportData() {
  const shows = await DB.getAll('shows');
  const records = await DB.getAll('records');
  const data = JSON.stringify({ shows, records });
  
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
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
      alert('데이터 복원이 완료되었습니다!');
      loadHome();
    } catch(err) { alert('파일을 읽는 중 오류가 발생했습니다.'); }
  };
  reader.readAsText(file);
}
