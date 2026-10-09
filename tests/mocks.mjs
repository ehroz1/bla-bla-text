// Подменённые ответы API по образцам из документации сервисов.
const json = (body, status = 200, headers = {}) => ({
  status,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': '*', ...headers },
  body: JSON.stringify(body),
})

export const mocks = {
  groq: {
    match: 'https://api.groq.com/**',
    files: ['short.wav', 'clip.webm', 'clip.mp4', 'long.mp3'],
    respond: (req) => {
      if (req.method() === 'OPTIONS') return json({})
      return json(
        {
          text: ' Привет, это test транскрипция.',
          language: 'russian',
          duration: 20,
          segments: [{ start: 0, end: 4.2, text: ' Привет, это test транскрипция.' }],
        },
        200,
        { 'x-ratelimit-remaining-requests': '1999' },
      )
    },
    expect: ({ text, calls }) => {
      const body = calls[0]
      if (!body.headers.authorization?.startsWith('Bearer ')) return 'no bearer'
      return text.includes('Привет') || 'text missing'
    },
  },
  gemini: {
    match: 'https://generativelanguage.googleapis.com/**',
    files: ['short.wav', 'long.mp3'],
    respond: () =>
      json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    language: 'ru',
                    segments: [
                      { start: '00:00', end: '00:03', speaker: 'Спикер 1', text: 'Привет, давай обсудим deadline.' },
                      { start: '00:03', end: '00:06', speaker: 'Спикер 2', text: 'Окей, sure.' },
                    ],
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
    expect: ({ text, calls }) => (calls[0].headers['x-goog-api-key'] ? text.includes('Спикер 2: Окей') || 'no speakers' : 'no key header'),
  },
}

const words = (arr) => arr // helper for readability

