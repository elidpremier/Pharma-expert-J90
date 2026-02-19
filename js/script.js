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
            const phase = getPhase();
            const todayKey = getTodayKey();
            const todayData = appState.dailyLogs[todayKey] || {};

            document.getElementById('currentDay').innerText = dayNum;
            document.getElementById('daysRemaining').innerText = CHALLENGE_DURATION - dayNum;
            
            const phaseNames = {
                1: { name: 'Phase 1: Réactivation', desc: 'Reprendre l\'habitude. Régularité > performance.', color: 'green' },
                2: { name: 'Phase 2: Intensification', desc: 'Monter en niveau. Compréhension profonde.', color: 'blue' },
                3: { name: 'Phase 3: Domination', desc: 'Devenir référence. Production maximale.', color: 'red' }
            };
            
            const phaseInfo = phaseNames[phase];
            document.getElementById('phaseName').innerText = phaseInfo.name;
            document.getElementById('phaseDesc').innerText = phaseInfo.desc;
            document.getElementById('phaseBadge').innerText = `Phase ${phase}`;
            document.getElementById('phaseBadge').className = `text-xs px-2 py-0.5 rounded-full bg-${phaseInfo.color}-900/50 text-${phaseInfo.color}-400 inline-block`;
            
            const phaseStart = phase === 1 ? 1 : phase === 2 ? 31 : 61;
            const phaseEnd = phase === 1 ? 30 : phase === 2 ? 60 : 90;
            const phaseProgress = ((dayNum - phaseStart + 1) / (phaseEnd - phaseStart + 1)) * 100;
            document.getElementById('phaseProgress').style.width = `${phaseProgress}%`;

            const percent = Math.round((dayNum / CHALLENGE_DURATION) * 100);
            document.getElementById('progressPercent').innerText = `${percent}%`;
            document.getElementById('progressBar').style.width = `${percent}%`;

            const streak = calculateStreak();
            document.getElementById('streakCount').innerText = streak;

            const todayMinutes = todayData.duration || 0;
            document.getElementById('todayMinutes').innerText = todayMinutes;

            const weeklyScore = calculateWeeklyScore();
            document.getElementById('disciplineScore').innerText = `${weeklyScore}/10`;

            updateTaskIcons(todayData);

            if (todayData.focus) {
                document.getElementById('focusSlider').value = todayData.focus;
                document.getElementById('focusValue').innerText = `${todayData.focus}/5`;
            }

            document.getElementById('phoneCheck').checked = todayData.phoneRespected || false;

            document.getElementById('userLevel').innerText = appState.level;
            document.getElementById('rewardLevel').innerText = appState.level;
            const xpPercent = (appState.xp / (appState.level * 100)) * 100;
            document.getElementById('xpBar').style.width = `${Math.min(xpPercent, 100)}%`;
            document.getElementById('rewardXpBar').style.width = `${Math.min(xpPercent, 100)}%`;
            document.getElementById('currentXp').innerText = appState.xp;
            document.getElementById('maxXp').innerText = appState.level * 100;

            updateStats();
        }

        function updateTaskIcons(data) {
            const tasks = ['morning', 'classes', 'evening', 'bonus'];
            tasks.forEach(task => {
                const icon = document.getElementById(`icon${task.charAt(0).toUpperCase() + task.slice(1)}`);
                const card = document.getElementById(`task${task.charAt(0).toUpperCase() + task.slice(1)}`);
                if (data[task]) {
                    icon.classList.remove('fa-circle', 'text-slate-600');
                    icon.classList.add('fa-circle-check', 'text-green-400');
                    card.classList.add('bg-green-900/20');
                } else {
                    icon.classList.add('fa-circle', 'text-slate-600');
                    icon.classList.remove('fa-circle-check', 'text-green-400');
                    card.classList.remove('bg-green-900/20');
                }
            });
        }

        function calculateStreak() {
            let streak = 0;
            const today = new Date();
            for (let i = 0; i < 365; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const key = date.toISOString().split('T')[0];
                const log = appState.dailyLogs[key];
                if (log && (log.morning || log.evening)) {
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
            return count > 0 ? Math.round(total / count * 2) : 0;
        }

        // ==================== DAILY TASKS ====================
        function toggleDailyTask(task) {
            const todayKey = getTodayKey();
            if (!appState.dailyLogs[todayKey]) {
                appState.dailyLogs[todayKey] = { date: todayKey };
            }
            appState.dailyLogs[todayKey][task] = !appState.dailyLogs[todayKey][task];
            
            let duration = 0;
            if (appState.dailyLogs[todayKey].morning) duration += 25;
            if (appState.dailyLogs[todayKey].evening) duration += 60;
            if (appState.dailyLogs[todayKey].bonus) duration += 30;
            appState.dailyLogs[todayKey].duration = duration;
            
            if (appState.dailyLogs[todayKey][task]) {
                addXP(10);
                checkBadges();
            }
            
            saveData();
            updateUI();
            updateChart();
        }

        function updateFocus(value) {
            const todayKey = getTodayKey();
            document.getElementById('focusValue').innerText = `${value}/5`;
            if (!appState.dailyLogs[todayKey]) {
                appState.dailyLogs[todayKey] = { date: todayKey };
            }
            appState.dailyLogs[todayKey].focus = parseInt(value);
            saveData();
        }

        function saveDailyData() {
            const todayKey = getTodayKey();
            if (!appState.dailyLogs[todayKey]) {
                appState.dailyLogs[todayKey] = { date: todayKey };
            }
            appState.dailyLogs[todayKey].phoneRespected = document.getElementById('phoneCheck').checked;
            saveData();
        }

        // ==================== NAVIGATION ====================
        function showSection(sectionId) {
            document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
            document.getElementById(`${sectionId}Section`).classList.remove('hidden');
            
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            event.currentTarget.classList.add('active');
            
            const titles = {
                dashboard: { title: 'Dashboard', subtitle: 'Vue d\'ensemble' },
                planning: { title: 'Planning', subtitle: 'Emploi du temps' },
                journal: { title: 'Journal', subtitle: 'Suivi quotidien' },
                goals: { title: 'Objectifs', subtitle: 'Livrables à atteindre' },
                stats: { title: 'Performance', subtitle: 'Statistiques détaillées' },
                rewards: { title: 'Récompenses', subtitle: 'Gamification' },
                contract: { title: 'Contrat', subtitle: 'Engagement personnel' },
                focus: { title: 'Mode Focus', subtitle: 'Timer anti-distraction' }
            };
            
            document.getElementById('pageTitle').innerText = titles[sectionId].title;
            document.getElementById('pageSubtitle').innerText = titles[sectionId].subtitle;
            
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.add('hidden');
            
            if (sectionId === 'stats') {
                updateStats();
                updateCharts();
            }
            if (sectionId === 'rewards') {
                renderBadges();
            }
            if (sectionId === 'goals') {
                renderGoals();
            }
            if (sectionId === 'journal') {
                renderJournalHistory();
            }
        }

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('hidden');
        }

        function toggleNotifications() {
            const panel = document.getElementById('notificationsPanel');
            panel.classList.toggle('hidden');
            loadNotifications();
        }

        // ==================== JOURNAL ====================
        function saveJournalEntry() {
            const date = document.getElementById('journalDate').value;
            const duration = parseInt(document.getElementById('journalDuration').value) || 0;
            const focus = parseInt(document.getElementById('journalFocus').value);
            const phoneRespected = document.getElementById('journalPhone').checked;
            const distraction = document.getElementById('journalDistraction').checked;
            const notes = document.getElementById('journalNotes').value;
            
            if (!appState.dailyLogs[date]) {
                appState.dailyLogs[date] = { date };
            }
            
            appState.dailyLogs[date].duration = duration;
            appState.dailyLogs[date].focus = focus;
            appState.dailyLogs[date].phoneRespected = phoneRespected;
            appState.dailyLogs[date].distraction = distraction;
            appState.dailyLogs[date].notes = notes;
            
            saveData();
            renderJournalHistory();
            updateUI();
            
            alert('Entrée enregistrée avec succès !');
            document.getElementById('journalDuration').value = '';
            document.getElementById('journalNotes').value = '';
        }

        function renderJournalHistory() {
            const container = document.getElementById('journalHistory');
            const entries = Object.values(appState.dailyLogs).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
            
            if (entries.length === 0) {
                container.innerHTML = '<p class="text-slate-400 text-center py-8">Aucune entrée</p>';
                return;
            }
            
            container.innerHTML = entries.map(entry => `
                <div class="glass-card rounded-xl p-4">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-semibold text-white">${new Date(entry.date).toLocaleDateString('fr-FR')}</span>
                        <span class="text-xs ${entry.distraction ? 'text-red-400' : 'text-green-400'}">
                            ${entry.distraction ? '⚠️ Distrait' : '✅ Focus'}
                        </span>
                    </div>
                    <div class="flex gap-4 text-sm text-slate-400">
                        <span>⏱️ ${entry.duration || 0} min</span>
                        <span>🧠 ${entry.focus || 0}/5</span>
                        <span>📱 ${entry.phoneRespected ? 'OK' : 'NON'}</span>
                    </div>
                    ${entry.notes ? `<p class="text-xs text-slate-500 mt-2 italic">"${entry.notes}"</p>` : ''}
                </div>
            `).join('');
        }

        // ==================== GOALS ====================
        function addGoal() {
            const title = document.getElementById('goalTitle').value;
            const type = document.getElementById('goalType').value;
            const deadline = document.getElementById('goalDeadline').value;
            const desc = document.getElementById('goalDesc').value;
            
            if (!title || !deadline) {
                alert('Veuillez remplir le titre et la date limite');
                return;
            }
            
            const goal = {
                id: Date.now(),
                title,
                type,
                deadline,
                desc,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            appState.goals.push(goal);
            saveData();
            renderGoals();
            
            document.getElementById('goalTitle').value = '';
            document.getElementById('goalDesc').value = '';
            document.getElementById('goalDeadline').value = '';
        }

        function renderGoals() {
            const container = document.getElementById('goalsGrid');
            
            if (appState.goals.length === 0) {
                container.innerHTML = '<p class="text-slate-400 col-span-full text-center py-8">Aucun objectif défini</p>';
                return;
            }
            
            const typeIcons = {
                synthese: '📄',
                projet: '📊',
                revue: '📚',
                etude: '🧪'
            };
            
            container.innerHTML = appState.goals.map(goal => `
                <div class="glass-card rounded-xl p-4 border-l-4 ${goal.status === 'completed' ? 'border-green-500' : 'border-yellow-500'}">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-2xl">${typeIcons[goal.type]}</span>
                        <button onclick="toggleGoalStatus(${goal.id})" class="text-slate-400 hover:text-green-400">
                            <i class="fa-solid ${goal.status === 'completed' ? 'fa-circle-check text-green-400' : 'fa-circle'}"></i>
                        </button>
                    </div>
                    <h4 class="font-semibold text-white mb-1">${goal.title}</h4>
                    <p class="text-xs text-slate-400 mb-2">${goal.desc || ''}</p>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-500">📅 ${new Date(goal.deadline).toLocaleDateString('fr-FR')}</span>
                        <span class="${goal.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}">
                            ${goal.status === 'completed' ? 'Terminé' : 'En cours'}
                        </span>
                    </div>
                    <button onclick="deleteGoal(${goal.id})" class="mt-3 text-xs text-red-400 hover:text-red-300">
                        <i class="fa-solid fa-trash mr-1"></i>Supprimer
                    </button>
                </div>
            `).join('');
        }

        function toggleGoalStatus(id) {
            const goal = appState.goals.find(g => g.id === id);
            if (goal) {
                goal.status = goal.status === 'completed' ? 'pending' : 'completed';
                if (goal.status === 'completed') {
                    addXP(50);
                    checkBadges();
                }
                saveData();
                renderGoals();
            }
        }

        function deleteGoal(id) {
            if (confirm('Supprimer cet objectif ?')) {
                appState.goals = appState.goals.filter(g => g.id !== id);
                saveData();
                renderGoals();
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

        // ==================== FOCUS TIMER ====================
        function setFocusMode(mode) {
            const times = [1500, 2400, 3600];
            focusMode = mode;
            focusTimeLeft = times[mode];
            focusRunning = false;
            clearInterval(focusTimerInterval);
            updateFocusTimerDisplay();
            document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-play mr-2"></i>Démarrer';
        }

        function toggleFocusTimer() {
            if (focusRunning) {
                clearInterval(focusTimerInterval);
                focusRunning = false;
                document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-play mr-2"></i>Reprendre';
            } else {
                focusRunning = true;
                document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-pause mr-2"></i>Pause';
                focusTimerInterval = setInterval(() => {
                    if (focusTimeLeft > 0) {
                        focusTimeLeft--;
                        updateFocusTimerDisplay();
                    } else {
                        clearInterval(focusTimerInterval);
                        focusRunning = false;
                        document.getElementById('focusToggleBtn').innerHTML = '<i class="fa-solid fa-play mr-2"></i>Démarrer';
                        
                        const todayKey = getTodayKey();
                        const sessionDuration = focusMode === 0 ? 25 : focusMode === 1 ? 40 : 60;
                        
                        if (!appState.sessions[todayKey]) {
                            appState.sessions[todayKey] = [];
                        }
                        appState.sessions[todayKey].push({
                            duration: sessionDuration,
                            completedAt: new Date().toISOString()
                        });
                        
                        if (!appState.dailyLogs[todayKey]) {
                            appState.dailyLogs[todayKey] = { date: todayKey };
                        }
                        appState.dailyLogs[todayKey].duration = (appState.dailyLogs[todayKey].duration || 0) + sessionDuration;
                        
                        addXP(20);
                        saveData();
                        updateUI();
                        renderSessionLog();
                        
                        alert('Session terminée ! +20 XP');
                    }
                }, 1000);
            }
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
            { id: 'focus_master', name: 'Maître du Focus', icon: '🧘', requirement: () => {
                const logs = Object.values(appState.dailyLogs);
                return logs.filter(l => l.focus >= 5).length >= 10;
            }},
            { id: 'goal_crusher', name: 'Objectif Atteint', icon: '🏆', requirement: () => {
                return appState.goals.some(g => g.status === 'completed');
            }},
            { id: 'perfect_week', name: 'Semaine Parfaite', icon: '💎', requirement: () => calculateWeeklyScore() >= 9 },
            { id: 'halfway', name: 'Moitié du Chemin', icon: '⛰️', requirement: () => getDayNumber() >= 45 },
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
            
            if (total < 21) {
                alert(`Score: ${total}/30 - Correction immédiate requise !`);
            } else {
                alert(`Score: ${total}/30 - Excellent travail !`);
                addXP(30);
            }
            
            document.getElementById('totalScore').innerText = `${total}/30`;
            document.getElementById('scoreMessage').innerText = total < 21 ? 
                'Score < 21/30 → Correction immédiate' : 
                'Score ≥ 21/30 → Semaine réussie !';
        }

        ['eval1', 'eval2', 'eval3'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                const total = parseInt(document.getElementById('eval1').value) +
                             parseInt(document.getElementById('eval2').value) +
                             parseInt(document.getElementById('eval3').value);
                document.getElementById('totalScore').innerText = `${total}/30`;
                document.getElementById('scoreMessage').innerText = total < 21 ? 
                    'Score < 21/30 → Correction immédiate' : 
                    'Score ≥ 21/30 → Semaine réussie !';
            });
        });

        // ==================== STATS & CHARTS ====================
        function initCharts() {
            const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
            weeklyChartInstance = new Chart(weeklyCtx, {
                type: 'bar',
                data: {
                    labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
                    datasets: [{
                        label: 'Objectif 60min',
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
                        y: { beginAtZero: true, max: 1, ticks: { display: false }, grid: { color: '#334155' } },
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
                        label: 'Score Discipline',
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
                        y: { beginAtZero: true, max: 10, grid: { color: '#334155' } },
                        x: { grid: { display: false } }
                    }
                }
            });

            const timeCtx = document.getElementById('timeChart').getContext('2d');
            timeChartInstance = new Chart(timeCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Matin', 'Soir', 'Bonus'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#eab308', '#22c55e', '#a855f7'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });

            updateChart();
        }

        function updateChart() {
            if (!weeklyChartInstance) return;
            
            const data = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split('T')[0];
                const log = appState.dailyLogs[key];
                data.push((log && (log.morning || log.evening)) ? 1 : 0);
            }
            
            weeklyChartInstance.data.datasets[0].data = data;
            weeklyChartInstance.update();
        }

        function updateCharts() {
            const labels = [];
            const scores = [];
            const today = new Date();
            
            for (let i = 13; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
                
                const key = d.toISOString().split('T')[0];
                const log = appState.dailyLogs[key];
                scores.push(log ? (log.focus || 3) * 2 : 0);
            }
            
            disciplineChartInstance.data.labels = labels;
            disciplineChartInstance.data.datasets[0].data = scores;
            disciplineChartInstance.update();

            let morning = 0, evening = 0, bonus = 0;
            Object.values(appState.dailyLogs).forEach(log => {
                if (log.morning) morning += 25;
                if (log.evening) evening += 60;
                if (log.bonus) bonus += 30;
            });
            
            timeChartInstance.data.datasets[0].data = [morning, evening, bonus];
            timeChartInstance.update();
        }

        function updateStats() {
            const logs = Object.values(appState.dailyLogs);
            const completedDays = logs.filter(l => l.morning || l.evening).length;
            const totalMinutes = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
            const distractedDays = logs.filter(l => l.distraction).length;
            
            document.getElementById('statSuccessRate').innerText = logs.length > 0 ? 
                `${Math.round((completedDays / logs.length) * 100)}%` : '0%';
            document.getElementById('statAvgMinutes').innerText = logs.length > 0 ?
                Math.round(totalMinutes / logs.length) : 0;
            document.getElementById('statMissedDays').innerText = Math.max(0, getDayNumber() - completedDays);
            document.getElementById('statDistractionRate').innerText = logs.length > 0 ?
                `${Math.round((distractedDays / logs.length) * 100)}%` : '0%';
        }

        function renderHeatmap() {
            const container = document.getElementById('heatmap');
            const days = 90;
            let html = '';
            
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split('T')[0];
                const log = appState.dailyLogs[key];
                
                let intensity = 0;
                if (log) {
                    if (log.morning) intensity++;
                    if (log.evening) intensity++;
                    if (log.bonus) intensity++;
                    if (log.focus >= 4) intensity++;
                }
                
                html += `<div class="heatmap-day heatmap-${Math.min(intensity, 4)}" title="${key}: ${intensity} points"></div>`;
            }
            
            container.innerHTML = html;
        }

        // ==================== NOTIFICATIONS ====================
        function showNotification(message) {
            const panel = document.getElementById('notificationsPanel');
            const list = document.getElementById('notificationsList');
            
            const notif = document.createElement('div');
            notif.className = 'glass-card rounded-lg p-3 text-sm animate-pulse';
            notif.innerHTML = `<i class="fa-solid fa-bell text-green-400 mr-2"></i>${message}`;
            
            list.insertBefore(notif, list.firstChild);
            
            const count = list.children.length;
            document.getElementById('notifBadge').innerText = count;
            document.getElementById('notifBadge').classList.remove('hidden');
            
            panel.classList.remove('hidden');
            
            setTimeout(() => {
                panel.classList.add('hidden');
            }, 5000);
        }

        function loadNotifications() {
            const list = document.getElementById('notificationsList');
            const dayNum = getDayNumber();
            
            let notifs = [];
            
            if (dayNum === 1) notifs.push('🎯 Bienvenue dans le challenge J90 !');
            if (dayNum === 30) notifs.push('🎉 Phase 1 terminée ! Passe en Phase 2 !');
            if (dayNum === 60) notifs.push('🔥 Phase 2 terminée ! Dernière ligne droite !');
            if (calculateStreak() >= 7) notifs.push('🔥 Streak de 7 jours ! Continue comme ça !');
            
            const todayKey = getTodayKey();
            const todayLog = appState.dailyLogs[todayKey];
            if (todayLog && !todayLog.evening && new Date().getHours() >= 20) {
                notifs.push('⚠️ Session du soir pas encore faite !');
            }
            
            list.innerHTML = notifs.map(n => `
                <div class="glass-card rounded-lg p-3 text-sm">
                    ${n}
                </div>
            `).join('');
            
            document.getElementById('notifBadge').innerText = notifs.length;
            if (notifs.length > 0) {
                document.getElementById('notifBadge').classList.remove('hidden');
            }
        }

        // ==================== WEEKLY REPORT PDF ====================
        async function generateWeeklyReport() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            const dayNum = getDayNumber();
            const weekScore = calculateWeeklyScore();
            const logs = Object.values(appState.dailyLogs);
            const totalMinutes = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
            const completedDays = logs.filter(l => l.morning || l.evening).length;
            
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(34, 197, 94);
            doc.setFontSize(24);
            doc.text('RAPPORT HEBDOMADAIRE', 105, 20, { align: 'center' });
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text(`Challenge Pharmacien Expert - Jour ${dayNum}/90`, 105, 30, { align: 'center' });
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text('📊 Statistiques de la Semaine', 20, 55);
            
            doc.setFontSize(12);
            doc.text(`• Score Discipline: ${weekScore}/10`, 20, 65);
            doc.text(`• Total Minutes: ${totalMinutes} min`, 20, 75);
            doc.text(`• Jours Complétés: ${completedDays}`, 20, 85);
            doc.text(`• Niveau Actuel: ${appState.level}`, 20, 95);
            doc.text(`• Badges Débloqués: ${appState.badges.length}`, 20, 105);
            
            doc.setFontSize(14);
            doc.text('📝 Auto-Évaluation', 20, 125);
            
            const lastEval = appState.weeklyEvaluations[appState.weeklyEvaluations.length - 1];
            if (lastEval) {
                doc.setFontSize(12);
                doc.text(`Respect 60min/jour: ${lastEval.scores[0]}/10`, 20, 135);
                doc.text(`Production: ${lastEval.scores[1]}/10`, 20, 145);
                doc.text(`Progression: ${lastEval.scores[2]}/10`, 20, 155);
                doc.text(`Total: ${lastEval.total}/30`, 20, 165);
                
                if (lastEval.total < 21) {
                    doc.setTextColor(239, 68, 68);
                    doc.text('⚠️ Correction immédiate requise !', 20, 175);
                } else {
                    doc.setTextColor(34, 197, 94);
                    doc.text('✅ Semaine réussie !', 20, 175);
                }
            } else {
                doc.setTextColor(100, 100, 100);
                doc.text('Aucune évaluation enregistrée', 20, 135);
            }
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text('💡 Recommandations', 20, 195);
            
            doc.setFontSize(11);
            const recommendations = [];
            if (weekScore < 7) recommendations.push('• Augmenter le temps de focus quotidien');
            if (totalMinutes < 420) recommendations.push('• Atteindre minimum 60min/jour');
            if (appState.badges.length < 3) recommendations.push('• Viser les premiers badges');
            if (recommendations.length === 0) recommendations.push('• Continuer sur cette lancée !');
            
            recommendations.forEach((rec, i) => {
                doc.text(rec, 20, 205 + (i * 10));
            });
            
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(10);
            doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 280, { align: 'center' });
            
            doc.save(`rapport-semaine-j${dayNum}.pdf`);
        }

        // ==================== EVENT LISTENERS ====================
        document.getElementById('focusSlider').addEventListener('input', function() {
            document.getElementById('focusValue').innerText = `${this.value}/5`;
        });

        // Check if install was dismissed
        if (localStorage.getItem('pwaInstallDismissed') === 'true') {
            document.getElementById('installBanner').style.display = 'none';
        }

        // Initialize
        init();
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('Service Worker enregistré !', reg))
                    .catch(err => console.log('Erreur d\'enregistrement du Service Worker', err));
            });
        }
