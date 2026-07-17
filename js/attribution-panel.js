// ============================================================
// ATTRIBUTION PANEL — Calendar UI + Report Renderer
// ============================================================

// State
let attributionCalYear  = null;
let attributionCalMonth = null; // 0-indexed
let attributionSelectedDate = null;
let attributionCurrentStation = 'WTLA';

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

            const month = parts[0].padStart(2, '0');
            const d     = parts[1].padStart(2, '0');
            const yr    = parseInt(parts[2]);
            const fullYear = yr < 100 ? (yr >= 50 ? 1900 + yr : 2000 + yr) : yr;
            const key = `${fullYear}-${month}-${d}`;

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
        const yr = parseInt(parts[2]);
        const fullYear = yr < 100 ? (yr >= 50 ? 1900 + yr : 2000 + yr) : yr;
        return new Date(fullYear, parseInt(parts[0]) - 1, parseInt(parts[1]));
    }

    return {
        earliest: parseMMDDYY(range.start),
        latest:   parseMMDDYY(range.end)
    };
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

    // First and last day of this month
    const firstDay  = new Date(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0);
    const startDow  = firstDay.getDay(); // 0=Sun

    // Can we go prev/next?
    const prevMonthDate = new Date(year, month - 1, 1);
    const nextMonthDate = new Date(year, month + 1, 1);
    const canGoPrev = bounds ? prevMonthDate >= new Date(bounds.earliest.getFullYear(), bounds.earliest.getMonth(), 1) : true;
    const canGoNext = bounds ? nextMonthDate <= new Date(bounds.latest.getFullYear(), bounds.latest.getMonth(), 1) : true;

    // Build header
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

    // Day name headers
    dayNames.forEach(name => {
        html += `<div class="attribution-cal-day-name">${name}</div>`;
    });

    // Empty padding squares before the 1st
    for (let i = 0; i < startDow; i++) {
        html += `<div class="attribution-cal-day empty"></div>`;
    }

    // Day squares
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const mm     = String(month + 1).padStart(2, '0');
        const dd     = String(day).padStart(2, '0');
        const dateKey = `${year}-${mm}-${dd}`;
        const thisDate = new Date(year, month, day);

        const isSelected    = dateKey === attributionSelectedDate;
        const spotCount     = airIndex[dateKey] || 0;
        const hasSpots      = spotCount > 0;
        const inRange       = bounds
            ? (thisDate >= new Date(bounds.earliest.getFullYear(), bounds.earliest.getMonth(), bounds.earliest.getDate())
            && thisDate <= new Date(bounds.latest.getFullYear(), bounds.latest.getMonth(), bounds.latest.getDate()))
            : true;

        let classes = 'attribution-cal-day';
        if (isSelected)       classes += ' selected';
        if (!inRange)         classes += ' out-of-range';
        else if (hasSpots)    classes += ' has-spots';
        else                  classes += ' no-spots';

        const clickable = inRange && hasSpots;
        const onclick   = clickable ? `onclick="selectAttributionDate('${dateKey}')"` : '';

        let inner = `<span class="attribution-cal-day-num">${day}</span>`;
        if (hasSpots && inRange) {
            inner += `<span class="attribution-cal-spot-count">${spotCount} aired</span>`;
        }

        html += `<div class="${classes}" ${onclick}>${inner}</div>`;
    }

    html += `</div>`; // close grid

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
    document.getElementById('attributionChartCard').style.display = 'none';
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
        const range = stationData?.summary?.dateRange;

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

    document.getElementById('attributionLoading').style.display    = 'block';
    document.getElementById('attributionChartCard').style.display  = 'none';
    document.getElementById('attributionTableCard').style.display  = 'none';

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
            document.getElementById('attributionLoading').style.display = 'none';
            if (response.success) {
                renderAttributionData(response.data, station, date);
                // Smooth scroll to results after ApexCharts has painted
                setTimeout(() => {
                    document.getElementById('attributionChartCard').scrollIntoView({
                        behavior: 'smooth',
                        block:    'start'
                    });
                }, 150);
            } else {
                alert('Error loading attribution data: ' + (response.data?.message || 'Unknown error'));
            }
        },
        error: function() {
            document.getElementById('attributionLoading').style.display = 'none';
            alert('Request failed. Please try again.');
        }
    });
}

// ============================================================
// REPORT RENDERER
// ============================================================
function renderAttributionData(data, station, date) {
    const hourlySessions = data.hourlySessions || [];
    const spots          = data.spots          || [];

	spots.sort((a, b) => {
    const toMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 0;
        let hours = parseInt(match[1]);
        const mins = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === 'AM' && hours === 12) hours = 0;
        if (period === 'PM' && hours !== 12) hours += 12;
        return hours * 60 + mins;
    };
    return toMinutes(a.airTime) - toMinutes(b.airTime);
});

    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById('attributionChartLabel').textContent =
        `Website sessions by hour — ${station}, ${displayDate}`;
    document.getElementById('attributionChartContainer').style.display = 'block';
    document.getElementById('attributionChartCard').style.display      = 'block';

    const hours = hourlySessions.map(h => {
        const hr = h.hour;
        if (hr === 0)  return '12am';
        if (hr < 12)   return hr + 'am';
        if (hr === 12) return '12pm';
        return (hr - 12) + 'pm';
    });
    const sessions = hourlySessions.map(h => h.sessions);

    const annotations = spots.map(spot => ({
        x:             hours[spot.hour] || '',
        borderColor:   '#e34948',
        borderWidth:   1.5,
        strokeDashArray: 4,
        label:         { show: false }
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
        const sessions = series[seriesIndex][dataPointIndex];
        const hoveredHour = dataPointIndex;

        const airedSpots = spots.filter(spot => spot.hour === hoveredHour);

        let airTimeLines = '';
        if (airedSpots.length > 0) {
            airTimeLines = airedSpots.map(spot =>
                `<div style="color:#e34948;font-size:0.85rem;margin-top:4px;">
                    Air Time: ${spot.airTime}
                </div>`
            ).join('');
        }

        return `<div style="padding:8px 12px;font-size:0.9rem;">
            <div><strong>Sessions:</strong> ${sessions}</div>
            ${airTimeLines}
        </div>`;
    }
}
        }
    );
    window.attributionChartInstance.render();

    document.getElementById('attributionTableTitle').textContent =
        `Spot-by-spot lift — ${station}, ${displayDate}`;
    document.getElementById('attributionTableCard').style.display = 'block';

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

        if (lift !== null && liftPct !== null) {
            if (lift > 0) {
                liftClass = 'lift-positive';
                liftText  = `+${lift} views (+${liftPct}%)`;
            } else if (lift < 0) {
                liftClass = 'lift-negative';
                liftText  = `${lift} views (${liftPct}%)`;
            } else {
                liftText = '0 views (0%)';
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