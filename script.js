// ==========================================================================
// x1 — Capital Intelligence & Portfolio Dashboard Engine
// Protocol: Premium Utilitarian Minimalism & Editorial UI (Dark Mode)
// ==========================================================================

// ---------- CONFIGURATION ----------
const JSON_DATA_URL = 'https://y2uoxl23r2c33ad35r2wfotfnp4d7vhklagnmdh5isnvcjfurgeq.arweave.net/xqjrr1uOhb2Ae-x1Yrpla_g_1OpYDNYM_USbUSS0iYk';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const REFRESH_INTERVAL_MS = 60000; // 60 seconds auto-refresh

let portfolioData = null;
let refreshInterval = null;
const priceCache = new Map();

// CoinGecko Token Mapping
const cryptoIdMap = {
    'bitcoin': 'bitcoin',
    'btc': 'bitcoin',
    'tether': 'tether',
    'usdt': 'tether',
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'solana': 'solana',
    'sol': 'solana',
    'binancecoin': 'binancecoin',
    'bnb': 'binancecoin',
    'cardano': 'cardano',
    'ada': 'cardano',
    'ripple': 'ripple',
    'xrp': 'ripple',
    'dogecoin': 'dogecoin',
    'doge': 'dogecoin',
    'avalanche': 'avalanche-2',
    'avax': 'avalanche-2',
    'polygon': 'matic-network',
    'matic': 'matic-network',
    'polkadot': 'polkadot',
    'dot': 'polkadot',
    'chainlink': 'chainlink',
    'link': 'chainlink',
    'uniswap': 'uniswap',
    'uni': 'uniswap',
    'litecoin': 'litecoin',
    'ltc': 'litecoin'
};

// ==========================================================================
// CORE DATA LOADER
// ==========================================================================

async function loadPortfolio() {
    try {
        clearError();

        // Fetch local data.json with cache busting
        const response = await fetch(`${JSON_DATA_URL}?_t=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Failed to load data.json (HTTP ${response.status})`);
        }

        portfolioData = await response.json();
        await renderPortfolio();
    } catch (error) {
        console.error('Error loading portfolio dashboard:', error);
        showError(`Failed to load portfolio from data.json: ${error.message}`);
    }
}

async function renderPortfolio() {
    if (!portfolioData) return;

    updateLastUpdatedTime(portfolioData.lastUpdated);

    // Render Spot Assets
    let spotRows = [];
    if (portfolioData.portfolio?.spot && portfolioData.portfolio.spot.length > 0) {
        spotRows = await renderSpotAssets(portfolioData.portfolio.spot);
        document.getElementById('spot-section').style.display = 'block';
        updateElementText('spot-count', portfolioData.portfolio.spot.length);
        updateElementText('spot-counter-badge', `${portfolioData.portfolio.spot.length} ${portfolioData.portfolio.spot.length === 1 ? 'Asset' : 'Assets'}`);
    } else {
        document.getElementById('spot-section').style.display = 'none';
        updateElementText('spot-count', '0');
    }

    // Render Derivative Positions
    let derivativeRows = [];
    if (portfolioData.portfolio?.derivative && portfolioData.portfolio.derivative.length > 0) {
        derivativeRows = await renderDerivativeAssets(portfolioData.portfolio.derivative);
        document.getElementById('derivative-section').style.display = 'block';
        updateElementText('derivative-count', portfolioData.portfolio.derivative.length);
        updateElementText('derivative-counter-badge', `${portfolioData.portfolio.derivative.length} ${portfolioData.portfolio.derivative.length === 1 ? 'Position' : 'Positions'}`);
    } else {
        document.getElementById('derivative-section').style.display = 'none';
        updateElementText('derivative-count', '0');
    }

    // Render Summary Bento Metrics & Asset Allocation
    updateSummaryBento(spotRows, derivativeRows);
    document.getElementById('overview-section').style.display = 'grid';

    // Render Quantitative Trade Signals
    if (portfolioData.suggestedTrades && portfolioData.suggestedTrades.length > 0) {
        renderSuggestedTrades(portfolioData.suggestedTrades);
        document.getElementById('trades-section').style.display = 'block';
        updateElementText('trades-count', portfolioData.suggestedTrades.length);
        updateElementText('trades-counter-badge', `${portfolioData.suggestedTrades.length} Signals`);
    } else {
        document.getElementById('trades-section').style.display = 'none';
        updateElementText('trades-count', '0');
    }

    // Render AI & Macro Outlook
    if (portfolioData.aiOutlook && portfolioData.aiOutlook.length > 0) {
        renderAIOutlook(portfolioData.aiOutlook);
        document.getElementById('outlook-section').style.display = 'block';
    } else {
        document.getElementById('outlook-section').style.display = 'none';
    }

    // Initialize Scroll Animations & Navigation
    initScrollAnimations();
    startAutoRefresh();
}

