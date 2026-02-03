/**
 * Miscellaneous API functions for specialized panels
 * Note: Some of these use mock data as the original APIs require authentication
 */

import {
	ETHERSCAN_API_BASE,
	ETHERSCAN_API_KEY,
	fetchWithProxy,
	INTELLIZENCE_API_KEY,
	INTELLIZENCE_LAYOFF_URL
} from '$lib/config/api';

export interface Prediction {
	id: string;
	question: string;
	yes: number;
	volume: string;
	/** Polymarket event URL when from Gamma API */
	url?: string;
}

export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
	/** Sender address (whale address when monitoring) */
	fromAddress?: string;
	/** Receiver address */
	toAddress?: string;
}

/** Per-address balance (mock or from chain). */
export interface WhaleBalance {
	address: string;
	totalUsd: number;
	coins: { coin: string; amount: number; usd: number }[];
}

export interface Contract {
	agency: string;
	description: string;
	vendor: string;
	amount: number;
	/** USASpending.gov award detail URL when from API */
	url?: string;
}

export interface Layoff {
	company: string;
	count: number;
	title: string;
	date: string;
	/** Source article URL (e.g. layoffs.fyi post) */
	url?: string;
}

const WHALE_MOCK_COINS = ['BTC', 'ETH', 'SOL'] as const;
const WHALE_MOCK_USD_PER_UNIT: Record<string, number> = {
	BTC: 100000,
	ETH: 3400,
	SOL: 150
};
const WHALE_ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const WHALE_MAX_ETH_ADDRESSES = 5;
const WHALE_TX_PER_ADDRESS = 15;
const WEI_PER_ETH = 1e18;

function mockHash(): string {
	return (
		'0x' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
	);
}

function isEthAddress(addr: string): boolean {
	return WHALE_ETH_ADDRESS_REGEX.test((addr || '').trim());
}

/** Etherscan txlist result item */
interface EtherscanTx {
	hash?: string;
	from?: string;
	to?: string;
	value?: string;
	timeStamp?: string;
}

const COINGECKO_ETH_PRICE_URL =
	'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

/** Fetch current ETH price (USD) from CoinGecko for whale USD conversion. Uses proxy fallback if direct fetch fails (e.g. CORS). */
async function getEthPriceUsd(): Promise<number> {
	try {
		let res = await fetch(COINGECKO_ETH_PRICE_URL, { cache: 'no-store' });
		if (!res.ok) {
			try {
				res = await fetchWithProxy(COINGECKO_ETH_PRICE_URL);
			} catch {
				return 3000;
			}
		}
		if (!res.ok) return 3000;
		const data = (await res.json()) as { ethereum?: { usd?: number } };
		const price = data?.ethereum?.usd;
		return typeof price === 'number' && price > 0 ? price : 3000;
	} catch {
		return 3000;
	}
}

/**
 * Fetch whale transactions: when VITE_ETHERSCAN_API_KEY is set and addresses include ETH (0x…), use Etherscan txlist;
 * otherwise mock data.
 */
