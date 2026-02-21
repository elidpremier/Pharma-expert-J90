// ==================== STATE MANAGEMENT ====================
const CHALLENGE_DURATION = 90;

let appState = {
    startDate: null,
    contractSigned: false,
    contractName: '',
    contractDate: null,
    dailyLogs: {},
    goals: [],
    sessions: {},
    badges: [],
    level: 1,
    xp: 0,
    weeklyEvaluations: [],
    requirements: { req1: false, req2: false, req3: false, req4: false }
};

let focusTimerInterval = null;
let focusTimeLeft = 1500;
let focusRunning = false;
let focusMode = 0;
let focusEndTime = null; // Temps système de fin de session
let wakeLock = null; // Pour l'API Screen Wake Lock

let weeklyChartInstance = null;
let disciplineChartInstance = null;
let timeChartInstance = null;

// PWA Install Prompt
let deferredPrompt = null;

// ==================== INITIALIZATION ====================
function init() {
    loadData();
    if (!appState.startDate) {
        appState.startDate = new Date().toISOString();
        saveData();
    }
    
    document.getElementById('journalDate').value = getTodayKey();
    document.getElementById('contractDate').value = new Date().toISOString().split('T')[0];
    
    updateUI();
    initCharts();
    renderBadges();
    renderGoals();
    renderJournalHistory();
    renderHeatmap();
    
    if (appState.contractSigned) {
        showSignedContract();
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.error('SW registration failed:', err));
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('installBanner').style.display = 'flex';
    });

    // Handle app installed
    window.addEventListener('appinstalled', () => {
        document.getElementById('installBanner').style.display = 'none';
        deferredPrompt = null;
    });

    // Re-acquérir le Wake Lock si l'onglet redevient visible
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
            await requestWakeLock();
        }
        // Vérifier si le timer a fini pendant l'absence
        if (focusRunning && document.visibilityState === 'visible' && focusEndTime) {
            if (Date.now() >= focusEndTime) {
                completeFocusSession();
            }
        }
    });
}

// ==================== WAKE LOCK API ====================
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock is active');
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
        console.log('Screen Wake Lock released');
    }
}

// ==================== PWA INSTALL FUNCTIONS ====================
function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            document.getElementById('installBanner').style.display = 'none';
        });
    }
}

function dismissInstallBanner() {
    document.getElementById('installBanner').style.display = 'none';
    localStorage.setItem('pwaInstallDismissed', 'true');
}

// ==================== DATA PERSISTENCE ====================
function saveData() {
    localStorage.setItem('pharmaChallenge_v2', JSON.stringify(appState));
}

function loadData() {
    const saved = localStorage.getItem('pharmaChallenge_v2');
    if (saved) {
        appState = JSON.parse(saved);
    }
}

function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function getDayNumber() {
    if (!appState.startDate) return 1;
    const start = new Date(appState.startDate);
    const now = new Date();
    const diffTime = now - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(diffDays, CHALLENGE_DURATION);
}

function getPhase() {
    const day = getDayNumber();
    if (day <= 30) return 1;
    if (day <= 60) return 2;
    return 3;
}

