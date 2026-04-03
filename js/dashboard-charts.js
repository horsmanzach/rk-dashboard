/**
 * Dashboard Charts - Overview Chart
 * Displays 24 months of data in monthly view
 * Series:
 *   - Total Google Ads Spend (bright green bar, stack group A)
 *   - Total Meta Ads Spend (bright blue bar, stack group A)
 *   - Individual Google campaigns (muted green bars, stack group B) — hidden by default
 *   - Individual Meta campaigns (muted blue bars, stack group B) — hidden by default
 *   - Historical Google aggregate (muted green bar, stack group B) — hidden by default
 *   - Historical Meta aggregate (muted blue bar, stack group B) — hidden by default
 *   - Total TV / Radio Ads (red line)
 * Initial view shows last 12 months, pan left to view prior 12 months
 */

// ============================================================
// CONSTANTS & GLOBALS
// ============================================================

const GOOGLE_COLOR        = '#34a853'; // Bright green — total
const GOOGLE_MUTED        = '#8fc9a3'; // Muted green — individual campaigns
const META_COLOR          = '#1877f2'; // Bright blue — total
const META_MUTED          = '#80b3f8'; // Muted blue — individual campaigns
const RADIO_COLOR         = '#ff6b6b'; // Red line — TV/Radio

let welcomeChart      = null;
let chartInitialized  = false;

// Stores processed campaign series metadata for toggle panel rendering
// { name, seriesName, platform, isHistorical }
let campaignSeriesMeta = [];

// ============================================================
// INITIALIZATION
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChart);
} else {
    initChart();
}

window.addEventListener('load', initChart);

function initChart() {
    if (chartInitialized) return;
    const container = document.querySelector('#welcomeUnifiedChart');
    if (!container) {
        console.error('❌ Chart container not found!');
        return;
    }
    chartInitialized = true;
    console.log('🚀 Initializing chart...');
    setTimeout(() => fetchWelcomeChartData(), 500);
}

// ============================================================
// DATA FETCHING
// ============================================================

async function fetchWelcomeChartData() {
    try {
        showChartLoading();

        const [googleData, metaData, tvRadioData] = await Promise.all([
            fetchGoogleAdsOverview(),
            fetchMetaAdsOverview(),
            fetchAllTVRadioData()
        ]);

        const chartData = processWelcomeData(googleData, metaData, tvRadioData);

        if (welcomeChart) {
            welcomeChart.updateOptions({
                series: chartData.series,
                xaxis: { categories: chartData.labels }
            });
        } else {
            createWelcomeChart(chartData);
        }

        hideChartLoading();

    } catch (error) {
        console.error('❌ Error fetching welcome chart data:', error);
        showChartError();
    }
}

async function fetchGoogleAdsOverview() {
    const formData = new FormData();
    formData.append('action', 'fetch_google_ads_summary');
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: formData });
    const result   = await response.json();

    if (result.success && result.data) {
        console.log('✅ Google Ads Overview received');
        return result.data;
    }

    console.warn('⚠️ Google Ads Overview fetch failed:', result);
    return { campaigns: [] };
}

async function fetchMetaAdsOverview() {
    const formData = new FormData();
    formData.append('action', 'fetch_facebook_ads_summary');
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: formData });
    const result   = await response.json();

    if (result.success && result.data) {
        console.log('✅ Meta Ads Overview received');
        return result.data;
    }

    console.warn('⚠️ Meta Ads Overview fetch failed:', result);
    return { campaigns: [], chartData: { campaigns: [] } };
}

async function fetchAllTVRadioData() {
    const makeBody = (action) => {
        const fd = new FormData();
        fd.append('action', action);
        fd.append('nonce', dashboardConfig.nonce);
        return fd;
    };

    const [wtla, wkrl, wktw, wzun] = await Promise.all([
        fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: makeBody('fetch_wtla_ads') }).then(r => r.json()),
        fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: makeBody('fetch_tvradio_ads') }).then(r => r.json()),
        fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: makeBody('fetch_wktw_ads') }).then(r => r.json()),
        fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: makeBody('fetch_wzun_ads') }).then(r => r.json())
    ]);

    return {
        wtla: wtla.success ? wtla.data : null,
        wkrl: wkrl.success ? wkrl.data : null,
        wktw: wktw.success ? wktw.data : null,
        wzun: wzun.success ? wzun.data : null
    };
}

// ============================================================
// DATE HELPERS
// ============================================================

function generateMonthlyLabels(count = 24) {
    const labels = [];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
    }
    return labels;
}

