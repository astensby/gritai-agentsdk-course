import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// SAME tools as step 3 — but the handlers now call a REAL weather service:
// the free, no-API-key Open-Meteo API, over plain `fetch` (built into Node since 18).
// That's the payoff of a custom tool: wrap *any* function, including a live
// HTTP API, and the agent can call it. (Needs an internet connection; if a
// call fails the handler returns a friendly message and the agent recovers.)

// WMO weather codes → a short human description. See https://open-meteo.com/en/docs
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

const describe = (code: number) => WEATHER_CODES[code] ?? "Unknown conditions";

type GeoPlace = { name: string; country: string; latitude: number; longitude: number };

// Resolve a city name to coordinates via Open-Meteo's geocoding API (no key).
async function geocode(city: string): Promise<GeoPlace | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=en&format=json`;
  const data = (await (await fetch(url)).json()) as { results?: GeoPlace[] };
  return data.results?.[0] ?? null;
}

const getWeather = tool(
  "getWeather",
  "Get the current weather for a city. Returns a one-line description and temperature in Celsius.",
  {
    city: z.string().describe("City name, e.g. 'Oslo' or 'San Francisco'."),
  },
  async ({ city }) => {
    const place = await geocode(city);
    if (!place) {
      return { content: [{ type: "text", text: `Couldn't find a place called "${city}".` }] };
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`;
    const wx = (await (await fetch(url)).json()) as {
      current?: { temperature_2m: number; weather_code: number };
    };
    if (!wx.current) {
      return { content: [{ type: "text", text: `No current weather available for ${place.name}.` }] };
    }
    return {
      content: [
        {
          type: "text",
          text: `${place.name}, ${place.country}: ${describe(
            wx.current.weather_code
          )}, ${Math.round(wx.current.temperature_2m)}°C`,
        },
      ],
    };
  }
);

const getForecast = tool(
  "getForecast",
  "Get a multi-day weather forecast for a city.",
  {
    city: z.string().describe("City name."),
    days: z.number().int().min(1).max(7).describe("Forecast horizon, 1-7 days."),
  },
  async ({ city, days }) => {
    const place = await geocode(city);
    if (!place) {
      return { content: [{ type: "text", text: `Couldn't find a place called "${city}".` }] };
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=${days}&timezone=auto`;
    const data = (await (await fetch(url)).json()) as {
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    };
    const d = data.daily;
    if (!d) {
      return { content: [{ type: "text", text: `No forecast available for ${place.name}.` }] };
    }
    const lines = d.time
      .map(
        (date, i) =>
          `  ${date}: ${describe(d.weather_code[i])}, ${Math.round(
            d.temperature_2m_min[i]
          )}–${Math.round(d.temperature_2m_max[i])}°C`
      )
      .join("\n");
    return {
      content: [{ type: "text", text: `Forecast for ${place.name}, ${place.country}:\n${lines}` }],
    };
  }
);

export const weatherServer = createSdkMcpServer({
  name: "weather",
  version: "1.0.0",
  tools: [getWeather, getForecast],
});
