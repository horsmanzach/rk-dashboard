/**
 * Dashboard Charts - Overview Chart
 * Displays 104 weeks (~2 years) of data in weekly view
 * Series:
 *   - Total Google Ads Spend (bright green bar)
 *   - Total Meta Ads Spend (bright blue bar)
 *   - Individual Google campaigns (muted green bars) — hidden by default
 *   - Individual Meta campaigns (muted blue bars) — hidden by default
 *   - Historical Google aggregate (muted green bar) — hidden by default
 *   - Historical Meta aggregate (muted blue bar) — hidden by default
 *   - Total TV / Radio Ads (red line)
 * Initial view shows last 52 weeks, pan left to view prior 52 weeks
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
        const data = result.data;
        console.log('✅ Google Ads Overview received');
        console.log('🔬 Google campaigns count:', data.campaigns?.length);
        console.log('🔬 Google first campaign:', data.campaigns?.[0]?.name);
        console.log('🔬 Google first weeklyBreakdown entry:', data.campaigns?.[0]?.weeklyBreakdown?.[0]);
        console.log('🔬 Google full data keys:', Object.keys(data));
        return data;
    }

    console.warn('⚠️ Google Ads Overview fetch failed:', result);
    console.warn('⚠️ Full result object:', result);
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

    const fetchStation = (action) =>
        fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: makeBody(action) })
            .then(r => r.json());

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Stagger requests 5s apart to stay under the
    // Google Sheets 60 reads/minute quota ceiling.
    const wtla = await fetchStation('fetch_wtla_ads');
    await sleep(3000);
    const wkrl = await fetchStation('fetch_tvradio_ads');
    await sleep(3000);
    const wktw = await fetchStation('fetch_wktw_ads');
   await sleep(3000);
    const wzun = await fetchStation('fetch_wzun_ads');

    return {
        wtla: wtla.success ? wtla.data : null,
        wkrl: wkrl.success ? wkrl.data : null,
        wktw: wktw.success ? wktw.data : null,
        wzun: wzun.success ? wzun.data : null,
    };
}

// ============================================================
// DATE HELPERS
// ============================================================

/**
 * Generate weekly labels for the chart.
 * Each label is the Monday of that week: "May 5 2025"
 * Produces `weekCount` labels ending on the most recent Monday.
 */
function generateWeeklyLabels(weekCount = 104) {
    const labels = [];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();

    // Find the most recent Monday (or today if today is Monday)
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday);
    lastMonday.setHours(0, 0, 0, 0);

    for (let i = weekCount - 1; i >= 0; i--) {
        const weekStart = new Date(lastMonday);
        weekStart.setDate(lastMonday.getDate() - (i * 7));
        labels.push(`${months[weekStart.getMonth()]} ${weekStart.getDate()} ${weekStart.getFullYear()}`);
    }

    return labels;
}

/**
 * Convert a YYYY-MM-DD date string into a weekly label matching
 * the format produced by generateWeeklyLabels().
 * Snaps to the Monday of the given date's week.
 */
function weekDateToLabel(dateStr) {
    if (!dateStr) return null;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);

    // Snap to Monday of this week
    const dow = d.getDay(); // 0=Sun, 1=Mon...
    const daysToMonday = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - daysToMonday);

    return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/**
 * Parse a radio date string in M/D/YY or M/D/YYYY format.
 * Returns a Date object or null on failure.
 */
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
// DATA PROCESSING — AGGREGATION HELPERS
// ============================================================

/**
 * Aggregate a campaign's weeklyBreakdown into per-week totals,
 * returning a rounded array aligned to the provided labels array.
 * Uses week.week (YYYY-MM-DD) → weekDateToLabel() for label matching.
 */
function aggregateCampaignToWeeks(campaign, labels) {
    const totals = new Array(labels.length).fill(0);
    if (!campaign.weeklyBreakdown || campaign.weeklyBreakdown.length === 0) return totals;

    campaign.weeklyBreakdown.forEach(week => {
        const label = weekDateToLabel(week.week);
        if (!label) return;
        const idx = labels.indexOf(label);
        if (idx !== -1) totals[idx] += week.spend || 0;
    });

    return totals.map(v => parseFloat(v.toFixed(2)));
}