function getMonthLabel(dateStr) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [year, month] = dateStr.split('-').map(Number);
    return `${months[month - 1]} ${year}`;
}

function parseRadioDate(dateStr) {
    if (!dateStr || dateStr === 'N/A' || dateStr === '-') return null;
    try {
        const [month, day, year] = dateStr.split('/');
        const yearNum = parseInt(year);
        const fullYear = yearNum < 100 ? (yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum) : yearNum;
        return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    } catch (e) {
        return null;
    }
}

// ============================================================
// DATA PROCESSING
// ============================================================

/**
 * Aggregate a campaign's weeklyBreakdown into monthly grouped data points { x, y, group }
 */
function aggregateCampaignToMonths(campaign, labels) {
    const totals = new Array(labels.length).fill(0);
    if (!campaign.weeklyBreakdown || campaign.weeklyBreakdown.length === 0) return totals;
    campaign.weeklyBreakdown.forEach(week => {
        const idx = labels.indexOf(getMonthLabel(week.week));
        if (idx !== -1) totals[idx] += week.spend || 0;
    });
    return totals.map(v => parseFloat(v.toFixed(2)));
}

// Helper: get raw monthly numeric totals from a campaign (no grouping)
function aggregateCampaignRaw(campaign, labels) {
    const totals = new Array(labels.length).fill(0);
    if (!campaign.weeklyBreakdown || campaign.weeklyBreakdown.length === 0) return totals;
    campaign.weeklyBreakdown.forEach(week => {
        const idx = labels.indexOf(getMonthLabel(week.week));
        if (idx !== -1) totals[idx] += week.spend || 0;
    });
    return totals;
}

// Helper: convert a plain value array + labels into grouped data points
function toGroupedData(valArray, labels, group) {
    return labels.map((label, i) => ({
        x: label,
        y: parseFloat((valArray[i] || 0).toFixed(2)),
        group
    }));
}

/**
 * Main data processing function.
 * Builds:
 *   - 3 aggregate total series (Google, Meta, TV/Radio)
 *   - Per active-campaign series for Google and Meta (hidden by default)
 *   - One historical aggregate series each for Google and Meta (hidden by default)
 * Also populates the global campaignSeriesMeta array for toggle panel rendering.
 */
