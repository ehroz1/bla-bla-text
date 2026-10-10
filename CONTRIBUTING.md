# Contributing to BLA-БЛА

Thanks for helping! The most valuable contributions are:

- **Provider updates.** Free tiers, models and endpoints change often. A PR with a source link is very welcome.
- **Bug reports with a repro**: browser, file type and size, provider, and the error text shown in the app.
- **New providers**, especially ones with good Russian, English or Kazakh support and a free tier.
- **Translations.** The UI ships in English and Russian. A Kazakh interface would be a great addition; open an issue first.

## Development setup

Requires Node.js 22 (what CI uses) and npm.

```bash
npm ci
npm run dev        # http://localhost:5173
```

Before opening a PR, run the same checks as CI:

```bash
npm run lint
npm run build      # includes the TypeScript check
```

If you touched providers, audio processing or the transcription flow, also run the end-to-end test. It needs `ffmpeg` and a Playwright Chromium:

```bash
npx playwright install chromium   # once
npm run test:fixtures
npm run build
npm run test:e2e                  # or a subset: node tests/e2e.mjs tests/fixtures groq
```

If you changed the UI, refresh the README screenshots with `node scripts/screenshots.mjs` (after `build` and `test:fixtures`).

## Adding a speech-to-text provider

Each provider is one file in `src/providers/` implementing the `Provider` interface from `src/providers/types.ts`.

1. **Copy the closest existing provider:**
   - `groq.ts` or `openai.ts` for OpenAI-compatible `/audio/transcriptions` APIs (they reuse `openai-compatible.ts`).
   - `elevenlabs.ts` or `deepgram.ts` for a single synchronous request.
   - `assemblyai.ts`, `gladia.ts`, `speechmatics.ts` or `soniox.ts` for upload → create job → poll.
2. **Fill in the metadata honestly:** `free`, `limits`, `pricing`, `card`, `keySteps`, `keyUrl`, `maxBytes` and `maxChunkSeconds`. Set `cors` to `'yes'` only if you actually verified that a browser `fetch` works; use `'unknown'` otherwise.
3. **Implement `transcribe()`** with the helpers in `http.ts` (`requestJson`, `poll`) and `segments.ts` (`wordsToSegments`, `segmentsToText`, `speakerName`). Return `text`, plus `segments` (in seconds) when the API provides timestamps.
4. **Optionally implement `checkLimits()`** if the API exposes balance or usage for the same key.
5. **Register it** in `src/providers/index.ts`. The order there is the order in the UI.
6. **Add a mock** in `tests/mocks.mjs`, based on the provider's documented response format, and run `node tests/e2e.mjs tests/fixtures <id>`.
7. **Add the API host** to `ALLOWED_HOSTS` in `proxy/cloudflare-worker.js` so the optional CORS proxy can reach it.
8. **Update** the provider tables in `README.md` and `README.ru.md`, and `docs/stt-apis.md` if you have sources.

All user-facing text is bilingual. Write it as `t('Русский текст', 'English text')` from `src/lib/i18n.ts` and render it with `tx(...)`. Plain strings are fine for names and examples that read the same in both languages.

## Pull requests

- Keep PRs focused: one provider or one fix per PR.
- Describe how you tested, e.g. "ran e2e" or "transcribed a real file with my own key".
- Never commit API keys, real recordings of other people, or generated `dist/` folders.
