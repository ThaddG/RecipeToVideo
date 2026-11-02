# Structured cooking production

The planner calls Gemini 2.5 Flash once, with the full original recipe and a JSON schema. The request is bounded to 40,000 UTF-8 input bytes and 16,384 output tokens. No automatic paid retry is made. The proposed plan must be explicitly applied. Validation checks step coverage/order, source ingredient indices, cookware IDs, durations and field bounds; it does not prove semantic cooking correctness. The original recipe is retained alongside editable shot states for human review.

Planned shots do not automatically reuse article photos with potentially different cookware. Photos remain available for manual selection and finished-food reference. Nano Banana 2.1 through Runway is the default image model (1K); Gen-4 Image remains available. Every generated image gets a fixed first-shot kitchen reference, an immediate previous-frame reference when available, and the relevant shot states/ingredients. Image tasks and cached media are retained on device. The optional ending frame is generated from the same continuity guide and starting image.

Runway Gen-4.5 remains the default video model. MiniMax H3 Max Turbo and Kling 2.5 Turbo Pro are alternatives through fal. Both fal integrations accept optional ending frames, whereas this Gen-4.5 integration rejects them before submitting a request. MiniMax prompt expansion and fal automatic retries are disabled. Task IDs and original model selection are saved so resuming cannot reroute an existing request to a new model. Rejected successful clips can be replaced independently; previous clips remain available for restoration. Uploaded real footage is cached locally and joins the same export sequence, with original audio muted.

Each project keeps a conservative USD reservation ledger. Reserve and persist before submitting a new request; stop if the configured limit would be exceeded. Duplicate reservation IDs are ignored. Uncertain or rejected submissions remain reserved because the app cannot reconcile provider invoices. The limit covers estimates recorded by this project, not historical charges, taxes, or activity outside the app. Start a new project for a separate ledger; a new video version retains its original ledger.

Keys stay in tab memory and are forwarded only to the corresponding provider. They are excluded from project persistence. No server-owned secret or new account is needed. API contract tests mock providers; they cannot establish visual quality. Compare a single corrected shot on MiniMax and Kling before buying a full film. Review physical interactions manually; accurate planning reduces ambiguity but does not guarantee realistic fluid or hand physics.

## Verified API references and rates (2026-11-02)

- [Runway Nano Banana 2.1](https://dev.runwayml.com/learn/nano-banana-2-1-api): `nano_banana_2.1`, 1K 4 credits / $0.04; ordered URI references and medium thinking. Exact portrait/landscape sizes 768:1376 / 1376:768.
- [Gemini structured output](https://ai.google.dev/api/generate-content): `gemini-2.5-flash:generateContent`, JSON response schema. $0.06 conservative reservation per bounded planning request; actual token usage is provider billed.
- [MiniMax schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=minimax/h3-max-turbo/image-to-video): `image_url`, `end_image_url`, `768P`, `prompt_expansion_mode: disabled`. [Published rate](https://fal.ai/learn/tools/fastest-ai-video-generation-models) $0.04 / second.
- [Kling schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/kling-video/v2.5-turbo/pro/image-to-video): `image_url`, `tail_image_url`, duration string `5` / `10`. [Published rate](https://fal.ai/explore/text-to-video-apis) $0.07 / second.
- [Runway pricing](https://docs.dev.runwayml.com/guides/pricing/): Gen-4.5 estimated at 12 credits / second ($0.12).

`tests/fixtures/cookie-shot-plan.json` is a curated contract fixture, not live model output. Paid generations are not used by the automated test suite.
