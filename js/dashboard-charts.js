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

            // Get to Monday of that week (CRITICAL for Google Ads alignment)
            const dayOfWeek = weekStart.getDay();
            const daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
            weekStart.setDate(weekStart.getDate() - daysToMonday);

            // Format as "Dec 15" (Monday of that week)
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

/**
 * Fetch Google Ads overview data
 */
async function fetchGoogleAdsOverview() {
    const formData = new FormData();
    formData.append('action', 'fetch_google_ads_campaigns'); // Uses existing endpoint!
    formData.append('nonce', dashboardConfig.nonce);

    const response = await fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.success && result.data) {
        return result.data; // Returns campaigns with weeklyBreakdown
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
 * Process Google Ads data for chart
 */
function processGoogleAdsForChart(googleData, weekLabels) {
    if (!googleData.campaigns || googleData.campaigns.length === 0) {
        return [];
    }

    // Get top 5 campaigns by spend
    const topCampaigns = [...googleData.campaigns]
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

    // Create series for each campaign
    const campaignSeries = topCampaigns.map(campaign => {
        // Initialize data array with zeros
        const weeklyData = new Array(weekLabels.length).fill(0);

        // Fill in actual weekly spend
        if (campaign.weeklyBreakdown) {
            campaign.weeklyBreakdown.forEach(week => {
                // Convert week date to label format (e.g., "2025-01-13" → "Jan 13")
                const weekDate = new Date(week.week);
                const weekLabel = weekDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });

                // Find matching label index
                const labelIndex = weekLabels.findIndex(label => label === weekLabel);
                if (labelIndex !== -1) {
                    weeklyData[labelIndex] = week.spend;
                }
            });
        }

        return {
            name: campaign.name,
            type: 'column',
            data: weeklyData
        };
    });

    return campaignSeries;
}

/**
 * Process all data into chart-ready format
 */

