// P1 #22 (re-audit DoD): axe-core 4.x re-skeniranje javnih rut v svetli
// in temni temi. Izhod: število critical/serious kršitev na ruto.
import { chromium } from "playwright"
import { readFileSync, writeFileSync } from "fs"

const BASE = process.env.BASE_URL || "https://rcbeautysalon-phi.vercel.app"
const ROUTES = [
  "/",
  "/s/rc-beauty",
  "/s/rc-beauty/services",
  "/s/rc-beauty/services/haircut-style",
  "/s/rc-beauty/staff",
  "/s/rc-beauty/shop",
  "/s/rc-beauty/booking",
  "/s/rc-beauty/cart",
  "/s/rc-beauty/shop/cmvv0wro30040p52kdviptdg8",
  "/privacy",
  "/terms",
  "/login",
  "/s/rc-beauty/services/neobstojeca-storitev",
]
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8")

const browser = await chromium.launch()
const results = []
let criticalSerious = 0

for (const theme of ["light", "dark"]) {
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    // next-themes: localStorage theme pred nalaganjem
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    try {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 })
    } catch {
      await page.waitForTimeout(3000)
    }
    await page.addScriptTag({ content: AXE })
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        resultTypes: ["violations"],
      })
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
    })
    const cs = axe.filter((v) => v.impact === "critical" || v.impact === "serious")
    criticalSerious += cs.reduce((s, v) => s + v.nodes, 0)
    results.push({ theme, route, violations: axe, criticalSeriousNodes: cs.reduce((s, v) => s + v.nodes, 0) })
    console.log(`[${theme}] ${route} → ${cs.reduce((s, v) => s + v.nodes, 0)} critical/serious`)
    await ctx.close()
  }
}

await browser.close()
writeFileSync("/tmp/axe-results.json", JSON.stringify(results, null, 1))
console.log("\nSKUPAJ critical/serious vozlišč:", criticalSerious)