/**
 * Same as aggregateCampaignToWeeks but returns raw (unrounded) values.
 * Used for building aggregate totals before final rounding.
 */
function aggregateCampaignRaw(campaign, labels) {
    const totals = new Array(labels.length).fill(0);
    if (!campaign.weeklyBreakdown || campaign.weeklyBreakdown.length === 0) return totals;

    campaign.weeklyBreakdown.forEach(week => {
        const label = weekDateToLabel(week.week);
        if (!label) return;
        const idx = labels.indexOf(label);
        if (idx !== -1) totals[idx] += week.spend || 0;
    });

    return totals;
}

// ============================================================
// DATA PROCESSING — MAIN
// ============================================================

/**
 * Main data processing function.
 * Builds:
 *   - 3 aggregate total series (Google, Meta, TV/Radio)
 *   - Per active-campaign series for Google and Meta (hidden by default)
 *   - One historical aggregate series each for Google and Meta (hidden by default)
 * Also populates the global campaignSeriesMeta array for toggle panel rendering.
 */
function processWelcomeData(googleData, metaData, tvRadioData) {
    console.log("=== processWelcomeData START ===");
    console.log("googleData:", googleData);
    console.log("googleData.campaigns:", googleData?.campaigns);
    console.log("googleData.campaigns length:", googleData?.campaigns?.length);
    console.log("metaData keys:", Object.keys(metaData || {}));
    const labels = generateWeeklyLabels(104);
    console.log("First 3 weekly labels:", labels.slice(0, 3));
    console.log("Last 3 weekly labels:", labels.slice(-3));

    // Reset campaign series metadata
    campaignSeriesMeta = [];

    // ----------------------------------------------------------------
    // GOOGLE ADS
    // card campaigns carry status; chartData campaigns carry weeklyBreakdown
    // ----------------------------------------------------------------
    const googleCardCampaigns  = googleData.campaigns || [];
    const googleChartCampaigns = (googleData.chartData && googleData.chartData.campaigns)
        ? googleData.chartData.campaigns
        : [];
    const googleEnabledIds = new Set(
        googleCardCampaigns.filter(c => c.status === 'ENABLED').map(c => c.id)
    );

    console.log(`🟢 Google: ${googleChartCampaigns.length} chart campaigns, ${googleCardCampaigns.length} card campaigns`);

    const googleActiveCampaigns   = googleChartCampaigns.filter(c => googleEnabledIds.has(c.id));
    const googleInactiveCampaigns = googleChartCampaigns.filter(c => !googleEnabledIds.has(c.id));
    console.log(`🟢 Google active: ${googleActiveCampaigns.length}, inactive: ${googleInactiveCampaigns.length}`);

    // Build total aggregate (all chart campaigns)
    const googleTotals = new Array(labels.length).fill(0);
    googleChartCampaigns.forEach(campaign => {
        const weekly = aggregateCampaignRaw(campaign, labels);
        weekly.forEach((v, i) => { googleTotals[i] += v; });
    });

    // Build per-active-campaign series
    const googleCampaignSeries = googleActiveCampaigns.map(campaign => {
        const data = aggregateCampaignToWeeks(campaign, labels);
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
            color: GOOGLE_MUTED
        };
    });

    // Build historical Google aggregate
    const googleHistoricalTotals = new Array(labels.length).fill(0);
    googleInactiveCampaigns.forEach(campaign => {
        const weekly = aggregateCampaignRaw(campaign, labels);
        weekly.forEach((v, i) => { googleHistoricalTotals[i] += v; });
    });
    const googleHistoricalRounded = googleHistoricalTotals.map(v => parseFloat(v.toFixed(2)));
    const hasGoogleHistorical = googleHistoricalRounded.some(v => v > 0);
    if (hasGoogleHistorical) {
        campaignSeriesMeta.push({
            name: 'Inactive Campaigns',
            seriesName: 'G: Inactive Campaigns',
            platform: 'google',
            isHistorical: true
        });
    }

    // ----------------------------------------------------------------
    // META ADS
    // ----------------------------------------------------------------
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
        const weekly = aggregateCampaignRaw(campaign, labels);
        weekly.forEach((v, i) => { metaTotals[i] += v; });
    });

    // Build per-active-campaign series
    const metaCampaignSeries = metaActiveCampaigns.map(campaign => {
        const data = aggregateCampaignToWeeks(campaign, labels);
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
            color: META_MUTED
        };
    });

    // Build historical Meta aggregate
    const metaHistoricalTotals = new Array(labels.length).fill(0);
    metaInactiveCampaigns.forEach(campaign => {
        const weekly = aggregateCampaignRaw(campaign, labels);
        weekly.forEach((v, i) => { metaHistoricalTotals[i] += v; });
    });
    const metaHistoricalRounded = metaHistoricalTotals.map(v => parseFloat(v.toFixed(2)));
    const hasMetaHistorical = metaHistoricalRounded.some(v => v > 0);
    if (hasMetaHistorical) {
        campaignSeriesMeta.push({
            name: 'Inactive Campaigns',
            seriesName: 'M: Inactive Campaigns',
            platform: 'meta',
            isHistorical: true
        });
    }

    // ----------------------------------------------------------------
    // TV / RADIO
    // ----------------------------------------------------------------
    const radioTotals = new Array(labels.length).fill(0);

    ['wtla', 'wkrl', 'wktw', 'wzun'].forEach(stationKey => {
        const stationData = tvRadioData[stationKey];
        if (!stationData || !stationData.orders) return;
        console.log(`📻 Processing ${stationKey}`);

        stationData.orders.forEach(order => {
            if (!order.dailyBreakdown) return;

            order.dailyBreakdown.forEach(day => {
                const date = parseRadioDate(day.date);
                if (!date) return;

                // Build a YYYY-MM-DD string then snap to Monday via weekDateToLabel()
                const yyyy = date.getFullYear();
                const mm   = String(date.getMonth() + 1).padStart(2, '0');
                const dd   = String(date.getDate()).padStart(2, '0');
                const weekLabel = weekDateToLabel(`${yyyy}-${mm}-${dd}`);

                const idx = labels.indexOf(weekLabel);
                if (idx !== -1) radioTotals[idx] += day.adCount || 0;
            });
        });
    });

    // ----------------------------------------------------------------
    // ROUND & LOG
    // ----------------------------------------------------------------
    const googleRounded = googleTotals.map(v => parseFloat(v.toFixed(2)));
    const metaRounded   = metaTotals.map(v => parseFloat(v.toFixed(2)));

