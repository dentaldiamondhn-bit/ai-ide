# Findings & Observations — ai-ide

Running log of issues found while auditing this project. Created 2026-10-16.

Use this file to pick work back up later. Each item has a status, a location to
start from, and a suggested fix. Update the status as you close items.

**Statuses:** `RESOLVED` · `OPEN` · `NEEDS DECISION` (requires your input)

---

## 1. Resolved this session

| # | Item | Resolution |
|---|---|---|
| 1.1 | **SurrealDB removed** | `src/lib/surrealdb.ts` + `setup.surql` deleted, `surrealdb` dependency uninstalled, 4 `SURREALDB_*` vars dropped from `.env`. Was fully orphaned — nothing imported it, and all `/api/db` handlers use `supabaseAdmin`. `tsc --noEmit` clean, `npm run build` passes (19 pages). Recoverable via commit `3728e77`. |
| 1.2 | **Plaintext API keys stageable by git** | `ai_models.txt` holds 7 live `nvapi-` keys at the repo root, was untracked but **not** gitignored — a plain `git add .` would have committed them permanently. Added `ai_models.txt`, `*.nvapi*`, `*.tsbuildinfo` to `.gitignore`. |
| 1.3 | **Key leak history audit** | Verified clean: `git log --all -S "nvapi-"` and a tracked-file scan across every revision returned nothing. **No key has ever been committed**, so no rotation needed. |
| 1.4 | **Dead NVIDIA credentials removed (machine-wide)** | `NVIDIA_API_KEY` in `~/.bashrc` and `kimi-for-coding` in opencode `auth.json` both returned 403 on every model — removed, plus the dangling `{env:NVIDIA_API_KEY}` indirection in `~/.config/opencode/opencode.jsonc`. |

> **Security note for 1.2/1.3:** the keys remain live and sit unencrypted in
> `ai_models.txt` and `.env`. Nothing leaked yet. Consider rotating all 7 keys
> at the next convenient time as defence in depth, since they've existed in
> plaintext on disk for some time.

---

## 2. Model roster is inconsistent — highest priority

The in-progress model-roster swap narrowed `NVIDIA_MODEL_CONFIG` from 18 to 10
entries but never reconciled the three places that still list models. The
result: most of the UI advertises models the backend can't serve.

### 2.1 Silent fallback to the wrong credential — `NEEDS DECISION`

`src/app/api/chat/route.ts:599` and `:658`

```ts
const cfg = NVIDIA_MODEL_CONFIG[mid] || NVIDIA_MODEL_CONFIG['poolside/laguna-xs-2.1']
```

Any unrecognised model ID is sent to NVIDIA as-is but authenticated with the
**Poolside key**. The user sees an opaque 404 from NVIDIA with no hint that the
real problem is a missing config entry. This turns every item below from "a
dead dropdown option" into "a confusing 404".

Suggested fix — fail loudly instead:

```ts
const cfg = NVIDIA_MODEL_CONFIG[mid]
if (!cfg) throw new Error(`Unknown model "${mid}" — not in NVIDIA_MODEL_CONFIG`)
```

Keep the `modelId || '<default>'` fallback for the *absent* case only.

### 2.2 Configured models whose API key does not exist — `OPEN`

Three of the 10 configured models name an env var that is absent from `.env`.
Selecting them throws "No API key for model …".

