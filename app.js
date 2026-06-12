/* ==========================================================================
   GLOBAL APP STATE
   ========================================================================== */
let state = {
  currentUser: null,
  selectedSpot: null,
  allowedApps: [
    { id: 'kakaotalk', name: '카카오톡', icon: 'fa-regular fa-comment', color: '#FEE500', bg: '#3C1E1E', allowed: false },
    { id: 'notion', name: '노션', icon: 'fa-solid fa-note-sticky', color: '#ffffff', bg: '#000000', allowed: true },
    { id: 'youtube', name: '유튜브', icon: 'fa-brands fa-youtube', color: '#FF0000', bg: '#2b0000', allowed: false },
    { id: 'instagram', name: '인스타그램', icon: 'fa-brands fa-instagram', color: '#E1306C', bg: '#2f0b18', allowed: false },
    { id: 'safari', name: '사파리/크롬', icon: 'fa-solid fa-compass', color: '#3498db', bg: '#0b202e', allowed: false },
    { id: 'zoom', name: '줌 (Zoom)', icon: 'fa-solid fa-video', color: '#2D8CFF', bg: '#0b1d33', allowed: true },
    { id: 'slack', name: '슬랙 (Slack)', icon: 'fa-brands fa-slack', color: '#4A154B', bg: '#1c071c', allowed: false },
    { id: 'everytime', name: '에브리타임', icon: 'fa-solid fa-square-rss', color: '#FF3B30', bg: '#2f0c0a', allowed: false },
    { id: 'ku_portal', name: '고대포탈', icon: 'fa-solid fa-building-columns', color: '#8A1F16', bg: '#250906', allowed: true }
  ],
  timer: {
    seconds: 0,
    intervalId: null,
    isRunning: false,
    activeSpotId: null
  },
  sessions: [],
  charts: {
    weekly: null,
    spots: null
  }
};

// 7일간의 날짜 라벨 획득
function getLast7DaysLabels() {
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return labels;
}

// 가상의 초기 모의 학습 세션 데이터
const MOCK_SESSIONS = [
  { date: '6/6', spotId: 'sk_basement', duration: 3600 },
  { date: '6/7', spotId: 'central_library', duration: 7200 },
  { date: '6/8', spotId: 'centennial', duration: 5400 },
  { date: '6/9', spotId: 'sk_carrel', duration: 10800 },
  { date: '6/10', spotId: 'west_hall_reading', duration: 4200 },
  { date: '6/11', spotId: 'intl_3_4', duration: 2400 }
];

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // 1. LocalStorage에서 사용자 및 세션 데이터 로드
  const storedUser = localStorage.getItem('godae_user');
  const storedSessions = localStorage.getItem('godae_sessions');
  const storedApps = localStorage.getItem('godae_allowed_apps');
  
  if (storedSessions) {
    state.sessions = JSON.parse(storedSessions);
  } else {
    state.sessions = [...MOCK_SESSIONS];
    localStorage.setItem('godae_sessions', JSON.stringify(state.sessions));
  }

  if (storedApps) {
    state.allowedApps = JSON.parse(storedApps);
  }

  // 2. 이벤트 리스너 바인딩
  bindEvents();

  // 3. UI 렌더링
  renderSpotsList();
  renderMapPins();
  renderAppsSetup();

  // 4. 로그인 체크 및 첫 뷰 진입
  if (storedUser) {
    state.currentUser = JSON.parse(storedUser);
    document.getElementById('user-display-name').textContent = state.currentUser.name;
    document.getElementById('profile-name').textContent = state.currentUser.name;
    document.getElementById('main-header').classList.remove('hidden');
    showView('view-map');
    showToast('success', `${state.currentUser.name}님, 환영합니다!`);
  } else {
    showView('view-login');
  }
}

/* ==========================================================================
   EVENT BINDINGS
   ========================================================================== */
