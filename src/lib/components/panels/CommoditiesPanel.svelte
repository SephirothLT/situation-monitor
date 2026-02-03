<script lang="ts">
	import { Panel, MarketItem } from '$lib/components/common';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { commodities, vix, settings, commodityList } from '$lib/stores';
	import { getPanelName, UI_TEXTS, COMMODITY_OPTIONS } from '$lib/config';

	interface Props {
		onCommodityListChange?: () => void;
	}

	let { onCommodityListChange }: Props = $props();

	let addModalOpen = $state(false);
	let searchQuery = $state('');

	function getCommodityName(symbol: string, locale: 'zh' | 'en'): string {
		return UI_TEXTS[locale].commodities[symbol] ?? symbol;
	}

	const items = $derived($commodities.items);
	const loading = $derived($commodities.loading);
	const error = $derived($commodities.error);
	const selectedSymbols = $derived($commodityList);
	const t = $derived(UI_TEXTS[$settings.locale].commodityPicker);
	const modalCloseLabel = $derived(UI_TEXTS[$settings.locale].modal.close);
	const emptyCommodities = $derived(UI_TEXTS[$settings.locale].empty.commodities);

	const availableOptions = $derived(
		COMMODITY_OPTIONS.filter(
			(opt) =>
				!selectedSymbols.includes(opt.symbol) &&
				(searchQuery === '' ||
					opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					opt.display.toLowerCase().includes(searchQuery.toLowerCase()))
		).slice(0, 20)
	);

	const canAddMore = $derived(selectedSymbols.length < 15);

	type VixStatusKey = 'highFear' | 'elevated' | 'low';

	function getVixStatusKey(level: number | undefined): VixStatusKey | '' {
		if (level === undefined) return '';
		if (level >= 30) return 'highFear';
		if (level >= 20) return 'elevated';
		return 'low';
	}

	function getVixClass(level: number | undefined): string {
		if (level === undefined) return '';
		if (level >= 30) return 'critical';
		if (level >= 20) return 'elevated';
		return 'monitoring';
	}

	const vixStatusKey = $derived(getVixStatusKey($vix?.price));
	const vixStatus = $derived(vixStatusKey ? UI_TEXTS[$settings.locale].status[vixStatusKey] : '');
	const vixClass = $derived(getVixClass($vix?.price));

	function handleAddCommodity(symbol: string) {
		if (commodityList.addCommodity(symbol)) {
			addModalOpen = false;
			searchQuery = '';
			onCommodityListChange?.();
		}
	}

	function handleRemoveCommodity(symbol: string) {
		commodityList.removeCommodity(symbol);
		onCommodityListChange?.();
	}
</script>

<Panel
	id="commodities"
	title={getPanelName('commodities', $settings.locale)}
	status={vixStatus}
	statusClass={vixClass}
	count={items.length}
	{loading}
	{error}
>
	{#if items.length === 0 && !loading && !error}
		<div class="empty-state">{emptyCommodities}</div>
	{:else}
		<div class="commodities-list">
			{#each items as item (item.symbol)}
				<div class="commodity-item">
					<MarketItem
						{item}
						displayName={getCommodityName(item.symbol, $settings.locale)}
						currencySymbol={item.symbol === '^VIX' ? '' : '$'}
					/>
					{#if selectedSymbols.length > 1}
						<button
							type="button"
							class="remove-btn"
							title={t.remove}
							aria-label={t.remove}
							onclick={() => handleRemoveCommodity(item.symbol)}
						>
							×
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="commodities-footer">
		{#if canAddMore}
			<button
				type="button"
				class="add-commodity-btn"
				title={t.addCommodity}
				onclick={() => (addModalOpen = true)}
			>
				+ {t.addCommodity}
			</button>
		{:else}
			<span class="max-hint">{t.maxReached}</span>
		{/if}
	</div>
</Panel>

<Modal
	open={addModalOpen}
	title={t.addCommodityModalTitle}
	closeLabel={modalCloseLabel}
	onClose={() => {
		addModalOpen = false;
		searchQuery = '';
	}}
>
	<div class="add-commodity-content">
		<input
			type="text"
			class="search-input"
			placeholder={t.searchPlaceholder}
			bind:value={searchQuery}
		/>
		<div class="commodity-options">
			{#each availableOptions as opt (opt.symbol)}
				<button
					type="button"
					class="commodity-option"
					onclick={() => handleAddCommodity(opt.symbol)}
				>
					<span class="opt-symbol">{opt.display}</span>
					<span class="opt-name">{getCommodityName(opt.symbol, $settings.locale)}</span>
				</button>
			{/each}
			{#if availableOptions.length === 0}
				<p class="no-options">{searchQuery ? t.noMatch : t.allAdded}</p>
			{/if}
		</div>
	</div>
</Modal>

<style>
	.commodities-list {
		display: flex;
		flex-direction: column;
	}

	.commodity-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.commodity-item :global(.market-item) {
		flex: 1;
		min-width: 0;
	}

	.remove-btn {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.remove-btn:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.commodities-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0 0;
		border-top: 1px solid var(--border);
		margin-top: 0.25rem;
	}

	.add-commodity-btn {
		padding: 0.35rem 0.6rem;
		background: rgba(var(--accent-rgb), 0.1);
		border: 1px solid var(--accent);
		border-radius: 4px;
		color: var(--accent);
		font-size: 0.65rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-commodity-btn:hover {
		background: rgba(var(--accent-rgb), 0.2);
	}

	.max-hint {
		font-size: 0.6rem;
		color: var(--text-muted);
	}

	.add-commodity-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.search-input {
		padding: 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.commodity-options {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 16rem;
		overflow-y: auto;
	}

	.commodity-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.commodity-option:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
	}

	.opt-symbol {
		font-weight: 600;
		color: var(--accent);
		min-width: 3rem;
	}

	.opt-name {
		color: var(--text-secondary);
	}

	.no-options {
		font-size: 0.7rem;
		color: var(--text-muted);
		margin: 0;
		padding: 0.5rem;
	}

	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}
</style>
