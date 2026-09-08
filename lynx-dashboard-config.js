window.LynxDashboardConfig = Object.freeze({
  activePlan: "FREE",
  plans: Object.freeze({
    FREE: Object.freeze({label: "FREE", assets: ["BTCUSD"], intraday: ["1H"], daily: []}),
    PLUS: Object.freeze({label: "PLUS", assets: ["BTCUSD", "US100", "XAUUSD"], intraday: ["1H", "4H"], daily: ["1D"]}),
    PREMIUM: Object.freeze({label: "PREMIUM", assets: ["BTCUSD", "US100", "XAUUSD", "DXY"], intraday: ["1H", "4H"], daily: ["1D", "2D", "3D", "4D", "5D", "6D", "1W"]}),
    PRO: Object.freeze({label: "PRO", assets: ["BTCUSD", "US100", "XAUUSD", "DXY"], intraday: Array.from({length: 24}, (_, index) => `${index + 1}H`), daily: ["1D", "2D", "3D", "4D", "5D", "6D", "1W"]}),
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