// ==================== UI UPDATES ====================
function updateUI() {
    const dayNum = getDayNumber();
    const todayKey = getTodayKey();
    const todayData = appState.dailyLogs[todayKey] || {};

    // Update Dashboard Stats
    const percent = Math.round((dayNum / CHALLENGE_DURATION) * 100);
    if (document.getElementById('progressPercent')) document.getElementById('progressPercent').innerText = `${percent}%`;
    if (document.getElementById('dayDisplay')) document.getElementById('dayDisplay').innerText = dayNum;
    
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (percent / 100) * circumference;
    if (document.getElementById('mainProgressCircle')) {
        document.getElementById('mainProgressCircle').style.strokeDashoffset = offset;
    }

    const streak = calculateStreak();
    if (document.getElementById('streakCount')) document.getElementById('streakCount').innerText = streak;

    const totalFocus = Object.values(appState.dailyLogs).reduce((sum, log) => sum + (log.duration || 0), 0);
    if (document.getElementById('totalFocusTime')) document.getElementById('totalFocusTime').innerText = `${totalFocus} min`;

    const completedGoals = appState.goals.filter(g => g.status === 'completed').length;
    if (document.getElementById('completedGoalsCount')) document.getElementById('completedGoalsCount').innerText = completedGoals;

    if (document.getElementById('badgesCount')) document.getElementById('badgesCount').innerText = appState.badges.length;

    const weeklyScore = calculateWeeklyScore();
    if (document.getElementById('disciplineScore')) document.getElementById('disciplineScore').innerText = `${weeklyScore}/10`;

    if (document.getElementById('userNameSidebar')) {
        document.getElementById('userNameSidebar').innerText = appState.contractName || 'Utilisateur';
    }
    if (document.getElementById('userLevel')) document.getElementById('userLevel').innerText = appState.level;
    if (document.getElementById('currentLevelDisplay')) document.getElementById('currentLevelDisplay').innerText = appState.level;
    
    const xpNeeded = appState.level * 100;
    const xpPercent = (appState.xp / xpNeeded) * 100;
    if (document.getElementById('xpBar')) document.getElementById('xpBar').style.width = `${xpPercent}%`;
    if (document.getElementById('xpBarLarge')) document.getElementById('xpBarLarge').style.width = `${xpPercent}%`;
    if (document.getElementById('xpNeeded')) document.getElementById('xpNeeded').innerText = xpNeeded - appState.xp;

    if (document.getElementById('currentDate')) {
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString('fr-FR', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }
}

function calculateStreak() {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        const log = appState.dailyLogs[key];
        if (log && log.duration > 0) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    return streak;
}

function calculateWeeklyScore() {
    let total = 0;
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        const log = appState.dailyLogs[key];
        if (log) {
            total += log.focus || 3;
            count++;
        }
    }
    return count > 0 ? Math.round((total / (count * 5)) * 10) : 0;
}

// ==================== NAVIGATION ====================
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));

    // Redirect merged sections
    let targetSectionId = sectionId;
    if (sectionId === 'goals') targetSectionId = 'journal';
    if (sectionId === 'stats') targetSectionId = 'dashboard';

    const targetSection = document.getElementById(`${targetSectionId}Section`);
    if (targetSection) targetSection.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    
    const titles = {
        dashboard: 'Dashboard',
        planning: 'Planning',
        journal: 'Suivi & Journal',
        rewards: 'Récompenses',
        contract: 'Contrat',
        focus: 'Mode Focus'
    };
    document.getElementById('sectionTitle').innerText = titles[sectionId] || titles[targetSectionId] || 'Pharma Expert';
    
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const mainContent = document.querySelector('.main-content');

    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden');
    } else {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
}

// ==================== JOURNAL ====================
function saveJournalEntry() {
    const date = document.getElementById('journalDate').value;
    const morning = document.getElementById('morningSession').checked;
    const evening = document.getElementById('eveningSession').checked;
    const focus = parseInt(document.getElementById('focusSlider').value);
    const notes = document.getElementById('journalNotes').value;
    
    if (!appState.dailyLogs[date]) {
        appState.dailyLogs[date] = { date };
    }
    
    const log = appState.dailyLogs[date];
    log.morning = morning;
    log.evening = evening;
    log.focus = focus;
    log.notes = notes;
    
    // XP for logging
    addXP(15);
    
    saveData();
    updateUI();
    renderJournalHistory();
    renderHeatmap();
    showNotification('Journée enregistrée !');
}

function renderJournalHistory() {
    const container = document.getElementById('journalHistory');
    const sortedDates = Object.keys(appState.dailyLogs).sort().reverse();
    
    if (sortedDates.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 text-center">Aucun historique</p>';
        return;
    }
    
    container.innerHTML = sortedDates.slice(0, 10).map(date => {
        const log = appState.dailyLogs[date];
        return `
            <div class="glass-card rounded-xl p-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-400">${new Date(date).toLocaleDateString('fr-FR')}</span>
                    <div class="flex gap-1">
                        ${log.morning ? '<span class="w-2 h-2 rounded-full bg-yellow-500"></span>' : ''}
                        ${log.evening ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : ''}
                    </div>
                </div>
                <p class="text-sm text-white line-clamp-2">${log.notes || 'Pas de notes'}</p>
            </div>
        `;
    }).join('');
}

