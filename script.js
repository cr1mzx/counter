const COLOR_THEMES = {
    default: { bg: 'bg-[#e2e8f0]', text: 'text-[#0f172a]', numText: 'text-[#0f172a]', btnMinus: 'bg-[#0f172a]/10 text-[#0f172a] hover:bg-[#0f172a]/15', btnPlus: 'bg-[#0f172a]/80 text-white hover:bg-[#0f172a]', hex: '#e2e8f0' },
    sky: { bg: 'bg-sky-400', text: 'text-[#0f172a]', numText: 'text-[#0f172a]', btnMinus: 'bg-[#0f172a]/10 text-[#0f172a] hover:bg-[#0f172a]/15', btnPlus: 'bg-[#0f172a]/80 text-white hover:bg-[#0f172a]', hex: '#38bdf8' },
    emerald: { bg: 'bg-emerald-400', text: 'text-[#0f172a]', numText: 'text-[#0f172a]', btnMinus: 'bg-[#0f172a]/10 text-[#0f172a] hover:bg-[#0f172a]/15', btnPlus: 'bg-[#0f172a]/80 text-white hover:bg-[#0f172a]', hex: '#34d399' },
    purple: { bg: 'bg-purple-400', text: 'text-[#0f172a]', numText: 'text-[#0f172a]', btnMinus: 'bg-[#0f172a]/10 text-[#0f172a] hover:bg-[#0f172a]/15', btnPlus: 'bg-[#0f172a]/80 text-white hover:bg-[#0f172a]', hex: '#a78bfa' },
    amber: { bg: 'bg-amber-400', text: 'text-[#0f172a]', numText: 'text-[#0f172a]', btnMinus: 'bg-[#0f172a]/10 text-[#0f172a] hover:bg-[#0f172a]/15', btnPlus: 'bg-[#0f172a]/80 text-white hover:bg-[#0f172a]', hex: '#fbbf24' },
    rose: { bg: 'bg-rose-400', text: 'text-[#0f172a]', numText: 'text-[#0f172a]', btnMinus: 'bg-[#0f172a]/10 text-[#0f172a] hover:bg-[#0f172a]/15', btnPlus: 'bg-[#0f172a]/80 text-white hover:bg-[#0f172a]', hex: '#fb7185' }
};

let selectedColorTheme = 'default';

class SoundFX {
    constructor() { this.ctx = null; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    playClick() {
        if (!appSettings.sound) return;
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.04);
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.04);
        } catch (e) {}
    }
}
const audioFX = new SoundFX();

let groups = [{ id: 'default', title: 'Мои счётчики' }];
let activeGroupId = 'default';

let counters = [];
let statsLog = [];
let activeCounterId = null;
let editingCounterId = null;
let isLocked = false;
let statsChartInstance = null;
let previousDisplayedValueStr = null;
let currentStatsPeriod = '1d';
let currentFilteredPeriodLogs = [];

let appSettings = { vibration: true, sound: true };

// Вспомогательная функция для получения текущей даты в формате YYYY-MM-DD по местному времени
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function loadData() {
    // Поддержка миграции со старых ключей версий (_v3, _v2, без суффиксов), чтобы не терять данные
    const savedGroups = localStorage.getItem('newcounter_groups_v4') || localStorage.getItem('newcounter_groups_v3') || localStorage.getItem('newcounter_groups');
    const savedActiveGroup = localStorage.getItem('newcounter_active_group_v4') || localStorage.getItem('newcounter_active_group_v3') || localStorage.getItem('newcounter_active_group');
    const savedCounters = localStorage.getItem('newcounter_counters_v4') || localStorage.getItem('newcounter_counters_v3') || localStorage.getItem('newcounter_counters');
    const savedSettings = localStorage.getItem('newcounter_settings_v4') || localStorage.getItem('newcounter_settings_v3') || localStorage.getItem('newcounter_settings');
    const savedStats = localStorage.getItem('newcounter_stats_v4') || localStorage.getItem('newcounter_stats_v3') || localStorage.getItem('newcounter_stats');

    if (savedGroups) try { groups = JSON.parse(savedGroups); } catch(e){}
    if (savedActiveGroup && groups.some(g => g.id === savedActiveGroup)) activeGroupId = savedActiveGroup;

    if (savedCounters) try { counters = JSON.parse(savedCounters); } catch(e){ counters = []; }
    if (savedSettings) try { appSettings = { ...appSettings, ...JSON.parse(savedSettings) }; } catch(e){}
    if (savedStats) try { statsLog = JSON.parse(savedStats); } catch(e){ statsLog = []; }

    document.getElementById('setting-vibration').checked = appSettings.vibration;
    document.getElementById('setting-sound').checked = appSettings.sound;

    checkAutoResets();
    updateGroupHeaderTitle();
}

