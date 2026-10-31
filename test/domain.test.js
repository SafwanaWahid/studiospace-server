import test from "node:test";
import assert from "node:assert/strict";
import {
  studioInput,
  bookingTimes,
  overlapQuery,
  passwordValid,
  safeImage,
} from "../domain.js";
const studio = {
  title: "Daylight Loft",
  category: "Photo Studio",
  hourlyRate: 60,
  deposit: 100,
  capacity: 8,
  location: "Dhaka, Bangladesh",
  overview:
    "A bright daylight studio with room for your next portrait session.",
  images: ["https://example.com/studio.jpg"],
  amenities: ["Wi-Fi", "Wi-Fi"],
};
test("studio validation permits valid numeric values and deduplicates amenities", () => {
  assert.equal(studioInput(studio).hourlyRate, 60);
  assert.deepEqual(studioInput(studio).amenities, ["Wi-Fi"]);
});
test("rejects missing prices, fractional capacity and unsafe image protocols", () => {
  for (const patch of [
    { hourlyRate: "" },
    { capacity: 1.5 },
    { deposit: -1 },
    { images: ["javascript:alert(1)"] },
    { category: "Unknown" },
    { overview: "too short" },
  ])
    assert.throws(() => studioInput({ ...studio, ...patch }));
});
test("image protocols and password rules", () => {
  assert.equal(safeImage("data:text/html,x"), false);
  assert.equal(passwordValid("abcdef"), false);
  assert.equal(passwordValid("ABCDEF"), false);
  assert.equal(passwordValid("Abcdef"), true);
});
test("valid booking duration and future times", () => {
  const now = Date.parse("2030-01-01T00:00:00Z");
  const result = bookingTimes(
    { start: "2030-01-02T10:00:00Z", end: "2030-01-02T12:30:00Z" },
    now,
  );
  assert.equal(result.hours, 2.5);
});
test("rejects past, reversed, invalid, and excessively long booking times", () => {
  const now = Date.parse("2030-01-01T00:00:00Z");
  for (const [start, end] of [
    ["2020-01-01", "2020-01-02"],
    ["2030-01-02T12:00Z", "2030-01-02T10:00Z"],
    ["invalid", "2030-01-02"],
    ["2030-01-02", "2030-01-04"],
  ])
    assert.throws(() => bookingTimes({ start, end }, now));
});
test("overlap query uses strict boundaries so back-to-back sessions are allowed", () => {
  const start = new Date("2030-01-02T10:00Z");
  const end = new Date("2030-01-02T12:00Z");
  assert.deepEqual(overlapQuery("studio", start, end), {
    studioId: "studio",
    status: "Confirmed",
    start: { $lt: end },
    end: { $gt: start },
  });
});
