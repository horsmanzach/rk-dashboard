// ============================================================
// NAVBAR.JS
// Sidebar navigation for RK Dashboard
// Depends on: gsap (loaded before this file), dashboard-script.js
// Enqueued via functions.php after ad-dashboard-script
// ============================================================

(function () {

    // ============================================================
    // CONSTANTS
    // ============================================================

    const SIDEBAR_ID        = 'dashboardSidebar';
    const MAIN_ID           = 'dashboardMain';
    const COLLAPSE_BTN_ID   = 'sidebarCollapseBtn';
    const COLLAPSE_ICON_ID  = 'sidebarCollapseIcon';
    const USERNAME_ID       = 'sidebarUsername';
    const STORAGE_KEY       = 'rk_sidebar_collapsed';
    const COLLAPSED_CLASS   = 'collapsed';
    const ACTIVE_CLASS      = 'active';

    // Maps sidebar link IDs to the navigateToSlide() target keys
    // that are also used in dashboard-script.js rows map
    const NAV_LINK_MAP = {
        'navlink-performance'  : 'performance',
        'navlink-campaigns'    : 'campaigns',
        'navlink-attribution'  : 'attribution',
		'navlink-leads'        : 'leads'
    };

    // Which sidebar link should be active for each slide target.
    // Sub-slides (google, facebook, tvradio, etc.) highlight
    // 'campaigns' since they live under Campaign Analytics.
    const SLIDE_TO_NAVLINK = {
        performance  : 'navlink-performance',
        welcome      : 'navlink-performance',   // fallback alias
        campaigns    : 'navlink-campaigns',
        google       : 'navlink-campaigns',
        facebook     : 'navlink-campaigns',
        tvradio      : 'navlink-campaigns',
        albany       : 'navlink-campaigns',
        montreal     : 'navlink-campaigns',
        syracuse     : 'navlink-campaigns',
        attribution  : 'navlink-attribution',
		leads        : 'navlink-leads'
    };


    // ============================================================
    // PATCH navigateToSlide()
    // Extends the existing function in dashboard-script.js to:
    //  1. Add 'performance' and 'campaigns' to the rows map
    //  2. Update sidebar active state on every navigation
    //  3. Fix animation direction logic for the new nav model
    // ============================================================

    function patchNavigateToSlide() {
    const _original = window.navigateToSlide;

    if (typeof _original !== 'function') {
        console.warn('navbar.js: navigateToSlide() not found — patch skipped. Ensure dashboard-script.js loads first.');
        return;
    }

    window.navigateToSlide = function (target) {
        // Map 'performance' alias to 'welcome' for the rows map
        const resolvedTarget = (target === 'performance') ? 'welcome' : target;

        // campaigns is now in the rows map in dashboard-script.js
        // so all targets go through the original function
        _original(resolvedTarget);

        // Update sidebar active state
        setSidebarActive(target);

        // Initialise attribution panel when navigating directly from sidebar
        if (target === 'attribution') {
            setTimeout(() => {
                if (typeof updateAttributionAvailability === 'function') {
                    updateAttributionAvailability();
                }
                if (typeof initCalendarToLatestMonth === 'function') {
                    const station = document.getElementById('attributionStation')?.value || 'WTLA';
                    window.attributionCurrentStation = station;
                    window.attributionSelectedDate = null;

                    const chartCard = document.getElementById('attributionChartCard');
                    const tableCard = document.getElementById('attributionTableCard');
                    if (chartCard) chartCard.style.display = 'none';
                    if (tableCard) tableCard.style.display = 'none';

                    initCalendarToLatestMonth(station);
                }
            }, 450);
        }

		if (target === 'leads') {
    setTimeout(() => {
        if (typeof showLeadsPanel === 'function') {
            showLeadsPanel();
        }
    }, 450);
}
    };

    console.log('✅ navbar.js: navigateToSlide() patched successfully');
}


    // ============================================================
    // CAMPAIGNS NAVIGATION
    // Handles the campaigns-row directly since it wasn't in the
    // original rows map in dashboard-script.js
    // ============================================================

    function _navigateToCampaigns() {
        // Guard: prevent double-fire if already animating
        if (window.isAnimating) return;
        if (window.currentSlide === 'campaigns') return;

        window.isAnimating = true;

        const rowSelectors = {
            welcome      : '.welcome-row',
            campaigns    : '.campaigns-row',
            google       : '.google-row',
            facebook     : '.facebook-row',
            tvradio      : '.tvradio-row',
            albany       : '.albany-row',
            montreal     : '.montreal-row',
            syracuse     : '.syracuse-row',
            attribution  : '.attribution-row'
        };

        const currentKey = window.currentSlide || 'welcome';
        const currentRow = document.querySelector(rowSelectors[currentKey]);
        const targetRow  = document.querySelector('.campaigns-row');

        if (!currentRow || !targetRow) {
            window.isAnimating = false;
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        const tl = gsap.timeline({
            onComplete: () => {
                window.isAnimating = false;
                window.currentSlide = 'campaigns';
            }
        });

        // Fade out current row
        tl.to(currentRow, {
            opacity: 0,
            x: 50,
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => {
                currentRow.style.display = 'none';
            }
        });

        // Prepare target row
        tl.call(() => {
            targetRow.style.display = 'block';
            gsap.set(targetRow, { opacity: 0, x: -50 });
        });

        // Fade in target row
        tl.to(targetRow, {
            opacity: 1,
            x: 0,
            duration: 0.4,
            ease: 'power2.inOut'
        }, '-=0.1');

        // Animate the option cards with stagger
        tl.from(targetRow.querySelectorAll('.option-card'), {
            y: 20,
            opacity: 0,
            duration: 0.3,
            stagger: 0.08,
            ease: 'power2.out'
        }, '-=0.2');
    }


    // ============================================================
    // SIDEBAR ACTIVE STATE
    // ============================================================

    function setSidebarActive(slideTarget) {
        const activeLinkId = SLIDE_TO_NAVLINK[slideTarget] || 'navlink-performance';

        document.querySelectorAll('.sidebar-nav-link').forEach(link => {
            link.classList.remove(ACTIVE_CLASS);
        });

        const activeLink = document.getElementById(activeLinkId);
        if (activeLink) {
            activeLink.classList.add(ACTIVE_CLASS);
        }
    }


    // ============================================================
    // COLLAPSE TOGGLE
    // Uses GSAP for the width tween; also toggles .collapsed class
    // which drives the CSS transitions on child elements (logo,
    // nav text, footer text).
    // ============================================================

    function initCollapseToggle() {
        const sidebar     = document.getElementById(SIDEBAR_ID);
        const main        = document.getElementById(MAIN_ID);
        const collapseBtn = document.getElementById(COLLAPSE_BTN_ID);

        if (!sidebar || !collapseBtn) {
            console.warn('navbar.js: sidebar or collapse button not found');
            return;
        }

        // Restore saved state
        const savedCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
        if (savedCollapsed) {
            sidebar.classList.add(COLLAPSED_CLASS);
            applyMainMargin(main, true, false); // instant, no animation
        }

        collapseBtn.addEventListener('click', function () {
            const isCollapsed = sidebar.classList.contains(COLLAPSED_CLASS);

            if (isCollapsed) {
                // Expanding
                sidebar.classList.remove(COLLAPSED_CLASS);
                gsap.to(sidebar, {
                    width: 230,
                    duration: 0.28,
                    ease: 'power2.inOut'
                });
                applyMainMargin(main, false, true);
                localStorage.setItem(STORAGE_KEY, 'false');
            } else {
                // Collapsing
                sidebar.classList.add(COLLAPSED_CLASS);
                gsap.to(sidebar, {
                    width: 60,
                    duration: 0.28,
                    ease: 'power2.inOut'
                });
                applyMainMargin(main, true, true);
                localStorage.setItem(STORAGE_KEY, 'true');
            }
        });
    }


    // ============================================================
    // MAIN CONTENT MARGIN
    // Keeps the main content area in sync with sidebar width.
    // The CSS handles it via the .collapsed sibling selector,
    // but if Divi wraps them in separate containers the sibling
    // selector won't reach — so we also set it directly via GSAP.
    // ============================================================

	function applyMainMargin(main, collapsed, animate) {
    const target = document.querySelector('.dashboard-content-section');
    if (!target) return;

    const targetMargin = collapsed ? 60 : 230;

    if (animate) {
        gsap.to(target, {
            marginLeft: targetMargin,
            duration: 0.28,
            ease: 'power2.inOut'
        });
    } else {
        gsap.set(target, { marginLeft: targetMargin });
    }
}


    // ============================================================
    // USERNAME INJECTION
    // dashboardConfig.displayName is passed from functions.php
    // via wp_localize_script
    // ============================================================

    function injectUsername() {
        const el = document.getElementById(USERNAME_ID);
        if (!el) return;

        const name = (window.dashboardConfig && window.dashboardConfig.displayName)
            ? window.dashboardConfig.displayName
            : '';

        if (name) {
            el.textContent = name;
        } else {
            // Hide footer gracefully if no name available
            const footer = el.closest('.sidebar-footer');
            if (footer) footer.style.display = 'none';
        }
    }


    // ============================================================
    // ESC KEY — update to navigate to performance instead of welcome
    // ============================================================

    function patchEscKey() {
        // Remove any existing ESC listeners by re-registering our own.
        // dashboard-script.js registers: if ESC and currentSlide !== 'welcome'
        // We override by listening first (capture phase) and redirecting.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !window.isAnimating) {
                const slide = window.currentSlide;
                if (slide && slide !== 'welcome' && slide !== 'performance') {
                    e.stopImmediatePropagation();
                    window.navigateToSlide('performance');
                }
            }
        }, true); // capture phase — fires before dashboard-script.js listener
    }


    // ============================================================
    // INIT
    // Runs after DOM is ready. dashboard-script.js must already
    // be loaded (it's a dependency in functions.php).
    // ============================================================

    function init() {
        patchNavigateToSlide();
        initCollapseToggle();
        injectUsername();
        patchEscKey();

        // Set initial active state — performance is the default view
        setSidebarActive('performance');

        console.log('✅ navbar.js: initialised');
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();