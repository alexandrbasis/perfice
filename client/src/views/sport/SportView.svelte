<script lang="ts">
    import {onMount} from "svelte";
    import {faDumbbell, faPlusCircle} from "@fortawesome/free-solid-svg-icons";
    import Fa from "svelte-fa";
    import MobileTopBar from "@perfice/components/mobile/MobileTopBar.svelte";
    import SportStatsBar from "@perfice/components/sport/SportStatsBar.svelte";
    import SportWeekNav from "@perfice/components/sport/SportWeekNav.svelte";
    import SportActivityList from "@perfice/components/sport/SportActivityList.svelte";
    import SportEmptyState from "@perfice/components/sport/SportEmptyState.svelte";
    import {trackables, forms, journal, restDays, trackableCategories, weekStart} from "@perfice/stores";
    import {dateToWeekStart, dateToWeekEnd} from "@perfice/util/time/simple";
    import {SportStatsService, formatDurationMs} from "@perfice/services/sport/stats";
    import {SportStreakService} from "@perfice/services/sport/streak";
    import type {Trackable, TrackableType} from "@perfice/model/trackable/trackable";
    import type {JournalEntry} from "@perfice/model/journal/journal";
    import type {Form} from "@perfice/model/form/form";
    import type {FormQuestionDataType} from "@perfice/model/form/form";
    import type {RestDay} from "@perfice/model/sport/restday";
    import type {TrackableSuggestion} from "@perfice/model/trackable/suggestions";
    import CreateTrackableModal from "@perfice/components/trackable/modals/create/CreateTrackableModal.svelte";

    let streakService = new SportStreakService();
    let statsService = new SportStatsService(streakService);
    let createTrackableModal: CreateTrackableModal;
    const SPORT_CATEGORY_NAME = "Lifestyle";

    let weekOffset = $state(0);

    let weekBounds = $derived.by(() => {
        let base = new Date();
        base.setDate(base.getDate() + (weekOffset * 7));
        return {
            start: dateToWeekStart(base, $weekStart),
            end: dateToWeekEnd(base, $weekStart),
        };
    });
    let currentWeekStart = $derived(weekBounds.start);
    let currentWeekEnd = $derived(weekBounds.end);

    function prevWeek() { weekOffset--; }
    function nextWeek() { weekOffset++; }

    // Async data loading
    let sportTrackables = $state<Trackable[]>([]);
    let sportEntries = $state<JournalEntry[]>([]);
    let allForms = $state<Form[]>([]);
    let allRestDays = $state<RestDay[]>([]);
    let loaded = $state(false);

    let loadError = $state(false);
    let createError = $state<string | null>(null);
    let createSuccess = $state<string | null>(null);
    let sportCategoryIdPromise: Promise<string> | null = null;

    async function getSportCategoryId(): Promise<string> {
        if (sportCategoryIdPromise != null) return await sportCategoryIdPromise;

        sportCategoryIdPromise = (async () => {
            let categories = await trackableCategories.get();
            let category = categories.find(c => c.name.trim().toLowerCase() === SPORT_CATEGORY_NAME.toLowerCase());
            if (category != null) return category.id;

            return (await trackableCategories.createCategory(SPORT_CATEGORY_NAME)).id;
        })();

        return await sportCategoryIdPromise;
    }

    async function assignUncategorizedSportTrackablesToSportCategory(items: Trackable[]): Promise<Trackable[]> {
        let uncategorized = items.filter(t => t.categoryId == null);
        if (uncategorized.length === 0) return items;

        let categoryId = await getSportCategoryId();
        let updated = items.map(t => t.categoryId == null ? {...t, categoryId} : t);

        await Promise.all(
            updated
                .filter(t => uncategorized.some(u => u.id === t.id))
                .map(t => trackables.updateTrackable(t))
        );

        return updated;
    }

    async function loadData() {
        try {
            loadError = false;
            let [st, f, rd] = await Promise.all([
                trackables.getSportTrackables(),
                $forms,
                $restDays,
            ]);

            sportTrackables = await assignUncategorizedSportTrackablesToSportCategory(st);
            allForms = f;
            allRestDays = rd;

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

            loaded = true;
        } catch (e) {
            console.error("Failed to load sport data:", e);
            loadError = true;
            loaded = true;
        }
    }

    // Reload entries when week changes
    $effect(() => {
        // Access currentWeekStart/End to track them
        let _start = currentWeekStart;
        let _end = currentWeekEnd;
        loadData();
    });

    onMount(() => {
        trackables.load();
        restDays.load();
    });

    // Compute stats
    let weekStats = $derived.by(() => {
        if (!loaded || sportTrackables.length === 0) {
            return {sessions: 0, totalDurationMs: 0, streak: 0};
        }
        return statsService.computeWeekStats(
            sportEntries, sportTrackables, allForms, allRestDays,
            currentWeekStart, currentWeekEnd, new Date()
        );
    });

    let hasSportTrackables = $derived(sportTrackables.length > 0);

    async function handleToggleRestDay(dateStr: string) {
        try {
            await restDays.toggle(dateStr);
            await loadData();
        } catch (e) {
            console.error("Failed to toggle rest day:", e);
        }
    }

    async function createSportTrackable() {
        createTrackableModal.open(await getSportCategoryId(), 'sport');
    }

    async function onSuggestionSelected(categoryId: string | null, suggestion: TrackableSuggestion, trackableType: TrackableType) {
        try {
            createError = null;
            createSuccess = null;
            let result = await trackables.createTrackableFromSuggestion(suggestion, categoryId, trackableType);
            await loadData();
            createSuccess = `${result.trackable.name} created`;
        } catch (e: any) {
            createError = e?.message ?? "Failed to create sport trackable";
            createSuccess = null;
        }
    }

    async function onSingleValue(categoryId: string | null, name: string, icon: string, types: FormQuestionDataType[], trackableType: TrackableType) {
        try {
            createError = null;
            createSuccess = null;
            let trackable = await trackables.createSingleValueTrackable({categoryId, name, icon, types, trackableType});
            await loadData();
            createSuccess = `${trackable?.name ?? name} created`;
        } catch (e: any) {
            createError = e?.message ?? "Failed to create sport trackable";
            createSuccess = null;
        }
    }
