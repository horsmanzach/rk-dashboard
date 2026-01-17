
// Ad Dashboard JavaScript - Divi Row Version

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

// Function to aggregate Syracuse data and update overview
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

let currentSlide = 'welcome';
let isAnimating = false;

function navigateToSlide(target) {
    // Prevent navigation during animation or to same slide
    if (isAnimating || currentSlide === target) return;

    isAnimating = true;

    const rows = {
        welcome: document.querySelector('.welcome-row'),
        google: document.querySelector('.google-row'),
        facebook: document.querySelector('.facebook-row'),
        tvradio: document.querySelector('.tvradio-row'),
        albany: document.querySelector('.albany-row'),
        montreal: document.querySelector('.montreal-row'),
        syracuse: document.querySelector('.syracuse-row')
    };

    const currentRow = rows[currentSlide];
    const targetRow = rows[target];

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Determine animation direction
    const isGoingBack = target === 'welcome';
    const exitX = isGoingBack ? -50 : 50;
    const enterX = isGoingBack ? 50 : -50;

    // Animation timeline
    const tl = gsap.timeline({
        onComplete: () => {
            isAnimating = false;
            currentSlide = target;
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
    if (target !== 'welcome') {
        // Animate slide content
        tl.from(targetRow.querySelector('.slide-content'), {
            scale: 0.95,
            y: 20,
            opacity: 0,
            duration: 0.3,
            ease: 'back.out(1.2)'
        }, '-=0.2');
    } else {
        // Animate welcome content
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
    }
}

// Keyboard navigation - ESC to return to welcome screen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentSlide !== 'welcome' && !isAnimating) {
        navigateToSlide('welcome');
    }
});

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


// Individual Station Data Loading Functions
function loadWTLAData() {
    console.log('🔵 loadWTLAData called!');

    const formData = new FormData();
    formData.append('action', 'fetch_wtla_ads');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ WTLA Full Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                // Store data for aggregation
                syracuseStationData.wtla = data; // Change station name accordingly

                // Update Syracuse overview
                updateSyracuseOverview();

                console.log('📊 Orders count:', data.orders ? data.orders.length : 0);

                if (data.summary) {
                    const totalAdsEl = document.getElementById('wtlaTotalAds');
                    const dateRangeEl = document.getElementById('wtlaDateRange');

                    if (totalAdsEl) {
                        totalAdsEl.textContent = data.summary.totalAds || '-';
                    }

                    if (dateRangeEl && data.summary.dateRange) {
                        if (data.summary.dateRange.start && data.summary.dateRange.end) {
                            dateRangeEl.textContent = formatDate(data.summary.dateRange.start) + ' - ' + formatDate(data.summary.dateRange.end);
                        } else {
                            dateRangeEl.textContent = '-';
                        }
                    }
                }

                const container = document.getElementById('wtlaOrdersContainer');

                if (!container) {
                    console.log('❌ Container not found!');
                    return;
                }

                container.innerHTML = '';

                if (!data.orders || data.orders.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 2rem;">No data available</p>';
                    return;
                }

                console.log('📋 Processing', data.orders.length, 'orders');

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
                            if (day.adIDs && day.adIDs.length > 0) {
                                adIDCell.textContent = day.adIDs.join(', ');
                            } else {
                                adIDCell.textContent = '-';
                            }

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

                console.log('✅ Created', data.orders.length, 'collapsible order sections');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading WTLA data:', error);
        });
}

function loadWKRLData() {
    console.log('🔵 loadWKRLData called!');

    const formData = new FormData();
    formData.append('action', 'fetch_tvradio_ads');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ WKRL Full Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                // Store data for aggregation
                syracuseStationData.wkrl = data; // Change station name accordingly

                // Update Syracuse overview
                updateSyracuseOverview();

                console.log('📊 Orders count:', data.orders ? data.orders.length : 0);

                if (data.summary) {
                    const totalAdsEl = document.getElementById('wkrlTotalAds');
                    const dateRangeEl = document.getElementById('wkrlDateRange');

                    if (totalAdsEl) {
                        totalAdsEl.textContent = data.summary.totalAds || '-';
                    }

                    if (dateRangeEl && data.summary.dateRange) {
                        if (data.summary.dateRange.start && data.summary.dateRange.end) {
                            dateRangeEl.textContent = formatDate(data.summary.dateRange.start) + ' - ' + formatDate(data.summary.dateRange.end);
                        } else {
                            dateRangeEl.textContent = '-';
                        }
                    }
                }

                const container = document.getElementById('wkrlOrdersContainer');

                if (!container) {
                    console.log('❌ Container not found!');
                    return;
                }

                container.innerHTML = '';

                if (!data.orders || data.orders.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 2rem;">No data available</p>';
                    return;
                }

                console.log('📋 Processing', data.orders.length, 'orders');

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
                            if (day.adIDs && day.adIDs.length > 0) {
                                adIDCell.textContent = day.adIDs.join(', ');
                            } else {
                                adIDCell.textContent = '-';
                            }

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

                console.log('✅ Created', data.orders.length, 'collapsible order sections');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading WKRL data:', error);
        });
}

