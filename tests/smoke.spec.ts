import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emanuela Telescu');
    await expect(page.locator('.avatar img')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('in page navigation reaches every section', async ({ page }) => {
    for (const section of ['about', 'approach', 'experience', 'work', 'skills', 'contact']) {
      await page.locator(`.nav a[href="#${section}"]`).click();
      await expect(page.locator(`#${section}`)).toBeInViewport();
    }
  });

  test('the career timeline expands to the earlier roles', async ({ page }) => {
    await page.locator('#experience').scrollIntoViewIfNeeded();
    await expect(page.locator('.tl-item:visible')).toHaveCount(4);
    await page.getByRole('button', { name: /show the earlier roles/i }).click();
    await expect(page.locator('.tl-item:visible')).toHaveCount(8);
  });

  test('the skill bars fill once the section is visible', async ({ page }) => {
    await page.locator('#skills').scrollIntoViewIfNeeded();
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