function bindEvents() {
  // 로그인 / 회원가입 탭 전환
  const toggleLogin = document.getElementById('toggle-login');
  const toggleRegister = document.getElementById('toggle-register');
  const groupName = document.getElementById('group-name');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');

  toggleLogin.addEventListener('click', () => {
    toggleLogin.classList.add('active');
    toggleRegister.classList.remove('active');
    groupName.style.display = 'none';
    btnAuthSubmit.textContent = '로그인';
  });

  toggleRegister.addEventListener('click', () => {
    toggleRegister.classList.add('active');
    toggleLogin.classList.remove('active');
    groupName.style.display = 'flex';
    btnAuthSubmit.textContent = '회원가입';
  });

  // 인증 폼 제출
  const authForm = document.getElementById('auth-form');
  authForm.addEventListener('submit', handleAuthSubmit);

  // 로그아웃 버튼
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // 네비게이션 탭 전환
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      showView(target);
    });
  });

  // 명당 검색 필터
  const searchInput = document.getElementById('search-spot-input');
  searchInput.addEventListener('input', (e) => {
    renderSpotsList(e.target.value);
  });

  // 상세 카드 닫기
  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('spot-detail-panel').classList.add('hidden');
    // 지도 핀과 카드 리스트 하이라이트 해제
    document.querySelectorAll('.map-pin').forEach(pin => pin.classList.remove('active'));
    document.querySelectorAll('.spot-item-card').forEach(card => card.classList.remove('active'));
  });

  // 상세 카드 내부: 혼잡도 새로고침
  document.getElementById('btn-refresh-congestion').addEventListener('click', () => {
    if (state.selectedSpot) {
      const statuses = ["여유", "보통", "혼잡"];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      state.selectedSpot.congestion = randomStatus;
      
      // 데이터 동기화
      const dataSpot = STUDY_SPOTS.find(s => s.id === state.selectedSpot.id);
      if (dataSpot) dataSpot.congestion = randomStatus;
      
      // UI 갱신
      updateCongestionUI(randomStatus);
      renderSpotsList(searchInput.value);
      renderMapPins();
      showToast('info', `${state.selectedSpot.name}의 혼잡도를 갱신했습니다.`);
    }
  });

  // 상세 카드 내부: 여기서 공부 시작하기
  document.getElementById('btn-start-here').addEventListener('click', () => {
    if (state.selectedSpot) {
      state.timer.activeSpotId = state.selectedSpot.id;
      showToast('info', `${state.selectedSpot.name}이 공부 장소로 선택되었습니다.`);
      showView('view-timer');
    }
  });

  // 허용 앱 변경 버튼 (타이머 탭 내부)
  document.getElementById('btn-edit-apps-from-timer').addEventListener('click', () => {
    showView('view-app-setup');
  });

  // 허용 앱 저장 완료 및 타이머 이동
  document.getElementById('btn-save-apps').addEventListener('click', () => {
    localStorage.setItem('godae_allowed_apps', JSON.stringify(state.allowedApps));
    showToast('success', '집중 허용 앱 설정이 저장되었습니다.');
    showView('view-timer');
  });

  // 타이머 작동 제어 (시작 / 일시정지)
  document.getElementById('btn-timer-toggle').addEventListener('click', toggleTimer);

  // 타이머 공부 중단 / 완료
  document.getElementById('btn-timer-stop').addEventListener('click', stopTimerConfirm);

  // 비허용 앱 시뮬레이션 실행 버튼
  document.getElementById('btn-simulate-unauthorized').addEventListener('click', () => {
    if (!state.timer.isRunning) {
      showToast('warning', '타이머가 작동 중일 때만 비허용 앱 접근 차단이 실행됩니다.');
      return;
    }
    const overlayScreen = document.getElementById('focus-overlay-screen');
    overlayScreen.classList.remove('hidden');
    startTimerMockNotif();
    showToast('warning', '비허용 앱 사용이 감지되어 강제 차단 화면을 구동합니다.');
  });

  // 오버레이 화면 닫기 (공부 화면 복귀)
  document.getElementById('btn-close-focus-overlay').addEventListener('click', () => {
    const overlayScreen = document.getElementById('focus-overlay-screen');
    overlayScreen.classList.add('hidden');
    stopTimerMockNotif();
    showToast('success', '공부 화면으로 복귀했습니다.');
  });

  // 백색소음 테마 클릭 제어
  const soundTracks = document.querySelectorAll('.ambient-track-btn');
  soundTracks.forEach(btn => {
    btn.addEventListener('click', () => {
      const soundType = btn.getAttribute('data-sound');
      const volume = parseFloat(document.getElementById('ambient-volume').value);
      
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        window.focusAudio.stop();
        document.getElementById('ambient-status').textContent = '정지됨';
      } else {
        soundTracks.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.focusAudio.play(soundType, volume);
        document.getElementById('ambient-status').textContent = `${btn.querySelector('span').textContent} 재생 중`;
      }
    });
  });

  // 백색소음 볼륨 조절
  document.getElementById('ambient-volume').addEventListener('input', (e) => {
    window.focusAudio.setVolume(parseFloat(e.target.value));
  });

  // 건물 그룹 클릭 시 지도 줌 효과 시뮬레이션 및 첫 번째 명당 선택
  const buildingGroups = document.querySelectorAll('.map-building-group:not(.deco)');
  buildingGroups.forEach(group => {
    group.addEventListener('click', () => {
      const buildingName = group.getAttribute('data-building');
      const spot = STUDY_SPOTS.find(s => s.building === buildingName);
      if (spot) {
        selectSpot(spot.id);
      }
    });
  });
}

