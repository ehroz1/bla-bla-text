<p align="center"><img src="public/logo.svg" width="160" alt="BLA-БЛА"></p>

# BLA-БЛА — транскрибация аудио и видео

Загружаете любой медиафайл → выбираете сервис распознавания → вставляете **свой бесплатный API-ключ** (сохраняется в браузере) → настраиваете → получаете текст с таймкодами и спикерами.

Сделано для **русского и английского вперемешку** и **казахского**. Сервера нет: файл обрабатывается в браузере и уходит напрямую в выбранный сервис.

## Возможности

- **Любой файл**: mp3, m4a, wav, ogg/opus, flac, mp4, mov, webm, mkv… Из видео берётся только звук.
- **Подготовка в браузере** ([mediabunny](https://mediabunny.dev) + WebCodecs). Звук сводится в моно 16 кГц и сжимается в MP3 (≈0,35 МБ/мин). Длинная запись **режется на части** под лимит сервиса, а результаты склеиваются с правильными таймкодами.
- **11 сервисов**. У каждого есть описание, оценка качества по языкам (RU / EN / RU+EN / KZ), бесплатный тариф, лимиты, цена и **пошаговая инструкция, где взять ключ**.
- **Лимиты**: кнопка «Проверить ключ и баланс» запрашивает остаток у самого сервиса там, где API это позволяет (ElevenLabs, Deepgram, Speechmatics, Groq…). Отдельно ведётся локальный счётчик минут за день и за месяц.
- **Настройки сервиса**: язык, модель, спикеры, словарь терминов, подсказки.
- **Результат**: можно редактировать, копировать и скачивать в TXT, Markdown, SRT, VTT и JSON. История последних 30 расшифровок хранится в браузере.
- Светлая и тёмная тема, мобильная вёрстка, дизайн в стиле [shadcn/ui](https://ui.shadcn.com).

## Сервисы

| Сервис | RU+EN | Казахский | Бесплатно | Карта | Из браузера |
|---|---|---|---|---|---|
| [Groq Whisper](https://console.groq.com/keys) | ●●○ | ●○○ | ~8 ч аудио в день | нет | да |
| [Google Gemini](https://aistudio.google.com/app/apikey) | ●●● | ●●○ | дневной лимит запросов | нет | да |
| [ElevenLabs Scribe v2](https://elevenlabs.io/app/settings/api-keys) | ●●● | ●●● | 10 000 кредитов/мес | нет | да |
| [Speechmatics (Melia-1)](https://portal.speechmatics.com/settings/api-keys) | ●●● | — | $100 разово | нет | не проверено |
| [AssemblyAI](https://www.assemblyai.com/dashboard/api-keys) | ●●○ | — | $50 разово | нет | не проверено |
| [Gladia (Solaria-1)](https://app.gladia.io/apikeys) | ●●● | ●●○ | €50 разово | нет | не проверено |
| [Mistral Voxtral](https://console.mistral.ai/api-keys) | ●●○ | — | режим Free | нет | не проверено |
| [Deepgram Nova-3](https://console.deepgram.com) | ●●● | — | $200 разово | нет | через прокси |
| [Soniox](https://console.soniox.com) | ●●● | ●●● | платно, $0,10/ч | да | не проверено |
| [Yandex SpeechKit](https://console.yandex.cloud) | ●●○ | ●●● | стартовый грант | да | через прокси |
| [OpenAI](https://platform.openai.com/api-keys) | ●●● | ●○○ | платно | да | да |

**Топ-7 для RU+EN вперемешку:** ElevenLabs Scribe, Gemini, Speechmatics Melia-1, Groq, AssemblyAI (code-switching), Gladia (code-switching), Mistral Voxtral.
**Для казахского:** ElevenLabs Scribe и Gemini (бесплатно); Gladia (€50); Soniox и Yandex SpeechKit (лучшее качество, но нужна оплата или прокси).

Подробное сравнение с эндпоинтами, лимитами и источниками лежит в [docs/stt-apis.md](docs/stt-apis.md). Разбор каталога public-apis — в [docs/public-apis-review.md](docs/public-apis-review.md).

## CORS-прокси (для Deepgram и Yandex)

Некоторые API не принимают запросы прямо со страницы. Для них есть маленький прокси на бесплатном Cloudflare Worker: [proxy/cloudflare-worker.js](proxy/cloudflare-worker.js). Инструкция по развёртыванию — в самом файле и во вкладке «Настройки». Используйте **только свой** прокси, ведь через него проходит ваш ключ.

## Запуск

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/ — статический сайт (GitHub Pages, Netlify…)
npm run build:single   # dist-single/index.html — один файл, открывается без сервера
```

Сайт публикуется через GitHub Pages по workflow `.github/workflows/pages.yml` при пуше в `main`. Один раз включите Pages: **Settings → Pages → Source: GitHub Actions**. Однофайловая версия будет доступна там же: `…/bla-bla.html`.

### Тесты

E2E-тест прогоняет настоящий Chromium через весь путь «файл → подготовка → запрос → текст» для всех 11 сервисов. Ответы API подменяются по образцам из их документации, поэтому настоящие ключи не нужны:

```bash
npm run build
node tests/e2e.mjs <папка с short.wav, clip.webm, clip.mp4, long.mp3>
```

## Приватность

Ключи, настройки, история и счётчики хранятся только в `localStorage` вашего браузера. Сам файл отправляется только в выбранный вами сервис. Учтите, что на бесплатных тарифах некоторые сервисы (например, Gemini и Mistral Free) могут использовать данные для обучения.