function processWelcomeData(googleData, metaData, tvRadioData) {
    console.log('📊 Processing welcome chart data...');

    // Generate weekly labels for last 12 weeks
    const labels = generateTimeLabels('weekly', 12);
    console.log('📅 Time labels:', labels);

    // Initialize all series arrays
    let allSeries = [];

    // ========================================
    // PROCESS GOOGLE ADS DATA
    // ========================================
    if (googleData && googleData.campaigns && googleData.campaigns.length > 0) {
        console.log(`🔵 Processing ${googleData.campaigns.length} Google Ads campaigns`);

        // Get top 5 campaigns by spend
        const topGoogleCampaigns = [...googleData.campaigns]
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 5);

        console.log('🔵 Top 5 Google campaigns:', topGoogleCampaigns.map(c => c.name));

        // Create series for each Google campaign
        topGoogleCampaigns.forEach(campaign => {
            // Initialize weekly data array with zeros
            const weeklyData = new Array(labels.length).fill(0);

            // Fill in actual weekly spend from weeklyBreakdown
            if (campaign.weeklyBreakdown && campaign.weeklyBreakdown.length > 0) {
                campaign.weeklyBreakdown.forEach(weekPoint => {
                    // Convert week date (YYYY-MM-DD format) to label format (e.g., "Jan 13")
                    const [year, month, day] = weekPoint.week.split('-').map(Number);
                    const weekDate = new Date(year, month - 1, day);
                    const monthStr = weekDate.toLocaleDateString('en-US', { month: 'short' });
                    const dayNum = weekDate.getDate();
                    const weekLabel = `${monthStr} ${dayNum}`;

                    // Find matching label index
                    const labelIndex = labels.indexOf(weekLabel);

                    if (labelIndex !== -1) {
                        weeklyData[labelIndex] = weekPoint.spend;
                        console.log(`✅ Matched! $${weekPoint.spend} → index ${labelIndex}`);
                    }
                });

                console.log(`  ✓ ${campaign.name}: ${campaign.weeklyBreakdown.length} weeks of data`);
            } else {
                console.log(`  ⚠️ ${campaign.name}: No weekly breakdown available`);
            }

            allSeries.push({
                name: `Google: ${campaign.name}`,
                type: 'column',
                data: weeklyData,
                yAxisIndex: 0  // Use first Y-axis (Ad Spend $)
            });
        });
    } else {
        console.log('⚠️ No Google Ads data available');
    }

    // ========================================
    // PROCESS META ADS DATA
    // ========================================
    if (metaData && metaData.campaigns && metaData.campaigns.length > 0) {
        console.log(`🔵 Processing ${metaData.campaigns.length} Meta Ads campaigns`);

        // Get top 5 Meta campaigns by spend
        const topMetaCampaigns = [...metaData.campaigns]
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 5);

        console.log('🔵 Top 5 Meta campaigns:', topMetaCampaigns.map(c => c.name));

        // Create series for each Meta campaign
        topMetaCampaigns.forEach(campaign => {
            // Initialize weekly data array with zeros
            const weeklyData = new Array(labels.length).fill(0);

            // Fill in actual weekly spend from weeklyBreakdown
            if (campaign.weeklyBreakdown && campaign.weeklyBreakdown.length > 0) {
                campaign.weeklyBreakdown.forEach(weekPoint => {
                    // Convert week date to label format
                    const [year, month, day] = weekPoint.week.split('-').map(Number);
                    const weekDate = new Date(year, month - 1, day);
                    const monthStr = weekDate.toLocaleDateString('en-US', { month: 'short' });
                    const dayNum = weekDate.getDate();
                    const weekLabel = `${monthStr} ${dayNum}`;

                    // Find matching label index
                    const labelIndex = labels.indexOf(weekLabel);

                    if (labelIndex !== -1) {
                        weeklyData[labelIndex] = weekPoint.spend;
                    }
                });

                console.log(`  ✓ ${campaign.name}: ${campaign.weeklyBreakdown.length} weeks of data`);
            } else {
                console.log(`  ⚠️ ${campaign.name}: No weekly breakdown available`);
            }

            allSeries.push({
                name: `Meta: ${campaign.name}`,
                type: 'column',
                data: weeklyData,
                yAxisIndex: 0  // Use first Y-axis (Ad Spend $)
            });
        });
    } else {
        console.log('⚠️ No Meta Ads data available');
    }

    // ========================================
    // PROCESS TV/RADIO DATA - SYRACUSE
    // ========================================
    const syracuseAds = new Array(labels.length).fill(0);
    if (tvRadioData && tvRadioData.syracuse) {
        console.log('📺 Processing Syracuse/Rochester TV/Radio data');
        const syracuseTotal = aggregateStationDataByWeek(tvRadioData.syracuse, labels);

        if (syracuseTotal && syracuseTotal.length > 0) {
            syracuseAds.splice(0, syracuseTotal.length, ...syracuseTotal);
            console.log('  ✓ Syracuse data aggregated');
        }

        allSeries.push({
            name: 'Syracuse/Rochester Ads',
            type: 'line',
            data: syracuseAds,
            yAxisIndex: 1  // Use second Y-axis (TV/Radio Ads count)
        });
    } else {
        console.log('⚠️ No Syracuse TV/Radio data available');
    }

    // ========================================
    // PROCESS TV/RADIO DATA - ALBANY
    // ========================================
    if (tvRadioData && tvRadioData.albany) {
        console.log('📺 Processing Albany DMA TV/Radio data');
        const albanyAds = new Array(labels.length).fill(0);
        const albanyTotal = aggregateStationDataByWeek(tvRadioData.albany, labels);

        if (albanyTotal && albanyTotal.length > 0) {
            albanyAds.splice(0, albanyTotal.length, ...albanyTotal);
            console.log('  ✓ Albany data aggregated');

            allSeries.push({
                name: 'Albany DMA Ads',
                type: 'line',
                data: albanyAds,
                yAxisIndex: 1  // Use second Y-axis (TV/Radio Ads count)
            });
        }
    }

    // ========================================
    // PROCESS TV/RADIO DATA - MONTREAL
    // ========================================
    if (tvRadioData && tvRadioData.montreal) {
        console.log('📺 Processing Montreal/Plattsburgh TV/Radio data');
        const montrealAds = new Array(labels.length).fill(0);
        const montrealTotal = aggregateStationDataByWeek(tvRadioData.montreal, labels);

        if (montrealTotal && montrealTotal.length > 0) {
            montrealAds.splice(0, montrealTotal.length, ...montrealTotal);
            console.log('  ✓ Montreal data aggregated');

            allSeries.push({
                name: 'Montreal/Plattsburgh Ads',
                type: 'line',
                data: montrealAds,
                yAxisIndex: 1  // Use second Y-axis (TV/Radio Ads count)
            });
        }
    }

    console.log(`✅ Total series created: ${allSeries.length}`);
    console.log('📊 Series breakdown:', allSeries.map(s => `${s.name} (${s.type})`));

    return {
        labels,
        series: allSeries
    };
}

/**
 * Aggregate station data by week
 */

/**
 * Aggregate station data by week
 * Used for TV/Radio data aggregation
 */
