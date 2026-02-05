<script lang="ts">
	import Modal from './Modal.svelte';
	import { settings, refresh } from '$lib/stores';
	import { PANELS, UI_TEXTS, getPanelName, type PanelId, type Locale } from '$lib/config';

	interface Props {
		open: boolean;
		onClose: () => void;
		onReconfigure?: () => void;
	}

let { open = false, onClose, onReconfigure }: Props = $props();

const t = $derived(UI_TEXTS[$settings.locale]);

const refreshOptions = [
		{ value: 5 * 60 * 1000, zh: '高频 · 每 5 分钟', en: 'High · every 5 min' },
		{ value: 15 * 60 * 1000, zh: '标准 · 每 15 分钟', en: 'Standard · every 15 min' },
		{ value: 30 * 60 * 1000, zh: '低频 · 每 30 分钟', en: 'Low · every 30 min' },
		{ value: 60 * 60 * 1000, zh: '节省流量 · 每 60 分钟', en: 'Lite · every 60 min' }
	] as const;

const autoInterval = $derived($refresh.autoRefreshInterval);
const isCustomInterval = $derived(!refreshOptions.some((opt) => opt.value === autoInterval));
let customMinutes = $state('' + Math.round($refresh.autoRefreshInterval / 60000));

	function handleTogglePanel(panelId: PanelId) {
		settings.togglePanel(panelId);
	}

	function handleResetPanels() {
		settings.reset();
	}

	function setLocale(locale: Locale) {
		settings.setLocale(locale);
	}

	function setTheme(theme: 'dark' | 'light') {
		settings.setTheme(theme);
	}

	function setAutoInterval(intervalMs: number) {
		refresh.setAutoRefreshInterval(intervalMs);
		customMinutes = String(Math.round(intervalMs / 60000));
	}
</script>