function loadWKTWData() {
    console.log('🔵 loadWKTWData called!');

    const formData = new FormData();
    formData.append('action', 'fetch_wktw_ads');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ WKTW Full Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                // Store data for aggregation
                syracuseStationData.wktw = data; // Change station name accordingly

                // Update Syracuse overview
                updateSyracuseOverview();

                console.log('📊 Orders count:', data.orders ? data.orders.length : 0);

                if (data.summary) {
                    const totalAdsEl = document.getElementById('wktwTotalAds');
                    const dateRangeEl = document.getElementById('wktwDateRange');

                    if (totalAdsEl) {
                        totalAdsEl.textContent = data.summary.totalAds || '-';
                    }

                    if (dateRangeEl && data.summary.dateRange) {
                        if (data.summary.dateRange.start && data.summary.dateRange.end) {
                            dateRangeEl.textContent = formatDate(data.summary.dateRange.start) + ' - ' + formatDate(data.summary.dateRange.end);
                        } else {
                            dateRangeEl.textContent = '-';
                        }
                    }
                }

                const container = document.getElementById('wktwOrdersContainer');

                if (!container) {
                    console.log('❌ Container not found!');
                    return;
                }

                container.innerHTML = '';

                if (!data.orders || data.orders.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 2rem;">No data available</p>';
                    return;
                }

                console.log('📋 Processing', data.orders.length, 'orders');

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
                            if (day.adIDs && day.adIDs.length > 0) {
                                adIDCell.textContent = day.adIDs.join(', ');
                            } else {
                                adIDCell.textContent = '-';
                            }

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

                console.log('✅ Created', data.orders.length, 'collapsible order sections');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading WKTW data:', error);
        });
}

function loadWZUNData() {
    console.log('🔵 loadWZUNData called!');

    const formData = new FormData();
    formData.append('action', 'fetch_wzun_ads');
    formData.append('nonce', dashboardConfig.nonce);

    fetch(dashboardConfig.ajaxUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log('✅ WZUN Full Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                // Store data for aggregation
                syracuseStationData.wzun = data; // Change station name accordingly

                // Update Syracuse overview
                updateSyracuseOverview();

                console.log('📊 Orders count:', data.orders ? data.orders.length : 0);

                if (data.summary) {
                    const totalAdsEl = document.getElementById('wzunTotalAds');
                    const dateRangeEl = document.getElementById('wzunDateRange');

                    if (totalAdsEl) {
                        totalAdsEl.textContent = data.summary.totalAds || '-';
                    }

                    if (dateRangeEl && data.summary.dateRange) {
                        if (data.summary.dateRange.start && data.summary.dateRange.end) {
                            dateRangeEl.textContent = formatDate(data.summary.dateRange.start) + ' - ' + formatDate(data.summary.dateRange.end);
                        } else {
                            dateRangeEl.textContent = '-';
                        }
                    }
                }

                const container = document.getElementById('wzunOrdersContainer');

                if (!container) {
                    console.log('❌ Container not found!');
                    return;
                }

                container.innerHTML = '';

                if (!data.orders || data.orders.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 2rem;">No data available</p>';
                    return;
                }

                console.log('📋 Processing', data.orders.length, 'orders');

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
                            if (day.adIDs && day.adIDs.length > 0) {
                                adIDCell.textContent = day.adIDs.join(', ');
                            } else {
                                adIDCell.textContent = '-';
                            }

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

                console.log('✅ Created', data.orders.length, 'collapsible order sections');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading WZUN data:', error);
        });
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
                    // MODIFIED: Pass ageInDays as third parameter
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
let currentGoogleCampaignAgeInDays = null; // NEW: Store campaign age

// NEW FUNCTION: Update visible time range buttons based on campaign age
function updateVisibleTimeRangeButtons(ageInDays) {
    const buttons = document.querySelectorAll('.time-range-btn');

    buttons.forEach(btn => {
        const btnText = btn.textContent.trim();

        // "All Time" button is ALWAYS visible
        if (btnText.includes('All Time')) {
            btn.style.display = 'inline-block';
            return; // Skip further checks for this button
        }

        // Show/hide other buttons based on campaign age
        if (btnText.includes('Last 3 Months') && ageInDays < 90) {
            btn.style.display = 'none';
        } else if (btnText.includes('Last 12 Months') && ageInDays < 365) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'inline-block';
        }
    });
}

