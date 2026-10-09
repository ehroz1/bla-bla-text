# API распознавания речи: RU + EN вперемешку и казахский

Проверено 2026-10-09. Источники: официальные спецификации OpenAPI, репозитории документации и исходники SDK на GitHub (`openai/openai-openapi`, `deepgram/deepgram-api-specs`, `gladiaio/docs`, `speechmatics/docs`, `mistralai/platform-docs-public`, `MicrosoftDocs/azure-ai-docs`, `yandex-cloud/cloudapi`, `groq/groq-typescript`, `AssemblyAI/assemblyai-node-sdk`, `elevenlabs/elevenlabs-js`, `soniox/soniox-js`, `googleapis/js-genai`, `huggingface/hub-docs`) и страницы тарифов.

Пометки: **[V]** — подтверждено официальной спецификацией или SDK, **[S]** — по официальным страницам через поиск, **[?]** — не удалось проверить или источники расходятся.

> ⚠️ Настоящий CORS-preflight из браузера ни к одному API отправить не удалось. Выводы про работу из браузера сделаны по SDK и документации. Если сервис выдаёт сетевую ошибку, включите CORS-прокси.

## Сводная таблица

| Сервис | Бесплатно | Карта | ru | kk | Смешанная RU+EN | Из браузера | Цена за час после лимита |
|---|---|---|---|---|---|---|---|
| Groq Whisper | ~8 ч аудио/день [S] | нет | да | слабо | авто, «так себе» | да (`dangerouslyAllowBrowser`) [V] | $0,04 turbo / $0,111 large-v3 |
| Google Gemini | дневные лимиты AI Studio [S] | нет | да | да [?] | отлично (LLM) | да (браузерный SDK) [V] | ~$0,1–0,2 в токенах [?] |
| ElevenLabs Scribe v2 | 10k кредитов/мес [S] | нет | да | да, WER ≈3% по данным вендора [S] | авто | да (есть токены «для фронтенда») [V] | $0,22 |
| Speechmatics Melia-1 | $100 разово [V] | нет [V] | да | **нет** [V] | **явно**: `melia-1` + `language:"multi"` [V] | да (временные ключи «в браузере») [V] | $0,13 Melia / $0,24 Std / $0,40 Enh |
| AssemblyAI | $50 разово [S] | нет | да (Universal-2) | ? | `code_switching` [V] | вероятно (SDK есть под браузер) [?] | $0,15 |
| Gladia Solaria-1 | €50 разово [V] | — | да [V] | **да** [V] | **явно**: `code_switching` [V] | вероятно [?] | $0,61 |
| Mistral Voxtral | режим Free без карты [V] | нет | да [V] | нет | авто | ? | $0,18 [V] |
| Deepgram Nova-3 | $200 разово [S] | нет | да | нет | **явно**: `language=multi` [S] | **нет для REST** [V] | ~$0,26–0,31 |
| Soniox | кредиты для новых аккаунтов отменены (окт. 2025) [S] | да | да | **да, лучший по бенчмаркам вендора** | авто, язык у каждого токена [V] | REST ? | $0,10 |
| Yandex SpeechKit | грант Yandex Cloud [?] | платёжный аккаунт | да | **kk-KZ** [S] | `auto` + whitelist | **нет** (официально) [S] | ? |
| OpenAI | нет, только предоплата | да | да | слабо | авто; `languages[]` у gpt-transcribe [V] | да [V] | $0,18 mini / $0,36 |

Нереалистичные варианты:
- **Sber SaluteSpeech**: Freemium для физлиц прекращён 15.07.2026 [S]; плюс нужен OAuth и сертификаты Минцифры.
- **Hugging Face Inference**: у бесплатных пользователей больше нет месячных кредитов [V].
- **Azure fast transcription**: на F0 недоступна, нужны S0 и карта [V].
- **ISSAI / Soyle**: публичного API нет.

## Рекомендации

**RU + EN вперемешку (топ-7):**
1. **ElevenLabs Scribe v2**: топовая точность, слова с таймкодами, спикеры, бесплатный месячный лимит. Из РФ недоступен.
2. **Google Gemini (Flash)**: бесплатно и без карты, как LLM естественно держит смешанную речь. Таймкоды приблизительные.
3. **Speechmatics Melia-1**: отдельная модель для переключения языков, $100 без карты.
4. **Groq Whisper large-v3**: ~8 бесплатных часов в день, очень быстрый. Смешанную речь улучшает двуязычная подсказка.
5. **AssemblyAI**: Universal-2 с `code_switching`, $50.
6. **Gladia Solaria-1**: `languages:["ru","en"]` + `code_switching`, €50.
7. **Mistral Voxtral**: бесплатный режим, спикеры, `context_bias`.

**Казахский:**
1. **ElevenLabs Scribe v2**: бесплатный лимит, работает из браузера, сильный kk.
2. **Google Gemini**: бесплатно, kk+ru вперемешку. Точность на казахском не подтверждена.
3. **Gladia Solaria-1**: kk поддерживается, €50.
4. Лучшее качество, но платно или через прокси: **Soniox** ($0,10/ч) и **Yandex SpeechKit** (kk-KZ).

