/**
 * BlockBeats store - flash/news items from BlockBeats API
 */

import { writable, get } from 'svelte/store';
import { fetchBlockBeatsFlash, toBlockBeatsLang, type BlockBeatsFlashItem } from '$lib/api/blockbeats';

interface BlockBeatsState {
	items: BlockBeatsFlashItem[];
	loading: boolean;
	error: string | null;
}

const initialState: BlockBeatsState = {
	items: [],
	loading: false,
	error: null
};

function createBlockBeatsStore() {
	const { subscribe, set, update } = writable<BlockBeatsState>(initialState);

	return {
		subscribe,

		get items() {
			return get({ subscribe }).items;
		},

		get loading() {
			return get({ subscribe }).loading;
		},

		get error() {
			return get({ subscribe }).error;
		},

		async load(locale: 'zh' | 'en' = 'zh'): Promise<void> {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				const lang = toBlockBeatsLang(locale);
				const items = await fetchBlockBeatsFlash(lang, 20, 1, 'push');
				update((s) => ({ ...s, items, loading: false, error: null }));
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				update((s) => ({ ...s, items: [], loading: false, error: msg }));
			}
		},

		reset(): void {
			set(initialState);
		}
	};
}

export const blockbeats = createBlockBeatsStore();
