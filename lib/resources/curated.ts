// Curated fallback resources — real, free, currently-active picks keyed by what
// a milestone is about. Used as the reliable default and as the fallback when a
// live grounded search returns nothing. Dependency-free.

import type { Milestone } from "@/lib/db/schema";

export interface ResourceSeed {
  kind: "course" | "program" | "portfolio" | "dataset" | "tool" | "competition" | "reading" | "other";
  title: string;
  provider: string;
  url: string;
  costNote: string;
  summary: string;
  flags: string[];
  source: "curated" | "grounded" | "catalog";
}

const r = (
  kind: ResourceSeed["kind"],
  title: string,
  provider: string,
  url: string,
  costNote: string,
  summary: string,
): ResourceSeed => ({ kind, title, provider, url, costNote, summary, flags: [], source: "curated" });

// Keyword → a couple of genuinely useful, free resources for that kind of step.
const RULES: { test: RegExp; pick: (domains: Set<string>) => ResourceSeed[] }[] = [
  {
    test: /course|learn|intro|study|basics|foundation/i,
    pick: (d) =>
      d.has("computer-science") || d.has("math")
        ? [
            r("course", "Python for Everybody", "Coursera (U. Michigan)", "https://www.coursera.org/specializations/python", "Free audit", "A gentle, well-loved intro to programming you can audit for free."),
            r("course", "Intro to Computer Science (CS50x)", "edX (Harvard)", "https://www.edx.org/cs50", "Free", "The gold-standard free CS foundations course."),
          ]
        : [
            r("course", "Khan Academy", "Khan Academy", "https://www.khanacademy.org", "Free", "Free, structured lessons across most subjects to build the basics."),
            r("course", "MIT OpenCourseWare", "MIT OCW", "https://ocw.mit.edu", "Free", "Real MIT course materials, free, for going deeper on a topic."),
          ],
  },
  {
    test: /data|collect|dataset|spreadsheet|sample/i,
    pick: () => [
      r("dataset", "Kaggle Datasets", "Kaggle", "https://www.kaggle.com/datasets", "Free", "Thousands of open datasets to analyze (free account, parental consent under 18)."),
      r("dataset", "Data.gov", "U.S. Government", "https://data.gov", "Free", "Official open public datasets — great for a real, citable source."),
    ],
  },
  {
    test: /chart|graph|visuali|notebook|analy|plot|model/i,
    pick: () => [
      r("tool", "Google Colab", "Google", "https://colab.research.google.com", "Free", "A free, no-install Python notebook with charts — perfect for first analyses."),
      r("tool", "Datawrapper", "Datawrapper", "https://www.datawrapper.de", "Free tier", "Make clean, shareable charts without code."),
    ],
  },
  {
    test: /write|draft|essay|analysis|story|report|paper/i,
    pick: () => [
      r("reading", "Purdue OWL", "Purdue University", "https://owl.purdue.edu", "Free", "The standard free guide to citations and academic writing."),
      r("tool", "Hemingway Editor", "Hemingway", "https://hemingwayapp.com", "Free", "Tightens your writing by flagging dense, unclear sentences."),
    ],
  },
  {
    test: /portfolio|gallery|showcase|publish|present|share/i,
    pick: (d) =>
      d.has("arts-visual")
        ? [
            r("portfolio", "Behance", "Adobe", "https://www.behance.net", "Free", "Where young artists build a real, shareable visual portfolio."),
            r("portfolio", "Google Sites", "Google", "https://sites.google.com", "Free", "Spin up a simple personal portfolio site in an afternoon."),
          ]
        : [
            r("portfolio", "GitHub Pages", "GitHub", "https://pages.github.com", "Free", "Publish a project page or write-up for free."),
            r("portfolio", "Google Sites", "Google", "https://sites.google.com", "Free", "A simple, free home for the finished work."),
          ],
  },
  {
    test: /research|source|read up|background|literature/i,
    pick: () => [
      r("reading", "Google Scholar", "Google", "https://scholar.google.com", "Free", "Find real peer-reviewed sources for a literature review."),
      r("tool", "Connected Papers", "Connected Papers", "https://www.connectedpapers.com", "Free tier", "Visualize how research papers relate — fast way to map a field."),
    ],
  },
  {
    test: /design|sketch|art|draw|paint|illustrat/i,
    pick: () => [
      r("tool", "Krita", "Krita", "https://krita.org", "Free", "A powerful free digital-painting program."),
      r("course", "Drawabox", "Drawabox", "https://drawabox.com", "Free", "A free, structured course on the fundamentals of drawing."),
    ],
  },
];

export function curatedResources(milestone: Milestone, domains: Set<string>): ResourceSeed[] {
  const hay = `${milestone.title} ${milestone.detail ?? ""} ${milestone.kind ?? ""}`;
  for (const rule of RULES) {
    if (rule.test.test(hay)) return rule.pick(domains).slice(0, 2);
  }
  // Generic, always-useful default.
  return [
    r("course", "Khan Academy", "Khan Academy", "https://www.khanacademy.org", "Free", "Free lessons to build the skills this step needs."),
  ];
}
