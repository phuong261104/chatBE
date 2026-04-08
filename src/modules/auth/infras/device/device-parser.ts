import { UAParser } from "ua-parser-js";
import { DeviceDetails, Platform } from "@share/interface";

const APP_PATTERNS = [
  /app\/[\d.]+\s*/i,
  /com\.\w+\.\w+/i,
  /\bwv\b/i,
  /webview/i,
  /;\s*wb\s*/i,
  /\[FBAN|FBIOS|FB4A\]/i,
  /MobileConfig/i,
];

const MOBILE_PATTERN = /android|iphone|ipod|blackberry|windows phone|mobile/i;
const TABLET_PATTERN = /tablet|ipad|playbook|silk|kindle|nexus 7/i;

function detectPlatform(ua: string): Platform {
  const lowerUA = ua.toLowerCase();
  for (const pattern of APP_PATTERNS) {
    if (pattern.test(lowerUA)) {
      return "app";
    }
  }
  return "web";
}

function detectDeviceTypeCategory(ua: string): "mobile" | "tablet" | "other" {
  const lowerUA = ua.toLowerCase();
  if (MOBILE_PATTERN.test(lowerUA)) {
    return "mobile";
  }
  if (TABLET_PATTERN.test(lowerUA)) {
    return "tablet";
  }
  return "other";
}

export function parseUserAgent(uaString: string): DeviceDetails {
  const ua = new UAParser(uaString);
  const result = ua.getResult();

  const platform: Platform = detectPlatform(uaString);
  const deviceCategory = detectDeviceTypeCategory(uaString);

  if (platform === "app" && (deviceCategory === "mobile" || deviceCategory === "tablet")) {
    const model = result.device.model;
    if (model) {
      return { displayLabel: model, platform };
    }
    const osName = result.os.name;
    return { displayLabel: osName ? `${osName} Device` : "Unknown", platform };
  }

  const browserName = result.browser.name || "Unknown Browser";
  const osName = result.os.name || "Unknown OS";

  if (browserName !== "Unknown Browser" && osName !== "Unknown OS") {
    return { displayLabel: `${browserName} - ${osName}`, platform };
  }
  if (browserName !== "Unknown Browser") {
    return { displayLabel: browserName, platform };
  }
  if (osName !== "Unknown OS") {
    return { displayLabel: osName, platform };
  }
  return { displayLabel: "Unknown", platform };
}
