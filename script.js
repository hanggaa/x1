// ============================================
// CONFIGURATION
// ============================================
const JSON_DATA_URL = 'https://37mpf46fmruz2h6q7ikzimqty6km7lt32rrjgayoj6z352nbr37a.arweave.net/39jy88VkaZ0f0PoVlDITx5TPrnvUYpMDDk-zvumhjv4';

let portfolioData = null;
let refreshInterval = null;
const REFRESH_INTERVAL_MS = 60000; // 60 seconds

// CoinGecko API — Free tier
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Mapping crypto names → CoinGecko IDs
const cryptoIdMap = {
    'bitcoin': 'bitcoin',
    'btc': 'bitcoin',
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'bnb': 'binancecoin',
    'binance coin': 'binancecoin',
    'xrp': 'ripple',
    'ripple': 'ripple',
    'cardano': 'cardano',
    'ada': 'cardano',
    'solana': 'solana',
    'sol': 'solana',
    'polkadot': 'polkadot',
    'dot': 'polkadot',
    'dogecoin': 'dogecoin',
    'doge': 'dogecoin',
    'avalanche': 'avalanche-2',
    'avax': 'avalanche-2',
    'polygon': 'matic-network',
    'matic': 'matic-network',
    'shiba inu': 'shiba-inu',
    'shib': 'shiba-inu',
    'chainlink': 'chainlink',
    'link': 'chainlink',
    'uniswap': 'uniswap',
    'uni': 'uniswap',
    'litecoin': 'litecoin',
    'ltc': 'litecoin'
};

// ============================================
// PORTFOLIO LOADING
// ============================================

async function loadPortfolio() {
    try {
        showLoading();
        clearError();

        const response = await fetch(JSON_DATA_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch the data');
        }

        portfolioData = await response.json();
        await renderPortfolio();
    } catch (error) {
        showError('Error loading portfolio: ' + error.message);
        hideAllSections();
    }
}

async function renderPortfolio() {
    if (!portfolioData) return;

    updateLastUpdatedTime();

    // Render Spot Assets
    let spotRows = [];
    if (portfolioData.portfolio?.spot?.length > 0) {
        spotRows = await renderSpotAssets(portfolioData.portfolio.spot);
        document.getElementById('spot-section').style.display = 'block';
    }

    // Render Derivative Assets
    let derivativeRows = [];
    if (portfolioData.portfolio?.derivative?.length > 0) {
        derivativeRows = await renderDerivativeAssets(portfolioData.portfolio.derivative);
        document.getElementById('derivative-section').style.display = 'block';
    }

    // Update summary cards
    updateSummaryCards(spotRows, derivativeRows);

    // Render Suggested Trades
    if (portfolioData.suggestedTrades?.length > 0) {
        renderSuggestedTrades(portfolioData.suggestedTrades);
        document.getElementById('trades-section').style.display = 'block';
    }

    // Render AI Outlook
    if (portfolioData.aiOutlook?.length > 0) {
        renderAIOutlook(portfolioData.aiOutlook);
        document.getElementById('outlook-section').style.display = 'block';
    }

    // Show summary cards
    document.getElementById('summary-section').style.display = 'grid';

    // Start auto-refresh
    startAutoRefresh();
}

// ============================================
// SUMMARY CARDS
// ============================================