Object.assign(mocks, {
  elevenlabs: {
    match: 'https://api.elevenlabs.io/**',
    respond: (req) =>
      json({
        language_code: 'rus',
        text: 'Привет, team. Как дела?',
        audio_duration_secs: 20,
        words: words([
          { text: 'Привет,', start: 0, end: 0.5, type: 'word', speaker_id: 'speaker_0' },
          { text: ' ', start: 0.5, end: 0.6, type: 'spacing', speaker_id: 'speaker_0' },
          { text: 'team.', start: 0.6, end: 1, type: 'word', speaker_id: 'speaker_0' },
          { text: ' ', start: 1, end: 1.1, type: 'spacing', speaker_id: 'speaker_1' },
          { text: 'Как', start: 1.2, end: 1.4, type: 'word', speaker_id: 'speaker_1' },
          { text: ' ', start: 1.4, end: 1.5, type: 'spacing', speaker_id: 'speaker_1' },
          { text: 'дела?', start: 1.5, end: 2, type: 'word', speaker_id: 'speaker_1' },
        ]),
      }),
    expect: ({ text, calls }) =>
      calls[0].headers['xi-api-key'] === 'test-key' && text.includes('Спикер 1: Привет, team.') && text.includes('Спикер 2: Как дела?') ? true : 'bad: ' + text,
  },
  speechmatics: {
    match: 'https://eu1.asr.api.speechmatics.com/**',
    respond: (req, n) => {
      const u = req.url()
      if (req.method() === 'POST') return json({ id: 'job1' })
      if (u.includes('/transcript'))
        return json({
          metadata: { transcription_config: { language: 'multi' } },
          results: [
            { type: 'word', start_time: 0, end_time: 0.4, alternatives: [{ content: 'Привет', language: 'ru', speaker: 'S1' }] },
            { type: 'punctuation', start_time: 0.4, end_time: 0.4, attaches_to: 'previous', alternatives: [{ content: ',', speaker: 'S1' }] },
            { type: 'word', start_time: 0.5, end_time: 0.9, alternatives: [{ content: 'world', language: 'en', speaker: 'S1' }] },
            { type: 'punctuation', start_time: 0.9, end_time: 0.9, attaches_to: 'previous', is_eos: true, alternatives: [{ content: '.', speaker: 'S1' }] },
            { type: 'word', start_time: 1, end_time: 1.3, alternatives: [{ content: 'Да', language: 'ru', speaker: 'S2' }] },
          ],
        })
      return json({ job: { status: n < 3 ? 'running' : 'done' } })
    },
    expect: ({ text }) => text === 'Спикер 1: Привет, world.\n\nСпикер 2: Да' || 'bad: ' + JSON.stringify(text),
  },
  assemblyai: {
    match: 'https://api.assemblyai.com/**',
    respond: (req) => {
      const u = req.url()
      if (u.endsWith('/upload')) return json({ upload_url: 'https://cdn.assemblyai.com/upload/x' })
      if (req.method() === 'POST') {
        const b = JSON.parse(req.postData())
        if (!b.language_detection_options?.code_switching) return json({ error: 'no code switching' }, 400)
        return json({ id: 't1', status: 'queued' })
      }
      return json({
        id: 't1',
        status: 'completed',
        text: 'Привет. Hello.',
        language_code: 'ru',
        audio_duration: 20,
        utterances: [
          { speaker: 'A', start: 0, end: 900, text: 'Привет.' },
          { speaker: 'B', start: 1000, end: 2000, text: 'Hello.' },
        ],
      })
    },
    expect: ({ text, calls }) => (calls[0].headers.authorization === 'test-key' && text === 'Спикер 1: Привет.\n\nСпикер 2: Hello.') || 'bad: ' + JSON.stringify(text),
  },
  gladia: {
    match: 'https://api.gladia.io/**',
    respond: (req, n) => {
      const u = req.url()
      if (u.endsWith('/upload')) return json({ audio_url: 'https://api.gladia.io/file/x' })
      if (req.method() === 'POST') return json({ id: 'g1', result_url: 'x' })
      return json(
        n < 4
          ? { id: 'g1', status: 'processing' }
          : {
              id: 'g1',
              status: 'done',
              result: {
                metadata: { audio_duration: 20 },
                transcription: {
                  full_transcript: 'Сәлем. Привет.',
                  languages: ['kk', 'ru'],
                  utterances: [
                    { start: 0, end: 1, text: 'Сәлем.', language: 'kk', speaker: 0 },
                    { start: 1, end: 2, text: 'Привет.', language: 'ru', speaker: 1 },
                  ],
                },
              },
            },
      )
    },
    expect: ({ text, calls }) => (calls[0].headers['x-gladia-key'] && text.includes('Спикер 2: Привет.')) || 'bad: ' + text,
  },
  mistral: {
    match: 'https://api.mistral.ai/**',
    respond: () =>
      json({
        model: 'voxtral-mini-2602',
        text: 'Привет, это deadline.',
        language: 'ru',
        segments: [{ text: 'Привет, это deadline.', start: 0, end: 2, speaker_id: 'speaker_1' }],
      }),
    expect: ({ text }) => text.includes('deadline') || 'bad',
  },
  deepgram: {
    match: 'https://api.deepgram.com/**',
    respond: (req) => {
      if (!req.url().includes('language=multi') || req.headers().authorization !== 'Token test-key') return json({ err_msg: 'bad request' }, 400)
      return json({
        metadata: { duration: 20 },
        results: {
          channels: [{ alternatives: [{ transcript: 'привет hello', languages: ['ru', 'en'], words: [] }] }],
          utterances: [
            { start: 0, end: 1, transcript: 'Привет.', speaker: 0 },
            { start: 1, end: 2, transcript: 'Hello.', speaker: 1 },
          ],
        },
      })
    },
    expect: ({ text }) => text === 'Спикер 1: Привет.\n\nСпикер 2: Hello.' || 'bad: ' + JSON.stringify(text),
  },
  soniox: {
    match: 'https://api.soniox.com/**',
    respond: (req, n) => {
      const u = req.url()
      if (req.method() === 'DELETE') return { status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' }
      if (u.endsWith('/files')) return json({ id: 'f1' })
      if (u.endsWith('/transcriptions')) return json({ id: 'tr1', status: 'queued' })
      if (u.endsWith('/transcript'))
        return json({
          text: 'Сәлем, қалайсың? Нормально.',
          tokens: [
            { text: 'Сәлем', start_ms: 0, end_ms: 400, speaker: '1', language: 'kk' },
            { text: ',', start_ms: 400, end_ms: 410, speaker: '1', language: 'kk' },
            { text: ' қалайсың?', start_ms: 500, end_ms: 900, speaker: '1', language: 'kk' },
            { text: ' Нормально.', start_ms: 1000, end_ms: 1500, speaker: '2', language: 'ru' },
          ],
        })
      return json({ id: 'tr1', status: n < 4 ? 'processing' : 'completed' })
    },
    expect: ({ text }) => text === 'Спикер 1: Сәлем, қалайсың?\n\nСпикер 2: Нормально.' || 'bad: ' + JSON.stringify(text),
  },
  yandex: {
    match: /https:\/\/(stt|operation)\.api\.cloud\.yandex\.net\/.*/,
    respond: (req, n) => {
      const u = req.url()
      if (u.includes('recognizeFileAsync')) {
        const b = JSON.parse(req.postData())
        if (!b.content || b.recognitionModel.audioFormat.containerAudio.containerAudioType !== 'MP3') return json({ message: 'bad' }, 400)
        return json({ id: 'op1', done: false })
      }
      if (u.includes('/operations/')) return json({ id: 'op1', done: n >= 3 })
      const lines = [
        { result: { channelTag: '0', final: { alternatives: [{ text: 'сәлем', startTimeMs: '0', endTimeMs: '900', languages: [{ languageCode: 'kk-KZ', probability: 0.9 }] }] } } },
        { result: { channelTag: '0', finalRefinement: { finalIndex: '0', normalizedText: { alternatives: [{ text: 'Сәлем!', startTimeMs: '0', endTimeMs: '900' }] } } } },
        { result: { channelTag: '0', finalRefinement: { finalIndex: '1', normalizedText: { alternatives: [{ text: 'Как дела?', startTimeMs: '1000', endTimeMs: '2000' }] } } } },
      ]
      return { status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: lines.map((l) => JSON.stringify(l)).join('\n') }
    },
    expect: ({ text, calls }) => (calls[0].headers.authorization === 'Api-Key test-key' && text === 'Сәлем! Как дела?') || 'bad: ' + JSON.stringify(text),
  },
  openai: {
    match: 'https://api.openai.com/**',
    respond: () => json({ text: 'Привет, это gpt-4o.' }),
    expect: ({ text }) => text === 'Привет, это gpt-4o.' || 'bad',
  },
})
