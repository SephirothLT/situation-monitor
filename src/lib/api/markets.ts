/**
 * Markets API - Fetch market data from Finnhub
 *
 * Get your free API key at: https://finnhub.io/
 * Free tier: 60 calls/minute
 */

import { base } from '$app/paths';
import {
	INDICES,
	SECTORS,
	COMMODITIES,
	CRYPTO,
	type CryptoOption,
	type CommodityConfig,
	type IndexConfig
} from '$lib/config/markets';
import type { MarketItem, SectorPerformance, CryptoItem } from '$lib/types';
import { fetchWithProxy, logger, FINNHUB_API_KEY, FINNHUB_BASE_URL } from '$lib/config/api';

const apiBase = base || '';

interface CoinGeckoPrice {
	usd: number;
	usd_24h_change?: number;
}

interface CoinGeckoPricesResponse {
	[key: string]: CoinGeckoPrice;
}

interface FinnhubQuote {
	c: number; // Current price
	d: number; // Change
	dp: number; // Percent change
	h: number; // High price of the day
	l: number; // Low price of the day
	o: number; // Open price of the day
	pc: number; // Previous close price
	t: number; // Timestamp
}

/**
 * Check if Finnhub API key is configured
 */
function hasFinnhubApiKey(): boolean {
	return Boolean(FINNHUB_API_KEY && FINNHUB_API_KEY.length > 0);
}

/**
 * Create an empty market item (used for error/missing data states)
 */
function createEmptyMarketItem<T extends 'index' | 'commodity'>(
	symbol: string,
	name: string,
	type: T
): MarketItem {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN, type };
}

/**
 * Create an empty sector performance item
 */
function createEmptySectorItem(symbol: string, name: string): SectorPerformance {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN };
}

// Map index symbols to ETF proxies (free tier doesn't support direct indices)
const INDEX_ETF_MAP: Record<string, string> = {
	'^DJI': 'DIA', // Dow Jones -> SPDR Dow Jones ETF
	'^GSPC': 'SPY', // S&P 500 -> SPDR S&P 500 ETF
	'^IXIC': 'QQQ', // NASDAQ -> Invesco QQQ (NASDAQ-100)
	'^RUT': 'IWM' // Russell 2000 -> iShares Russell 2000 ETF
};

/**
 * Fetch a quote from Finnhub.
 * Uses CORS proxy in browser so Finnhub responses are not blocked.
 */
async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
	try {
		const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
		const response = await fetchWithProxy(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: FinnhubQuote = await response.json();

		// Finnhub returns all zeros when symbol not found
		if (data.c === 0 && data.pc === 0) {
			return null;
		}

		return data;
	} catch (error) {
		logger.error('Markets API', `Error fetching quote for ${symbol}:`, error);
		return null;
	}
}

type EastmoneyQuote = {
	price: number;
	change: number;
	pct: number;
	high: number;
	low: number;
	open: number;
	prevClose: number;
};

/**
 * Fetch quote from Eastmoney (no API key, used for China A-shares fallback).
 * Returns price data in normal decimals (CNY), not fen.
 * Tries server proxy (/api/eastmoney) first, then api.allorigins.win for static deploy.
 */
