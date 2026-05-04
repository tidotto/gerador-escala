const API_URL = 'https://dotto.dev.br/api';
let teams = {}; // Será populado via API

let people = [];
const peopleListEl = document.getElementById('peopleList');
const teamSelect = document.getElementById('teamSelect');
const monthInput = document.getElementById('monthInput');
const selectedMonthDisplay = document.getElementById('selectedMonthDisplay');
const monthPickerModal = document.getElementById('monthPickerModal');
const pickerYearEl = document.getElementById('pickerYear');
const monthGrid = document.getElementById('monthGrid');
const customMonthToggle = document.getElementById('customMonthToggle');

const generateBtn = document.getElementById('generateBtn');
const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');

let currentPickerYear = 2026;
let isScaleGenerated = false; 
let ignoredHolidays = new Set();
let currentTeamId = null;

const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const holidayIgnoreList = document.getElementById('holidayIgnoreList');

// Configuração inicial
document.addEventListener('DOMContentLoaded', async () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    currentPickerYear = now.getFullYear();
    monthInput.value = `${currentPickerYear}-${month}`;
    updateMonthDisplay();
    renderMonthGrid();
    
    const [y, m] = monthInput.value.split('-');
    const mName = monthNames[parseInt(m) - 1];
    calendarTitle.innerText = `${mName} ${y}`;

    // Carregar equipes da API
    await loadTeams();
    clearScale(); 
});

async function loadTeams() {
    try {
        const response = await fetch(`${API_URL}/equipes`);
        const data = await response.json();
        
        teamSelect.innerHTML = '';
        data.forEach(team => {
            const opt = document.createElement('option');
            opt.value = team.id;
            opt.innerText = team.nome;
            teamSelect.appendChild(opt);
        });

        // Carregar a primeira equipe por padrão
        if (data.length > 0) {
            await selectTeam(data[0].id);
        }
    } catch (err) {
        console.error('Erro ao carregar equipes:', err);
    }
}

async function selectTeam(teamId) {
    try {
        currentTeamId = teamId;
        const response = await fetch(`${API_URL}/membros/${teamId}`);
        const data = await response.json();
        
        // Formatar para o formato esperado pelo gerador
        people = shuffleArray(data.map(m => ({ id: m.id, nome: m.nome, ausencias: m.ausencias || [] })));
        renderPeople();
    } catch (err) {
        console.error('Erro ao carregar membros:', err);
    }
}

// --- Custom Month Picker Logic ---

function updateMonthDisplay() {
    const [year, month] = monthInput.value.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    selectedMonthDisplay.innerText = `${monthName} de ${year}`;
    calendarTitle.innerText = `${monthName} ${year}`;
}

customMonthToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    monthPickerModal.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!monthPickerModal.contains(e.target) && e.target !== customMonthToggle) {
        monthPickerModal.classList.remove('active');
    }
});

function renderMonthGrid() {
    monthGrid.innerHTML = '';
    pickerYearEl.innerText = currentPickerYear;
    
    monthNames.forEach((name, index) => {
        const btn = document.createElement('div');
        btn.className = 'month-btn';
        const currentMonthVal = String(index + 1).padStart(2, '0');
        if (monthInput.value === `${currentPickerYear}-${currentMonthVal}`) {
            btn.classList.add('selected');
        }
        btn.innerText = name.substring(0, 3);
        btn.onclick = () => {
            monthInput.value = `${currentPickerYear}-${currentMonthVal}`;
            updateMonthDisplay();
            monthPickerModal.classList.remove('active');
            renderMonthGrid();
            clearScale(); // Limpa ao trocar de mês
        };
        monthGrid.appendChild(btn);
    });
}

document.getElementById('prevYear').onclick = (e) => { e.stopPropagation(); currentPickerYear--; renderMonthGrid(); };
document.getElementById('nextYear').onclick = (e) => { e.stopPropagation(); currentPickerYear++; renderMonthGrid(); };

// --- Event Listeners ---

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

teamSelect.addEventListener('change', async (e) => {
    const teamId = e.target.value;
    await selectTeam(teamId);
    clearScale();
});

// Adicionar ouvintes para os checkboxes de dias
document.querySelectorAll('.weekday-checkbox').forEach(cb => {
    cb.addEventListener('change', clearScale);
});

function clearScale() {
    // Reset grid (keep headers)
    const headers = calendarGrid.querySelectorAll('.calendar-header-day');
    calendarGrid.innerHTML = '';
    headers.forEach(h => calendarGrid.appendChild(h));
    
    // Mostrar mensagem baseada no estado
    document.getElementById('noDataMessage').style.display = 'block';
    
    if (!isScaleGenerated) {
        document.getElementById('noDataMessage').innerHTML = `
            <i class="ti ti-hand-click" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem; display: block;"></i>
            <p>Selecione a equipe e os filtros e clique em <b>Gerar Escala</b>.</p>
        `;
    } else {
        document.getElementById('noDataMessage').innerHTML = `
            <i class="ti ti-click" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem; display: block;"></i>
            <p>Ajuste os filtros e clique em <b>Gerar Escala</b> para atualizar.</p>
        `;
    }
}