function processWelcomeData(googleData, metaData, tvRadioData) {
    console.log('📊 Processing welcome chart data...');

    const labels = generateMonthlyLabels(24);

    // Reset campaign series metadata
    campaignSeriesMeta = [];

    // ----------------------------------------------------------------
    // GOOGLE ADS
    // ----------------------------------------------------------------
    // Google: data.campaigns contains all campaigns with status + weeklyBreakdown
    const googleAllCampaigns = googleData.campaigns || [];
    console.log(`🟢 Google: ${googleAllCampaigns.length} total campaigns`);

    const googleActiveCampaigns   = googleAllCampaigns.filter(c => c.status === 'ENABLED');
    const googleInactiveCampaigns = googleAllCampaigns.filter(c => c.status !== 'ENABLED');
    console.log(`🟢 Google active: ${googleActiveCampaigns.length}, inactive: ${googleInactiveCampaigns.length}`);

    // Build total aggregate (all campaigns)
    const googleTotals = new Array(labels.length).fill(0);
    googleAllCampaigns.forEach(campaign => {
        const monthly = aggregateCampaignRaw(campaign, labels);
        monthly.forEach((v, i) => { googleTotals[i] += v; });
    });

    // Build per-active-campaign series
    const googleCampaignSeries = googleActiveCampaigns.map(campaign => {
        const data = aggregateCampaignToMonths(campaign, labels);
        const seriesName = `G: ${campaign.name}`;
        campaignSeriesMeta.push({
            name: campaign.name,
            seriesName,
            platform: 'google',
            isHistorical: false
        });
        return {
            name: seriesName,
            type: 'bar',
            data,
            color: GOOGLE_MUTED,

        };
    });

    // Build historical Google aggregate
    const googleHistoricalTotals = new Array(labels.length).fill(0);
    googleInactiveCampaigns.forEach(campaign => {
        const monthly = aggregateCampaignRaw(campaign, labels);
        monthly.forEach((v, i) => { googleHistoricalTotals[i] += v; });
    });
    const googleHistoricalRounded = googleHistoricalTotals.map(v => parseFloat(v.toFixed(2)));
    const hasGoogleHistorical = googleHistoricalRounded.some(v => v > 0);
    if (hasGoogleHistorical) {
        campaignSeriesMeta.push({
            name: 'Historical (Inactive) Campaigns',
            seriesName: 'G: Historical',
            platform: 'google',
            isHistorical: true
        });
    }

    // ----------------------------------------------------------------
    // META ADS
    // ----------------------------------------------------------------
    // Meta: active campaign IDs from data.campaigns (cards), chart data from data.chartData.campaigns
    const metaCardCampaigns  = metaData.campaigns || [];
    const metaChartCampaigns = (metaData.chartData && metaData.chartData.campaigns) ? metaData.chartData.campaigns : [];
    const metaActiveIds      = new Set(metaCardCampaigns.map(c => c.id));

    console.log(`🔵 Meta: ${metaChartCampaigns.length} chart campaigns, ${metaCardCampaigns.length} active card campaigns`);

    const metaActiveCampaigns   = metaChartCampaigns.filter(c => metaActiveIds.has(c.id));
    const metaInactiveCampaigns = metaChartCampaigns.filter(c => !metaActiveIds.has(c.id));
    console.log(`🔵 Meta active: ${metaActiveCampaigns.length}, inactive: ${metaInactiveCampaigns.length}`);

    // Build total aggregate (all chart campaigns)
    const metaTotals = new Array(labels.length).fill(0);
    metaChartCampaigns.forEach(campaign => {
        const monthly = aggregateCampaignRaw(campaign, labels);
        monthly.forEach((v, i) => { metaTotals[i] += v; });
    });

    // Build per-active-campaign series
    const metaCampaignSeries = metaActiveCampaigns.map(campaign => {
        const data = aggregateCampaignToMonths(campaign, labels);
        const seriesName = `M: ${campaign.name}`;
        campaignSeriesMeta.push({
            name: campaign.name,
            seriesName,
            platform: 'meta',
            isHistorical: false
        });
        return {
            name: seriesName,
            type: 'bar',
            data,
            color: META_MUTED,

        };
    });

    // Build historical Meta aggregate
    const metaHistoricalTotals = new Array(labels.length).fill(0);
    metaInactiveCampaigns.forEach(campaign => {
        const monthly = aggregateCampaignRaw(campaign, labels);
        monthly.forEach((v, i) => { metaHistoricalTotals[i] += v; });
    });
    const metaHistoricalRounded = metaHistoricalTotals.map(v => parseFloat(v.toFixed(2)));
    const hasMetaHistorical = metaHistoricalRounded.some(v => v > 0);
    if (hasMetaHistorical) {
        campaignSeriesMeta.push({
            name: 'Historical (Inactive) Campaigns',
            seriesName: 'M: Historical',
            platform: 'meta',
            isHistorical: true
        });
    }

    // ----------------------------------------------------------------
    // TV / RADIO
    // ----------------------------------------------------------------
    const radioTotals = new Array(labels.length).fill(0);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    ['wtla', 'wkrl', 'wktw', 'wzun'].forEach(stationKey => {
        const stationData = tvRadioData[stationKey];
        if (!stationData || !stationData.orders) return;
        console.log(`📻 Processing ${stationKey}`);
        stationData.orders.forEach(order => {
            if (!order.dailyBreakdown) return;
            order.dailyBreakdown.forEach(day => {
                const date = parseRadioDate(day.date);
                if (!date) return;
                const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
                const idx = labels.indexOf(monthLabel);
                if (idx !== -1) radioTotals[idx] += day.adCount || 0;
            });
        });
    });

    // ----------------------------------------------------------------
    // ROUND & LOG
    // ----------------------------------------------------------------
    const googleRounded = googleTotals.map(v => parseFloat(v.toFixed(2)));
    const metaRounded   = metaTotals.map(v => parseFloat(v.toFixed(2)));

    console.log('✅ Google monthly totals:', googleRounded);
    console.log('✅ Meta monthly totals:', metaRounded);
    console.log('✅ Radio monthly totals:', radioTotals);
    console.log('✅ Campaign series meta:', campaignSeriesMeta);

    // ----------------------------------------------------------------
    // BUILD SERIES ARRAY
    // Order: totals first (stack group A), then campaign detail (stack group B), then radio line
    // ----------------------------------------------------------------
    const series = [
        // --- Totals (each in own unique group = side-by-side, not stacked with campaigns) ---
        {
            name: 'Total Google Ads',
            type: 'bar',
            data: googleRounded,
            color: GOOGLE_COLOR
        },
        {
            name: 'Total Meta Ads',
            type: 'bar',
            data: metaRounded,
            color: META_COLOR
        },

        // --- Google active campaigns (stack group B, hidden) ---
        ...googleCampaignSeries,

        // --- Google historical aggregate (stack group B, hidden) ---
        ...(hasGoogleHistorical ? [{
            name: 'G: Historical',
            type: 'bar',
            data: googleHistoricalRounded,
            color: GOOGLE_MUTED
        }] : []),

        // --- Meta active campaigns (stack group B, hidden) ---
        ...metaCampaignSeries,

        // --- Meta historical aggregate (stack group B, hidden) ---
        ...(hasMetaHistorical ? [{
            name: 'M: Historical',
            type: 'bar',
            data: metaHistoricalRounded,
            color: META_MUTED
        }] : []),

        // --- TV/Radio line ---
        {
            name: 'Total TV / Radio Ads',
            type: 'line',
            data: radioTotals,
            color: RADIO_COLOR
        }
    ];

    return { labels, series };
}