/* ==========================================================================
   AUTHENTICATION LOGIC (LOCALSTORAGE SIMULATED)
   ========================================================================== */
function handleAuthSubmit(e) {
  e.preventDefault();
  
  const isRegister = document.getElementById('toggle-register').classList.contains('active');
  const authId = document.getElementById('auth-id').value.trim();
  const authPw = document.getElementById('auth-pw').value;
  const name = document.getElementById('reg-name').value.trim();

  if (isRegister) {
    if (!name) {
      showToast('warning', '이름을 입력해주세요.');
      return;
    }
    // 회원가입 정보 로컬 저장
    const newUser = { id: authId, name: name };
    localStorage.setItem(`godae_account_${authId}`, JSON.stringify({ id: authId, pw: authPw, name: name }));
    localStorage.setItem('godae_user', JSON.stringify(newUser));
    state.currentUser = newUser;
    
    showToast('success', '회원가입이 완료되었습니다!');
  } else {
    // 로그인 검사
    const accountStr = localStorage.getItem(`godae_account_${authId}`);
    if (authId === 'portal_id' || authId === 'admin') { // 개발자 모드 프리패스
      const defaultUser = { id: authId, name: '고대생' };
      localStorage.setItem('godae_user', JSON.stringify(defaultUser));
      state.currentUser = defaultUser;
    } else if (accountStr) {
      const account = JSON.parse(accountStr);
      if (account.pw === authPw) {
        const loggedUser = { id: account.id, name: account.name };
        localStorage.setItem('godae_user', JSON.stringify(loggedUser));
        state.currentUser = loggedUser;
      } else {
        showToast('warning', '비밀번호가 일치하지 않습니다.');
        return;
      }
    } else {
      // 계정이 없을 경우 임시 자동 생성 로그인 지원 (테스트 편의성 제공)
      const autoUser = { id: authId, name: authId.split('@')[0] };
      localStorage.setItem('godae_user', JSON.stringify(autoUser));
      state.currentUser = autoUser;
    }
    showToast('success', '성공적으로 로그인되었습니다.');
  }

  // UI 헤더 업데이트 및 뷰 전환
  document.getElementById('user-display-name').textContent = state.currentUser.name;
  document.getElementById('profile-name').textContent = state.currentUser.name;
  document.getElementById('main-header').classList.remove('hidden');
  
  // 입력 필드 초기화
  authForm.reset();
  
  showView('view-map');
}

function handleLogout() {
  localStorage.removeItem('godae_user');
  state.currentUser = null;
  
  // 타이머 작동중이면 종료
  if (state.timer.isRunning) {
    clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
  }
  window.focusAudio.stop();

  document.getElementById('main-header').classList.add('hidden');
  showView('view-login');
  showToast('info', '로그아웃 되었습니다.');
}

/* ==========================================================================
   VIEW NAVIGATION CONTROL
   ========================================================================== */
function showView(viewId) {
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => {
    if (sec.id === viewId) {
      sec.classList.remove('hidden');
      sec.classList.add('active');
    } else {
      sec.classList.add('hidden');
      sec.classList.remove('active');
    }
  });

  // 네비게이션 탭 버튼 활성화 업데이트
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    if (btn.getAttribute('data-target') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 특정 뷰 진입시 부가 동작 처리
  if (viewId === 'view-timer') {
    updateTimerTabDetails();
  } else if (viewId === 'view-stats') {
    renderStatsDashboard();
  }
}

/* ==========================================================================
   MAP & STUDY SPOTS RENDERING & SEARCH
   ========================================================================== */