// ==================== GOALS ====================
function showAddGoalModal() {
    const title = prompt('Titre de l\'objectif :');
    if (title) {
        appState.goals.push({
            id: Date.now(),
            title,
            status: 'pending'
        });
        saveData();
        renderGoals();
    }
}

function renderGoals() {
    const container = document.getElementById('goalsGrid');
    container.innerHTML = appState.goals.map(goal => `
        <div class="glass-card rounded-xl p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button onclick="toggleGoalStatus(${goal.id})" class="w-6 h-6 rounded-full border-2 ${goal.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-slate-600'} flex items-center justify-center">
                    ${goal.status === 'completed' ? '<i class="fa-solid fa-check text-white text-xs"></i>' : ''}
                </button>
                <span class="${goal.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'} font-semibold">${goal.title}</span>
            </div>
            <button onclick="deleteGoal(${goal.id})" class="text-slate-500 hover:text-red-400">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');
}

function toggleGoalStatus(id) {
    const goal = appState.goals.find(g => g.id === id);
    if (goal) {
        goal.status = goal.status === 'completed' ? 'pending' : 'completed';
        if (goal.status === 'completed') addXP(50);
        saveData();
        renderGoals();
        updateUI();
    }
}

function deleteGoal(id) {
    if (confirm('Supprimer cet objectif ?')) {
        appState.goals = appState.goals.filter(g => g.id !== id);
        saveData();
        renderGoals();
        updateUI();
    }
}

function updateRequirements() {
    appState.requirements = {
        req1: document.getElementById('req1').checked,
        req2: document.getElementById('req2').checked,
        req3: document.getElementById('req3').checked,
        req4: document.getElementById('req4').checked
    };
    saveData();
}

// ==================== CONTRACT ====================
function signContract() {
    const name = document.getElementById('contractName').value;
    const date = document.getElementById('contractDate').value;
    
    if (!name || !date) {
        alert('Veuillez remplir votre nom et la date');
        return;
    }
    
    appState.contractSigned = true;
    appState.contractName = name;
    appState.contractDate = date;
    appState.startDate = date;
    
    saveData();
    showSignedContract();
    updateUI();
}

function showSignedContract() {
    document.getElementById('contractForm').classList.add('hidden');
    document.getElementById('contractSigned').classList.remove('hidden');
    document.getElementById('signedName').innerText = appState.contractName;
    document.getElementById('signedDate').innerText = `Signé le ${new Date(appState.contractDate).toLocaleDateString('fr-FR')}`;
}

// ==================== FOCUS TIMER (Fiabilisé) ====================
function setFocusMode(mode) {
    const times = [1500, 2400, 3600];
    focusMode = mode;
    focusTimeLeft = times[mode];
    focusRunning = false;
    focusEndTime = null;
    clearInterval(focusTimerInterval);
    updateFocusTimerDisplay();
    document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-play mr-2"></i>Démarrer';
    releaseWakeLock();
}

async function toggleFocusTimer() {
    if (focusRunning) {
        // Pause
        clearInterval(focusTimerInterval);
        focusRunning = false;
        focusEndTime = null;
        document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-play mr-2"></i>Reprendre';
        releaseWakeLock();
    } else {
        // Demander la permission pour les notifications
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        // Démarrer / Reprendre
        focusRunning = true;
        focusEndTime = Date.now() + (focusTimeLeft * 1000);
        document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-pause mr-2"></i>Pause';
        
        await requestWakeLock();
        
        focusTimerInterval = setInterval(() => {
            const now = Date.now();
            focusTimeLeft = Math.max(0, Math.round((focusEndTime - now) / 1000));
            
            if (focusTimeLeft > 0) {
                updateFocusTimerDisplay();
            } else {
                completeFocusSession();
            }
        }, 1000);
    }
}

function completeFocusSession() {
    if (!focusRunning && !focusEndTime) return; // Éviter les doubles appels

    clearInterval(focusTimerInterval);
    focusRunning = false;
    focusEndTime = null;
    document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-play mr-2"></i>Démarrer';
    releaseWakeLock();
    
    const todayKey = getTodayKey();
    const sessionDuration = focusMode === 0 ? 25 : focusMode === 1 ? 40 : 60;
    
    if (!appState.sessions[todayKey]) appState.sessions[todayKey] = [];
    appState.sessions[todayKey].push({
        duration: sessionDuration,
        completedAt: new Date().toISOString()
    });
    
    if (!appState.dailyLogs[todayKey]) appState.dailyLogs[todayKey] = { date: todayKey };
    appState.dailyLogs[todayKey].duration = (appState.dailyLogs[todayKey].duration || 0) + sessionDuration;
    
    addXP(20);
    saveData();
    updateUI();
    renderSessionLog();
    
    // Notification système
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Pharma Expert", {
            body: `Session Focus de ${sessionDuration} min terminée ! +20 XP`,
            icon: "assets/icons/icon-192.png"
        });
    }

    // Notification sonore simple
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {}
    
    setTimeout(() => {
        alert(`Session terminée ! +20 XP`);
    }, 100);
}

function updateFocusTimerDisplay() {
    const minutes = Math.floor(focusTimeLeft / 60);
    const seconds = focusTimeLeft % 60;
    document.getElementById('focusTimerDisplay').innerText = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const maxTime = focusMode === 0 ? 1500 : focusMode === 1 ? 2400 : 3600;
    const circumference = 2 * Math.PI * 120;
    const offset = circumference - (focusTimeLeft / maxTime) * circumference;
    document.getElementById('focusTimerCircle').style.strokeDashoffset = offset;
}

function renderSessionLog() {
    const todayKey = getTodayKey();
    const container = document.getElementById('sessionLog');
    const sessions = appState.sessions[todayKey] || [];
    
    if (sessions.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 text-center">Aucune session enregistrée</p>';
        return;
    }
    
    container.innerHTML = sessions.map(session => `
        <div class="glass-card rounded-lg p-3 flex justify-between items-center">
            <span class="text-sm text-white">Session Focus</span>
            <span class="text-sm text-green-400">+${session.duration} min</span>
        </div>
    `).join('');
}

// ==================== REWARDS & BADGES ====================
const BADGES = [
    { id: 'first_day', name: 'Premier Jour', icon: '🌟', requirement: () => getDayNumber() >= 1 },
    { id: 'week_1', name: '1ère Semaine', icon: '📅', requirement: () => calculateStreak() >= 7 },
    { id: 'month_1', name: '1er Mois', icon: '🎯', requirement: () => getDayNumber() >= 30 },
    { id: 'goal_crusher', name: 'Objectif Atteint', icon: '🏆', requirement: () => appState.goals.some(g => g.status === 'completed') },
    { id: 'champion', name: 'Champion J90', icon: '👑', requirement: () => getDayNumber() >= 90 }
];

function checkBadges() {
    BADGES.forEach(badge => {
        if (!appState.badges.includes(badge.id) && badge.requirement()) {
            appState.badges.push(badge.id);
            showNotification(`🏆 Badge débloqué: ${badge.name}`);
        }
    });
    saveData();
}

function renderBadges() {
    const container = document.getElementById('badgesGrid');
    if (!container) return;
    container.innerHTML = BADGES.map(badge => {
        const unlocked = appState.badges.includes(badge.id);
        return `
            <div class="glass-card rounded-xl p-4 text-center ${unlocked ? 'badge' : 'opacity-40'}">
                <div class="text-3xl mb-2">${badge.icon}</div>
                <p class="text-xs font-semibold ${unlocked ? 'text-white' : 'text-slate-500'}">${badge.name}</p>
                ${unlocked ? '<i class="fa-solid fa-check text-green-400 text-xs mt-1"></i>' : '<i class="fa-solid fa-lock text-slate-600 text-xs mt-1"></i>'}
            </div>
        `;
    }).join('');
}

function addXP(amount) {
    appState.xp += amount;
    const xpNeeded = appState.level * 100;
    if (appState.xp >= xpNeeded) {
        appState.xp -= xpNeeded;
        appState.level++;
        showNotification(`🎉 Niveau ${appState.level} atteint !`);
    }
    saveData();
    updateUI();
}

function saveWeeklyEvaluation() {
    const eval1 = parseInt(document.getElementById('eval1').value);
    const eval2 = parseInt(document.getElementById('eval2').value);
    const eval3 = parseInt(document.getElementById('eval3').value);
    const total = eval1 + eval2 + eval3;
    
    appState.weeklyEvaluations.push({
        date: getTodayKey(),
        scores: [eval1, eval2, eval3],
        total
    });
    
    saveData();
    document.getElementById('totalScore').innerText = `${total}/30`;
    addXP(30);
    alert('Évaluation enregistrée !');
}

// ==================== STATS & CHARTS ====================
function initCharts() {
    if (!document.getElementById('weeklyChart')) return;
    
    const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
    weeklyChartInstance = new Chart(weeklyCtx, {
        type: 'bar',
        data: {
            labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            datasets: [{
                label: 'Minutes Focus',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: '#22c55e',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' } },
                x: { grid: { display: false } }
            }
        }
    });

    const disciplineCtx = document.getElementById('disciplineChart').getContext('2d');
    disciplineChartInstance = new Chart(disciplineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Focus Quotidien',
                data: [],
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 5, grid: { color: '#334155' } },
                x: { grid: { display: false } }
            }
        }
    });

    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChartInstance = new Chart(timeCtx, {
        type: 'doughnut',
        data: {
            labels: ['Complété', 'Restant'],
            datasets: [{
                data: [0, 90],
                backgroundColor: ['#22c55e', '#1e293b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    updateStats();
}

function updateStats() {
    if (!weeklyChartInstance) return;
    
    // Weekly Bar Chart
    const weeklyData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        weeklyData.push(appState.dailyLogs[key]?.duration || 0);
    }
    weeklyChartInstance.data.datasets[0].data = weeklyData;
    weeklyChartInstance.update();

    // Discipline Line Chart
    const labels = [];
    const scores = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
        const key = d.toISOString().split('T')[0];
        scores.push(appState.dailyLogs[key]?.focus || 0);
    }
    disciplineChartInstance.data.labels = labels;
    disciplineChartInstance.data.datasets[0].data = scores;
    disciplineChartInstance.update();

    // Time Doughnut
    const dayNum = getDayNumber();
    timeChartInstance.data.datasets[0].data = [dayNum, CHALLENGE_DURATION - dayNum];
    timeChartInstance.update();
}

// ==================== HEATMAP ====================
function renderHeatmap() {
    const container = document.getElementById('heatmap');
    if (!container) return;
    
    const today = new Date();
    let html = '';
    
    for (let i = 90; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const duration = appState.dailyLogs[key]?.duration || 0;
        
        let level = 0;
        if (duration > 0) level = 1;
        if (duration >= 30) level = 2;
        if (duration >= 60) level = 3;
        if (duration >= 90) level = 4;
        
        html += `<div class="heatmap-day heatmap-${level}" title="${key}: ${duration} min"></div>`;
    }
    container.innerHTML = html;
}

// ==================== NOTIFICATIONS ====================
function showNotification(text) {
    const list = document.getElementById('notificationsList');
    const panel = document.getElementById('notificationsPanel');
    const badge = document.getElementById('notifBadge');
    
    const item = document.createElement('div');
    item.className = 'glass-card rounded-xl p-3 text-sm text-white border-l-4 border-green-500';
    item.innerText = text;
    
    list.prepend(item);
    badge.classList.remove('hidden');
    
    // Auto-hide after 5s
    setTimeout(() => {
        item.style.opacity = '0';
        setTimeout(() => item.remove(), 500);
    }, 5000);
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    const badge = document.getElementById('notifBadge');
    panel.classList.toggle('hidden');
    badge.classList.add('hidden');
}

// ==================== EXPORT PDF ====================
async function generateWeeklyReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dayNum = getDayNumber();
    
    doc.setFontSize(20);
    doc.text('Rapport Pharma Expert J90', 20, 20);
    doc.setFontSize(12);
    doc.text(`Jour : ${dayNum}/90`, 20, 30);
    doc.text(`Niveau : ${appState.level}`, 20, 40);
    doc.text(`XP : ${appState.xp}`, 20, 50);
    
    doc.save(`pharma-expert-j${dayNum}.pdf`);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    document.getElementById('focusSlider')?.addEventListener('input', function() {
        document.getElementById('focusValue').innerText = `${this.value}/5`;
    });
});
