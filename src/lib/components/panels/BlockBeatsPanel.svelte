<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { blockbeats, settings } from '$lib/stores';
	import { getPanelName } from '$lib/config';
	import { timeAgo } from '$lib/utils';

	const items = $derived($blockbeats.items);
	const loading = $derived($blockbeats.loading);
	const error = $derived($blockbeats.error);
	const count = $derived(items.length);
	const title = $derived(getPanelName('blockbeats', $settings.locale));

	function formatTime(createTime: string): string {
		const ts = parseInt(createTime, 10);
		if (Number.isNaN(ts)) return '';
		return timeAgo(ts * 1000);
	}

	function truncateContent(text: string, maxLen = 80): string {
		if (!text) return '';
		const t = text.trim();
		return t.length <= maxLen ? t : t.slice(0, maxLen) + '…';
	}
</script>

<Panel id="blockbeats" {title} {count} {loading} {error}>
	{#if items.length === 0 && !loading && !error}
		<div class="empty-state">暂无快讯</div>
	{:else}
		<div class="flash-list">
			{#each items as item (item.id)}
				<article class="flash-item">
					<a href={item.link} target="_blank" rel="noopener noreferrer" class="flash-link">
						<div class="flash-header">
							<h3 class="flash-title">{item.title}</h3>
							<time class="flash-time" datetime={item.create_time}>{formatTime(item.create_time)}</time>
						</div>
						{#if item.content}
							<p class="flash-content">{truncateContent(item.content)}</p>
						{/if}
					</a>
				</article>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.flash-list {
		display: flex;
		flex-direction: column;
	}

	.flash-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
	}

	.flash-item:last-child {
		border-bottom: none;
	}

	.flash-link {
		display: block;
		text-decoration: none;
		color: inherit;
		outline: none;
	}

	.flash-link:hover .flash-title {
		color: var(--accent);
	}

	.flash-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.flash-title {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.35;
		flex: 1;
		min-width: 0;
	}

	.flash-time {
		font-size: 0.55rem;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.flash-content {
		font-size: 0.65rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}

	.empty-state {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.7rem;
		padding: 1rem;
	}
</style>