function renderSpotsList(query = '') {
  const listContainer = document.getElementById('spot-list');
  listContainer.innerHTML = '';
  
  const filteredSpots = STUDY_SPOTS.filter(spot => {
    const q = query.toLowerCase();
    return spot.name.toLowerCase().includes(q) || 
           spot.building.toLowerCase().includes(q) ||
           spot.tags.some(tag => tag.toLowerCase().includes(q));
  });

  document.getElementById('spot-count-badge').textContent = filteredSpots.length;

  if (filteredSpots.length === 0) {
    listContainer.innerHTML = `<p class="no-spot-selected-msg">검색 결과가 없습니다.</p>`;
    return;
  }

  filteredSpots.forEach(spot => {
    const card = document.createElement('div');
    card.className = `spot-item-card ${state.selectedSpot && state.selectedSpot.id === spot.id ? 'active' : ''}`;
    card.setAttribute('data-id', spot.id);
    
    // 혼잡도에 따른 클래스명 설정
    let congestionClass = 'green';
    if (spot.congestion === '보통') congestionClass = 'yellow';
    if (spot.congestion === '혼잡') congestionClass = 'red';

    card.innerHTML = `
      <div class="spot-card-top">
        <div>
          <h4>${spot.name}</h4>
          <span class="building-tag"><i class="fa-solid fa-building"></i> ${spot.building} • ${spot.location}</span>
        </div>
        <span class="badge-mini congestion ${congestionClass}">${spot.congestion}</span>
      </div>
      <div class="spot-badges">
        ${spot.tags.slice(0, 3).map(tag => `<span class="badge-mini neutral">${tag}</span>`).join('')}
      </div>
    `;

    card.addEventListener('click', () => selectSpot(spot.id));
    listContainer.appendChild(card);
  });
}

function renderMapPins() {
  const pinsContainer = document.getElementById('map-pins-container');
  pinsContainer.innerHTML = '';

  STUDY_SPOTS.forEach(spot => {
    // SVG 핀 그룹 생성 (정적이며 통일성 있는 크림슨 컬러 적용)
    const pinG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pinG.setAttribute('class', `map-pin ${state.selectedSpot && state.selectedSpot.id === spot.id ? 'active' : ''}`);
    pinG.setAttribute('id', `pin-${spot.id}`);
    pinG.setAttribute('transform', `translate(${spot.coords.x}, ${spot.coords.y})`);
    
    pinG.innerHTML = `
      <!-- Static Crimson Map Pin -->
      <path d="M0 -14 C-6 -14, -10 -10, -10 -4 C-10 4, 0 14, 0 14 C0 14, 10 4, 10 -4 C10 -10, 6 -14, 0 -14 Z" fill="var(--color-primary)" stroke="#fff" stroke-width="1.5" />
      <circle cx="0" cy="-4" r="3.5" fill="#fff" />
    `;

    // 핀 툴팁 생성
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${spot.name} (${spot.congestion})`;
    pinG.appendChild(title);

    pinG.addEventListener('click', (e) => {
      e.stopPropagation();
      selectSpot(spot.id);
    });

    pinsContainer.appendChild(pinG);
  });
}

function selectSpot(spotId) {
  const spot = STUDY_SPOTS.find(s => s.id === spotId);
  if (!spot) return;

  state.selectedSpot = spot;

  // 1. 리스트 카드 액티브 상태 부여
  document.querySelectorAll('.spot-item-card').forEach(card => {
    if (card.getAttribute('data-id') === spotId) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      card.classList.remove('active');
    }
  });

  // 2. 지도 핀 액티브 상태 부여
  document.querySelectorAll('.map-pin').forEach(pin => {
    if (pin.getAttribute('id') === `pin-${spotId}`) {
      pin.classList.add('active');
    } else {
      pin.classList.remove('active');
    }
  });

  // 3. 디테일 팝업 노출 및 데이터 반영
  showSpotDetail(spot);
}

function showSpotDetail(spot) {
  const panel = document.getElementById('spot-detail-panel');
  panel.classList.remove('hidden');

  document.getElementById('detail-building-name').textContent = spot.building;
  document.getElementById('detail-spot-name').textContent = spot.name;
  document.getElementById('detail-desc').textContent = spot.description;
  document.getElementById('detail-outlets').textContent = spot.outlets;
  document.getElementById('detail-hours').textContent = spot.hours;
  document.getElementById('detail-noise').textContent = spot.noise;

  // 헤더 그라데이션 카드 배경 설정
  document.getElementById('detail-header-bg').style.background = `linear-gradient(180deg, rgba(138, 31, 22, 0.1) 0%, rgba(22, 22, 30, 0) 100%), ${spot.bgGradient}`;

  // 혼잡도 뱃지
  updateCongestionUI(spot.congestion);

  // 태그 리스트 빌드
  const tagsContainer = document.getElementById('detail-tags-container');
  tagsContainer.innerHTML = '';
  spot.tags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = 'badge-mini neutral';
    badge.textContent = `#${tag}`;
    tagsContainer.appendChild(badge);
  });
}

