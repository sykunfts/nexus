import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 800})
        page = await ctx.new_page()
        errs=[]
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto("file:///tmp/claude-0/-home-claude/257f0885-4cfa-5197-81c4-04d07b5fc765/scratchpad/nexus/dist/check.html")
        await page.wait_for_timeout(1500)
        await page.click("text=Configure the Lumen 16")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="shots/check.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
