/**
 * Dashboard Charts - Overview Chart
 * Displays 24 months of data in monthly view
 * 3 series: Total Google Ads Spend, Total Meta Ads Spend, Total TV/Radio Ads
 * Initial view shows last 12 months, pan left to view prior 12 months
 */

// Global chart reference
let welcomeChart = null;
let chartInitialized = false;

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
    const container = document.querySelector("#welcomeUnifiedChart");
    if (!container) {
        console.error('❌ Chart container not found!');
        return;
    }
    chartInitialized = true;
    console.log('🚀 Initializing chart...');
    setTimeout(() => {
        fetchWelcomeChartData();
    }, 500);
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

    const response = await fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.success && result.data) {
        console.log('✅ Google Ads Overview:', result.data);
        return result.data;
    }

    console.warn('⚠️ Google Ads Overview fetch failed:', result);
    return { campaigns: [] };
}

async function fetchMetaAdsOverview() {
    const formData = new FormData();
    formData.append('action', 'fetch_facebook_ads_summary');
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.success && result.data) {
        console.log('✅ Meta Ads Overview:', result.data);
        return result.data;
    }

    console.warn('⚠️ Meta Ads Overview fetch failed:', result);
    return { campaigns: [] };
}

async function fetchAllTVRadioData() {
    const [wtla, wkrl, wktw, wzun] = await Promise.all([
        fetch(dashboardConfig.ajaxUrl, {
            method: 'POST',
            body: (() => {
                const fd = new FormData();
                fd.append('action', 'fetch_wtla_ads');
                fd.append('nonce', dashboardConfig.nonce);
                return fd;
            })()
        }).then(r => r.json()),

        fetch(dashboardConfig.ajaxUrl, {
            method: 'POST',
            body: (() => {
                const fd = new FormData();
                fd.append('action', 'fetch_tvradio_ads');
                fd.append('nonce', dashboardConfig.nonce);
                return fd;
            })()
        }).then(r => r.json()),

        fetch(dashboardConfig.ajaxUrl, {
            method: 'POST',
            body: (() => {
                const fd = new FormData();
                fd.append('action', 'fetch_wktw_ads');
                fd.append('nonce', dashboardConfig.nonce);
                return fd;
            })()
        }).then(r => r.json()),

        fetch(dashboardConfig.ajaxUrl, {
            method: 'POST',
            body: (() => {
                const fd = new FormData();
                fd.append('action', 'fetch_wzun_ads');
                fd.append('nonce', dashboardConfig.nonce);
                return fd;
            })()
        }).then(r => r.json())
    ]);

    return {
        wtla: wtla.success ? wtla.data : null,
        wkrl: wkrl.success ? wkrl.data : null,
        wktw: wktw.success ? wktw.data : null,
        wzun: wzun.success ? wzun.data : null
    };
}

// ============================================================
// DATA PROCESSING
// ============================================================

/**
 * Generate 24 monthly labels going back from current month
 * Returns array like ["Apr 2023", "May 2023", ..., "Mar 2026"]
 */
function generateMonthlyLabels(count = 24) {
    const labels = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
    }

    return labels;
}

/**
 * Get month label string from a YYYY-MM-DD date string
 */
function getMonthLabel(dateStr) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month] = dateStr.split('-').map(Number);
    return `${months[month - 1]} ${year}`;
}

/**
 * Parse MM/DD/YY date string (used by radio station data)
 */
function parseRadioDate(dateStr) {
    if (!dateStr || dateStr === 'N/A' || dateStr === '-') return null;
    try {
        const [month, day, year] = dateStr.split('/');
        const yearNum = parseInt(year);
        const fullYear = yearNum < 100
            ? (yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum)
            : yearNum;
        return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    } catch (e) {
        return null;
    }
}

/**
 * Main data processing function
 * Aggregates all sources into 3 monthly series
 */
