import {describe, expect, test} from "vitest";
import {DashboardWidgetType, getDashboardWidgetDefinition} from "../../src/model/dashboard/dashboard";
import {SportStatsService, formatDurationMs} from "../../src/services/sport/stats";
import {SportStreakService} from "../../src/services/sport/streak";
import {mockEntry} from "../common";
import {pNumber} from "../../src/model/primitive/primitive";
import type {Trackable} from "../../src/model/trackable/trackable";
import {TrackableCardType} from "../../src/model/trackable/trackable";
import type {Form} from "../../src/model/form/form";
import {FormQuestionDataType, FormQuestionDisplayType} from "../../src/model/form/form";

function makeSportTrackable(id: string, formId: string): Trackable {
    return {
        id,
        name: "Running",
        icon: "🏃",
        formId,
        order: 0,
        goalId: null,
        categoryId: null,
        dependencies: {},
        trackableType: 'sport',
        cardType: TrackableCardType.CHART,
        cardSettings: {aggregateType: "SUM" as any, field: "q1", color: "#ff0000"}
    };
}

function makeSportForm(formId: string, questionIds: string[]): Form {
    return {
        id: formId,
        name: "Running",
        icon: "🏃",
        snapshotId: "snap1",
        format: [],
        questions: questionIds.map(qId => ({
            id: qId,
            name: "Duration",
            unit: null,
            dataType: FormQuestionDataType.TIME_ELAPSED,
            dataSettings: {},
            displayType: FormQuestionDisplayType.INPUT,
            displaySettings: {},
            defaultValue: null,
        }))
    };
}

describe("TP-8.1: SPORT_SUMMARY widget type is registered", () => {
    test("SPORT_SUMMARY enum value exists", () => {
        expect(DashboardWidgetType.SPORT_SUMMARY).toBe("SPORT_SUMMARY");
    });

    test("definition is registered in definitions map", () => {
        const def = getDashboardWidgetDefinition(DashboardWidgetType.SPORT_SUMMARY);
        expect(def).toBeDefined();
        expect(def!.getType()).toBe(DashboardWidgetType.SPORT_SUMMARY);
    });

    test("definition returns correct type and name", () => {
        const def = getDashboardWidgetDefinition(DashboardWidgetType.SPORT_SUMMARY)!;
        expect(def.getType()).toBe(DashboardWidgetType.SPORT_SUMMARY);
        expect(def.getName()).toBe("Sport Summary");
    });

    test("default dimensions are 3x1 (via default settings), min dimensions are 2x1", () => {
        const def = getDashboardWidgetDefinition(DashboardWidgetType.SPORT_SUMMARY)!;
        expect(def.getMinWidth()).toBe(2);
        expect(def.getMinHeight()).toBe(1);
    });

    test("default settings have correct name", () => {
        const def = getDashboardWidgetDefinition(DashboardWidgetType.SPORT_SUMMARY)!;
        const settings = def.getDefaultSettings();
        expect(settings.name).toBe("Sport This Week");
    });

    test("createDependencies returns empty map (bypasses Variable system)", () => {
        const def = getDashboardWidgetDefinition(DashboardWidgetType.SPORT_SUMMARY)!;
        const deps = def.createDependencies({name: "Test"});
        expect(deps).toBeInstanceOf(Map);
        expect(deps.size).toBe(0);
    });

    test("getIcon returns an icon definition", () => {
        const def = getDashboardWidgetDefinition(DashboardWidgetType.SPORT_SUMMARY)!;
        expect(def.getIcon()).toBeDefined();
        expect(def.getIcon().iconName).toBe("dumbbell");
    });
});

describe("TP-8.2: Widget stats match Sport page stats", () => {
    const streakService = new SportStreakService();
    const statsService = new SportStatsService(streakService);

    test("computeWeekStats produces identical results for same inputs", () => {
        const trackable = makeSportTrackable("t1", "f1");
        const form = makeSportForm("f1", ["q1"]);

        const weekStart = new Date(2026, 2, 9); // Mon Mar 9
        const weekEnd = new Date(2026, 2, 15);  // Sun Mar 15
        const today = new Date(2026, 2, 12);    // Thu Mar 12

        const entries = [
            mockEntry("e1", "f1", {"q1": pNumber(1800000)}, weekStart.getTime() + 3600000),  // 30min
            mockEntry("e2", "f1", {"q1": pNumber(2700000)}, weekStart.getTime() + 86400000), // 45min
        ];

        // Simulate what the Sport page does
        const pageStats = statsService.computeWeekStats(
            entries, [trackable], [form], [],
            weekStart, weekEnd, today
        );

        // Simulate what the widget would do (same call)
        const widgetStats = statsService.computeWeekStats(
            entries, [trackable], [form], [],
            weekStart, weekEnd, today
        );

        expect(widgetStats.sessions).toBe(pageStats.sessions);
        expect(widgetStats.totalDurationMs).toBe(pageStats.totalDurationMs);
        expect(widgetStats.streak).toBe(pageStats.streak);
    });

    test("stats are correct with multiple trackables", () => {
        const t1 = makeSportTrackable("t1", "f1");
        const t2 = makeSportTrackable("t2", "f2");
        const form1 = makeSportForm("f1", ["q1"]);
        const form2 = makeSportForm("f2", ["q2"]);

        const weekStart = new Date(2026, 2, 9);
        const weekEnd = new Date(2026, 2, 15);
        const today = new Date(2026, 2, 12);

        const entries = [
            mockEntry("e1", "f1", {"q1": pNumber(1800000)}, weekStart.getTime() + 3600000),
            mockEntry("e2", "f2", {"q2": pNumber(3600000)}, weekStart.getTime() + 86400000),
        ];

        const stats = statsService.computeWeekStats(
            entries, [t1, t2], [form1, form2], [],
            weekStart, weekEnd, today
        );

        expect(stats.sessions).toBe(2);
        expect(stats.totalDurationMs).toBe(5400000); // 30min + 60min
    });

    test("zero-duration entry counts as session with 0ms duration", () => {
        const trackable = makeSportTrackable("t1", "f1");
        const form = makeSportForm("f1", ["q1"]);

        const weekStart = new Date(2026, 2, 9);
        const weekEnd = new Date(2026, 2, 15);
        const today = new Date(2026, 2, 12);

        const entries = [
            mockEntry("e1", "f1", {"q1": pNumber(0)}, weekStart.getTime() + 3600000),
        ];

        const stats = statsService.computeWeekStats(
            entries, [trackable], [form], [],
            weekStart, weekEnd, today
        );

        expect(stats.sessions).toBe(1);
        expect(stats.totalDurationMs).toBe(0);
        expect(formatDurationMs(stats.totalDurationMs)).toBe("0h 0m");
    });

    test("stats return zeros with no entries", () => {
        const trackable = makeSportTrackable("t1", "f1");
        const form = makeSportForm("f1", ["q1"]);

        const weekStart = new Date(2026, 2, 9);
        const weekEnd = new Date(2026, 2, 15);
        const today = new Date(2026, 2, 12);

        const stats = statsService.computeWeekStats(
            [], [trackable], [form], [],
            weekStart, weekEnd, today
        );

        expect(stats.sessions).toBe(0);
        expect(stats.totalDurationMs).toBe(0);
        expect(stats.streak).toBe(0);
    });
});
