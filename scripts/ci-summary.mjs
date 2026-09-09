#!/usr/bin/env node
/* Turns a Playwright JSON report into the summary GitHub draws on the run page.
 *
 * A CI run that only says "green" wastes the one place a reader is already
 * looking. The log is a wall of text nobody opens, and the HTML report is an
 * artifact you have to download and unzip first. A job summary is markdown, it
 * renders on the run page itself, and it renders mermaid, so the shape of the
 * run can be seen rather than counted.
 *
 * Usage: node scripts/ci-summary.mjs reports/results.json >> "$GITHUB_STEP_SUMMARY"
 */
import { readFile } from "node:fs/promises";

const file = process.argv[2] || "reports/results.json";

let report;
try {
  report = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.log(`### Test summary\n\nNo report to read at \`${file}\`: ${error.message}`);
  process.exit(0);
}

/** The JSON reporter nests suites by file and then by describe block. The
 *  describe title is worth keeping: it is how the suite is organised, and a
 *  reader wants to know which area a failure sits in, not which file. */
function specs(node, file = "", group = "", out = []) {
  const here = node.file || file;
  (node.specs || []).forEach((spec) => {
    (spec.tests || []).forEach((test) => {
      const last = (test.results || [])[test.results.length - 1] || {};
      out.push({
        file: here,
        group: group || "ungrouped",
        title: spec.title,
        project: test.projectName || "",
        status: test.status || last.status || "unknown",
        duration: (test.results || []).reduce((sum, result) => sum + (result.duration || 0), 0),
        retries: Math.max(0, (test.results || []).length - 1),
      });
    });
  });
  (node.suites || []).forEach((child) => specs(child, here, group || child.title, out));
  return out;
}

const all = (report.suites || []).flatMap((suite) => specs(suite));
const stats = report.stats || {};
const counted = {
  passed: all.filter((test) => test.status === "expected").length,
  failed: all.filter((test) => test.status === "unexpected").length,
  flaky: all.filter((test) => test.status === "flaky").length,
  skipped: all.filter((test) => test.status === "skipped").length,
};
const total = all.length;
const seconds = (ms) => (ms / 1000).toFixed(1) + "s";
const wall = (ms) => {
  const t = Math.round(ms / 1000);
  return t >= 60 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${t}s`;
};

const lines = [];

/* A run that never started is not a green run. Playwright reports that case as
   zero tests plus an error, and the first version of this script cheerfully
   called it "Suite green": the web server had not come up, nothing executed,
   and the summary said everything was fine. */
if (total === 0) {
  lines.push("## Suite did not run");
  lines.push("");
  lines.push("No test was executed. That is a failure of the run, not a pass.");
  const errors = report.errors || [];
  if (errors.length) {
    lines.push("");
    errors.forEach((error) => {
      lines.push("```");
      lines.push((error.message || String(error)).split("\n").slice(0, 6).join("\n"));
      lines.push("```");
    });
  }
  console.log(lines.join("\n"));
  process.exit(0);
}

const clean = counted.failed === 0 && counted.flaky === 0;

lines.push(`## ${clean ? "Suite green" : "Suite not clean"}`);
lines.push("");
lines.push(`| Tests | Passed | Failed | Flaky | Skipped | Wall time |`);
lines.push(`| ----: | -----: | -----: | ----: | ------: | --------: |`);
lines.push(
  `| ${total} | ${counted.passed} | ${counted.failed} | ${counted.flaky} | ${counted.skipped} | ${wall(stats.duration || 0)} |`,
);
lines.push("");

/* Mermaid renders in a job summary, so the shape of the run is drawn rather
   than counted. Which pie depends on what the reader needs: when something
   broke, the split by status is the question. When nothing did, the split by
   status is one slice and says nothing, so the chart earns its place by showing
   what the suite covers instead. */
function pie(title, entries) {
  const slices = entries.filter(([, count]) => count > 0);
  if (slices.length < 2) return;
  lines.push("```mermaid");
  lines.push("pie showData");
  lines.push(`    title ${title}`);
  slices.forEach(([name, count]) => lines.push(`    "${name}" : ${count}`));
  lines.push("```");
  lines.push("");
}

const groups = [...new Set(all.map((test) => test.group))];

if (clean) {
  pie(
    "What the suite covers",
    groups.map((group) => [group, all.filter((test) => test.group === group).length]),
  );
} else {
  pie(
    "Results by status",
    Object.entries(counted).map(([name, count]) => [name[0].toUpperCase() + name.slice(1), count]),
  );
}

/* Every check runs on two projects, desktop and mobile. Splitting by project
   answers the first question a red run raises: is it both, or only one? */
const projects = [...new Set(all.map((test) => test.project))].filter(Boolean);
if (projects.length > 1) {
  lines.push(`| Project | Tests | Failed | Flaky |`);
  lines.push(`| ------- | ----: | -----: | ----: |`);
  projects.forEach((project) => {
    const mine = all.filter((test) => test.project === project);
    lines.push(
      `| ${project} | ${mine.length} | ${mine.filter((t) => t.status === "unexpected").length} | ${mine.filter((t) => t.status === "flaky").length} |`,
    );
  });
  lines.push("");
}

const broken = all.filter((test) => test.status === "unexpected" || test.status === "flaky");
if (broken.length) {
  lines.push(`### What did not hold`);
  lines.push("");
  lines.push(`| Area | Test | Project | Status | Retries |`);
  lines.push(`| ---- | ---- | ------- | ------ | ------: |`);
  broken.forEach((test) => {
    lines.push(`| ${test.group} | ${test.title} | ${test.project} | ${test.status} | ${test.retries} |`);
  });
  lines.push("");
}

const slowest = [...all].sort((a, b) => b.duration - a.duration).slice(0, 5);
if (slowest.length) {
  lines.push(`### Slowest five`);
  lines.push("");
  lines.push(`| Test | Project | Duration |`);
  lines.push(`| ---- | ------- | -------: |`);
  slowest.forEach((test) => {
    lines.push(`| ${test.title} | ${test.project} | ${seconds(test.duration)} |`);
  });
  lines.push("");
}

console.log(lines.join("\n"));
