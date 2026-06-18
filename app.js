let currentMulti = 1;

// 초기화
window.onload = async () => {
  await DB.init();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
  loadHome();
};

// 탭 네비게이션
function navigate(tab, btn) {
  document.querySelectorAll('.ni').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.sc').forEach(s => s.classList.remove('on'));
  document.getElementById('sc-' + tab).classList.add('on');
  
  if (tab === 'home') loadHome();
}

// 모달 제어
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.ov').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
});

// 관람 등록 모달 세팅
async function openRecordModal() {
  const shows = await DB.getAll('shows');
  const showSelect = document.getElementById('r-show');
  showSelect.innerHTML = shows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  
  document.getElementById('r-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('r-time').value = '';
  document.getElementById('r-cast').value = '';
  document.getElementById('r-seat').value = '';
  document.getElementById('r-memo').value = '';
  document.getElementById('r-image').value = '';
  selectMulti(1, document.querySelector('#r-multi .tgl'));
  
  openModal('m-record');
}

function selectMulti(val, btn) {
  currentMulti = val;
  document.querySelectorAll('#r-multi .tgl').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

// 기록 저장 로직
async function saveRecord() {
  const fileInput = document.getElementById('r-image');
  let imageBlob = null;
  
  if (fileInput.files.length > 0) {
    imageBlob = fileInput.files[0]; // 파일을 그대로 저장
  }

  const record = {
    id: Date.now().toString(),
    showId: document.getElementById('r-show').value,
    date: document.getElementById('r-date').value,
    time: document.getElementById('r-time').value,
    cast: document.getElementById('r-cast').value,
    seat: document.getElementById('r-seat').value,
    memo: document.getElementById('r-memo').value,
    multi: currentMulti,
    image: imageBlob
  };

  await DB.put('records', record);
  closeModal('m-record');
  loadHome();
}

// 홈 화면 렌더링 (다가올 관람)
async function loadHome() {
  const records = await DB.getAll('records');
  const shows = await DB.getAll('shows');
  const showMap = shows.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});
  
  const container = document.getElementById('home-ticket-list');
  container.innerHTML = records.map(r => {
    const imgUrl = r.image ? URL.createObjectURL(r.image) : './default-ticket.png';
    return `
      <div class="ticket-card">
        <div class="tk-dday">${r.date}</div>
        <div class="ticket-img-area" style="background-image: url('${imgUrl}')"></div>
        <div class="ticket-info">
          <div class="tk-title">${showMap[r.showId] || '알 수 없는 공연'}</div>
          <div class="tk-row"><span class="tk-label">일시</span> ${r.date} ${r.time}</div>
          <div class="tk-row"><span class="tk-label">캐스팅</span> ${r.cast || '미입력'}</div>
          <div class="tk-row"><span class="tk-label">좌석</span> ${r.seat || '자유석'}</div>
        </div>
      </div>
    `;
  }).join('');
}
