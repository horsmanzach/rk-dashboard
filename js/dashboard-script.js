// Ad Dashboard JavaScript - Divi Row Version

// ============================================================
// UTILITY: Fetch with retry logic
// Retries up to `retries` times with `delay` ms between attempts
// ============================================================
async function fetchWithRetry(action, nonce, ajaxUrl, extraFields = {}, retries = 2, delay = 4000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const formData = new FormData();
            formData.append('action', action);
            formData.append('nonce', nonce);

            // Append any extra fields (e.g. campaign_id, days)
            Object.entries(extraFields).forEach(([key, val]) => formData.append(key, val));

            const response = await fetch(ajaxUrl, { method: 'POST', body: formData });
            const result = await response.json();

            if (result.success && result.data) return result;

            if (attempt < retries) {
                console.warn(`⚠️ ${action} returned no data (attempt ${attempt + 1}). Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        } catch (err) {
            console.warn(`⚠️ ${action} fetch error (attempt ${attempt + 1}):`, err);
            if (attempt < retries) await new Promise(r => setTimeout(r, delay));
        }
    }
    console.error(`❌ ${action} failed after ${retries + 1} attempts.`);
    return null;
}

function formatDate(dateStr) {
    // Input: "01/08/24" Output: "Jan. 8th 2024"
    if (!dateStr || dateStr === 'N/A' || dateStr === '-') return dateStr;

    const [month, day, year] = dateStr.split('/');
    const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

    const dayNum = parseInt(day);
    const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? 'st' :
        dayNum === 2 || dayNum === 22 ? 'nd' :
            dayNum === 3 || dayNum === 23 ? 'rd' : 'th';

    // Convert 2-digit year to 4-digit
    const yearNum = parseInt(year);
    const fullYear = yearNum < 100 ? (yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum) : yearNum;

    return `${months[parseInt(month) - 1]} ${dayNum}${suffix} ${fullYear}`;
}

// Global storage for Syracuse station data
let syracuseStationData = {
    wtla: null,
    wkrl: null,
    wktw: null,
    wzun: null
};

// Function to aggregate Syracuse data and update overview, yep
function updateSyracuseOverview() {
    console.log('📊 Updating Syracuse overview with aggregated data');

    let totalStations = 0;
    let totalOrders = new Set(); // Use Set to count unique orders
    let totalAds = 0;

    // Count stations that have data
    Object.keys(syracuseStationData).forEach(station => {
        const data = syracuseStationData[station];
        if (data && data.orders && data.orders.length > 0) {
            totalStations++;

            // Add all order numbers to the Set
            data.orders.forEach(order => {
                totalOrders.add(order.orderNumber);
            });

            // Sum total ads
            totalAds += data.summary?.totalAds || 0;
        }
    });

    // Update the display
    document.getElementById('syracuseStationsCount').textContent = totalStations;
    document.getElementById('syracuseTotalOrders').textContent = totalOrders.size;
    document.getElementById('syracuseTotalAds').textContent = totalAds.toLocaleString();

    console.log(`✅ Syracuse Overview: ${totalStations} stations, ${totalOrders.size} orders, ${totalAds} ads`);
}

window.currentSlide = 'welcome';
window.isAnimating = false;

function navigateToSlide(target) {
    // Prevent navigation during animation or to same slide
    if (isAnimating || currentSlide === target) return;

    isAnimating = true;

    const rows = {
    performance: document.querySelector('.welcome-row'),
    welcome: document.querySelector('.welcome-row'),
    campaigns: document.querySelector('.campaigns-row'),
    google: document.querySelector('.google-row'),
    facebook: document.querySelector('.facebook-row'),
    tvradio: document.querySelector('.tvradio-row'),
    albany: document.querySelector('.albany-row'),
    montreal: document.querySelector('.montreal-row'),
    syracuse: document.querySelector('.syracuse-row'),
    attribution: document.querySelector('.attribution-row'),
	leads: document.querySelector('.leads-panel')
};

    const currentRow = rows[currentSlide];
    const targetRow = rows[target];

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Determine animation direction
    const isGoingBack = target === 'welcome' || target === 'performance' || target === 'campaigns';
    const exitX = isGoingBack ? -50 : 50;
    const enterX = isGoingBack ? 50 : -50;

    // Animation timeline
    const tl = gsap.timeline({
        onComplete: () => {
            window.isAnimating = false;
            window.currentSlide = target;
        }
    });

    // Fade out and slide current row
    tl.to(currentRow, {
        opacity: 0,
        x: exitX,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: () => {
            currentRow.style.display = 'none';
        }
    });

    // Prepare and show target row
    tl.call(() => {
        targetRow.style.display = 'block';
        gsap.set(targetRow, { opacity: 0, x: enterX });
    });

    // Fade in and slide target row
    tl.to(targetRow, {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: 'power2.inOut'
    }, '-=0.1');

    // Animate content within slides
if (target === 'welcome' || target === 'performance') {
    tl.from('.welcome-title', {
        y: -20,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out'
    }, '-=0.2');

    tl.from('.option-card', {
        y: 20,
        opacity: 0,
        duration: 0.3,
        stagger: 0.08,
        ease: 'power2.out'
    }, '-=0.15');

} else if (target === 'campaigns') {
    tl.from(targetRow.querySelectorAll('.option-card'), {
        y: 20,
        opacity: 0,
        duration: 0.3,
        stagger: 0.08,
        ease: 'power2.out'
    }, '-=0.2');

} else {
    const slideContent = targetRow.querySelector('.slide-content');
    if (slideContent) {
        tl.from(slideContent, {
            scale: 0.95,
            y: 20,
            opacity: 0,
            duration: 0.3,
            ease: 'back.out(1.2)'
        }, '-=0.2');
    }
}
}

// Keyboard navigation - ESC to return to welcome screen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentSlide !== 'welcome' && !isAnimating) {
        navigateToSlide('welcome');
    }
});

function showMetricLoadingSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;padding:3rem 0;grid-column:1/-1;">
            <div style="text-align:center;">
                <div style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #ff6600;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
                <p style="color:#999;font-size:0.95rem;">Loading metrics...</p>
            </div>
        </div>`;
}

// Syracuse Station Navigation
let currentStationView = 'overview';

function showStationDetail(station) {
    // Hide overview
    const overview = document.getElementById('syracuseOverview');
    const stationDetail = document.getElementById(station + 'Detail');

    if (!stationDetail) return;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Animate transition
    gsap.to(overview, {
        opacity: 0,
        x: -30,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
            overview.classList.remove('active');
            stationDetail.classList.add('active');
            gsap.fromTo(stationDetail,
                { opacity: 0, x: 30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );
        }
    });

    currentStationView = station;
}

function showSyracuseOverview() {
    const overview = document.getElementById('syracuseOverview');
    const currentDetail = document.getElementById(currentStationView + 'Detail');

    if (!currentDetail) {
        // Fallback: hide all station details
        const allDetails = document.querySelectorAll('.station-detail-view');
        allDetails.forEach(detail => detail.classList.remove('active'));
        overview.classList.add('active');
        return;
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Animate transition back to overview
    gsap.to(currentDetail, {
        opacity: 0,
        x: 30,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
            currentDetail.classList.remove('active');
            overview.classList.add('active');
            gsap.fromTo(overview,
                { opacity: 0, x: -30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );
        }
    });

    currentStationView = 'overview';
}

function loadTVRadioData() {
    // This loads summary data for TV/Radio if needed
    // Or you can leave this empty since we're going straight to regions
}

function loadAlbanyData() {
    // Placeholder - keep values as "-" until data is available
    console.log('📋 Albany data not yet available');
}

function loadMontrealData() {
    // Placeholder - keep values as "-" until data is available
    console.log('📋 Montreal data not yet available');
}

// ============================================================
// SHARED: Render order sections into a container element
// ============================================================
function renderOrderSections(data, containerId, summaryIds) {
    const { totalAdsId, dateRangeId } = summaryIds;

    if (data.summary) {
        const totalAdsEl = document.getElementById(totalAdsId);
        const dateRangeEl = document.getElementById(dateRangeId);

        if (totalAdsEl) totalAdsEl.textContent = data.summary.totalAds || '-';

        if (dateRangeEl && data.summary.dateRange) {
            if (data.summary.dateRange.start && data.summary.dateRange.end) {
                dateRangeEl.textContent = formatDate(data.summary.dateRange.start) + ' - ' + formatDate(data.summary.dateRange.end);
            } else {
                dateRangeEl.textContent = '-';
            }
        }
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.log('❌ Container not found:', containerId);
        return;
    }

    container.innerHTML = '';

    if (!data.orders || data.orders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 2rem;">No data available</p>';
        return;
    }

    console.log('📋 Processing', data.orders.length, 'orders into', containerId);

    data.orders.forEach((order, orderIndex) => {
        console.log('📦 Processing order', orderIndex, ':', order.orderNumber);

        const formattedStartDate = formatDate(order.dateRange.start);
        const formattedEndDate = formatDate(order.dateRange.end);

        const orderSection = document.createElement('div');
        orderSection.className = 'order-section';

        const orderHeader = document.createElement('div');
        orderHeader.className = 'order-header';
        orderHeader.style.cursor = 'pointer';
        orderHeader.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 0.5rem 0;">${order.orderNumber}</h3>
                    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                        <span><strong>Date Range:</strong> ${formattedStartDate} - ${formattedEndDate}</span>
                        <span><strong>Total Ads:</strong> ${order.totalAds}</span>
                    </div>
                </div>
                <span class="order-toggle">▶</span>
            </div>
        `;

        const tableContainer = document.createElement('div');
        tableContainer.className = 'daily-breakdown-container order-table-content';
        tableContainer.style.display = 'none';

        const table = document.createElement('table');
        table.className = 'daily-breakdown-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Date Aired</th>
                <th># of Ads Ran</th>
                <th>Ad-ID</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        if (order.dailyBreakdown && order.dailyBreakdown.length > 0) {
            order.dailyBreakdown.forEach(day => {
                const row = document.createElement('tr');

                const dateCell = document.createElement('td');
                dateCell.textContent = formatDate(day.date);

                const countCell = document.createElement('td');
                countCell.textContent = day.adCount;

                const adIDCell = document.createElement('td');
                adIDCell.textContent = (day.adIDs && day.adIDs.length > 0) ? day.adIDs.join(', ') : '-';

                row.appendChild(dateCell);
                row.appendChild(countCell);
                row.appendChild(adIDCell);
                tbody.appendChild(row);
            });
        } else {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = '<td colspan="3" style="text-align: center; color: #999;">No daily data available</td>';
            tbody.appendChild(noDataRow);
        }

        table.appendChild(tbody);
        tableContainer.appendChild(table);

        orderHeader.addEventListener('click', function () {
            const toggle = this.querySelector('.order-toggle');
            const isVisible = tableContainer.style.display !== 'none';

            if (isVisible) {
                tableContainer.style.display = 'none';
                toggle.textContent = '▶';
                orderHeader.style.borderRadius = '10px';
            } else {
                tableContainer.style.display = 'block';
                toggle.textContent = '▼';
                orderHeader.style.borderRadius = '10px 10px 0 0';
            }
        });

        orderSection.appendChild(orderHeader);
        orderSection.appendChild(tableContainer);
        container.appendChild(orderSection);
    });

    console.log('✅ Created', data.orders.length, 'collapsible order sections in', containerId);
}

// ============================================================
// Individual Station Data Loading Functions (with retry)
// ============================================================

async function loadWTLAData() {
    console.log('🔵 loadWTLAData called!');
    const result = await fetchWithRetry(
        'fetch_wtla_ads',
        dashboardConfig.nonce,
        dashboardConfig.ajaxUrl
    );
    if (result) {
        const data = result.data;
        console.log('✅ WTLA Full Response:', result);
        syracuseStationData.wtla = data;
        updateSyracuseOverview();
        console.log('📊 Orders count:', data.orders ? data.orders.length : 0);
        renderOrderSections(data, 'wtlaOrdersContainer', {
            totalAdsId: 'wtlaTotalAds',
            dateRangeId: 'wtlaDateRange'
        });
        if (typeof updateAttributionAvailability === 'function') updateAttributionAvailability();
    } else {
        console.error('❌ WTLA failed to load after all retries.');
    }
}

async function loadWKRLData() {
    console.log('🔵 loadWKRLData called!');

    const result = await fetchWithRetry(
        'fetch_tvradio_ads',
        dashboardConfig.nonce,
        dashboardConfig.ajaxUrl
    );

    if (result) {
        const data = result.data;
        console.log('✅ WKRL Full Response:', result);
        syracuseStationData.wkrl = data;
        updateSyracuseOverview();
        console.log('📊 Orders count:', data.orders ? data.orders.length : 0);
        renderOrderSections(data, 'wkrlOrdersContainer', {
            totalAdsId: 'wkrlTotalAds',
            dateRangeId: 'wkrlDateRange'
        });
		if (typeof updateAttributionAvailability === 'function') updateAttributionAvailability();
    } else {
        console.error('❌ WKRL failed to load after all retries.');
    }
}

async function loadWKTWData() {
    console.log('🔵 loadWKTWData called!');

    const result = await fetchWithRetry(
        'fetch_wktw_ads',
        dashboardConfig.nonce,
        dashboardConfig.ajaxUrl
    );

    if (result) {
        const data = result.data;
        console.log('✅ WKTW Full Response:', result);
        syracuseStationData.wktw = data;
        updateSyracuseOverview();
        console.log('📊 Orders count:', data.orders ? data.orders.length : 0);
        renderOrderSections(data, 'wktwOrdersContainer', {
            totalAdsId: 'wktwTotalAds',
            dateRangeId: 'wktwDateRange'
        });
		if (typeof updateAttributionAvailability === 'function') updateAttributionAvailability();
    } else {
        console.error('❌ WKTW failed to load after all retries.');
    }
}

async function loadWZUNData() {
    console.log('🔵 loadWZUNData called!');

    const result = await fetchWithRetry(
        'fetch_wzun_ads',
        dashboardConfig.nonce,
        dashboardConfig.ajaxUrl
    );

    if (result) {
        const data = result.data;
        console.log('✅ WZUN Full Response:', result);
        syracuseStationData.wzun = data;
        updateSyracuseOverview();
        console.log('📊 Orders count:', data.orders ? data.orders.length : 0);
        renderOrderSections(data, 'wzunOrdersContainer', {
            totalAdsId: 'wzunTotalAds',
            dateRangeId: 'wzunDateRange'
        });
		if (typeof updateAttributionAvailability === 'function') updateAttributionAvailability();
    } else {
        console.error('❌ WZUN failed to load after all retries.');
    }
}

function loadGoogleAdsData() {
    console.log('🔵 loadGoogleAdsData called!');

    const formData = new FormData();
    formData.append('action', 'fetch_google_ads_campaigns');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ Google Ads Response:', result);

            if (result.success && result.data) {
                const data = result.data;
                const container = document.getElementById('googleCampaignsGrid');

                if (!container) {
                    console.log('❌ Container not found!');
                    return;
                }

                container.innerHTML = '';

                if (!data.campaigns || data.campaigns.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 2rem;">No campaigns found</p>';
                    return;
                }

                console.log('📋 Processing', data.campaigns.length, 'campaigns');

                data.campaigns.forEach(campaign => {
                    const campaignCard = document.createElement('div');
                    campaignCard.className = 'campaign-card';
                    campaignCard.onclick = () => showGoogleCampaignDetail(campaign.id, campaign.name, campaign.ageInDays);

                    const spendFormatted = '$' + campaign.spend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    const budgetFormatted = '$' + campaign.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

                    const impressionsFormatted = campaign.impressions >= 1000000
                        ? (campaign.impressions / 1000000).toFixed(1) + 'M'
                        : campaign.impressions >= 1000
                            ? (campaign.impressions / 1000).toFixed(1) + 'K'
                            : campaign.impressions.toLocaleString();

                    campaignCard.innerHTML = `
                        <div class="campaign-header">
                            <h4 class="campaign-name">${campaign.name}</h4>
                        </div>
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 1rem; font-weight: 500; padding-bottom: 1rem; border-bottom: solid 2px #e0e0e0;">
                            <b>Daily Budget:</b> <span class="budget-amount">${budgetFormatted}/day</span>
                        </div>
                        <div class="campaign-metrics">
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Total Spent</span>
                                <span class="campaign-metric-value">${spendFormatted}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Impressions</span>
                                <span class="campaign-metric-value">${impressionsFormatted}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Clicks</span>
                                <span class="campaign-metric-value">${campaign.clicks.toLocaleString()}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">CTR</span>
                                <span class="campaign-metric-value">${campaign.ctr}%</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Avg CPC</span>
                                <span class="campaign-metric-value">$${campaign.avgCpc}</span>
                            </div>
                        </div>
                    `;

                    container.appendChild(campaignCard);
                });

                let totalBudget = 0;
                data.campaigns.forEach(campaign => {
                    totalBudget += campaign.budget;
                });

                const totalBudgetFormatted = '$' + totalBudget.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });

                document.getElementById('googleActiveCampaignsCount').textContent = data.campaigns.length;
                document.getElementById('googleTotalBudget').textContent = totalBudgetFormatted + '/day';

                console.log('✅ Created', data.campaigns.length, 'campaign cards');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading Google Ads data:', error);
        });
}

// Google Campaign Navigation
let currentGoogleCampaignId = null;
let currentGoogleCampaignName = null;
let currentGoogleTimeRange = 30; // Default to last month
let currentGoogleCampaignAgeInDays = null;

function updateVisibleTimeRangeButtons(ageInDays) {
    const buttons = document.querySelectorAll('.time-range-btn');

    buttons.forEach(btn => {
        const btnText = btn.textContent.trim();

        // "All Time" button is ALWAYS visible
        if (btnText.includes('All Time')) {
            btn.style.display = 'inline-block';
            return;
        }

        if (btnText.includes('Last 3 Months') && ageInDays < 90) {
            btn.style.display = 'none';
        } else if (btnText.includes('Last 12 Months') && ageInDays < 365) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'inline-block';
        }
    });
}

function resetGoogleTimeRangeButtons() {
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.time-range-btn').forEach(btn => {
        if (btn.textContent.includes('Last Month') || btn.getAttribute('onclick')?.includes('30')) {
            btn.classList.add('active');
        }
    });

    if (currentGoogleCampaignAgeInDays !== null) {
        updateVisibleTimeRangeButtons(currentGoogleCampaignAgeInDays);
    }
}

function showGoogleCampaignDetail(campaignId, campaignName, ageInDays = null) {
    currentGoogleCampaignId = campaignId;
    currentGoogleCampaignName = campaignName;
    currentGoogleCampaignAgeInDays = ageInDays;
    currentGoogleTimeRange = 30;

    console.log('📊 Loading Google campaign:', campaignName, campaignId, 'Age:', ageInDays, 'days');

    const overview = document.getElementById('googleOverview');
    const detail = document.getElementById('googleCampaignDetail');

    document.getElementById('googleCampaignDetailTitle').innerHTML = `
        <img src="https://dashboard.richardkimmedicine.com/wp-content/uploads/2025/12/Google-Logo-Edited.png" alt="Google Ads" class="option-logo">
        ${campaignName}
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    gsap.to(overview, {
        opacity: 0,
        x: -30,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
            overview.classList.remove('active');
            detail.classList.add('active');
            gsap.fromTo(detail,
                { opacity: 0, x: 30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );

            resetGoogleTimeRangeButtons();
            loadGoogleCampaignMetrics(campaignId, currentGoogleTimeRange);
        }
    });
}

function showGoogleOverview() {
    const overview = document.getElementById('googleOverview');
    const detail = document.getElementById('googleCampaignDetail');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    gsap.to(detail, {
        opacity: 0,
        x: 30,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
            detail.classList.remove('active');
            overview.classList.add('active');
            gsap.fromTo(overview,
                { opacity: 0, x: -30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );
        }
    });
}

function selectGoogleTimeRange(days) {
    currentGoogleTimeRange = days;

    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    loadGoogleCampaignMetrics(currentGoogleCampaignId, days);
}

function loadGoogleCampaignMetrics(campaignId, days) {
    console.log(`🔵 Loading metrics for campaign ${campaignId}, last ${days} days`);

	showMetricLoadingSpinner('googleCampaignMetricsContainer');

   	 const formData = new FormData();
    formData.append('action', 'fetch_google_campaign_metrics');
    formData.append('nonce', dashboardConfig.nonce);
    formData.append('campaign_id', campaignId);
    formData.append('days', days);


    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ Campaign Metrics Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                const spentFormatted = '$' + data.spend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

                const impressionsFormatted = data.impressions >= 1000000
                    ? (data.impressions / 1000000).toFixed(1) + 'M'
                    : data.impressions >= 1000
                        ? (data.impressions / 1000).toFixed(1) + 'K'
                        : data.impressions.toLocaleString();

                document.getElementById('googleCampaignMetricsContainer').innerHTML = `
    <div class="stats-container">
        <div class="stat-card">
            <div class="stat-label">Total Spent</div>
            <div class="stat-value">${spentFormatted}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Impressions</div>
            <div class="stat-value">${impressionsFormatted}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Clicks</div>
            <div class="stat-value">${data.clicks.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">CTR</div>
            <div class="stat-value">${data.ctr}%</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg CPC</div>
            <div class="stat-value">$${data.avgCpc}</div>
        </div>
    </div>`;

                console.log('✅ Metrics updated');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading campaign metrics:', error);
        });
}

function loadFacebookAdsData() {
    console.log('🔵 loadFacebookAdsData called!');

    const formData = new FormData();
    formData.append('action', 'fetch_facebook_ads');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ Facebook Ads Full Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                const grid = document.getElementById('facebookCampaignsGrid');
                if (!grid) return;

                grid.innerHTML = '';

                if (!data.campaigns || data.campaigns.length === 0) {
                    grid.innerHTML = '<p style="text-align: center; color: #999;">No campaigns found</p>';
                    return;
                }

                data.campaigns.forEach(campaign => {
                    const card = document.createElement('div');
                    card.className = 'campaign-card';
                    card.onclick = () => showFacebookCampaignDetail(campaign.id, campaign.name);

                    const budgetFormatted = '$' + campaign.budget.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    });

                    card.innerHTML = `
                        <div class="campaign-header">
                            <h4 class="campaign-name">${campaign.name}</h4>
                        </div>
                        
                        <div style="font-size: 0.95rem; color: #666; margin: 1rem 0; padding-bottom: 1rem; border-bottom: 2px solid #e0e0e0;">
                            <strong>Daily Budget:</strong> 
                            <span style="color: #ff6600; font-size: 1.1rem; font-weight: 600;">${budgetFormatted}/day</span>
                        </div>
                        
                        <div class="campaign-metrics">
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Spend</span>
                                <span class="campaign-metric-value">$${campaign.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Impressions</span>
                                <span class="campaign-metric-value">${campaign.impressions.toLocaleString('en-US')}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Clicks</span>
                                <span class="campaign-metric-value">${campaign.clicks.toLocaleString('en-US')}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">CTR</span>
                                <span class="campaign-metric-value">${campaign.ctr}%</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Reach</span>
                                <span class="campaign-metric-value">${campaign.reach.toLocaleString('en-US')}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Avg CPC</span>
                                <span class="campaign-metric-value">$${campaign.cpc}</span>
                            </div>
                        </div>
                    `;

                    grid.appendChild(card);
                });

                let totalBudget = 0;
                data.campaigns.forEach(campaign => {
                    totalBudget += (campaign.budget || 0);
                });

                const totalBudgetFormatted = '$' + totalBudget.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });

                document.getElementById('facebookActiveCampaignsCount').textContent = data.campaigns.length;
                document.getElementById('facebookTotalBudget').textContent = totalBudgetFormatted + '/day';

                console.log('✅ Created', data.campaigns.length, 'campaign cards');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading Facebook Ads data:', error);
        });
}

