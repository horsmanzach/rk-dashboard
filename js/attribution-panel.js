// ============================================================
// ATTRIBUTION PANEL — Calendar UI + Report Renderer
// ============================================================

// State
let attributionCalYear          = null;
let attributionCalMonth         = null; // 0-indexed
let attributionSelectedDate     = null;
let attributionCurrentStation   = 'WTLA';

// Lift window state — persists across date changes
let attributionWindowBefore     = 1;
let attributionWindowAfter      = 1;

// Cached data from last successful load — used for client-side lift recalculation
let attributionLastHourlySessions = [];
let attributionLastSpots          = [];
let attributionLastStation        = null;
let attributionLastDate           = null;

// ============================================================
// AIR DATE INDEX
// Builds { "YYYY-MM-DD": count } from already-loaded station data
// ============================================================
function buildAirDateIndex(station) {
    const key  = station.toLowerCase();
    const data = syracuseStationData[key];
    const index = {};

    if (!data || !data.orders) return index;

    data.orders.forEach(order => {
        if (!order.dailyBreakdown) return;
        order.dailyBreakdown.forEach(day => {
            if (!day.date || day.adCount === 0) return;

            // day.date is MM/DD/YY — convert to YYYY-MM-DD
            const parts = day.date.split('/');
            if (parts.length !== 3) return;

            const month    = parts[0].padStart(2, '0');
            const d        = parts[1].padStart(2, '0');
            const yr       = parseInt(parts[2]);
            const fullYear = yr < 100 ? (yr >= 50 ? 1900 + yr : 2000 + yr) : yr;
            const key      = `${fullYear}-${month}-${d}`;

            index[key] = (index[key] || 0) + day.adCount;
        });
    });

    return index;
}

// ============================================================
// STATION DATE RANGE BOUNDS
// Returns { earliest: Date, latest: Date } or null
// ============================================================
function getStationDateBounds(station) {
    const key  = station.toLowerCase();
    const data = syracuseStationData[key];

    if (!data || !data.summary || !data.summary.dateRange) return null;

    const range = data.summary.dateRange;
    if (!range.start || !range.end) return null;

    // dateRange.start/end are MM/DD/YY
    function parseMMDDYY(str) {
        const parts = str.split('/');
        if (parts.length !== 3) return null;
        const yr       = parseInt(parts[2]);
        const fullYear = yr < 100 ? (yr >= 50 ? 1900 + yr : 2000 + yr) : yr;
        return new Date(fullYear, parseInt(parts[0]) - 1, parseInt(parts[1]));
    }

    return {
        earliest: parseMMDDYY(range.start),
        latest:   parseMMDDYY(range.end)
    };
}

// ============================================================
// CALENDAR HEATMAP TIERS
// ============================================================
const ATTR_TIERS = [
    [7, 'attr-tier-4'],
    [4, 'attr-tier-3'],
    [2, 'attr-tier-2'],
    [1, 'attr-tier-1'],
    [0, 'attr-tier-0']
];

function getAttrTier(spotCount) {
    for (const [min, cls] of ATTR_TIERS) {
        if (spotCount >= min) return cls;
    }
    return 'attr-tier-0';
}