<Modal {open} title={t.settings.title} closeLabel={t.modal.close} {onClose}>
	<div class="settings-sections">
		<section class="settings-section">
			<h3 class="section-title">{t.settings.language}</h3>
			<div class="locale-buttons">
				<button
					class="locale-btn"
					class:active={$settings.locale === 'zh'}
					onclick={() => setLocale('zh')}
				>
					中文
				</button>
				<button
					class="locale-btn"
					class:active={$settings.locale === 'en'}
					onclick={() => setLocale('en')}
				>
					English
				</button>
			</div>
		</section>

		<section class="settings-section">
			<h3 class="section-title">{t.settings.background}</h3>
			<div class="theme-buttons">
				<button
					class="theme-btn"
					class:active={$settings.theme === 'dark'}
					onclick={() => setTheme('dark')}
				>
					{t.settings.themeDark}
				</button>
				<button
					class="theme-btn"
					class:active={$settings.theme === 'light'}
					onclick={() => setTheme('light')}
				>
					{t.settings.themeLight}
				</button>
			</div>
		</section>

		<section class="settings-section">
			<h3 class="section-title">{t.settings.refreshInterval}</h3>
			<div class="refresh-buttons">
				{#each refreshOptions as opt}
					<button
						class="refresh-btn"
						class:active={!isCustomInterval && autoInterval === opt.value}
						onclick={() => setAutoInterval(opt.value)}
					>
						{$settings.locale === 'zh' ? opt.zh : opt.en}
					</button>
				{/each}
			</div>
			<div class="refresh-custom">
				<label class="refresh-custom-label">
					<span>
						{$settings.locale === 'zh' ? '自定义：' : 'Custom:'}
					</span>
					<input
						type="number"
						min="1"
						max="720"
						class="refresh-input"
						bind:value={customMinutes}
					/>
					<span class="refresh-unit">
						{$settings.locale === 'zh' ? '分钟' : 'min'}
					</span>
				</label>
				<button
					type="button"
					class="refresh-apply-btn"
					class:active={isCustomInterval}
					onclick={() => {
						const minutes = Number(customMinutes);
						if (!Number.isFinite(minutes) || minutes <= 0) return;
						const clamped = Math.max(1, Math.min(720, Math.round(minutes)));
						setAutoInterval(clamped * 60 * 1000);
					}}
				>
					{$settings.locale === 'zh' ? '应用' : 'Apply'}
				</button>
			</div>
		</section>

		<section class="settings-section">
			<h3 class="section-title">{t.settings.enabledPanels}</h3>
			<p class="section-desc">{t.settings.sectionDesc}</p>

			<div class="panels-grid">
				{#each Object.entries(PANELS) as [id, config]}
					{@const panelId = id as PanelId}
					{@const isEnabled = $settings.enabled[panelId]}
					<label class="panel-toggle" class:enabled={isEnabled}>
						<input
							type="checkbox"
							checked={isEnabled}
							onchange={() => handleTogglePanel(panelId)}
						/>
						<span class="panel-name">{getPanelName(panelId, $settings.locale)}</span>
						<span class="panel-priority">P{config.priority}</span>
					</label>
				{/each}
			</div>
		</section>

		<section class="settings-section">
			<h3 class="section-title">{t.settings.dashboard}</h3>
			{#if onReconfigure}
				<button class="reconfigure-btn" onclick={onReconfigure}>{t.settings.reconfigure}</button>
				<p class="btn-hint">{t.settings.btnHint}</p>
			{/if}
			<button class="reset-btn" onclick={handleResetPanels}>{t.settings.reset}</button>
		</section>
	</div>
</Modal>

<style>
	.settings-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.locale-buttons {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.locale-btn {
		padding: 0.4rem 0.8rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.locale-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
	}

	.locale-btn.active {
		border-color: var(--accent);
		background: rgba(255, 255, 255, 0.1);
	}

	.theme-buttons {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.theme-btn {
		padding: 0.4rem 0.8rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.theme-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
	}

	.theme-btn.active {
		border-color: var(--accent);
		background: rgba(255, 255, 255, 0.1);
		color: var(--accent);
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin: 0;
	}

	.section-desc {
		font-size: 0.65rem;
		color: var(--text-muted);
		margin: 0;
	}

	.refresh-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.refresh-btn {
		padding: 0.35rem 0.75rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text-secondary);
		font-size: 0.6rem;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.refresh-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.refresh-btn.active {
		border-color: var(--accent);
		background: rgba(var(--accent-rgb), 0.15);
		color: var(--accent);
	}

	.refresh-custom {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.refresh-custom-label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.6rem;
		color: var(--text-secondary);
	}

	.refresh-input {
		width: 4rem;
		padding: 0.25rem 0.4rem;
		font-size: 0.6rem;
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	.refresh-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.refresh-unit {
		font-size: 0.6rem;
		color: var(--text-muted);
	}

	.refresh-apply-btn {
		padding: 0.3rem 0.75rem;
		font-size: 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--accent);
		background: rgba(var(--accent-rgb), 0.1);
		color: var(--accent);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-apply-btn:hover {
		background: rgba(var(--accent-rgb), 0.18);
	}

	.panels-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.panel-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.6rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.panel-toggle:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.panel-toggle.enabled {
		border-color: var(--accent);
		background: rgba(var(--accent-rgb), 0.1);
	}

	.panel-toggle input {
		accent-color: var(--accent);
	}

	.panel-name {
		flex: 1;
		font-size: 0.65rem;
		color: var(--text-primary);
	}

	.panel-priority {
		font-size: 0.5rem;
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.05);
		padding: 0.1rem 0.25rem;
		border-radius: 2px;
	}

	.reconfigure-btn {
		padding: 0.5rem 1rem;
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 4px;
		color: var(--accent);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 0.25rem;
	}

	.reconfigure-btn:hover {
		background: rgba(0, 255, 136, 0.2);
	}

	.btn-hint {
		font-size: 0.6rem;
		color: var(--text-muted);
		margin: 0 0 0.75rem;
	}

	.reset-btn {
		padding: 0.5rem 1rem;
		background: rgba(255, 68, 68, 0.1);
		border: 1px solid rgba(255, 68, 68, 0.3);
		border-radius: 4px;
		color: var(--danger);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: rgba(255, 68, 68, 0.2);
	}
</style>
