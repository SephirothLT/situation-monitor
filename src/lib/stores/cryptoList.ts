/**
 * Crypto list store - user-selected coins for the crypto panel (persisted)
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { CRYPTO, CRYPTO_OPTIONS, type CryptoOption } from '$lib/config';

const STORAGE_KEY = 'situationMonitorCryptoIds';
const MAX_CRYPTO = 20;

function loadSelectedIds(): string[] {
	if (!browser) return CRYPTO.map((c) => c.id);
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return CRYPTO.map((c) => c.id);
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return CRYPTO.map((c) => c.id);
		const ids = parsed.filter((id): id is string => typeof id === 'string');
		return ids.length > 0 ? ids : CRYPTO.map((c) => c.id);
	} catch {
		return CRYPTO.map((c) => c.id);
	}
}

function saveSelectedIds(ids: string[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
	} catch (e) {
		console.warn('Failed to save crypto list:', e);
	}
}

const idToOption = (): Map<string, CryptoOption> => {
	const m = new Map<string, CryptoOption>();
	for (const o of CRYPTO_OPTIONS) {
		m.set(o.id, o);
	}
	return m;
};

const optionMap = idToOption();

// Legacy id -> current CoinGecko id (e.g. old config had 'link', CoinGecko uses 'chainlink')
const ID_ALIASES: Record<string, string> = { link: 'chainlink' };

function resolveId(id: string): string {
	return ID_ALIASES[id] ?? id;
}

function createCryptoListStore() {
	const { subscribe, set, update } = writable<string[]>(loadSelectedIds());

	return {
		subscribe,

		getSelectedIds(): string[] {
			return get({ subscribe });
		},

		/** Get config list for API: { id, symbol, name }[] */
		getSelectedConfig(): CryptoOption[] {
			const ids = get({ subscribe });
			const seen = new Set<string>();
			const result: CryptoOption[] = [];
			for (const id of ids) {
				const resolvedId = resolveId(id);
				const opt = optionMap.get(resolvedId);
				if (opt && !seen.has(opt.id)) {
					seen.add(opt.id);
					result.push(opt);
				}
			}
			return result.length > 0 ? result : [...CRYPTO];
		},

		addCrypto(id: string): boolean {
			const opt = optionMap.get(id);
			if (!opt) return false;
			let added = false;
			update((ids) => {
				if (ids.includes(id) || ids.length >= MAX_CRYPTO) return ids;
				added = true;
				const next = [...ids, id];
				saveSelectedIds(next);
				return next;
			});
			return added;
		},

		removeCrypto(id: string): void {
			update((ids) => {
				const next = ids.filter((x) => x !== id);
				if (next.length === 0) {
					// Keep at least default
					const defaultIds = CRYPTO.map((c) => c.id);
					saveSelectedIds(defaultIds);
					return defaultIds;
				}
				saveSelectedIds(next);
				return next;
			});
		},

		reset(): void {
			const defaultIds = CRYPTO.map((c) => c.id);
			saveSelectedIds(defaultIds);
			set(defaultIds);
		}
	};
}

export const cryptoList = createCryptoListStore();
