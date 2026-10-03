import asyncio, os, sys, json
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
        BASE = "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist", "index.html")
        async def collection(page):
            await page.goto(BASE + "#/c/cinema")
            await page.wait_for_timeout(1200)
            await page.click("label:has-text('Sydney stock')")
            await page.wait_for_timeout(600)
            assert "#/c/cinema?f=route" in page.url, page.url
        await run("collection-desktop", 1440, 900, collection)
        async def collection_zero(page):
            # a price floor no cinema product reaches: the zero state, three suggestions, and Clear filters restores the shelf
            await page.goto(BASE + "#/c/cinema?f=price:2000-inf")
            await page.wait_for_timeout(1200)
            assert await page.locator("text=Nothing matches that yet").count() == 1
            n_suggest = await page.locator("article").count()
            print("collection-zero: cinema ≥ $2000 → 0 results,", n_suggest, "suggestions")
            assert n_suggest == 3, n_suggest
            await page.click("button:has-text('Clear filters')")
            await page.wait_for_timeout(600)
            assert "price" not in page.url, page.url
            n = await page.locator("article").count()
            assert n > 3, n
            assert await page.locator("text=Nothing matches that yet").count() == 0
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
        async def checkout_au(page):
            await page.goto(BASE + "#/p/xgimi-mogo-4-laser"); await page.wait_for_timeout(1000)
            await page.locator("button:has-text('Add to cart')").first.click(); await page.wait_for_timeout(600)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            await page.goto(BASE + "#/p/anker-maggo-10k"); await page.wait_for_timeout(1000)
            await page.locator("button:has-text('Add to cart')").first.click(); await page.wait_for_timeout(600)
            await page.click("button:has-text('Full checkout')"); await page.wait_for_timeout(800)
            await page.fill("input[type='email']", "nick@example.com")
            await page.click("button:has-text('Continue to delivery')"); await page.wait_for_timeout(400)
            await page.fill("input[name='name']", "Nick M")
            await page.fill("input[name='line1']", "1 Test Street")
            await page.fill("input[name='city']", "Melbourne")
            await page.fill("input[name='postcode']", "3000")
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(400)
            err = await page.locator("text=/Postcode 3000 is in VIC/").count()
            assert err == 1, "expected the VIC postcode error"
            await page.select_option("select[autocomplete='address-level1']", "VIC")
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(500)
            assert await page.locator("text=/Shipment|shipments to Australia|Supplier, ships from China/").count() >= 1
            await page.click("button:has-text('Continue to payment')"); await page.wait_for_timeout(400)
            await page.fill("input[autocomplete='cc-number']", "4242 4242 4242 4242")
            await page.fill("input[autocomplete='cc-exp']", "12/28")
            await page.fill("input[autocomplete='cc-csc']", "123")
            await page.fill("input[autocomplete='cc-name']", "Nick M")
            await page.click("button:has-text('Review the order')"); await page.wait_for_timeout(500)
            await page.screenshot(path="shots/checkout-review.png")
            await page.click("button:has-text('Place order')"); await page.wait_for_timeout(1200)
            assert "/confirmed" in page.url, page.url
            assert await page.locator("text=Shipment 1 of 2").count() == 1, "expected two shipments"
        await run("checkout-au", 1440, 900, checkout_au)
        async def checkout_uk(page):
            await page.goto(BASE + "#/p/xgimi-mogo-4-laser"); await page.wait_for_timeout(1000)
            await page.locator("button:has-text('Add to cart')").first.click(); await page.wait_for_timeout(600)
            await page.click("button:has-text('Full checkout')"); await page.wait_for_timeout(800)
            await page.fill("input[type='email']", "nick@example.com")
            await page.click("button:has-text('Continue to delivery')"); await page.wait_for_timeout(400)
            if await page.locator("button[role='radio']:has-text('New address')").count(): await page.click("button[role='radio']:has-text('New address')")
            await page.select_option("select[autocomplete='country']", "GB")
            await page.fill("input[name='name']", "Nick M"); await page.fill("input[name='line1']", "10 Downing Street"); await page.fill("input[name='city']", "London"); await page.fill("input[name='postcode']", "SW1A 1AA")
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(500)
            assert await page.locator("text=VAT 20 %").count() >= 1, "VAT line missing"
        await run("checkout-uk", 1440, 900, checkout_uk)
        async def account_out(page):
            await page.goto(BASE + "#/account"); await page.wait_for_timeout(1000)
            assert await page.locator("h1:has-text('Sign in')").count() == 1
        await run("account-signed-out", 1440, 900, account_out)
        async def account_in(page):
            await page.goto(BASE + "#/account"); await page.wait_for_timeout(1000)
            await page.fill("input[type='email']", "nick@example.com"); await page.click("button:has-text('Sign in')"); await page.wait_for_timeout(500)
            await page.click("section:has(h2:text-is('Addresses')) >> button:text-is('Add')"); await page.wait_for_timeout(300)
            await page.fill("input[name='name']", "Nick M"); await page.fill("input[name='line1']", "1 Test Street"); await page.fill("input[name='city']", "Sydney"); await page.fill("input[name='postcode']", "2000")
            await page.click("button:has-text('Save address')"); await page.wait_for_timeout(500)
            assert await page.locator("text=1 Test Street").count() >= 1
        await run("account-signed-in", 1440, 900, account_in)
        async def orders_list(page):
            await page.goto(BASE + "#/p/chipolo-pop"); await page.wait_for_timeout(1000)
            await page.locator("button:has-text('Add to cart')").first.click(); await page.wait_for_timeout(500)
            await page.click("button:has-text('Full checkout')"); await page.wait_for_timeout(800)
            await page.fill("input[type='email']", "nick@example.com"); await page.click("button:has-text('Continue to delivery')"); await page.wait_for_timeout(400)
            await page.fill("input[name='name']", "Nick M"); await page.fill("input[name='line1']", "1 Test Street"); await page.fill("input[name='city']", "Sydney"); await page.fill("input[name='postcode']", "2000")
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(400)
            await page.click("button:has-text('Continue to payment')"); await page.wait_for_timeout(300)
            await page.fill("input[autocomplete='cc-number']", "4242424242424242"); await page.fill("input[autocomplete='cc-exp']", "12/28"); await page.fill("input[autocomplete='cc-csc']", "123"); await page.fill("input[autocomplete='cc-name']", "N")
            await page.click("button:has-text('Review the order')"); await page.wait_for_timeout(300)
            await page.click("button:has-text('Place order')"); await page.wait_for_timeout(1000)
            await page.click("button:has-text('Track this order')"); await page.wait_for_timeout(800)
            await page.screenshot(path="shots/order-detail.png")
            assert await page.locator("text=Shipment 1").count() == 1
            await page.goto(BASE + "#/orders"); await page.wait_for_timeout(800)
            assert await page.locator("table tbody tr").count() >= 1
        await run("orders-list", 1440, 900, orders_list)
        async def guides_index(page):
            await page.goto(BASE + "#/guides"); await page.wait_for_timeout(1000)
            assert await page.locator("button:has-text('Movie night')").count() >= 1
        await run("guides-index", 1440, 900, guides_index)
        async def guide_movie(page):
            await page.goto(BASE + "#/guides/movie-night"); await page.wait_for_timeout(1200)
            await page.locator("input[type='range']").fill("2.7"); await page.wait_for_timeout(300)
            d = await page.locator("[data-diagonal]").inner_text()
            print("movie-night diagonal at 2.7 m:", d)
            assert d.strip() in ("102″", "101″", "103″"), d
            await page.evaluate("document.querySelector('input[type=range]').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await run("guide-movie-night", 1440, 900, guide_movie)
        async def how_we_pick(page):
            await page.goto(BASE + "#/how-we-pick"); await page.wait_for_timeout(1000)
            assert await page.locator("table tbody tr").count() >= 60
        await run("how-we-pick", 1440, 900, how_we_pick)
        async def crawl(page):
            dead = []
            visited = 0
            # every mega-menu item
            for section in ["Trending", "Wearables", "Smart home", "Cinema", "Power", "Health", "Maker"]:
                await page.goto(BASE + "#/"); await page.wait_for_timeout(600)
                await page.hover(f"nav[aria-label='Primary'] button:has-text('{section}')"); await page.wait_for_timeout(400)
                labels = await page.locator("[role='region'] a").all_inner_texts()
                for label in labels:
                    await page.goto(BASE + "#/"); await page.wait_for_timeout(500)
                    await page.hover(f"nav[aria-label='Primary'] button:has-text('{section}')"); await page.wait_for_timeout(350)
                    await page.click(f"[role='region'] a:text-is('{label}')"); await page.wait_for_timeout(600)
                    visited += 1
                    if await page.locator("text=That link did not match").count(): dead.append(f"{section} > {label} → {page.url}")
                    if await page.locator("text=Nothing matches that yet").count(): dead.append(f"{section} > {label} is empty → {page.url}")
            # footer links
            await page.goto(BASE + "#/"); await page.wait_for_timeout(500)
            hrefs = await page.locator("footer a").evaluate_all("els => els.map(e => e.getAttribute('href'))")
            for h in hrefs:
                await page.goto(BASE + h); await page.wait_for_timeout(500)
                visited += 1
                if await page.locator("text=That link did not match").count(): dead.append(f"footer {h}")
            # every route shape
            for h in ["#/", "#/c/cinema", "#/search?q=ring", "#/p/xgimi-mogo-4-laser", "#/compare?ids=ringconn-gen-3%2Coura-ring-5", "#/setup", "#/guides", "#/guides/movie-night", "#/how-we-pick", "#/account", "#/orders", "#/checkout"]:
                await page.goto(BASE + h); await page.wait_for_timeout(500)
                visited += 1
                if await page.locator("text=That link did not match").count(): dead.append(f"route {h}")
            print(f"crawl: {len(dead)} dead links of {visited} visited")
            for d in dead: print("  DEAD:", d)
            assert not dead
        await run("crawl", 1440, 900, crawl)
        await run("home-mobile", 400, 820)
        async def pdp_m(page):
            await page.click("text=See the MoGo 4 Laser")
            await page.wait_for_timeout(2500)
        await run("pdp-mobile", 400, 820, pdp_m)
        async def checkout_mobile(page):
            await page.goto(BASE + "#/p/anker-maggo-10k"); await page.wait_for_timeout(1500)
            await page.locator("div.fixed button:has-text('Add to cart')").click(); await page.wait_for_timeout(600)
            await page.click("button:has-text('Full checkout')"); await page.wait_for_timeout(800)
            await page.fill("input[type='email']", "nick@example.com")
            await page.click("button:has-text('Continue to delivery')"); await page.wait_for_timeout(400)
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(400)
            # the step summary names the empty fields before the user scrolls
            assert await page.locator("[role='alert']:has-text('fields need fixing')").count() == 1
            assert "#/checkout" in page.url, page.url
        await run("checkout-mobile", 390, 820, checkout_mobile)
        async def account_mobile(page):
            await page.goto(BASE + "#/account"); await page.wait_for_timeout(1000)
            await page.fill("input[type='email']", "nick@example.com"); await page.keyboard.press("Enter"); await page.wait_for_timeout(600)
            assert await page.locator("text=Signed in as").count() == 1
        await run("account-mobile", 390, 820, account_mobile)
        async def guide_mobile(page):
            await page.goto(BASE + "#/guides/movie-night"); await page.wait_for_timeout(1200)
            assert await page.locator("[data-diagonal]").count() == 1
        await run("guide-mobile", 390, 820, guide_mobile)
        async def back_button(page):
            await page.goto(BASE + "#/"); await page.wait_for_timeout(1000)
            await page.click("button:has-text('Cinema')"); await page.wait_for_timeout(800)
            assert "#/c/cinema" in page.url, page.url
            await page.click("label:has-text('Sydney stock')"); await page.wait_for_timeout(500)
            assert "route" in page.url
            await page.go_back(); await page.wait_for_timeout(800)
            assert page.url.endswith("#/"), page.url   # Back skips the filter entry and returns to the previous page
            assert await page.locator("text=The new thing").count() >= 1
        await run("back-button", 1440, 900, back_button)
        await b.close()
        print("\n".join(errors[:40]) if errors else "no console errors")
asyncio.run(main())
