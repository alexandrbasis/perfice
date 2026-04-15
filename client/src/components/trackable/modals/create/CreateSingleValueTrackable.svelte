<script lang="ts">
    import {questionDataTypeRegistry} from "@perfice/model/form/data.js";
    import {FormQuestionDataType} from "@perfice/model/form/form";
    import IconPickerButton from "@perfice/components/base/iconPicker/IconPickerButton.svelte";
    import SelectCardButton from "@perfice/components/base/button/SelectCardButton.svelte";

    let {isSport = false}: {isSport?: boolean} = $props();

    let name = $state("");
    let icon = $state("");
    let selectedTypes = $state<FormQuestionDataType[]>(isSport ? [FormQuestionDataType.TIME_ELAPSED] : []);

    const IGNORED_TYPES = [FormQuestionDataType.HIERARCHY];

    function selectQuestionType(newType: string) {
        let type = newType as FormQuestionDataType;
        if (!isSport) {
            selectedTypes = [type];
            return;
        }

        if (type === FormQuestionDataType.TIME_ELAPSED) return;

        selectedTypes = selectedTypes.includes(type)
            ? selectedTypes.filter(t => t !== type)
            : [...selectedTypes, type];
    }

    export function getData(): { name: string, icon: string, types: FormQuestionDataType[] } | null {
        let orderedTypes = definitions
            .map(([type, _]) => type as FormQuestionDataType)
            .filter(type => selectedTypes.includes(type));

        if (orderedTypes.length === 0) return null;
        if (isSport && !orderedTypes.includes(FormQuestionDataType.TIME_ELAPSED)) return null;

        return {
            name,
            icon,
            types: orderedTypes
        }
    }

    let definitions = questionDataTypeRegistry.getDefinitions()
        .filter(([type, _]) => !IGNORED_TYPES.includes(type as FormQuestionDataType));
</script>

<p class="label">Name & icon</p>
<div class="row-gap w-full">
    <input id="first_name" bind:value={name} placeholder="Trackable name" type="text"
           class="input flex-1">
    <IconPickerButton right={true} icon={icon} onChange={(i) => icon = i}/>
</div>
<p class="label mt-4">Type</p>
{#if isSport}
    <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">Time elapsed is required. Select Date as well to record the workout date.</p>
{/if}
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
    {#each definitions as [type, definition]}
        <SelectCardButton iconClass="w-8" icon={definition.getIcon()} title={definition.getName()}
                          description=""
                          selected={selectedTypes.includes(type as FormQuestionDataType)}
                          onSelect={() => selectQuestionType(type)}/>
    {/each}
</div>
