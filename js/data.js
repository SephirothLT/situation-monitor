// data.js - All data fetching functions

import { CORS_PROXIES, ALERT_KEYWORDS, SECTORS, COMMODITIES, INTEL_SOURCES, AI_FEEDS } from './constants.js';

// Fetch with proxy fallback
export async function fetchWithProxy(url) {
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        try {
            const proxy = CORS_PROXIES[i];
            const response = await fetch(proxy + encodeURIComponent(url), {
                headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
            });
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            console.log(`Proxy ${i} failed, trying next...`);
        }
    }
    throw new Error('All proxies failed');
}

// Check for alert keywords
export function hasAlertKeyword(title) {
    const lower = title.toLowerCase();
    return ALERT_KEYWORDS.some(kw => lower.includes(kw));
}

// Parse RSS feed
export async function fetchFeed(source) {
    try {
        const text = await fetchWithProxy(source.url);
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');

        const parseError = xml.querySelector('parsererror');
        if (parseError) {
            console.error(`Parse error for ${source.name}`);
            return [];
        }

        let items = xml.querySelectorAll('item');
        if (items.length === 0) {
            items = xml.querySelectorAll('entry');
        }

        return Array.from(items).slice(0, 5).map(item => {
            let link = '';
            const linkEl = item.querySelector('link');
            if (linkEl) {
                link = linkEl.getAttribute('href') || linkEl.textContent || '';
            }
            link = link.trim();

            const title = (item.querySelector('title')?.textContent || 'No title').trim();
            const pubDate = item.querySelector('pubDate')?.textContent ||
                           item.querySelector('published')?.textContent ||
                           item.querySelector('updated')?.textContent || '';

            return {
                source: source.name,
                title,
                link,
                pubDate,
                isAlert: hasAlertKeyword(title)
            };
        });
    } catch (error) {
        console.error(`Error fetching ${source.name}:`, error);
        return [];
    }
}

// Fetch all feeds for a category
export async function fetchCategory(feeds) {
    const results = await Promise.all(feeds.map(fetchFeed));
    const items = results.flat();

    items.sort((a, b) => {
        // Alerts first, then by date
        if (a.isAlert && !b.isAlert) return -1;
        if (!a.isAlert && b.isAlert) return 1;
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateB - dateA;
    });

    return items.slice(0, 20);
}

// Fetch stock quote from Yahoo Finance
export async function fetchQuote(symbol) {
    try {
        const text = await fetchWithProxy(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
        const data = JSON.parse(text);
        if (data.chart?.result?.[0]) {
            const meta = data.chart.result[0].meta;
            const change = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100;
            return { price: meta.regularMarketPrice, change };
        }
    } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
    }
    return null;
}