// Facebook Campaign Navigation
let currentFacebookCampaignId = null;
let currentFacebookCampaignName = null;
let currentFacebookTimeRange = 30;

function resetFacebookTimeRangeButtons() {
    document.querySelectorAll('.facebook-time-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.facebook-time-btn').forEach(btn => {
        if (btn.textContent.includes('Last Month') || btn.getAttribute('onclick')?.includes('30')) {
            btn.classList.add('active');
        }
    });
}

function showFacebookCampaignDetail(campaignId, campaignName) {
    currentFacebookCampaignId = campaignId;
    currentFacebookCampaignName = campaignName;
    currentFacebookTimeRange = 30;

    console.log('📊 Loading Facebook campaign:', campaignName, campaignId);

    const overview = document.getElementById('facebookOverview');
    const detail = document.getElementById('facebookCampaignDetail');

    document.getElementById('campaignDetailTitle').textContent = campaignName;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    gsap.to(overview, {
        opacity: 0,
        x: -30,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
            overview.classList.remove('active');
            detail.classList.add('active');
            gsap.fromTo(detail,
                { opacity: 0, x: 30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );

            resetFacebookTimeRangeButtons();
            loadFacebookCampaignMetrics(currentFacebookCampaignId, currentFacebookTimeRange);
        }
    });
}

