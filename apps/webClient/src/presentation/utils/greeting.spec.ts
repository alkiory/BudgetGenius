import { describe, expect, it } from "vitest";
import en from "../../infrastructure/i18n/locales/en.json";
import es from "../../infrastructure/i18n/locales/es.json";
import {
  getTimeOfDay,
  MAX_GREETINGS_PER_PERIOD,
  pickRandomGreeting,
} from "./greeting";

describe("getTimeOfDay", () => {
  it.each([
    { hour: 5, minute: 0, expected: "morning" },
    { hour: 9, minute: 0, expected: "morning" },
    { hour: 11, minute: 59, expected: "morning" },
    { hour: 12, minute: 0, expected: "afternoon" },
    { hour: 17, minute: 45, expected: "afternoon" },
    { hour: 18, minute: 59, expected: "afternoon" },
    { hour: 19, minute: 0, expected: "night" },
    { hour: 23, minute: 30, expected: "night" },
    { hour: 0, minute: 0, expected: "night" },
    { hour: 4, minute: 59, expected: "night" },
  ])(
    "returns $expected at $hour:$minute",
    ({ hour, minute, expected }) => {
      const date = new Date(2026, 0, 1, hour, minute, 0);
      expect(getTimeOfDay(date)).toBe(expected);
    },
  );
});

describe("pickRandomGreeting", () => {
  it("returns empty string when given an empty list", () => {
    expect(pickRandomGreeting([])).toBe("");
  });

  it("picks an item deterministically using the provided random function", () => {
    const messages = ["a", "b", "c", "d", "e", "f", "g"];
    expect(pickRandomGreeting(messages, () => 0)).toBe("a");
    expect(pickRandomGreeting(messages, () => 0.5)).toBe("d");
    expect(pickRandomGreeting(messages, () => 0.99)).toBe("g");
  });

  it("caps selection to at most MAX_GREETINGS_PER_PERIOD items", () => {
    const messages = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    expect(MAX_GREETINGS_PER_PERIOD).toBe(7);
    expect(pickRandomGreeting(messages, () => 0.9999)).toBe("7");
  });
});

describe("dashboard greeting locales", () => {
  it.each(["morning", "afternoon", "night"] as const)(
    "provides up to 7 non-empty %s greetings in es and en",
    (period) => {
      const esList = es.dashboard.greetings[period];
      const enList = en.dashboard.greetings[period];

      expect(esList.length).toBeGreaterThan(0);
      expect(esList.length).toBeLessThanOrEqual(MAX_GREETINGS_PER_PERIOD);
      expect(enList.length).toBeGreaterThan(0);
      expect(enList.length).toBeLessThanOrEqual(MAX_GREETINGS_PER_PERIOD);

      for (const msg of [...esList, ...enList]) {
        expect(msg.trim().length).toBeGreaterThan(0);
      }
    },
  );
});