// MODIFIED: Reset function to also handle visibility
function resetGoogleTimeRangeButtons() {
    // Remove active class from all buttons
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to the Last Month button (30 days)
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        if (btn.textContent.includes('Last Month') || btn.getAttribute('onclick')?.includes('30')) {
            btn.classList.add('active');
        }
    });
    
    // Update button visibility based on campaign age
    if (currentGoogleCampaignAgeInDays !== null) {
        updateVisibleTimeRangeButtons(currentGoogleCampaignAgeInDays);
    }
}

// MODIFIED: Accept ageInDays parameter
function showGoogleCampaignDetail(campaignId, campaignName, ageInDays = null) {
    currentGoogleCampaignId = campaignId;
    currentGoogleCampaignName = campaignName;
    currentGoogleCampaignAgeInDays = ageInDays; // Store the age
    currentGoogleTimeRange = 30; // Reset to default

    console.log('📊 Loading Google campaign:', campaignName, campaignId, 'Age:', ageInDays, 'days');

    const overview = document.getElementById('googleOverview');
    const detail = document.getElementById('googleCampaignDetail');

    // Update title
    document.getElementById('googleCampaignDetailTitle').innerHTML = `
        <img src="https://dashboard.richardkimmedicine.com/wp-content/uploads/2025/12/Google-Logo-Edited.png" alt="Google Ads" class="option-logo">
        ${campaignName}
    `;

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
            detail.classList.add('active');
            gsap.fromTo(detail,
                { opacity: 0, x: 30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );

            // Reset time range buttons and update visibility
            resetGoogleTimeRangeButtons();
            
            // Load campaign metrics
            loadGoogleCampaignMetrics(campaignId, currentGoogleTimeRange);
        }
    });
}

function showGoogleOverview() {
    const overview = document.getElementById('googleOverview');
    const detail = document.getElementById('googleCampaignDetail');

    // Scroll to top
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

    // Update button states
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Reload metrics with new time range
    loadGoogleCampaignMetrics(currentGoogleCampaignId, days);
}

