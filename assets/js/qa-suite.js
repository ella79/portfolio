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
  var ARROW = "▾";

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

  function readSuites(tree) {
    return (tree.children || []).map(function (suite) {
      var tests = leaves(suite, []);
      var sum = 0;
      tests.forEach(function (test) { sum += duration(test); });
      return {
        name: suite.name,
        areas: (suite.children || []).map(function (area) {
          var inArea = leaves(area, []);
          var areaSum = 0;
          inArea.forEach(function (test) { areaSum += duration(test); });
          return { name: area.name, count: inArea.length, sum: areaSum };
        }),
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
    set("statTests", stat.total || 0);
    set("statSuites", suites.length);
    set("statPassing", (stat.total ? Math.round((stat.passed / stat.total) * 100) : 0) + "%");
    set("statDuration", wall(time.duration || 0));
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

      var mark = el("span", "suite-mark", suite.passed === suite.total ? CHECK : CROSS);
      mark.setAttribute("aria-hidden", "true");
      var count = el("span", "suite-count", plural(suite.total, "test"));
      var arrow = el("span", "suite-arrow", ARROW);
      arrow.setAttribute("aria-hidden", "true");

      head.appendChild(mark);
      head.appendChild(el("span", "suite-name", suite.name));
      head.appendChild(count);
      head.appendChild(arrow);

      var groups = el("ul", "suite-groups");
      groups.id = "suite-areas-" + index;
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
      box.appendChild(groups);
      suiteList.appendChild(box);

      suite.node = box;
      suite.countNode = count;
    });
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

    var total = suites.reduce(function (sum, suite) { return sum + suite.total; }, 0);
    var done = 0;
    var passed = 0;
    var failures = 0;
    var chain = Promise.resolve();

    suites.forEach(function (suite) {
      chain = chain.then(function () {
        suite.node.classList.add("is-running");
        write("> yarn playwright test --project=" + (PROJECT[suite.name] || suite.name), "head");
        write("Running " + plural(suite.total, "test") + " on Chromium 1920 x 1080", "muted");
        return wait(420);
      });

      suite.tests.forEach(function (test, index) {
        chain = chain.then(function () {
          var ok = test.status === "passed";
          if (ok) { passed += 1; } else { failures += 1; }
          done += 1;
          write("  " + (ok ? CHECK : CROSS) + "  " + test.name + "  (" + secs(duration(test)) + ")", ok ? "ok" : "warn");
          suite.countNode.textContent = index + 1 + " / " + suite.total;
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
      write(
        plural(passed, "test") + " passed" + (failures ? ", " + failures + " failed" : "") +
          "  (" + wall(time.duration || 0) + " wall time)",
        "head"
      );
      write("Report published to ella79.github.io/agentic-playwright-suite", "muted");
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
      "class": "ring-fill",
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
    var rows = [
      { key: "passed", label: "Passed", tone: "is-pass" },
      { key: "failed", label: "Failed", tone: "is-fail" },
      { key: "broken", label: "Broken", tone: "is-fail" },
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

  function suiteBars() {
    var host = document.getElementById("resultCards");
    if (!host) { return; }
    fill(
      host,
      suites.map(function (suite) {
        var card = el("div", "result-card");
        card.appendChild(el("h4", null, suite.name));
        card.appendChild(el("p", "meta", suite.passed + " of " + suite.total + " passed"));

        var bar = el("div", "bar");
        var span = el("span");
        bar.appendChild(span);
        card.appendChild(bar);
        card.appendChild(
          el("p", "meta", secs(suite.sum) + " of test time across " + plural(suite.areas.length, "area"))
        );

        window.setTimeout(function () {
          span.style.width = (suite.total ? (suite.passed / suite.total) * 100 : 0) + "%";
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
    var rows = [
      ["Target", value(env, "base_url")],
      ["Browser", value(env, "browser")],
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
