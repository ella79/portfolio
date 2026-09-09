
import { test, expect, type Page } from '@playwright/test';

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

    // The portfolio card is deliberately the quiet one: a short description and
    // the repository, nothing that opens a page of its own. The suite card is
    // the one that carries a stack and a way in.
    await expect(cards.nth(0).locator('.card-tags')).toHaveCount(0);
    await expect(cards.nth(0).locator('.card-actions a')).toHaveCount(1);
    expect(await cards.nth(1).locator('.card-tags li').count()).toBeGreaterThan(0);
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

  const result = (name: string, duration: number, status = 'passed', parameters: string[] = []) => ({
    name,
    status,
    parameters,
    time: { start: duration, stop: duration * 2, duration },
  });

  const passing = (name: string, duration: number) => result(name, duration);

  // the shape the suite publishes now: the engine is the branch, and the same
  // engine name is on every result underneath it, which is how the page tells
  // an engine apart from an area without reading tree position
  const engineBranch = (engine: string, project: string, status = 'passed') => ({
    name: engine,
    // Allure gives every branch an address, and the page uses it to open the
    // report on the branch a filtered replay just played.
    uid: `uid-${engine.toLowerCase()}`,
    children: [
      {
        name: 'Checkout',
        children: [
          {
            name: 'Checkout',
            children: [
              result('TC-17: order end to end', 15800, status, [project, engine]),
              result('TC-16: checkout guard', 4600, status, [project, engine]),
            ],
          },
        ],
      },
    ],
  });

  // The visual suite forks on area rather than on engine, so it has no engine
  // branch to read. Its engine is on every result all the same, which is what
  // gives it a chip of its own.
  const visualSuite = {
    name: 'Visual regression',
    uid: 'uid-visual',
    children: [
      {
        name: 'Home',
        children: [
          {
            name: 'Visual regression - home',
            children: [
              result('VR-01: site header', 4045, 'passed', ['visual-regression', 'Chromium']),
              result('VR-02: featured grid', 3788, 'passed', ['visual-regression', 'Chromium']),
            ],
          },
        ],
      },
    ],
  };

  const twoEngineTree = {
    name: 'suites',
    children: [
      {
        name: 'Functional E2E',
        uid: 'uid-functional',
        children: [engineBranch('Chromium', 'e2e-playwright'), engineBranch('WebKit', 'webkit')],
      },
    ],
  };

  // Both shapes at once: a suite that forks on engine beside one that does not.
  // This is the report as it is actually published, and the only shape in which
  // a filter can get the two suites confused.
  const bothShapesTree = {
    name: 'suites',
    children: [twoEngineTree.children[0], visualSuite],
  };

  // the shape that made the chips unreadable: one engine green, the other red.
  // Both ran; only one of them held.
  const splitEngineTree = {
    name: 'suites',
    children: [
      {
        name: 'Functional E2E',
        uid: 'uid-functional',
        children: [
          engineBranch('Chromium', 'e2e-playwright', 'failed'),
          engineBranch('WebKit', 'webkit'),
        ],
      },
    ],
  };


  // The published report is green almost all of the time, so the code that
  // renders a run which is not green would otherwise never be executed, here or
  // in a browser, until the day it matters. These reports are served by the
  // test and reach nothing outside it.
  const reportWithFailures = async (page: Page) => {
    await page.route(`${REPORT}/widgets/summary.json`, (route) =>
      route.fulfill({
        json: {
          statistic: { failed: 1, broken: 1, skipped: 0, passed: 2, unknown: 0, total: 4 },
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
                  name: 'Checkout',
                  children: [
                    {
                      name: 'Checkout',
                      children: [
                        result('TC-17: a signed-in user can complete an order', 15800, 'broken'),
                        result('TC-16: an anonymous visitor cannot reach checkout', 4600, 'failed'),
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
                      children: [passing('VR-01: site header', 4045), passing('VR-02: featured grid', 3788)],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
  };

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
    await page.route(`${REPORT}/widgets/environment.json`, (route) =>
      route.fulfill({
        json: [
          { name: 'base_url', values: ['https://automationexercise.com'] },
          { name: 'browser', values: ['Chromium'] },
        ],
      }),
    );
    await page.route(`${REPORT}/widgets/history-trend.json`, (route) =>
      route.fulfill({
        json: [
          { buildOrder: 9, data: { failed: 0, broken: 0, passed: 4, total: 4 } },
          { buildOrder: 8, data: { failed: 1, broken: 0, passed: 3, total: 4 } },
        ],
      }),
    );
    await page.route(`${REPORT}/`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Allure report</h1>' }),
    );

    await page.goto('/qa-suite.html');
  });

  // The page depends on another repository's build output. Saying so, and
  // linking the contract that pins it, is part of the point: a reader should
  // not have to open the repository to learn how the dependency is held.
  test('the page names the contract it reads the report under', async ({ page }) => {
    await expect(
      page.locator(
        'a[href="https://github.com/ella79/portfolio/blob/main/contract/allure-report.contract.json"]',
      ),
    ).toBeVisible();
  });

  test('the published addresses are reachable without playing the replay', async ({ page }) => {
    const strip = page.locator('.published');
    await expect(strip).toBeVisible();

    for (const path of ['', 'functional/', 'visual/', 'playwright-report/', 'metrics/']) {
      await expect(strip.locator(`a[href="${REPORT}/${path}"]`)).toBeVisible();
    }
  });

  // The browsers used to be a report of their own and are now branches inside
  // the main one, so they are shown in the suite row that owns them. The band
  // that used to carry them is gone rather than left hidden: a page that can
  // never render a thing should not still describe it.
  test('a suite that ran on two browsers says so in its own row', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) =>
      route.fulfill({ json: twoEngineTree }),
    );
    await page.reload();

    const functional = page.locator('#suiteList .suite').first();

    // visible without expanding anything, because they filter the runner
    const chips = functional.locator('.cb-engines-chip');
    await expect(chips.first()).toBeVisible();
    await functional.locator('.suite-head').click();
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toContainText('Chromium');
    await expect(chips.nth(0)).toContainText('2/2');
    await expect(chips.nth(1)).toContainText('WebKit');

    // an area is the sum of its runs on every browser, not the first one only:
    // two cases under Checkout, run on two browsers, is four
    const areas = functional.locator('.suite-groups li');
    await expect(areas.filter({ hasText: 'Checkout' })).toContainText('4 tests');

    // and the retired band is not in the page at all
    await expect(page.locator('#crossBrowser')).toHaveCount(0);
  });

  // Showing two browsers and then replaying both together leaves the obvious
  // question unanswered, so the chip is a filter rather than a label.
  //
  // A filter is a suite and a browser together, not a browser alone. While it
  // was a browser alone it was wrong in both directions: the visual cases record
  // Chromium too, so choosing Chromium under the functional suite replayed the
  // visual one as well, and the visual suite had no chip at all so it could
  // never be replayed on its own.
  test('a chip filters the replay to one suite on one browser', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) =>
      route.fulfill({ json: bothShapesTree }),
    );
    await page.reload();

    const functional = page.locator('#suiteList .suite').first();
    const visual = page.locator('#suiteList .suite').nth(1);
    const webkit = functional.locator('.cb-engines-chip', { hasText: 'WebKit' });
    await expect(webkit).toBeVisible();

    await webkit.click();
    // the console names what it is about to replay, rather than always Chromium
    await expect(page.locator('#consoleBrowser')).toContainText('WebKit');
    await expect(webkit).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /run Functional E2E on WebKit/i }).click();
    await expect(page.locator('#consoleLog')).toContainText('2 tests passed');
    await expect(page.locator('#consoleLog')).toContainText('on WebKit');
    // no Chromium, and no visual case that never ran on WebKit
    await expect(page.locator('#consoleLog')).not.toContainText('VR-01');

    // the report follows the selection rather than opening at the top of a run
    // the reader did not ask to see
    await expect(page.locator('#allureFrame')).toHaveAttribute('src', `${REPORT}/#suites/uid-webkit`);
    await expect(page.locator('#reportLink')).toHaveAttribute('href', `${REPORT}/#suites/uid-webkit`);

    // the visual suite forks on area, so it has no engine branch. Its engine is
    // on every result all the same, which is what gives it a chip of its own.
    const chromium = visual.locator('.cb-engines-chip', { hasText: 'Chromium' });
    await expect(chromium).toContainText('2/2');
    await chromium.click();
    await expect(webkit).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: /run Visual regression/i }).click();
    await expect(page.locator('#consoleLog')).toContainText('VR-01: site header');
    await expect(page.locator('#consoleLog')).not.toContainText('TC-17');
    await expect(page.locator('#allureFrame')).toHaveAttribute('src', `${REPORT}/#suites/uid-visual`);

    // pressing it again gives the whole run back
    await chromium.click();
    await expect(chromium).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: /run the qa suites/i })).toBeEnabled();
    await expect(page.locator('#allureFrame')).toHaveAttribute('src', `${REPORT}/#`);
  });

  // A case that runs on two browsers is two results and one case. Showing only
  // the larger number would claim twice the coverage that exists.
  test('results and distinct cases are counted as different numbers', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) =>
      route.fulfill({ json: twoEngineTree }),
    );
    await page.reload();

    await expect(page.locator('#statTests')).toHaveText('4');
    await expect(page.locator('#statCases')).toHaveText('2');
  });

  test('a run with failures is not rendered as a clean one', async ({ page }) => {
    await reportWithFailures(page);
    await page.reload();

    // the headline number, before anything is pressed
    await expect(page.locator('#statPassing')).toHaveText('50%');
    await expect(page.locator('#statPassing')).toHaveClass(/is-off/);

    // the suite that carries them is marked, the clean one is not
    const suites = page.locator('#suiteList .suite');
    await expect(suites.nth(0).locator('.suite-mark')).toHaveText('!');
    await expect(suites.nth(1).locator('.suite-mark')).toHaveText('✓');

    await page.getByRole('button', { name: /run the qa suites/i }).click();

    // failed and broken are different things and the console says which is which
    await expect(page.locator('#consoleLog')).toContainText('broken');
    await expect(page.locator('#consoleLog')).toContainText('2 tests passed, 1 failed, 1 broken');

    await expect(page.locator('#runnerResults')).toBeVisible();
    await expect(page.locator('.ring-v')).toHaveText('50%');
    await expect(page.locator('.ring-fill')).toHaveClass(/is-off/);

    // Hovering a chart used to repeat the number printed on it. Both the ring
    // and the bar segments name the suite and what it came out as, so a reader
    // can tell where the missing half went without opening the report.
    await expect(page.locator('.ring title')).toContainText('Functional E2E: 1 failed, 1 broken');
    await expect(page.locator('.ring title')).toContainText('Visual regression: 2 passed');
    await expect(page.locator('#resultCards .result-card').first().locator('.bar .seg-failed')).toHaveAttribute(
      'title',
      /Functional E2E: 1 failed of 2/,
    );

    // and the trace, which is where the step that failed is recorded
    const callout = page.locator('#notClean');
    await expect(callout).toBeVisible();
    await expect(callout).toContainText('did not come back clean');
    await expect(callout.locator(`a[href="${REPORT}/playwright-report/"]`)).toBeVisible();
  });

  // A cross in a circle at the head of a row that also expands is read as a
  // close button, and this one said the same thing whether the row was open or
  // shut, so it looked like one that had stopped working. The mark is a verdict
  // and nothing else opens or closes with it.
  test('the suite mark is a verdict rather than a control', async ({ page }) => {
    await reportWithFailures(page);
    await page.reload();

    const failing = page.locator('#suiteList .suite').nth(0);
    const clean = page.locator('#suiteList .suite').nth(1);

    await expect(failing.locator('.suite-mark')).toHaveText('!');
    await expect(failing.locator('.suite-mark')).toHaveClass(/is-off/);
    await expect(failing.locator('.suite-mark')).toHaveAttribute('aria-label', /did not pass/);
    await expect(clean.locator('.suite-mark')).toHaveText('✓');
    await expect(clean.locator('.suite-mark')).not.toHaveClass(/is-off/);

    // opening the row is the chevron's job, and the verdict does not move for it
    await failing.locator('.suite-head').click();
    await expect(failing.locator('.suite-groups')).toBeVisible();
    await expect(failing.locator('.suite-mark')).toHaveText('!');
  });

  // The number on a chip counts results that passed. Without the word, 0/2 next
  // to 2/2 was read as a browser that never started, which is the opposite of
  // what the row above them says.
  test('a browser chip says what its number counts', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) =>
      route.fulfill({ json: splitEngineTree }),
    );
    await page.reload();

    const chromium = page.locator('.cb-engines-chip', { hasText: 'Chromium' });
    await expect(chromium).toContainText('0/2');
    await expect(chromium).toContainText('passed');
    await expect(chromium).toHaveAttribute('aria-label', 'Functional E2E on Chromium, 0 of 2 results passed');
  });

  // Selecting a browser that had failures used to leave its pale background in
  // place under white text, so the label disappeared at the moment it mattered.
  test('the chosen browser stays legible and keeps its tick after the replay', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) =>
      route.fulfill({ json: splitEngineTree }),
    );
    await page.reload();

    const chromium = page.locator('.cb-engines-chip', { hasText: 'Chromium' });
    const webkit = page.locator('.cb-engines-chip', { hasText: 'WebKit' });
    await chromium.click();

    // polled rather than read once: the chip fades into its selected colours,
    // and a single sample lands somewhere in the middle of that
    await expect
      .poll(() =>
        chromium.evaluate((node) => {
          const style = getComputedStyle(node);
          return [style.color, style.backgroundColor].join(' on ');
        }),
      )
      .toBe('rgb(255, 255, 255) on rgb(10, 85, 76)');

    // which browser was replayed has to survive the console scrolling on
    await expect(chromium.locator('.cb-ran')).toBeHidden();
    await page.getByRole('button', { name: /run Functional E2E on Chromium/i }).click();
    await expect(page.locator('#runnerResults')).toBeVisible();

    await expect(chromium.locator('.cb-ran')).toBeVisible();
    await expect(webkit.locator('.cb-ran')).toBeHidden();
  });

  // The bar stopped at the pass rate and left the rest as track. The track is
  // grey and grey is skipped on this page, so twenty failures were being drawn
  // in the colour of tests that never ran.
  test('a suite bar carries every status the run recorded', async ({ page }) => {
    await reportWithFailures(page);
    await page.reload();
    await page.getByRole('button', { name: /run the qa suites/i }).click();
    await expect(page.locator('#runnerResults')).toBeVisible();

    const functional = page.locator('#resultCards .result-card').first();
    await expect(functional.locator('.bar .seg-failed')).toHaveCount(1);
    await expect(functional.locator('.bar .seg-broken')).toHaveCount(1);
    await expect(functional.locator('.bar .seg-passed')).toHaveCount(0);
    await expect(functional.locator('.bar-key')).toContainText('1 failed');
    await expect(functional.locator('.bar-key')).toContainText('1 broken');

    const segments = await functional.evaluate((card) =>
      [...card.querySelectorAll('.bar span')].map((span) => getComputedStyle(span).backgroundColor),
    );
    expect(segments.length).toBe(2);
    expect(new Set(segments).size).toBe(segments.length);
  });

  // Failed and broken shared one amber dot in the only place the page explains
  // the difference between them.
  test('every status in the legend is drawn differently', async ({ page }) => {
    await reportWithFailures(page);
    await page.reload();
    await page.getByRole('button', { name: /run the qa suites/i }).click();
    await expect(page.locator('#runnerResults')).toBeVisible();

    const dots = await page.locator('#ringLegend li .dot').evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return [style.backgroundColor, style.borderColor, style.borderWidth].join('|');
      }),
    );

    expect(dots.length).toBe(4);
    expect(new Set(dots).size).toBe(dots.length);
  });

  test('a clean run says nothing about traces', async ({ page }) => {
    await page.getByRole('button', { name: /run the qa suites/i }).click();
    await expect(page.locator('#runnerResults')).toBeVisible();

    await expect(page.locator('#notClean')).toBeHidden();
    await expect(page.locator('.ring-fill')).not.toHaveClass(/is-off/);
    await expect(page.locator('#statPassing')).not.toHaveClass(/is-off/);
  });

  test('the suites and the totals are the ones the report holds', async ({ page }) => {
    await expect(page.locator('#statTests')).toHaveText('4');
    await expect(page.locator('#statCases')).toHaveText('4');
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

  // Publishing the report is not atomic, so a file can be missing for a moment
  // while a deploy replaces it. A page that gave up on the first 404 would tell
  // a visitor the suite is broken on the strength of a race.
  test('a widget that is missing for a moment does not cost the page', async ({ page }) => {
    let asked = 0;
    await page.route(`${REPORT}/data/suites.json`, async (route) => {
      asked += 1;
      if (asked === 1) return route.fulfill({ status: 404, body: 'not yet' });
      return route.fallback();
    });

    await page.reload();

    await expect(page.locator('#statTests')).toHaveText('4');
    await expect(page.locator('#suiteList .suite')).toHaveCount(2);
    expect(asked).toBeGreaterThan(1);
  });

  // The trend and the environment come from their own files. Losing one of
  // those should cost that panel, not the run and not the rest of the board.
  test('a panel whose widget never arrives hides itself', async ({ page }) => {
    await page.route(`${REPORT}/widgets/environment.json`, (route) => route.abort());
    await page.reload();

    await page.getByRole('button', { name: /run the qa suites/i }).click();
    await expect(page.locator('#runnerResults')).toBeVisible();

    await expect(page.locator('#envCard')).toBeHidden();
    await expect(page.locator('#ringWrap svg')).toBeVisible();
    await expect(page.locator('#resultCards .result-card')).toHaveCount(2);
  });

  test('the history chart falls back to test counts without the duration widget', async ({ page }) => {
    await page.route(`${REPORT}/widgets/duration-trend.json`, (route) => route.abort());
    await page.reload();

    await page.getByRole('button', { name: /run the qa suites/i }).click();
    await expect(page.locator('#runnerResults')).toBeVisible();

    await expect(page.locator('#trendCard')).toBeVisible();
    await expect(page.locator('#trend .trend-col')).toHaveCount(2);
    await expect(page.locator('#trendNote')).toContainText('Tests carried by');
    // the run that had a failure is the one marked
    await expect(page.locator('#trend .trend-col.is-fail')).toHaveCount(1);
  });

  test('an unreachable report says so instead of showing an empty runner', async ({ page }) => {
    await page.route(`${REPORT}/data/suites.json`, (route) => route.abort());
    await page.reload();

    await expect(page.locator('#consoleLog')).toContainText('Could not read the published report');
    await expect(page.locator('#consoleLog')).toContainText(REPORT);
    await expect(page.getByRole('button', { name: /open the report/i })).toBeEnabled();
  });
});