console.log('✅ Google weekly totals (non-zero weeks):', googleRounded.filter(v => v > 0).length, 'weeks with spend');
console.log('✅ Google sample (last 5 weeks):', googleRounded.slice(-5));
    console.log('✅ Meta weekly totals:', metaRounded);
    console.log('✅ Radio weekly totals:', radioTotals);
    console.log('✅ Campaign series meta:', campaignSeriesMeta);

    // ----------------------------------------------------------------
    // BUILD SERIES ARRAY
    // Order: totals first, then campaign detail (hidden), then radio line
    // ----------------------------------------------------------------
    const series = [
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

        // Google active campaigns (hidden by default)
        ...googleCampaignSeries,

        // Google historical aggregate (hidden by default)
        ...(hasGoogleHistorical ? [{
            name: 'G: Inactive Campaigns',
            type: 'bar',
            data: googleHistoricalRounded,
            color: GOOGLE_MUTED
        }] : []),

        // Meta active campaigns (hidden by default)
        ...metaCampaignSeries,

        // Meta historical aggregate (hidden by default)
        ...(hasMetaHistorical ? [{
            name: 'M: Inactive Campaigns',
            type: 'bar',
            data: metaHistoricalRounded,
            color: META_MUTED
        }] : []),

        // TV/Radio line
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
    const allLabels  = chartData.labels;
    const totalWeeks = allLabels.length; // 104
    const initialMin = allLabels[totalWeeks - 52]; // show last 52 weeks by default
    const initialMax = allLabels[totalWeeks - 1];

    const strokeWidths = chartData.series.map(s => s.type === 'line' ? 3 : 0);
    const fillOpacity  = chartData.series.map(s => s.type === 'line' ? 1 : 0.9);

    const yaxis = chartData.series.map((s, i) => {
        if (s.name === 'Total Google Ads') {
            return {
                seriesName: 'Total Google Ads',
                title: {
                    text: 'Ad Spend ($)',
                    style: { fontSize: '16px', fontWeight: 600, color: '#4285f4' }
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
                    style: { fontSize: '16px', fontWeight: 600, color: RADIO_COLOR }
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
                autoSelected: 'pan',
                tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
            },
            animations: { enabled: true, easing: 'easeinout', speed: 600 },
            events: {
                mounted: function(chartCtx) {
                    console.log('🎯 Chart mounted fired, series count:', chartData.series.length);

                    // Hide all campaign detail series on mount
                    chartData.series.forEach(s => {
                        if (s.name.startsWith('G: ') || s.name.startsWith('M: ')) {
                            chartCtx.hideSeries(s.name);
                        }
                    });

                    console.log('🔍 Zooming to:', initialMin, '->', initialMax);
                    console.log('🔍 Indices:', allLabels.indexOf(initialMin), allLabels.indexOf(initialMax));

                    // Set initial zoom to last 52 weeks
                    chartCtx.zoomX(
                        allLabels.indexOf(initialMin),
                        allLabels.indexOf(initialMax)
                    );

                    chartNavInit(totalWeeks, initialMin, initialMax, allLabels);
                    renderChartNavPanel();
                    renderCampaignTogglePanel();
                }
            }
        },
        colors: chartData.series.map(s => s.color),
        dataLabels: {
            enabled: false
        },
        stroke: {
            width: strokeWidths,
            curve: 'smooth',
            colors: chartData.series.map(s => s.type === 'bar' ? '#ffffff' : 'transparent'),
            dashArray: 0,
            lineCap: 'butt'
        },
        plotOptions: {
            bar: {
                columnWidth: '80%', // wider columns since weekly bars are narrower
                borderRadius: 0
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
            title: { text: 'Week', style: { fontSize: '16px', fontWeight: 600 } },
            tickPlacement: 'on',
            labels: {
                rotate: -45,
                rotateAlways: false,
                style: { fontSize: '11px' },
                // Show only the first week of each month to avoid crowding
                formatter: function(val) {
                    if (!val || typeof val !== 'string') return '';
                    const parts = val.split(' ');
                    if (parts.length < 2) return '';
                    const day = parseInt(parts[1], 10);
                    return day <= 7 ? val : '';
                }
            },
            crosshairs: {
                show: true,
                fill: { type: 'solid', color: '#ff6600' }
            },
            tooltip: {
                enabled: true,
                style: { fontSize: '12px', background: '#ff6600', color: '#ffffff' }
            }
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
            show: false
        },
        title: {
            text: 'Paid Ad Campaign Performance Overview',
            align: 'center',
            style: { fontSize: '20px', fontWeight: 600 }
        },
        subtitle: {
            text: 'Showing last 52 weeks — pan left to view prior history',
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

// Tracks current visible window as index range into allLabels (0–103)
const chartNav = {
    min: 0,        // will be set after chart mounts
    max: 51,       // will be set after chart mounts
    total: 104,    // total weeks available
    step: 4,       // weeks per multi-week scroll click (~1 month)
    zoomStep: 4    // weeks to add/remove per zoom click
};

function chartNavInit(totalWeeks, initialMin, initialMax, allLabels) {
    chartNav.total = totalWeeks;
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

function chartScrollLeftOne() {
    const range = chartNav.max - chartNav.min;
    chartNav.min = Math.max(0, chartNav.min - 1);
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

function chartScrollRightOne() {
    const range = chartNav.max - chartNav.min;
    chartNav.max = Math.min(chartNav.total - 1, chartNav.max + 1);
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
    // Reset to default 52-week view (last 52 weeks)
    chartNav.max = chartNav.total - 1;
    chartNav.min = chartNav.max - 51;
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
            <button class="chart-nav__btn chart-nav__btn--arrow" onclick="chartScrollLeft()" title="Scroll back 4 weeks">
                &#9664; <span>4 Weeks</span>
            </button>
            <button class="chart-nav__btn chart-nav__btn--arrow" onclick="chartScrollLeftOne()" title="Scroll back 1 week">
                &#9664; <span>1 Week</span>
            </button>
            <div class="chart-nav__zoom">
                <button class="chart-nav__btn chart-nav__btn--zoom" onclick="chartZoomIn()" title="Zoom in">+</button>
                <button class="chart-nav__btn chart-nav__btn--reset" onclick="chartZoomReset()" title="Reset to last 52 weeks">Reset</button>
                <button class="chart-nav__btn chart-nav__btn--zoom" onclick="chartZoomOut()" title="Zoom out">−</button>
            </div>
            <button class="chart-nav__btn chart-nav__btn--arrow" onclick="chartScrollRightOne()" title="Scroll forward 1 week">
                <span>1 Week</span> &#9654;
            </button>
            <button class="chart-nav__btn chart-nav__btn--arrow" onclick="chartScrollRight()" title="Scroll forward 4 weeks">
                <span>4 Weeks</span> &#9654;
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

    const googleMeta = campaignSeriesMeta.filter(c => c.platform === 'google');
    const metaMeta   = campaignSeriesMeta.filter(c => c.platform === 'meta');

    panel.innerHTML = `
        <div class="toggle-panel">
            ${renderTotalsToggleGroup()}
            ${renderToggleGroup('Google Ads Campaigns', googleMeta, 'google')}
            ${renderToggleGroup('Meta Ads Campaigns', metaMeta, 'meta')}
        </div>
    `;
}

/**
 * Render the "Overview Totals" toggle group — always-on by default
 */
function renderTotalsToggleGroup() {
    const totals = [
        { seriesName: 'Total Google Ads',    label: 'Total Google Ads',    color: GOOGLE_COLOR },
        { seriesName: 'Total Meta Ads',       label: 'Total Meta Ads',       color: META_COLOR   },
        { seriesName: 'Total TV / Radio Ads', label: 'Total TV / Radio Ads', color: RADIO_COLOR  }
    ];

    const buttons = totals.map(t => {
        campaignVisibility[t.seriesName] = true; // init as visible
        return `
            <button
                class="toggle-btn toggle-btn--active"
                data-series="${escapeAttr(t.seriesName)}"
                onclick="toggleCampaignSeries('${escapeAttr(t.seriesName)}', this)"
                title="${escapeAttr(t.label)}"
            >
                <span class="toggle-btn__dot" style="background:${t.color}"></span>
                ${t.label}
            </button>
        `;
    }).join('');

    return `
        <div class="toggle-group toggle-group--totals">
            <div class="toggle-group__header">
                <span class="toggle-group__title">Overview Totals</span>
            </div>
            <div class="toggle-group__buttons">
                ${buttons}
            </div>
        </div>
    `;
}

function renderToggleGroup(title, campaigns, platform) {
    if (campaigns.length === 0) return '';

    const dotColor = platform === 'google' ? GOOGLE_COLOR : META_COLOR;

    const buttons = campaigns.map(c => {
        campaignVisibility[c.seriesName] = false; // init all as hidden
        const label = c.isHistorical
            ? '⏱ Inactive Campaigns'
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