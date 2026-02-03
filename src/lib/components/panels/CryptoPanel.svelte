<script lang="ts">
	import { Panel } from '$lib/components/common';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { crypto, cryptoList, settings } from '$lib/stores';
	import { getPanelName, CRYPTO_OPTIONS, UI_TEXTS } from '$lib/config';
	import { formatCurrency, formatPercentChange, getChangeClass } from '$lib/utils';

	interface Props {
		onCryptoListChange?: () => void;
	}

	let { onCryptoListChange }: Props = $props();

	let addModalOpen = $state(false);
	let searchQuery = $state('');

	const items = $derived($crypto.items);
	const loading = $derived($crypto.loading);
	const error = $derived($crypto.error);
	const count = $derived(items.length);
	const title = $derived(getPanelName('crypto', $settings.locale));
	const selectedIds = $derived($cryptoList);
	const t = $derived(UI_TEXTS[$settings.locale].crypto);
	const emptyCrypto = $derived(UI_TEXTS[$settings.locale].empty.crypto);

	const availableCoins = $derived(
		CRYPTO_OPTIONS.filter(
			(opt) =>
				!selectedIds.includes(opt.id) &&
				(searchQuery === '' ||
					opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					opt.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
		).slice(0, 30)
	);

	const canAddMore = $derived(selectedIds.length < 20);

	function handleAddCoin(id: string) {
		if (cryptoList.addCrypto(id)) {
			addModalOpen = false;
			searchQuery = '';
			onCryptoListChange?.();
		}
	}

	function handleRemoveCoin(id: string) {
		cryptoList.removeCrypto(id);
		onCryptoListChange?.();
	}
</script>

<Panel id="crypto" {title} {count} {loading} {error}>
	{#if items.length === 0 && !loading && !error}
		<div class="empty-state">{emptyCrypto}</div>
	{:else}
		<div class="crypto-list">
			{#each items as coin (coin.id)}
				{@const changeClass = getChangeClass(coin.price_change_percentage_24h)}
				<div class="crypto-item">
					<div class="crypto-info">
						<div class="crypto-name">{coin.name}</div>
						<div class="crypto-symbol">{coin.symbol.toUpperCase()}</div>
					</div>
					<div class="crypto-data">
						<div class="crypto-price">{formatCurrency(coin.current_price)}</div>
						<div class="crypto-change {changeClass}">
							{formatPercentChange(coin.price_change_percentage_24h)}
						</div>
					</div>
					{#if selectedIds.length > 1}
						<button
							type="button"
							class="remove-btn"
							title={t.remove}
							aria-label={t.remove}
							onclick={() => handleRemoveCoin(coin.id)}
						>
							×
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="crypto-footer">
		{#if canAddMore}
			<button
				type="button"
				class="add-coin-btn"
				title={t.addCoin}
				onclick={() => (addModalOpen = true)}
			>
				+
			</button>
		{:else}
			<span class="max-hint">{t.maxReached}</span>
		{/if}
	</div>
</Panel>

<Modal
	open={addModalOpen}
	title={t.addCoinModalTitle}
	closeLabel={UI_TEXTS[$settings.locale].modal.close}
	onClose={() => {
		addModalOpen = false;
		searchQuery = '';
	}}
>
	<div class="add-coin-content">
		<input
			type="text"
			class="search-input"
			placeholder={t.searchPlaceholder}
			bind:value={searchQuery}
		/>
		<div class="coin-options">
			{#each availableCoins as opt (opt.id)}
				<button type="button" class="coin-option" onclick={() => handleAddCoin(opt.id)}>
					<span class="coin-symbol">{opt.symbol}</span>
					<span class="coin-name">{opt.name}</span>
				</button>
			{/each}
			{#if availableCoins.length === 0}
				<p class="no-options">{searchQuery ? t.noMatch : t.allAdded}</p>
			{/if}
		</div>
	</div>
</Modal>

<style>
	.crypto-list {
		display: flex;
		flex-direction: column;
	}

	.crypto-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
		gap: 0.5rem;
	}

	.crypto-item:last-child {
		border-bottom: none;
	}

	.crypto-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex: 1;
		min-width: 0;
	}

	.crypto-name {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.crypto-symbol {
		font-size: 0.55rem;
		color: var(--text-muted);
	}

	.crypto-data {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
	}

	.crypto-price {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.crypto-change {
		font-size: 0.6rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.crypto-change.up {
		color: var(--success);
	}

	.crypto-change.down {
		color: var(--danger);
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

	.crypto-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0 0;
		border-top: 1px solid var(--border);
		margin-top: 0.25rem;
	}

	.add-coin-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--accent-rgb), 0.1);
		border: 1px solid var(--accent);
		border-radius: 6px;
		color: var(--accent);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-coin-btn:hover {
		background: rgba(var(--accent-rgb), 0.2);
	}

	.max-hint {
		font-size: 0.6rem;
		color: var(--text-muted);
	}

	.add-coin-content {
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

	.coin-options {
		max-height: 240px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.coin-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.coin-option:hover {
		border-color: var(--accent);
		background: rgba(var(--accent-rgb), 0.05);
	}

	.coin-symbol {
		font-weight: 600;
		color: var(--accent);
		min-width: 3rem;
	}

	.coin-name {
		color: var(--text-secondary);
	}

	.no-options {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-align: center;
		padding: 1rem;
		margin: 0;
	}

	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}
</style>