function loadGoogleCampaignMetrics(campaignId, days) {
    console.log(`🔵 Loading metrics for campaign ${campaignId}, last ${days} days`);

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

                // Format values
                const spentFormatted = '$' + data.spend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

                const impressionsFormatted = data.impressions >= 1000000
                    ? (data.impressions / 1000000).toFixed(1) + 'M'
                    : data.impressions >= 1000
                        ? (data.impressions / 1000).toFixed(1) + 'K'
                        : data.impressions.toLocaleString();

                // Update display
                document.getElementById('googleCampaignSpent').textContent = spentFormatted;
                document.getElementById('googleCampaignImpressions').textContent = impressionsFormatted;
                document.getElementById('googleCampaignClicks').textContent = data.clicks.toLocaleString();
                document.getElementById('googleCampaignCTR').textContent = data.ctr + '%';
                document.getElementById('googleCampaignAvgCPC').textContent = '$' + data.avgCpc;

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

                // Get campaigns grid container
                const grid = document.getElementById('facebookCampaignsGrid');
                if (!grid) return;

                grid.innerHTML = '';

                if (!data.campaigns || data.campaigns.length === 0) {
                    grid.innerHTML = '<p style="text-align: center; color: #999;">No campaigns found</p>';
                    return;
                }

                // Create campaign cards
                data.campaigns.forEach(campaign => {
                    const card = document.createElement('div');
                    card.className = 'campaign-card';
                    card.onclick = () => showFacebookCampaignDetail(campaign.id, campaign.name);

                    // Format budget
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

                // Calculate total budget and update counts
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
let currentFacebookTimeRange = 30; // Default to last month

function resetFacebookTimeRangeButtons() {
    // Remove active class from all Facebook time range buttons
    document.querySelectorAll('.facebook-time-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add active class to the Last Month button
    document.querySelectorAll('.facebook-time-btn').forEach(btn => {
        if (btn.textContent.includes('Last Month') || btn.getAttribute('onclick')?.includes('30')) {
            btn.classList.add('active');
        }
    });
}

function showFacebookCampaignDetail(campaignId, campaignName) {
    currentFacebookCampaignId = campaignId;
    currentFacebookCampaignName = campaignName;
    currentFacebookTimeRange = 30; // Reset to default

    console.log('📊 Loading Facebook campaign:', campaignName, campaignId);

    const overview = document.getElementById('facebookOverview');
    const detail = document.getElementById('facebookCampaignDetail');

    // Update title
    document.getElementById('campaignDetailTitle').textContent = campaignName;

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
            detail.classList.add('active');
            gsap.fromTo(detail,
                { opacity: 0, x: 30 },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.inOut' }
            );

            // Reset time range buttons
            resetFacebookTimeRangeButtons();

            // Load ad sets data with default time range
            loadCampaignAdSets(currentFacebookCampaignId, currentFacebookTimeRange);
        }
    });
}

function showFacebookOverview() {
    const overview = document.getElementById('facebookOverview');
    const detail = document.getElementById('facebookCampaignDetail');

    // Scroll to top
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

    // Update button states
    document.querySelectorAll('.facebook-time-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Reload ad sets with new time range
    loadCampaignAdSets(currentFacebookCampaignId, days);
}

function loadCampaignAdSets(campaignId, days) {
    console.log(`🔵 loadCampaignAdSets called for: ${campaignId}, last ${days} days`);

    // ADD THIS DEBUG LOG
    console.log('📤 Sending to WordPress:', {
        action: 'fetch_facebook_campaign_adsets',
        campaign_id: campaignId,
        days: days
    });

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
            console.log('✅ Ad Sets Response:', result);

            if (result.success && result.data) {
                const data = result.data;

                // Update summary
                const totalAdSetsEl = document.getElementById('campaignTotalAdSets');
                if (totalAdSetsEl) totalAdSetsEl.textContent = data.totalAdSets || '0';

                // Get grid
                const grid = document.getElementById('facebookAdSetsGrid');
                if (!grid) return;

                grid.innerHTML = '';

                if (!data.adsets || data.adsets.length === 0) {
                    grid.innerHTML = '<p style="text-align: center; color: #999;">No active ad sets found</p>';
                    return;
                }

                // Create ad set cards
                data.adsets.forEach(adset => {
                    const card = document.createElement('div');
                    card.className = 'campaign-card';

                    const spendFormatted = '$' + adset.spend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

                    const impressionsFormatted = adset.impressions >= 1000000
                        ? (adset.impressions / 1000000).toFixed(1) + 'M'
                        : adset.impressions >= 1000
                            ? (adset.impressions / 1000).toFixed(1) + 'K'
                            : adset.impressions.toLocaleString();

                    const reachFormatted = adset.reach >= 1000000
                        ? (adset.reach / 1000000).toFixed(1) + 'M'
                        : adset.reach >= 1000
                            ? (adset.reach / 1000).toFixed(1) + 'K'
                            : adset.reach.toLocaleString();

                    card.innerHTML = `
                        <div class="campaign-header">
                            <h4 class="campaign-name">${adset.name}</h4>
                        </div>
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 1rem;">
                            ${adset.activeAds} Active Ad${adset.activeAds !== 1 ? 's' : ''}
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
                                <span class="campaign-metric-value">${adset.clicks.toLocaleString()}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">CTR</span>
                                <span class="campaign-metric-value">${adset.ctr}%</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">Reach</span>
                                <span class="campaign-metric-value">${reachFormatted}</span>
                            </div>
                            <div class="campaign-metric">
                                <span class="campaign-metric-label">CPC</span>
                                <span class="campaign-metric-value">$${adset.cpc}</span>
                            </div>
                        </div>
                    `;

                    grid.appendChild(card);
                });

                console.log('✅ Created', data.adsets.length, 'ad set cards');
            } else {
                console.error('❌ AJAX Error:', result);
            }
        })
        .catch(error => {
            console.error('❌ Error loading ad sets:', error);
        });
}

// Load all data when page loads
window.addEventListener('load', function () {
    setTimeout(() => {
        loadGoogleAdsData();
        loadFacebookAdsData();
        loadTVRadioData();
        loadAlbanyData();
        loadMontrealData();
        // Load all Syracuse station data
        loadWTLAData();
        loadWKRLData();
        loadWKTWData();
        loadWZUNData();
    }, 500);
});