export async function fetchWhaleTransactions(addresses?: string[]): Promise<WhaleTransaction[]> {
	const addrs = addresses && addresses.length > 0 ? addresses : [];
	const ethAddrs = addrs.filter(isEthAddress).slice(0, WHALE_MAX_ETH_ADDRESSES);

	if (ETHERSCAN_API_KEY.trim() && ethAddrs.length > 0) {
		try {
			const ethPrice = await getEthPriceUsd();
			const out: WhaleTransaction[] = [];
			for (const address of ethAddrs) {
				const params = new URLSearchParams({
					chainid: '1',
					module: 'account',
					action: 'txlist',
					address: address.trim(),
					apikey: ETHERSCAN_API_KEY.trim(),
					page: '1',
					offset: String(WHALE_TX_PER_ADDRESS),
					sort: 'desc'
				});
				const url = `${ETHERSCAN_API_BASE}?${params}`;
				let res = await fetch(url, { cache: 'no-store' });
				if (!res.ok) {
					try {
						res = await fetchWithProxy(url);
					} catch {
						continue;
					}
				}
				if (!res.ok) continue;
				const data = (await res.json()) as { status?: string; result?: EtherscanTx[] };
				const list = Array.isArray(data?.result) ? data.result : [];
				for (const tx of list) {
					const valueWei = tx.value ? String(tx.value).trim() : '0';
					const valueEth = parseInt(valueWei, 10) / WEI_PER_ETH;
					if (valueEth <= 0 || !tx.hash) continue;
					const usd = Math.round(valueEth * ethPrice);
					out.push({
						coin: 'ETH',
						amount: Math.round(valueEth * 10000) / 10000,
						usd,
						hash: tx.hash,
						fromAddress: tx.from ?? undefined,
						toAddress: tx.to ?? undefined
					});
				}
			}
			out.sort((a, b) => b.usd - a.usd);
			if (out.length > 0) return out.slice(0, 25);
		} catch {
			// Fall through to mock
		}
	}

	// Mock when no key, no ETH addresses, or Etherscan failed
	const out: WhaleTransaction[] = [];
	if (addrs.length > 0) {
		for (const fromAddr of addrs) {
			const n = 1 + Math.floor(Math.random() * 2);
			for (let i = 0; i < n; i++) {
				const coin = WHALE_MOCK_COINS[Math.floor(Math.random() * WHALE_MOCK_COINS.length)];
				const unit = WHALE_MOCK_USD_PER_UNIT[coin] ?? 3400;
				const amount = Math.round(
					(50 + Math.random() * 500) * (coin === 'BTC' ? 1 : coin === 'ETH' ? 10 : 100)
				);
				const usd = Math.round(amount * unit * (0.9 + Math.random() * 0.2));
				out.push({
					coin,
					amount,
					usd,
					hash: mockHash(),
					fromAddress: fromAddr,
					toAddress:
						'0x' +
						Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') +
						'…'
				});
			}
		}
	} else {
		for (let i = 0; i < 3; i++) {
			const coin = WHALE_MOCK_COINS[i];
			const unit = WHALE_MOCK_USD_PER_UNIT[coin];
			out.push({
				coin,
				amount: coin === 'BTC' ? 800 : coin === 'ETH' ? 12000 : 200000,
				usd: Math.round((coin === 'BTC' ? 800 : coin === 'ETH' ? 12000 : 200000) * unit),
				hash: mockHash()
			});
		}
	}
	out.sort((a, b) => b.usd - a.usd);
	return out.slice(0, 25);
}

/**
 * Fetch whale balances: when VITE_ETHERSCAN_API_KEY is set and addresses include ETH (0x…), use Etherscan balance;
 * otherwise mock data.
 */
export async function fetchWhaleBalances(addresses?: string[]): Promise<WhaleBalance[]> {
	const addrs = addresses && addresses.length > 0 ? addresses : [];
	const ethAddrs = addrs.filter(isEthAddress).slice(0, WHALE_MAX_ETH_ADDRESSES);

	if (ETHERSCAN_API_KEY.trim() && ethAddrs.length > 0) {
		try {
			const ethPrice = await getEthPriceUsd();
			const out: WhaleBalance[] = [];
			for (const address of ethAddrs) {
				const params = new URLSearchParams({
					chainid: '1',
					module: 'account',
					action: 'balance',
					address: address.trim(),
					apikey: ETHERSCAN_API_KEY.trim()
				});
				const url = `${ETHERSCAN_API_BASE}?${params}`;
				let res = await fetch(url, { cache: 'no-store' });
				if (!res.ok) {
					try {
						res = await fetchWithProxy(url);
					} catch {
						continue;
					}
				}
				if (!res.ok) continue;
				const data = (await res.json()) as { status?: string; result?: string };
				const weiStr = data?.result != null ? String(data.result) : '0';
				const balanceWei = parseInt(weiStr, 10) || 0;
				const amountEth = balanceWei / WEI_PER_ETH;
				const usd = Math.round(amountEth * ethPrice);
				out.push({
					address: address.trim(),
					totalUsd: usd,
					coins: [{ coin: 'ETH', amount: Math.round(amountEth * 10000) / 10000, usd }]
				});
			}
			if (out.length > 0) return out;
		} catch {
			// Fall through to mock
		}
	}

	// Mock when no key, no ETH addresses, or Etherscan failed
	if (addrs.length === 0) return [];
	const out: WhaleBalance[] = [];
	for (const addr of addrs) {
		const n = 1 + Math.floor(Math.random() * 2);
		const coins: { coin: string; amount: number; usd: number }[] = [];
		let totalUsd = 0;
		const used = new Set<number>();
		for (let i = 0; i < n; i++) {
			let idx = Math.floor(Math.random() * WHALE_MOCK_COINS.length);
			while (used.has(idx)) idx = (idx + 1) % WHALE_MOCK_COINS.length;
			used.add(idx);
			const coin = WHALE_MOCK_COINS[idx];
			const unit = WHALE_MOCK_USD_PER_UNIT[coin] ?? 3400;
			const amount =
				Math.round(
					(10 + Math.random() * 200) * (coin === 'BTC' ? 0.1 : coin === 'ETH' ? 1 : 10) * 100
				) / 100;
			const usd = Math.round(amount * unit * (0.95 + Math.random() * 0.1));
			coins.push({ coin, amount, usd });
			totalUsd += usd;
		}
		out.push({ address: addr, totalUsd, coins });
	}
	return out;
}

