# Structured cooking production

The planner calls Gemini 3.8 Flash once, with the full original recipe and a JSON schema. The request is bounded to 40,000 UTF-8 input bytes and 16,384 output tokens. No automatic paid retry is made. The proposed plan must be explicitly applied. Validation checks step coverage/order, source ingredient indices, cookware IDs, durations and field bounds; it does not prove semantic cooking correctness. The original recipe is retained alongside editable shot states for human review.

Planned shots do not automatically reuse article photos with potentially different cookware. Photos remain available for manual selection and finished-food reference. Nano Banana 2.1 through Runway is the default image model (1K); Gen-4 Image remains available. Every generated image gets a fixed first-shot kitchen reference, an immediate previous-frame reference when available, and the relevant shot states/ingredients. Image tasks and cached media are retained on device. The optional ending frame is generated from the same continuity guide and starting image.

Runway Gen-4.5 remains the default video model. MiniMax H3 Max Turbo and Kling 2.5 Turbo Pro are alternatives through fal. Both fal integrations accept optional ending frames, whereas this Gen-4.5 integration rejects them before submitting a request. MiniMax prompt expansion and fal automatic retries are disabled. Task IDs and original model selection are saved so resuming cannot reroute an existing request to a new model. Rejected successful clips can be replaced independently; previous clips remain available for restoration. Uploaded real footage is cached locally and joins the same export sequence, with original audio muted.

Each project keeps a conservative USD reservation ledger. Reserve and persist before submitting a new request; stop if the configured limit would be exceeded. Duplicate reservation IDs are ignored. Uncertain or rejected submissions remain reserved because the app cannot reconcile provider invoices. The limit covers estimates recorded by this project, not historical charges, taxes, or activity outside the app. Start a new project for a separate ledger; a new video version retains its original ledger.

Keys stay in tab memory and are forwarded only to the corresponding provider. They are excluded from project persistence. No server-owned secret or new account is needed. API contract tests mock providers; they cannot establish visual quality. Compare a single corrected shot on MiniMax and Kling before buying a full film. Review physical interactions manually; accurate planning reduces ambiguity but does not guarantee realistic fluid or hand physics.

## Verified API references and rates (2026-11-02)

- [Runway Nano Banana 2.1](https://dev.runwayml.com/learn/nano-banana-2-1-api): `nano_banana_2.1`, 1K 4 credits / $0.04; ordered URI references and medium thinking. Exact portrait/landscape sizes 768:1376 / 1376:768.
- [Gemini structured output](https://ai.google.dev/api/generate-content): `gemini-3.8-flash` via `/v1beta/interactions` (revision `2026-05-20`, `store: false`), JSON `response_format` schema; completed `model_output` steps are parsed. $0.10 conservative reservation through 2026; $0.20 from 2027-01-01 per bounded planning request; actual token usage is provider billed.
- [MiniMax schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=minimax/h3-max-turbo/image-to-video): `image_url`, `end_image_url`, `768P`, `prompt_expansion_mode: disabled`. [Published rate](https://fal.ai/learn/tools/fastest-ai-video-generation-models) $0.04 / second.
- [Kling schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/kling-video/v2.5-turbo/pro/image-to-video): `image_url`, `tail_image_url`, duration string `5` / `10`. [Published rate](https://fal.ai/explore/text-to-video-apis) $0.07 / second.
- [Runway pricing](https://docs.dev.runwayml.com/guides/pricing/): Gen-4.5 estimated at 12 credits / second ($0.12).

`tests/fixtures/cookie-shot-plan.json` is a curated contract fixture, not live model output. Paid generations are not used by the automated test suite.

## Cost-aware shot timing

New projects default to 3 seconds per unplanned scene. AI plans assign individual 2–5 second durations: short setup/details, longer physical actions. The planner defaults to a 30-second total duration budget (raised to at least 2 seconds per source step for long recipes); the shot count is a ceiling rather than a target. Both duration and shot-count limits are validated before a proposed plan can be applied. Complex recipes may need a larger budget; failures leave the original storyboard unchanged and never automatically retry.

Starting-image generation is unchanged. The selected shot duration is sent to video generation, used for spending reservations and the confirmation estimate, and saved alongside the returned task ID. Retries are estimated only for the selected fresh/failed shots. Existing completed or pending jobs are kept. Scene badges, storyboard playback, timeline totals and music duration use the individual shot lengths. Export continues to play actual complete clips, including uploaded footage.

Runway and MiniMax accept short durations in this integration (2–10 seconds); Kling still requires 5 or 10. Kling durations are rounded up before both estimation and submission, with a visible notice. No short-clip savings are claimed for that option. Reference: [Runway durations](https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5), [MiniMax input schema](https://fal.ai/models/minimax/h3-max-turbo/image-to-video/api), [Kling input schema](https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/api).

## Planner availability

If the standard planner returns a 503 capacity rejection, the user can choose **Try alternative planner**. This explicitly sends one request to Gemini 3.1 Flash-Lite through the same Interactions endpoint and existing Google API key, with the same structured schema, input/output limits, recipe validation and total-duration budget. It is not a deterministic sentence splitter and does not bypass review. No automatic fallback or paid retry occurs. The alternative reserves $0.04 (40,000 input tokens at $0.25/M plus 16,384 output tokens at $1.50/M). Standard planning retains its existing reservation. Availability still depends on the Google account's model access, quota and service capacity; the alternative is not a guarantee of availability or equivalent planning quality. Explicit HTTP rejection logs include only the planner choice and HTTP status, not recipe text or keys. Obsolete temperature configuration has been removed.

Sources: [supported Interactions models](https://aistudio.google.com/docs/interactions-overview#supported-models-agents), [Flash-Lite capabilities](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite), [pricing](https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite).
