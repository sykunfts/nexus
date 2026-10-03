import asyncio, sys, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
        errors = []
        async def run(name, w, h, actions=None):
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, color_scheme="dark")
            page = await ctx.new_page()
            page.on("console", lambda m: errors.append(f"[{name}] {m.type}: {m.text}") if m.type in ("error","warning") else None)
            page.on("pageerror", lambda e: errors.append(f"[{name}] pageerror: {e}"))
            await page.goto("file:///tmp/claude-0/-home-claude/257f0885-4cfa-5197-81c4-04d07b5fc765/scratchpad/nexus/dist/index.html")
            await page.wait_for_timeout(1500)
            if actions: await actions(page)
            await page.screenshot(path=f"shots/{name}.png", full_page=False)
            sw = await page.evaluate("document.documentElement.scrollWidth"); cw = await page.evaluate("document.documentElement.clientWidth")
            print(name, "scrollWidth", sw, "clientWidth", cw)
            await ctx.close()
        import os; os.makedirs("shots", exist_ok=True)
        await run("home-desktop", 1440, 900)
        async def pdp(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(2500)
        await run("pdp-desktop", 1440, 900, pdp)
        async def pdp_exploded(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(1500)
            await page.click("role=tab[name='Exploded view']")
            await page.wait_for_timeout(1800)
        await run("pdp-exploded", 1440, 900, pdp_exploded)
        async def cart(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(1200)
            await page.click("role=radio[name=/^US/]")
            await page.wait_for_timeout(300)
            btn = page.locator("button:has-text('Add to cart')").first
            await btn.click()
            await page.wait_for_timeout(1200)
        await run("cart-desktop", 1440, 900, cart)
        async def mega(page):
            await page.hover("button:has-text('Smart home')")
            await page.wait_for_timeout(600)
        await run("mega-desktop", 1440, 900, mega)
        async def search(page):
            await page.click("#site-search")
            await page.type("#site-search", "ring")
            await page.wait_for_timeout(500)
        await run("search-desktop", 1440, 900, search)
        async def advisor(page):
            await page.click("button:has-text('Trend Scout')")
            await page.wait_for_timeout(400)
            await page.click("text=Movie night setup under $2,000")
            await page.wait_for_timeout(3500)
        await run("advisor-desktop", 1440, 900, advisor)
        async def specs(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(1200)
            await page.click("role=tab[name='Specifications']")
            await page.wait_for_timeout(500)
            await page.evaluate("document.getElementById('tab-specs').scrollIntoView({block:'start'})")
            await page.wait_for_timeout(400)
        await run("specs-desktop", 1440, 900, specs)
        async def compat(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(1200)
            await page.click("role=tab[name=/Works with/]")
            await page.wait_for_timeout(500)
            await page.evaluate("document.getElementById('tab-compat').scrollIntoView({block:'start'})")
            await page.wait_for_timeout(400)
        await run("compat-desktop", 1440, 900, compat)
        async def compat_pixel(page):
            await page.goto("file:///tmp/claude-0/-home-claude/257f0885-4cfa-5197-81c4-04d07b5fc765/scratchpad/nexus/dist/index.html#/p/anker-maggo-10k")
            await page.wait_for_timeout(1200)
            await page.click("role=tab[name=/Works with/]")
            await page.wait_for_timeout(400)
            await page.click("role=switch[name=/Include Pixel 9/]")
            await page.click("role=switch[name=/Include iPhone/]")
            await page.wait_for_timeout(400)
            await page.evaluate("document.getElementById('tab-compat').scrollIntoView({block:'start'})")
            await page.wait_for_timeout(400)
        await run("compat-pixel", 1440, 900, compat_pixel)
        async def reviews(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(1200)
            await page.click("role=tab[name=/Reviews/]")
            await page.wait_for_timeout(400)
            await page.evaluate("document.getElementById('tab-reviews').scrollIntoView({block:'start'})")
            await page.wait_for_timeout(400)
        await run("reviews-desktop", 1440, 900, reviews)
        async def rails(page):
            await page.evaluate("window.scrollTo(0, 980)")
            await page.wait_for_timeout(600)
        await run("home-rails", 1440, 900, rails)
        async def route_pdp(page):
            await page.goto("file:///tmp/claude-0/-home-claude/257f0885-4cfa-5197-81c4-04d07b5fc765/scratchpad/nexus/dist/index.html#/p/xgimi-mogo-4-laser")
            await page.wait_for_timeout(1500)
            assert await page.locator("h1:has-text('MoGo 4 Laser')").count() == 1, "route #/p/<id> did not open the product"
        await run("route-pdp", 1440, 900, route_pdp)
        async def route_404(page):
            await page.goto("file:///tmp/claude-0/-home-claude/257f0885-4cfa-5197-81c4-04d07b5fc765/scratchpad/nexus/dist/index.html#/nope")
            await page.wait_for_timeout(800)
            assert await page.locator("text=That link did not match").count() == 1, "404 page missing"
        await run("route-404", 1440, 900, route_404)
        BASE = "file:///tmp/claude-0/-home-claude/257f0885-4cfa-5197-81c4-04d07b5fc765/scratchpad/nexus/dist/index.html"
        async def collection(page):
            await page.goto(BASE + "#/c/cinema")
            await page.wait_for_timeout(1200)
            await page.click("label:has-text('Sydney stock')")
            await page.wait_for_timeout(600)
            assert "#/c/cinema?f=route" in page.url, page.url
        await run("collection-desktop", 1440, 900, collection)
        async def collection_zero(page):
            await page.goto(BASE + "#/c/alexa")
            await page.wait_for_timeout(1200)
            n0 = await page.locator("article").count()
            await page.click("role=switch[name=/Only show products that work/]")
            await page.wait_for_timeout(600)
            n1 = await page.locator("article").count()
            print("collection-zero: alexa", n0, "→ works-with", n1)
            if n1 == 0:
                assert await page.locator("text=Nothing matches that yet").count() == 1
            await page.click("role=switch[name=/Only show products that work/]")
            await page.wait_for_timeout(400)
            assert await page.locator("article").count() == n0
        await run("collection-zero", 1440, 900, collection_zero)
        async def search_results(page):
            await page.click("#site-search")
            await page.type("#site-search", "ring")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1000)
            assert "#/search?q=ring" in page.url, page.url
            assert await page.locator("article").count() >= 4
        await run("search-results", 1440, 900, search_results)
        async def mega_link(page):
            await page.hover("button:has-text('Smart home')")
            await page.wait_for_timeout(500)
            await page.click("a:has-text('Robot vacuums')")
            await page.wait_for_timeout(900)
            assert "#/c/robot-vacuums" in page.url, page.url
        await run("mega-link", 1440, 900, mega_link)
        async def collection_mobile(page):
            await page.goto(BASE + "#/c/wearables")
            await page.wait_for_timeout(1200)
            await page.click("button:has-text('Filters')")
            await page.wait_for_timeout(500)
        await run("collection-mobile", 390, 820, collection_mobile)
        async def setup_page(page):
            await page.goto(BASE + "#/setup")
            await page.wait_for_timeout(1200)
            await page.select_option("select >> nth=0", "UK")
            await page.wait_for_timeout(400)
            await page.goto(BASE + "#/p/xgimi-mogo-4-laser")
            await page.wait_for_timeout(1500)
            txt = await page.locator("button:has-text('Needs attention')").count()
            assert txt >= 1, "UK region should flag the AU plug"
            await page.goto(BASE + "#/setup")
            await page.wait_for_timeout(1000)
        await run("setup-desktop", 1440, 900, setup_page)
        async def compare_rings(page):
            await page.goto(BASE + "#/compare?ids=ringconn-gen-3%2Coura-ring-5")
            await page.wait_for_timeout(1200)
            row = page.locator("tr:has(td:text-is('Battery'))")
            assert await row.count() == 1, "Battery row missing"
            cells = row.locator("td[data-winner='true']")
            assert await cells.count() == 1 and "14" in (await cells.first.inner_text()), "RingConn should win Battery"
        await run("compare-rings", 1440, 900, compare_rings)
        await run("home-mobile", 400, 820)
        async def pdp_m(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(2500)
        await run("pdp-mobile", 400, 820, pdp_m)
        await b.close()
        print("\n".join(errors[:40]) if errors else "no console errors")
asyncio.run(main())