function processWelcomeData(googleData, metaData, tvRadioData) {
    console.log('📊 Processing welcome chart data...');

    const labels = generateMonthlyLabels(24);
    console.log('📅 Monthly labels:', labels);

    // Initialize totals arrays
    const googleTotals = new Array(labels.length).fill(0);
    const metaTotals = new Array(labels.length).fill(0);
    const radioTotals = new Array(labels.length).fill(0);

    // ---- GOOGLE ADS ----
    // Meta response has campaigns with weeklyBreakdown
    // For Google the response comes from fetch_google_ads_summary
    // which proxies google-ads-campaigns — campaigns have weeklyBreakdown
    let googleCampaigns = [];
        if (googleData.chartData && googleData.chartData.campaigns) {
            googleCampaigns = googleData.chartData.campaigns;
        } else if (googleData.campaigns) {
            googleCampaigns = googleData.campaigns;
        }
    console.log(`🔵 Processing ${googleCampaigns.length} Google campaigns`);

    googleCampaigns.forEach(campaign => {
        if (!campaign.weeklyBreakdown || campaign.weeklyBreakdown.length === 0) {
            console.warn(`  ⚠️ ${campaign.name}: no weeklyBreakdown`);
            return;
        }
        campaign.weeklyBreakdown.forEach(week => {
            const monthLabel = getMonthLabel(week.week);
            const idx = labels.indexOf(monthLabel);
            if (idx !== -1) {
                googleTotals[idx] += week.spend || 0;
            }
        });
    });

    // ---- META ADS ----
    // fetch_facebook_ads_summary returns { campaigns, chartData }
    // chartData.campaigns have weeklyBreakdown with historical data
    // campaigns (top level) are the active card campaigns — use chartData for chart
    let metaCampaigns = [];
    if (metaData.chartData && metaData.chartData.campaigns) {
        metaCampaigns = metaData.chartData.campaigns;
        console.log(`🔵 Processing ${metaCampaigns.length} Meta campaigns from chartData`);
    } else if (metaData.campaigns) {
        metaCampaigns = metaData.campaigns;
        console.log(`🔵 Processing ${metaCampaigns.length} Meta campaigns (fallback)`);
    }

    metaCampaigns.forEach(campaign => {
        if (!campaign.weeklyBreakdown || campaign.weeklyBreakdown.length === 0) {
            console.warn(`  ⚠️ Meta ${campaign.name}: no weeklyBreakdown`);
            return;
        }
        campaign.weeklyBreakdown.forEach(week => {
            const monthLabel = getMonthLabel(week.week);
            const idx = labels.indexOf(monthLabel);
            if (idx !== -1) {
                metaTotals[idx] += week.spend || 0;
            }
        });
    });

    // ---- TV/RADIO ----
    // Process all 4 stations and aggregate ad counts by month
    const stations = ['wtla', 'wkrl', 'wktw', 'wzun'];
    stations.forEach(stationKey => {
        const stationData = tvRadioData[stationKey];
        if (!stationData || !stationData.orders) return;

        console.log(`📻 Processing ${stationKey}`);
        stationData.orders.forEach(order => {
            if (!order.dailyBreakdown) return;
            order.dailyBreakdown.forEach(day => {
                const date = parseRadioDate(day.date);
                if (!date) return;

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
                const idx = labels.indexOf(monthLabel);
                if (idx !== -1) {
                    radioTotals[idx] += day.adCount || 0;
                }
            });
        });
    });

    // Round spend values to 2 decimal places
    const googleRounded = googleTotals.map(v => parseFloat(v.toFixed(2)));
    const metaRounded = metaTotals.map(v => parseFloat(v.toFixed(2)));

    console.log('✅ Google monthly totals:', googleRounded);
    console.log('✅ Meta monthly totals:', metaRounded);
    console.log('✅ Radio monthly totals:', radioTotals);

    return {
        labels,
        series: [
            {
                name: 'Total Google Ads',
                type: 'bar',
                data: googleRounded
            },
            {
                name: 'Total Meta Ads',
                type: 'bar',
                data: metaRounded
            },
            {
                name: 'Total TV / Radio Ads',
                type: 'line',
                data: radioTotals
            }
        ]
    };
}

// ============================================================
// CHART CREATION
// ============================================================

function createWelcomeChart(chartData) {
    const allLabels = chartData.labels;
    const totalMonths = allLabels.length; // 24

    // Set initial view to last 12 months
    const initialMin = allLabels[totalMonths - 12];
    const initialMax = allLabels[totalMonths - 1];

    const options = {
        series: chartData.series,
        chart: {
            height: 480,
            type: 'line',
            stacked: false,
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            zoom: {
                enabled: true,
                type: 'x',
                autoScaleYaxis: true
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 600
            },
            events: {
                mounted: function(chart) {
                    // Set initial zoom to last 12 months
                    chart.zoomX(
                        allLabels.indexOf(initialMin),
                        allLabels.indexOf(initialMax)
                    );
                }
            }
        },
        colors: ['#34a853', '#1877f2', '#ff6b6b'],
        stroke: {
            width: [0, 0, 3],
            curve: 'smooth'
        },
        plotOptions: {
            bar: {
                columnWidth: '60%',
                borderRadius: 3
            }
        },
        fill: {
            opacity: [0.85, 0.85, 1]
        },
        markers: {
            size: [0, 0, 4],
            strokeWidth: 2,
            hover: { size: 6 }
        },
        xaxis: {
            categories: allLabels,
            type: 'category',
            title: {
                text: 'Month',
                style: { fontSize: '13px', fontWeight: 600 }
            },
            tickPlacement: 'on',
            labels: {
                rotate: -45,
                rotateAlways: false,
                style: { fontSize: '11px' }
            }
        },
        yaxis: [
            {
                seriesName: 'Total Google Ads',
                title: {
                    text: 'Ad Spend ($)',
                    style: { fontSize: '13px', fontWeight: 600, color: '#4285f4' }
                },
                labels: {
                    formatter: val => '$' + Math.round(val).toLocaleString()
                }
            },
            {
                seriesName: 'Total Meta Ads',
                show: false // Same axis as Google
            },
            {
                seriesName: 'Total TV / Radio Ads',
                opposite: true,
                title: {
                    text: 'TV / Radio Ads Played',
                    style: { fontSize: '13px', fontWeight: 600, color: '#ff6b6b' }
                },
                labels: {
                    formatter: val => Math.round(val) + ' ads'
                }
            }
        ],
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function(val, opts) {
                    const name = opts.w.config.series[opts.seriesIndex].name;
                    if (name === 'Total TV / Radio Ads') {
                        return Math.round(val) + ' ads played';
                    }
                    return '$' + val.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            fontSize: '13px',
            markers: { width: 12, height: 12, radius: 2 }
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

    welcomeChart = new ApexCharts(document.querySelector("#welcomeUnifiedChart"), options);
    welcomeChart.render();

    return welcomeChart;
}

// ============================================================
// LOADING / ERROR STATES
// ============================================================

function showChartLoading() {
    const container = document.querySelector("#welcomeUnifiedChart");
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
    const container = document.querySelector("#welcomeUnifiedChart");
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