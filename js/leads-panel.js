// ============================================================
// LEADS & SPEND PANEL
// Calendar heatmap for new patient leads + date range spend
// ============================================================

// ── State ────────────────────────────────────────────────────
let leadsCalYear        = null;
let leadsCalMonth       = null;
let leadsRangeStart     = null; // 'YYYY-MM-DD'
let leadsRangeEnd       = null; // 'YYYY-MM-DD'
let leadsPatientIndex   = {};   // { 'YYYY-MM-DD': count }
let leadsSpendData      = [];   // [{ date, googleSpend, metaSpend }]
let leadsSpendLoaded    = false;

// ── Constants ────────────────────────────────────────────────
const LEADS_MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];
const LEADS_DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Heatmap tiers: [minLeads, cssClass]
const LEADS_TIERS = [
    [9,  'leads-tier-4'],
    [6,  'leads-tier-3'],
    [3,  'leads-tier-2'],
    [1,  'leads-tier-1'],
    [0,  'leads-tier-0']
];

// ============================================================
// PANEL ENTRY POINT
// Called from sidebar nav link
// ============================================================
function showLeadsPanel() {

    // Build patient index from already-cached data (daily rows only)
    buildLeadsPatientIndex();

    // Navigate to most recent month with daily data
    const latestDate = getLeadsLatestDate();
    if (latestDate) {
        renderLeadsCalendar(latestDate.getFullYear(), latestDate.getMonth());
    } else {
        const now = new Date();
        renderLeadsCalendar(now.getFullYear(), now.getMonth());
    }

    // Reset state
    leadsRangeStart  = null;
    leadsRangeEnd    = null;
    leadsSpendData   = [];
    leadsSpendLoaded = false;

    hideLeadsMetricsCard();
    updateLeadsHint('Click a day to set the start of your date range');
}

// ============================================================
// BUILD PATIENT INDEX
// Filters patientData (already in memory) to daily rows only
// ============================================================
function buildLeadsPatientIndex() {
    leadsPatientIndex = {};

    // patientData is the global from dashboard-charts.js fetch
    const rows = (typeof patientData !== 'undefined' && patientData.patients)
        ? patientData.patients
        : [];

    rows.forEach(row => {
        if (row.source !== 'daily') return;
        if (!row.date || !row.newPatients) return;
        const key = row.date; // already YYYY-MM-DD from n8n
        leadsPatientIndex[key] = (leadsPatientIndex[key] || 0) + row.newPatients;
    });

    console.log(`📅 Leads patient index built: ${Object.keys(leadsPatientIndex).length} days with data`);
}