const USASPENDING_AWARD_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';

/** USASpending spending_by_award response item */
interface SpendingByAwardItem {
	'Award ID'?: string | null;
	'Awarding Agency'?: string | null;
	'Recipient Name'?: string | null;
	Description?: string | null;
	'Award Amount'?: number | null;
	'Contract Award Type'?: string | null;
}

/** Fallback sample when API fails (e.g. CORS) */
function getSampleContracts(): Contract[] {
	return [
		{
			agency: 'DOD',
			description: 'Advanced radar systems development and integration',
			vendor: 'Raytheon',
			amount: 2500000000
		},
		{
			agency: 'NASA',
			description: 'Artemis program lunar lander support services',
			vendor: 'SpaceX',
			amount: 1800000000
		},
		{
			agency: 'DHS',
			description: 'Border security technology modernization',
			vendor: 'Palantir',
			amount: 450000000
		},
		{
			agency: 'VA',
			description: 'Electronic health records system upgrade',
			vendor: 'Oracle Cerner',
			amount: 320000000
		},
		{
			agency: 'DOE',
			description: 'Clean energy grid infrastructure',
			vendor: 'General Electric',
			amount: 275000000
		}
	];
}

/**
 * Fetch government contracts from USASpending.gov (contract types A,B,C,D).
 * Falls back to sample data if the API is unavailable (e.g. CORS).
 */
export async function fetchGovContracts(): Promise<Contract[]> {
	const end = new Date();
	const start = new Date(end);
	start.setFullYear(start.getFullYear() - 1);
	const startStr = start.toISOString().slice(0, 10);
	const endStr = end.toISOString().slice(0, 10);

	const body = {
		filters: {
			award_type_codes: ['A', 'B', 'C', 'D'],
			time_period: [{ start_date: startStr, end_date: endStr }]
		},
		fields: [
			'Award ID',
			'Awarding Agency',
			'Recipient Name',
			'Description',
			'Award Amount',
			'Contract Award Type'
		],
		sort: 'Award Amount',
		order: 'desc',
		limit: 10,
		page: 1
	};

	try {
		// USASpending.gov allows CORS; direct fetch works in browser
		const res = await fetch(USASPENDING_AWARD_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`USASpending ${res.status}`);
		const data = (await res.json()) as { results?: SpendingByAwardItem[] };
		const items = data.results ?? [];
		const out: Contract[] = [];
		for (const r of items) {
			const amount = r['Award Amount'];
			if (amount == null || amount <= 0) continue;
			const agency = r['Awarding Agency'] ?? '';
			const vendor = r['Recipient Name'] ?? '';
			const description = r['Description'] ?? r['Contract Award Type'] ?? '';
			if (!agency.trim() && !vendor.trim()) continue;
			const awardId = r['Award ID'];
			const url =
				awardId && String(awardId).trim()
					? `https://www.usaspending.gov/award/${encodeURIComponent(String(awardId).trim())}`
					: undefined;
			out.push({
				agency: agency.trim() || '—',
				description: description.trim().slice(0, 80) || '—',
				vendor: vendor.trim() || '—',
				amount: Math.round(amount),
				...(url && { url })
			});
		}
		return out.length > 0 ? out : getSampleContracts();
	} catch {
		return getSampleContracts();
	}
}

