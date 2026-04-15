<script lang="ts">
    import {questionDataTypeRegistry} from "@perfice/model/form/data.js";
    import {FormQuestionDataType} from "@perfice/model/form/form";
    import IconPickerButton from "@perfice/components/base/iconPicker/IconPickerButton.svelte";
    import SelectCardButton from "@perfice/components/base/button/SelectCardButton.svelte";

    let {isSport = false}: {isSport?: boolean} = $props();

    let name = $state("");
    let icon = $state("");
    let selectedType = $state("");

    const IGNORED_TYPES = [FormQuestionDataType.HIERARCHY];

    function selectQuestionType(newType: string) {
        selectedType = newType;
    }

    export function getData(): { name: string, icon: string, type: FormQuestionDataType } | null {
        if (selectedType == "") return null;

        return {
            name,
            icon,
            type: selectedType as FormQuestionDataType
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
    <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">Sport trackables require a duration (time elapsed) field</p>
{/if}
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
    {#each definitions as [type, definition]}
        <div class={isSport && type === FormQuestionDataType.TIME_ELAPSED ? 'ring-2 ring-blue-500 rounded-xl' : ''}>
            <SelectCardButton iconClass="w-8" icon={definition.getIcon()} title={definition.getName()}
                              description=""
                              selected={selectedType === type}
                              onSelect={() => selectQuestionType(type)}/>
        </div>
    {/each}
</div>