function updateSummaryCards(spotRows, derivativeRows) {
    let totalValue = 0;
    let totalPnl = 0;
    let totalCost = 0;

    // Calculate from spot assets
    spotRows.forEach(row => {
        totalValue += row.totalValue;
        totalPnl += row.pnl;
        totalCost += row.avgPrice * row.amount;
    });

    // Calculate from derivative positions
    derivativeRows.forEach(row => {
        totalValue += row.currentValue;
        totalPnl += row.pnl;
        totalCost += row.opening * Math.abs(row.size); // initial margin
    });

    // Calculate 24h change (weighted average from all positions)
    let weighted24hChange = 0;
    let totalWeight = 0;
    spotRows.forEach(row => {
        weighted24hChange += row.change24h * row.totalValue;
        totalWeight += row.totalValue;
    });
    derivativeRows.forEach(row => {
        weighted24hChange += row.change24h * row.currentValue;
        totalWeight += row.currentValue;
    });
    if (totalWeight > 0) weighted24hChange /= totalWeight;

    // Total portfolio value
    const totalValueEl = document.getElementById('total-value');
    if (totalValueEl) {
        totalValueEl.textContent = '$' + totalValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Total P&L
    const totalPnlEl = document.getElementById('total-pnl');
    const totalPnlSubEl = document.getElementById('total-pnl-pct');
    if (totalPnlEl) {
        totalPnlEl.textContent = (totalPnl >= 0 ? '+' : '') + '$' + totalPnl.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        totalPnlEl.className = 'value ' + (totalPnl >= 0 ? 'price-positive' : 'price-negative');
    }
    if (totalPnlSubEl && totalCost > 0) {
        const pnlPct = ((totalPnl / totalCost) * 100).toFixed(2);
        totalPnlSubEl.textContent = (totalPnl >= 0 ? '+' : '') + pnlPct + '%';
        totalPnlSubEl.className = 'sub ' + (totalPnl >= 0 ? 'price-positive' : 'price-negative');
    }

    // 24h Change
    const change24hEl = document.getElementById('change-24h');
    const change24hSubEl = document.getElementById('change-24h-pct');
    if (change24hEl) {
        const dollarChange = totalValue * (weighted24hChange / 100);
        change24hEl.textContent = (dollarChange >= 0 ? '+' : '') + '$' + Math.abs(dollarChange).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        change24hEl.className = 'value ' + (weighted24hChange >= 0 ? 'price-positive' : 'price-negative');
    }
    if (change24hSubEl) {
        change24hSubEl.textContent = (weighted24hChange >= 0 ? '+' : '') + weighted24hChange.toFixed(2) + '%';
        change24hSubEl.className = 'sub ' + (weighted24hChange >= 0 ? 'price-positive' : 'price-negative');
    }
}

// ============================================
// TIMESTAMP & AUTO-REFRESH
// ============================================

function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('last-updated-text').textContent = `Last updated: ${timeString}`;
}

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(async () => {
        await refreshPrices();
    }, REFRESH_INTERVAL_MS);
}

async function refreshPrices() {
    if (!portfolioData) return;

    let spotRows = [];
    let derivativeRows = [];

    if (portfolioData.portfolio?.spot?.length > 0) {
        spotRows = await renderSpotAssets(portfolioData.portfolio.spot);
    }

    if (portfolioData.portfolio?.derivative?.length > 0) {
        derivativeRows = await renderDerivativeAssets(portfolioData.portfolio.derivative);
    }

    updateSummaryCards(spotRows, derivativeRows);
    updateLastUpdatedTime();
}

async function manualRefresh() {
    const btn = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');

    btn.disabled = true;
    icon.classList.add('refreshing');

    await refreshPrices();

    setTimeout(() => {
        btn.disabled = false;
        icon.classList.remove('refreshing');
    }, 1000);
}

// ============================================
// PRICE FETCHING
// ============================================

