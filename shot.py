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
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(600)
            await page.click("#site-search")
            await page.type("#site-search", "MagGo")
            await page.wait_for_timeout(500)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1000)
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
        await run("home-mobile", 400, 820)
        async def pdp_m(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(2500)
        await run("pdp-mobile", 400, 820, pdp_m)
        await b.close()
        print("\n".join(errors[:40]) if errors else "no console errors")
asyncio.run(main())