generateBtn.addEventListener('click', generateScale);

// --- Funções de UI ---

function renderPeople() {
    peopleListEl.innerHTML = '';
    people.forEach((person, index) => {
        const tag = document.createElement('div');
        tag.className = 'person-tag';
        tag.innerHTML = `
            <span>${person.nome}</span>
            <button onclick="removePerson(${index})"><i class="ti ti-x"></i></button>
        `;
        peopleListEl.appendChild(tag);
    });
}

function removePerson(index) {
    people.splice(index, 1);
    renderPeople();
    clearScale(); // Limpa ao remover alguém
}

// --- Lógica de Feriados ---

function getEaster(year) {
    const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);

    return new Date(year, month - 1, day);
}

function getHolidays(year) {
    const easter = getEaster(year);
    const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    const holidays = {
        [`${year}-01-01`]: "Ano Novo",
        [`${year}-04-21`]: "Tiradentes",
        [`${year}-05-01`]: "Dia do Trabalho",
        [`${year}-09-07`]: "Independência",
        [`${year}-10-12`]: "Nossa Sra. Aparecida",
        [`${year}-11-02`]: "Finados",
        [`${year}-11-15`]: "Proclamação da República",
        [`${year}-11-20`]: "Dia de Zumbi",
        [`${year}-12-25`]: "Natal"
    };

    // Carnaval (47 dias antes da Páscoa)
    const carnaval = new Date(easter);
    carnaval.setDate(easter.getDate() - 47);
    holidays[formatDate(carnaval)] = "Carnaval";
    
    // Sexta-feira Santa (2 dias antes)
    const sextaSanta = new Date(easter);
    sextaSanta.setDate(easter.getDate() - 2);
    holidays[formatDate(sextaSanta)] = "Sexta-feira Santa";

    // Corpus Christi (60 dias depois)
    const corpus = new Date(easter);
    corpus.setDate(easter.getDate() + 60);
    holidays[formatDate(corpus)] = "Corpus Christi";

    return holidays;
}

// --- Gerador de Escala ---

function generateScale() {
    isScaleGenerated = true;
    saveBtn.style.display = 'flex'; // Mostra botão de salvar
    const [year, month] = monthInput.value.split('-').map(Number);
    const selectedMonth = month - 1; // 0-indexed
    
    const holidays = getHolidays(year);
    const allowedDays = Array.from(document.querySelectorAll('.weekday-checkbox:checked'))
                            .map(cb => Number(cb.value));
    
    // Reset grid
    const headers = calendarGrid.querySelectorAll('.calendar-header-day');
    calendarGrid.innerHTML = '';
    headers.forEach(h => calendarGrid.appendChild(h));

    if (people.length === 0 || allowedDays.length === 0) {
        document.getElementById('noDataMessage').style.display = 'block';
        return;
    } else {
        document.getElementById('noDataMessage').style.display = 'none';
    }

    // Algoritmo de Semanas por Maioria
    // Encontrar o primeiro domingo da primeira semana que toca o mês
    let currentDay = new Date(year, selectedMonth, 1);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay()); // Domingo da semana 1

    let weekOffset = 0;

    // Loop pelas semanas
    while (true) {
        let weekDays = [];
        let daysInSelectedMonth = 0;
        let weekHasHoliday = false;
        let holidayDetails = {};

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentDay);
            date.setDate(date.getDate() + i);
            weekDays.push(date);

            if (date.getMonth() === selectedMonth) {
                daysInSelectedMonth++;
            }

            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (holidays[dateStr] && !ignoredHolidays.has(dateStr)) {
                weekHasHoliday = true;
                holidayDetails[i] = holidays[dateStr];
            }
        }

        // Se a semana não tem a maioria no mês atual, decidimos se renderizamos
        // A regra é: uma semana pertence ao mês onde está a maioria dos seus dias (4 ou mais)
        if (daysInSelectedMonth >= 4) {
            // Renderizar esta semana
            renderWeek(weekDays, weekHasHoliday, holidayDetails, weekOffset, allowedDays);
            weekOffset++;
        } else {
            // Se já passamos do mês e a maioria não é mais aqui, paramos
            if (currentDay.getMonth() > selectedMonth || (currentDay.getMonth() === 0 && selectedMonth === 11)) {
                // Virada de ano
                if (currentDay.getFullYear() > year) break;
            }
            // Se a semana tem dias no mês mas não a maioria, e já renderizamos algo, ou estamos no fim
            if (daysInSelectedMonth > 0 && currentDay > new Date(year, selectedMonth, 15)) {
                // Provavelmente a última semana que pertence ao próximo mês
                break;
            }
        }

        // Mover para a próxima semana
        currentDay.setDate(currentDay.getDate() + 7);
        
        // Break condition extra para segurança
        if (currentDay > new Date(year, selectedMonth + 1, 7)) break;
    }
}