const LAYOFFS_FYI_API = 'https://layoffs.fyi/wp-json/wp/v2/posts';
const LAYOFFS_CSV_URL = 'https://raw.githubusercontent.com/omswa513/Layoffs/main/layoffs_data.csv';
const LAYOFFS_MAX_ITEMS = 20;

/** layoffs.fyi WordPress post item */
interface LayoffsFyiPost {
	date?: string;
	link?: string;
	title?: { rendered?: string };
	excerpt?: { rendered?: string };
}

/** Parse a single CSV line respecting quoted fields (handles commas inside quotes). */
function parseCSVLine(line: string): string[] {
	const out: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') {
			inQuotes = !inQuotes;
		} else if ((c === ',' && !inQuotes) || (c === '\r' && !inQuotes)) {
			out.push(field.trim());
			field = '';
		} else if (c !== '\r') {
			field += c;
		}
	}
	out.push(field.trim());
	return out;
}

/** Parse CSV text into rows of columns; first row is headers. */
function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
	const lines = csvText.split('\n').filter((l) => l.trim());
	if (lines.length === 0) return { headers: [], rows: [] };
	const headers = parseCSVLine(lines[0]);
	const rows = lines.slice(1).map(parseCSVLine);
	return { headers, rows };
}

function getSampleLayoffs(): Layoff[] {
	const now = new Date();
	const formatDate = (daysAgo: number) => {
		const d = new Date(now);
		d.setDate(d.getDate() - daysAgo);
		return d.toISOString();
	};
	return [
		{ company: 'Meta', count: 1200, title: 'Restructuring engineering teams', date: formatDate(2) },
		{ company: 'Amazon', count: 850, title: 'AWS division optimization', date: formatDate(5) },
		{
			company: 'Salesforce',
			count: 700,
			title: 'Post-acquisition consolidation',
			date: formatDate(8)
		},
		{
			company: 'Intel',
			count: 1500,
			title: 'Manufacturing pivot restructure',
			date: formatDate(12)
		},
		{ company: 'Snap', count: 500, title: 'Cost reduction initiative', date: formatDate(15) }
	];
}

/** Intellizence API response item shape */
interface IntellizenceLayoffItem {
	id?: string;
	announcedDate?: string;
	company?: { name?: string };
	count?: number;
	title?: string;
	layoffReason?: string;
	url?: string;
}

/** Extract company name from layoffs.fyi post title (e.g. "Scoop conducts layoff" -> Scoop). */
function companyFromTitle(title: string): string {
	const t = title.replace(/\s*\[.*?\]\s*/g, '').trim();
	const match =
		t.match(/^([^–\-—:,]+?)\s+(?:conducts?|layoff|layoffs|layoff list|roundup|cuts?|to cut)/i) ??
		t.match(/^([^–\-—:,]+)/);
	return (match ? match[1].trim() : t.slice(0, 30)).slice(0, 50) || '—';
}

/** Try to parse laid-off count from excerpt text. */
function countFromExcerpt(html: string): number {
	const text = (html || '').replace(/<[^>]+>/g, ' ');
	const m =
		text.match(/(\d{1,6})\s*(?:employees?|staff|workers?|jobs?|people)/i) ??
		text.match(/(\d{1,6})\s*%\s*of\s*(?:employees?|staff|workforce)/i);
	return m ? Math.min(999999, parseInt(m[1], 10)) : 0;
}

