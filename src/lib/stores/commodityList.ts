/**
 * Commodity list store - user-selected commodities for the commodities panel (persisted)
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { COMMODITIES, COMMODITY_OPTIONS, type CommodityConfig } from '$lib/config';

const STORAGE_KEY = 'situationMonitorCommoditySymbols';
const MAX_COMMODITIES = 15;

const defaultSymbols = COMMODITIES.map((c) => c.symbol);
const symbolSet = new Set(COMMODITY_OPTIONS.map((o) => o.symbol));

function loadSelectedSymbols(): string[] {
	if (!browser) return [...defaultSymbols];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [...defaultSymbols];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [...defaultSymbols];
		const symbols = parsed.filter((s): s is string => typeof s === 'string' && symbolSet.has(s));
		return symbols.length > 0 ? symbols : [...defaultSymbols];
	} catch {
		return [...defaultSymbols];
	}
}

function save(symbols: string[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
	} catch (e) {
		console.warn('Failed to save commodity list:', e);
	}
}

const symbolToConfig = new Map<string, CommodityConfig>(
	COMMODITY_OPTIONS.map((c) => [c.symbol, c])
);

function createCommodityListStore() {
	const { subscribe, set, update } = writable<string[]>(loadSelectedSymbols());

	return {
		subscribe,

		getSelectedSymbols(): string[] {
			return get({ subscribe });
		},

		/** Get config list for API: CommodityConfig[] */
		getSelectedConfig(): CommodityConfig[] {
			const symbols = get({ subscribe });
			const result: CommodityConfig[] = [];
			const seen = new Set<string>();
			for (const sym of symbols) {
				const config = symbolToConfig.get(sym);
				if (config && !seen.has(sym)) {
					seen.add(sym);
					result.push(config);
				}
			}
			return result.length > 0 ? result : [...COMMODITIES];
		},

		addCommodity(symbol: string): boolean {
			if (!symbolSet.has(symbol)) return false;
			let added = false;
			update((list) => {
				if (list.includes(symbol) || list.length >= MAX_COMMODITIES) return list;
				added = true;
				const next = [...list, symbol];
				save(next);
				return next;
			});
			return added;
		},

		removeCommodity(symbol: string): void {
			update((list) => {
				const next = list.filter((s) => s !== symbol);
				if (next.length === 0) {
					save(defaultSymbols);
					return defaultSymbols;
				}
				save(next);
				return next;
			});
		},

		reset(): void {
			save(defaultSymbols);
			set(defaultSymbols);
		}
	};
}

export const commodityList = createCommodityListStore();
