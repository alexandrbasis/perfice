<script lang="ts">
    import type {DashboardSportSummaryWidgetSettings} from "@perfice/model/dashboard/widgets/sportSummary";
    import type {Form} from "@perfice/model/form/form";

    let {settings, onChange}: {
        settings: DashboardSportSummaryWidgetSettings,
        onChange: (settings: DashboardSportSummaryWidgetSettings) => void,
        forms: Form[],
        dependencies: Record<string, string>
    } = $props();

    function onNameChange(e: Event) {
        let target = e.target as HTMLInputElement;
        onChange({...settings, name: target.value});
    }
</script>

<!-- svelte-ignore a11y_label_has_associated_control -->
<div class="flex flex-col gap-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Widget Name</label>
    <input type="text" value={settings.name} oninput={onNameChange}
           class="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700
                  text-gray-800 dark:text-gray-200 text-sm
                  border border-gray-200 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-blue-500"/>
</div>
