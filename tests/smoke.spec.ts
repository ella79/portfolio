import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders without javascript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      // Web fonts come from a third party. A network hiccup fetching them is not
      // a defect in this page, and asserting on it would make the test flaky.
      const isThirdPartyResource = message.text().includes('Failed to load resource');
      if (message.type() === 'error' && !isThirdPartyResource) errors.push(message.text());
    });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emanuela Telescu');
    await expect(page.locator('.avatar img')).toBeVisible();
    await expect(page.locator('.monogram .mark')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('in page navigation reaches every section', async ({ page }) => {
    for (const section of ['about', 'experience', 'work', 'contact']) {
      await page.locator(`.nav a[href="#${section}"]`).click();
      await expect(page.locator(`#${section}`)).toBeInViewport();
    }
  });

  test('the career timeline expands to the earlier roles', async ({ page }) => {
    await page.locator('#timeline').scrollIntoViewIfNeeded();
    await expect(page.locator('.tl-item:visible')).toHaveCount(4);
    await page.getByRole('button', { name: /show the earlier roles/i }).click();
    await expect(page.locator('.tl-item:visible')).toHaveCount(8);
  });

  test('the skill bars fill once they come into view', async ({ page }) => {
    await page.locator('#skillsGrid').scrollIntoViewIfNeeded();
    const firstBar = page.locator('.bar span').first();
    await expect
      .poll(async () => firstBar.evaluate((el) => (el as HTMLElement).style.width))
      .toBe('95%');
  });

  test('the contact form stays closed until it is asked for', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.locator('#contactForm')).toBeHidden();
    await page.getByRole('button', { name: /open the contact form/i }).click();
    await expect(page.locator('#contactForm')).toBeVisible();
  });

  test('the contact form rejects an empty submission', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /open the contact form/i }).click();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('.field.invalid')).toHaveCount(4);
  });

  test('the contact form accepts a complete submission', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /open the contact form/i }).click();
    await page.fill('#name', 'Ana Popescu');
    await page.fill('#email', 'ana@example.com');
    await page.selectOption('#subject', 'Collaboration');
    await page.fill('#message', 'We are hiring a senior SDET for a remote role.');
    await expect(page.locator('.field.invalid')).toHaveCount(0);
  });

  test('a nav click stops on its own section, never past it', async ({ page }) => {
    // start at the bottom, where the last section reaches for the end of the page
    await page.locator('.nav a[href="#contact"]').click();

    for (const id of ['work', 'about', 'experience', 'contact']) {
      await page.locator(`.nav a[href="#${id}"]`).click();
      await expect
        .poll(() =>
          page.evaluate((section) => {
            const heading = document.querySelector(`#${section} h2`);
            const header = document.getElementById('siteHeader');
            if (!heading || !header) return false;
            const box = heading.getBoundingClientRect();
            // clear of the sticky header, and inside the screen
            return box.top >= header.offsetHeight - 2 && box.bottom <= window.innerHeight;
          }, id),
        )
        .toBe(true);
    }
  });

  test('the CV button hands over the PDF rather than opening a page', async ({ page }) => {
    const button = page.locator('.nav .nav-page');
    await expect(button).toHaveAttribute('href', /assets\/cv\/Emanuela-Telescu-CV\.pdf$/);
    await expect(button).toHaveAttribute('download', /\.pdf$/);

    const pdf = await page.request.get('/assets/cv/Emanuela-Telescu-CV.pdf');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');
  });

  test('a reload opens the page at the top, not where the last visit ended', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

    await page.reload({ waitUntil: 'load' });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
    await expect(page.locator('.nav a[href="#contact"]')).not.toHaveClass(/is-active/);
  });

  test('the floating button steps aside once Projects is on screen', async ({ page }) => {
    const cta = page.locator('#stickyCta');

    await page.locator('#experience').scrollIntoViewIfNeeded();
    await expect(cta).toHaveClass(/\bon\b/);

    await page.locator('#work').scrollIntoViewIfNeeded();
    await expect(cta).not.toHaveClass(/\bon\b/);
  });

  test('the direct contact links point where they should', async ({ page }) => {
    await expect(page.locator('a[href="mailto:emanuela.telescu@yahoo.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="linkedin.com/in/emanuelatelescu"]').first()).toBeVisible();
    await expect(page.locator('a[href="https://github.com/ella79"]').first()).toBeVisible();
  });
});

test.describe('CV page', () => {
  test('loads and offers the PDF', async ({ page }) => {
    await page.goto('/cv.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Curriculum vitae');
    await expect(page.locator('a[href$="Emanuela-Telescu-CV.pdf"]').first()).toBeVisible();

    const pdf = await page.request.get('/assets/cv/Emanuela-Telescu-CV.pdf');
    expect(pdf.status()).toBe(200);
  });
});

test.describe('addresses', () => {
  test('an unknown section in the address lands on the not found page', async ({ page }) => {
    await page.goto('/index.html#about5');
    await expect(page).toHaveURL(/404\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('That page does not exist');
  });

  test('an unknown path lands on the not found page', async ({ page }) => {
    const response = await page.request.get('/no-such-page');
    expect(response.status()).toBe(404);
  });

  test('an anchor that used to exist still reaches the right section', async ({ page }) => {
    await page.goto('/index.html#approach');
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator('#about')).toBeInViewport();
  });
});