async function getCryptoPrice(assetName) {
    try {
        const normalizedName = assetName.toLowerCase().trim();
        const coinId = cryptoIdMap[normalizedName];

        if (!coinId) {
            console.warn(`No CoinGecko ID found for: ${assetName}`);
            return null;
        }

        const response = await fetch(
            `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch price');
        }

        const data = await response.json();
        return {
            price: data[coinId]?.usd || 0,
            change24h: data[coinId]?.usd_24h_change || 0
        };
    } catch (error) {
        console.error(`Error fetching price for ${assetName}:`, error);
        return null;
    }
}

// ============================================
// RENDER — SPOT ASSETS
// ============================================

async function renderSpotAssets(assets) {
    const container = document.getElementById('spot-assets');
    container.innerHTML = '<div class="loading">Loading prices...</div>';

    const assetRows = await Promise.all(assets.map(async (asset) => {
        const priceData = await getCryptoPrice(asset.name);
        const currentPrice = priceData?.price || 0;
        const change24h = priceData?.change24h || 0;
        const totalValue = currentPrice * asset.amount;
        const pnl = totalValue - (asset.avgPrice * asset.amount);
        const pnlPercentage = ((currentPrice - asset.avgPrice) / asset.avgPrice) * 100;

        return {
            icon: asset.icon,
            name: asset.name,
            exchange: asset.exchange,
            amount: asset.amount,
            avgPrice: asset.avgPrice,
            currentPrice: currentPrice,
            change24h: change24h,
            totalValue: totalValue,
            pnl: pnl,
            pnlPercentage: pnlPercentage
        };
    }));

    const tableHTML = `
        <thead>
            <tr>
                <th></th>
                <th>Asset</th>
                <th>Custody</th>
                <th>Amount</th>
                <th>Avg Price</th>
                <th>Current Price</th>
                <th>Total Value</th>
                <th>Unrealized P&L</th>
            </tr>
        </thead>
        <tbody>
            ${assetRows.map(row => `
                <tr>
                    <td class="asset-icon-cell">
                        ${row.icon ? `<img src="${row.icon}" alt="${row.name}" class="asset-icon">` : ''}
                    </td>
                    <td><strong>${row.name}</strong></td>
                    <td>${row.exchange}</td>
                    <td>${row.amount.toFixed(8)}</td>
                    <td>$${row.avgPrice.toLocaleString()}</td>
                    <td class="${row.change24h >= 0 ? 'price-positive' : 'price-negative'}">
                        $${row.currentPrice.toLocaleString()}<br>
                        <small>(${row.change24h >= 0 ? '+' : ''}${row.change24h.toFixed(2)}%)</small>
                    </td>
                    <td>$${row.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="${row.pnl >= 0 ? 'price-positive' : 'price-negative'}">
                        ${row.pnl >= 0 ? '+' : ''}$${row.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
                        <small>(${row.pnlPercentage >= 0 ? '+' : ''}${row.pnlPercentage.toFixed(2)}%)</small>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;

    container.innerHTML = tableHTML;
    return assetRows;
}

// ============================================
// RENDER — DERIVATIVE ASSETS
// ============================================

async function renderDerivativeAssets(assets) {
    const container = document.getElementById('derivative-assets');
    container.innerHTML = '<div class="loading">Loading prices...</div>';

    const assetRows = await Promise.all(assets.map(async (asset) => {
        const priceData = await getCryptoPrice(asset.name.split(' ')[0]);
        const currentPrice = priceData?.price || 0;
        const change24h = priceData?.change24h || 0;
        const pnl = (currentPrice - asset.opening) * asset.size;
        const initialMargin = asset.opening * Math.abs(asset.size);
        const pnlPercentage = initialMargin > 0 ? (pnl / initialMargin) * 100 : 0;
        const currentValue = initialMargin + pnl;

        return {
            icon: asset.icon,
            name: asset.name,
            exchange: asset.exchange,
            size: asset.size,
            opening: asset.opening,
            currentPrice: currentPrice,
            change24h: change24h,
            currentValue: currentValue,
            stop: asset.stop,
            limit: asset.limit,
            pnl: pnl,
            pnlPercentage: pnlPercentage
        };
    }));

    const tableHTML = `
        <thead>
            <tr>
                <th></th>
                <th>Position</th>
                <th>Custody</th>
                <th>Size</th>
                <th>Opening</th>
                <th>Current Price</th>
                <th>Current Value</th>
                <th>Stop Loss</th>
                <th>Take Profit</th>
                <th>Unrealized P&L</th>
            </tr>
        </thead>
        <tbody>
            ${assetRows.map(row => `
                <tr>
                    <td class="asset-icon-cell">
                        ${row.icon ? `<img src="${row.icon}" alt="${row.name}" class="asset-icon">` : ''}
                    </td>
                    <td><strong>${row.name}</strong></td>
                    <td>${row.exchange}</td>
                    <td>${row.size.toFixed(8)}</td>
                    <td>$${row.opening.toLocaleString()}</td>
                    <td class="${row.change24h >= 0 ? 'price-positive' : 'price-negative'}">
                        $${row.currentPrice.toLocaleString()}<br>
                        <small>(${row.change24h >= 0 ? '+' : ''}${row.change24h.toFixed(2)}%)</small>
                    </td>
                    <td>$${row.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${row.stop ? '$' + row.stop.toLocaleString() : '-'}</td>
                    <td>${row.limit ? '$' + row.limit.toLocaleString() : '-'}</td>
                    <td class="${row.pnl >= 0 ? 'price-positive' : 'price-negative'}">
                        ${row.pnl >= 0 ? '+' : ''}$${row.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
                        <small>(${row.pnlPercentage >= 0 ? '+' : ''}${row.pnlPercentage.toFixed(2)}%)</small>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;

    container.innerHTML = tableHTML;
    return assetRows;
}

// ============================================
// RENDER — SUGGESTED TRADES
// ============================================

function renderSuggestedTrades(trades) {
    const container = document.getElementById('suggested-trades');

    const tableHTML = `
        <thead>
            <tr>
                <th>Market</th>
                <th>Direction</th>
                <th>Duration</th>
                <th>Published</th>
                <th>Updated</th>
            </tr>
        </thead>
        <tbody>
            ${trades.map(trade => {
        const publishedDate = new Date(trade.published).toLocaleDateString();
        const updatedDate = trade.updated ? new Date(trade.updated).toLocaleDateString() : '-';

        return `
                    <tr>
                        <td><strong>${trade.market}</strong></td>
                        <td>
                            <span class="direction-badge direction-${trade.direction.toLowerCase()}">
                                ${trade.direction}
                            </span>
                        </td>
                        <td>${trade.duration || '-'}</td>
                        <td>${publishedDate}</td>
                        <td>${updatedDate}</td>
                    </tr>
                `;
    }).join('')}
        </tbody>
    `;

    container.innerHTML = tableHTML;
}

// ============================================
// RENDER — AI OUTLOOK
// ============================================

function renderAIOutlook(outlooks) {
    const container = document.getElementById('ai-outlook');

    const outlookCards = outlooks.map((outlook) => {
        const publishedDate = new Date(outlook.published).toLocaleDateString();
        const updatedDate = outlook.updated ? new Date(outlook.updated).toLocaleDateString() : null;

        return `
            <div class="outlook-card" onclick="openModal('${outlook.imageUrl}')">
                <img src="${outlook.imageUrl}" alt="AI Outlook" class="outlook-image" onerror="this.style.display='none'">
                <div class="outlook-content">
                    <div class="trade-meta">Published: ${publishedDate}</div>
                    ${updatedDate ? `<div class="trade-meta">Updated: ${updatedDate}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = outlookCards;
}

// ============================================
// MODAL
// ============================================

function openModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.classList.add('active');
    modalImg.src = imageUrl;
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('active');
}

// ============================================
// UTILITY
// ============================================

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.innerHTML = `<div class="error">${message}</div>`;
}

function clearError() {
    document.getElementById('error-message').innerHTML = '';
}

function showLoading() {
    hideAllSections();
}

function hideAllSections() {
    document.getElementById('summary-section').style.display = 'none';
    document.getElementById('spot-section').style.display = 'none';
    document.getElementById('derivative-section').style.display = 'none';
    document.getElementById('trades-section').style.display = 'none';
    document.getElementById('outlook-section').style.display = 'none';
}

// ============================================
// INIT
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
});
