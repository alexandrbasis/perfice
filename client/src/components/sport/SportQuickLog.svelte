<script lang="ts">
    import Fa from "svelte-fa";
    import {faPlus} from "@fortawesome/free-solid-svg-icons";
    import type {Trackable} from "@perfice/model/trackable/trackable";

    let {trackables, onSelect}: {
        trackables: Trackable[],
        onSelect: (trackable: Trackable) => void,
    } = $props();

    let open = $state(false);

    function toggle() {
        open = !open;
    }

    function select(trackable: Trackable) {
        open = false;
        onSelect(trackable);
    }
</script>

<div class="relative">
    <button onclick={toggle}
            class="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center
                   hover:bg-blue-600 transition-colors text-xs">
        <Fa icon={faPlus} size="xs"/>
    </button>

    {#if open}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="fixed inset-0 z-40" onclick={() => open = false}></div>
        <div class="absolute right-0 top-9 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg
                    default-border min-w-[180px] max-h-[200px] overflow-y-auto py-1">
            {#each trackables as trackable}
                <button onclick={() => select(trackable)}
                        class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700
                               flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span>{trackable.icon}</span>
                    <span>{trackable.name}</span>
                </button>
            {/each}
            {#if trackables.length === 0}
                <div class="px-3 py-2 text-sm text-gray-400">No sport trackables</div>
            {/if}
        </div>
    {/if}
</div>
