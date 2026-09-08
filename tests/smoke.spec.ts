
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
    for (const section of ['about', 'experience', 'projects', 'contact']) {
      await page.locator(`.nav a[href="#${section}"]`).click();
      await expect(page.locator(`#${section}`)).toBeInViewport();
    }
  });

  test('the career timeline expands to the earlier roles', async ({ page }) => {
    await page.locator('#timeline').scrollIntoViewIfNeeded();

    // reading the expected counts from the markup rather than hardcoding them,
    // so moving a role behind the expand button cannot turn the suite red on its own
    const total = await page.locator('.tl-item').count();
    const collapsed = await page.locator('.tl-item:not(.tl-extra)').count();

    await expect(page.locator('.tl-item:visible')).toHaveCount(collapsed);
    await page.getByRole('button', { name: /show the earlier roles/i }).click();
    await expect(page.locator('.tl-item:visible')).toHaveCount(total);
  });

  test('the skill timeline bars fill to the value each one declares', async ({ page }) => {
    await page.locator('#skillsGrid').scrollIntoViewIfNeeded();

    // asserting the declared level rather than a number written here, so
    // editing the content cannot turn a passing suite red on its own
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('.t-fill[data-level]')].every(
            (bar) => bar.style.width === `${bar.dataset.level}%`,
          ),
        ),
      )
      .toBe(true);

    expect(await page.locator('.t-fill[data-level]').count()).toBeGreaterThan(3);
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

  test('a valid submission posts to Formspree and confirms it was sent', async ({ page }) => {
    let request: import('@playwright/test').Request | null = null;
    await page.route('https://formspree.io/f/**', async (route) => {
      request = route.request();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /open the contact form/i }).click();
    await page.fill('#name', 'Ana Popescu');
    await page.fill('#email', 'ana@example.com');
    await page.selectOption('#subject', 'Collaboration');
    await page.fill('#message', 'We are hiring a senior SDET for a remote role.');

    // the honeypot field ships empty and out of tab order -- a filled-in one is a bot's doing
    await expect(page.locator('input[name="_gotcha"]')).toBeHidden();
    await expect(page.locator('input[name="_gotcha"]')).toHaveValue('');

    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Message sent. I will get back to you soon.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();

    expect(request).not.toBeNull();
    expect(request!.method()).toBe('POST');
    // fetch() sends the FormData body as multipart, not urlencoded, so this checks
    // for each field's value inside its part rather than parsing it as a query string.
    const body = request!.postData() ?? '';
    expect(body).toMatch(/name="name"[\s\S]*?Ana Popescu/);
    expect(body).toMatch(/name="email"[\s\S]*?ana@example\.com/);
    expect(body).toMatch(/name="subject"[\s\S]*?Collaboration/);
    expect(body).toMatch(/name="_gotcha"[\s\S]*?----/);
  });

  test('a failed submission tells the visitor to email directly instead', async ({ page }) => {
    await page.route('https://formspree.io/f/**', (route) => route.fulfill({ status: 500 }));

    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /open the contact form/i }).click();
    await page.fill('#name', 'Ana Popescu');
    await page.fill('#email', 'ana@example.com');
    await page.selectOption('#subject', 'Collaboration');
    await page.fill('#message', 'We are hiring a senior SDET for a remote role.');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText('Something went wrong. Please write to emanuela.telescu@yahoo.com directly.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  test('a nav click stops on its own section, never past it', async ({ page }) => {
    // start at the bottom, where the last section reaches for the end of the page
    await page.locator('.nav a[href="#contact"]').click();

    for (const id of ['projects', 'about', 'experience', 'contact']) {
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

    await page.locator('#projects').scrollIntoViewIfNeeded();
    await expect(cta).not.toHaveClass(/\bon\b/);
  });

  test('the direct contact links point where they should', async ({ page }) => {
    await expect(page.locator('a[href="mailto:emanuela.telescu@yahoo.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="linkedin.com/in/emanuelatelescu"]').first()).toBeVisible();
    await expect(page.locator('a[href="https://github.com/ella79"]').first()).toBeVisible();
  });
});