function updateCongestionUI(congestion) {
  const badge = document.getElementById('detail-congestion');
  badge.textContent = congestion;
  badge.className = 'congestion-badge';
  
  if (congestion === '여유') badge.classList.add('green');
  else if (congestion === '보통') badge.classList.add('yellow');
  else if (congestion === '혼잡') badge.classList.add('red');
}

/* ==========================================================================
   ALLOWED APPS CONFIGURATION
   ========================================================================== */
function renderAppsSetup() {
  const grid = document.getElementById('apps-list');
  grid.innerHTML = '';

  state.allowedApps.forEach(app => {
    const card = document.createElement('div');
    card.className = `app-toggle-card ${app.allowed ? 'selected' : ''}`;
    card.setAttribute('data-id', app.id);
    
    // 개별 앱별 고유 컬러 브랜딩 스타일 주입
    const iconWrapperStyle = `background-color: ${app.bg}; color: ${app.color};`;

    card.innerHTML = `
      <div class="app-checkbox"><i class="fa-solid fa-check"></i></div>
      <div class="app-icon-wrapper" style="${iconWrapperStyle}">
        <i class="${app.icon}"></i>
      </div>
      <div class="app-label">${app.name}</div>
    `;

    card.addEventListener('click', () => {
      app.allowed = !app.allowed;
      card.classList.toggle('selected', app.allowed);
      updateAppsSummary();
    });

    grid.appendChild(card);
  });

  updateAppsSummary();
}

function updateAppsSummary() {
  const allowedCount = state.allowedApps.filter(a => a.allowed).length;
  document.getElementById('selected-apps-count').textContent = allowedCount;
}

/* ==========================================================================
   TIMER VIEW & PROGRESS CONTROLLER
   ========================================================================== */
function updateTimerTabDetails() {
  const spotCard = document.getElementById('timer-spot-card');
  const currentSpotId = state.timer.activeSpotId;

  if (currentSpotId) {
    const spot = STUDY_SPOTS.find(s => s.id === currentSpotId);
    if (spot) {
      spotCard.innerHTML = `
        <div style="font-weight: 700; font-size: 15px; margin-bottom: 5px;">${spot.name}</div>
        <div style="font-size: 12px; color: var(--color-text-muted);"><i class="fa-solid fa-map-pin"></i> ${spot.building} • ${spot.location}</div>
        <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 5px;"><i class="fa-solid fa-volume-low"></i> ${spot.noise}</div>
      `;
    }
  } else {
    spotCard.innerHTML = `<p class="no-spot-selected-msg">지도를 클릭하여 공부할 명당을 먼저 지정해 보세요.</p>`;
  }

  // 허용된 앱들 칩 리스트 빌드
  const chipsContainer = document.getElementById('timer-allowed-apps-list');
  chipsContainer.innerHTML = '';
  
  const allowed = state.allowedApps.filter(a => a.allowed);
  
  if (allowed.length === 0) {
    chipsContainer.innerHTML = `<span style="font-size:12px; color:var(--color-text-muted)">허용된 앱이 없습니다. SNS 및 메신저가 차단됩니다.</span>`;
  } else {
    allowed.forEach(app => {
      const chip = document.createElement('span');
      chip.className = 'app-chip';
      chip.innerHTML = `<i class="${app.icon}" style="color:${app.color}"></i> ${app.name}`;
      chipsContainer.appendChild(chip);
    });
  }
}

