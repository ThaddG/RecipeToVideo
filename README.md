# Simmer — Recipe to Video

A responsive recipe video studio built with Next.js and React. Import a recipe, let
Claude plan the shots, generate storyboard stills, turn each still into a short
clip, and export one finished video in the browser.

## Run locally

Requires Node 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the printed local URL (http://localhost:3000 by default).

## Railway deployment

Connect this repository to a Railway service. The root-level `railway.json` selects
the Next.js production build (`npm run build:railway`) and server
(`npm run start:railway`). Node 24 is selected by `.node-version`. The server binds
to all interfaces and uses Railway's `PORT`; `/api/health` is the health check.
Generate a Railway domain after deployment. No database, volume, or shared provider
key is required: visitors enter their own keys in Settings.

Projects and cached media belong to the browser origin, so projects saved on one
domain do not appear on another.

## Models

| Step | Default | Alternatives |
| --- | --- | --- |
| Shot planning | Claude Sonnet 5.5 (Quality first) | Claude Haiku 5.5 (Economy); legacy Gemini planner |
| Storyboard stills | Nano Banana 2.1, 1K, via Runway (4 credits / $0.04 per image) | Runway Gen-4 Image (8 credits / $0.08) |
| Image-to-video | Grok Imagine 1.5 Lite, 720p, via Runway (~$0.03 / second + $0.01 / shot) | Runway Gen-4.5 (~$0.12 / s), MiniMax H3 Max Turbo 768p via fal (~$0.04 / s), Kling 2.5 Turbo Pro via fal (~$0.07 / s) |

Model names are hidden in the UI by default (`SHOW_MODEL_NAMES` in
`lib/model-presentation.ts`). Prices are the conservative estimates the app reserves
against each project's spending limit; providers bill actual usage. See
[docs/production-pipeline.md](docs/production-pipeline.md) and
[docs/planning-model-selection.md](docs/planning-model-selection.md) for details and sources.

## Features

- Start with an empty recipe studio. Browse Examples to explicitly load the pesto pasta walkthrough, then use Stop using example to return to importing your own recipe. Example drafts are available in My projects rather than automatically reopening.
- Explore Our process for an interactive six-stage walkthrough. A live studio tracker explains the current action and shows the active scene during image or video generation.

- Import public HTTPS recipe pages with Schema.org Recipe JSON-LD, including @graph and HowToSection.
- Use the Send to Simmer browser bookmark, or upload saved HTML / JSON, when a publisher blocks automatic URL requests.
- Paste Recipe JSON or create a schema-compliant recipe with the guided writing form.
- Edit instructions and optional step photo URLs. Recipe photos guide the final scene; step photos guide their corresponding scenes.
- Fill missing storyboard frames with the selected image model (Nano Banana 2.1 by default), using a fixed kitchen reference and the previous frame for continuity. Review, edit prompts, regenerate individual frames, and approve the storyboard before generating video.
- Generated images are cached as JPEGs in IndexedDB on the current device. Image task IDs and review state are saved with projects; a paused task is polled again instead of recreated.
- Split long instructions into smaller shots before image generation. Image directions and video motion directions are separate.
- Generate one image-guided clip per approved scene with the selected video model (Grok Imagine 1.5 Lite by default), with real status polling and resume support. The original model is saved with each task so resuming never reroutes a request. Existing renders can be saved as a separate project version before revising their storyboard.
- Portrait or landscape, cinematic / overhead / rustic prompts. AI plans assign 2–5 second shots within a total duration budget; Grok accepts 1–15 seconds, Gen-4.5 and MiniMax 2–10, and Kling 5 or 10.
- Optional original synthesized music: three moods, 12-second preview, volume control, looping, and opening/closing fades. Music choices are saved with each project and mixed during export. See MUSIC-LICENSE.md.
- Preview actual completed clips separately from the still-image storyboard. Play the ready clips as a sequence, or download any completed scene as MP4 before the rest finish.
- Check progress without creating paid tasks. Resume shows completed, processing, failed, and unstarted scenes separately, with estimated new credit usage. Temporary status failures retry the same task ID.
- Completed clips are cached in IndexedDB when storage permits and reused for preview and export. Task IDs are saved immediately. An interrupted submission without a returned ID is blocked from automatic paid retry; link its task from Runway history, or explicitly confirm that no task exists.
- Preview generated clips; assemble a single 720p video in the browser with optional paginated instruction captions. WebM or MP4 depends on browser recording support.
- Each project keeps a USD spending limit and reserves an estimate before every paid request.
- Save projects and in-progress task IDs locally. No key is stored in localStorage.

## AI setup

Open Settings and enter the keys for the providers you plan to use:

- **Anthropic** for shot planning.
- **Runway** for storyboard stills and the default (Grok Imagine) or Gen-4.5 video.
- **fal** only if you choose MiniMax or Kling for video.
- **Google (Gemini)** only for the legacy planner and its diagnostics.

Keys stay in browser tab memory and are passed to the same-origin backend on each
request, which forwards each key only to its own provider (`api.anthropic.com`,
`api.dev.runwayml.com`, `queue.fal.run`, `generativelanguage.googleapis.com`). No paid
generation occurs until the user confirms the render summary. No shared server
secret is needed.

Provider docs: [Runway](https://docs.dev.runwayml.com/guides/using-the-api/), [fal](https://fal.ai/docs), [Anthropic](https://docs.anthropic.com/).

## Limitations

- Recipe websites must expose Recipe JSON-LD in their HTML. Allrecipes and Serious Eats can block server requests; use the Send to Simmer bookmark from the normally opened recipe page, or import a saved HTML / Recipe JSON file. Simmer reports publisher blocking separately from schema validation failures.
- Browser imports use a URL fragment (not a server request body or query string); the app removes it after validation. Saved files are parsed locally.
- Long ingredient lists use only context that fits the provider prompt limit. The full instruction remains in the prompt and captions.
- Projects and generated storyboard images are device-local, not synchronized. Re-enter the key after refreshing to resume a render.
- Keep the tab visible while exporting. Export runs in real time via canvas and MediaRecorder. Optional music uses Web Audio; original scene audio is muted. Individual scene MP4 downloads contain the original generated clip and do not include the selected background track.
- Provider output links expire. Completed clips are cached locally when available; download important media because browser storage may be cleared or unavailable.
- AI output is illustrative and may not precisely reproduce a cooking action. Review it against the written instructions.
- Paid provider integration requires real keys for an end-to-end generation test. The repository test suite mocks the provider boundary.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

## Storyboard generation

The image step uses `/api/storyboard` with the in-memory Runway key. Each new Nano Banana 2.1 image is 4 Runway credits (Gen-4 Image is 8); the confirmation dialog shows the maximum new-image charge, and resumed tasks are reused. Existing article or supplied photos are retained unless that scene is explicitly regenerated. Generated images are starting-frame references, not claims that the photographed cooking action actually occurred. Review the cooking stage, utensils, and ingredient state before approval.

Changing scene text, image directions, framing, style, or reference photos invalidates matching generated frames and/or storyboard approval. Video requests from the current UI require an image and use a short motion prompt; captions retain the full scene instruction.

Provider-boundary tests simulate generation. Live image quality still needs review using a funded Runway key.