test.describe('asset versions', () => {
  // The ?v= token is what makes a deploy reach a browser that has been here
  // before. index.html once fell behind cv.html by six revisions, and the site
  // looked unchanged for anyone with a warm cache. The two pages must agree.
  test('both pages ask for the same stylesheet and script', async ({ page }) => {
    const versions = async (path: string) => {
      await page.goto(path);
      return page.evaluate(() => ({
        css: (document.querySelector('link[href*="styles.css"]') as HTMLLinkElement)
          .getAttribute('href'),
        js: (document.querySelector('script[src*="main.js"]') as HTMLScriptElement)
          .getAttribute('src'),
      }));
    };

    const home = await versions('/');
    const cv = await versions('/cv.html');
    const runner = await versions('/qa-suite.html');

    expect(home.css).toMatch(/\?v=/);
    expect(home.js).toMatch(/\?v=/);
    expect(cv.css).toBe(home.css);
    expect(cv.js).toBe(home.js);
    expect(runner.css).toBe(home.css);
    expect(runner.js).toBe(home.js);
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

  // Projects lived at #work until the section was given its own name. Links to
  // the old anchor are already out in the world, so it has to keep landing.
  test('the old projects anchor still reaches Projects', async ({ page }) => {
    await page.goto('/index.html#work');
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator('#projects')).toBeInViewport();
  });
});

test.describe('projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#projects').scrollIntoViewIfNeeded();
  });

  test('every project card carries its repository', async ({ page }) => {
    const cards = page.locator('#projects .project-card');
    await expect(cards).toHaveCount(2);

    await expect(cards.nth(0).locator('a[href="https://github.com/ella79/portfolio"]')).toBeVisible();
    await expect(
      cards.nth(1).locator('a[href="https://github.com/ella79/agentic-playwright-suite"]'),
    ).toBeVisible();

    // a card that names no stack is a link with a headline on it
    for (const card of await cards.all()) {
      expect(await card.locator('.card-tags li').count()).toBeGreaterThan(0);
    }
  });

  // Deployment links are the first thing someone opens from a repository, so
  // the card carries them rather than making a visitor find them on GitHub.
  test('the suite card links what CI publishes', async ({ page }) => {
    const card = page.locator('#projects .project-card').nth(1);

    for (const path of ['', 'metrics/', 'playwright-report/']) {
      await expect(
        card.locator(`a[href="https://ella79.github.io/agentic-playwright-suite/${path}"]`),
      ).toBeVisible();
    }
  });

  test('the suite card opens the runner', async ({ page }) => {
    await page.getByRole('link', { name: /run the qa suites/i }).click();

    await expect(page).toHaveURL(/qa-suite\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agentic Playwright suite');
  });
});

test.describe('qa suite runner', () => {
  // The page reads a report another repository publishes. Serving that report
  // from the test keeps this suite hermetic: what is under test is what the
  // page does with the numbers, not whether GitHub Pages answered today.
  const REPORT = 'https://ella79.github.io/agentic-playwright-suite';

  const passing = (name: string, duration: number) => ({
    name,
    status: 'passed',
    time: { start: duration, stop: duration * 2, duration },
  });

  test.beforeEach(async ({ page }) => {
    await page.route(`${REPORT}/widgets/summary.json`, (route) =>
      route.fulfill({
        json: {
          statistic: { failed: 0, broken: 0, skipped: 0, passed: 4, unknown: 0, total: 4 },
          time: { start: 1, stop: 63256, duration: 63255 },
        },
      }),
    );
    await page.route(`${REPORT}/data/suites.json`, (route) =>
      route.fulfill({
        json: {
          name: 'suites',
          children: [
            {
              name: 'Functional E2E',
              children: [
                {
                  name: 'Authentication',
                  children: [
                    {
                      name: 'Authentication',
                      children: [
                        passing('TC-01: a new visitor can register', 7563),
                        passing('TC-02: a registered user can sign in', 10375),
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'Visual regression',
              children: [
                {
                  name: 'Home',
                  children: [
                    {
                      name: 'Visual regression - home',
                      children: [
                        passing('VR-01: site header for an anonymous visitor', 4045),
                        passing('VR-02: featured products grid', 3788),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    await page.route(`${REPORT}/`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Allure report</h1>' }),
    );

    await page.goto('/qa-suite.html');
  });

  test('the published addresses are reachable without playing the replay', async ({ page }) => {
    const strip = page.locator('.published');
    await expect(strip).toBeVisible();

    for (const path of ['', 'functional/', 'visual/', 'playwright-report/', 'metrics/']) {
      await expect(strip.locator(`a[href="${REPORT}/${path}"]`)).toBeVisible();
    }
  });

  test('the suites and the totals are the ones the report holds', async ({ page }) => {
    await expect(page.locator('#statTests')).toHaveText('4');
    await expect(page.locator('#statSuites')).toHaveText('2');
    await expect(page.locator('#statPassing')).toHaveText('100%');
    await expect(page.locator('#statDuration')).toHaveText('1m 3s');

    const suites = page.locator('#suiteList .suite');
    await expect(suites).toHaveCount(2);
    await expect(suites.nth(0)).toContainText('Functional E2E');
    await expect(suites.nth(1)).toContainText('Visual regression');
  });

  test('a suite opens on the areas it covers', async ({ page }) => {
    const suite = page.locator('#suiteList .suite').first();
    await expect(suite.locator('.suite-groups')).toBeHidden();

    await suite.locator('.suite-head').click();

    await expect(suite.locator('.suite-groups')).toBeVisible();
    await expect(suite.locator('.suite-groups li').first()).toContainText('Authentication');
  });

  test('the run replays the report and then opens it', async ({ page }) => {
    await expect(page.locator('#runnerResults')).toBeHidden();

    await page.getByRole('button', { name: /run the qa suites/i }).click();

    await expect(page.locator('#consoleLog')).toContainText('TC-01: a new visitor can register');
    await expect(page.locator('#consoleLog')).toContainText('VR-02: featured products grid');
    await expect(page.locator('#consoleLog')).toContainText('4 tests passed');

    await expect(page.locator('#runnerResults')).toBeVisible();
    await expect(page.locator('#resultCards .result-card')).toHaveCount(2);
    await expect(page.locator('#allureFrame')).toHaveAttribute('src', `${REPORT}/#`);
    await expect(page.getByRole('button', { name: /run again/i })).toBeEnabled();
  });

  test('an unreachable report says so instead of showing an empty runner', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) => route.abort());
    await page.reload();

    await expect(page.locator('#consoleLog')).toContainText('Could not read the published report');
    await expect(page.locator('#consoleLog')).toContainText(REPORT);
  });
});