function renderWeek(days, hasHoliday, holidayDetails, weekOffset, allowedDays) {
    // 1. Identificar dias válidos para escala nesta semana
    let validDaysIndices = [];
    days.forEach((date, i) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const holidayName = ignoredHolidays.has(dateStr) ? null : holidayDetails[i];
        const isWeekend = (i === 0 || i === 6);
        if (!isWeekend && allowedDays.includes(i) && !hasHoliday && !holidayName) {
            validDaysIndices.push(i);
        }
    });

    // 2. Preparar distribuição de pessoas
    let assignmentsPerDay = {};
    if (validDaysIndices.length > 0) {
        people.forEach((person, idx) => {
            // Rotação Linear Estrita:
            // Cada pessoa "caminha" um dia para frente a cada semana.
            // Isso garante que em 4 semanas (se houver 4 dias), todos passem por todos os dias
            // e ninguém repita o dia da semana no mesmo ciclo.
            const slotIdx = (idx + weekOffset) % validDaysIndices.length;
            const dayIdx = validDaysIndices[slotIdx];
            if (!assignmentsPerDay[dayIdx]) assignmentsPerDay[dayIdx] = [];
            assignmentsPerDay[dayIdx].push(person);
        });
    }

    // 3. Renderizar os dias
    days.forEach((date, i) => {
        const dayOfWeek = i;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.dataset.week = days[0].toDateString();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        dayEl.dataset.isWeekend = isWeekend;

        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const holidayName = ignoredHolidays.has(dateStr) ? null : holidayDetails[i];

        if (holidayName) dayEl.classList.add('holiday');
        if (hasHoliday) dayEl.classList.add('blocked-week');

        dayEl.innerHTML = `
            <span class="day-number">${date.getDate()}</span>
            <span class="day-info">${date.toLocaleString('pt-BR', { weekday: 'short' }).toUpperCase()}</span>
            <span class="day-date-hidden" style="display:none">${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}</span>
        `;

        dayEl.addEventListener('dragover', handleDragOver);
        dayEl.addEventListener('drop', handleDayDrop);

        if (holidayName) {
            const hDiv = document.createElement('div');
            hDiv.className = 'holiday-name';
            hDiv.innerText = holidayName;
            dayEl.appendChild(hDiv);

            const btn = document.createElement('button');
            btn.className = 'remove-holiday';
            btn.title = 'Ignorar feriado';
            btn.innerHTML = '<i class="ti ti-x"></i>';
            btn.onclick = (e) => {
                e.stopPropagation();
                ignoredHolidays.add(dateStr);
                generateScale();
            };
            dayEl.appendChild(btn);
        }

        // Adicionar Badges se houver atribuições
        if (assignmentsPerDay[i]) {
            assignmentsPerDay[i].forEach(person => {
                const badge = document.createElement('div');
                badge.className = 'day-assignment';
                badge.draggable = true;
                badge.dataset.personId = person.id;
                badge.innerHTML = `<i class="ti ti-home-heart"></i> ${person.nome}`;
                badge.addEventListener('dragstart', handleDragStart);
                badge.addEventListener('dragover', handleDragOver);
                badge.addEventListener('drop', handleDrop);
                badge.addEventListener('dragend', handleDragEnd);
                dayEl.appendChild(badge);
            });
        }

        calendarGrid.appendChild(dayEl);
    });
}

// --- Utils ---

copyBtn.addEventListener('click', () => {
    let text = `Escala de Home Office - ${calendarTitle.innerText}\n\n`;
    const days = Array.from(calendarGrid.querySelectorAll('.calendar-day'));
    
    // Agrupar por semana
    let weeks = {};
    days.forEach(day => {
        const weekId = day.dataset.week;
        if (!weeks[weekId]) weeks[weekId] = [];
        weeks[weekId].push(day);
    });

    Object.keys(weeks).forEach(weekId => {
        const weekDays = weeks[weekId];
        const monday = weekDays[1]; // Segunda
        const friday = weekDays[5]; // Sexta
        
        const monDate = monday.querySelector('.day-date-hidden').innerText;
        const friDate = friday.querySelector('.day-date-hidden').innerText;

        let weekText = `- Semana ${monDate} até ${friDate}\n`;
        let hasAssignment = false;

        weekDays.forEach(day => {
            const assignments = day.querySelectorAll('.day-assignment');
            if (assignments.length > 0) {
                hasAssignment = true;
                const shortName = day.querySelector('.day-info').innerText;
                const fullName = getFullDayName(shortName);
                const dateFull = day.querySelector('.day-date-hidden').innerText;
                const names = Array.from(assignments).map(a => a.innerText.trim()).join(', ');
                weekText += ` - ${fullName} (${dateFull}) : ${names}\n`;
            }
        });

        if (hasAssignment) {
            text += weekText + "\n";
        }
    });

    if (text === `Escala de Home Office - ${calendarTitle.innerText}\n\n`) {
        alert('Nenhuma escala gerada para copiar.');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        alert('Escala copiada para a área de transferência!');
    });
});

