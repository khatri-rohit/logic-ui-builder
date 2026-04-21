import puppeteer from "puppeteer";
import logger from "@/lib/logger";

interface CaptureViewport {
  width: number;
  height: number;
}

interface CaptureProjectThumbnailOptions {
  viewport?: CaptureViewport;
  cookieHeader?: string | null;
}

interface ParsedCookie {
  name: string;
  value: string;
}

function parseCookieHeader(cookieHeader: string): ParsedCookie[] {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!name || !value) {
        return null;
      }

      return { name, value };
    })
    .filter((cookie): cookie is ParsedCookie => cookie !== null);
}

export async function captureProjectThumbnail(
  url: string,
  options: CaptureProjectThumbnailOptions = {},
): Promise<Buffer> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const targetUrl = new URL(url);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport(viewport);

    if (options.cookieHeader) {
      const cookies = parseCookieHeader(options.cookieHeader).map((cookie) => ({
        ...cookie,
        url: targetUrl.origin,
      }));

      if (cookies.length > 0) {
        await page.setCookie(...cookies);
      }
    }

    // Navigate to the project page
    await page.goto(targetUrl.toString(), {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector("iframe", { timeout: 5000 }).catch(() => {
      // Canvas can still be ready without a visible iframe at capture instant.
    });

    // Give some extra time for iframes to load and render
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 80,
      fullPage: false,
    });

    return Buffer.from(screenshot);
  } catch (error) {
    logger.error("Puppeteer capture failed:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
