# Shot planning provider selection — November 3, 2026

The default new planner is **Claude Sonnet 5.5**, called directly through Anthropic's Messages API. It uses high effort, adaptive thinking, strict JSON-schema output and the existing whole-recipe prompt. The user explicitly prioritized planning quality alongside cost after Google's generation API consistently rejected even tiny requests from both Railway and a local computer.

**Claude Haiku 5.5** is available as Economy using the same Anthropic API key. This is a deliberate quality/cost choice, not an automatic fallback. A provider rejection never silently changes models, providers or spending reservations. Google remains available only to existing API clients and the optional previous-connection diagnostics; the new UI does not call it for planning.

## Price comparison

Published standard rates in USD per million tokens, without caching or batch discounts:

| Planner | Input | Output, including thinking | Example: 5,000 input + 6,000 output tokens |
| --- | ---: | ---: | ---: |
| Sonnet 5.5 / Quality first | $2.00 | $10.00 | $0.0700 |
| Haiku 5.5 / Economy, under 100K input tokens | $0.10 | $0.50 | $0.0035 |
| Previous Gemini 3.8 Flash, through December 31, 2026 | $0.75 | $3.75 | $0.02625 |

These examples are arithmetic, not measured recipe costs. Google free-tier eligible requests may have no monetary charge. The new provider's API billing is separate from a chat subscription. Quality-first planning costs more per token than the previous model; the absolute difference in the example is about four cents. Haiku is substantially cheaper, but equivalent recipe-planning quality has not been established.

The app retains a 40,000-byte input limit and a 16,384 output-token cap including thinking. Conservative per-request reservations are $0.25 for Quality first and $0.02 for Economy. They are estimates, not provider-side dollar caps or flat charges; actual usage and provider invoices determine cost. Input, schema and output fit below Haiku's 100K input pricing threshold.

## Quality and verification

Structured output guarantees format, not cooking correctness. The server still checks step coverage/order, ingredient references/allocations, stable cookware IDs, field bounds, per-shot 2–5 second durations and the total-duration budget. Starting/ending food states, original instructions and the shared kitchen guide remain reviewable before applying a proposed plan.

Published vendor evaluations support Sonnet as a strong reasoning/workhorse choice and show a quality gap between Sonnet and Haiku. They do not demonstrate parity with Gemini on this app's cooking domain. No live Anthropic recipe comparison has been run without the user's API connection. Verification covers provider request shape, key isolation, refusal/truncation handling, validation, costs and preservation of the current storyboard on failure. Actual plans and downstream video realism still need human review.

Nano Banana image generation, its Runway API connection, existing storyboard images, video generation and exports are unchanged. The Anthropic key stays in tab memory, is not saved with projects, and is sent only to the corresponding provider through the server. No additional SDK is installed.

## Primary sources

- Sonnet specifications, pricing and effort: https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- Haiku specifications, pricing and effort: https://platform.claude.com/docs/en/models/haiku-5-5/overview
- Vendor evaluations comparing Sonnet and Haiku: https://www.anthropic.com/claude-haiku-5-5
- Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Messages API and version: https://platform.claude.com/docs/en/api/messages/create
- Previous Gemini rates: https://aistudio.google.com/docs/pricing#gemini-3.8-flash
- DeepSeek alternative reviewed: https://api-docs.deepseek.com/quick_start/pricing/

DeepSeek V4.1 Flash was also considered: its published peak rates are $0.30 input / $1.20 output per million tokens. It supports JSON output, but the documented strict-schema support and quality-oriented Sonnet integration make Anthropic the more suitable initial choice for this workflow. This is an engineering selection, not a claim of universal model superiority.
