const SVG_NS = "http://www.w3.org/2000/svg";
const svgElement = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

export function createWeatherSymbol(iconCode) {
  const code = String(iconCode || "LOADING").toUpperCase();
  const svg = svgElement("svg", {viewBox: "0 0 64 64", focusable: "false", "aria-hidden": "true"});
  svg.classList.add("weather-symbol", `weather-symbol--${code.toLowerCase().replaceAll("_", "-")}`);
  const stroke = {fill: "none", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round"};
  const cloud = () => svg.append(svgElement("path", {...stroke, class: "weather-symbol-cloud", d: "M17 46h29a10 10 0 0 0 1.8-19.8A15 15 0 0 0 19.5 29 8.5 8.5 0 0 0 17 46Z"}));
  if (code === "SUNNY") {
    svg.append(svgElement("circle", {...stroke, class: "weather-symbol-sun", cx: "32", cy: "32", r: "10"}));
    for (const [x1, y1, x2, y2] of [[32,7,32,14],[32,50,32,57],[7,32,14,32],[50,32,57,32],[14,14,19,19],[45,45,50,50],[50,14,45,19],[19,45,14,50]]) svg.append(svgElement("path", {...stroke, class: "weather-symbol-sun", d: `M${x1} ${y1} ${x2} ${y2}`}));
  } else if (code === "PARTLY_CLOUDY" || code === "MOSTLY_CLOUDY") {
    svg.append(svgElement("circle", {...stroke, class: "weather-symbol-sun", cx: "24", cy: "23", r: "9"})); cloud();
  } else if (["RAIN", "SHOWERS", "STORM"].includes(code)) {
    cloud(); for (const [x1, y1, x2, y2] of [[23,50,20,56],[33,50,30,56],[43,50,40,56]]) svg.append(svgElement("path", {...stroke, class: "weather-symbol-rain", d: `M${x1} ${y1} ${x2} ${y2}`}));
  } else if (code === "LOADING" || code === "WAITING") {
    svg.append(svgElement("circle", {...stroke, cx: "32", cy: "32", r: "15", "stroke-dasharray": "52 16"})); svg.append(svgElement("path", {...stroke, d: "M32 17v4"}));
  } else { cloud(); svg.append(svgElement("path", {...stroke, d: "M22 52h20"})); }
  return svg;
}

if (typeof window !== "undefined") window.AiLynxWeatherSymbols = Object.freeze({createWeatherSymbol});
