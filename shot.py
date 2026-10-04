import asyncio, os, sys, json, subprocess, time
from playwright.async_api import async_playwright

# dist/ is a multi-asset build with module scripts, which Chromium refuses from file://; serve it locally.
PORT = 4173
OFFICE_PORT = 4174
ROOT = os.path.dirname(os.path.abspath(__file__))
BASE = f"http://127.0.0.1:{PORT}/index.html"
RADAR = f"http://127.0.0.1:{PORT}/radar.html"
# A second build with the office configured (and one demo listing), for the checkout, confirmation and merchant scenarios.
OFFICE_URL = "https://office.test"
OFFICE_BASE = f"http://127.0.0.1:{OFFICE_PORT}/index.html"
OFFICE_RADAR = f"http://127.0.0.1:{OFFICE_PORT}/radar.html"

def build_office():
    env = dict(os.environ, VITE_OFFICE_URL=OFFICE_URL, DEMO_LISTINGS="1")
    r = subprocess.run(["npx", "vite", "build", "--outDir", "dist-office"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        print(r.stdout); raise SystemExit("office build failed")

async def main():
    build_office()
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", os.path.join(ROOT, "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    office = subprocess.Popen([sys.executable, "-m", "http.server", str(OFFICE_PORT), "--directory", os.path.join(ROOT, "dist-office")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        await scenarios()
    finally:
        server.terminate(); office.terminate()

FREIGHT = {"shipping": {"origin": "CN", "method": "standard", "logisticName": "CJPacket Ordinary", "aud": 33.95, "days": [8, 15], "fellBack": False}, "fellBack": False, "tax": {"amount": 11.81, "included": True, "label": "Includes GST 10 %"}, "total": 129.9}
EXPRESS = {**FREIGHT, "shipping": {**FREIGHT["shipping"], "method": "express", "logisticName": "DHL Express", "aud": 73.95, "days": [3, 6]}, "total": 169.9}
OFFICE_ORDER = {"id": "NX-654321", "createdAt": "2026-10-05T00:00:00.000Z", "email": "nick@example.com", "address": {"name": "Nick M", "line1": "1 Test Street", "city": "Melbourne", "region": "VIC", "postcode": "3000", "country": "AU"}, "lines": [{"productId": "cj-DEMO-P-A1", "variantId": "cj-DEMO-V-AU", "name": "Mini Laser Projector (demo listing)", "qty": 1, "unitPrice": 95.95, "vid": "DEMO-V-AU", "origin": "CN"}], "shipping": FREIGHT["shipping"], "tax": FREIGHT["tax"], "subtotal": 95.95, "total": 129.9, "currency": "AUD", "stripe": {"sessionId": "cs_test_demo", "paymentIntentId": "pi_demo", "paid": True}, "state": "placed_with_supplier", "supplier": {"cjOrderId": "CJ-DEMO-1", "placedAt": "2026-10-05T00:01:00.000Z"}, "history": []}

async def mock_office(page, routes):
    # routes: {path-or-prefix: (status, body) | callable(request) -> (status, body)}
    async def handle(route, request):
        path = request.url.replace(OFFICE_URL, "").split("?")[0]
        for key, val in routes.items():
            if path == key or (key.endswith("*") and path.startswith(key[:-1])):
                status, body = val(request) if callable(val) else val
                await route.fulfill(status=status, content_type="application/json", headers={"access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization"}, body=json.dumps(body))
                return
        await route.fulfill(status=404, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"error":"not_found"}')
    await page.route(OFFICE_URL + "/**", handle)

async def scenarios():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
        errors = []
        async def run(name, w, h, actions=None):
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, color_scheme="dark")
            page = await ctx.new_page()
            page.on("console", lambda m: errors.append(f"[{name}] {m.type}: {m.text}") if m.type in ("error","warning") else None)
            page.on("pageerror", lambda e: errors.append(f"[{name}] pageerror: {e}"))
            await page.goto(BASE)
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
            await page.goto(BASE + "#/p/anker-maggo-10k")
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
            await page.evaluate("document.getElementById('fastest').scrollIntoView({block:'start'}); window.scrollBy(0, -96)")
            await page.wait_for_timeout(600)
        await run("home-rails", 1440, 900, rails)
        async def route_pdp(page):
            await page.goto(BASE + "#/p/xgimi-mogo-4-laser")
            await page.wait_for_timeout(1500)
            assert await page.locator("h1:has-text('MoGo 4 Laser')").count() == 1, "route #/p/<id> did not open the product"
        await run("route-pdp", 1440, 900, route_pdp)
        async def route_404(page):
            await page.goto(BASE + "#/nope")
            await page.wait_for_timeout(800)
            assert await page.locator("text=That link did not match").count() == 1, "404 page missing"
        await run("route-404", 1440, 900, route_404)
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
            for h in ["#/", "#/c/cinema", "#/search?q=ring", "#/p/xgimi-mogo-4-laser", "#/compare?ids=ringconn-gen-3%2Coura-ring-5", "#/setup", "#/guides", "#/guides/movie-night", "#/how-we-pick", "#/account", "#/orders", "#/checkout", "#/policies/terms", "#/policies/privacy", "#/policies/shipping-returns", "#/policies/contact"]:
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
        async def radar_desktop(page):
            await page.goto(RADAR + "?demo=1"); await page.wait_for_timeout(1200)
            assert await page.locator("ol > li").count() >= 1
            assert await page.locator("text=fed this run").count() == 1
            assert await page.locator("text=demo data").count() == 1
        await run("radar-desktop", 1440, 900, radar_desktop)
        async def radar_expanded(page):
            await page.goto(RADAR + "?demo=1"); await page.wait_for_timeout(1200)
            await page.locator("button:has-text('Details')").first.click(); await page.wait_for_timeout(400)
            assert await page.locator("text=Net at suggested retail").count() == 1
            assert await page.locator("text=Freight from China").count() == 1
        await run("radar-expanded", 1440, 900, radar_expanded)
        async def radar_filter(page):
            await page.goto(RADAR + "?demo=1"); await page.wait_for_timeout(1200)
            before = await page.locator("ol > li").count()
            await page.click("label:has-text('AU plug only')"); await page.wait_for_timeout(300)
            after = await page.locator("ol > li").count()
            print("radar-filter: AU plug only", before, "→", after)
            assert after < before
            await page.locator("button:text-is('Skip')").first.click(); await page.wait_for_timeout(300)
            assert await page.locator("ol > li").count() == after - 1
            assert await page.locator("text=Show skipped (1)").count() == 1
        await run("radar-filter-margin", 1440, 900, radar_filter)
        async def radar_empty(page):
            await page.goto(RADAR); await page.wait_for_timeout(1200)
            assert await page.locator("text=The Radar hasn’t run yet").count() == 1
        await run("radar-empty", 1440, 900, radar_empty)
        async def radar_mobile(page):
            await page.goto(RADAR + "?demo=1"); await page.wait_for_timeout(1200)
            await page.click("button:has-text('Filters and sort')"); await page.wait_for_timeout(300)
        await run("radar-mobile", 390, 820, radar_mobile)
        async def policy_shipping(page):
            await page.goto(BASE + "#/policies/shipping-returns"); await page.wait_for_timeout(800)
            assert await page.locator("h1:has-text('Shipping and returns')").count() == 1
            assert await page.locator("text=Draft, pending professional review").count() == 1
            assert await page.locator("table tbody tr").count() == 5, "one row per origin"
            assert await page.locator("text=30-day change-of-mind returns on Australian stock").count() >= 1
            assert await page.locator("text=returns on both routes").count() == 0
        await run("policy-shipping", 1440, 900, policy_shipping)
        await run("policy-shipping-mobile", 390, 820, policy_shipping)
        async def policy_footer(page):
            await page.locator("footer a:has-text('Privacy')").first.click(); await page.wait_for_timeout(600)
            assert "#/policies/privacy" in page.url, page.url
            assert await page.locator("h1:has-text('Privacy')").count() == 1
        await run("policy-footer", 1440, 900, policy_footer)

        # ---- the office build: live checkout, confirmation by session, order lookup ----
        async def checkout_pay(page):
            posted = []
            def checkout(request):
                posted.append(json.loads(request.post_data))
                return (200, {"url": OFFICE_BASE + "#/orders/confirmed?session=cs_test_demo"})
            await mock_office(page, {"/freight": lambda r: (200, EXPRESS if json.loads(r.post_data).get("method") == "express" else FREIGHT), "/checkout": checkout, "/orders/by-session/*": (200, OFFICE_ORDER)})
            await page.goto(OFFICE_BASE + "#/p/cj-DEMO-P-A1"); await page.wait_for_timeout(1000)
            assert await page.locator("text=Not yet stocked").count() == 0
            await page.locator("button:has-text('Add to cart')").first.click(); await page.wait_for_timeout(600)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            await page.goto(OFFICE_BASE + "#/p/oura-ring-5"); await page.wait_for_timeout(1000)
            assert await page.locator("button:text-is('Not yet stocked, tell me when')").count() == 1, "branded product should offer the stock alert"
            assert await page.locator("button:has-text('Add to cart')").count() == 0
            await page.screenshot(path="shots/office-tell-me-when.png")
            await page.goto(OFFICE_BASE + "#/checkout"); await page.wait_for_timeout(800)
            assert await page.locator("text=No payment is taken").count() == 0
            await page.fill("input[type='email']", "nick@example.com")
            await page.click("button:has-text('Continue to delivery')"); await page.wait_for_timeout(400)
            await page.fill("input[name='name']", "Nick M")
            await page.fill("input[name='line1']", "1 Test Street")
            await page.fill("input[name='city']", "Melbourne")
            await page.select_option("select[autocomplete='address-level1']", "VIC")
            await page.fill("input[name='postcode']", "3000")
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(400)
            assert await page.locator("text=/carrier needs a phone/").count() >= 1, "the office path requires a phone"
            await page.fill("input[type='tel']", "0400 000 000")
            await page.click("button:has-text('Continue to shipping')"); await page.wait_for_timeout(800)
            assert await page.locator("role=radio[name=/Express/]").count() == 1, "expected the express lane from the quote"
            assert await page.locator("text=DHL Express").count() >= 1
            await page.click("role=radio[name=/Express/]"); await page.wait_for_timeout(200)
            await page.screenshot(path="shots/office-shipping-quote.png")
            await page.click("button:has-text('Review the order')"); await page.wait_for_timeout(500)
            assert await page.locator("input[autocomplete='cc-number']").count() == 0, "no card form on the office path"
            btn = page.locator("button:has-text('Pay with Stripe')")
            assert await btn.count() == 1 and "$169.90" in (await btn.inner_text()), await btn.inner_text()
            await page.screenshot(path="shots/office-review-pay.png")
            await btn.click(); await page.wait_for_timeout(1500)
            assert posted and posted[0]["method"] == "express" and posted[0]["lines"][0]["productId"] == "cj-DEMO-P-A1" and "unitPrice" not in posted[0]["lines"][0], posted
            assert posted[0]["address"]["phone"] == "0400 000 000", posted[0]["address"]
            assert "session=cs_test_demo" in page.url, page.url
            assert await page.locator("text=NX-654321").count() >= 1
            assert await page.locator("text=Nothing was charged").count() == 0
        await run("checkout-pay", 1440, 900, checkout_pay)
        async def confirmed_remote(page):
            n = {"calls": 0}
            def by_session(request):
                n["calls"] += 1
                return (202, {"pending": True}) if n["calls"] < 2 else (200, OFFICE_ORDER)
            await mock_office(page, {"/orders/by-session/*": by_session})
            await page.goto(OFFICE_BASE + "#/orders/confirmed?session=cs_test_demo"); await page.wait_for_timeout(600)
            assert await page.locator("text=Confirming your payment").count() == 1
            await page.wait_for_timeout(2600)
            assert await page.locator("text=Thanks, it is on its way").count() == 1, "order should appear after the second poll"
            assert n["calls"] == 2, n
        await run("confirmed-remote", 1440, 900, confirmed_remote)
        async def order_lookup(page):
            await mock_office(page, {"/orders/NX-654321": (200, {**OFFICE_ORDER, "state": "shipped", "supplier": {**OFFICE_ORDER["supplier"], "trackNumber": "LX123456789CN", "logisticName": "CJPacket Ordinary"}})})
            await page.goto(OFFICE_BASE + "#/orders/NX-654321"); await page.wait_for_timeout(800)
            await page.fill("input[type='email']", "nick@example.com")
            await page.click("button:has-text('Find my order')"); await page.wait_for_timeout(800)
            assert await page.locator("text=LX123456789CN").count() >= 1
            assert await page.locator("a[href*='17track']").count() == 1
        await run("order-lookup", 1440, 900, order_lookup)
        async def radar_orders(page):
            health = {"ok": True, "kv": True, "stripeMode": "test", "cjAuth": True, "emailEnabled": False, "dryRun": True, "cronLast": {"at": "2026-10-05T04:00:00.000Z", "synced": 2, "retried": 0, "errors": []}, "catalogueSellable": 1}
            stuck = {**OFFICE_ORDER, "id": "NX-000002", "state": "needs_attention", "attention": {"reason": "cj_pay_failed", "at": "2026-10-05T02:00:10.000Z", "lastError": "insufficient balance", "attempts": 1, "nextRetryAt": "2026-10-06T02:00:10.000Z"}}
            shipped = {**OFFICE_ORDER, "id": "NX-000001", "state": "shipped", "supplier": {**OFFICE_ORDER["supplier"], "trackNumber": "LX123456789CN", "logisticName": "CJPacket Ordinary"}}
            posted = []
            def guard(fn):
                def h(request):
                    if request.headers.get("authorization") != "Bearer shot-token": return (401, {"error": "unauthorised"})
                    return fn(request)
                return h
            await mock_office(page, {
                "/admin/health": guard(lambda r: (200, health)),
                "/admin/orders": guard(lambda r: (200, {"orders": [OFFICE_ORDER, stuck, shipped]})),
                "/admin/notify": guard(lambda r: (200, {"products": [{"productId": "oura-ring-5", "count": 2, "emails": ["a@b.co", "c@d.co"]}]})),
                "/admin/orders/NX-000002/retry": guard(lambda r: (posted.append("retry"), (200, {**stuck, "state": "placed_with_supplier"}))[1]),
            })
            await page.goto(OFFICE_RADAR + "#orders"); await page.wait_for_timeout(800)
            assert await page.locator("label:has-text('Admin token')").count() == 1
            await page.fill("input[type='password']", "shot-token")
            await page.click("button:text-is('Open')"); await page.wait_for_timeout(800)
            rows = page.locator("tbody tr[aria-label^='NX-']")
            assert await rows.count() == 3, await rows.count()
            assert "NX-000002" in (await rows.first.inner_text()), "needs-attention first"
            assert await page.locator("text=Stripe test mode").count() == 1
            assert await page.locator("a[href*='17track']").count() == 1
            await page.screenshot(path="shots/radar-orders.png")
            await page.click("button:text-is('Retry')"); await page.wait_for_timeout(600)
            assert posted == ["retry"], posted
            assert await page.locator("text=Retried NX-000002").count() == 1
        await run("radar-orders", 1440, 900, radar_orders)
        async def radar_orders_unconfigured(page):
            await page.goto(RADAR + "#orders"); await page.wait_for_timeout(600)
            assert await page.locator("text=not configured").count() == 1
            assert await page.locator("a[href$='#back-office']").count() == 1
        await run("radar-orders-unconfigured", 1440, 900, radar_orders_unconfigured)
        await b.close()
        print("\n".join(errors[:40]) if errors else "no console errors")
asyncio.run(main())
