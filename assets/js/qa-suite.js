(function () {
  "use strict";

  /* This page shows a run it did not start. A browser cannot launch Playwright,
     so the honest version of a runner here is a replay: read the Allure report
     that GitHub Actions published for the suite, then play back the run it
     recorded, with the statuses and the durations it recorded. Every number on
     the page is read from that report, which is also why none of them can go
     stale: the next CI run rewrites them without this page being touched. */
  var REPORT = "https://ella79.github.io/agentic-playwright-suite/";

  var suiteList = document.getElementById("suiteList");
  var log = document.getElementById("consoleLog");
  var runButton = document.getElementById("runSuites");
  if (!suiteList || !log || !runButton) { return; }

  var runLabel = runButton.querySelector(".run-label") || runButton;
  var hint = document.getElementById("runHint");
  var progress = document.getElementById("runProgress");
  var consoleBrowser = document.getElementById("consoleBrowser");
  var counter = document.getElementById("consoleCount");
  var results = document.getElementById("runnerResults");
  var frame = document.getElementById("allureFrame");
  var embedMeta = document.getElementById("embedMeta");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var suites = [];
  var report = {};
  var running = false;
  var drawn = false;

  var SVG_NS = "http://www.w3.org/2000/svg";
  var CHECK = "✓";
  var CROSS = "×";
  /* the verdict on a suite that did not come back clean. A cross in a circle at
     the head of a row that also expands is read as a close button, and this one
     never changed when the row opened, so it looked like a broken one. */
  var ALERT = "!";
  var ARROW = "▾";
  /* the order a run is summarised in, so the console line, the card and the bar
     all name the statuses the same way round */
  var STATUSES = ["passed", "failed", "broken", "skipped", "unknown"];

  /* ---------- formatting ---------- */

  function secs(ms) {
    return (ms / 1000).toFixed(1) + "s";
  }

  function wall(ms) {
    var total = Math.round(ms / 1000);
    var m = Math.floor(total / 60);
    return m ? m + "m " + (total % 60) + "s" : total + "s";
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function when(ms) {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  /* ---------- small dom helpers ---------- */

  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (textContent !== undefined) { node.textContent = textContent; }
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function set(id, value) {
    var node = document.getElementById(id);
    if (node) { node.textContent = String(value); }
  }

  function fill(node, children) {
    node.innerHTML = "";
    children.forEach(function (child) { node.appendChild(child); });
  }

  /* ---------- reading the report ---------- */

  /* Allure nests suite, then area, then the describe block, then the tests.
     Depth is not worth assuming: a leaf is whatever carries a status. */
  function leaves(node, out) {
    if (!node) { return out; }
    if (node.children && node.children.length) {
      node.children.forEach(function (child) { leaves(child, out); });
    } else if (node.status) {
      out.push(node);
    }
    return out;
  }

  function duration(test) {
    return (test.time && test.time.duration) || 0;
  }

  /* A branch directly under a suite is either an engine or an area, and the
     tree alone does not say which: both are just names with tests underneath.
     The suite writes the engine twice, as the branch name and as a parameter on
     each of its results, so that is what tells them apart. Reading the tree
     position instead would break the next time a display grouping moves, which
     is exactly what happened when the cross browser results came home. */
  function isEngineBranch(branch) {
    var tests = leaves(branch, []);
    return (
      tests.length > 0 &&
      tests.every(function (test) { return (test.parameters || []).indexOf(branch.name) !== -1; })
    );
  }

  function readSuites(tree) {
    return (tree.children || []).map(function (suite) {
      var tests = leaves(suite, []);
      var sum = 0;
      tests.forEach(function (test) { sum += duration(test); });
      var branches = suite.children || [];
      var engines = branches.filter(isEngineBranch);
      var byEngine = engines.length === branches.length && engines.length > 0;

      /* When the branches are engines, the areas sit one level further down and
         the same area appears under every engine. Summing them by name keeps
         the column honest: Authentication has to read as all of its runs, not
         as the ones that happened to run first. */
      var areaTotals = {};
      var areaOrder = [];
      (byEngine ? branches : [suite]).forEach(function (holder) {
        (byEngine ? holder.children || [] : branches).forEach(function (area) {
          if (!areaTotals[area.name]) {
            areaTotals[area.name] = { name: area.name, count: 0, sum: 0 };
            areaOrder.push(area.name);
          }
          leaves(area, []).forEach(function (test) {
            areaTotals[area.name].count += 1;
            areaTotals[area.name].sum += duration(test);
          });
        });
      });

      /* the whole verdict, not just the passing half. A suite bar drawn from
         the pass rate alone leaves the rest of the track grey, and grey is
         skipped on this page, so twenty failures were being shown in the
         colour of tests that never ran. */
      var counts = {};
      STATUSES.forEach(function (status) { counts[status] = 0; });
      tests.forEach(function (test) {
        var status = counts[test.status] === undefined ? "unknown" : test.status;
        counts[status] += 1;
      });

      return {
        name: suite.name,
        counts: counts,
        engines: engines.map(function (branch) {
          var inBranch = leaves(branch, []);
          return {
            name: branch.name,
            total: inBranch.length,
            passed: inBranch.filter(function (test) { return test.status === "passed"; }).length
          };
        }),
        areas: areaOrder.map(function (name) { return areaTotals[name]; }),
        /* start order is the order the run happened in, and a replay that loses
           it is an animation rather than a record of anything */
        tests: tests.sort(function (a, b) {
          return ((a.time && a.time.start) || 0) - ((b.time && b.time.start) || 0);
        }),
        passed: tests.filter(function (test) { return test.status === "passed"; }).length,
        total: tests.length,
        sum: sum
      };
    });
  }

  function value(list, name) {
    var found = (list || []).filter(function (row) { return row.name === name; })[0];
    return found && found.values && found.values.length ? found.values.join(", ") : "";
  }

  /* ---------- the header strip ---------- */

  function renderProvenance() {
    var executor = (report.executors || [])[0] || {};
    var env = report.environment || [];
    var retry = (report.retries || [])[0];
    var stop = (report.summary.time || {}).stop;

    set("provBuild", executor.buildName || "not recorded");
    set("provBranch", value(env, "branch") || "not recorded");
    set("provCommit", (value(env, "commit") || "").slice(0, 8) || "not recorded");
    set("provRetries", retry && retry.data ? String(retry.data.retry) : "0");
    set("provWhen", stop ? when(stop) : "not recorded");

    var link = document.getElementById("provLink");
    if (link && executor.buildUrl) { link.setAttribute("href", executor.buildUrl); }
  }

  function renderStats() {
    var stat = report.summary.statistic || {};
    var time = report.summary.time || {};
    var clean = stat.total && stat.passed === stat.total;
    /* Results, not tests. A case that runs on two browsers is two results and
       one case, so calling the total "tests" would claim twice the coverage
       that exists. The distinct count sits beside it and says what is really
       there. */
    var cases = distinctNames(
      suites.reduce(function (all, suite) { return all.concat(suite.tests); }, [])
    );
    set("statTests", stat.total || 0);
    set("statCases", cases);
    set("statSuites", suites.length);
    set("statPassing", (stat.total ? Math.round((stat.passed / stat.total) * 100) : 0) + "%");
    set("statDuration", wall(time.duration || 0));

    var passing = document.getElementById("statPassing");
    if (passing) { passing.classList.toggle("is-off", !clean); }
    if (embedMeta && time.stop) {
      embedMeta.textContent = "Allure report, published by GitHub Actions on " + when(time.stop);
    }
  }

  /* ---------- the suite column ---------- */

  function renderSuites() {
    suiteList.innerHTML = "";
    suites.forEach(function (suite, index) {
      var box = el("div", "suite");
      var head = el("button", "suite-head");
      head.type = "button";
      head.setAttribute("aria-expanded", "false");

      /* a verdict rather than a control: a tick when every result held, an
         exclamation when one did not. Both are readable at a glance and
         neither can be mistaken for the thing that opens the row. */
      var clean = suite.passed === suite.total;
      var mark = el("span", clean ? "suite-mark" : "suite-mark is-off", clean ? CHECK : ALERT);
      mark.setAttribute("role", "img");
      mark.setAttribute(
        "aria-label",
        clean ? "Every result passed" : suite.total - suite.passed + " of " + suite.total + " results did not pass"
      );
      mark.title = mark.getAttribute("aria-label");
      var count = el("span", "suite-count", plural(suite.total, "test"));
      var arrow = el("span", "suite-arrow", ARROW);
      arrow.setAttribute("aria-hidden", "true");

      head.appendChild(mark);
      head.appendChild(el("span", "suite-name", suite.name));
      head.appendChild(count);
      head.appendChild(arrow);

      var groups = el("ul", "suite-groups");
      groups.id = "suite-areas-" + index;

      /* A suite that ran on more than one browser says so in its own row. The
         same case on two browsers is two results and one case, so the chips
         count results and the areas below count them once per browser too. */
      /* The browsers sit outside the collapsible list, always visible. They are
         the filter for the runner, and a filter you have to expand a panel to
         discover is not one: this was hidden inside the areas and nobody found
         it, which is a fair description of a defect. */
      var browsers = null;
      if (suite.engines.length) {
        browsers = el("div", "suite-browsers");
        browsers.appendChild(el("span", "sb-label", "Ran on"));
        suite.engines.forEach(function (engine) {
          var chip = el("button", engine.passed === engine.total ? "cb-engines-chip" : "cb-engines-chip is-off");
          chip.type = "button";
          chip.setAttribute("aria-pressed", "false");
          /* The number counts results that passed, and without the word it was
             read as results that ran: 0/20 next to 20/20 said Chromium never
             started, when in fact it started twenty times and held none. Both
             engines are under "Ran on", so both ran; what differs is how they
             came out. */
          var ran = el("span", "cb-ran", CHECK);
          ran.setAttribute("aria-hidden", "true");
          chip.appendChild(ran);
          chip.appendChild(el("span", "cb-engine", engine.name));
          chip.appendChild(el("span", "cb-n", engine.passed + "/" + engine.total));
          chip.appendChild(el("span", "cb-unit", "passed"));
          chip.dataset.title =
            engine.name + ": " + engine.passed + " of " + plural(engine.total, "result") +
            " passed. Press to replay only this browser.";
          chip.title = chip.dataset.title;
          chip.setAttribute(
            "aria-label",
            engine.name + ", " + engine.passed + " of " + plural(engine.total, "result") + " passed"
          );
          chip.addEventListener("click", function () { toggleEngine(engine.name); });
          chip.dataset.engine = engine.name;
          browsers.appendChild(chip);
        });
      }
      var widest = suite.areas.reduce(function (most, area) { return Math.max(most, area.sum); }, 1);
      suite.areas.forEach(function (area) {
        var row = el("li");
        row.appendChild(el("b", null, area.name));
        /* the bar is the share of the suite's time this area takes, which is
           something a test plan cannot tell you and a run can */
        var track = el("span", "area-bar");
        var span = el("span");
        span.style.width = Math.max(4, (area.sum / widest) * 100) + "%";
        track.appendChild(span);
        row.appendChild(track);
        row.appendChild(el("span", "n", plural(area.count, "test")));
        groups.appendChild(row);
      });
      head.setAttribute("aria-controls", groups.id);

      head.addEventListener("click", function () {
        var open = box.classList.toggle("is-open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });

      box.appendChild(head);
      if (browsers) { box.appendChild(browsers); }
      box.appendChild(groups);
      suiteList.appendChild(box);

      suite.node = box;
      suite.countNode = count;
    });
  }

  /* One browser at a time, or all of them. The filter changes what the runner
     replays and what the counter counts; it does not change the report, which
     is why the numbers in the panels above stay where they are. */
  var engineFilter = null;

  function testsOf(suite) {
    if (!engineFilter) { return suite.tests; }
    return suite.tests.filter(function (test) {
      return (test.parameters || []).indexOf(engineFilter) !== -1;
    });
  }

  /* The console bar used to say Chromium whatever was selected, which is the
     kind of small lie that makes a reader doubt the rest of the page. It names
     what the runner is about to replay: one browser when one is chosen, all of
     them otherwise. */
  function describeBrowsers() {
    if (!consoleBrowser) { return; }
    var engines = fromEngineBranches().map(function (row) { return row.name; });
    var viewport = value(report.environment, "viewport");
    var who = engineFilter || (engines.length ? engines.join(" and ") : value(report.environment, "browser"));
    consoleBrowser.textContent = [who, viewport].filter(Boolean).join(" · ");
  }

  function chips() {
    return [].slice.call(document.querySelectorAll(".cb-engines-chip"));
  }

  function toggleEngine(name) {
    if (running) { return; }
    engineFilter = engineFilter === name ? null : name;
    describeBrowsers();

    chips().forEach(function (chip) {
      var on = chip.dataset.engine === engineFilter;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });

    runLabel.textContent = engineFilter ? "Run " + engineFilter + " only" : "Run the QA suites";
    if (hint) {
      hint.textContent = engineFilter
        ? "Replays only what ran on " + engineFilter + ". Press the browser again for the whole run."
        : "Replays the last run recorded in the Allure report, then opens that report below.";
    }
  }

  /* ---------- the console ---------- */

  function write(value, tone) {
    log.appendChild(el("span", tone || null, value + "\n"));
    log.scrollTop = log.scrollHeight;
  }

  function wait(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, reduce ? 0 : ms); });
  }

  var PROJECT = { "Functional E2E": "e2e-playwright", "Visual regression": "visual-regression" };

  function replay() {
    if (running || !suites.length) { return; }
    running = true;
    runButton.disabled = true;
    runLabel.textContent = "Running";
    log.innerHTML = "";
    /* the ticks belong to the replay that is starting, not the one before it */
    chips().forEach(function (chip) {
      chip.classList.remove("is-ran");
      if (chip.dataset.title) { chip.title = chip.dataset.title; }
    });

    /* a filtered replay plays a subset, and a suite that has nothing left in it
       is skipped rather than announced and then left empty */
    var playing = suites
      .map(function (suite) { return { suite: suite, tests: testsOf(suite) }; })
      .filter(function (row) { return row.tests.length; });
    var total = playing.reduce(function (sum, row) { return sum + row.tests.length; }, 0);
    var done = 0;
    var passed = 0;
    /* counted by the status Allure recorded, not lumped together: failed and
       broken mean different things and a QA reader knows the difference */
    var failures = {};
    var chain = Promise.resolve();

    playing.forEach(function (row) {
      var suite = row.suite;
      chain = chain.then(function () {
        suite.node.classList.add("is-running");
        write("> yarn playwright test --project=" + (PROJECT[suite.name] || suite.name), "head");
        write(
          "Running " + plural(row.tests.length, "test") +
            (engineFilter ? " on " + engineFilter : " on every browser this suite covers"),
          "muted"
        );
        return wait(420);
      });

      row.tests.forEach(function (test, index) {
        chain = chain.then(function () {
          var ok = test.status === "passed";
          if (ok) { passed += 1; } else { failures[test.status] = (failures[test.status] || 0) + 1; }
          done += 1;
          write(
            "  " + (ok ? CHECK : CROSS) + "  " + test.name + "  (" + secs(duration(test)) + ")" +
              (ok ? "" : "  " + test.status),
            ok ? "ok" : "warn"
          );
          suite.countNode.textContent = index + 1 + " / " + row.tests.length;
          if (progress) { progress.style.width = (done / total) * 100 + "%"; }
          if (counter) { counter.textContent = done + " / " + total + " tests"; }
          return wait(70);
        });
      });

      chain = chain.then(function () {
        suite.node.classList.remove("is-running");
        suite.countNode.textContent = plural(suite.total, "test");
        write("");
        return wait(180);
      });
    });

    return chain.then(function () {
      var time = report.summary.time || {};
      /* a fixed order, so the summary line reads the same way every run rather
         than in whatever order the failures happened to come back */
      var parts = [plural(passed, "test") + " passed"];
      ["failed", "broken", "skipped", "unknown"].forEach(function (status) {
        if (failures[status]) { parts.push(failures[status] + " " + status); }
      });
      Object.keys(failures).forEach(function (status) {
        if (["failed", "broken", "skipped", "unknown"].indexOf(status) === -1) {
          parts.push(failures[status] + " " + status);
        }
      });
      write(parts.join(", ") + "  (" + wall(time.duration || 0) + " wall time)", "head");
      write("Report published to ella79.github.io/agentic-playwright-suite", "muted");
      /* the console scrolls away, so the browsers that were replayed keep a
         tick: which engine the run covered is still on screen afterwards */
      chips().forEach(function (chip) {
        if (!engineFilter || chip.dataset.engine === engineFilter) {
          chip.classList.add("is-ran");
          chip.title = "Replayed in this run. " + chip.dataset.title;
        }
      });
      runButton.disabled = false;
      runLabel.textContent = "Run again";
      running = false;
      showResults();
    });
  }

  /* ---------- the dashboard ---------- */

  function ring() {
    var stat = report.summary.statistic || {};
    var rate = stat.total ? stat.passed / stat.total : 0;
    var radius = 52;
    var circumference = 2 * Math.PI * radius;

    var chart = svg("svg", { viewBox: "0 0 120 120", "class": "ring", role: "img" });
    var caption = svg("title", {});
    caption.textContent = Math.round(rate * 100) + " per cent of " + plural(stat.total || 0, "test") + " passed";
    chart.appendChild(caption);
    chart.appendChild(svg("circle", { "class": "ring-track", cx: 60, cy: 60, r: radius }));

    var arc = svg("circle", {
      /* a run that did not come back clean must not be drawn in the colour that
         means "clean". The number is the report's; so is the colour. */
      "class": rate < 1 ? "ring-fill is-off" : "ring-fill",
      cx: 60,
      cy: 60,
      r: radius,
      "stroke-dasharray": circumference,
      "stroke-dashoffset": circumference,
      transform: "rotate(-90 60 60)"
    });
    chart.appendChild(arc);

    var big = svg("text", { "class": "ring-v", x: 60, y: 58 });
    big.textContent = Math.round(rate * 100) + "%";
    var small = svg("text", { "class": "ring-l", x: 60, y: 78 });
    small.textContent = plural(stat.total || 0, "test");
    chart.appendChild(big);
    chart.appendChild(small);

    var wrap = document.getElementById("ringWrap");
    if (wrap) { fill(wrap, [chart]); }

    /* set after the circle is in the document, so the offset animates from
       empty rather than appearing already full */
    window.setTimeout(function () {
      arc.setAttribute("stroke-dashoffset", String(circumference * (1 - rate)));
    }, 80);

    var legend = document.getElementById("ringLegend");
    if (!legend) { return; }
    /* Failed and broken had the same amber dot, which put two different
       findings behind one colour in the only place the page explains them.
       A failed test is the application; a broken one is the suite or the box it
       ran in, and the legend has to be able to say so. */
    var rows = [
      { key: "passed", label: "Passed", tone: "is-pass" },
      { key: "failed", label: "Failed", tone: "is-fail" },
      { key: "broken", label: "Broken", tone: "is-broken" },
      { key: "skipped", label: "Skipped", tone: "is-skip" }
    ];
    fill(
      legend,
      rows.map(function (row) {
        var item = el("li", row.tone);
        item.appendChild(el("span", "dot"));
        item.appendChild(el("span", "label", row.label));
        item.appendChild(el("span", "n", String(stat[row.key] || 0)));
        return item;
      })
    );
  }

  /* An engine name arrives as the branch it labels, "Chromium" or "WebKit". A
     project that is the same engine at a different viewport says so in the same
     string, "WebKit on iPhone 15", and counting that as a second browser would
     overstate the coverage: it is one engine, two device profiles. The per
     project split belongs in the report, the trend and the health page, all of
     which are linked from this page. */
  function engineName(name) {
    return String(name || "").split(/\s+on\s+/i)[0].trim();
  }

  function fromEngineBranches() {
    var rows = [];
    suites.forEach(function (suite) {
      suite.engines.forEach(function (engine) {
        rows.push({ name: engineName(engine.name), total: engine.total, passed: engine.passed });
      });
    });
    /* two projects on one engine collapse into that engine, so a device profile
       is not counted as a second browser */
    var merged = {};
    var order = [];
    rows.forEach(function (row) {
      if (!merged[row.name]) {
        merged[row.name] = { name: row.name, total: 0, passed: 0 };
        order.push(row.name);
      }
      merged[row.name].total += row.total;
      merged[row.name].passed += row.passed;
    });
    return order.map(function (name) { return merged[name]; });
  }

  function distinctNames(tests) {
    var seen = {};
    tests.forEach(function (test) { seen[test.name] = true; });
    return Object.keys(seen).length;
  }

  /* A published run can legitimately carry failures. That is a result, not an
     error state of this page, and when it happens the trace is the artefact
     worth reaching for, not the dashboard. */
  function notClean() {
    var box = document.getElementById("notClean");
    var head = document.getElementById("ncHead");
    if (!box || !head) { return; }

    var stat = report.summary.statistic || {};
    var off = (stat.failed || 0) + (stat.broken || 0);
    if (!off) {
      box.hidden = true;
      return;
    }

    var parts = [];
    if (stat.failed) { parts.push(plural(stat.failed, "test") + " failed"); }
    if (stat.broken) { parts.push(stat.broken + " broke"); }
    head.textContent = "This run did not come back clean: " + parts.join(" and ") + " of " + stat.total + ".";
    box.hidden = false;
  }

  function suiteBars() {
    var host = document.getElementById("resultCards");
    if (!host) { return; }
    fill(
      host,
      suites.map(function (suite) {
        var card = el("div", "result-card");
        card.appendChild(el("h4", null, suite.name));
        card.appendChild(el("p", "meta", suite.passed + " of " + suite.total + " passed"));

        /* One segment per status the run recorded, in the colours the legend
           beside it names. The bar used to stop at the pass rate and leave the
           rest as track, and the track is grey, so a suite with twenty failures
           was drawing them in the colour this page uses for skipped. */
        var counts = suite.counts || {};
        var bar = el("div", "bar");
        var segments = [];
        STATUSES.forEach(function (status) {
          var n = counts[status] || 0;
          if (!n) { return; }
          var span = el("span", "seg-" + status);
          span.title = n + " " + status;
          bar.appendChild(span);
          segments.push({ node: span, share: suite.total ? (n / suite.total) * 100 : 0 });
        });
        card.appendChild(bar);

        /* the segments are named rather than left to the colour alone, so the
           card still reads without the legend and without colour at all */
        var key = el("ul", "bar-key");
        STATUSES.forEach(function (status) {
          var n = counts[status] || 0;
          if (!n) { return; }
          var item = el("li");
          item.appendChild(el("span", "swatch seg-" + status));
          item.appendChild(el("span", null, n + " " + status));
          key.appendChild(item);
        });
        if (key.childNodes.length > 1) { card.appendChild(key); }
        /* naming the browsers here matters: forty results out of twenty cases
           reads as twice the coverage unless the card says where the doubling
           came from */
        var where = suite.engines.length
          ? " on " + suite.engines.map(function (engine) { return engineName(engine.name); }).join(" and ")
          : "";
        card.appendChild(
          el(
            "p",
            "meta",
            secs(suite.sum) + " of test time across " + plural(suite.areas.length, "area") + where
          )
        );

        window.setTimeout(function () {
          segments.forEach(function (segment) { segment.node.style.width = segment.share + "%"; });
        }, 80);
        return card;
      })
    );
  }

  function environment() {
    var host = document.getElementById("envList");
    if (!host) { return; }
    var env = report.environment || [];
    var runner = value(env, "os") + (value(env, "node") ? ", node " + value(env, "node") : "");
    /* The browser field is written by hand into the report's environment, and
       it said Chromium on a run that also covered WebKit. The engines derived
       from the results are the run itself rather than a note about it, so they
       win when there are any. */
    var engines = fromEngineBranches().map(function (row) { return row.name; });
    var rows = [
      ["Target", value(env, "base_url")],
      ["Browser", engines.length ? engines.join(" and ") : value(env, "browser")],
      ["Viewport", value(env, "viewport")],
      ["Runner", runner],
      ["Pipeline", value(env, "ci")]
    ].filter(function (row) { return row[1]; });

    var card = document.getElementById("envCard");
    if (!rows.length) {
      if (card) { card.hidden = true; }
      return;
    }
    if (card) { card.hidden = false; }
    host.innerHTML = "";
    rows.forEach(function (row) {
      host.appendChild(el("dt", null, row[0]));
      host.appendChild(el("dd", null, row[1]));
    });
  }

  function trend() {
    var host = document.getElementById("trend");
    if (!host) { return; }
    var history = (report.history || []).slice().reverse();
    var durations = (report.durations || []).slice().reverse();
    var card = document.getElementById("trendCard");
    if (!history.length) {
      if (card) { card.hidden = true; }
      return;
    }
    if (card) { card.hidden = false; }

    /* the duration widget is a separate file, so it can be the one that is
       missing. The history alone still draws a chart, it just measures the
       runs by the tests they carried rather than by the time they took. */
    var byTime = durations.length === history.length;
    var longest = (byTime ? durations : history).reduce(function (most, row) {
      var data = row.data || {};
      return Math.max(most, byTime ? data.duration || 0 : data.total || 0);
    }, 1);

    fill(
      host,
      history.map(function (row, index) {
        var data = row.data || {};
        var clean = !data.failed && !data.broken;
        var ms = ((durations[index] || {}).data || {}).duration || 0;
        var column = el("div", "trend-col" + (clean ? "" : " is-fail"));
        var bar = el("span", "trend-bar");
        bar.style.height = Math.max(6, ((byTime ? ms : data.total || 0) / longest) * 100) + "%";
        bar.title =
          (row.buildName || "Run " + (row.buildOrder || index + 1)) + ": " +
          plural(data.passed || 0, "test") + " passed" +
          (data.failed ? ", " + data.failed + " failed" : "") +
          (ms ? ", " + wall(ms) : "");
        column.appendChild(bar);
        column.appendChild(el("span", "trend-l", row.buildOrder ? "#" + row.buildOrder : "–"));
        return column;
      })
    );

    var note = document.getElementById("trendNote");
    if (note) {
      note.textContent =
        (byTime ? "Wall time of the last " : "Tests carried by the last ") +
        plural(history.length, "published run") +
        ", newest on the right. A bar turns amber when that run had a failure.";
    }
  }

  function slowest() {
    var host = document.getElementById("slowList");
    if (!host) { return; }
    var all = [];
    suites.forEach(function (suite) {
      suite.tests.forEach(function (test) { all.push(test); });
    });
    all.sort(function (a, b) { return duration(b) - duration(a); });
    var top = all.slice(0, 5);
    if (!top.length) { return; }
    var longest = duration(top[0]) || 1;

    fill(
      host,
      top.map(function (test) {
        var item = el("li");
        item.appendChild(el("span", "slow-name", test.name));
        var bar = el("span", "slow-bar");
        var span = el("span");
        bar.appendChild(span);
        item.appendChild(bar);
        item.appendChild(el("span", "slow-v", secs(duration(test))));
        window.setTimeout(function () {
          span.style.width = (duration(test) / longest) * 100 + "%";
        }, 80);
        return item;
      })
    );
  }

  function showResults() {
    if (!results) { return; }
    if (!drawn) {
      notClean();
      ring();
      suiteBars();
      environment();
      trend();
      slowest();
      drawn = true;
    }
    /* the report is a full application of its own, so it is fetched when it is
       asked for rather than on every visit to this page */
    if (frame && !frame.getAttribute("src")) {
      frame.setAttribute("src", frame.getAttribute("data-src"));
    }
    results.classList.add("is-ready");
    if (hint) { hint.textContent = "That is the published run. What it says is below, report included."; }
    results.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  /* ---------- start ---------- */

  function unreachable(message) {
    log.innerHTML = "";
    write("> Could not read the published report from this page.", "warn");
    write(message, "muted");
    write("The report is at " + REPORT, "muted");
    runButton.disabled = false;
    runLabel.textContent = "Open the report";
    runButton.addEventListener("click", function () {
      window.open(REPORT, "_blank", "noopener");
    });
  }

  /* The run needs the summary and the suites. Everything else only adds a
     panel, so a widget that is missing costs that panel rather than the page. */
  function ask(path) {
    return fetch(REPORT + path).then(function (response) {
      if (!response.ok) { throw new Error(path + " answered " + response.status); }
      return response.json();
    });
  }

  function pause(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function json(path, fallback) {
    /* Publishing the report is not one atomic step: for a moment during a
       deploy a file can be gone, or half of the old report can be answering
       beside half of the new one. A single retry covers that window, and it is
       cheaper than showing a visitor an error for a run that is fine. */
    return ask(path)
      .catch(function () {
        return pause(1500).then(function () { return ask(path); });
      })
      .catch(function (error) {
        if (fallback === undefined) { throw error; }
        return fallback;
      });
  }

  if (!window.fetch) {
    unreachable("This browser does not support fetch, which is how the report is read.");
    return;
  }

  Promise.all([
    json("widgets/summary.json"),
    json("data/suites.json"),
    json("widgets/executors.json", []),
    json("widgets/environment.json", []),
    json("widgets/history-trend.json", []),
    json("widgets/duration-trend.json", []),
    json("widgets/retry-trend.json", [])
  ])
    .then(function (payload) {
      report = {
        summary: payload[0] || {},
        executors: payload[2],
        environment: payload[3],
        history: payload[4],
        durations: payload[5],
        retries: payload[6]
      };
      suites = readSuites(payload[1] || {});
      if (!suites.length) { throw new Error("The report holds no suites."); }
      renderSuites();
      renderStats();
      renderProvenance();
      describeBrowsers();
      /* the button waits for the report rather than pretending to be ready:
         until the numbers are in there is nothing for it to replay */
      runButton.addEventListener("click", replay);
      runLabel.textContent = "Run the QA suites";
      runButton.disabled = false;
    })
    .catch(function (error) {
      unreachable(error && error.message ? error.message : "The request did not complete.");
    });
})();