// ==========================================================================
// PRICE ENGINE (CoinGecko with In-Memory Caching)
// ==========================================================================

async function getCryptoPrice(assetName) {
    try {
        const normalizedName = assetName.toLowerCase().trim();
        const coinId = cryptoIdMap[normalizedName];

        if (!coinId) {
            console.warn(`No CoinGecko mapping found for: ${assetName}`);
            return null;
        }

        // Check cache (valid for 20 seconds)
        const cached = priceCache.get(coinId);
        if (cached && (Date.now() - cached.timestamp < 20000)) {
            return cached.data;
        }

        const response = await fetch(
            `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const result = {
            price: data[coinId]?.usd || 0,
            change24h: data[coinId]?.usd_24h_change || 0
        };

        priceCache.set(coinId, { timestamp: Date.now(), data: result });
        return result;
    } catch (error) {
        console.warn(`Could not fetch live price for ${assetName}:`, error.message);
        const cached = priceCache.get(cryptoIdMap[assetName.toLowerCase().trim()]);
        return cached ? cached.data : null;
    }
}

// ==========================================================================
// RENDER: SPOT ASSETS
// ==========================================================================

async function renderSpotAssets(assets) {
    const table = document.getElementById('spot-assets');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Asset</th>
                <th>Custody</th>
                <th class="align-right">Reserve Amount</th>
                <th class="align-right">Avg Entry</th>
                <th class="align-right">Mark Price (24h)</th>
                <th class="align-right">Valuation</th>
                <th class="align-right">Unrealized P&L</th>
            </tr>
        </thead>
        <tbody>
            <tr><td colspan="7" class="loading-indicator">Synchronizing asset valuations...</td></tr>
        </tbody>
    `;

    const assetRows = await Promise.all(assets.map(async (asset) => {
        const priceData = await getCryptoPrice(asset.name);
        const currentPrice = priceData?.price ?? asset.avgPrice;
        const change24h = priceData?.change24h ?? 0;
        const totalValue = currentPrice * asset.amount;
        const costBasis = asset.avgPrice * asset.amount;
        const pnl = totalValue - costBasis;
        const pnlPercentage = costBasis > 0 ? ((totalValue - costBasis) / costBasis) * 100 : 0;

        return {
            id: asset.id,
            icon: asset.icon,
            name: asset.name,
            exchange: asset.exchange,
            amount: asset.amount,
            avgPrice: asset.avgPrice,
            currentPrice: currentPrice,
            change24h: change24h,
            totalValue: totalValue,
            costBasis: costBasis,
            pnl: pnl,
            pnlPercentage: pnlPercentage
        };
    }));

    const rowsHTML = assetRows.map(row => {
        const isPnlPositive = row.pnl >= 0;
        const isChangePositive = row.change24h >= 0;

        return `
            <tr>
                <td>
                    <div class="asset-identity-cell">
                        ${row.icon ? `<img src="${row.icon}" alt="${row.name}" class="asset-icon-img" onerror="this.style.display='none'">` : ''}
                        <span class="asset-name-title">${row.name}</span>
                    </div>
                </td>
                <td><span class="custody-badge">${row.exchange}</span></td>
                <td class="align-right mono-val">${formatCryptoAmount(row.amount)}</td>
                <td class="align-right mono-val">$${formatNumber(row.avgPrice, 2, 4)}</td>
                <td class="align-right mono-val">
                    <div class="price-delta-box">
                        <span>$${formatNumber(row.currentPrice, 2, 4)}</span>
                        <span class="price-delta-tag ${isChangePositive ? 'pnl-positive' : 'pnl-negative'}">
                            ${isChangePositive ? '+' : ''}${row.change24h.toFixed(2)}%
                        </span>
                    </div>
                </td>
                <td class="align-right mono-val"><strong>$${formatNumber(row.totalValue, 2, 2)}</strong></td>
                <td class="align-right mono-val">
                    <div class="price-delta-box">
                        <span class="${isPnlPositive ? 'pnl-positive' : 'pnl-negative'}">
                            ${isPnlPositive ? '+' : ''}$${formatNumber(row.pnl, 2, 2)}
                        </span>
                        <span class="price-delta-tag ${isPnlPositive ? 'pnl-positive' : 'pnl-negative'}">
                            (${isPnlPositive ? '+' : ''}${row.pnlPercentage.toFixed(2)}%)
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    table.querySelector('tbody').innerHTML = rowsHTML;
    return assetRows;
}

// ==========================================================================
// RENDER: DERIVATIVE POSITIONS
// ==========================================================================

async function renderDerivativeAssets(assets) {
    const table = document.getElementById('derivative-assets');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Position</th>
                <th>Type</th>
                <th>Custody</th>
                <th class="align-right">Notional Size</th>
                <th class="align-right">Entry Price</th>
                <th class="align-right">Mark Price (24h)</th>
                <th class="align-right">Current Value</th>
                <th class="align-right">Unrealized P&L</th>
            </tr>
        </thead>
        <tbody>
            <tr><td colspan="8" class="loading-indicator">Synchronizing vault positions...</td></tr>
        </tbody>
    `;

    const assetRows = await Promise.all(assets.map(async (asset) => {
        const symbol = asset.name.split(' ')[0];
        const priceData = await getCryptoPrice(symbol);
        const currentPrice = priceData?.price ?? asset.opening;
        const change24h = priceData?.change24h ?? 0;

        const isShort = asset.size < 0;
        const notionalSize = Math.abs(asset.size);
        const initialMargin = asset.opening * notionalSize;
        const pnl = isShort
            ? (asset.opening - currentPrice) * notionalSize
            : (currentPrice - asset.opening) * notionalSize;

        const pnlPercentage = initialMargin > 0 ? (pnl / initialMargin) * 100 : 0;
        const currentValue = Math.max(0, initialMargin + pnl);

        return {
            id: asset.id,
            icon: asset.icon,
            name: asset.name,
            isShort: isShort,
            exchange: asset.exchange,
            size: asset.size,
            notionalSize: notionalSize,
            opening: asset.opening,
            currentPrice: currentPrice,
            change24h: change24h,
            initialMargin: initialMargin,
            currentValue: currentValue,
            stop: asset.stop,
            limit: asset.limit,
            pnl: pnl,
            pnlPercentage: pnlPercentage
        };
    }));

    const rowsHTML = assetRows.map(row => {
        const isPnlPositive = row.pnl >= 0;
        const isChangePositive = row.change24h >= 0;

        return `
            <tr>
                <td>
                    <div class="asset-identity-cell">
                        ${row.icon ? `<img src="${row.icon}" alt="${row.name}" class="asset-icon-img" onerror="this.style.display='none'">` : ''}
                        <span class="asset-name-title">${row.name}</span>
                    </div>
                </td>
                <td>
                    <span class="direction-badge ${row.isShort ? 'direction-sell' : 'direction-buy'}">
                        ${row.isShort ? 'Short Hedge' : 'Long Position'}
                    </span>
                </td>
                <td><span class="custody-badge">${row.exchange}</span></td>
                <td class="align-right mono-val">${formatCryptoAmount(row.size)}</td>
                <td class="align-right mono-val">$${formatNumber(row.opening, 2, 2)}</td>
                <td class="align-right mono-val">
                    <div class="price-delta-box">
                        <span>$${formatNumber(row.currentPrice, 2, 2)}</span>
                        <span class="price-delta-tag ${isChangePositive ? 'pnl-positive' : 'pnl-negative'}">
                            ${isChangePositive ? '+' : ''}${row.change24h.toFixed(2)}%
                        </span>
                    </div>
                </td>
                <td class="align-right mono-val"><strong>$${formatNumber(row.currentValue, 2, 2)}</strong></td>
                <td class="align-right mono-val">
                    <div class="price-delta-box">
                        <span class="${isPnlPositive ? 'pnl-positive' : 'pnl-negative'}">
                            ${isPnlPositive ? '+' : ''}$${formatNumber(row.pnl, 2, 2)}
                        </span>
                        <span class="price-delta-tag ${isPnlPositive ? 'pnl-positive' : 'pnl-negative'}">
                            (${isPnlPositive ? '+' : ''}${row.pnlPercentage.toFixed(2)}%)
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    table.querySelector('tbody').innerHTML = rowsHTML;
    return assetRows;
}

// ==========================================================================
// RENDER: BENTO SUMMARY CARDS & ALLOCATION
// ==========================================================================

function updateSummaryBento(spotRows, derivativeRows) {
    let totalValue = 0;
    let totalPnl = 0;
    let totalCost = 0;

    // Spot Aggregates
    spotRows.forEach(row => {
        totalValue += row.totalValue;
        totalPnl += row.pnl;
        totalCost += row.costBasis;
    });

    // Derivative Aggregates
    derivativeRows.forEach(row => {
        totalValue += row.currentValue;
        totalPnl += row.pnl;
        totalCost += row.initialMargin;
    });

    // 24h Weighted Net Portfolio Movement
    let weighted24hDelta = 0;
    let totalWeight = 0;

    spotRows.forEach(row => {
        weighted24hDelta += row.change24h * row.totalValue;
        totalWeight += row.totalValue;
    });
    derivativeRows.forEach(row => {
        const positionMultiplier = row.isShort ? -1 : 1;
        weighted24hDelta += (row.change24h * positionMultiplier) * row.currentValue;
        totalWeight += row.currentValue;
    });

    if (totalWeight > 0) {
        weighted24hDelta /= totalWeight;
    }

    // 1. Total Aggregate Value
    updateElementText('total-value', `$${formatNumber(totalValue, 2, 2)}`);
    updateElementText('total-cost', `$${formatNumber(totalCost, 2, 2)}`);
    updateElementText('total-positions', `${spotRows.length + derivativeRows.length} Active`);

    // 2. Unrealized Net P&L
    const isPnlPositive = totalPnl >= 0;
    const pnlPct = totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(2) : '0.00';
    const pnlEl = document.getElementById('total-pnl');
    const pnlPctEl = document.getElementById('total-pnl-pct');
    const pnlPill = document.getElementById('pnl-pill');

    if (pnlEl) {
        pnlEl.textContent = `${isPnlPositive ? '+' : ''}$${formatNumber(totalPnl, 2, 2)}`;
        pnlEl.className = `secondary-value mono-val ${isPnlPositive ? 'pnl-positive' : 'pnl-negative'}`;
    }
    if (pnlPctEl) {
        pnlPctEl.textContent = `${isPnlPositive ? '+' : ''}${pnlPct}% Return on Cost`;
        pnlPctEl.className = `card-sub-val mono-val ${isPnlPositive ? 'pnl-positive' : 'pnl-negative'}`;
    }
    if (pnlPill) {
        pnlPill.textContent = `${isPnlPositive ? '+' : ''}${pnlPct}%`;
        pnlPill.className = `status-pill ${isPnlPositive ? 'badge-green' : 'badge-red'}`;
    }

    // 3. 24h Weighted Net Change
    const isChangePositive = weighted24hDelta >= 0;
    const dollar24hChange = totalValue * (weighted24hDelta / 100);
    const change24hEl = document.getElementById('change-24h');
    const change24hPctEl = document.getElementById('change-24h-pct');
    const changePill = document.getElementById('change-pill');

    if (change24hEl) {
        change24hEl.textContent = `${dollar24hChange >= 0 ? '+' : ''}$${formatNumber(dollar24hChange, 2, 2)}`;
        change24hEl.className = `secondary-value mono-val ${isChangePositive ? 'pnl-positive' : 'pnl-negative'}`;
    }
    if (change24hPctEl) {
        change24hPctEl.textContent = `${isChangePositive ? '+' : ''}${weighted24hDelta.toFixed(2)}% Net 24h`;
        change24hPctEl.className = `card-sub-val mono-val ${isChangePositive ? 'pnl-positive' : 'pnl-negative'}`;
    }
    if (changePill) {
        changePill.textContent = `${isChangePositive ? '+' : ''}${weighted24hDelta.toFixed(2)}%`;
        changePill.className = `status-pill ${isChangePositive ? 'badge-green' : 'badge-red'}`;
    }

    // 4. Capital Structure Allocation Visuals
    renderCapitalAllocation(spotRows, derivativeRows, totalValue);
}

function renderCapitalAllocation(spotRows, derivativeRows, totalValue) {
    const barContainer = document.getElementById('allocation-bar-visual');
    const legendContainer = document.getElementById('allocation-legend');
    if (!barContainer || !legendContainer) return;

    if (totalValue <= 0) {
        barContainer.innerHTML = '<div class="allocation-segment" style="width: 100%; background: #272725;"></div>';
        legendContainer.innerHTML = '<span class="legend-val">No active valuation</span>';
        return;
    }

    const segments = [];
    // Dark mode tuned allocation colors
    const colors = ['#73D182', '#60A5FA', '#FBBF24', '#F87171', '#9E9D97'];

    spotRows.forEach((row, i) => {
        const weight = (row.totalValue / totalValue) * 100;
        if (weight > 0.01) {
            segments.push({
                name: `${row.name} (Spot)`,
                weight: weight,
                color: colors[i % colors.length]
            });
        }
    });

    derivativeRows.forEach((row, i) => {
        const weight = (row.currentValue / totalValue) * 100;
        if (weight > 0.01) {
            segments.push({
                name: `${row.name} (${row.isShort ? 'Short' : 'Long'})`,
                weight: weight,
                color: colors[(spotRows.length + i) % colors.length]
            });
        }
    });

    barContainer.innerHTML = segments.map(seg => `
        <div class="allocation-segment" style="width: ${seg.weight}%; background-color: ${seg.color};" title="${seg.name}: ${seg.weight.toFixed(1)}%"></div>
    `).join('');

    legendContainer.innerHTML = segments.map(seg => `
        <div class="legend-item">
            <span class="legend-color-box" style="background-color: ${seg.color};"></span>
            <span>${seg.name}</span>
            <span class="legend-val">${seg.weight.toFixed(1)}%</span>
        </div>
    `).join('');
}

// ==========================================================================
// RENDER: QUANTITATIVE TRADE SIGNALS
// ==========================================================================

function renderSuggestedTrades(trades) {
    const table = document.getElementById('suggested-trades');
    if (!table) return;

    const rowsHTML = trades.map(trade => {
        const isBuy = trade.direction.toUpperCase() === 'BUY';
        const publishedDate = formatDate(trade.published);
        const updatedDate = trade.updated ? formatDate(trade.updated) : '—';

        return `
            <tr>
                <td><strong>${trade.market}</strong></td>
                <td>
                    <span class="direction-badge ${isBuy ? 'direction-buy' : 'direction-sell'}">
                        ${trade.direction.toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="badge-pill ${trade.duration?.toLowerCase().includes('intra') ? 'badge-blue' : 'badge-yellow'}">
                        ${trade.duration || 'Standard'}
                    </span>
                </td>
                <td class="mono-val">${publishedDate}</td>
                <td class="mono-val">${updatedDate}</td>
            </tr>
        `;
    }).join('');

    table.innerHTML = `
        <thead>
            <tr>
                <th>Market Instrument</th>
                <th>Signal Direction</th>
                <th>Timeframe / Horizon</th>
                <th>Published</th>
                <th>Last Update</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHTML}
        </tbody>
    `;
}

// ==========================================================================
// RENDER: AI OUTLOOK & MACRO RESEARCH
// ==========================================================================

function renderAIOutlook(outlooks) {
    const container = document.getElementById('ai-outlook');
    if (!container) return;

    const cardsHTML = outlooks.map((item, index) => {
        const title = item.title || `Technical Chart Analysis #${index + 1}`;
        const publishedDate = formatDate(item.published);
        const updatedDate = item.updated ? formatDate(item.updated) : null;

        return `
            <div class="outlook-card" onclick="openModal('${encodeURI(item.imageUrl)}', '${escapeHTML(title)}')">
                <div class="outlook-image-wrap">
                    <img src="${item.imageUrl}" alt="${escapeHTML(title)}" class="outlook-image" loading="lazy" onerror="this.parentElement.style.display='none'">
                    <span class="outlook-expand-hint">Expand <kbd>Click</kbd></span>
                </div>
                <div class="outlook-body">
                    <h3 class="outlook-title">${title}</h3>
                    <div class="outlook-meta-row mono-val">
                        <span>Published: ${publishedDate}</span>
                        ${updatedDate ? `<span>Updated: ${updatedDate}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = cardsHTML;
}

// ==========================================================================
// MODAL LIGHTBOX
// ==========================================================================

function openModal(imageUrl, title = 'Chart Analysis') {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');

    if (modal && modalImg) {
        modalImg.src = decodeURI(imageUrl);
        if (modalTitle) modalTitle.textContent = title;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ==========================================================================
// AUTO-REFRESH & MANUAL SYNC
// ==========================================================================

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(async () => {
        await refreshPricesOnly();
    }, REFRESH_INTERVAL_MS);
}

async function refreshPricesOnly() {
    if (!portfolioData) return;

    let spotRows = [];
    let derivativeRows = [];

    if (portfolioData.portfolio?.spot && portfolioData.portfolio.spot.length > 0) {
        spotRows = await renderSpotAssets(portfolioData.portfolio.spot);
    }
    if (portfolioData.portfolio?.derivative && portfolioData.portfolio.derivative.length > 0) {
        derivativeRows = await renderDerivativeAssets(portfolioData.portfolio.derivative);
    }

    updateSummaryBento(spotRows, derivativeRows);
    updateLastUpdatedTime(new Date().toISOString());
}

async function manualRefresh() {
    const btn = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');

    if (btn) btn.disabled = true;
    if (icon) icon.classList.add('refreshing');

    try {
        priceCache.clear();
        await loadPortfolio();
    } finally {
        setTimeout(() => {
            if (btn) btn.disabled = false;
            if (icon) icon.classList.remove('refreshing');
        }, 600);
    }
}

// ==========================================================================
// SCROLL-ENTRY ANIMATIONS & NAVIGATION
// ==========================================================================

function initScrollAnimations() {
    const elements = document.querySelectorAll('.animate-reveal');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        });

        elements.forEach(el => observer.observe(el));
    } else {
        elements.forEach(el => el.classList.add('is-visible'));
    }

    // Tab Navigation Highlighting
    setupNavigationHighlighting();
}

function setupNavigationHighlighting() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

// ==========================================================================
// UTILITY & FORMATTING HELPERS
// ==========================================================================

function formatNumber(val, minDec = 2, maxDec = 2) {
    if (val === null || val === undefined || isNaN(val)) return '0.00';
    return Number(val).toLocaleString(undefined, {
        minimumFractionDigits: minDec,
        maximumFractionDigits: maxDec
    });
}

function formatCryptoAmount(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = Number(val);
    if (Math.abs(num) >= 1000000) {
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function updateLastUpdatedTime(timestamp) {
    const timeEl = document.getElementById('last-updated-text');
    if (!timeEl) return;

    if (!timestamp) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString();
        return;
    }

    try {
        const d = new Date(timestamp);
        timeEl.textContent = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
        timeEl.textContent = timestamp;
    }
}

function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div class="error-banner">
                <span>${escapeHTML(message)}</span>
            </div>
        `;
    }
}

function clearError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.innerHTML = '';
}

// ==========================================================================
// KEYBOARD SHORTCUTS
// ==========================================================================

window.addEventListener('keydown', (e) => {
    // R key -> Refresh
    if ((e.key === 'r' || e.key === 'R') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        manualRefresh();
    }

    // Escape -> Close modal
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================

window.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
});
