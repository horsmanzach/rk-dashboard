/**
 * Dashboard Charts - Overview Chart
 * Displays 104 weeks (~2 years) of data in weekly view
 * Series:
 *   - Total Google Ads Spend (bright green line, thick solid, markers)
 *   - Total Meta Ads Spend (bright blue line, thick solid, markers)
 *   - Individual Google campaigns (muted green lines, thin dashed) — hidden by default
 *   - Individual Meta campaigns (muted blue lines, thin dashed) — hidden by default
 *   - Historical Google aggregate (muted green line, thin dashed) — hidden by default
 *   - Historical Meta aggregate (muted blue line, thin dashed) — hidden by default
 *   - Total TV / Radio Ads (red line, thick solid, markers) — unchanged
 *   - New Patient Leads (orange bar) — third Y-axis
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
const PATIENT_COLOR       = '#c9a84c'; // Soft warm amber - muted gold

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

// ============================================================
// CACHE STATUS — "Last updated X hours ago" label
// ============================================================

function fetchAndRenderCacheStatus() {
    const formData = new FormData();
    formData.append('action', 'rk_get_cache_status');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(result => {
            if (!result.success) return;

            // Find the most recent cached_at timestamp across all sources
            const timestamps = Object.values(result.data)
                .map(s => s.cached_at)
                .filter(Boolean);

            if (timestamps.length === 0) return;

            // Parse timestamps (format: "2026-07-14 02:03:41")
            const dates = timestamps.map(t => new Date(t.replace(' ', 'T')));
            const mostRecent = new Date(Math.max(...dates));

            // Build relative label
            const now = new Date();
            const diffMs = now - mostRecent;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);

            let label;
            if (diffMins < 2) {
                label = 'Data refreshed just now';
            } else if (diffMins < 60) {
                label = `Data refreshed ${diffMins} minutes ago`;
            } else if (diffHours < 24) {
                label = `Data refreshed ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                label = `Data refreshed ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
            }

            // Insert label below chart container if it doesn't exist yet
            let el = document.getElementById('cacheStatusLabel');
            if (!el) {
                el = document.createElement('div');
                el.id = 'cacheStatusLabel';
                el.style.cssText = 'text-align:center; font-size:11px; color:#aaa; margin-top:4px; letter-spacing:0.02em;';
                const chartContainer = document.querySelector('#welcomeUnifiedChart');
                if (chartContainer && chartContainer.parentNode) {
                    chartContainer.parentNode.insertBefore(el, chartContainer.nextSibling);
                }
            }
            el.textContent = label;
        })
        .catch(() => {
            // Silently fail — label just won't appear
        });
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

        const [googleData, metaData, tvRadioData, patientData] = await Promise.all([
            fetchGoogleAdsOverview(),
            fetchMetaAdsOverview(),
            fetchAllTVRadioData(),
            fetchNewPatientsData()
        ]);

        const chartData = processWelcomeData(googleData, metaData, tvRadioData, patientData);

        if (welcomeChart) {
            welcomeChart.updateOptions({
                series: chartData.series,
                xaxis: { categories: chartData.labels }
            });
        } else {
            createWelcomeChart(chartData);
			// Store hidden series for dynamic toggle
			chartData.hiddenSeries.forEach(s => {
    			hiddenSeriesStore[s.name] = s;
			});
			
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

    // 500ms stagger - frontend reads from Wordpress cache (not Google Sheets directly)
    // Kept as a light fallback buffer for cache miss scenarios
	
    const wtla = await fetchStation('fetch_wtla_ads');
    await sleep(500);
    const wkrl = await fetchStation('fetch_tvradio_ads');
    await sleep(500);
    const wktw = await fetchStation('fetch_wktw_ads');
    await sleep(500);
    const wzun = await fetchStation('fetch_wzun_ads');

    return {
        wtla: wtla.success ? wtla.data : null,
        wkrl: wkrl.success ? wkrl.data : null,
        wktw: wktw.success ? wktw.data : null,
        wzun: wzun.success ? wzun.data : null,
    };
}

async function fetchNewPatientsData() {
    const formData = new FormData();
    formData.append('action', 'fetch_new_patients');
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, { method: 'POST', body: formData });
    const result   = await response.json();

    if (result.success && result.data) {
        console.log('✅ New Patient Leads received:', result.data.patients?.length, 'rows');
        return result.data;
    }

    console.warn('⚠️ New Patient Leads fetch failed:', result);
    return { patients: [] };
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

/**
 * Parse a patient leads date string in M/D/YY or M/D/YYYY format.
 * Returns a YYYY-MM-DD string or null on failure.
 * Skips malformed entries (date ranges, missing year, etc.)
 */
function parsePatientDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Skip known non-date values
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed.toLowerCase() === 'gap') return null;

    // Must contain exactly two slashes — skips ranges like "12/23-1/3"
    const slashCount = (trimmed.match(/\//g) || []).length;
    if (slashCount !== 2) return null;

    const parts = trimmed.split('/');
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0]);
    const day   = parseInt(parts[1]);
    let   year  = parseInt(parts[2]);

    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // Expand 2-digit years
    if (year < 100) year = year >= 50 ? 1900 + year : 2000 + year;

    // Sanity check: reject years outside plausible range (2020–2030)
    if (year < 2020 || year > 2030) return null;

    const yyyy = String(year);
    const mm   = String(month).padStart(2, '0');
    const dd   = String(day).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}

// ============================================================
// DATA PROCESSING — AGGREGATION HELPERS
// ============================================================

/**
 * Aggregate a campaign's weeklyBreakdown into per-week totals,
 * returning a rounded array aligned to the provided labels array.
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
 * Builds all series for the overview chart.
 */
function processWelcomeData(googleData, metaData, tvRadioData, patientData) {
    console.log('📊 Processing welcome chart data...');

    const labels = generateWeeklyLabels(104);
    console.log('First 3 weekly labels:', labels.slice(0, 3));
    console.log('Last 3 weekly labels:', labels.slice(-3));

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
            type: 'line',
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
    const metaChartCampaigns = (metaData.chartData && metaData.chartData.campaigns)
        ? metaData.chartData.campaigns
        : [];
    const metaActiveIds = new Set(metaCardCampaigns.map(c => c.id));

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
            type: 'line',
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
    // NEW PATIENT LEADS
    // Each row from the sheet has a date (weekly or daily) and a count.
    // All dates are snapped to their Monday via weekDateToLabel() and
    // summed into the matching weekly bucket.
    // Malformed dates (ranges, missing year, typos) are skipped silently.
    // ----------------------------------------------------------------
    const patientTotals = new Array(labels.length).fill(0);
    const patientRows   = (patientData && patientData.patients) ? patientData.patients : [];
    let   patientSkipped = 0;

    patientRows.forEach(row => {
        // row.date is already YYYY-MM-DD from the n8n Code node
        const weekLabel = weekDateToLabel(row.date);
        if (!weekLabel) {
            patientSkipped++;
            return;
        }
        const idx = labels.indexOf(weekLabel);
        if (idx !== -1) patientTotals[idx] += row.newPatients || 0;
    });

    console.log(`🟠 Patient leads: ${patientRows.length} rows processed, ${patientSkipped} skipped, ${patientTotals.filter(v => v > 0).length} weeks with data`);

    // ----------------------------------------------------------------
    // ROUND & LOG
    // ----------------------------------------------------------------
    const googleRounded = googleTotals.map(v => parseFloat(v.toFixed(2)));
    const metaRounded   = metaTotals.map(v => parseFloat(v.toFixed(2)));

    console.log('✅ Google weekly totals (non-zero weeks):', googleRounded.filter(v => v > 0).length, 'weeks with spend');
    console.log('✅ Google sample (last 5 weeks):', googleRounded.slice(-5));
    console.log('✅ Meta weekly totals (non-zero):', metaRounded.filter(v => v > 0).length, 'weeks with spend');
    console.log('✅ Radio weekly totals (non-zero):', radioTotals.filter(v => v > 0).length, 'weeks with ads');
    console.log('✅ Campaign series meta:', campaignSeriesMeta);

    // ----------------------------------------------------------------
    // BUILD SERIES ARRAY
    // Order: totals first, then campaign detail (hidden), then radio, then patients
    // ----------------------------------------------------------------
    // Visible series — rendered immediately on chart init
    const visibleSeries = [
        {
            name: 'Total Google Ads',
            type: 'line',
            data: googleRounded,
            color: GOOGLE_COLOR
        },
        {
            name: 'Total Meta Ads',
            type: 'line',
            data: metaRounded,
            color: META_COLOR
        },
        {
            name: 'Total TV / Radio Ads',
            type: 'line',
            data: radioTotals,
            color: RADIO_COLOR
        },
        {
            name: 'New Patient Leads',
            type: 'bar',
            data: patientTotals,
            color: PATIENT_COLOR
        }
    ];

    // Hidden series — stored separately, added to chart only when toggled on
    const hiddenSeries = [
        ...googleCampaignSeries,
        ...(hasGoogleHistorical ? [{
            name: 'G: Inactive Campaigns',
            type: 'line',
            data: googleHistoricalRounded,
            color: GOOGLE_MUTED
        }] : []),
        ...metaCampaignSeries,
        ...(hasMetaHistorical ? [{
            name: 'M: Inactive Campaigns',
            type: 'line',
            data: metaHistoricalRounded,
            color: META_MUTED
        }] : []),
    ];

    return { labels, series: visibleSeries, hiddenSeries };
}