// Fetch market data (stocks + crypto)
export async function fetchMarkets() {
    const markets = [];

    const symbols = [
        { symbol: '^GSPC', name: 'S&P 500', display: 'SPX' },
        { symbol: '^DJI', name: 'Dow Jones', display: 'DJI' },
        { symbol: '^IXIC', name: 'NASDAQ', display: 'NDX' },
        { symbol: 'AAPL', name: 'Apple', display: 'AAPL' },
        { symbol: 'MSFT', name: 'Microsoft', display: 'MSFT' },
        { symbol: 'NVDA', name: 'NVIDIA', display: 'NVDA' },
        { symbol: 'GOOGL', name: 'Alphabet', display: 'GOOGL' },
        { symbol: 'AMZN', name: 'Amazon', display: 'AMZN' },
        { symbol: 'META', name: 'Meta', display: 'META' },
        { symbol: 'BRK-B', name: 'Berkshire', display: 'BRK.B' },
        { symbol: 'TSM', name: 'TSMC', display: 'TSM' },
        { symbol: 'LLY', name: 'Eli Lilly', display: 'LLY' },
        { symbol: 'TSLA', name: 'Tesla', display: 'TSLA' },
        { symbol: 'AVGO', name: 'Broadcom', display: 'AVGO' },
        { symbol: 'WMT', name: 'Walmart', display: 'WMT' },
        { symbol: 'JPM', name: 'JPMorgan', display: 'JPM' },
        { symbol: 'V', name: 'Visa', display: 'V' },
        { symbol: 'UNH', name: 'UnitedHealth', display: 'UNH' },
        { symbol: 'NVO', name: 'Novo Nordisk', display: 'NVO' },
        { symbol: 'XOM', name: 'Exxon', display: 'XOM' },
        { symbol: 'MA', name: 'Mastercard', display: 'MA' },
        { symbol: 'ORCL', name: 'Oracle', display: 'ORCL' },
        { symbol: 'PG', name: 'P&G', display: 'PG' },
        { symbol: 'COST', name: 'Costco', display: 'COST' },
        { symbol: 'JNJ', name: 'J&J', display: 'JNJ' },
        { symbol: 'HD', name: 'Home Depot', display: 'HD' },
        { symbol: 'NFLX', name: 'Netflix', display: 'NFLX' },
        { symbol: 'BAC', name: 'BofA', display: 'BAC' }
    ];

    const fetchStock = async (s) => {
        const quote = await fetchQuote(s.symbol);
        if (quote) {
            return { name: s.name, symbol: s.display, price: quote.price, change: quote.change };
        }
        return null;
    };

    const stockResults = await Promise.all(symbols.map(fetchStock));
    stockResults.forEach(r => { if (r) markets.push(r); });

    // Crypto
    try {
        const cryptoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
        const crypto = await cryptoResponse.json();

        if (crypto.bitcoin) markets.push({ name: 'Bitcoin', symbol: 'BTC', price: crypto.bitcoin.usd, change: crypto.bitcoin.usd_24h_change });
        if (crypto.ethereum) markets.push({ name: 'Ethereum', symbol: 'ETH', price: crypto.ethereum.usd, change: crypto.ethereum.usd_24h_change });
        if (crypto.solana) markets.push({ name: 'Solana', symbol: 'SOL', price: crypto.solana.usd, change: crypto.solana.usd_24h_change });
    } catch (error) {
        console.error('Error fetching crypto:', error);
    }

    return markets;
}

// Fetch sector heatmap data
export async function fetchSectors() {
    const results = await Promise.all(SECTORS.map(async (s) => {
        const quote = await fetchQuote(s.symbol);
        if (quote) {
            return { name: s.name, symbol: s.symbol, change: quote.change };
        }
        return { name: s.name, symbol: s.symbol, change: 0 };
    }));
    return results;
}

// Fetch commodities and VIX
export async function fetchCommodities() {
    const results = [];
    for (const c of COMMODITIES) {
        const quote = await fetchQuote(c.symbol);
        if (quote) {
            results.push({ name: c.name, symbol: c.display, price: quote.price, change: quote.change });
        }
    }
    return results;
}