// ============================================================
// CHART CREATION
// ============================================================

function createWelcomeChart(chartData) {
    const allLabels   = chartData.labels;
    const totalMonths = allLabels.length; // 24
    const initialMin  = allLabels[totalMonths - 12];
    const initialMax  = allLabels[totalMonths - 1];

    // Stroke widths: 0 for bars, 3 for TV/Radio line
    // We'll set per-series via the colors array ordering
    const strokeWidths = chartData.series.map(s => s.type === 'line' ? 3 : 0);
    const fillOpacity  = chartData.series.map(s => s.type === 'line' ? 1 : 0.9);

    // Build yaxis config — one visible left axis for spend, one hidden per spend series,
    // one right axis for TV/Radio
    const yaxis = chartData.series.map((s, i) => {
        if (s.name === 'Total Google Ads') {
            return {
                seriesName: 'Total Google Ads',
                title: {
                    text: 'Ad Spend ($)',
                    style: { fontSize: '13px', fontWeight: 600, color: '#4285f4' }
                },
                labels: { formatter: val => '$' + Math.round(val).toLocaleString() }
            };
        }
        if (s.name === 'Total TV / Radio Ads') {
            return {
                seriesName: 'Total TV / Radio Ads',
                opposite: true,
                title: {
                    text: 'TV / Radio Ads Played',
                    style: { fontSize: '13px', fontWeight: 600, color: RADIO_COLOR }
                },
                labels: { formatter: val => Math.round(val) + ' ads' }
            };
        }
        // All other series share the left spend axis (hidden)
        return {
            seriesName: 'Total Google Ads',
            show: false
        };
    });

    const options = {
        series: chartData.series,
        chart: {
            height: 480,
            type: 'line',
            stacked: false,
            toolbar: {
                show: true,
                autoSelected: 'pan', // Pan is active by default — drag to scroll x-axis
                tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
            },
            animations: { enabled: true, easing: 'easeinout', speed: 600 },
            events: {
                mounted: function(chartCtx) {
                    // Hide all campaign detail series on mount
                    // Campaign series are identified by G: or M: prefix
                    chartData.series.forEach(s => {
                        if (s.name.startsWith('G: ') || s.name.startsWith('M: ')) {
                            chartCtx.hideSeries(s.name);
                        }
                    });

                    // Set initial zoom to last 12 months
                    chartCtx.zoomX(
                        allLabels.indexOf(initialMin),
                        allLabels.indexOf(initialMax)
                    );

                    // Init nav state to match initial zoom
                    chartNavInit(totalMonths, initialMin, initialMax, allLabels);

                    // Render nav panel and toggle panel
                    renderChartNavPanel();
                    renderCampaignTogglePanel();
                }
            }
        },
        colors: chartData.series.map(s => s.color),
        dataLabels: {
            enabled: false  // Remove all white numbers from bars
        },
        stroke: {
            width: strokeWidths,
            curve: 'smooth',
            // White separator lines between stacked campaign segments
            colors: chartData.series.map(s => s.type === 'bar' ? '#ffffff' : 'transparent'),
            dashArray: 0,
            lineCap: 'butt'
        },
        plotOptions: {
            bar: {
                columnWidth: '55%',
                borderRadius: 0,
                // Total series (Google, Meta) render ungrouped side-by-side.
                // Campaign detail series share a stack group so they stack on top of each other.
                // ApexCharts respects the series-level `group` property when chart.stacked is false.
            }
        },
        fill: { opacity: fillOpacity },
        markers: {
            size: chartData.series.map(s => s.type === 'line' ? 4 : 0),
            strokeWidth: 2,
            hover: { size: 6 }
        },
        xaxis: {
            categories: allLabels,
            type: 'category',
            title: { text: 'Month', style: { fontSize: '13px', fontWeight: 600 } },
            tickPlacement: 'on',
            labels: { rotate: -45, rotateAlways: false, style: { fontSize: '11px' } }
        },
        yaxis,
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function(val, opts) {
                    if (val === undefined || val === null) return undefined;
                    const name = opts.w.config.series[opts.seriesIndex].name;
                    if (name === 'Total TV / Radio Ads') return Math.round(val) + ' ads played';
                    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
        },
        legend: {
            show: false // We use our own external toggle panel
        },
        title: {
            text: 'Marketing Performance Overview',
            align: 'center',
            style: { fontSize: '20px', fontWeight: 600 }
        },
        subtitle: {
            text: 'Showing last 12 months — pan left to view prior history',
            align: 'center',
            style: { fontSize: '12px', color: '#999' }
        },
        noData: {
            text: 'Loading data...',
            align: 'center',
            verticalAlign: 'middle',
            style: { fontSize: '16px', color: '#999' }
        }
    };

    welcomeChart = new ApexCharts(document.querySelector('#welcomeUnifiedChart'), options);
    welcomeChart.render();

    return welcomeChart;
}