| Model | Missing variable |
|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b` | `NVIDIA_API_KEY_NEMOTRON_ULTRA` |
| `google/gemma-4-31b-it` | `NVIDIA_API_KEY_GEMMA_4` |
| `nvidia/nemotron-3-super-120b-a12b` | `NVIDIA_API_KEY_NEMOTRON_SUPER` |

Either add the keys, or drop these entries and their picker options.

### 2.3 `moonshotai/kimi-k3` advertised with no backing config — `OPEN`

`src/app/api/skills/route.ts:94` lists `moonshotai/kimi-k3` in the model list,
but it has no `NVIDIA_MODEL_CONFIG` entry, so it hits the fallback above on day
one. `NVIDIA_API_KEY_KIMI` was also dropped from `.env` in this same change.
Additionally `moonshotai/kimi-k3` is not in the live NVIDIA catalog at all
(see §3) — the current model is `moonshotai/kimi-k2.6`.

Suggested fix: use `moonshotai/kimi-k2.6` with a real config entry and key, or
remove the option.

### 2.4 Stale options in `SettingsPanel` — `OPEN`

`src/components/SettingsPanel.tsx:38-43` offers 6 models; **5 are not in
`NVIDIA_MODEL_CONFIG`** and will fall through to 2.1:

| Option | In config? |
|---|---|
| `minimaxai/minimax-m3` | yes |
| `nvidia/llama-3.3-nemotron-super-49b-v1` | **no** |
| `nvidia/llama-3.1-nemotron-70b-instruct` | **no** |
| `qwen/qwen3-coder-480b-a35b-instruct` | **no** |
| `deepseek-ai/deepseek-r1` | **no** |
| `meta/llama-3.3-70b-instruct` | **no** |

### 2.5 "Default model" means two different things — `OPEN`

The backend defaults to `poolside/laguna-xs-2.1`; the frontend defaults to
`minimaxai/minimax-m3` in three places:

- `src/app/page.tsx:82`
- `src/components/ChatPanel.tsx:402`
- `src/components/SettingsPanel.tsx:18` (labelled "MiniMax M3 (Default)")

Both paths work today, but the two defaults have already drifted. Pick one and
apply it everywhere.

### 2.6 Structural suggestion — `NEEDS DECISION`

There are now three independent hardcoded model lists: `NVIDIA_MODEL_CONFIG`
(the real source of truth), the array in `skills/route.ts:88-95`, and the
option list in `SettingsPanel`. This is the root cause of 2.3–2.5.

Consider serving the list from one endpoint derived from `NVIDIA_MODEL_CONFIG`
and having the UI consume it, rather than maintaining three copies.

---

## 3. Retired NVIDIA model IDs — `OPEN`

Confirmed against the live catalog via `GET /v1/models`. The keys themselves
are valid (they return 200 on live models) — only the model IDs are dead, so
each fix is a model-string swap, not a key replacement.

| Configured model | Retired | Suggested replacement |
|---|---|---|
| `minimaxai/minimax-m3` | 2026-09-09 | none in catalog — no MiniMax successor |
| `stepfun-ai/step-3.7-flash` | 2026-08-28 | `stepfun-ai/step-5-preview` |
| `deepseek-ai/deepseek-v4-flash-0731` | 2026-09-21 | `deepseek-ai/deepseek-v4.1-flash` |
| `mistralai/mistral-nemotron` | 2026-09-28 | `nvidia/nemotron-3-super-120b-a12b` |
| `moonshotai/kimi-k3` | not in catalog | `moonshotai/kimi-k2.6` |
| `meta/llama-3.3-70b-instruct` | 2026-08-26 | e.g. `nvidia/llama-3.1-nemotron-70b-instruct` |

> `minimaxai/minimax-m3` is also the frontend default (§2.5), so this one needs
> a replacement decision before anything else can be resolved cleanly.

**Unreliable:** `z-ai/glm-5.3-flash` timed out on 6 of 6 attempts across 4
different keys. `z-ai/glm-5.3` returns 200 consistently. Treat the flash
variant as unavailable until NVIDIA confirms otherwise.

---

## 4. Code hygiene — low severity, easy wins

| # | Location | Issue | Status |
|---|---|---|---|
| 4.1 | `src/app/api/skills/route.ts:5` | Meaningless comment: `path.join(/*turboPackIgnore: true*/ …)`. No such directive exists in Next.js or Turbopack — looks like an accidental editor auto-import artifact. Revert to `path.join(process.cwd(), '.agents', 'skills')`. | `OPEN` |
| 4.2 | `skills/route.ts:93`, `TerminalPanel.tsx:113, :294` | Statements dedented to column 0, breaking the surrounding indentation. Purely cosmetic. | `OPEN` |
| 4.3 | `next-env.d.ts` | Reverted a path in a file whose own header says "should not be edited". `next dev`/`next build` regenerate it, so the diff reappears on every build. Drop it from the commit. | `OPEN` |
| 4.4 | `tsconfig.tsbuildinfo` | Incremental build cache is tracked in git — guarantees merge conflicts and review noise. Needs `git rm --cached tsconfig.tsbuildinfo`. The `*.tsbuildinfo` rule added to `.gitignore` is inert until the file is untracked. | `OPEN` |
| 4.5 | `src/components/ChatPanel.tsx:205` | `getModelIcon` has no mapping for `poolside/*`, `z-ai/glm-5.3*`, `google/gemma-4-31b-it`, `nvidia/nemotron-3-super` — all render the generic fallback icon. | `OPEN` |

---

## 5. Tooling & gates

| # | Finding | Status |
|---|---|---|
| 5.1 | `npm run lint` reports **291 problems (196 errors, 95 warnings)**. Confirmed pre-existing and unrelated to recent work — 138 errors sit in files untouched by the current diff, and none land on a changed line. Any CI gate enforcing lint will fail until this is addressed. | `OPEN` |
| 5.2 | No test infrastructure: no `test` script, no runner in `package.json`. | `OPEN` |
| 5.3 | `npx tsc --noEmit` passes clean. | `RESOLVED` (passing) |
| 5.4 | `npm run build` passes — 19 static pages. | `RESOLVED` (passing) |

Cheapest high-value test to add: a table test asserting every model ID offered
by any picker resolves to an entry in `NVIDIA_MODEL_CONFIG`. That single test
would have caught §2.1, §2.3, §2.4 and §3 — the model-resolution logic in
`chat/route.ts` is pure and trivially testable.

---

## 6. Worth a second look

| # | Observation | Status |
|---|---|---|
| 6.1 | `src/app/api/public/debug-env/route.ts` and `debug-groq/route.ts` are debug endpoints under `/api/public/`. Worth confirming they can't leak env values or key material in a deployed build. | `NEEDS DECISION` |
| 6.2 | `.agents/skills/` contains `design-it` and `stability-ai` skills in-repo. They're project-scoped and auto-load only when working in this repo — confirm they're still relevant. | `NEEDS DECISION` |

---

## Verification commands

Useful for re-checking any of the above:

```bash
cd ~/ai-ide
npm run lint                                    # §5.1
npx tsc --noEmit                                # §5.3
git check-ignore -v ai_models.txt               # §1.2 — should match .gitignore
git log --all -S "nvapi-"                       # §1.3 — should return nothing
curl -sH "Authorization: Bearer $NVIDIA_API_KEY_POOLSIDE" \
  https://integrate.api.nvidia.com/v1/models | jq -r '.data[].id'   # §3
```

The `nvidia-key-audit` skill installed globally at
`~/.config/opencode/skills/nvidia-key-audit/SKILL.md` covers the credential
testing procedure, including how to decode 403 vs 404 vs 410 vs 503 responses.
Ask for it by name when working on §3 or on any key problem.