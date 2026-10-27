# Simmer — Recipe to Video

A responsive recipe video studio built with React, Vinext, and Cloudflare Workers.

## Run locally

Requires Node 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the printed local URL. The Sites starter provides the production build and deployment integration.

## Features

- Import public HTTPS recipe pages with Schema.org Recipe JSON-LD, including @graph and HowToSection.
- Use the Send to Simmer browser bookmark, or upload saved HTML / JSON, when a publisher blocks automatic URL requests.
- Paste Recipe JSON or create a schema-compliant recipe with the guided writing form.
- Edit instructions and optional step photo URLs. Recipe photos guide the final scene; step photos guide their corresponding scenes.
- Generate one Runway Gen-4.5 clip per recipe step, with real status polling and resume support.
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
- Projects are device-local, not synchronized. Re-enter the key after refreshing to resume a render.
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
