import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for arg in sys.argv[1:]:
            name, w, h, scale = arg.split(':')
            pg = await b.new_page(viewport={'width':int(w),'height':int(h)}, device_scale_factor=float(scale))
            errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'file://{__import__("os").getcwd()}/{name}.html'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=f'{name}.png', full_page=False)
            print(name, errs)
        await b.close()
asyncio.run(main())
