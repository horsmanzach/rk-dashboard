function updateAttributionAvailability() {
    const el = document.getElementById('attributionStationAvailability');
    if (!el) return;

	console.log('🔍 Attribution availability check:', JSON.stringify({
    wtla: syracuseStationData?.wtla?.summary?.dateRange,
    wkrl: syracuseStationData?.wkrl?.summary?.dateRange,
    wktw: syracuseStationData?.wktw?.summary?.dateRange,
    wzun: syracuseStationData?.wzun?.summary?.dateRange
}));
	
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

function showAttributionPanel() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    document.getElementById('attributionDate').value = dateStr;
    navigateToSlide('attribution');
	updateAttributionAvailability();
}

function loadAttributionData() {
    const station = document.getElementById('attributionStation').value;
    const date    = document.getElementById('attributionDate').value;

    if (!date) {
        alert('Please select a date.');
        return;
    }

    document.getElementById('attributionLoading').style.display = 'block';
    document.getElementById('attributionChartCard').style.display = 'none';
    document.getElementById('attributionTableCard').style.display = 'none';

    jQuery.ajax({
        url: dashboardConfig.ajaxUrl,
        type: 'POST',
        data: {
            action: 'fetch_commercial_attribution',
            nonce:   dashboardConfig.nonce,
            date:    date,
            station: station
        },
        timeout: 35000,
        success: function(response) {
            document.getElementById('attributionLoading').style.display = 'none';
            if (response.success) {
                renderAttributionData(response.data, station, date);
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

function renderAttributionData(data, station, date) {
    const hourlySessions = data.hourlySessions || [];
    const spots          = data.spots          || [];

    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById('attributionChartLabel').textContent =
        `Website sessions by hour — ${station}, ${displayDate}`;
    document.getElementById('attributionChartContainer').style.display = 'block';
    document.getElementById('attributionChartCard').style.display = 'block';

    const hours = hourlySessions.map(h => {
        const hr = h.hour;
        if (hr === 0)  return '12am';
        if (hr < 12)   return hr + 'am';
        if (hr === 12) return '12pm';
        return (hr - 12) + 'pm';
    });
    const sessions = hourlySessions.map(h => h.sessions);

    const annotations = spots.map(spot => ({
        x: hours[spot.hour] || '',
        borderColor: '#e34948',
        borderWidth: 1.5,
        strokeDashArray: 4,
        label: { show: false }
    }));

    if (window.attributionChartInstance) {
        window.attributionChartInstance.destroy();
    }

    window.attributionChartInstance = new ApexCharts(
    document.getElementById('attributionChart'),
    {
        chart: { type: 'area', height: 220, toolbar: { show: false }, zoom: { enabled: false } },
        series: [{ name: 'Sessions', data: sessions }],
        xaxis: { categories: hours, labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '11px' } } },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#2a78d6'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.02, stops: [0, 100] } },
        markers: { size: 3 },
        annotations: { xaxis: annotations },
        grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: val => val + ' sessions' } }
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