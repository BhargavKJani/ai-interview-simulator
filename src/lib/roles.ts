import type { Difficulty, Question, RoleId } from "./types";

export interface RoleInfo {
  id: RoleId;
  title: string;
  tagline: string;
  icon: string;
  accent: string; // tailwind gradient classes
  pro: boolean; // Pro-only role on the Free plan
}

export const ROLES: RoleInfo[] = [
  { id: "frontend", title: "Frontend Developer", tagline: "React, browsers, performance, a11y", icon: "⚛️", accent: "from-cyan-400 to-blue-500", pro: false },
  { id: "android", title: "Android Developer", tagline: "Kotlin, Jetpack, lifecycle, Compose", icon: "🤖", accent: "from-lime-400 to-emerald-500", pro: false },
  { id: "backend", title: "Backend Engineer", tagline: "APIs, databases, scaling, reliability", icon: "🛰️", accent: "from-violet-400 to-fuchsia-500", pro: true },
  { id: "data-analyst", title: "Data Analyst", tagline: "SQL, statistics, dashboards, insight", icon: "📊", accent: "from-amber-300 to-orange-500", pro: false },
  { id: "product-manager", title: "Product Manager", tagline: "Prioritisation, metrics, discovery", icon: "🧭", accent: "from-pink-400 to-rose-500", pro: true },
  { id: "hr", title: "HR / Behavioural Round", tagline: "STAR stories, culture fit, salary talk", icon: "🤝", accent: "from-teal-300 to-sky-500", pro: false },
];

export const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: "junior", label: "Junior", blurb: "Fundamentals & fresher-level" },
  { id: "mid", label: "Mid-level", blurb: "2–5 yrs, trade-offs & ownership" },
  { id: "senior", label: "Senior", blurb: "Architecture, leadership, depth" },
];

export function getRole(id: string): RoleInfo | undefined {
  return ROLES.find((r) => r.id === id);
}

export function isRoleId(id: unknown): id is RoleId {
  return typeof id === "string" && ROLES.some((r) => r.id === id);
}

export function isDifficulty(d: unknown): d is Difficulty {
  return d === "junior" || d === "mid" || d === "senior";
}

type Bank = Record<RoleId, Record<Difficulty, Omit<Question, "id">[]>>;

const q = (text: string, keywords: string[], hint: string) => ({ text, keywords, hint });