// ============================================================
// CHART CREATION
// ============================================================

function createWelcomeChart(chartData) {
    const allLabels  = chartData.labels;
    const totalWeeks = allLabels.length; // 104
    const initialMin = allLabels[totalWeeks - 52]; // show last 52 weeks by default
    const initialMax = allLabels[totalWeeks - 1];

    // Per-series stroke widths:
    //   Total ad spend lines + TV/Radio = 3 (thick)
    //   Individual/inactive campaign lines = 1.5 (thin)
    //   New Patient Leads bar = 0 (bars have no stroke)
    const TOTAL_SERIES = ['Total Google Ads', 'Total Meta Ads', 'Total TV / Radio Ads'];
    const strokeWidths = chartData.series.map(s => {
        if (s.type === 'bar') return 0;
        if (TOTAL_SERIES.includes(s.name)) return 3;
        return 1.5;
    });

    // dashArray: 0 = solid (totals + TV/Radio), 5 = dashed (individual/inactive campaigns)
    const dashArray = chartData.series.map(s => {
        if (s.type === 'bar') return 0;
        if (TOTAL_SERIES.includes(s.name)) return 0;
        return 5;
    });

    // markers: totals + TV/Radio get size 4, campaigns get 0, bars get 0
    const markerSizes = chartData.series.map(s => {
        if (s.type === 'bar') return 0;
        if (TOTAL_SERIES.includes(s.name)) return 4;
        return 0;
    });

    const fillOpacity = chartData.series.map(s => {
        if (s.type === 'bar') return 0.65;
        return 1;
    });

    const yaxis = chartData.series.map(s => {
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
        if (s.name === 'New Patient Leads') {
            return {
                seriesName: 'New Patient Leads',
                opposite: true,
                title: {
                    text: 'New Patient Leads',
                    style: { fontSize: '16px', fontWeight: 600, color: PATIENT_COLOR }
                },
                labels: { formatter: val => Math.round(val) + ' leads' }
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

    			// No hideSeries() calls — campaign series are excluded from
    			// initial render entirely. They are added dynamically on toggle.
    			console.log('🔍 Zooming to:', initialMin, '->', initialMax);

    		// Set initial zoom to last 52 weeks
    	chartCtx.zoomX(
        allLabels.indexOf(initialMin),
        allLabels.indexOf(initialMax)
    );

    chartNavInit(totalWeeks, initialMin, initialMax, allLabels);
    renderChartNavPanel();
    renderCampaignTogglePanel();
	fetchAndRenderCacheStatus(); 
				} // closes mounted function
			} //closes events
        }, //closes chart, comma continues options object
		
        colors: chartData.series.map(s => s.color),
        dataLabels: { enabled: false },
        stroke: {
            width: strokeWidths,
            curve: 'smooth',
            dashArray: dashArray,
            lineCap: 'round'
        },
        plotOptions: {
            bar: {
                columnWidth: '60%',
                borderRadius: 2
            }
        },
        fill: { opacity: fillOpacity },
        markers: {
            size: markerSizes,
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
    x: {
        formatter: function(val, opts) {
            const idx = opts.dataPointIndex;
            const label = allLabels[idx];
            if (!label) return val;
            const parts = label.split(' ');
            return parts.length === 3
                ? `Week of ${parts[0]} ${parts[1]}, ${parts[2]}`
                : label;
        }
    },
    y: {
        formatter: function(val, opts) {
            if (val === undefined || val === null) return undefined;
            const name = opts.w.config.series[opts.seriesIndex].name;
            if (name === 'Total TV / Radio Ads') return Math.round(val) + ' ads played';
            if (name === 'New Patient Leads') return Math.round(val) + ' leads';
            return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }
},
        legend: { show: false },
        title: {
            text: 'Paid Ad Campaign Performance Overview',
            align: 'center',
            style: { fontSize: '20px', fontWeight: 600 }
        },
        subtitle: {
    	text: (() => {
        	const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        	const yesterday = new Date();
        	yesterday.setDate(yesterday.getDate() - 1);
        	const weekStart = new Date(yesterday);
        	weekStart.setDate(yesterday.getDate() - 364); // 52 weeks back
        	const fmt = d => `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        	return `Showing ${fmt(weekStart)} – ${fmt(yesterday)} — pan left to view prior history`;
    	})(),
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
// Stores hidden series data for dynamic addition to chart
let hiddenSeriesStore = {};

function buildFillOpacity(seriesArray) {
    return seriesArray.map(s => s.type === 'bar' ? 0.65 : 1);
}

function toggleCampaignSeries(seriesName, btn) {
    const isVisible = campaignVisibility[seriesName] || false;
    const OVERVIEW_TOTALS = ['Total Google Ads', 'Total Meta Ads', 'Total TV / Radio Ads', 'New Patient Leads'];

    function buildYaxis(seriesArray) {
        return seriesArray.map(s => {
            if (s.name === 'Total Google Ads') {
                return {
                    seriesName: 'Total Google Ads',
                    title: { text: 'Ad Spend ($)', style: { fontSize: '16px', fontWeight: 600, color: '#4285f4' } },
                    labels: { formatter: val => '$' + Math.round(val).toLocaleString() }
                };
            }
            if (s.name === 'Total TV / Radio Ads') {
                return {
                    seriesName: 'Total TV / Radio Ads',
                    opposite: true,
                    title: { text: 'TV / Radio Ads Played', style: { fontSize: '16px', fontWeight: 600, color: '#ff6b6b' } },
                    labels: { formatter: val => Math.round(val) + ' ads' }
                };
            }
            if (s.name === 'New Patient Leads') {
                return {
                    seriesName: 'New Patient Leads',
                    opposite: true,
                    title: { text: 'New Patient Leads', style: { fontSize: '16px', fontWeight: 600, color: '#c9a84c' } },
                    labels: { formatter: val => Math.round(val) + ' leads' }
                };
            }
            return { seriesName: 'Total Google Ads', show: false };
        });
    }

    if (OVERVIEW_TOTALS.includes(seriesName)) {
    welcomeChart.toggleSeries(seriesName);
    campaignVisibility[seriesName] = !isVisible;
    if (isVisible) {
        btn.classList.remove('toggle-btn--active');
        btn.classList.add('toggle-btn--inactive');
    } else {
        btn.classList.remove('toggle-btn--inactive');
        btn.classList.add('toggle-btn--active');
    }

    // Rebuild yaxis so the left spend axis stays visible as long as
    // either Google or Meta is on, anchored to whichever is still visible.
    const googleOn = campaignVisibility['Total Google Ads'];
    const metaOn   = campaignVisibility['Total Meta Ads'];
    const spendAnchor = googleOn ? 'Total Google Ads' : metaOn ? 'Total Meta Ads' : null;

    const currentSeries = welcomeChart.w.config.series;
    const updatedYaxis = currentSeries.map(s => {
        if (s.name === 'Total Google Ads' || s.name === 'Total Meta Ads') {
            if (s.name === spendAnchor) {
                return {
                    seriesName: spendAnchor,
                    title: {
                        text: 'Ad Spend ($)',
                        style: { fontSize: '16px', fontWeight: 600, color: '#4285f4' }
                    },
                    labels: { formatter: val => '$' + Math.round(val).toLocaleString() }
                };
            }
            // Non-anchor spend series shares the visible axis
            return { seriesName: spendAnchor || 'Total Google Ads', show: false };
        }
        if (s.name === 'Total TV / Radio Ads') {
            return {
                seriesName: 'Total TV / Radio Ads',
                opposite: true,
                title: { text: 'TV / Radio Ads Played', style: { fontSize: '16px', fontWeight: 600, color: '#ff6b6b' } },
                labels: { formatter: val => Math.round(val) + ' ads' }
            };
        }
        if (s.name === 'New Patient Leads') {
            return {
                seriesName: 'New Patient Leads',
                opposite: true,
                title: { text: 'New Patient Leads', style: { fontSize: '16px', fontWeight: 600, color: '#c9a84c' } },
                labels: { formatter: val => Math.round(val) + ' leads' }
            };
        }
        return { seriesName: spendAnchor || 'Total Google Ads', show: false };
    });

    welcomeChart.updateOptions({ yaxis: updatedYaxis }, false, false);

    requestAnimationFrame(() => {
        welcomeChart.zoomX(chartNav.min, chartNav.max);
    });
    return;
}

    // Campaign series (not in initial render) — must use updateOptions to add/remove
    if (isVisible) {
        const currentSeries = welcomeChart.w.config.series;
        const updated = currentSeries.filter(s => s.name !== seriesName);
        const removed = currentSeries.find(s => s.name === seriesName);
        if (removed) hiddenSeriesStore[seriesName] = removed;
        welcomeChart.updateOptions({
            series: updated,
            yaxis: buildYaxis(updated),
            fill: { opacity: buildFillOpacity(updated) }
        }, false, false);
        campaignVisibility[seriesName] = false;
        btn.classList.remove('toggle-btn--active');
        btn.classList.add('toggle-btn--inactive');
    } else {
        const seriesData = hiddenSeriesStore[seriesName];
        if (seriesData) {
            const currentSeries = welcomeChart.w.config.series;
            const newSeries = [...currentSeries, seriesData];
            welcomeChart.updateOptions({
                series: newSeries,
                yaxis: buildYaxis(newSeries),
                fill: { opacity: buildFillOpacity(newSeries) }
            }, false, false);
        }
        campaignVisibility[seriesName] = true;
        btn.classList.remove('toggle-btn--inactive');
        btn.classList.add('toggle-btn--active');
    }

    requestAnimationFrame(() => {
        welcomeChart.zoomX(chartNav.min, chartNav.max);
    });

    const meta = campaignSeriesMeta.find(c => c.seriesName === seriesName);
    if (meta) updateClearAllButton(meta.platform);
}

function updateClearAllButton(platform) {
    const btn = document.getElementById(`clearAll-${platform}`);
    if (!btn) return;

    // Find all series names belonging to this platform
    const platformSeries = campaignSeriesMeta
        .filter(c => c.platform === platform)
        .map(c => c.seriesName);

    const anyActive = platformSeries.some(sn => campaignVisibility[sn] === true);
    btn.style.display = anyActive ? 'inline-flex' : 'none';
}

function clearAllCampaigns(platform) {
    const platformSeries = campaignSeriesMeta
        .filter(c => c.platform === platform)
        .map(c => c.seriesName);

    platformSeries.forEach(sn => {
        if (campaignVisibility[sn] === true) {
            // Find the button for this series and simulate a toggle-off
            const btn = document.querySelector(`[data-series="${CSS.escape(sn)}"]`);
            if (btn) toggleCampaignSeries(sn, btn);
        }
    });
    // Button will auto-hide via the updateClearAllButton calls inside toggleCampaignSeries
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
        { seriesName: 'Total Google Ads',    label: 'Total Google Ads',    color: GOOGLE_COLOR  },
        { seriesName: 'Total Meta Ads',       label: 'Total Meta Ads',       color: META_COLOR    },
        { seriesName: 'Total TV / Radio Ads', label: 'Total TV / Radio Ads', color: RADIO_COLOR   },
        { seriesName: 'New Patient Leads',    label: 'New Patient Leads',    color: PATIENT_COLOR }
    ];

   const buttons = totals.map(t => {
    campaignVisibility[t.seriesName] = true;
    const extraClass = t.seriesName === 'New Patient Leads' ? ' toggle-btn--patients' : '';
    return `
        <button
            class="toggle-btn toggle-btn--active${extraClass}"
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
    <div class="toggle-group" data-platform="${platform}">
        <div class="toggle-group__header">
            <span class="toggle-group__dot" style="background:${dotColor}"></span>
            <span class="toggle-group__title">${title}</span>
            <button
                class="toggle-clear-btn"
                id="clearAll-${platform}"
                style="display:none;"
                onclick="clearAllCampaigns('${platform}')"
            >Clear All</button>
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