function showFacebookOverview() {
    const overview = document.getElementById('facebookOverview');
    const detail = document.getElementById('facebookCampaignDetail');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    gsap.to(detail, {
        opacity: 0,
        x: 30,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
            detail.classList.remove('active');
            overview.classList.add('active');
            gsap.fromTo(overview,
                { opacity: 0, x: -30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );
        }
    });
}

function selectFacebookTimeRange(days) {
    currentFacebookTimeRange = days;

    document.querySelectorAll('.facebook-time-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    loadFacebookCampaignMetrics(currentFacebookCampaignId, days);
}

function loadFacebookCampaignMetrics(campaignId, days) {
    console.log(`🔵 loadFacebookCampaignMetrics called for: ${campaignId}, last ${days} days`);

	showMetricLoadingSpinner('facebookCampaignMetricsContainer');

    const formData = new FormData();
    formData.append('action', 'fetch_facebook_campaign_adsets');
    formData.append('nonce', dashboardConfig.nonce);
    formData.append('campaign_id', campaignId);
    formData.append('days', days);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ Facebook Campaign Metrics Response:', result);

            if (result.success && result.data && result.data.adsets) {
                const adsets = result.data.adsets;

                // Aggregate totals across all ad sets
                let totalSpend       = 0;
                let totalImpressions = 0;
                let totalClicks      = 0;

                adsets.forEach(adset => {
                    totalSpend       += parseFloat(adset.spend)       || 0;
                    totalImpressions += parseInt(adset.impressions)   || 0;
                    totalClicks      += parseInt(adset.clicks)        || 0;
                });

                // Recalculate CTR and CPC from aggregated totals
                const totalCTR    = totalImpressions > 0
                    ? ((totalClicks / totalImpressions) * 100).toFixed(2)
                    : '0.00';
                const totalAvgCPC = totalClicks > 0
                    ? (totalSpend / totalClicks).toFixed(2)
                    : '0.00';

                // Format display values
                const spentFormatted = '$' + totalSpend.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });

                const impressionsFormatted = totalImpressions >= 1000000
                    ? (totalImpressions / 1000000).toFixed(1) + 'M'
                    : totalImpressions >= 1000
                        ? (totalImpressions / 1000).toFixed(1) + 'K'
                        : totalImpressions.toLocaleString();

                // Populate the Google-style metric elements
                document.getElementById('facebookCampaignMetricsContainer').innerHTML = `
    <div class="stats-container">
        <div class="stat-card">
            <div class="stat-label">Total Spent</div>
            <div class="stat-value">${spentFormatted}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Impressions</div>
            <div class="stat-value">${impressionsFormatted}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Clicks</div>
            <div class="stat-value">${totalClicks.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">CTR</div>
            <div class="stat-value">${totalCTR}%</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg CPC</div>
            <div class="stat-value">$${totalAvgCPC}</div>
        </div>
    </div>`;

                console.log('✅ Facebook campaign metrics populated');
          } else {
                console.error('❌ AJAX Error:', result);
                document.getElementById('facebookCampaignMetricsContainer').innerHTML = 
                    '<p style="text-align:center;color:#999;padding:2rem;">Error loading metrics. Please try again.</p>';
            }
        })
        .catch(error => {
            console.error('❌ Error loading Facebook campaign metrics:', error);
        });
}

