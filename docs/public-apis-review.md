# Разбор public-apis/public-apis для BLA-БЛА

[public-apis/public-apis](https://github.com/public-apis/public-apis) — это один большой README: около 2 000 API в 51 категории. В каждой таблице одни и те же колонки: **API | Description | Auth | HTTPS | CORS**.

- **Auth**: `No` (972), `apiKey` (905), `OAuth` (150).
- **CORS**: `Yes` (789), `No` (231), `Unknown` (~1 000).

## Главные выводы

1. **Колонка CORS — самый полезный фильтр для браузерного приложения.** `Yes` — можно звать прямо со страницы с ключом пользователя, `No` — нужен прокси, `Unknown` — проверять самому. Это подсказка, не гарантия: список поддерживает сообщество, и данные устаревают.
2. **Распознавания речи в списке почти нет.** Нет OpenAI Whisper, Deepgram, AssemblyAI, ElevenLabs, Speechmatics, Soniox, Gladia, Yandex SpeechKit. Из полезного для STT есть только Groq, Hugging Face и Gemini. Поэтому основные провайдеры BLA-БЛА найдены вне этого каталога.
3. **Нет ничего специфичного для казахского**, а для русского текста ничего полезного: только бизнес-, календарные и валютные API.
4. Много свежих маленьких AI- и x402-сервисов неровного качества. Старые записи стабильнее, но часть уже не работает.
5. API с авторизацией через OAuth (Google Cloud NL, Watson, Semantria) неудобны в приложении без бэкенда.

## Что может пригодиться (по полезности)

| API | CORS | Как использовать |
|---|---|---|
| [Groq](https://console.groq.com/docs/quickstart) | Yes | Whisper уже подключён. Его LLM подойдут для пунктуации, резюме и перевода |
| [Google Gemini](https://ai.google.dev/gemini-api/docs) | Unknown | Уже подключён. Одним запросом можно получить расшифровку, спикеров, перевод и краткое содержание |
| [Hugging Face](https://huggingface.co) | Yes | NLLB-перевод (есть kk), суммаризаторы. Бесплатных кредитов на Inference больше нет |
| [OpenRouter](https://openrouter.ai/docs/quick-start) | Yes | Один ключ на 300+ LLM для постобработки текста |
| [Cohere](https://docs.cohere.com/reference/about) | Yes | Многоязычная Aya: саммари и перевод, есть бесплатный trial |
| [NLP Cloud](https://nlpcloud.io) | Unknown | NLLB-200 (kaz_Cyrl), определение языка, исправление грамматики |
| [Langbly](https://langbly.com/docs) / [Kiprio](https://kiprio.com/v1/translate) | Yes | Перевод и определение языка из браузера |
| [Detect Language](https://detectlanguage.com/) | Unknown | Пометка языка (RU/EN/KZ) у каждой фразы |
| [Cloudmersive NLP](https://www.cloudmersive.com/nlp-api) | Yes | Проверка орфографии, сегментация на предложения |
| [Jina AI](https://jina.ai) | Yes | Эмбеддинги для поиска по длинным расшифровкам |
| [Wiktionary](https://ru.wiktionary.org/w/api.php) | Yes | Проверка подозрительных слов, без ключа |
| [TranscriptYT](https://transcript-yt.com/docs) | Yes | Взять готовые субтитры YouTube по ссылке вместо распознавания |
| [CloudConvert](https://cloudconvert.com/api/v2) | Unknown | Извлечь аудио или сделать DOCX/PDF, если браузер не справится |
| [Cloudmersive Convert](https://cloudmersive.com/convert-api), [iLovePDF](https://developer.ilovepdf.com/) | Yes | Экспорт расшифровки в DOCX/PDF |
| [Replicate](https://replicate.com/docs/reference/http) | Yes (по списку) | WhisperX с диаризацией. На практике браузерные запросы часто блокируются |
| [Speak AI](https://docs.speakai.co), [Audexum](https://audexum.com/docs) | ? / Yes | Небольшие STT-сервисы. Поддержку ru и kk надо проверять |

**Не подходят**, хотя выглядят релевантно: BRAINIALL (только PT/ES), MediaCraft AI (EN↔CN), IBM Text to Speech (это синтез, а не распознавание), Mercury (закрыт), платные x402-сервисы.

## Идеи на будущее

- **Постобработка через LLM** (Groq, OpenRouter, Cohere): расставить пунктуацию, убрать «э-э», сделать краткое содержание, перевести RU↔KZ↔EN.
- **Режим «ссылка на YouTube»**: брать готовые субтитры через TranscriptYT.
- **Экспорт в DOCX/PDF** на стороне клиента (docx.js / jsPDF), без внешних API.
