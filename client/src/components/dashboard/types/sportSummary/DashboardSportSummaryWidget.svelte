<script lang="ts">
    import {onMount} from "svelte";
    import Fa from "svelte-fa";
    import {faBolt, faClock, faExclamationTriangle, faFire} from "@fortawesome/free-solid-svg-icons";
    import type {IconDefinition} from "@fortawesome/free-solid-svg-icons";
    import type {DashboardSportSummaryWidgetSettings} from "@perfice/model/dashboard/widgets/sportSummary";
    import type {PrimitiveValue} from "@perfice/model/primitive/primitive";
    import type {Trackable} from "@perfice/model/trackable/trackable";
    import type {JournalEntry} from "@perfice/model/journal/journal";
    import type {Form} from "@perfice/model/form/form";
    import type {RestDay} from "@perfice/model/sport/restday";
    import {trackables, forms, journal, restDays, weekStart} from "@perfice/stores";
    import {dashboardDate} from "@perfice/stores/dashboard/dashboard";
    import {dateToWeekStart, dateToWeekEnd} from "@perfice/util/time/simple";
    import {SportStatsService, formatDurationMs} from "@perfice/services/sport/stats";
    import {SportStreakService} from "@perfice/services/sport/streak";
    import SportQuickLog from "@perfice/components/sport/SportQuickLog.svelte";

    let {settings, openFormModal}: {
        settings: DashboardSportSummaryWidgetSettings,
        dependencies: Record<string, string>,
        openFormModal: (formId: string, answers?: Record<string, PrimitiveValue>, onSaved?: () => void) => void,
        widgetId: string,
    } = $props();

    let streakService = new SportStreakService();
    let statsService = new SportStatsService(streakService);

    let sportTrackables = $state<Trackable[]>([]);
    let sportEntries = $state<JournalEntry[]>([]);
    let allForms = $state<Form[]>([]);
    let allRestDays = $state<RestDay[]>([]);
    let loaded = $state(false);
    let loadError = $state(false);
    let loadGeneration = 0;

    let currentWeekStart = $derived(dateToWeekStart($dashboardDate, $weekStart));
    let currentWeekEnd = $derived(dateToWeekEnd($dashboardDate, $weekStart));

    async function loadData(gen: number) {
        try {
            let [loadedTrackables, loadedForms, loadedRestDays] = await Promise.all([
                trackables.getSportTrackables(),
                $forms,
                $restDays,
            ]);

            // Stale response guard: skip writes if a newer load was triggered
            if (gen !== loadGeneration) return;

            sportTrackables = loadedTrackables;
            allForms = loadedForms;
            allRestDays = loadedRestDays;

            let sportFormIds = sportTrackables.map(t => t.formId);
            if (sportFormIds.length > 0) {
                sportEntries = await journal.getSportEntries(
                    currentWeekStart.getTime(),
                    currentWeekEnd.getTime(),
                    sportFormIds
                );
            } else {
                sportEntries = [];
            }

            if (gen !== loadGeneration) return;
            loadError = false;
            loaded = true;
        } catch (e) {
            if (gen !== loadGeneration) return;
            console.error("Failed to load sport widget data:", e);
            loadError = true;
            loaded = true;
        }
    }

    // Dummy reads subscribe this $effect to reactive week-range changes
    $effect(() => {
        let _start = currentWeekStart;
        let _end = currentWeekEnd;
        loaded = false;
        let gen = ++loadGeneration;
        loadData(gen);
    });

    onMount(() => {
        trackables.load();
        restDays.load();
    });

    let weekStats = $derived.by(() => {
        if (!loaded || sportTrackables.length === 0) {
            return {sessions: 0, totalDurationMs: 0, streak: 0};
        }
        return statsService.computeWeekStats(
            sportEntries, sportTrackables, allForms, allRestDays,
            currentWeekStart, currentWeekEnd, $dashboardDate
        );
    });

    function onQuickLog(trackable: Trackable) {
        openFormModal(trackable.formId, undefined, () => {
            let gen = ++loadGeneration;
            loadData(gen);
        });
    }

    let statCards = $derived<{icon: IconDefinition, color: string, bgLight: string, bgDark: string, value: string | number, label: string}[]>([
        {icon: faBolt, color: "text-green-500", bgLight: "bg-green-100", bgDark: "dark:bg-green-900/30", value: weekStats.sessions, label: "Sessions"},
        {icon: faClock, color: "text-blue-500", bgLight: "bg-blue-100", bgDark: "dark:bg-blue-900/30", value: formatDurationMs(weekStats.totalDurationMs), label: "Duration"},
        {icon: faFire, color: "text-orange-500", bgLight: "bg-orange-100", bgDark: "dark:bg-orange-900/30", value: weekStats.streak, label: "Streak"},
    ]);
</script>

<div class="rounded-xl flex flex-col w-full h-full bg-white dark:bg-gray-800 default-border p-3">
    <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
            {settings.name}
        </span>
        {#if sportTrackables.length > 0}
            <SportQuickLog trackables={sportTrackables} onSelect={onQuickLog}/>
        {/if}
    </div>

    {#if !loaded}
        <div class="flex-1 flex items-center justify-center text-sm text-gray-400">Loading...</div>
    {:else if loadError}
        <div class="flex-1 flex flex-col items-center justify-center gap-1">
            <Fa icon={faExclamationTriangle} class="text-amber-400" size="sm"/>
            <span class="text-xs text-gray-400">Failed to load</span>
        </div>
    {:else}
        <div class="flex items-center justify-around flex-1 gap-2">
            {#each statCards as card}
                <div class="flex flex-col items-center">
                    <div class="w-6 h-6 rounded-full {card.bgLight} {card.bgDark} flex items-center justify-center mb-0.5">
                        <Fa icon={card.icon} class={card.color} size="xs"/>
                    </div>
                    <span class="text-base font-bold text-gray-800 dark:text-gray-200">{card.value}</span>
                    <span class="text-[10px] text-gray-500 dark:text-gray-400">{card.label}</span>
                </div>
            {/each}
        </div>
    {/if}
</div>