// ============================================================
// PAGE LOAD — Stagger station fetches 4-5s apart to stay
// well under the Google Sheets 60 reads/minute quota limit.
// Each station workflow reads up to 4 sheet tabs, so spacing
// them 4-5 seconds apart keeps concurrent reads comfortably
// below the quota ceiling. Retry logic handles any remaining
// transient failures automatically.
// ============================================================
window.addEventListener('load', function () {

    // Hide attribution row on initial load
    const attributionRow = document.querySelector('.attribution-row');
    if (attributionRow) attributionRow.style.display = 'none';

    // Hide campaigns row on initial load
    const campaignsRow = document.querySelector('.campaigns-row');
    if (campaignsRow) campaignsRow.style.display = 'none';

	  // Hide campaigns row on initial load
    const leadsRow = document.querySelector('.leads-panel');
    if (leadsRow) leadsRow.style.display = 'none';

	
    setTimeout(() => {
        loadGoogleAdsData();
        loadFacebookAdsData();
        loadTVRadioData();
        loadAlbanyData();
        loadMontrealData();
        // Station fetches staggered at .5-second intervals
        setTimeout(() => loadWTLAData(),  0);
        setTimeout(() => loadWKRLData(),  500);
        setTimeout(() => loadWKTWData(),  1000);
        setTimeout(() => loadWZUNData(),  1500);
    }, 500);
});