function toggleTimer() {
  const toggleIcon = document.getElementById('timer-toggle-icon');
  const stopBtn = document.getElementById('btn-timer-stop');
  const badge = document.getElementById('focus-active-badge');
  const overlayScreen = document.getElementById('focus-overlay-screen');

  if (state.timer.isRunning) {
    // 1. 일시 정지 처리
    clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
    toggleIcon.className = 'fa-solid fa-play';
    badge.classList.remove('active');
    
    // 집중 차단 레이어 해제
    overlayScreen.classList.add('hidden');
    stopTimerMockNotif();
    
    // 오디오 정지
    window.focusAudio.stop();
    resetAmbientBtns();
    
    showToast('info', '공부를 일시 중지했습니다.');
  } else {
    // 2. 타이머 시작 조건 체크
    if (!state.timer.activeSpotId) {
      showToast('warning', '공부할 명당 자리를 지도 탭에서 먼저 선택해 주세요!');
      showView('view-map');
      return;
    }

    // 오디오 자동 재생 시도 (사용자가 이전에 선택한 빗소리 등)
    const activeSoundBtn = document.querySelector('.ambient-track-btn.active');
    if (activeSoundBtn) {
      const soundType = activeSoundBtn.getAttribute('data-sound');
      const volume = parseFloat(document.getElementById('ambient-volume').value);
      window.focusAudio.play(soundType, volume);
    }

    state.timer.isRunning = true;
    toggleIcon.className = 'fa-solid fa-pause';
    badge.classList.add('active');
    stopBtn.disabled = false;

    // 1초 단위 인터벌 동작
    state.timer.intervalId = setInterval(tickTimer, 1000);
    showToast('success', '집중 타이머가 동작합니다. 열공하세요!');
  }
}