async function fetchEastmoneyQuote(symbol: string): Promise<EastmoneyQuote | null> {
	// Accept raw 6-digit, or suffix .SS/.SZ
	const raw = symbol.replace(/\.SS$/i, '').replace(/\.SZ$/i, '').trim();
	if (!/^\d{6}$/.test(raw)) return null;
	const market = raw.startsWith('6') ? '1' : raw.startsWith('0') || raw.startsWith('3') ? '0' : null;
	if (!market) return null;

	const secid = `${market}.${raw}`;
	const target = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f169,f170,f44,f45,f46,f47,f48,f58,f60`;

	const parseEastmoneyResponse = (data: unknown): EastmoneyQuote | null => {
		const obj = data as {
			data?: {
				f43?: number;
				f169?: number;
				f170?: number;
				f44?: number;
				f45?: number;
				f46?: number;
				f60?: number;
			};
		};
		const d = obj?.data;
		if (!d || typeof d.f43 !== 'number') return null;
		const toPrice = (v?: number) => (typeof v === 'number' ? v / 100 : NaN);
		return {
			price: toPrice(d.f43),
			change: toPrice(d.f169),
			pct: toPrice(d.f170),
			high: toPrice(d.f44),
			low: toPrice(d.f45),
			open: toPrice(d.f46),
			prevClose: toPrice(d.f60)
		};
	};

	// 1. Prefer our API route (works in dev and on Vercel; avoids 403 from Eastmoney)
	try {
		const res = await fetch(`/api/eastmoney?secid=${encodeURIComponent(secid)}`);
		if (res.ok) {
			const data = await res.json();
			const parsed = parseEastmoneyResponse(data);
			if (parsed) return parsed;
		}
	} catch {
		// Fall through to public proxy
	}

	// 2. Fallback for static deploy: api.allorigins.win (corsproxy.io often returns 403 for Eastmoney)
	try {
		const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
		const res = await fetch(proxyUrl);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();
		return parseEastmoneyResponse(data);
	} catch (error) {
		logger.warn('Markets API', 'Eastmoney quote failed', symbol, error);
		return null;
	}
}

/** CoinGecko: prefer server proxy (cached), fallback to direct URL for static deploy or when proxy fails */
const COINGECKO_PROXY = `${apiBase}/api/coingecko/simple-price`;
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

let lastCryptoSuccess: CryptoItem[] | null = null;

/**
 * Fetch crypto prices. Tries server proxy first; on failure falls back to fetchWithProxy(CoinGecko).
 * @param coins - List of { id, symbol, name } (CoinGecko id). If not provided, uses CRYPTO from config.
 */
export async function fetchCryptoPrices(coins?: CryptoOption[]): Promise<CryptoItem[]> {
	const list = coins && coins.length > 0 ? coins : CRYPTO;
	const ids = list.map((c) => c.id).join(',');
	const proxyUrl = `${COINGECKO_PROXY}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
	const directUrl = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

	function mapResponse(data: CoinGeckoPricesResponse): CryptoItem[] {
		return list.map((crypto) => {
			const priceData = data[crypto.id];
			const usd = priceData?.usd;
			const change = priceData?.usd_24h_change;
			return {
				id: crypto.id,
				symbol: crypto.symbol,
				name: crypto.name,
				current_price: typeof usd === 'number' ? usd : 0,
				price_change_24h: typeof change === 'number' ? change : 0,
				price_change_percentage_24h: typeof change === 'number' ? change : 0
			};
		});
	}

	function parseAndMap(res: Response): Promise<CryptoItem[] | null> {
		return res.json().then((data: CoinGeckoPricesResponse) => {
			if (data && typeof data === 'object' && !('error' in data) && Object.keys(data).length > 0) {
				return mapResponse(data);
			}
			return null;
		});
	}

	// 1. Try server proxy (works in dev / Node deploy; reduces 429)
	try {
		const response = await fetch(proxyUrl);
		let parsedMapped1: CryptoItem[] | null = null;
		if (response.ok) parsedMapped1 = await parseAndMap(response);
		if (response.ok && parsedMapped1) {
			lastCryptoSuccess = parsedMapped1;
			return parsedMapped1;
		}
	} catch (_) {
		// Proxy unavailable (e.g. static build): fall through to direct
	}

	// 2. Fallback: CORS proxy to CoinGecko
	try {
		const response = await fetchWithProxy(directUrl);
		let parsedMapped2: CryptoItem[] | null = null;
		if (response.ok) parsedMapped2 = await parseAndMap(response);
		if (response.ok && parsedMapped2) {
			lastCryptoSuccess = parsedMapped2;
			return parsedMapped2;
		}
	} catch (error) {
		logger.error('Markets API', 'CoinGecko fetch failed:', error);
	}

	// 3. Fallback: CoinMarketCap via server proxy (when API key configured on server)
	try {
		const symbols = list.map((c) => c.symbol).join(',');
		const cmcProxyUrl = `${apiBase}/api/coinmarketcap/quotes?symbol=${encodeURIComponent(symbols)}`;
		const response = await fetch(cmcProxyUrl);
		let cmcDataKeys: string[] = [];
		let cmcItemsLen: number | null = null;
		let cmcFirstPrice: number | null = null;
		if (response.ok) {
			const json = await response.json();
			const data = json?.data as Record<string, { symbol?: string; quote?: { USD?: { price?: number; percent_change_24h?: number } } }> | undefined;
			cmcDataKeys = data && typeof data === 'object' ? Object.keys(data) : [];
			if (data && typeof data === 'object' && Object.keys(data).length > 0) {
				// CMC may key by symbol ("BTC") or by id ("1", "1027"); find by symbol
				const bySymbol = (sym: string) =>
					data[sym] ?? Object.values(data).find((v) => v?.symbol === sym);
				const items: CryptoItem[] = list.map((crypto) => {
					const raw = bySymbol(crypto.symbol);
					const usd = raw?.quote?.USD;
					const price = typeof usd?.price === 'number' ? usd.price : 0;
					const change =
						typeof usd?.percent_change_24h === 'number' ? usd.percent_change_24h : 0;
					return {
						id: crypto.id,
						symbol: crypto.symbol,
						name: crypto.name,
						current_price: price,
						price_change_24h: change,
						price_change_percentage_24h: change
					};
				});
				cmcItemsLen = items.length;
				cmcFirstPrice = items[0]?.current_price ?? null;
				lastCryptoSuccess = items;
				return items;
			}
		}
	} catch (error) {
		logger.warn('Markets API', 'CoinMarketCap fallback failed:', error);
	}

	if (lastCryptoSuccess && lastCryptoSuccess.length > 0) {
		return lastCryptoSuccess;
	}

	return list.map((c) => ({
		id: c.id,
		symbol: c.symbol,
		name: c.name,
		current_price: 0,
		price_change_24h: 0,
		price_change_percentage_24h: 0
	}));
}