</script>

<CreateTrackableModal bind:this={createTrackableModal} onSelectSuggestion={onSuggestionSelected} onSingleValue={onSingleValue}/>
<MobileTopBar title="Sport"/>
<div class="center-view md:mt-8 md:p-0 px-4 py-2 main-content">
    <div class="hidden md:flex items-center gap-2 mb-4">
        <Fa icon={faDumbbell} class="text-blue-500"/>
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-200">Sport</h1>
    </div>

    <SportWeekNav weekStart={currentWeekStart} weekEnd={currentWeekEnd} onPrev={prevWeek} onNext={nextWeek}/>

    {#if createError}
        <div class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg
                    text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
            <span>{createError}</span>
            <button onclick={() => createError = null} class="ml-2 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
    {/if}
    {#if createSuccess}
        <div class="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg
                    text-green-700 dark:text-green-300 text-sm flex items-center justify-between">
            <span>{createSuccess}</span>
            <button onclick={() => createSuccess = null} class="ml-2 text-green-500 hover:text-green-700 font-bold">&times;</button>
        </div>
    {/if}

    {#if !loaded}
        <div class="py-8 text-center text-gray-400">Loading...</div>
    {:else if loadError}
        <div class="py-8 text-center text-red-500 dark:text-red-400">
            Failed to load sport data. Please try refreshing.
        </div>
    {:else if hasSportTrackables}
        <div class="mt-3">
            <SportStatsBar
                sessions={weekStats.sessions}
                durationFormatted={formatDurationMs(weekStats.totalDurationMs)}
                streak={weekStats.streak}
            />
        </div>

        <div class="mt-4">
            <SportActivityList
                entries={sportEntries}
                trackables={sportTrackables}
                forms={allForms}
                restDays={allRestDays}
                weekStart={currentWeekStart}
                weekEnd={currentWeekEnd}
                onToggleRestDay={handleToggleRestDay}
            />
        </div>

        <button onclick={createSportTrackable}
                class="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg
                       flex items-center justify-center hover:bg-blue-600 transition-colors z-10">
            <Fa icon={faPlusCircle} class="text-xl"/>
        </button>
    {:else}
        <SportEmptyState onCreate={createSportTrackable}/>
    {/if}
</div>