function aggregateStationDataByWeek(stationData, weekLabels) {
    const weeklyData = new Array(weekLabels.length).fill(0);

    // Combine all stations (WTLA, WKRL, WKTW, WZUN, etc.)
    const allOrders = [];

    // Handle both object format (syracuse stations) and direct data format
    const processOrders = (data) => {
        if (!data) return;

        // If data has 'orders' property, use it directly
        if (data.orders) {
            Object.values(data.orders).forEach(order => {
                if (order.dailyBreakdown) {
                    order.dailyBreakdown.forEach(day => {
                        const parsedDate = parseDate(day.date);
                        if (parsedDate) { // Only add if date parsed successfully
                            allOrders.push({
                                date: parsedDate,
                                adCount: day.adCount
                            });
                        }
                    });
                }
            });
        }
    };

    // Check if stationData is an object with station keys (wtla, wkrl, etc.)
    if (typeof stationData === 'object') {
        Object.keys(stationData).forEach(stationKey => {
            const station = stationData[stationKey];
            processOrders(station);
        });
    } else {
        processOrders(stationData);
    }

    if (allOrders.length === 0) {
        console.log('  ⚠️ No orders found in station data');
        return weeklyData;
    }

    // Sort by date
    allOrders.sort((a, b) => a.date - b.date);

    // Aggregate by week (CRITICAL: align to Monday)
    const now = new Date();
    weekLabels.forEach((label, index) => {
        // Calculate week start date based on label index
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - ((weekLabels.length - 1 - index) * 7));

        // Week runs Monday to Sunday (align to Monday)
        const dayOfWeek = weekStart.getDay();
        const daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        weekStart.setDate(weekStart.getDate() - daysToMonday);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekTotal = allOrders
            .filter(order => order.date >= weekStart && order.date < weekEnd)
            .reduce((sum, order) => sum + order.adCount, 0);

        weeklyData[index] = weekTotal;
    });

    console.log(`  📊 Weekly totals:`, weeklyData);
    return weeklyData;
}

/**
 * Parse date string (MM/DD/YY format) to Date object
 */

function parseDate(dateStr) {
    if (!dateStr || dateStr === 'N/A' || dateStr === '-') return null;

    try {
        const [month, day, year] = dateStr.split('/');

        // Convert 2-digit year to 4-digit
        const yearNum = parseInt(year);
        const fullYear = yearNum < 100
            ? (yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum)
            : yearNum;

        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));

        // Validate the date
        if (isNaN(date.getTime())) {
            console.warn(`Invalid date: ${dateStr}`);
            return null;
        }

        return date;
    } catch (error) {
        console.warn(`Error parsing date: ${dateStr}`, error);
        return null;
    }
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
    // Determine colors dynamically
    const googleColors = ['#34a853', '#4285f4', '#fbbc04', '#ea4335', '#46bdc6']; // Google brand colors
    const metaColors = ['#1877f2', '#0668e1', '#0a7cff']; // Meta brand colors
    const tvRadioColors = ['#ff6b6b', '#feca57', '#ee5a6f'];

    // Build stroke widths (0 for columns, 4 for lines)
    const strokeWidths = chartData.series.map(s => s.type === 'line' ? 4 : 0);

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
            }
        },
        colors: [...googleColors, ...metaColors, ...tvRadioColors],
        stroke: {
            width: strokeWidths,
            curve: 'smooth'
        },
        plotOptions: {
            bar: {
                columnWidth: '55%',
                borderRadius: 4
            }
        },
        fill: {
            opacity: 0.85,
            gradient: {
                shade: 'light',
                type: "vertical",
                opacityFrom: 0.85,
                opacityTo: 0.55,
                stops: [0, 100]
            }
        },
        labels: chartData.labels,
        markers: {
            size: strokeWidths.map(w => w > 0 ? 5 : 0),
            strokeWidth: 2,
            hover: { size: 7 }
        },
        xaxis: {
            type: 'category',
            title: {
                text: 'Week Starting',
                style: {
                    fontSize: '14px',
                    fontWeight: 600
                }
            }
        },
        yaxis: [
            {
                title: {
                    text: 'Ad Spend ($)',
                    style: {
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#4285f4'
                    }
                },
                labels: {
                    formatter: function (val) {
                        return '$' + Math.round(val).toLocaleString();
                    }
                }
            },
            {
                opposite: true,
                title: {
                    text: 'TV/Radio Ads Played',
                    style: {
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ff6b6b'
                    }
                },
                labels: {
                    formatter: function (val) {
                        return Math.round(val) + ' ads';
                    }
                }
            }
        ],
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (val, opts) {
                    const seriesType = opts.w.config.series[opts.seriesIndex].type;
                    if (seriesType === 'line') {
                        return Math.round(val) + ' ads played';
                    }
                    return '$' + Math.round(val).toLocaleString();
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            offsetY: 0,
            fontSize: '13px',
            markers: {
                width: 12,
                height: 12,
                radius: 2
            }
        },
        title: {
            text: 'Marketing Performance Overview - Top Campaigns',
            align: 'center',
            style: {
                fontSize: '20px',
                fontWeight: 600
            }
        },
        subtitle: {
            text: 'Showing top 5 Google Ads campaigns by spend + Syracuse/Rochester TV/Radio',
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
