// BLA-БЛА — минимальный CORS-прокси для Cloudflare Workers (бесплатный тариф: 100 000 запросов/день).
// Нужен только для сервисов, которые не разрешают запросы прямо из браузера.
//
// Как развернуть (5 минут):
// 1. https://dash.cloudflare.com → Workers & Pages → Create → Create Worker → Deploy.
// 2. Edit code → вставьте этот файл целиком → Deploy.
// 3. Скопируйте адрес вида https://имя.ваш-аккаунт.workers.dev и вставьте его
//    в BLA-БЛА → «Настройки» → «CORS-прокси».
//
// Прокси пропускает только хосты из списка ниже и ничего не хранит.
// Ваш API-ключ проходит через ваш собственный воркер — чужим прокси ключи не доверяйте.

const ALLOWED_HOSTS = [
  'api.openai.com',
  'api.groq.com',
  'api.deepgram.com',
  'api.assemblyai.com',
  'api.eu.assemblyai.com',
  'api.elevenlabs.io',
  'generativelanguage.googleapis.com',
  'api.gladia.io',
  'asr.api.speechmatics.com',
  'eu1.asr.api.speechmatics.com',
  'us1.asr.api.speechmatics.com',
  'api.soniox.com',
  'api.mistral.ai',
  'router.huggingface.co',
  'stt.api.cloud.yandex.net',
  'operation.api.cloud.yandex.net',
  'smartspeech.sber.ru',
  'ngw.devices.sberbank.ru',
]

// Укажите адрес своего сайта, чтобы прокси нельзя было использовать с чужих страниц, например
// 'https://username.github.io'. '*' — разрешить всем.
const ALLOWED_ORIGIN = '*'

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN === '*' ? '*' : origin === ALLOWED_ORIGIN ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || ''
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })

    const url = new URL(request.url)
    const target = decodeURIComponent(url.pathname.slice(1)) + url.search
    let targetUrl
    try {
      targetUrl = new URL(target)
    } catch {
      return new Response('BLA-БЛА CORS proxy: передайте полный URL после слэша', { status: 400, headers: cors(origin) })
    }
    if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response(`Хост ${targetUrl.hostname} не разрешён`, { status: 403, headers: cors(origin) })
    }

    const headers = new Headers(request.headers)
    ;['Origin', 'Referer', 'Host', 'Cookie'].forEach((h) => headers.delete(h))
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    })
    const out = new Headers(upstream.headers)
    Object.entries(cors(origin)).forEach(([k, v]) => out.set(k, v))
    return new Response(upstream.body, { status: upstream.status, headers: out })
  },
}