// --- Drag and Drop Logic ---

let dragSrcEl = null;

function handleDragStart(e) {
    dragSrcEl = this;
    const parentDay = this.closest('.calendar-day');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    e.dataTransfer.setData('sourceWeek', parentDay.dataset.week);
    
    this.style.opacity = '0.4';
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const sourceWeek = e.dataTransfer.getData('sourceWeek');
    const targetDay = this.closest('.calendar-day');
    const targetWeek = targetDay.dataset.week;

    if (sourceWeek !== targetWeek) {
        alert('Só é permitido trocar dias dentro da mesma semana.');
        return false;
    }

    if (targetDay.dataset.isWeekend === "true") {
        alert('Não é permitido home office aos finais de semana.');
        return false;
    }

    if (targetDay.classList.contains('holiday')) {
        alert('Não é permitido home office em feriados.');
        return false;
    }

    if (targetDay.classList.contains('blocked-week')) {
        alert('Esta semana está bloqueada devido a um feriado.');
        return false;
    }

    if (dragSrcEl !== this) {
        // Swap content
        const sourceHTML = dragSrcEl.innerHTML;
        const targetHTML = this.innerHTML;
        
        dragSrcEl.innerHTML = targetHTML;
        this.innerHTML = sourceHTML;
    }
    return false;
}

function handleDayDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    const targetDay = this;
    const sourceWeek = e.dataTransfer.getData('sourceWeek');
    const targetWeek = targetDay.dataset.week;

    if (sourceWeek !== targetWeek) {
        alert('Só é permitido mover nomes dentro da mesma semana.');
        return false;
    }

    if (targetDay.dataset.isWeekend === "true") {
        alert('Não é permitido home office aos finais de semana.');
        return false;
    }

    if (targetDay.classList.contains('holiday')) {
        alert('Não é permitido home office em feriados.');
        return false;
    }

    if (targetDay.classList.contains('blocked-week')) {
        alert('Esta semana está bloqueada devido a um feriado.');
        return false;
    }

    if (dragSrcEl) {
        targetDay.appendChild(dragSrcEl);
    }
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.classList.remove('dragging');
    
    // Remover classes de hover/drag de todos
    document.querySelectorAll('.day-assignment').forEach(el => {
        el.classList.remove('dragging');
    });
}

function getFullDayName(short) {
    const map = {
        'DOM': 'Domingo',
        'SEG': 'Segunda-feira',
        'TER': 'Terça-feira',
        'QUA': 'Quarta-feira',
        'QUI': 'Quinta-feira',
        'SEX': 'Sexta-feira',
        'SÁB': 'Sábado'
    };
    return map[short] || short;
}
async function saveScaleToDB() {
    if (!currentTeamId) return alert('Selecione uma equipe primeiro.');

    const assignments = [];
    const days = calendarGrid.querySelectorAll('.calendar-day');

    days.forEach(day => {
        const dateRaw = day.dataset.week; // Referência da semana
        // Na verdade, precisamos da data exata do dia. 
        // Vamos extrair do span invisível ou reconstruir.
        const dateStr = day.querySelector('.day-date-hidden')?.innerText;
        if (!dateStr) return;

        const [d, m] = dateStr.split('/');
        const year = currentPickerYear;
        const formattedDate = `${year}-${m}-${d}`;

        const badges = day.querySelectorAll('.day-assignment');
        badges.forEach(badge => {
            assignments.push({
                data: formattedDate,
                equipe_id: parseInt(currentTeamId),
                membro_id: parseInt(badge.dataset.personId)
            });
        });
    });

    if (assignments.length === 0) return alert('Nenhuma escala para salvar.');

    try {
        saveBtn.disabled = true;
        saveBtn.innerText = 'SALVANDO...';

        const response = await fetch(`${API_URL}/salvar-escala`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assignments)
        });

        const result = await response.json();
        if (result.status === 'sucesso') {
            alert('Escala salva com sucesso no MySQL!');
        } else {
            alert('Erro ao salvar escala.');
        }
    } catch (err) {
        console.error('Erro:', err);
        alert('Erro de conexão com a API.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="ti ti-database-export"></i> SALVAR NO BANCO';
    }
}

saveBtn.addEventListener('click', saveScaleToDB);