/**
 * Fetch market indices from Finnhub.
 * @param indicesConfig - List from indicesList.getSelectedConfig(). If omitted, uses INDICES default.
 */
export async function fetchIndices(indicesConfig?: IndexConfig[]): Promise<MarketItem[]> {
	const list = indicesConfig && indicesConfig.length > 0 ? indicesConfig : INDICES;
	const createEmptyIndices = () =>
		list.map((i) => createEmptyMarketItem(i.symbol, i.name, 'index'));

	if (!hasFinnhubApiKey()) {
		logger.warn('Markets API', 'Finnhub API key not configured. Add VITE_FINNHUB_API_KEY to .env');
		return createEmptyIndices();
	}

	try {
		logger.log('Markets API', 'Fetching indices from Finnhub');

		const resolveSymbol = (index: IndexConfig) => {
			const baseSymbol = INDEX_ETF_MAP[index.symbol] || index.symbol;
			// China A-share mapping: 6xxxxx -> SSE (.SS), 0/3xxxxx -> SZ (.SZ)
			if (/^\d{6}$/.test(baseSymbol)) {
				if (baseSymbol.startsWith('6')) return `${baseSymbol}.SS`;
				if (baseSymbol.startsWith('0') || baseSymbol.startsWith('3')) return `${baseSymbol}.SZ`;
			}
			return baseSymbol;
		};

		const isChinaASymbol = (symbol: string) => {
			const raw = symbol.replace(/\.SS$/i, '').replace(/\.SZ$/i, '');
			return /^\d{6}$/.test(raw);
		};

		const items = await Promise.all(
			list.map(async (index) => {
				const fetchSymbol = resolveSymbol(index);
				const isChinaA = isChinaASymbol(fetchSymbol);

				// Prefer Eastmoney for China A to avoid Finnhub free-tier limitations
				if (isChinaA) {
					const cnQuote = await fetchEastmoneyQuote(fetchSymbol);
					if (cnQuote) {
						return {
							symbol: index.symbol,
							name: index.name,
							price: cnQuote.price,
							change: cnQuote.change,
							changePercent: cnQuote.pct,
							type: 'index' as const
						};
					}
				}

				const quote = await fetchFinnhubQuote(fetchSymbol);
				return {
					symbol: index.symbol,
					name: index.name,
					price: quote?.c ?? NaN,
					change: quote?.d ?? NaN,
					changePercent: quote?.dp ?? NaN,
					type: 'index' as const
				};
			})
		);

		return items;
	} catch (error) {
		logger.error('Markets API', 'Error fetching indices:', error);
		return createEmptyIndices();
	}
}

/**
 * Fetch sector performance from Finnhub (using sector ETFs)
 */
export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
	const createEmptySectors = () => SECTORS.map((s) => createEmptySectorItem(s.symbol, s.name));

	if (!hasFinnhubApiKey()) {
		logger.warn('Markets API', 'Finnhub API key not configured');
		return createEmptySectors();
	}

	try {
		logger.log('Markets API', 'Fetching sector performance from Finnhub');

		const quotes = await Promise.all(
			SECTORS.map(async (sector) => {
				const quote = await fetchFinnhubQuote(sector.symbol);
				return { sector, quote };
			})
		);

		return quotes.map(({ sector, quote }) => ({
			symbol: sector.symbol,
			name: sector.name,
			price: quote?.c ?? NaN,
			change: quote?.d ?? NaN,
			changePercent: quote?.dp ?? NaN
		}));
	} catch (error) {
		logger.error('Markets API', 'Error fetching sectors:', error);
		return createEmptySectors();
	}
}

