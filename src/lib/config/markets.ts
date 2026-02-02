/**
 * Market configuration - sectors, commodities, stocks
 */

export interface SectorConfig {
	symbol: string;
	name: string;
}

export interface CommodityConfig {
	symbol: string;
	name: string;
	display: string;
}

export const SECTORS: SectorConfig[] = [
	{ symbol: 'XLK', name: 'Tech' },
	{ symbol: 'XLF', name: 'Finance' },
	{ symbol: 'XLE', name: 'Energy' },
	{ symbol: 'XLV', name: 'Health' },
	{ symbol: 'XLY', name: 'Consumer' },
	{ symbol: 'XLI', name: 'Industrial' },
	{ symbol: 'XLP', name: 'Staples' },
	{ symbol: 'XLU', name: 'Utilities' },
	{ symbol: 'XLB', name: 'Materials' },
	{ symbol: 'XLRE', name: 'Real Est' },
	{ symbol: 'XLC', name: 'Comms' },
	{ symbol: 'SMH', name: 'Semis' }
];

export const COMMODITIES: CommodityConfig[] = [
	{ symbol: '^VIX', name: 'VIX', display: 'VIX' },
	{ symbol: 'GC=F', name: 'Gold', display: 'GOLD' },
	{ symbol: 'CL=F', name: 'Crude Oil', display: 'OIL' },
	{ symbol: 'NG=F', name: 'Natural Gas', display: 'NATGAS' },
	{ symbol: 'SI=F', name: 'Silver', display: 'SILVER' },
	{ symbol: 'HG=F', name: 'Copper', display: 'COPPER' }
];

/** Extended list for "add commodity" picker (default 6 + optional) */
export const COMMODITY_OPTIONS: CommodityConfig[] = [
	...COMMODITIES,
	{ symbol: 'PL=F', name: 'Platinum', display: 'PLAT' },
	{ symbol: 'PA=F', name: 'Palladium', display: 'PALL' },
	{ symbol: 'ZW=F', name: 'Wheat', display: 'WHEAT' },
	{ symbol: 'ZC=F', name: 'Corn', display: 'CORN' },
	{ symbol: 'SB=F', name: 'Sugar', display: 'SUGAR' }
];

// Major stock indices
export const INDICES = [
	{ symbol: '^DJI', name: 'Dow Jones', display: 'DOW' },
	{ symbol: '^GSPC', name: 'S&P 500', display: 'S&P' },
	{ symbol: '^IXIC', name: 'NASDAQ', display: 'NDQ' },
	{ symbol: '^RUT', name: 'Russell 2000', display: 'RUT' }
];

// Crypto assets tracked (default list; user can add/remove via panel)
export const CRYPTO = [
	{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
	{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
	{ id: 'solana', symbol: 'SOL', name: 'Solana' },
	{ id: 'chainlink', symbol: 'LINK', name: 'Chainlink' }
];

export interface CryptoOption {
	id: string;
	symbol: string;
	name: string;
}

// Extended list for "add coin" picker (CoinGecko ids)
export const CRYPTO_OPTIONS: CryptoOption[] = [
	...CRYPTO,
	{ id: 'tether', symbol: 'USDT', name: 'Tether' },
	{ id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
	{ id: 'ripple', symbol: 'XRP', name: 'XRP' },
	{ id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
	{ id: 'cardano', symbol: 'ADA', name: 'Cardano' },
	{ id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
	{ id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
	{ id: 'tron', symbol: 'TRX', name: 'TRON' },
	{ id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
	{ id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon' },
	{ id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
	{ id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
	{ id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash' },
	{ id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
	{ id: 'stellar', symbol: 'XLM', name: 'Stellar' },
	{ id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
	{ id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
	{ id: 'aptos', symbol: 'APT', name: 'Aptos' },
	{ id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
	{ id: 'optimism', symbol: 'OP', name: 'Optimism' },
	{ id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' },
	{ id: 'injective-protocol', symbol: 'INJ', name: 'Injective' },
	{ id: 'sui', symbol: 'SUI', name: 'Sui' },
	{ id: 'render-token', symbol: 'RNDR', name: 'Render' },
	{ id: 'fetch-ai', symbol: 'FET', name: 'Fetch.ai' },
	{ id: 'the-graph', symbol: 'GRT', name: 'The Graph' },
	{ id: 'pepe', symbol: 'PEPE', name: 'Pepe' },
	{ id: 'wrapped-bitcoin', symbol: 'WBTC', name: 'Wrapped Bitcoin' }
];
