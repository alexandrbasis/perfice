import {type DashboardWidgetDefinition, DashboardWidgetType} from "@perfice/model/dashboard/dashboard";
import type {Variable} from "@perfice/model/variable/variable";
import {faDumbbell, type IconDefinition} from "@fortawesome/free-solid-svg-icons";

export interface DashboardSportSummaryWidgetSettings {
    name: string;
}

export class DashboardSportSummaryWidgetDefinition implements DashboardWidgetDefinition<DashboardWidgetType.SPORT_SUMMARY, DashboardSportSummaryWidgetSettings> {
    getType(): DashboardWidgetType.SPORT_SUMMARY {
        return DashboardWidgetType.SPORT_SUMMARY;
    }

    getName(): string {
        return "Sport Summary";
    }

    getIcon(): IconDefinition {
        return faDumbbell;
    }

    getMinHeight(): number | undefined {
        return 1;
    }

    getMinWidth(): number | undefined {
        return 2;
    }

    getDefaultSettings(): DashboardSportSummaryWidgetSettings {
        return {
            name: "Sport This Week"
        };
    }

    // Sport stats bypass the Variable system — computed directly from sport services
    createDependencies(settings: DashboardSportSummaryWidgetSettings): Map<string, Variable> {
        return new Map();
    }
}
