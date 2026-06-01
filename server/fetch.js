import { chromium } from 'playwright'

/**
 * Launches a browser, navigates to url, returns the page handle + serialised HTML.
 * Caller is responsible for calling browser.close() when done.
 */
export async function createBrowser() {
  return chromium.launch()
}

export async function fetchPage(url, browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  const html = await page.content()
  const elementsScanned = await page.evaluate(() =>
    document.querySelectorAll('*').length
  )
  return { page, html, elementsScanned }
}

export async function loadHtml(html, browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  const elementsScanned = await page.evaluate(() =>
    document.querySelectorAll('*').length
  )
  return { page, html, elementsScanned }
}