// Fetch flight data from OpenSky Network
export async function fetchFlightData(bounds = null) {
    try {
        let url = 'https://opensky-network.org/api/states/all';
        if (bounds) {
            url += `?lamin=${bounds.south}&lomin=${bounds.west}&lamax=${bounds.north}&lomax=${bounds.east}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Flight API error');

        const data = await response.json();
        if (!data.states) return [];

        return data.states.slice(0, 100).map(state => ({
            icao24: state[0],
            callsign: (state[1] || '').trim(),
            country: state[2],
            lat: state[6],
            lon: state[5],
            altitude: state[7],
            heading: state[10],
            velocity: state[9],
            onGround: state[8]
        })).filter(f => f.lat && f.lon && !f.onGround);
    } catch (error) {
        console.error('Error fetching flight data:', error);
        return [];
    }
}

// Fetch congressional trades
export async function fetchCongressTrades() {
    // Uses proxy to fetch from House Stock Watcher or similar
    try {
        const response = await fetchWithProxy('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json');
        const data = JSON.parse(response);

        // Get last 20 trades
        return data.slice(-20).reverse().map(t => ({
            name: t.representative,
            party: t.party === 'Democrat' ? 'D' : 'R',
            ticker: t.ticker,
            action: t.type.includes('Sale') ? 'SELL' : 'BUY',
            amount: t.amount,
            date: t.transaction_date
        }));
    } catch (error) {
        console.error('Error fetching congress trades:', error);
        return [];
    }
}

// Fetch whale transactions (crypto)
export async function fetchWhaleTransactions() {
    try {
        // This would normally use a whale alert API
        // For now return mock data structure
        return [];
    } catch (error) {
        console.error('Error fetching whale transactions:', error);
        return [];
    }
}

// Fetch government contracts
export async function fetchGovContracts() {
    try {
        // Would use USASpending.gov API
        return [];
    } catch (error) {
        console.error('Error fetching gov contracts:', error);
        return [];
    }
}

// Fetch AI news from major AI companies
export async function fetchAINews() {
    const results = await Promise.all(AI_FEEDS.map(async (source) => {
        try {
            const text = await fetchWithProxy(source.url);
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            let items = xml.querySelectorAll('item');
            if (items.length === 0) items = xml.querySelectorAll('entry');

            return Array.from(items).slice(0, 3).map(item => {
                let link = '';
                const linkEl = item.querySelector('link');
                if (linkEl) link = linkEl.getAttribute('href') || linkEl.textContent || '';

                return {
                    source: source.name,
                    title: item.querySelector('title')?.textContent?.trim() || 'No title',
                    link: link.trim(),
                    date: item.querySelector('pubDate')?.textContent ||
                          item.querySelector('published')?.textContent || ''
                };
            });
        } catch (e) {
            console.log(`Failed to fetch ${source.name}`);
            return [];
        }
    }));

    return results.flat().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
}

// Fetch Fed balance sheet from FRED
export async function fetchFedBalance() {
    try {
        const text = await fetchWithProxy('https://api.stlouisfed.org/fred/series/observations?series_id=WALCL&sort_order=desc&limit=10&file_type=json&api_key=DEMO');
        const data = JSON.parse(text);

        if (data.observations && data.observations.length >= 2) {
            const latest = parseFloat(data.observations[0].value);
            const previous = parseFloat(data.observations[1].value);
            const change = latest - previous;
            const changePercent = (change / previous) * 100;

            return {
                value: latest / 1000000,
                change: change / 1000000,
                changePercent,
                date: data.observations[0].date,
                percentOfMax: (latest / 9000000) * 100
            };
        }
    } catch (error) {
        console.error('Error fetching Fed balance:', error);
    }

    return {
        value: 6.8,
        change: 0,
        changePercent: 0,
        date: new Date().toISOString().split('T')[0],
        percentOfMax: 75
    };
}

// Fetch Polymarket data
export async function fetchPolymarket() {
    try {
        // Would use Polymarket API
        return [];
    } catch (error) {
        console.error('Error fetching Polymarket:', error);
        return [];
    }
}

// Fetch earthquake data from USGS
export async function fetchEarthquakes() {
    try {
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson');
        const data = await response.json();

        return data.features.map(f => ({
            id: f.id,
            magnitude: f.properties.mag,
            place: f.properties.place,
            time: new Date(f.properties.time),
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            depth: f.geometry.coordinates[2]
        }));
    } catch (error) {
        console.error('Error fetching earthquakes:', error);
        return [];
    }
}

// Fetch layoffs data
export async function fetchLayoffs() {
    try {
        // Would use layoffs.fyi API or similar
        return [];
    } catch (error) {
        console.error('Error fetching layoffs:', error);
        return [];
    }
}

// Fetch situation-specific news
export async function fetchSituationNews(keywords, limit = 5) {
    // Filter from existing news based on keywords
    return [];
}

// Fetch Intel feed (combines multiple intel sources)
export async function fetchIntelFeed() {
    const results = await Promise.all(INTEL_SOURCES.map(fetchFeed));
    const items = results.flat();

    items.sort((a, b) => {
        if (a.isAlert && !b.isAlert) return -1;
        if (!a.isAlert && b.isAlert) return 1;
        return new Date(b.pubDate) - new Date(a.pubDate);
    });

    return items.slice(0, 30);
}
