/**
 * Aggregate data by time period (weekly or monthly)
 */
function aggregateDataByPeriod(data, period = 'weekly') {
    // This will aggregate your data into weekly or monthly buckets
    // Returns arrays of values aligned to same time periods

    const timeLabels = generateTimeLabels(period);
    const aggregated = {};

    // Initialize buckets
    timeLabels.forEach(label => {
        aggregated[label] = {
            googleSpend: 0,
            metaSpend: 0,
            syracuseAds: 0,
            albanyAds: 0,
            montrealAds: 0
        };
    });

    return { timeLabels, aggregated };
}

/**
 * Generate time labels based on period
 */
function generateTimeLabels(period = 'weekly', count = 12) {
    const labels = [];
    const now = new Date();

    if (period === 'weekly') {
        for (let i = count - 1; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (i * 7));

            // Format as "Dec 15" instead of "Week 50"
            const month = weekStart.toLocaleDateString('en-US', { month: 'short' });
            const day = weekStart.getDate();

            labels.push(`${month} ${day}`);
        }
    } else if (period === 'monthly') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = count - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(now.getMonth() - i);
            labels.push(months[date.getMonth()] + ' ' + date.getFullYear());
        }
    }

    return labels;
}

/**
 * Get week number from date
 */
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Fetch and aggregate all data for welcome chart
 */
async function fetchWelcomeChartData() {
    try {
        // Show loading state
        showChartLoading();

        // Fetch all data sources in parallel
        const [googleData, metaData, tvRadioData] = await Promise.all([
            fetchGoogleAdsOverview(),
            fetchMetaAdsOverview(),
            fetchAllTVRadioData()
        ]);

        // Process and aggregate the data
        const chartData = processWelcomeData(googleData, metaData, tvRadioData);

        // Update or create the chart
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
        console.error('Error fetching welcome chart data:', error);
        showChartError();
    }
}

/**
 * Fetch Google Ads overview data
 */
async function fetchGoogleAdsOverview() {
    const formData = new FormData();
    formData.append('action', 'fetch_google_ads_summary');
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.success) {
        return result.data;
    }

    throw new Error('Failed to fetch Google Ads data');
}

/**
 * Fetch Meta Ads overview data
 */
async function fetchMetaAdsOverview() {
    const formData = new FormData();
    formData.append('action', 'fetch_facebook_ads_summary');
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.success) {
        return result.data;
    }

    throw new Error('Failed to fetch Meta Ads data');
}

/**
 * Fetch all TV/Radio data from stations
 */
async function fetchAllTVRadioData() {
    // Fetch all station data
    const formData = new FormData();
    formData.append('nonce', dashboardConfig.nonce);

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
        syracuse: {
            wtla: wtla.success ? wtla.data : null,
            wkrl: wkrl.success ? wkrl.data : null,
            wktw: wktw.success ? wktw.data : null,
            wzun: wzun.success ? wzun.data : null
        },
        albany: null, // Add when you have Albany data
        montreal: null // Add when you have Montreal data
    };
}

/**
 * Process all data into chart-ready format
 */
function processWelcomeData(googleData, metaData, tvRadioData) {
    // Generate weekly labels for last 8 weeks
    const labels = generateTimeLabels('weekly', 12);

    // Initialize data arrays
    const googleSpend = new Array(8).fill(0);
    const metaSpend = new Array(8).fill(0);
    const syracuseAds = new Array(8).fill(0);
    const albanyAds = new Array(8).fill(0);
    const montrealAds = new Array(8).fill(0);

    // Process Google Ads data
    // TODO: Aggregate Google campaign data by week
    // For now, use mock data or aggregate from your campaigns array

    // Process Meta Ads data
    // TODO: Aggregate Meta campaign data by week

    // Process TV/Radio data
    if (tvRadioData.syracuse) {
        const syracuseTotal = aggregateStationDataByWeek(tvRadioData.syracuse, labels);
        syracuseAds.splice(0, syracuseTotal.length, ...syracuseTotal);
    }

    return {
        labels,
        series: [
            {
                name: 'Google Ads Spend',
                type: 'column',
                data: googleSpend
            },
            {
                name: 'Meta Ads Spend',
                type: 'column',
                data: metaSpend
            },
            {
                name: 'Syracuse/Rochester Ads',
                type: 'line',
                data: syracuseAds
            }

        ]
    };

    // Only add Albany if we have data
    if (albanyAds.some(val => val > 0)) {
        series.push({
            name: 'Albany DMA Ads',
            type: 'line',
            data: albanyAds
        });
    }

    // Only add Montreal if we have data
    if (montrealAds.some(val => val > 0)) {
        series.push({
            name: 'Montreal/Plattsburgh Ads',
            type: 'line',
            data: montrealAds
        });
    }
}

/**
 * Aggregate station data by week
 */