// ============================================================
// CALENDAR RENDERER
// ============================================================
function renderAttributionCalendar(station, year, month) {
    const container = document.getElementById('attributionCalendar');
    if (!container) return;

    attributionCalYear  = year;
    attributionCalMonth = month;

    const airIndex = buildAirDateIndex(station);
    const bounds   = getStationDateBounds(station);

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const firstDay  = new Date(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0);
    const startDow  = firstDay.getDay();

    const prevMonthDate = new Date(year, month - 1, 1);
    const nextMonthDate = new Date(year, month + 1, 1);
    const canGoPrev = bounds ? prevMonthDate >= new Date(bounds.earliest.getFullYear(), bounds.earliest.getMonth(), 1) : true;
    const canGoNext = bounds ? nextMonthDate <= new Date(bounds.latest.getFullYear(), bounds.latest.getMonth(), 1) : true;

    let html = `
        <div class="attribution-cal-header">
            <button class="attribution-cal-nav ${!canGoPrev ? 'disabled' : ''}"
                onclick="${canGoPrev ? 'prevAttributionMonth()' : ''}"
                ${!canGoPrev ? 'disabled' : ''}>&#8249;</button>
            <span class="attribution-cal-month-label">${monthNames[month]} ${year}</span>
            <button class="attribution-cal-nav ${!canGoNext ? 'disabled' : ''}"
                onclick="${canGoNext ? 'nextAttributionMonth()' : ''}"
                ${!canGoNext ? 'disabled' : ''}>&#8250;</button>
        </div>
        <div class="attribution-cal-grid">
    `;

    dayNames.forEach(name => {
        html += `<div class="attribution-cal-dow">${name}</div>`;
    });

    for (let i = 0; i < startDow; i++) {
        html += `<div class="attribution-cal-day attr-tier-0 empty"></div>`;
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const mm       = String(month + 1).padStart(2, '0');
        const dd       = String(day).padStart(2, '0');
        const dateKey  = `${year}-${mm}-${dd}`;
        const thisDate = new Date(year, month, day);

        const isSelected = dateKey === attributionSelectedDate;
        const spotCount  = airIndex[dateKey] || 0;
        const hasSpots   = spotCount > 0;
        const inRange    = bounds
            ? (thisDate >= new Date(bounds.earliest.getFullYear(), bounds.earliest.getMonth(), bounds.earliest.getDate())
            && thisDate <= new Date(bounds.latest.getFullYear(),   bounds.latest.getMonth(),   bounds.latest.getDate()))
            : true;

        const tier      = (inRange && hasSpots) ? getAttrTier(spotCount) : 'attr-tier-0';
        const clickable = inRange && hasSpots;

        let classes = `attribution-cal-day ${tier}`;
        if (isSelected) classes += ' selected';
        if (!inRange)   classes += ' out-of-range';

        const onclick = clickable ? `onclick="selectAttributionDate('${dateKey}')"` : '';

        let inner = `<span class="attribution-cal-day-num">${day}</span>`;
        if (hasSpots && inRange) {
            inner += `<span class="attribution-cal-spot-count">${spotCount} aired</span>`;
        }

        html += `<div class="${classes}" ${onclick}>${inner}</div>`;
    }

    html += `</div>`;

    html += `
        <div class="attribution-cal-legend">
            <span class="attr-legend-label">Spots aired:</span>
            <span class="attr-legend-swatch attr-tier-0"></span><span class="attr-legend-label">0</span>
            <span class="attr-legend-swatch attr-tier-1"></span><span class="attr-legend-label">1</span>
            <span class="attr-legend-swatch attr-tier-2"></span><span class="attr-legend-label">2–3</span>
            <span class="attr-legend-swatch attr-tier-3"></span><span class="attr-legend-label">4–6</span>
            <span class="attr-legend-swatch attr-tier-4"></span><span class="attr-legend-label">7+</span>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================
// NAVIGATION
// ============================================================
function prevAttributionMonth() {
    let m = attributionCalMonth - 1;
    let y = attributionCalYear;
    if (m < 0) { m = 11; y--; }
    renderAttributionCalendar(attributionCurrentStation, y, m);
}

function nextAttributionMonth() {
    let m = attributionCalMonth + 1;
    let y = attributionCalYear;
    if (m > 11) { m = 0; y++; }
    renderAttributionCalendar(attributionCurrentStation, y, m);
}

// ============================================================
// DATE SELECTION
// ============================================================
function selectAttributionDate(dateKey) {
    attributionSelectedDate = dateKey;

    // Re-render calendar to update selected highlight
    renderAttributionCalendar(attributionCurrentStation, attributionCalYear, attributionCalMonth);

    // Trigger the report
    loadAttributionData(dateKey);
}

// ============================================================
// STATION CHANGE HANDLER
// ============================================================
function onAttributionStationChange() {
    const station = document.getElementById('attributionStation').value;
    attributionCurrentStation = station;
    attributionSelectedDate   = null;

    // Hide any previously displayed results
    document.getElementById('attributionChartCard').style.display  = 'none';
    document.getElementById('attributionTableCard').style.display  = 'none';
    document.getElementById('attributionLoading').style.display    = 'none';

    // Reset chart label placeholder
    document.getElementById('attributionChartLabel').textContent = 'Select a date to view results';

    // Navigate calendar to the latest month with data for this station
    initCalendarToLatestMonth(station);
}

// ============================================================
// INIT CALENDAR TO LATEST MONTH WITH DATA
// ============================================================
function initCalendarToLatestMonth(station) {
    const bounds = getStationDateBounds(station);

    if (bounds && bounds.latest) {
        renderAttributionCalendar(station, bounds.latest.getFullYear(), bounds.latest.getMonth());
    } else {
        // Fallback to current month if data not loaded yet
        const now = new Date();
        renderAttributionCalendar(station, now.getFullYear(), now.getMonth());
    }
}

// ============================================================
// PANEL ENTRY POINT
// ============================================================
function showAttributionPanel() {
    navigateToSlide('attribution');
    updateAttributionAvailability();

    // Use the station currently selected in the dropdown
    attributionCurrentStation = document.getElementById('attributionStation').value;
    attributionSelectedDate   = null;

    initCalendarToLatestMonth(attributionCurrentStation);
}

// ============================================================
// AVAILABILITY BLOCK (below station dropdown)
// ============================================================
function updateAttributionAvailability() {
    const el = document.getElementById('attributionStationAvailability');
    if (!el) return;

    const stationLabels = {
        wtla: 'WTLA',
        wkrl: 'WKRL',
        wktw: 'WKTW',
        wzun: 'WZUN'
    };

    const lines = [];

    Object.entries(stationLabels).forEach(([key, label]) => {
        const stationData = syracuseStationData?.[key];
        const range       = stationData?.summary?.dateRange;

        if (range?.start && range?.end) {
            const start = formatDate(range.start);
            const end   = formatDate(range.end);
            lines.push(`<span class="attribution-availability-item"><strong>${label}:</strong> ${start} – ${end}</span>`);
        } else {
            lines.push(`<span class="attribution-availability-item attribution-availability-loading"><strong>${label}:</strong> Loading…</span>`);
        }
    });

    el.innerHTML = lines.join('');
}

// ============================================================
// REPORT LOADER
// ============================================================
function loadAttributionData(dateKey) {
    const station = attributionCurrentStation;
    const date    = dateKey || attributionSelectedDate;

    if (!date) return;

    document.getElementById('attributionTableCard').style.display  = 'none';
    document.getElementById('attributionWindowControls').innerHTML = '';

    // Show spinner inside the chart card so it renders in position above the calendar
    const chartCard = document.getElementById('attributionChartCard');
    chartCard.style.display = 'block';
    chartCard.innerHTML = `
        <div class="attribution-spinner-wrap">
            <div class="attribution-spinner"></div>
            <p class="attribution-spinner-label">Loading attribution data\u2026</p>
        </div>
    `;

    // Scroll to spinner so user sees loading state
    chartCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    jQuery.ajax({
        url:  dashboardConfig.ajaxUrl,
        type: 'POST',
        data: {
            action:  'fetch_commercial_attribution',
            nonce:   dashboardConfig.nonce,
            date:    date,
            station: station
        },
        timeout: 35000,
        success: function(response) {
            if (response.success) {
                // Restore chart card structure (spinner replaced it) then render
                const chartCard = document.getElementById('attributionChartCard');
                chartCard.innerHTML = `
                    <p class="attribution-card-label" id="attributionChartLabel"></p>
                    <div id="attributionChartContainer" style="display:none;">
                        <div id="attributionChart" style="height:220px;"></div>
                        <div class="attribution-legend">
                            <span class="attribution-legend-sessions"></span> Sessions per hour
                            <span class="attribution-legend-spot"></span> Commercial aired
                        </div>
                    </div>
                `;
                renderAttributionData(response.data, station, date);
            } else {
                const chartCard = document.getElementById('attributionChartCard');
                chartCard.innerHTML = `<p class="attribution-card-label" id="attributionChartLabel">Error loading data: ${response.data?.message || 'Unknown error'}</p>`;
            }
        },
        error: function() {
            const chartCard = document.getElementById('attributionChartCard');
            chartCard.innerHTML = `<p class="attribution-card-label" id="attributionChartLabel">Request failed. Please try again.</p>`;
        }
    });
}

// ============================================================
// LIFT WINDOW — Convert airTime string to 0-based hour integer
// e.g. "2:15 PM" → 14,  "12:00 AM" → 0,  "12:30 PM" → 12
// ============================================================
function airTimeToHour(airTimeStr) {
    if (!airTimeStr) return null;
    const match = airTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let hours    = parseInt(match[1]);
    const period = match[3].toUpperCase();
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;
    return hours;
}

// ============================================================
// LIFT WINDOW — Sum sessions for a range of hours from the
// hourlySessions array.  Hours outside [0,23] are skipped
// (boundary clamping) and null is returned only when the
// entire window falls out of range.
// ============================================================
function sumSessionsForHours(hourlySessions, startHour, endHour) {
    const clampedStart = Math.max(0, startHour);
    const clampedEnd   = Math.min(23, endHour);

    if (clampedStart > clampedEnd) return null; // fully out of range

    // Build a quick lookup: { hour: sessions }
    const lookup = {};
    hourlySessions.forEach(h => { lookup[h.hour] = h.sessions; });

    let total = 0;
    for (let h = clampedStart; h <= clampedEnd; h++) {
        total += lookup[h] || 0;
    }
    return total;
}

// ============================================================
// LIFT WINDOW — Recalculate lift for all spots using the
// current window settings and re-render only the table.
// Called on window dropdown change; uses cached data so no
// network request is needed.
// ============================================================
function recalculateLift() {
    if (!attributionLastSpots.length && !attributionLastHourlySessions.length) return;

    const windowBefore = attributionWindowBefore;
    const windowAfter  = attributionWindowAfter;

    // Rebuild spots with new sessionsBefore / sessionsAfter / lift / liftPct
    const recalculated = attributionLastSpots.map(spot => {
        const spotHour = airTimeToHour(spot.airTime);

        let sessionsBefore = null;
        let sessionsAfter  = null;
        let lift           = null;
        let liftPct        = null;

        if (spotHour !== null) {
            sessionsBefore = sumSessionsForHours(
                attributionLastHourlySessions,
                spotHour - windowBefore,
                spotHour - 1
            );
            sessionsAfter = sumSessionsForHours(
                attributionLastHourlySessions,
                spotHour + 1,
                spotHour + windowAfter
            );

            if (sessionsBefore !== null && sessionsAfter !== null) {
                lift    = sessionsAfter - sessionsBefore;
                liftPct = sessionsBefore > 0
                    ? parseFloat(((lift / sessionsBefore) * 100).toFixed(1))
                    : null;
            }
        }

        return { ...spot, sessionsBefore, sessionsAfter, lift, liftPct };
    });

    renderLiftTable(
        recalculated,
        attributionLastStation,
        attributionLastDate,
        windowBefore,
        windowAfter
    );
}

// ============================================================
// LIFT WINDOW — Render a single linked selector.
// One dropdown controls both before and after equally so
// comparisons are always apples-to-apples.
// ============================================================
function renderLiftWindowControls() {
    const container = document.getElementById('attributionWindowControls');
    if (!container) return;

    const options = [1, 2, 3];

    const optionsHTML = options.map(n =>
        `<option value="${n}" ${n === attributionWindowBefore ? 'selected' : ''}>${n} hour${n > 1 ? 's' : ''}</option>`
    ).join('');

    container.innerHTML = `
        <div class="lift-window-controls">
            <span class="lift-window-label">Comparison window</span>
            <select id="liftWindowSize" class="lift-window-select" onchange="onLiftWindowChange()">
                ${optionsHTML}
            </select>
            <span class="lift-window-hint">Applied equally before and after each airing</span>
        </div>
    `;
}

// ============================================================
// LIFT WINDOW — Single dropdown drives both before and after
// ============================================================
function onLiftWindowChange() {
    const el = document.getElementById('liftWindowSize');
    if (!el) return;

    const val = parseInt(el.value);
    attributionWindowBefore = val;
    attributionWindowAfter  = val;

    recalculateLift();
}

// ============================================================
// REPORT RENDERER
// ============================================================
function renderAttributionData(data, station, date) {
    const hourlySessions = data.hourlySessions || [];
    const spotsRaw       = data.spots          || [];

    // Sort spots chronologically by air time
    spotsRaw.sort((a, b) => {
        const toMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 0;
            let hours    = parseInt(match[1]);
            const mins   = parseInt(match[2]);
            const period = match[3].toUpperCase();
            if (period === 'AM' && hours === 12) hours = 0;
            if (period === 'PM' && hours !== 12) hours += 12;
            return hours * 60 + mins;
        };
        return toMinutes(a.airTime) - toMinutes(b.airTime);
    });

    // Cache for client-side lift recalculation
    attributionLastHourlySessions = hourlySessions;
    attributionLastSpots          = spotsRaw;
    attributionLastStation        = station;
    attributionLastDate           = date;

    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById('attributionChartLabel').textContent =
        `Website sessions by hour — ${station}, ${displayDate}`;
    document.getElementById('attributionChartContainer').style.display = 'block';

    const hours    = hourlySessions.map(h => {
        const hr = h.hour;
        if (hr === 0)  return '12am';
        if (hr < 12)   return hr + 'am';
        if (hr === 12) return '12pm';
        return (hr - 12) + 'pm';
    });
    const sessions = hourlySessions.map(h => h.sessions);

    const annotations = spotsRaw.map(spot => ({
        x:               hours[spot.hour] || '',
        borderColor:     '#e34948',
        borderWidth:     1.5,
        strokeDashArray: 4,
        label:           { show: false }
    }));

    if (window.attributionChartInstance) {
        window.attributionChartInstance.destroy();
    }

    window.attributionChartInstance = new ApexCharts(
        document.getElementById('attributionChart'),
        {
            chart:   { type: 'area', height: 220, toolbar: { show: false }, zoom: { enabled: false } },
            series:  [{ name: 'Sessions', data: sessions }],
            xaxis:   { categories: hours, labels: { style: { fontSize: '11px' } } },
            yaxis:   { labels: { style: { fontSize: '11px' } } },
            stroke:  { curve: 'smooth', width: 2 },
            colors:  ['#2a78d6'],
            fill:    { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.02, stops: [0, 100] } },
            markers: { size: 3 },
            annotations: { xaxis: annotations },
            grid:    { borderColor: '#f0f0f0' },
            tooltip: {
                custom: function({ series, seriesIndex, dataPointIndex, w }) {
                    const sessions     = series[seriesIndex][dataPointIndex];
                    const hoveredHour  = dataPointIndex;
                    const airedSpots   = spotsRaw.filter(spot => spot.hour === hoveredHour);

                    let airTimeLines = '';
                    if (airedSpots.length > 0) {
                        airTimeLines = airedSpots.map(spot =>
                            `<div style="color:#e34948;font-size:0.85rem;margin-top:4px;">
                                Air Time: ${spot.airTime}
                            </div>`
                        ).join('');
                    }

                    return `<div style="padding:8px 12px;font-size:0.9rem;">
                        <div style="font-weight:600;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #e0e0e0;">${w.globals.categoryLabels[dataPointIndex]}</div>
                        <div><strong>Sessions:</strong> ${sessions}</div>
                        ${airTimeLines}
                    </div>`;
                }
            }
        }
    );
    window.attributionChartInstance.render();

    // Render lift window controls (preserves current selections across date changes)
    renderLiftWindowControls();

    // Calculate lift using current window settings and render the table
    const spots = spotsRaw.map(spot => {
        const spotHour = airTimeToHour(spot.airTime);

        let sessionsBefore = null;
        let sessionsAfter  = null;
        let lift           = null;
        let liftPct        = null;

        if (spotHour !== null) {
            sessionsBefore = sumSessionsForHours(hourlySessions, spotHour - attributionWindowBefore, spotHour - 1);
            sessionsAfter  = sumSessionsForHours(hourlySessions, spotHour + 1, spotHour + attributionWindowAfter);

            if (sessionsBefore !== null && sessionsAfter !== null) {
                lift    = sessionsAfter - sessionsBefore;
                liftPct = sessionsBefore > 0
                    ? parseFloat(((lift / sessionsBefore) * 100).toFixed(1))
                    : null;
            }
        }

        return { ...spot, sessionsBefore, sessionsAfter, lift, liftPct };
    });

    renderLiftTable(spots, station, date, attributionWindowBefore, attributionWindowAfter);
}

// ============================================================
// LIFT TABLE RENDERER
// Separated from renderAttributionData so recalculateLift()
// can call it independently without rebuilding the chart.
// ============================================================
function renderLiftTable(spots, station, date, windowBefore, windowAfter) {
    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById('attributionTableTitle').textContent =
        `Spot-by-spot lift — ${station}, ${displayDate}`;
    document.getElementById('attributionTableCard').style.display = 'block';

    // Update column headers to reflect active window
    const beforeHeader = document.getElementById('attributionColBefore');
    const afterHeader  = document.getElementById('attributionColAfter');
    if (beforeHeader) beforeHeader.textContent = `Before (${windowBefore}hr)`;
    if (afterHeader)  afterHeader.textContent  = `After (${windowAfter}hr)`;

    const tbody   = document.getElementById('attributionTableBody');
    const noSpots = document.getElementById('attributionNoSpots');
    tbody.innerHTML = '';

    if (spots.length === 0) {
        noSpots.style.display = 'block';
        return;
    }

    noSpots.style.display = 'none';

    spots.forEach(spot => {
        const lift    = spot.lift;
        const liftPct = spot.liftPct;
        let liftClass = 'lift-neutral';
        let liftText  = 'N/A';

        if (lift !== null) {
            if (lift > 0) {
                liftClass = 'lift-positive';
                liftText  = liftPct !== null
                    ? `+${lift} sessions (+${liftPct}%)`
                    : `+${lift} sessions`;
            } else if (lift < 0) {
                liftClass = 'lift-negative';
                liftText  = liftPct !== null
                    ? `${lift} sessions (${liftPct}%)`
                    : `${lift} sessions`;
            } else {
                liftText = '0 sessions (0%)';
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${spot.airTime || '—'}</td>
            <td>${spot.station || station}</td>
            <td>${spot.sessionsBefore !== null ? spot.sessionsBefore : '—'}</td>
            <td>${spot.sessionsAfter  !== null ? spot.sessionsAfter  : '—'}</td>
            <td class="${liftClass}">${liftText}</td>
        `;
        tbody.appendChild(tr);
    });
}