// ============================================================
// LATEST DATE WITH DATA
// ============================================================
function getLeadsLatestDate() {
    const dates = Object.keys(leadsPatientIndex).sort();
    if (!dates.length) return null;
    const latest = dates[dates.length - 1];
    const [y, m, d] = latest.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// ============================================================
// CALENDAR RENDERER
// ============================================================
function renderLeadsCalendar(year, month) {
    const container = document.getElementById('leadsCalendar');
    if (!container) return;

    leadsCalYear  = year;
    leadsCalMonth = month;

    const firstDay  = new Date(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0);
    const startDow  = firstDay.getDay();

    // Boundary check for nav buttons
    const allDates  = Object.keys(leadsPatientIndex).sort();
    const earliest  = allDates.length ? allDates[0] : null;
    const latest    = allDates.length ? allDates[allDates.length - 1] : null;

    const prevMonthDate = new Date(year, month - 1, 1);
    const nextMonthDate = new Date(year, month + 1, 1);

    let canGoPrev = true;
    let canGoNext = true;

    if (earliest) {
        const [ey, em] = earliest.split('-').map(Number);
        canGoPrev = prevMonthDate >= new Date(ey, em - 1, 1);
    }
    if (latest) {
        const [ly, lm] = latest.split('-').map(Number);
        canGoNext = nextMonthDate <= new Date(ly, lm - 1, 1);
    }

    // ── Header ───────────────────────────────────────────────
    let html = `
        <div class="leads-cal-header">
            <button class="leads-cal-nav ${!canGoPrev ? 'disabled' : ''}"
                onclick="${canGoPrev ? 'prevLeadsMonth()' : ''}"
                ${!canGoPrev ? 'disabled' : ''}>&#8249;</button>
            <span class="leads-cal-month-label">${LEADS_MONTH_NAMES[month]} ${year}</span>
            <button class="leads-cal-nav ${!canGoNext ? 'disabled' : ''}"
                onclick="${canGoNext ? 'nextLeadsMonth()' : ''}"
                ${!canGoNext ? 'disabled' : ''}>&#8250;</button>
        </div>
        <div class="leads-cal-grid">
    `;

    // Day name headers
    LEADS_DAY_NAMES.forEach(name => {
        html += `<div class="leads-cal-dow">${name}</div>`;
    });

    // Empty padding
    for (let i = 0; i < startDow; i++) {
        html += `<div class="leads-cal-day leads-cal-empty"></div>`;
    }

    // Day squares
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const mm      = String(month + 1).padStart(2, '0');
        const dd      = String(day).padStart(2, '0');
        const dateKey = `${year}-${mm}-${dd}`;
        const count   = leadsPatientIndex[dateKey] || 0;
        const tier    = getLeadsTier(count);

        const isStart   = dateKey === leadsRangeStart;
        const isEnd     = dateKey === leadsRangeEnd;
        const isInRange = leadsRangeStart && leadsRangeEnd
            ? dateKey > leadsRangeStart && dateKey < leadsRangeEnd
            : false;

        let classes = `leads-cal-day ${tier}`;
        if (isStart)   classes += ' leads-cal-start';
        if (isEnd)     classes += ' leads-cal-end';
        if (isInRange) classes += ' leads-cal-in-range';

        // Inner content
        let inner = `<span class="leads-cal-day-num">${day}</span>`;

        if (isStart) {
            inner += `<span class="leads-cal-range-label">Start</span>`;
        } else if (isEnd) {
            inner += `<span class="leads-cal-range-label">End</span>`;
        } else if (count > 0) {
            inner += `<span class="leads-cal-day-count">${count} lead${count !== 1 ? 's' : ''}</span>`;
        }

        html += `<div class="${classes}" onclick="selectLeadsDay('${dateKey}')">${inner}</div>`;
    }

    html += `</div>`;

    // Legend
    html += `
        <div class="leads-cal-legend">
            <span class="leads-legend-label">Leads:</span>
            <span class="leads-legend-swatch leads-tier-0"></span><span class="leads-legend-label">0</span>
            <span class="leads-legend-swatch leads-tier-1"></span><span class="leads-legend-label">1–2</span>
            <span class="leads-legend-swatch leads-tier-2"></span><span class="leads-legend-label">3–5</span>
            <span class="leads-legend-swatch leads-tier-3"></span><span class="leads-legend-label">6–8</span>
            <span class="leads-legend-swatch leads-tier-4"></span><span class="leads-legend-label">9+</span>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================
// HEATMAP TIER
// ============================================================
function getLeadsTier(count) {
    for (const [min, cls] of LEADS_TIERS) {
        if (count >= min) return cls;
    }
    return 'leads-tier-0';
}

// ============================================================
// DATE SELECTION — Two-click state machine
// ============================================================
function selectLeadsDay(dateKey) {

    // IDLE → start selected
    if (!leadsRangeStart) {
        leadsRangeStart = dateKey;
        leadsRangeEnd   = null;
        renderLeadsCalendar(leadsCalYear, leadsCalMonth);
        updateLeadsHint('Now click a second day to complete your date range');
        return;
    }

    // Start already selected — clicking same day deselects
    if (dateKey === leadsRangeStart && !leadsRangeEnd) {
        leadsRangeStart = null;
        renderLeadsCalendar(leadsCalYear, leadsCalMonth);
        updateLeadsHint('Click a day to set the start of your date range');
        return;
    }

    // Second click — set end, auto-swap if needed
    let start = leadsRangeStart;
    let end   = dateKey;

    if (end < start) {
        [start, end] = [end, start];
    }

    leadsRangeStart = start;
    leadsRangeEnd   = end;

    renderLeadsCalendar(leadsCalYear, leadsCalMonth);
    updateLeadsHint('');

    // Fetch spend for this range
    fetchLeadsSpend(start, end);
}

// ============================================================
// NAVIGATION
// ============================================================
function prevLeadsMonth() {
    let m = leadsCalMonth - 1;
    let y = leadsCalYear;
    if (m < 0) { m = 11; y--; }
    renderLeadsCalendar(y, m);
}

function nextLeadsMonth() {
    let m = leadsCalMonth + 1;
    let y = leadsCalYear;
    if (m > 11) { m = 0; y++; }
    renderLeadsCalendar(y, m);
}

// ============================================================
// CLEAR RANGE
// ============================================================
function clearLeadsRange() {
    leadsRangeStart  = null;
    leadsRangeEnd    = null;
    leadsSpendData   = [];
    leadsSpendLoaded = false;
    renderLeadsCalendar(leadsCalYear, leadsCalMonth);
    hideLeadsMetricsCard();
    updateLeadsHint('Click a day to set the start of your date range');
}

// ============================================================
// FETCH SPEND DATA
// ============================================================
function fetchLeadsSpend(startDate, endDate) {
    const loadingEl = document.getElementById('leadsMetricsLoading');
    const cardEl    = document.getElementById('leadsMetricsCard');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (cardEl)    cardEl.style.display    = 'none';

    jQuery.ajax({
        url:  dashboardConfig.ajaxUrl,
        type: 'POST',
        data: {
            action:    'fetch_daily_ad_spend',
            nonce:     dashboardConfig.nonce,
            startDate: startDate,
            endDate:   endDate
        },
        timeout: 60000,
        success: function(response) {
            if (loadingEl) loadingEl.style.display = 'none';

            if (response.success && response.data && response.data.dailySpend) {
                leadsSpendData   = response.data.dailySpend;
                leadsSpendLoaded = true;
                renderLeadsMetricsCard(startDate, endDate);
            } else {
                console.warn('Leads spend fetch failed:', response);
                renderLeadsMetricsCard(startDate, endDate); // render with $0 spend
            }
        },
        error: function(xhr, status) {
            if (loadingEl) loadingEl.style.display = 'none';
            console.error('Leads spend AJAX error:', status);
            renderLeadsMetricsCard(startDate, endDate); // render with $0 spend
        }
    });
}

// ============================================================
// RENDER METRICS CARD
// ============================================================
function renderLeadsMetricsCard(startDate, endDate) {
    const cardEl = document.getElementById('leadsMetricsCard');
    if (!cardEl) return;

    // ── Total leads in range ──────────────────────────────────
    let totalLeads = 0;
    const start = new Date(startDate + 'T00:00:00');
    const end   = new Date(endDate   + 'T00:00:00');

    Object.entries(leadsPatientIndex).forEach(([dateKey, count]) => {
        const d = new Date(dateKey + 'T00:00:00');
        if (d >= start && d <= end) totalLeads += count;
    });

    // ── Total spend in range ──────────────────────────────────
    let totalGoogle = 0;
    let totalMeta   = 0;

    leadsSpendData.forEach(row => {
        const d = new Date(row.date + 'T00:00:00');
        if (d >= start && d <= end) {
            totalGoogle += row.googleSpend || 0;
            totalMeta   += row.metaSpend   || 0;
        }
    });

    const totalSpend = totalGoogle + totalMeta;

    // ── Day count ─────────────────────────────────────────────
    const dayCount = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // ── Format date range label ───────────────────────────────
    const fmtDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const fmt$ = (val) => '$' + val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

	// ── Cost per lead (spend ÷ leads) ─────────────────────────
    const costPerLead = totalLeads > 0 ? fmt$(totalSpend / totalLeads) : '—';
    const cplMath = totalLeads > 0
        ? `${fmt$(totalSpend)} ÷ ${totalLeads} lead${totalLeads !== 1 ? 's' : ''}`
        : 'No leads in range';

    // ── Render ────────────────────────────────────────────────
    cardEl.innerHTML = `
        <div class="leads-metrics-header">
            <div class="leads-metrics-range-label">
                <i class="ti ti-calendar-event" aria-hidden="true"></i>
                ${fmtDate(startDate)} &ndash; ${fmtDate(endDate)}
                <span class="leads-metrics-day-count">${dayCount} day${dayCount !== 1 ? 's' : ''}</span>
            </div>
            <button class="leads-clear-btn" onclick="clearLeadsRange()">
                <i class="ti ti-x" aria-hidden="true"></i> Clear range
            </button>
        </div>
        <div class="leads-metrics-grid">
            <div class="leads-metric-card leads-metric-leads">
                <div class="leads-metric-label">New patient leads</div>
                <div class="leads-metric-value">${totalLeads}</div>
            </div>
            <div class="leads-metric-card">
    			<div class="leads-metric-label">
        		<img src="https://dashboard.richardkimmedicine.com/wp-content/uploads/2025/12/Google-Logo-Edited.png" alt="" class="leads-metric-logo">
       			 Google Ads spend
    				</div>
    	<div class="leads-metric-value">${fmt$(totalGoogle)}</div>
		</div>
<div class="leads-metric-card">
    <div class="leads-metric-label">
        <img src="https://dashboard.richardkimmedicine.com/wp-content/uploads/2025/12/Facebook-Logo-edited.png" alt="" class="leads-metric-logo">
        Meta Ads spend
    </div>
    <div class="leads-metric-value">${fmt$(totalMeta)}</div>
</div>
            <div class="leads-metric-card leads-metric-total">
                <div class="leads-metric-label">Combined spend</div>
                <div class="leads-metric-value">${fmt$(totalSpend)}</div>
            </div>
        </div>
        <div class="leads-efficiency-strip">
            <div class="leads-efficiency-label">
                <i class="ti ti-target-arrow" aria-hidden="true"></i> Cost per lead
            </div>
            <div class="leads-efficiency-value">
                <span class="leads-efficiency-amount">${costPerLead}</span>
                <span class="leads-efficiency-math">${cplMath}</span>
            </div>
        </div>
    `;

    cardEl.style.display = 'block';
}

// ============================================================
// HELPERS
// ============================================================
function hideLeadsMetricsCard() {
    const cardEl    = document.getElementById('leadsMetricsCard');
    const loadingEl = document.getElementById('leadsMetricsLoading');
    if (cardEl)    cardEl.style.display    = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
}

function updateLeadsHint(msg) {
    const el = document.getElementById('leadsCalHint');
    if (el) el.textContent = msg;
}