/**
 * Fetch layoffs: 1) Intellizence (if VITE_INTELLIZENCE_API_KEY), 2) layoffs.fyi WordPress API, 3) GitHub CSV, 4) sample.
 * Never throws – always returns an array (fallback to sample on any error).
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	try {
		return await fetchLayoffsInternal();
	} catch {
		return getSampleLayoffs();
	}
}

async function fetchLayoffsInternal(): Promise<Layoff[]> {
	// 1) Prefer real-time data from Intellizence when API key is configured
	if (INTELLIZENCE_API_KEY.trim()) {
		try {
			const end = new Date();
			const start = new Date();
			start.setDate(start.getDate() - 90);
			const res = await fetch(INTELLIZENCE_LAYOFF_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': INTELLIZENCE_API_KEY.trim()
				},
				body: JSON.stringify({
					dateType: 'LAST-MODIFIED',
					startDate: start.toISOString().slice(0, 10),
					endDate: end.toISOString().slice(0, 10),
					limit: LAYOFFS_MAX_ITEMS
				})
			});
			if (!res.ok) throw new Error(`Intellizence ${res.status}`);
			const raw = (await res.json()) as unknown;
			const items: IntellizenceLayoffItem[] = Array.isArray(raw)
				? raw
				: raw && typeof raw === 'object' && 'data' in (raw as object)
					? ((raw as { data?: IntellizenceLayoffItem[] }).data ?? [])
					: raw && typeof raw === 'object'
						? [raw as IntellizenceLayoffItem]
						: [];
			const out: Layoff[] = [];
			for (const r of items) {
				const company = r.company?.name?.trim();
				if (!company) continue;
				const dateStr = r.announcedDate ?? '';
				const date = dateStr ? new Date(dateStr) : new Date();
				out.push({
					company,
					count: typeof r.count === 'number' && r.count >= 0 ? r.count : 0,
					title:
						(r.title ?? r.layoffReason ?? 'Workforce reduction').trim().slice(0, 80) ||
						'Workforce reduction',
					date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
				});
			}
			out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
			if (out.length > 0) return out.slice(0, LAYOFFS_MAX_ITEMS);
		} catch {
			// Fall through to layoffs.fyi
		}
	}

	// 2) layoffs.fyi – recent posts from WordPress REST API (same source as https://layoffs.fyi/)
	try {
		const url = `${LAYOFFS_FYI_API}?per_page=${LAYOFFS_MAX_ITEMS}&orderby=date&order=desc`;
		const res = await fetch(url, { cache: 'no-store' });
		if (res.ok) {
			const raw = await res.json();
			const posts = Array.isArray(raw) ? raw : [];
			if (posts.length > 0) {
				const out: Layoff[] = [];
				for (const p of posts as LayoffsFyiPost[]) {
					const rawTitle = (p.title?.rendered ?? '')
						.replace(/&#8217;/g, "'")
						.replace(/&amp;/g, '&')
						.trim();
					if (!rawTitle) continue;
					const company = companyFromTitle(rawTitle);
					const dateStr = p.date ?? '';
					const date = dateStr ? new Date(dateStr) : new Date();
					const excerptHtml = p.excerpt?.rendered ?? '';
					const count = countFromExcerpt(excerptHtml);
					out.push({
						company,
						count,
						title: rawTitle.slice(0, 100),
						date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
						...(p.link && { url: p.link })
					});
				}
				out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				if (out.length > 0) return out.slice(0, LAYOFFS_MAX_ITEMS);
			}
		}
		// res not ok (e.g. 500) or no posts – fall through to CSV without throwing
	} catch {
		// Fall through to CSV
	}

	// 3) GitHub CSV (historical)
	try {
		const res = await fetch(LAYOFFS_CSV_URL, { cache: 'no-store' });
		if (!res.ok) throw new Error(`Layoffs CSV ${res.status}`);
		const text = await res.text();
		const { headers, rows } = parseCSV(text);
		const companyIdx = headers.indexOf('Company');
		const industryIdx = headers.indexOf('Industry');
		const laidOffIdx = headers.indexOf('Laid_Off_Count');
		const dateIdx = headers.indexOf('Date');
		if ([companyIdx, dateIdx].some((i) => i === -1)) throw new Error('Missing CSV columns');

		const out: Layoff[] = [];

		for (const row of rows) {
			const company = (row[companyIdx] ?? '').trim();
			const dateStr = (row[dateIdx] ?? '').trim();
			if (!company || !dateStr) continue;
			const date = new Date(dateStr);
			if (Number.isNaN(date.getTime())) continue;

			const industry = (row[industryIdx] ?? '').trim();
			const title = industry ? `${industry} workforce reduction` : 'Workforce reduction';
			let count = 0;
			if (laidOffIdx >= 0 && row[laidOffIdx]) {
				const n = parseInt(String(row[laidOffIdx]).replace(/,/g, ''), 10);
				if (Number.isInteger(n) && n >= 0) count = n;
			}

			out.push({
				company,
				count,
				title,
				date: date.toISOString()
			});
		}

		out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		return out.slice(0, LAYOFFS_MAX_ITEMS);
	} catch {
		return getSampleLayoffs();
	}
}