function aggregateStationDataByWeek(stationData, weekLabels) {
    const weeklyData = new Array(weekLabels.length).fill(0);

    // Combine all stations (WTLA, WKRL, WKTW, WZUN)
    const allOrders = [];

    Object.keys(stationData).forEach(stationKey => {
        const station = stationData[stationKey];
        if (station && station.orders) {
            Object.values(station.orders).forEach(order => {
                if (order.dailyBreakdown) {
                    order.dailyBreakdown.forEach(day => {
                        allOrders.push({
                            date: parseDate(day.date),
                            adCount: day.adCount
                        });
                    });
                }
            });
        }
    });

    // Sort by date
    allOrders.sort((a, b) => a.date - b.date);

    // Aggregate by week
    const now = new Date();
    weekLabels.forEach((label, index) => {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - ((weekLabels.length - 1 - index) * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekTotal = allOrders
            .filter(order => order.date >= weekStart && order.date < weekEnd)
            .reduce((sum, order) => sum + order.adCount, 0);

        weeklyData[index] = weekTotal;
    });

    return weeklyData;
}

/**
 * Parse date string (MM/DD/YY format) to Date object
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return null;

    const [month, day, year] = dateStr.split('/');
    const fullYear = parseInt(year) < 100
        ? (parseInt(year) >= 50 ? 1900 + parseInt(year) : 2000 + parseInt(year))
        : parseInt(year);

    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
}

/**
 * Show loading state for chart
 */
function showChartLoading() {
    const container = document.querySelector("#welcomeUnifiedChart");
    if (container) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 450px; color: #999;">
                <div style="text-align: center;">
                    <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                    <p>Loading chart data...</p>
                </div>
            </div>
        `;
    }
}

/**
 * Hide loading state
 */
function hideChartLoading() {
    // Chart render will replace the loading content
}

/**
 * Show error state
 */
function showChartError() {
    const container = document.querySelector("#welcomeUnifiedChart");
    if (container) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 450px; color: #999;">
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <p>Error loading chart data</p>
                    <button onclick="fetchWelcomeChartData()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            </div>
        `;
    }
}

// Add spinner animation to your CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

/**
 * Update createWelcomeChart to accept data parameter
 */
function createWelcomeChart(chartData) {
    const options = {
        series: chartData.series,
        chart: {
            height: 450,
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
            events: {
                dataPointSelection: function (event, chartContext, config) {
                    const seriesName = config.w.config.series[config.seriesIndex].name;

                    if (seriesName.includes('Google')) {
                        navigateToSlide('google');
                    } else if (seriesName.includes('Meta')) {
                        navigateToSlide('facebook');
                    } else {
                        navigateToSlide('tvradio');
                    }
                }
            }
        },
        colors: ['#34a853', '#1877f2', '#ff6b6b', '#feca57', '#ee5a6f'],
        stroke: {
            width: [0, 0, 4, 4, 4],
            curve: 'smooth',
            dashArray: [0, 0, 0, 5, 5]
        },
        plotOptions: {
            bar: {
                columnWidth: '55%',
                borderRadius: 4
            }
        },
        fill: {
            opacity: [0.85, 0.85, 1, 1, 1],
            gradient: {
                inverseColors: false,
                shade: 'light',
                type: "vertical",
                opacityFrom: 0.85,
                opacityTo: 0.55,
                stops: [0, 100]
            }
        },
        labels: chartData.labels,
        markers: {
            size: [0, 0, 5, 5, 5],
            strokeWidth: 2,
            hover: {
                size: 7
            }
        },
        xaxis: {
            type: 'category',
            title: {
                text: 'Time Period',
                style: {
                    fontSize: '14px',
                    fontWeight: 600
                }
            }
        },
        yaxis: [
            {
                seriesName: 'Google Ads Spend',
                axisTicks: { show: true },
                axisBorder: {
                    show: true,
                    color: '#4285f4'
                },
                labels: {
                    style: { colors: '#4285f4' },
                    formatter: function (val) {
                        return '$' + val.toLocaleString();
                    }
                },
                title: {
                    text: 'Digital Ad Spend ($)',
                    style: {
                        color: '#4285f4',
                        fontSize: '14px',
                        fontWeight: 600
                    }
                }
            },
            {
                seriesName: 'Meta Ads Spend',
                show: false
            },
            {
                opposite: true,
                seriesName: 'Syracuse/Rochester Ads',
                axisTicks: { show: true },
                axisBorder: {
                    show: true,
                    color: '#ff6b6b'
                },
                labels: {
                    style: { colors: '#ff6b6b' },
                    formatter: function (val) {
                        return Math.round(val) + ' ads';
                    }
                },
                title: {
                    text: 'TV/Radio Ads Played',
                    style: {
                        color: '#ff6b6b',
                        fontSize: '14px',
                        fontWeight: 600
                    }
                }
            },
        ],
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (val, opts) {
                    if (opts.seriesIndex <= 1) {
                        return '$' + val.toLocaleString();
                    }
                    return Math.round(val) + ' ads played';
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            offsetY: 0,
            fontSize: '14px',
            markers: {
                width: 12,
                height: 12,
                radius: 2
            },
            onItemClick: {
                toggleDataSeries: true
            },
            onItemHover: {
                highlightDataSeries: true
            }
        },
        grid: {
            borderColor: '#e0e0e0',
            strokeDashArray: 3,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } }
        },
        title: {
            text: 'Marketing Performance Overview - All Channels',
            align: 'center',
            margin: 20,
            style: {
                fontSize: '20px',
                fontWeight: 600,
                color: '#333'
            }
        },
        subtitle: {
            text: 'Click any data point to view detailed analytics | Click legend items to show/hide channels',
            align: 'center',
            style: {
                fontSize: '12px',
                color: '#999'
            }
        }
    };

    welcomeChart = new ApexCharts(document.querySelector("#welcomeUnifiedChart"), options);
    welcomeChart.render();

    return welcomeChart;
}


// Global chart reference
let welcomeChart = null;

// Initialization code...
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChart);
} else {
    initChart();
}

window.addEventListener('load', initChart);

let chartInitialized = false;

function initChart() {
    if (chartInitialized) return;
    console.log('🚀 Initializing chart...');
    const container = document.querySelector("#welcomeUnifiedChart");
    if (!container) {
        console.error('❌ Chart container not found!');
        return;
    }
    chartInitialized = true;
    setTimeout(() => {
        console.log('⏰ Fetching chart data...');
        fetchWelcomeChartData();
    }, 500);
}
