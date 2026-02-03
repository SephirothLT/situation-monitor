<script lang="ts">
	import { Panel, MarketItem } from '$lib/components/common';
	import { indices, settings } from '$lib/stores';
	import { getPanelName, UI_TEXTS } from '$lib/config';

	interface Props {
		onRetry?: () => void;
	}
	let { onRetry }: Props = $props();

	const DEFAULT_PREVIEW = 6;
	let expanded = $state(false);

	const items = $derived($indices.items);
	const loading = $derived($indices.loading);
	const error = $derived($indices.error);
	const count = $derived(items.length);
	const title = $derived(getPanelName('markets', $settings.locale));
	const emptyMarkets = $derived(UI_TEXTS[$settings.locale].empty.markets);
	const t = $derived(UI_TEXTS[$settings.locale].common);
	const visibleItems = $derived(expanded ? items : items.slice(0, DEFAULT_PREVIEW));
	const hasMore = $derived(items.length > DEFAULT_PREVIEW);
	const moreCount = $derived(items.length - DEFAULT_PREVIEW);
</script>

<Panel id="markets" {title} {count} {loading} {error} {onRetry}>
	{#if items.length === 0 && !loading && !error}
		<div class="empty-state">{emptyMarkets}</div>
	{:else}
		<div class="markets-list">
			{#each visibleItems as item (item.symbol)}
				<MarketItem {item} />
			{/each}
		</div>
		{#if hasMore}
			<button type="button" class="show-more-btn" onclick={() => (expanded = !expanded)}>
				{expanded ? t.showLess : t.showMore}
				{#if !expanded}<span class="show-more-count">({moreCount})</span>{/if}
			</button>
		{/if}
	{/if}
</Panel>

<style>
	.show-more-btn {
		margin-top: 0.5rem;
		padding: 0.35rem 0.5rem;
		font-size: 0.65rem;
		color: var(--accent);
		background: none;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		width: 100%;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.show-more-btn:hover {
		background: rgba(var(--accent-rgb), 0.08);
		border-color: var(--accent);
	}

	.show-more-count {
		color: var(--text-muted);
		font-weight: 500;
		margin-left: 0.25rem;
	}

	.markets-list {
		display: flex;
		flex-direction: column;
	}

	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}
</style>
