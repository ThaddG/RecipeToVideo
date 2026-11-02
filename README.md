# Simmer — Recipe to Video

A responsive recipe video studio built with React, Vinext, and Cloudflare Workers.

## Run locally

Requires Node 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the printed local URL. The Sites starter provides the production build and deployment integration.

## Railway deployment

Connect this repository to a Railway service. The root-level `railway.json` selects
the Next.js production build (`npm run build:railway`) and server
(`npm run start:railway`). Node 24 is selected by `.node-version`. The server binds
to all interfaces and uses Railway's `PORT`; `/api/health` is the health check.
Generate a Railway domain after deployment. No database, volume, or shared Runway
key is required: visitors enter their own funded Runway key in Settings.

Projects and cached images belong to the browser origin. Existing projects on the
Sites URL do not automatically appear on the Railway URL.

## Features

- Start with an empty recipe studio. Browse Examples to explicitly load the pesto pasta walkthrough; examples are labeled and never preloaded for new users.

- Import public HTTPS recipe pages with Schema.org Recipe JSON-LD, including @graph and HowToSection.
- Use the Send to Simmer browser bookmark, or upload saved HTML / JSON, when a publisher blocks automatic URL requests.
- Paste Recipe JSON or create a schema-compliant recipe with the guided writing form.
- Edit instructions and optional step photo URLs. Recipe photos guide the final scene; step photos guide their corresponding scenes.
- Fill missing storyboard frames using Runway Gen-4 Image (1080p), with recipe and previous-frame references for continuity. Review, edit prompts, regenerate individual frames, and approve the storyboard before generating video.
- Generated images are cached as JPEGs in IndexedDB on the current device. Image task IDs and review state are saved with projects; a paused task is polled again instead of recreated.
- Split long instructions into smaller shots before image generation. Image directions and video motion directions are separate.
- Generate one image-guided Runway Gen-4.5 clip per approved scene, with real status polling and resume support. Existing renders can be saved as a separate project version before revising their storyboard.
- Portrait or landscape, cinematic / overhead / rustic prompts, 5 or 10 seconds per scene.
- Optional original synthesized music: three moods, 12-second preview, volume control, looping, and opening/closing fades. Music choices are saved with each project and mixed during export. See MUSIC-LICENSE.md.
- Download any completed scene directly as MP4, even before all scenes finish.
- Preview generated clips; assemble a single 720p video in the browser with optional paginated instruction captions. WebM or MP4 depends on browser recording support.
- Save projects and in-progress task IDs locally. No key is stored in localStorage.

## AI setup

Open Settings and enter a funded Runway API key. It stays in browser memory and is passed to the same-origin backend on each request. The backend sends credentials only to `api.dev.runwayml.com`. No paid generation occurs until the user confirms the render summary. No shared server secret is needed.

Provider docs: https://docs.dev.runwayml.com/guides/using-the-api/

## Limitations

- Recipe websites must expose Recipe JSON-LD in their HTML. Allrecipes and Serious Eats can block server requests; use the Send to Simmer bookmark from the normally opened recipe page, or import a saved HTML / Recipe JSON file. Simmer reports publisher blocking separately from schema validation failures.
- Browser imports use a URL fragment (not a server request body or query string); the app removes it after validation. Saved files are parsed locally.
- Long ingredient lists use only context that fits the provider prompt limit. The full instruction remains in the prompt and captions.
- Projects and generated storyboard images are device-local, not synchronized. Re-enter the key after refreshing to resume a render.
- Keep the tab visible while exporting. Export runs in real time via canvas and MediaRecorder. Optional music uses Web Audio; original scene audio is muted. Individual scene MP4 downloads contain the original generated clip and do not include the selected background track.
- Download provider outputs promptly because their URLs may expire.
- AI output is illustrative and may not precisely reproduce a cooking action. Review it against the written instructions.
- Paid provider integration requires a real key for an end-to-end generation test. The repository test suite mocks the provider boundary.

## Checks

```sh
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
```

## Storyboard generation

The image step uses `/api/storyboard` with the existing in-memory Runway key. Each new 1080p Gen-4 Image is currently 8 Runway credits; the confirmation dialog shows the maximum new-image charge, and resumed tasks are reused. Existing article or supplied photos are retained unless that scene is explicitly regenerated. Generated images are starting-frame references, not claims that the photographed cooking action actually occurred. Review the cooking stage, utensils, and ingredient state before approval.

Changing scene text, image directions, framing, style, or reference photos invalidates matching generated frames and/or storyboard approval. Video requests from the current UI require an image and use a short motion prompt; captions retain the full scene instruction.

Provider-boundary tests simulate generation. Live image quality still needs review using a funded Runway key.