// ============================================================
// CHART NAVIGATION — scroll buttons + zoom controls
// ============================================================

// Tracks current visible window as index range into allLabels (0–23)
const chartNav = {
    min: 0,       // will be set after chart mounts
    max: 11,      // will be set after chart mounts
    total: 24,    // total months available
    step: 3,      // months per scroll click
    zoomStep: 3   // months to add/remove per zoom click
};

function chartNavInit(totalMonths, initialMin, initialMax, allLabels) {
    chartNav.total = totalMonths;
    chartNav.min   = allLabels.indexOf(initialMin);
    chartNav.max   = allLabels.indexOf(initialMax);
}

function chartNavApply() {
    welcomeChart.zoomX(chartNav.min, chartNav.max);
}

function chartScrollLeft() {
    const range = chartNav.max - chartNav.min;
    chartNav.min = Math.max(0, chartNav.min - chartNav.step);
    chartNav.max = chartNav.min + range;
    if (chartNav.max >= chartNav.total) {
        chartNav.max = chartNav.total - 1;
        chartNav.min = chartNav.max - range;
    }
    chartNavApply();
}

function chartScrollRight() {
    const range = chartNav.max - chartNav.min;
    chartNav.max = Math.min(chartNav.total - 1, chartNav.max + chartNav.step);
    chartNav.min = chartNav.max - range;
    if (chartNav.min < 0) {
        chartNav.min = 0;
        chartNav.max = range;
    }
    chartNavApply();
}

function chartZoomIn() {
    const center = Math.round((chartNav.min + chartNav.max) / 2);
    const newRange = Math.max(2, (chartNav.max - chartNav.min) - chartNav.zoomStep);
    chartNav.min = Math.max(0, center - Math.round(newRange / 2));
    chartNav.max = chartNav.min + newRange;
    if (chartNav.max >= chartNav.total) {
        chartNav.max = chartNav.total - 1;
        chartNav.min = chartNav.max - newRange;
    }
    chartNavApply();
}

function chartZoomOut() {
    const center = Math.round((chartNav.min + chartNav.max) / 2);
    const newRange = Math.min(chartNav.total - 1, (chartNav.max - chartNav.min) + chartNav.zoomStep);
    chartNav.min = Math.max(0, center - Math.round(newRange / 2));
    chartNav.max = chartNav.min + newRange;
    if (chartNav.max >= chartNav.total) {
        chartNav.max = chartNav.total - 1;
        chartNav.min = Math.max(0, chartNav.max - newRange);
    }
    chartNavApply();
}

function chartZoomReset() {
    // Reset to default 12-month view (last 12 months)
    chartNav.max = chartNav.total - 1;
    chartNav.min = chartNav.max - 11;
    chartNavApply();
}