export const QUESTION_BANK: Bank = {
  frontend: {
    junior: [
      q("What is the difference between let, const and var in JavaScript?", ["scope", "block", "hoisting", "reassign", "function"], "Cover block vs function scope, hoisting/TDZ and reassignment."),
      q("Explain how the CSS box model works.", ["margin", "border", "padding", "content", "box-sizing"], "Name the four layers and mention box-sizing: border-box."),
      q("What happens when you type a URL into the browser and press Enter?", ["dns", "tcp", "http", "render", "html", "parse"], "Walk through DNS, TCP/TLS, request, parsing, render tree and paint."),
    ],
    mid: [
      q("How does React decide when to re-render a component, and how would you avoid unnecessary renders?", ["state", "props", "memo", "usememo", "usecallback", "reconciliation"], "Explain state/props/context triggers, then memoisation and profiling."),
      q("How would you improve the Core Web Vitals of a slow landing page?", ["lcp", "cls", "inp", "lazy", "image", "bundle", "cache"], "Measure first, then tackle LCP, CLS and INP with concrete fixes."),
      q("Describe how you would make a custom dropdown component accessible.", ["aria", "keyboard", "focus", "screen reader", "role"], "Mention roles, aria attributes, keyboard nav and focus management."),
    ],
    senior: [
      q("How would you architect the frontend of a large app shared by several teams?", ["micro", "monorepo", "design system", "ownership", "module", "boundaries"], "Discuss boundaries, shared design system, build tooling and governance."),
      q("Compare SSR, SSG, ISR and CSR. When would you pick each?", ["seo", "server", "static", "hydration", "cache", "latency"], "Tie each strategy to data freshness, SEO and infrastructure cost."),
      q("Tell me about a time you led a major frontend migration. How did you de-risk it?", ["incremental", "metrics", "rollout", "feature flag", "team", "test"], "Use STAR and highlight incremental rollout and measurement."),
    ],
  },
  android: {
    junior: [
      q("Explain the Android Activity lifecycle.", ["oncreate", "onstart", "onresume", "onpause", "onstop", "ondestroy"], "List the callbacks in order and what belongs in each."),
      q("What is the difference between val and var in Kotlin, and what are null-safety operators?", ["immutable", "mutable", "null", "?.", "elvis", "!!"], "Cover immutability and ?., ?:, !! with an example."),
      q("What is an Intent and what types of Intents exist?", ["explicit", "implicit", "activity", "component", "action"], "Contrast explicit vs implicit intents with use cases."),
    ],
    mid: [
      q("How do ViewModel and LiveData/StateFlow help survive configuration changes?", ["viewmodel", "lifecycle", "stateflow", "livedata", "rotation", "observe"], "Explain scope, lifecycle-awareness and one-way data flow."),
      q("How would you structure background work like syncing data every few hours?", ["workmanager", "constraints", "coroutine", "battery", "retry"], "Mention WorkManager, constraints, backoff and Doze."),
      q("Explain Kotlin coroutines: scopes, dispatchers and structured concurrency.", ["scope", "dispatcher", "suspend", "launch", "async", "cancel"], "Show how cancellation propagates in structured concurrency."),
    ],
    senior: [
      q("How would you modularise a large Android codebase to speed up builds?", ["module", "gradle", "feature", "dependency", "build time", "api"], "Discuss feature/core modules, API boundaries and build caching."),
      q("How do you diagnose and fix jank and memory leaks in a Compose app?", ["recomposition", "profiler", "leakcanary", "stable", "remember", "frame"], "Name tools and Compose-specific causes of recomposition."),
      q("Describe your approach to offline-first architecture on Android.", ["room", "sync", "conflict", "repository", "cache", "single source"], "Cover local DB as source of truth and conflict resolution."),
    ],
  },
  backend: {
    junior: [
      q("What is the difference between SQL and NoSQL databases?", ["schema", "relational", "document", "scale", "transaction", "join"], "Compare data model, consistency and when to use each."),
      q("Explain what a REST API is and common HTTP status codes.", ["resource", "get", "post", "200", "404", "500", "stateless"], "Mention resources, verbs, statelessness and key status codes."),
      q("What is an index in a database and why does it matter?", ["b-tree", "lookup", "query", "write", "performance"], "Explain read speed-ups vs write cost with an example."),
    ],
    mid: [
      q("How would you design rate limiting for a public API?", ["token bucket", "redis", "sliding window", "429", "key", "distributed"], "Pick an algorithm, storage and how clients are informed."),
      q("Explain how you would make an endpoint idempotent.", ["idempotency key", "retry", "duplicate", "transaction", "unique"], "Use idempotency keys and explain retries."),
      q("How do you approach caching, and what are the risks?", ["ttl", "invalidation", "stale", "redis", "cache-aside", "stampede"], "Discuss strategy, invalidation and stampede protection."),
    ],
    senior: [
      q("Design a URL shortener that handles 10k requests per second.", ["hash", "database", "cache", "shard", "id", "replication"], "Cover ID generation, storage, caching and scaling reads."),
      q("How would you migrate a monolith to services without downtime?", ["strangler", "incremental", "contract", "data", "observability", "rollback"], "Use the strangler pattern and talk about data ownership."),
      q("Tell me about an outage you handled. What did you change afterwards?", ["postmortem", "root cause", "monitoring", "alert", "blameless"], "STAR format; emphasise detection, mitigation and follow-ups."),
    ],
  },
  "data-analyst": {
    junior: [
      q("What is the difference between INNER JOIN, LEFT JOIN and FULL OUTER JOIN?", ["inner", "left", "outer", "null", "match", "rows"], "Explain which rows survive each join, ideally with an example."),
      q("Explain mean, median and mode. When is the median a better choice?", ["mean", "median", "mode", "outlier", "skew"], "Mention outliers and skewed distributions like salaries."),
      q("How do you handle missing values in a dataset?", ["drop", "impute", "mean", "median", "bias", "pattern"], "Investigate why data is missing before choosing a strategy."),
    ],
    mid: [
      q("Daily active users dropped 15% yesterday. How would you investigate?", ["segment", "tracking", "release", "seasonality", "funnel", "data quality"], "Check data quality first, then segment by platform, region, release."),
      q("How would you design an A/B test for a new checkout button?", ["hypothesis", "sample size", "control", "significance", "metric", "randomise"], "Define hypothesis, metric, sample size and guardrails."),
      q("Explain window functions in SQL with an example.", ["over", "partition", "row_number", "rank", "running total"], "Show PARTITION BY and a running total or ranking."),
    ],
    senior: [
      q("How would you define a north-star metric for a subscription product?", ["retention", "value", "leading", "lagging", "engagement", "revenue"], "Tie it to customer value and explain supporting metrics."),
      q("How do you communicate a finding that contradicts what leadership expects?", ["evidence", "story", "stakeholder", "visual", "recommendation"], "Lead with the insight, show evidence, give a recommendation."),
      q("Tell me about a dashboard you built that changed a decision.", ["stakeholder", "metric", "impact", "decision", "adoption"], "STAR format with a measurable business outcome."),
    ],
  },
  "product-manager": {
    junior: [
      q("How do you prioritise features when everything feels urgent?", ["impact", "effort", "rice", "user", "goal", "trade-off"], "Name a framework (RICE/ICE) and link to goals."),
      q("What makes a good user story?", ["user", "value", "acceptance criteria", "as a", "so that"], "Mention the format and acceptance criteria."),
      q("How would you gather feedback on a new feature?", ["interview", "survey", "analytics", "usability", "qualitative", "quantitative"], "Mix qualitative and quantitative methods."),
    ],
    mid: [
      q("How would you improve Swiggy's or Zomato's reorder experience?", ["user", "pain point", "metric", "hypothesis", "experiment", "segment"], "Pick a segment, a pain point, solutions and a success metric."),
      q("Your engineering team says a feature will take 3x longer than planned. What do you do?", ["scope", "trade-off", "stakeholder", "mvp", "communicate"], "Re-scope to an MVP and communicate trade-offs."),
      q("What metrics would you track for a new onboarding flow?", ["activation", "completion", "drop-off", "retention", "time"], "Cover activation, funnel drop-off and retention."),
    ],
    senior: [
      q("How do you set a product strategy for the next 12 months?", ["vision", "market", "bets", "okr", "customer", "competition"], "Go from vision to bets to measurable OKRs."),
      q("Tell me about a product you killed. How did you decide?", ["data", "cost", "opportunity", "stakeholder", "learning"], "Show data-driven reasoning and how you managed stakeholders."),
      q("How do you balance platform investments against customer-facing features?", ["tech debt", "velocity", "roadmap", "trade-off", "long-term"], "Quantify platform value in terms of velocity and risk."),
    ],
  },
  hr: {
    junior: [
      q("Tell me about yourself.", ["experience", "skills", "project", "goal", "role"], "Present-past-future: who you are, key wins, why this role."),
      q("Why do you want to work with our company?", ["mission", "product", "culture", "growth", "research"], "Show research and connect it to your goals."),
      q("What are your greatest strengths and one weakness?", ["strength", "example", "weakness", "improve", "learning"], "Back strengths with examples; show progress on the weakness."),
    ],
    mid: [
      q("Describe a conflict with a teammate and how you resolved it.", ["situation", "task", "action", "result", "listen", "communicate"], "Use STAR and focus on empathy and outcome."),
      q("Tell me about a time you failed. What did you learn?", ["mistake", "ownership", "learning", "result", "change"], "Own the failure and show what you changed."),
      q("What are your salary expectations?", ["research", "range", "market", "flexible", "value"], "Give a researched range and show flexibility."),
    ],
    senior: [
      q("How do you handle an underperforming team member?", ["feedback", "expectations", "support", "plan", "one-on-one", "document"], "Clear expectations, support, timeline and documentation."),
      q("Tell me about a time you influenced a decision without authority.", ["stakeholder", "data", "trust", "alignment", "result"], "Show how you built trust and used evidence."),
      q("Where do you see yourself in five years?", ["growth", "leadership", "impact", "skills", "company"], "Ambitious but aligned with the company's path."),
    ],
  },
};

/** Deterministic PRNG so the same seed yields the same interview (handy for tests). */
export function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Build the question list for a session. Questions for the chosen level come first,
 * topped up from adjacent levels if more are requested.
 */
export function pickQuestions(role: RoleId, difficulty: Difficulty, count: number, seed = Date.now()): Question[] {
  const bank = QUESTION_BANK[role];
  const order: Difficulty[] =
    difficulty === "junior" ? ["junior", "mid", "senior"] : difficulty === "mid" ? ["mid", "junior", "senior"] : ["senior", "mid", "junior"];
  const rand = seededRandom(seed);
  const pool: Question[] = [];
  for (const level of order) {
    const items = bank[level].map((item, i) => ({ ...item, id: `${role}-${level}-${i}` }));
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    pool.push(...items);
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}