## Эндпоинты (как реализовано в `src/providers/`)

### Groq / OpenAI / Mistral — формат OpenAI
`POST {base}/audio/transcriptions`, multipart: `file`, `model`, `language`, `prompt`, `response_format`, `timestamp_granularities[]`.
- **Groq**: `https://api.groq.com/openai/v1`, `Authorization: Bearer`. Модели `whisper-large-v3` и `whisper-large-v3-turbo`. Файл до 25 МБ на бесплатном тарифе. Остаток лимитов приходит в заголовках `x-ratelimit-*`.
- **OpenAI**: `gpt-4o(-mini)-transcribe` отдают только `json` без таймкодов. `whisper-1` поддерживает `verbose_json`. `gpt-4o-transcribe-diarize` работает с `diarized_json` и `chunking_strategy=auto`.
- **Mistral**: `https://api.mistral.ai/v1`, модель `voxtral-mini-latest`. Доступны `diarize=true` и `context_bias`. `timestamp_granularities` нельзя использовать вместе с `language`.

### Google Gemini
`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, заголовок `x-goog-api-key`. В теле запроса передаются `inlineData` (base64, весь запрос до ~20 МБ) и промпт; `responseSchema` задаёт сегменты `{start, end, speaker, text}`. Своих таймкодов у Gemini нет: их просим в ответе, поэтому они приблизительные. BLA-БЛА отправляет запись кусками по 10 минут. Список моделей: `GET /v1beta/models`.

### ElevenLabs
`POST https://api.elevenlabs.io/v1/speech-to-text`, заголовок `xi-api-key`, multipart: `file`, `model_id=scribe_v2`, `language_code`, `diarize`, `num_speakers`, `timestamps_granularity=word`, `tag_audio_events`, `keyterms` (поле повторяется). Ответ: `{text, language_code, words[{text,start,end,type,speaker_id}]}`. Баланс: `GET /v1/user/subscription` (`character_count` / `character_limit`).

### Speechmatics
`POST https://eu1.asr.api.speechmatics.com/v2/jobs/` с `Authorization: Bearer`, multipart: `data_file` и `config` (JSON с `transcription_config: {model:"melia-1", language:"multi", language_hints:["ru","en"], diarization:"speaker"}`). Дальше опрос `GET /v2/jobs/{id}` до `done`, результат: `GET /v2/jobs/{id}/transcript?format=json-v2`. Расход: `GET /v2/usage`.

### AssemblyAI
Заголовок `Authorization: <key>`, без `Bearer`.
1. `POST /v2/upload` с бинарным телом, в ответ `upload_url`.
2. `POST /v2/transcript` с `{audio_url, speech_models, language_detection, language_detection_options:{expected_languages:["ru","en"], code_switching:true}, speaker_labels}`.
3. Опрос `GET /v2/transcript/{id}`.

Universal-3.5 Pro русский не поддерживает, поэтому по умолчанию используется Universal-2.

### Gladia
Заголовок `x-gladia-key`.
1. `POST /v2/upload` (multipart, поле `audio`).
2. `POST /v2/pre-recorded` с `{audio_url, language_config:{languages, code_switching}, diarization, custom_vocabulary}`.
3. Опрос `GET /v2/pre-recorded/{id}`. Лимит: 135 минут на файл.

### Deepgram
`POST https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&diarize=true&utterances=true&keyterm=…`, заголовок `Authorization: Token <key>`, тело — сам аудиофайл. REST без CORS, нужен прокси. Баланс: `GET /v1/projects` → `GET /v1/projects/{id}/balances`.

### Soniox
Заголовок `Authorization: Bearer`.
1. `POST /v1/files` (multipart `file`).
2. `POST /v1/transcriptions` с `{model:"stt-async-v5", file_id, language_hints:["kk","ru","en"], enable_language_identification, enable_speaker_diarization, context}`.
3. Опрос `GET /v1/transcriptions/{id}`, затем `GET /v1/transcriptions/{id}/transcript` возвращает токены с языком и спикером.
4. В конце файл и задача удаляются через `DELETE`.

### Yandex SpeechKit v3
`POST https://stt.api.cloud.yandex.net/stt/v3/recognizeFileAsync`, заголовок `Authorization: Api-Key …`, тело `{content(base64), recognitionModel:{model:"general", audioFormat:{containerAudio:{containerAudioType:"MP3"}}, textNormalization, languageRestriction:{restrictionType:"WHITELIST", languageCode:["kk-KZ","ru-RU"]}}}`. Опрос операции: `GET https://operation.api.cloud.yandex.net/operations/{id}`. Результат: `GET /stt/v3/getRecognition?operationId=…`, ответ в формате NDJSON (`final` / `finalRefinement.normalizedText`). Без CORS, нужен прокси.

## Что не удалось проверить
- Точные объёмы бесплатных тарифов Groq, Gemini, ElevenLabs (сколько часов STT на Free), AssemblyAI и Deepgram: это данные из сторонних источников.
- Точность Gemini и Gladia на казахском, поддержка казахского в AssemblyAI.
- Актуальный бонус Soniox при регистрации (источники расходятся).
- Реальные CORS-ответы всех API.