function saveData() {
    localStorage.setItem('newcounter_groups_v4', JSON.stringify(groups));
    localStorage.setItem('newcounter_active_group_v4', activeGroupId);
    localStorage.setItem('newcounter_counters_v4', JSON.stringify(counters));
    localStorage.setItem('newcounter_settings_v4', JSON.stringify(appSettings));
    localStorage.setItem('newcounter_stats_v4', JSON.stringify(statsLog));
}

function updateGroupHeaderTitle() {
    const group = groups.find(g => g.id === activeGroupId) || groups[0];
    document.getElementById('current-group-title').innerText = group.title;
    document.getElementById('stats-current-group-badge').innerText = group.title;
}

function toggleGroupsMenu() {
    const dropdown = document.getElementById('groups-dropdown-menu');
    const arrow = document.getElementById('group-arrow-icon');
    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
        renderGroupsDropdown();
        dropdown.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        dropdown.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function renderGroupsDropdown() {
    const container = document.getElementById('groups-list-container');
    container.innerHTML = '';

    groups.forEach(g => {
        const item = document.createElement('div');
        item.className = `px-3 py-2 text-xs font-medium cursor-pointer flex items-center justify-between hover:bg-zinc-800/80 ${g.id === activeGroupId ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}`;
        item.innerHTML = `
            <span class="truncate">${escapeHtml(g.title)}</span>
            ${g.id === activeGroupId ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>' : ''}
        `;
        item.addEventListener('click', () => {
            selectGroup(g.id);
            toggleGroupsMenu();
        });
        container.appendChild(item);
    });
    lucide.createIcons();
}

function selectGroup(groupId) {
    activeGroupId = groupId;
    saveData();
    updateGroupHeaderTitle();
    renderCountersList();
    if (!document.getElementById('tab-stats').classList.contains('hidden')) {
        updateStatsCounterFilterOptions();
        renderStats();
    }
}

function openAddGroupModal() {
    toggleGroupsMenu();
    document.getElementById('modal-group-input-title').value = '';
    document.getElementById('modal-group').classList.remove('hidden');
}

function closeAddGroupModal() {
    document.getElementById('modal-group').classList.add('hidden');
}

function saveNewGroup() {
    const title = document.getElementById('modal-group-input-title').value.trim();
    if (!title) return;

    const newGroupId = Date.now().toString();
    groups.push({ id: newGroupId, title: title });
    selectGroup(newGroupId);
    closeAddGroupModal();
}

function checkAutoResets() {
    const now = new Date();
    let changed = false;

    counters.forEach(c => {
        if (!c.resetPeriod || c.resetPeriod === 'none') return;
        const last = c.lastReset ? new Date(c.lastReset) : new Date(0);

        let shouldReset = false;
        if (c.resetPeriod === 'hourly' && (now - last) >= 3600000) shouldReset = true;
        else if (c.resetPeriod === 'daily' && now.toDateString() !== last.toDateString()) shouldReset = true;
        else if (c.resetPeriod === 'weekly' && (now - last) >= 604800000) shouldReset = true;
        else if (c.resetPeriod === 'monthly' && now.getMonth() !== last.getMonth()) shouldReset = true;
        else if (c.resetPeriod === 'yearly' && now.getFullYear() !== last.getFullYear()) shouldReset = true;

        if (shouldReset) {
            if (c.value !== 0) {
                statsLog.push({
                    counterId: c.id,
                    groupId: c.groupId || 'default',
                    timestamp: Date.now(),
                    delta: -c.value
                });
            }
            c.value = 0;
            c.lastReset = Date.now();
            changed = true;
        }
    });

    if (changed) saveData();
}

function triggerFeedback() {
    if (appSettings.vibration && navigator.vibrate) navigator.vibrate(12);
    if (appSettings.sound) audioFX.playClick();
}

function deleteCounter(id) {
    const counter = counters.find(c => c.id === id);
    const title = counter ? counter.title : 'счётчик';
    
    if (confirm(`Вы действительно хотите удалить "${title}"?`)) {
        counters = counters.filter(c => c.id !== id);
        statsLog = statsLog.filter(s => s.counterId !== id);
        
        if (activeCounterId === id) {
            document.getElementById('view-detail').classList.add('hidden');
            activeCounterId = null;
        }

        saveData();
        renderCountersList();
        if (!document.getElementById('tab-stats').classList.contains('hidden')) {
            updateStatsCounterFilterOptions();
            renderStats();
        }
    }
}

function renderReels(number, direction = 'up', forceRebuild = false) {
    const container = document.getElementById('detail-counter-value');
    const newStr = number.toString();
    
    if (forceRebuild || !previousDisplayedValueStr) {
        container.innerHTML = '';
        for (let i = 0; i < newStr.length; i++) {
            const char = newStr[i];
            if (/\d/.test(char)) {
                const digitBox = document.createElement('div');
                digitBox.className = 'digit-container';
                digitBox.innerHTML = `<div class="digit-reel"><div class="digit-num">${char}</div></div>`;
                container.appendChild(digitBox);
            } else {
                const sign = document.createElement('span');
                sign.innerText = char;
                container.appendChild(sign);
            }
        }
        previousDisplayedValueStr = newStr;
        return;
    }

    const oldStr = previousDisplayedValueStr;
    const diff = newStr.length - oldStr.length;

    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            const digitBox = document.createElement('div');
            digitBox.className = 'digit-container';
            digitBox.innerHTML = `<div class="digit-reel"><div class="digit-num"></div></div>`;
            container.insertBefore(digitBox, container.firstChild);
        }
    } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) {
            if (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
    }

    const reels = container.querySelectorAll('.digit-reel');
    let reelIdx = 0;

    for (let i = 0; i < newStr.length; i++) {
        const newChar = newStr[i];
        if (!/\d/.test(newChar)) continue;

        const reel = reels[reelIdx++];
        if (!reel) continue;

        let prevChar = '';
        if (diff > 0) {
            prevChar = (i < diff) ? '' : oldStr[i - diff];
        } else if (diff < 0) {
            prevChar = oldStr[i + Math.abs(diff)];
        } else {
            prevChar = oldStr[i];
        }

        if (prevChar !== newChar) {
            reel.classList.remove('animate-up', 'animate-down');
            
            if (direction === 'up') {
                reel.innerHTML = `<div class="digit-num">${prevChar}</div><div class="digit-num">${newChar}</div>`;
                void reel.offsetWidth;
                reel.classList.add('animate-up');
            } else {
                reel.innerHTML = `<div class="digit-num">${newChar}</div><div class="digit-num">${prevChar}</div>`;
                void reel.offsetWidth;
                reel.classList.add('animate-down');
            }
        }
    }

    previousDisplayedValueStr = newStr;
}