// Finnhub commodity ETF proxies (free tier doesn't support direct commodities)
const COMMODITY_SYMBOL_MAP: Record<string, string> = {
	'^VIX': 'VIXY', // VIX -> ProShares VIX Short-Term Futures ETF
	'GC=F': 'GLD', // Gold -> SPDR Gold Shares
	'CL=F': 'USO', // Crude Oil -> United States Oil Fund
	'NG=F': 'UNG', // Natural Gas -> United States Natural Gas Fund
	'SI=F': 'SLV', // Silver -> iShares Silver Trust
	'HG=F': 'CPER', // Copper -> United States Copper Index Fund
	'PL=F': 'PPLT', // Platinum -> Aberdeen Physical Platinum
	'PA=F': 'PALL', // Palladium -> Aberdeen Physical Palladium
	'ZW=F': 'WEAT', // Wheat -> Teucrium Wheat
	'ZC=F': 'CORN', // Corn -> Teucrium Corn
	'SB=F': 'CANE' // Sugar -> Teucrium Sugar
};

/**
 * Fetch commodities from Finnhub.
 * @param commodityConfigs - List to fetch (from commodityList.getSelectedConfig()). If omitted, uses COMMODITIES default.
 */
export async function fetchCommodities(
	commodityConfigs?: CommodityConfig[]
): Promise<MarketItem[]> {
	const list = commodityConfigs && commodityConfigs.length > 0 ? commodityConfigs : COMMODITIES;
	const createEmptyCommodities = () =>
		list.map((c) => createEmptyMarketItem(c.symbol, c.name, 'commodity'));

	if (!hasFinnhubApiKey()) {
		logger.warn('Markets API', 'Finnhub API key not configured');
		return createEmptyCommodities();
	}

	try {
		logger.log('Markets API', 'Fetching commodities from Finnhub');

		const results = await Promise.allSettled(
			list.map(async (commodity) => {
				const finnhubSymbol = COMMODITY_SYMBOL_MAP[commodity.symbol] || commodity.symbol;
				const quote = await fetchFinnhubQuote(finnhubSymbol);
				return { commodity, quote };
			})
		);

		return results.map((result, i) => {
			const commodity = list[i];
			if (result.status === 'rejected') {
				logger.warn('Markets API', `Commodity ${commodity.symbol} failed:`, result.reason);
				return createEmptyMarketItem(commodity.symbol, commodity.name, 'commodity');
			}
			const { quote } = result.value;
			return {
				symbol: commodity.symbol,
				name: commodity.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN,
				type: 'commodity' as const
			};
		});
	} catch (error) {
		logger.error('Markets API', 'Error fetching commodities:', error);
		return createEmptyCommodities();
	}
}

interface AllMarketsData {
	crypto: CryptoItem[];
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
}

/**
 * Fetch all market data.
 * @param cryptoCoins - Optional list of coins for crypto panel (from cryptoList.getSelectedConfig()). If omitted, uses config default.
 * @param commodityConfigs - Optional list of commodities (from commodityList.getSelectedConfig()). If omitted, uses config default.
 */
export async function fetchAllMarkets(
	cryptoCoins?: CryptoOption[],
	commodityConfigs?: CommodityConfig[],
	indicesConfig?: IndexConfig[]
): Promise<AllMarketsData> {
	// #region agent log
	const start = Date.now();
	fetch('http://127.0.0.1:7244/ingest/5d47d990-42fd-4918-bfab-27629ad4e356', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'markets.ts:fetchAllMarkets',
			message: 'start',
			data: {
				cryptoCount: cryptoCoins?.length ?? null,
				commodityCount: commodityConfigs?.length ?? null,
				indicesCount: indicesConfig?.length ?? null
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			hypothesisId: 'A'
		})
	}).catch(() => {});
	// #endregion
	const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
		const t0 = Date.now();
		const result = await fn();
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/5d47d990-42fd-4918-bfab-27629ad4e356', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'markets.ts:fetchAllMarkets',
				message: 'source done',
				data: { label, durationMs: Date.now() - t0 },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				hypothesisId: 'B'
			})
		}).catch(() => {});
		// #endregion
		return result;
	};
	const [crypto, indices, sectors, commodities] = await Promise.all([
		timed('crypto', () => fetchCryptoPrices(cryptoCoins)),
		timed('indices', () => fetchIndices(indicesConfig)),
		timed('sectors', () => fetchSectorPerformance()),
		timed('commodities', () => fetchCommodities(commodityConfigs))
	]);
	// #region agent log
	fetch('http://127.0.0.1:7244/ingest/5d47d990-42fd-4918-bfab-27629ad4e356', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'markets.ts:fetchAllMarkets',
			message: 'end',
			data: { durationMs: Date.now() - start },
			timestamp: Date.now(),
			sessionId: 'debug-session',
			hypothesisId: 'C'
		})
	}).catch(() => {});
	// #endregion

	return { crypto, indices, sectors, commodities };
}
