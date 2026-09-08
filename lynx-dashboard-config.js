window.LynxDashboardConfig = Object.freeze({
  plans: Object.freeze({
    FREE: Object.freeze({label: "FREE", rank: 10, assets: ["BTCUSD", "US100"], intraday: ["1H"], daily: [], features: ["community.read", "dominance.basic", "market.core", "weather.basic"]}),
    WEATHER: Object.freeze({label: "WEATHER", rank: 20, assets: ["BTCUSD", "US100", "XAUUSD", "DXY"], intraday: ["1H", "4H"], daily: ["1D"], features: ["community.read", "dominance.basic", "history.basic", "macro.dxy", "market.core", "market.expanded", "weather.basic", "weather.expanded"]}),
    PRO: Object.freeze({label: "PRO", rank: 30, assets: ["BTCUSD", "US100", "XAUUSD", "DXY"], intraday: Array.from({length: 24}, (_, index) => `${index + 1}H`), daily: ["1D", "2D", "3D", "4D", "5D", "6D", "1W"], features: ["community.read", "dominance.basic", "history.basic", "history.extended", "macro.dxy", "market.core", "market.expanded", "viewer.access", "viewer.professional_details", "weather.basic", "weather.expanded"]}),
    PREMIUM: Object.freeze({label: "PREMIUM", rank: 40, assets: ["BTCUSD", "US100", "XAUUSD", "DXY"], intraday: Array.from({length: 24}, (_, index) => `${index + 1}H`), daily: ["1D", "2D", "3D", "4D", "5D", "6D", "1W"], features: ["community.read", "dominance.basic", "history.basic", "history.extended", "macro.dxy", "market.core", "market.expanded", "viewer.access", "viewer.professional_details", "weather.basic", "weather.expanded", "export.data", "satellite.as2", "satellite.as3"]}),
  }),
  dailyTimeframes: Object.freeze(["1D", "2D", "3D", "4D", "5D", "6D", "1W"]),
  intradayTimeframes: Object.freeze(Array.from({length: 24}, (_, index) => `${index + 1}H`)),
  weatherBands: Object.freeze([
    Object.freeze({min: 0, max: 25, icon: "🌧️", label: "비"}),
    Object.freeze({min: 26, max: 51, icon: "☁️", label: "구름"}),
    Object.freeze({min: 52, max: 75, icon: "🌤️", label: "구름 조금"}),
    Object.freeze({min: 76, max: 100, icon: "☀️", label: "화창"}),
  ]),
});