function renderCountersList() {
    const container = document.getElementById('counters-container');
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    container.innerHTML = '';

    const filtered = counters.filter(c => (c.groupId || 'default') === activeGroupId && c.title.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-zinc-500 text-sm">В этой группе нет счётчиков</div>`;
        lucide.createIcons();
        return;
    }

    filtered.forEach(c => {
        const theme = COLOR_THEMES[c.color || 'default'] || COLOR_THEMES.default;
        const wrapper = document.createElement('div');
        wrapper.className = "swipe-container";

        wrapper.innerHTML = `
            <div class="swipe-action-left" onclick="deleteCounter('${c.id}')">
                <i data-lucide="trash-2" class="w-6 h-6"></i>
            </div>
            <div class="swipe-content ${theme.bg} ${theme.text} rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 cursor-pointer hover:brightness-105">
                <div class="flex-1 min-w-0" onclick="openDetailView('${c.id}')">
                    <h3 class="font-bold text-base truncate">${escapeHtml(c.title)}</h3>
                    <span class="text-3xl font-black ${theme.numText}">${c.value}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="event.stopPropagation(); changeCounterValue('${c.id}', -${c.step})" class="w-9 h-11 rounded-xl ${theme.btnMinus} flex items-center justify-center font-bold btn-press-micro">
                        <i data-lucide="minus" class="w-4 h-4 stroke-[3]"></i>
                    </button>
                    <button onclick="event.stopPropagation(); changeCounterValue('${c.id}', ${c.step})" class="w-12 h-11 rounded-xl ${theme.btnPlus} flex items-center justify-center font-bold btn-press-micro">
                        <i data-lucide="plus" class="w-5 h-5 stroke-[3]"></i>
                    </button>
                </div>
            </div>
        `;

        const swipeContent = wrapper.querySelector('.swipe-content');
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        const onTouchStart = (e) => {
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            isSwiping = true;
            swipeContent.classList.add('swiping');
        };

        const onTouchMove = (e) => {
            if (!isSwiping) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const diff = x - startX;
            if (diff > 0) {
                currentX = Math.min(diff, 90);
                swipeContent.style.transform = `translateX(${currentX}px)`;
            } else if (currentX > 0) {
                currentX = Math.max(0, 80 + diff);
                swipeContent.style.transform = `translateX(${currentX}px)`;
            }
        };

        const onTouchEnd = () => {
            if (!isSwiping) return;
            isSwiping = false;
            swipeContent.classList.remove('swiping');
            if (currentX > 40) {
                currentX = 80;
                swipeContent.style.transform = `translateX(80px)`;
            } else {
                currentX = 0;
                swipeContent.style.transform = `translateX(0px)`;
            }
        };

        swipeContent.addEventListener('touchstart', onTouchStart, { passive: true });
        swipeContent.addEventListener('touchmove', onTouchMove, { passive: true });
        swipeContent.addEventListener('touchend', onTouchEnd);

        swipeContent.addEventListener('mousedown', onTouchStart);
        window.addEventListener('mousemove', onTouchMove);
        window.addEventListener('mouseup', onTouchEnd);

        container.appendChild(wrapper);
    });

    lucide.createIcons();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function changeCounterValue(id, delta) {
    const counter = counters.find(c => c.id === id);
    if (!counter) return;

    const newValue = counter.value + delta;
    if (newValue < 0) return;

    const actualDelta = newValue - counter.value;
    counter.value = newValue;
    
    if (actualDelta !== 0) {
        statsLog.push({
            counterId: counter.id,
            groupId: counter.groupId || 'default',
            timestamp: Date.now(),
            delta: actualDelta
        });
    }
    saveData();
    triggerFeedback();

    if (activeCounterId === id) {
        renderReels(counter.value, delta > 0 ? 'up' : 'down');
    }
    renderCountersList();
}

function openDetailView(id) {
    activeCounterId = id;
    const counter = counters.find(c => c.id === activeCounterId);
    if (!counter) return;

    isLocked = false;
    const lockIcon = document.getElementById('lock-icon');
    if (lockIcon) {
        lockIcon.setAttribute('data-lucide', 'unlock');
        document.getElementById('btn-big-plus').classList.remove('opacity-40');
    }

    document.getElementById('detail-counter-title').innerText = counter.title;
    const theme = COLOR_THEMES[counter.color || 'default'] || COLOR_THEMES.default;
    document.getElementById('detail-color-badge').style.backgroundColor = theme.hex;

    const periodLabels = { hourly: 'Обнуление: Раз в час', daily: 'Обнуление: Каждый день', weekly: 'Обнуление: Раз в неделю', monthly: 'Обнуление: Раз в месяц', yearly: 'Обнуление: Раз в год' };
    document.getElementById('detail-reset-period').innerText = periodLabels[counter.resetPeriod] || '';
    
    previousDisplayedValueStr = null;
    renderReels(counter.value, 'up', true);
    document.getElementById('view-detail').classList.remove('hidden');
    lucide.createIcons();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    ['counters', 'stats', 'settings'].forEach(t => {
        const btn = document.getElementById(`nav-btn-${t}`);
        if (btn) {
            if (t === tabName) btn.className = 'flex flex-col items-center gap-0.5 text-white';
            else btn.className = 'flex flex-col items-center gap-0.5 text-zinc-500';
        }
    });

    if (tabName === 'stats') {
        updateStatsCounterFilterOptions();
        renderStats();
    }
}

function openAddModal() {
    editingCounterId = null;
    document.getElementById('modal-title').innerText = "Новый счётчик";
    document.getElementById('modal-input-title').value = "";
    
    document.getElementById('modal-container-value').classList.remove('hidden');
    document.getElementById('modal-input-value').value = 0;
    
    document.getElementById('modal-input-step').value = 1;
    document.getElementById('modal-input-reset-period').value = "none";
    selectColorTheme('default');
    document.getElementById('modal-counter').classList.remove('hidden');
}

function selectColorTheme(colorKey) {
    selectedColorTheme = colorKey;
    document.querySelectorAll('#color-selector .color-option').forEach(el => {
        if (el.dataset.color === colorKey) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

function updateStatsCounterFilterOptions() {
    const select = document.getElementById('stats-counter-filter');
    const currentVal = select.value;
    select.innerHTML = '<option value="all">Все счётчики группы</option>';

    const groupCounters = counters.filter(c => (c.groupId || 'default') === activeGroupId);
    groupCounters.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.title;
        select.appendChild(opt);
    });
    if (groupCounters.some(c => c.id === currentVal)) {
        select.value = currentVal;
    } else {
        select.value = 'all';
    }
}

function setStatsPeriod(period) {
    currentStatsPeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`period-btn-${period}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    renderStats();
}

function renderStats() {
    const picker = document.getElementById('stats-date-picker');
    
    // Если дата в пикере ещё не задана (при первом открытии), ставим сегодняшнюю
    if (!picker.value) {
        picker.value = getLocalDateString();
    }

    const selectedDate = new Date(picker.value + 'T00:00:00');
    const selectedCounterId = document.getElementById('stats-counter-filter').value;

    const groupCounters = counters.filter(c => (c.groupId || 'default') === activeGroupId);
    const activeCounterIds = new Set(groupCounters.map(c => c.id));
    const filteredLog = statsLog.filter(s => activeCounterIds.has(s.counterId) && (selectedCounterId === 'all' || s.counterId === selectedCounterId));

    const totalSumAllTime = filteredLog.reduce((acc, log) => acc + log.delta, 0);
    document.getElementById('stat-total-clicks').innerText = Math.max(0, totalSumAllTime);

    let periodStartTime = 0;
    let periodEndTime = Date.now();

    if (currentStatsPeriod === '1d') {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        periodStartTime = startOfDay.getTime();
        periodEndTime = endOfDay.getTime();
    } else if (currentStatsPeriod === '1w') {
        const curr = new Date(selectedDate);
        const day = curr.getDay();
        const diffToMon = (day === 0 ? -6 : 1 - day);
        
        const monday = new Date(curr);
        monday.setDate(curr.getDate() + diffToMon);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        periodStartTime = monday.getTime();
        periodEndTime = sunday.getTime();
    } else if (currentStatsPeriod === '1m') {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
        periodStartTime = startOfMonth.getTime();
        periodEndTime = endOfMonth.getTime();
    } else if (currentStatsPeriod === '6m') {
        const year = selectedDate.getFullYear();
        const currentMonth = selectedDate.getMonth();
        let startMonth, endMonth;
        
        if (currentMonth <= 5) {
            startMonth = 0;
            endMonth = 5;
        } else {
            startMonth = 6;
            endMonth = 11;
        }
        
        const startOf6m = new Date(year, startMonth, 1, 0, 0, 0, 0);
        const endOf6m = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
        periodStartTime = startOf6m.getTime();
        periodEndTime = endOf6m.getTime();
    } else if (currentStatsPeriod === '1y') {
        const startOfYear = new Date(selectedDate.getFullYear(), 0, 1, 0, 0, 0, 0);
        const endOfYear = new Date(selectedDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        periodStartTime = startOfYear.getTime();
        periodEndTime = endOfYear.getTime();
    } else if (currentStatsPeriod === 'all') {
        periodStartTime = 0;
        periodEndTime = Date.now();
    }

    currentFilteredPeriodLogs = filteredLog.filter(s => s.timestamp >= periodStartTime && s.timestamp <= periodEndTime);
    const selectedPeriodSum = currentFilteredPeriodLogs.reduce((acc, log) => acc + log.delta, 0);
    document.getElementById('stat-selected-period-sum').innerText = Math.max(0, selectedPeriodSum);

    const hourCounts = {};
    currentFilteredPeriodLogs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + log.delta;
    });

    let peakHour = null;
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
        const actualCount = Math.max(0, count);
        if (actualCount > maxCount) {
            maxCount = actualCount;
            peakHour = hour;
        }
    }

    if (peakHour !== null) {
        const hourFormatted = `${peakHour.toString().padStart(2, '0')}:00 - ${(parseInt(peakHour) + 1).toString().padStart(2, '0')}:00`;
        document.getElementById('stat-peak-hour').innerText = hourFormatted;
        document.getElementById('stat-peak-count').innerText = `${maxCount} нажатий`;
    } else {
        document.getElementById('stat-peak-hour').innerText = "Нет данных";
        document.getElementById('stat-peak-count').innerText = "0 нажатий";
    }

    const logContainer = document.getElementById('stats-clicks-log-preview');
    logContainer.innerHTML = '';
    document.getElementById('clicks-log-count').innerText = `${currentFilteredPeriodLogs.length} записей`;

    const sortedLog = [...currentFilteredPeriodLogs].sort((a, b) => b.timestamp - a.timestamp);

    if (sortedLog.length === 0) {
        logContainer.innerHTML = `<p class="text-xs text-zinc-500 py-1">Нет записей активности</p>`;
    } else {
        sortedLog.slice(0, 3).forEach(log => {
            const liveCounter = counters.find(c => c.id === log.counterId);
            const title = liveCounter ? liveCounter.title : 'Счётчик';
            const dateObj = new Date(log.timestamp);
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const item = document.createElement('div');
            item.className = "flex items-center justify-between text-xs py-1.5 px-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800/40";
            item.innerHTML = `
                <div class="flex items-center gap-2 min-w-0">
                    <span class="text-[10px] text-zinc-500 font-mono shrink-0">${timeStr}</span>
                    <span class="text-zinc-300 font-medium truncate">${escapeHtml(title)}</span>
                </div>
                <span class="font-bold shrink-0 ml-2 ${log.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}">
                    ${log.delta > 0 ? '+' + log.delta : log.delta}
                </span>
            `;
            logContainer.appendChild(item);
        });
    }

    renderChart(currentFilteredPeriodLogs, periodStartTime, periodEndTime, selectedDate);
}

function openFullHistoryModal() {
    const modal = document.getElementById('modal-full-history');
    const list = document.getElementById('modal-history-list');
    list.innerHTML = '';

    const sortedLog = [...currentFilteredPeriodLogs].sort((a, b) => b.timestamp - a.timestamp);

    if (sortedLog.length === 0) {
        list.innerHTML = `<p class="text-xs text-zinc-500 text-center py-8">История пуста за выбранный период</p>`;
    } else {
        sortedLog.forEach(log => {
            const liveCounter = counters.find(c => c.id === log.counterId);
            const title = liveCounter ? liveCounter.title : 'Счётчик';
            const dateObj = new Date(log.timestamp);
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });

            const item = document.createElement('div');
            item.className = "flex items-center justify-between text-xs py-2 px-3 bg-zinc-950 rounded-xl border border-zinc-800/60";
            item.innerHTML = `
                <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="text-zinc-200 font-semibold truncate">${escapeHtml(title)}</span>
                    <span class="text-[10px] text-zinc-500 font-mono">${dateStr} в ${timeStr}</span>
                </div>
                <span class="font-bold text-sm shrink-0 ml-3 ${log.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}">
                    ${log.delta > 0 ? '+' + log.delta : log.delta}
                </span>
            `;
            list.appendChild(item);
        });
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeFullHistoryModal() {
    document.getElementById('modal-full-history').classList.add('hidden');
}

function renderChart(logs, startTime, endTime, selectedDate) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    const chartTitle = document.getElementById('chart-title');
    
    let labels = [];
    let sums = [];

    if (currentStatsPeriod === '1d') {
        chartTitle.innerText = 'Динамика по часам';
        for (let i = 0; i < 24; i++) {
            labels.push(`${i.toString().padStart(2, '0')}:00`);
            const count = logs
                .filter(s => new Date(s.timestamp).getHours() === i)
                .reduce((acc, l) => acc + l.delta, 0);
            sums.push(Math.max(0, count));
        }
    } else if (currentStatsPeriod === '1w') {
        chartTitle.innerText = 'Динамика за неделю';
        const daysName = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const startDate = new Date(startTime);

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dayStr = d.toDateString();
            
            const dayNum = d.getDate();
            const dayOfWeek = daysName[d.getDay()];
            labels.push(`${dayNum} (${dayOfWeek})`);

            const daySum = logs
                .filter(s => new Date(s.timestamp).toDateString() === dayStr)
                .reduce((acc, log) => acc + log.delta, 0);
            sums.push(Math.max(0, daySum));
        }
    } else if (currentStatsPeriod === '1m') {
        chartTitle.innerText = 'Динамика по дням';
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            const dayStr = d.toDateString();
            labels.push(d.toLocaleDateString([], { day: 'numeric', month: 'short' }));
            
            const daySum = logs
                .filter(s => new Date(s.timestamp).toDateString() === dayStr)
                .reduce((acc, log) => acc + log.delta, 0);
            sums.push(Math.max(0, daySum));
        }
    } else {
        if (currentStatsPeriod === '1y') {
            chartTitle.innerText = 'Динамика по месяцам (Год)';
            const year = selectedDate.getFullYear();
            for (let m = 0; m < 12; m++) {
                const d = new Date(year, m, 1);
                const monthKey = `${year}-${m}`;
                labels.push(d.toLocaleDateString([], { month: 'short' }));
                
                const monthSum = logs
                    .filter(s => {
                        const sd = new Date(s.timestamp);
                        return `${sd.getFullYear()}-${sd.getMonth()}` === monthKey;
                    })
                    .reduce((acc, log) => acc + log.delta, 0);
                sums.push(Math.max(0, monthSum));
            }
        } else {
            const year = selectedDate.getFullYear();
            const currentMonth = selectedDate.getMonth();
            let startMonth = (currentMonth <= 5) ? 0 : 6;
            
            chartTitle.innerText = startMonth === 0 ? 'Динамика (Янв – Июн)' : 'Динамика (Июл – Дек)';
            
            for (let i = 0; i < 6; i++) {
                const m = startMonth + i;
                const d = new Date(year, m, 1);
                const monthKey = `${year}-${m}`;
                labels.push(d.toLocaleDateString([], { month: 'short' }));
                
                const monthSum = logs
                    .filter(s => {
                        const sd = new Date(s.timestamp);
                        return `${sd.getFullYear()}-${sd.getMonth()}` === monthKey;
                    })
                    .reduce((acc, log) => acc + log.delta, 0);
                sums.push(Math.max(0, monthSum));
            }
        }
    }

    if (statsChartInstance) statsChartInstance.destroy();

    statsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: sums,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 2.5,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                zoom: {
                    pan: { enabled: false },
                    zoom: {
                        wheel: { enabled: false },
                        pinch: { enabled: false },
                        mode: null
                    }
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#a1a1aa', font: { size: 9 } } 
                },
                y: { 
                    grid: { color: '#27272a' }, 
                    ticks: { color: '#a1a1aa', font: { size: 9 }, precision: 0 },
                    min: 0
                }
            }
        }
    });
}

function exportBackupJSON() {
    const backupData = {
        version: "4.1",
        exportDate: new Date().toISOString(),
        settings: appSettings,
        groups: groups,
        counters: counters,
        statsLog: statsLog
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `newcounter_backup_all_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importBackupJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.counters && Array.isArray(imported.counters) && imported.statsLog && Array.isArray(imported.statsLog)) {
                counters = imported.counters;
                statsLog = imported.statsLog;
                if (imported.groups && Array.isArray(imported.groups)) {
                    groups = imported.groups;
                    activeGroupId = groups[0] ? groups[0].id : 'default';
                }
                if (imported.settings) appSettings = { ...appSettings, ...JSON.parse(JSON.stringify(imported.settings)) };

                saveData();
                document.getElementById('setting-vibration').checked = appSettings.vibration;
                document.getElementById('setting-sound').checked = appSettings.sound;

                updateGroupHeaderTitle();
                renderCountersList();
                alert('Все данные всех групп успешно импортированы!');
            } else {
                alert('Неверный формат JSON файла!');
            }
        } catch(err) {
            alert('Ошибка чтения файла!');
        }
    };
    reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderCountersList();

    const picker = document.getElementById('stats-date-picker');
    if (picker) {
        picker.value = getLocalDateString();
    }

    document.getElementById('btn-toggle-groups-menu').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleGroupsMenu();
    });

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('groups-dropdown-menu');
        if (!menu.classList.contains('hidden') && !menu.contains(e.target)) {
            toggleGroupsMenu();
        }
    });

    document.querySelectorAll('#color-selector .color-option').forEach(el => {
        el.addEventListener('click', () => {
            selectColorTheme(el.dataset.color);
        });
    });

    document.getElementById('stats-date-picker').addEventListener('change', () => {
        renderStats();
    });
    document.getElementById('stats-counter-filter').addEventListener('change', renderStats);

    document.getElementById('btn-open-search').addEventListener('click', () => {
        const search = document.getElementById('search-bar-container');
        search.classList.toggle('hidden');
    });
    document.getElementById('search-input').addEventListener('input', renderCountersList);

    document.getElementById('btn-back-to-list').addEventListener('click', () => {
        document.getElementById('view-detail').classList.add('hidden');
        activeCounterId = null;
    });

    document.getElementById('btn-big-plus').addEventListener('click', () => {
        if (isLocked || !activeCounterId) return;
        const counter = counters.find(c => c.id === activeCounterId);
        if (counter) changeCounterValue(counter.id, counter.step);
    });

    document.getElementById('btn-big-minus').addEventListener('click', () => {
        if (isLocked || !activeCounterId) return;
        const counter = counters.find(c => c.id === activeCounterId);
        if (counter) changeCounterValue(counter.id, -counter.step);
    });

    document.getElementById('btn-big-reset').addEventListener('click', () => {
        if (isLocked || !activeCounterId) return;
        if (confirm('Сбросить счётчик?')) {
            const counter = counters.find(c => c.id === activeCounterId);
            if (counter) {
                if (counter.value !== 0) {
                    statsLog.push({
                        counterId: counter.id,
                        groupId: counter.groupId || 'default',
                        timestamp: Date.now(),
                        delta: -counter.value
                    });
                }
                counter.value = 0;
                saveData();
                triggerFeedback();

                previousDisplayedValueStr = null;
                renderReels(0, 'down', true);
                renderCountersList();
            }
        }
    });

    document.getElementById('btn-sub-lock').addEventListener('click', () => {
        isLocked = !isLocked;
        const lockIcon = document.getElementById('lock-icon');
        if (isLocked) {
            lockIcon.setAttribute('data-lucide', 'lock');
            document.getElementById('btn-big-plus').classList.add('opacity-40');
        } else {
            lockIcon.setAttribute('data-lucide', 'unlock');
            document.getElementById('btn-big-plus').classList.remove('opacity-40');
        }
        lucide.createIcons();
    });

    document.getElementById('btn-edit-counter').addEventListener('click', () => {
        if (!activeCounterId) return;
        const counter = counters.find(c => c.id === activeCounterId);
        if (!counter) return;

        editingCounterId = counter.id;
        document.getElementById('modal-title').innerText = "Редактировать";
        document.getElementById('modal-input-title').value = counter.title;
        
        document.getElementById('modal-container-value').classList.add('hidden');

        document.getElementById('modal-input-step').value = counter.step || 1;
        document.getElementById('modal-input-reset-period').value = counter.resetPeriod || "none";
        selectColorTheme(counter.color || 'default');
        document.getElementById('modal-counter').classList.remove('hidden');
    });

    document.getElementById('modal-btn-cancel').addEventListener('click', () => {
        document.getElementById('modal-counter').classList.add('hidden');
    });

    document.getElementById('modal-btn-save').addEventListener('click', () => {
        let rawTitle = document.getElementById('modal-input-title').value.trim();
        const step = Math.max(1, parseInt(document.getElementById('modal-input-step').value) || 1);
        const period = document.getElementById('modal-input-reset-period').value;

        if (!rawTitle) {
            rawTitle = "Счётчик";
        }

        if (editingCounterId) {
            const counter = counters.find(c => c.id === editingCounterId);
            if (counter) {
                counter.title = rawTitle;
                counter.step = step;
                counter.resetPeriod = period;
                counter.color = selectedColorTheme;
            }
        } else {
            const groupCounters = counters.filter(c => (c.groupId || 'default') === activeGroupId);
            let finalTitle = rawTitle;
            
            const existingTitles = new Set(groupCounters.map(c => c.title));
            
            if (existingTitles.has(finalTitle)) {
                let index = 2;
                while (existingTitles.has(`${rawTitle} #${index}`)) {
                    index++;
                }
                finalTitle = `${rawTitle} #${index}`;
            }

            const val = Math.max(0, parseInt(document.getElementById('modal-input-value').value) || 0);
            const newId = Date.now().toString();
            counters.push({
                id: newId,
                groupId: activeGroupId,
                title: finalTitle,
                value: val,
                step: step,
                resetPeriod: period,
                color: selectedColorTheme,
                lastReset: Date.now()
            });
            if (val !== 0) {
                statsLog.push({
                    counterId: newId,
                    groupId: activeGroupId,
                    timestamp: Date.now(),
                    delta: val
                });
            }
        }

        saveData();
        renderCountersList();
        if (activeCounterId) {
            const counter = counters.find(c => c.id === activeCounterId);
            if (counter) {
                document.getElementById('detail-counter-title').innerText = counter.title;
                const theme = COLOR_THEMES[counter.color || 'default'] || COLOR_THEMES.default;
                document.getElementById('detail-color-badge').style.backgroundColor = theme.hex;

                const periodLabels = { hourly: 'Обнуление: Раз в час', daily: 'Обнуление: Каждый день', weekly: 'Обнуление: Раз в неделю', monthly: 'Обнуление: Раз в месяц', yearly: 'Обнуление: Раз в год' };
                document.getElementById('detail-reset-period').innerText = periodLabels[counter.resetPeriod] || '';
                renderReels(counter.value, 'up', true);
            }
        }
        document.getElementById('modal-counter').classList.add('hidden');
    });

    document.getElementById('setting-vibration').addEventListener('change', (e) => { appSettings.vibration = e.target.checked; saveData(); });
    document.getElementById('setting-sound').addEventListener('change', (e) => { appSettings.sound = e.target.checked; saveData(); });

    document.getElementById('btn-export-data').addEventListener('click', exportBackupJSON);
    document.getElementById('btn-import-trigger').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importBackupJSON(e.target.files[0]);
        }
    });

    document.getElementById('btn-clear-all').addEventListener('click', () => {
        if (confirm('Удалить ВСЕ данные, группы и статистику?')) {
            groups = [{ id: 'default', title: 'Мои счётчики' }];
            activeGroupId = 'default';
            counters = [];
            statsLog = [];
            saveData();
            updateGroupHeaderTitle();
            renderCountersList();
            switchTab('counters');
        }
    });
});