function renderChartNavPanel() {
    const panel = document.getElementById('chartNavPanel');
    if (!panel) {
        console.warn('⚠️ #chartNavPanel not found in DOM');
        return;
    }

    panel.innerHTML = `
        <div class="chart-nav">
            <button class="chart-nav__btn chart-nav__btn--arrow" onclick="chartScrollLeft()" title="Scroll back 3 months">
                &#9664; <span>3 Months</span>
            </button>
            <div class="chart-nav__zoom">
                <button class="chart-nav__btn chart-nav__btn--zoom" onclick="chartZoomIn()" title="Zoom in">+</button>
                <button class="chart-nav__btn chart-nav__btn--reset" onclick="chartZoomReset()" title="Reset to last 12 months">Reset</button>
                <button class="chart-nav__btn chart-nav__btn--zoom" onclick="chartZoomOut()" title="Zoom out">−</button>
            </div>
            <button class="chart-nav__btn chart-nav__btn--arrow" onclick="chartScrollRight()" title="Scroll forward 3 months">
                <span>3 Months</span> &#9654;
            </button>
        </div>
    `;
}

// ============================================================
// CAMPAIGN TOGGLE PANEL
// ============================================================

/**
 * Tracks which campaign series are currently visible
 * Key: seriesName, Value: boolean
 */
const campaignVisibility = {};

/**
 * Toggle a campaign series on/off
 */
function toggleCampaignSeries(seriesName, btn) {
    const isVisible = campaignVisibility[seriesName] || false;

    if (isVisible) {
        welcomeChart.hideSeries(seriesName);
        campaignVisibility[seriesName] = false;
        btn.classList.remove('toggle-btn--active');
        btn.classList.add('toggle-btn--inactive');
    } else {
        welcomeChart.showSeries(seriesName);
        campaignVisibility[seriesName] = true;
        btn.classList.remove('toggle-btn--inactive');
        btn.classList.add('toggle-btn--active');
    }
}

/**
 * Build and inject the toggle panel below the chart container
 */
function renderCampaignTogglePanel() {
    const panel = document.getElementById('campaignTogglePanel');
    if (!panel) {
        console.warn('⚠️ #campaignTogglePanel not found in DOM');
        return;
    }

    // Split into Google and Meta groups
    const googleMeta = campaignSeriesMeta.filter(c => c.platform === 'google');
    const metaMeta   = campaignSeriesMeta.filter(c => c.platform === 'meta');

    panel.innerHTML = `
        <div class="toggle-panel">
            ${renderToggleGroup('Google Ads Campaigns', googleMeta, 'google')}
            ${renderToggleGroup('Meta Ads Campaigns', metaMeta, 'meta')}
        </div>
    `;
}

function renderToggleGroup(title, campaigns, platform) {
    if (campaigns.length === 0) return '';

    const accentColor = platform === 'google' ? GOOGLE_MUTED : META_MUTED;
    const dotColor    = platform === 'google' ? GOOGLE_COLOR : META_COLOR;

    const buttons = campaigns.map(c => {
        campaignVisibility[c.seriesName] = false; // init all as hidden
        const label = c.isHistorical
            ? '⏱ Historical (Inactive) Campaigns'
            : c.name;
        return `
            <button
                class="toggle-btn toggle-btn--inactive${c.isHistorical ? ' toggle-btn--historical' : ''}"
                data-series="${escapeAttr(c.seriesName)}"
                onclick="toggleCampaignSeries('${escapeAttr(c.seriesName)}', this)"
                title="${escapeAttr(c.name)}"
            >
                ${label}
            </button>
        `;
    }).join('');

    return `
        <div class="toggle-group">
            <div class="toggle-group__header">
                <span class="toggle-group__dot" style="background:${dotColor}"></span>
                <span class="toggle-group__title">${title}</span>
            </div>
            <div class="toggle-group__buttons">
                ${buttons}
            </div>
        </div>
    `;
}

function escapeAttr(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ============================================================
// LOADING / ERROR STATES
// ============================================================

function showChartLoading() {
    const container = document.querySelector('#welcomeUnifiedChart');
    if (container) {
        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:450px;color:#999;">
                <div style="text-align:center;">
                    <div style="width:50px;height:50px;border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
                    <p>Loading chart data...</p>
                </div>
            </div>`;
    }
}

function hideChartLoading() {
    // Chart render replaces loading content automatically
}

function showChartError() {
    const container = document.querySelector('#welcomeUnifiedChart');
    if (container) {
        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:450px;color:#999;">
                <div style="text-align:center;">
                    <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
                    <p>Error loading chart data</p>
                    <button onclick="fetchWelcomeChartData()" style="margin-top:1rem;padding:0.5rem 1rem;background:#667eea;color:white;border:none;border-radius:5px;cursor:pointer;">
                        Retry
                    </button>
                </div>
            </div>`;
    }
}

// Spinner CSS
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`;
document.head.appendChild(spinStyle);