function tickTimer() {
  state.timer.seconds++;
  
  // 시간 자릿수 화면 갱신
  const hrs = Math.floor(state.timer.seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((state.timer.seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (state.timer.seconds % 60).toString().padStart(2, '0');
  
  document.getElementById('timer-digits').textContent = `${hrs}:${mins}:${secs}`;

  // 원형 진행 바 연동 (1시간 단위 혹은 60초 회전 단위)
  // 초단위로 회전하여 시각적 생동감을 부여함 (60초 주기로 채워짐)
  const ring = document.getElementById('timer-progress-ring');
  const circumference = 565.48; // 2 * PI * 90
  const currentSecond = state.timer.seconds % 60;
  const offset = circumference - (currentSecond / 60) * circumference;
  ring.style.strokeDashoffset = offset;
}

// 타이머 일시정지/종료 시 가상 노티피케이션 중단
let notifTimer = null;
function startTimerMockNotif() {
  if (notifTimer) clearInterval(notifTimer);
  
  const toastWarning = document.getElementById('unauthorized-toast');
  const notifBox = document.querySelector('.simulated-notification');
  const notifHeader = notifBox.querySelector('.notif-header span:first-child');
  const notifBody = notifBox.querySelector('.notif-body');
  
  const mockAlerts = [
    { app: "카카오톡", body: "김철수: '오늘 야식 중앙광장 치맥 고?'" },
    { app: "인스타그램", body: "홍길동님이 회원님의 스토리를 좋아합니다." },
    { app: "유튜브", body: "실시간 급상승 1위: '대학생 밤샘 시험 공부 브이로그'" },
    { app: "웹서핑", body: "비허용 브라우저 실행이 감지되었습니다." }
  ];

  notifTimer = setInterval(() => {
    // 무작위 집중 방해 차단 알림 연출
    const alert = mockAlerts[Math.floor(Math.random() * mockAlerts.length)];
    notifHeader.innerHTML = `<i class="fa-solid fa-bell"></i> ${alert.app} 알림`;
    notifBody.textContent = `"${alert.body}"`;
    
    // 경고 팝업 깜빡임 연출
    toastWarning.classList.remove('hidden');
    setTimeout(() => {
      toastWarning.classList.add('hidden');
    }, 4000);
  }, 12000);
}

function stopTimerMockNotif() {
  if (notifTimer) {
    clearInterval(notifTimer);
    notifTimer = null;
  }
}

function resetAmbientBtns() {
  document.querySelectorAll('.ambient-track-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('ambient-status').textContent = '정지됨';
}

function stopTimerConfirm() {
  if (state.timer.seconds < 5) {
    // 5초 미만은 가짜 공부로 판명하여 기록 배제
    if (confirm("공부 시간이 너무 짧습니다. 기록을 저장하지 않고 종료할까요?")) {
      resetTimer();
    }
    return;
  }

  if (confirm("집중 공부를 끝마치고 오늘 학습 내역으로 기록할까요?")) {
    saveCurrentSession();
  }
}

function saveCurrentSession() {
  // 인터벌 중지 및 세션 저장
  clearInterval(state.timer.intervalId);
  
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;
  
  const newSession = {
    date: dateStr,
    spotId: state.timer.activeSpotId,
    duration: state.timer.seconds
  };

  state.sessions.push(newSession);
  localStorage.setItem('godae_sessions', JSON.stringify(state.sessions));

  // 공부 시간 요약 팝업
  const totalMin = Math.floor(state.timer.seconds / 60);
  const totalSec = state.timer.seconds % 60;
  
  const spotName = STUDY_SPOTS.find(s => s.id === state.timer.activeSpotId).name;
  
  // 성공 토스트 띄우기
  showToast('success', `${spotName}에서의 집중 완료! (${totalMin}분 ${totalSec}초 기록)`);
  
  resetTimer();
  showView('view-stats');
}

function resetTimer() {
  if (state.timer.intervalId) clearInterval(state.timer.intervalId);
  stopTimerMockNotif();
  window.focusAudio.stop();
  resetAmbientBtns();

  state.timer.seconds = 0;
  state.timer.isRunning = false;
  
  document.getElementById('timer-digits').textContent = "00:00:00";
  document.getElementById('timer-progress-ring').style.strokeDashoffset = 565.48;
  document.getElementById('timer-toggle-icon').className = 'fa-solid fa-play';
  document.getElementById('focus-active-badge').classList.remove('active');
  document.getElementById('btn-timer-stop').disabled = true;
  document.getElementById('focus-overlay-screen').classList.add('hidden');
}

/* ==========================================================================
   STATISTICS, ACHIEVEMENTS & CHART.JS REPORTING
   ========================================================================== */
function renderStatsDashboard() {
  // 1. 누적 데이터 집계
  let totalSec = 0;
  let counts = state.sessions.length;
  let spotWeights = {}; // 각 장소별 공부 초 단위 시간

  state.sessions.forEach(sess => {
    totalSec += sess.duration;
    spotWeights[sess.spotId] = (spotWeights[sess.spotId] || 0) + sess.duration;
  });

  const hrs = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const secs = (totalSec % 60).toString().padStart(2, '0');

  document.getElementById('stat-total-time').textContent = `${hrs}:${mins}:${secs}`;
  document.getElementById('stat-total-time').style.fontFamily = 'Outfit';
  document.getElementById('stat-session-count').textContent = `${counts}회`;

  // 2. 학습 등급 산정
  let tier = "학사 (새싹 학습자)";
  let tierColor = "#f1c40f";
  const totalHrs = totalSec / 3600;

  if (totalHrs >= 10) {
    tier = "박사 (지치지 않는 학구열)";
    tierColor = "#9b59b6";
    document.getElementById('badge-icon').innerHTML = '<i class="fa-solid fa-crown"></i>';
  } else if (totalHrs >= 4) {
    tier = "석사 (학습 전문 연구원)";
    tierColor = "#3498db";
    document.getElementById('badge-icon').innerHTML = '<i class="fa-solid fa-award"></i>';
  } else {
    document.getElementById('badge-icon').innerHTML = '<i class="fa-solid fa-award"></i>';
  }
  
  const tierBadge = document.getElementById('profile-tier');
  tierBadge.textContent = tier;
  tierBadge.style.color = tierColor;
  tierBadge.style.borderColor = tierColor;

  // 3. 업적 리스트 해금 렌더링
  renderAchievements(totalHrs, counts);

  // 4. 최근 기록 테이블 채우기
  const tbody = document.getElementById('stats-history-tbody');
  tbody.innerHTML = '';
  
  if (state.sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted)">아직 공부 완료 기록이 없습니다.</td></tr>`;
  } else {
    // 최근 5개 기록 역순 정렬 렌더링
    const recent = [...state.sessions].reverse().slice(0, 5);
    recent.forEach(sess => {
      const spotObj = STUDY_SPOTS.find(s => s.id === sess.spotId);
      const spotName = spotObj ? spotObj.name : '알 수 없는 곳';
      
      const sMin = Math.floor(sess.duration / 60);
      const sSec = sess.duration % 60;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${sess.date}</td>
        <td><i class="fa-solid fa-location-dot" style="color:var(--color-primary-light); margin-right:4px;"></i> ${spotName}</td>
        <td style="font-family:var(--font-outfit); font-weight:600">${sMin}분 ${sSec}초</td>
        <td><span class="badge-mini green" style="border:none; padding:2px 8px">성공</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 5. Chart.js 렌더링
  buildCharts(spotWeights);
}

function renderAchievements(totalHrs, counts) {
  const list = document.getElementById('achievements-list');
  list.innerHTML = '';

  const achDefs = [
    { id: 'first_step', title: '첫 걸음', desc: '첫 번째 공부 세션을 완료하세요.', condition: () => counts >= 1, icon: 'fa-shoe-prints' },
    { id: 'hard_work', title: '열공러', desc: '누적 공부 시간 2시간을 돌파하세요.', condition: () => totalHrs >= 2, icon: 'fa-fire' },
    { id: 'all_nighter', title: '밤샘 등대', desc: '중앙도서관 또는 SK미래관 지하에서 기록을 남기세요.', condition: () => state.sessions.some(s => s.spotId === 'central_library' || s.spotId === 'sk_basement'), icon: 'fa-lightbulb' },
    { id: 'god_of_study', title: '공부의 신', desc: '누적 공부 시간 7시간을 돌파하세요.', condition: () => totalHrs >= 7, icon: 'fa-brain' }
  ];

  achDefs.forEach(ach => {
    const isUnlocked = ach.condition();
    const item = document.createElement('div');
    item.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
    
    item.innerHTML = `
      <div class="achievement-icon">
        <i class="fa-solid ${ach.icon}"></i>
      </div>
      <div class="achievement-info">
        <span class="achievement-title">${ach.title}</span>
        <span class="achievement-desc">${ach.desc}</span>
      </div>
    `;
    list.appendChild(item);
  });
}

function buildCharts(spotWeights) {
  // Chart.js 폰트 및 글로벌 색상 셋업
  Chart.defaults.color = '#8e8e9f';
  Chart.defaults.font.family = 'Noto Sans KR';

  // 7일간의 날짜 라벨 획득
  const last7Days = getLast7DaysLabels();
  
  // 1. 일별 누적 데이터 빌드
  const dailyDurations = last7Days.map(dayLabel => {
    let sum = 0;
    state.sessions.forEach(sess => {
      if (sess.date === dayLabel) {
        sum += sess.duration;
      }
    });
    return Math.round(sum / 60); // 분 단위 환산
  });

  // 주간 차트 생성 / 업데이트
  const ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
  if (state.charts.weekly) {
    state.charts.weekly.destroy();
  }
  state.charts.weekly = new Chart(ctxWeekly, {
    type: 'bar',
    data: {
      labels: last7Days,
      datasets: [{
        label: '집중 시간 (분)',
        data: dailyDurations,
        backgroundColor: 'rgba(138, 31, 22, 0.65)',
        borderColor: '#8A1F16',
        borderWidth: 1.5,
        borderRadius: 5,
        hoverBackgroundColor: 'rgba(179, 46, 36, 0.85)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.03)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });

  // 2. 장소별 비율 데이터 빌드
  const spotLabels = [];
  const spotTimes = [];
  const backgroundGradients = [
    '#2c3e50', '#e67e22', '#16a085', '#8e44ad', '#7f8c8d', 
    '#2980b9', '#27ae60', '#d35400', '#c0392b', '#34495e'
  ];

  STUDY_SPOTS.forEach((spot, idx) => {
    const time = spotWeights[spot.id] || 0;
    if (time > 0) {
      spotLabels.push(spot.name);
      spotTimes.push(Math.round(time / 60)); // 분 단위 환산
    }
  });

  // 만약 장소 기록이 아예 없을 경우 모의 통계 노출
  if (spotTimes.length === 0) {
    spotLabels.push("학습 기록 없음");
    spotTimes.push(100);
  }

  const ctxSpots = document.getElementById('spotsChart').getContext('2d');
  if (state.charts.spots) {
    state.charts.spots.destroy();
  }
  state.charts.spots = new Chart(ctxSpots, {
    type: 'doughnut',
    data: {
      labels: spotLabels,
      datasets: [{
        data: spotTimes,
        backgroundColor: backgroundGradients.slice(0, spotLabels.length),
        borderWidth: 1,
        borderColor: 'rgba(22, 22, 30, 0.9)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
        }
      }
    }
  });
}

/* ==========================================================================
   TOAST COMPONENT UTILITIES
   ========================================================================== */
function showToast(type, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="${iconClass} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // 4.5초 뒤 자동 제거
  setTimeout(() => {
    toast.style.animation = 'toast-slide-in 0.3s ease-in reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4500);
}
