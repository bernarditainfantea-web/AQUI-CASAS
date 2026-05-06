const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DATA_PROVIDER = process.env.DATA_PROVIDER || 'ofinet_rest';

const OFINET_BASE_URL = normalizeOfinetUrl(process.env.OFINET_BASE_URL || '');
const OFINET_TOKEN = process.env.OFINET_TOKEN || '';
const OFINET_ENDPOINTS = {
  comunas: process.env.OFINET_ENDPOINT_COMUNAS || 'Comuna',
  tipos: process.env.OFINET_ENDPOINT_TIPOS || 'Categoria',
  operaciones: process.env.OFINET_ENDPOINT_OPERACIONES || 'Operacion',
  propiedades: process.env.OFINET_ENDPOINT_PROPIEDADES || 'propiedades',
  detallePropiedad: process.env.OFINET_ENDPOINT_DETALLE || 'Propiedad/{id}'
};

const LEGACY_BASE_URL = (process.env.LEGACY_BASE_URL || '').replace(/\/$/, '');
const LEGACY_PATH = process.env.LEGACY_PATH || 'consultaajaxresponsive.asp';
const LEGACY_ACTIONS = {
  comunas: process.env.LEGACY_ACTION_COMUNAS || 'TraeComunasXRegionFiltro',
  tipos: process.env.LEGACY_ACTION_TIPOS || '',
  operaciones: process.env.LEGACY_ACTION_OPERACIONES || '',
  propiedades: process.env.LEGACY_ACTION_PROPIEDADES || '',
  detallePropiedad: process.env.LEGACY_ACTION_DETALLE || ''
};
const LEGACY_DEFAULT_PARAMS = {
  comunas: process.env.LEGACY_PARAMS_COMUNAS || 'Tipo=-1&v=-1',
  tipos: process.env.LEGACY_PARAMS_TIPOS || '',
  operaciones: process.env.LEGACY_PARAMS_OPERACIONES || '',
  propiedades: process.env.LEGACY_PARAMS_PROPIEDADES || '',
  detallePropiedad: process.env.LEGACY_PARAMS_DETALLE || ''
};
const LEGACY_PUBLIC_SITE_URL = (process.env.LEGACY_PUBLIC_SITE_URL || 'https://www.aquicasas.cl').replace(/\/$/, '');
const OFINET_BACKOFFICE_SITE_URL = normalizeOfinetUrl(process.env.OFINET_BACKOFFICE_SITE_URL, 'https://ofinet.aquicasas.cl');
const MEDIA_PROXY_ALLOWED_HOSTS = new Set(['ofinet.aquicasas.cl', 'www.aquicasas.cl', 'aquicasas.cl']);

function normalizeOfinetUrl(rawUrl, fallback = '') {
  const trimmed = String(rawUrl || fallback || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'ofinet.aquicasas.cl' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch (error) {
    return trimmed;
  }

  return trimmed;
}

function resolveEndpoint(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(params[key] ?? ''));
}

function parseParamString(paramString) {
  const params = new URLSearchParams(paramString || '');
  return Object.fromEntries(params.entries());
}

function makeErrorResponse(res, message, status = 503, extra = {}) {
  res.status(status).json({
    responseCode: -1,
    ErrorMensaje: message,
    ...extra
  });
}

function sanitizeMalformedVideoFields(bodyText) {
  const videoFieldNames = [
    'video',
    'Video',
    'VideoUrl',
    'UrlVideo',
    'video_url',
    'TourVirtual',
    'tourVirtual',
    'url_video',
    'URLVideo',
    'videoYoutube',
    'VideoYoutube',
    'youtube',
    'Youtube',
    'youTube',
    'video_youtube',
    'VideoYouTube',
    'Tour',
    'tour',
    'Multimedia',
    'multimedia',
    'IframeVideo',
    'iframeVideo'
  ];
  const fieldPattern = new RegExp(
    `("(?:${videoFieldNames.join('|')})"\\s*:\\s*")([\\s\\S]*?)("(?=\\s*,\\s*"[^"]+"\\s*:|\\s*[}\\]]))`,
    'g'
  );

  return bodyText.replace(fieldPattern, (_match, prefix, value, suffix) => {
    const normalizedValue = value
      .replace(/\r?\n/g, ' ')
      .replace(/\\"/g, '"')
      .trim();

    return `${prefix}${JSON.stringify(normalizedValue).slice(1, -1)}${suffix}`;
  });
}

function getProviderConfig() {
  if (DATA_PROVIDER === 'legacy_asp') {
    return {
      mode: 'legacy_asp',
      configured: Boolean(LEGACY_BASE_URL),
      missing: LEGACY_BASE_URL ? [] : ['LEGACY_BASE_URL']
    };
  }

  return {
    mode: 'ofinet_rest',
    configured: Boolean(OFINET_BASE_URL && OFINET_TOKEN),
    missing: [
      !OFINET_BASE_URL && 'OFINET_BASE_URL',
      !OFINET_TOKEN && 'OFINET_TOKEN'
    ].filter(Boolean)
  };
}

function ensureProviderConfigured(res) {
  const config = getProviderConfig();
  if (config.configured) return true;

  const guidance = config.mode === 'legacy_asp'
    ? 'Proxy legacy ASP no configurado. Define LEGACY_BASE_URL en Heroku.'
    : 'Proxy OFINET no configurado. Define OFINET_BASE_URL y OFINET_TOKEN en Heroku.';

  makeErrorResponse(res, guidance, 503, {
    provider: config.mode,
    missing: config.missing
  });
  return false;
}

async function parseJsonResponse(response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || '';
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = (charsetMatch?.[1] || '').trim().toLowerCase();
  const preferredEncoding = charset.includes('8859') || charset.includes('1252') || charset.includes('latin1')
    ? 'latin1'
    : 'utf8';
  const fallbackEncoding = preferredEncoding === 'utf8' ? 'latin1' : 'utf8';
  const encodingsToTry = [preferredEncoding, fallbackEncoding].filter((value, index, list) => list.indexOf(value) === index);

  let lastError = null;
  let bestText = '';

  for (const encoding of encodingsToTry) {
    const bodyText = buffer.toString(encoding);
    bestText = bodyText;

    try {
      const parsed = JSON.parse(bodyText);
      const hasReplacementChars = bodyText.includes('�');

      if (!hasReplacementChars || encoding === fallbackEncoding) {
        return parsed;
      }

      lastError = new Error(`Texto decodificado con caracteres inválidos usando ${encoding}.`);
    } catch (error) {
      try {
        const sanitizedBodyText = sanitizeMalformedVideoFields(bodyText);
        const parsed = JSON.parse(sanitizedBodyText);
        const hasReplacementChars = sanitizedBodyText.includes('�');

        if (!hasReplacementChars || encoding === fallbackEncoding) {
          return parsed;
        }

        lastError = new Error(`Texto decodificado con caracteres inválidos usando ${encoding}.`);
      } catch (sanitizedError) {
        lastError = sanitizedError;
      }
    }
  }

  throw new Error(`Upstream respondió con un payload inválido (${response.status}): ${bestText.slice(0, 200)}${lastError ? ` | ${lastError.message}` : ''}`);
}

async function requestOfinet(endpoint) {
  const response = await fetch(`${OFINET_BASE_URL}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${OFINET_TOKEN}`,
      Accept: 'application/json'
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message = data?.ErrorMensaje || data?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function requestOfinetPost(endpoint, payload) {
  const response = await fetch(`${OFINET_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OFINET_TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message = data?.ErrorMensaje || data?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function requestLegacyPublicPropertyImages(id) {
  const response = await fetch(`${LEGACY_PUBLIC_SITE_URL}/property.asp?idPro=${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar la ficha publica legacy (${response.status}).`);
  }

  const html = await response.text();
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']*fotos\/[^"']+)["']/gi)];
  const images = [...new Set(matches
    .map(match => match[1])
    .filter(Boolean)
    .map(src => src.startsWith('http') ? src : `${LEGACY_PUBLIC_SITE_URL}/${src.replace(/^\/+/, '')}`))];

  return {
    responseCode: 0,
    id,
    images
  };
}

async function requestOfinetBackofficePropertyImages(id) {
  const response = await fetch(`${OFINET_BACKOFFICE_SITE_URL}/property.asp?idPro=${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar la ficha del back office OFINET (${response.status}).`);
  }

  const html = await response.text();
  const idPrefix = String(id || '').trim().toLowerCase();
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']*fotos\/[^"']+)["']/gi)];
  const images = [...new Set(matches
    .map(match => match[1])
    .filter(Boolean)
    .map(src => src.startsWith('http') ? src : `${OFINET_BACKOFFICE_SITE_URL}/${src.replace(/^\/+/, '')}`)
    .filter(src => {
      if (!idPrefix) return true;
      const filename = src.split('/').pop()?.toLowerCase() || '';
      return filename.startsWith(idPrefix);
    }))];

  return {
    responseCode: 0,
    id,
    images
  };
}

async function requestLegacyPublicPropertyVideo(id) {
  const response = await fetch(`${LEGACY_PUBLIC_SITE_URL}/property.asp?idPro=${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar la ficha publica legacy (${response.status}).`);
  }

  const html = await response.text();
  const candidates = extractVideoCandidatesFromHtml(html);

  return {
    responseCode: 0,
    id,
    video: candidates[0] || ''
  };
}

async function requestOfinetBackofficePropertyVideo(id) {
  const response = await fetch(`${OFINET_BACKOFFICE_SITE_URL}/property.asp?idPro=${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar la ficha del back office OFINET (${response.status}).`);
  }

  const html = await response.text();
  const candidates = extractVideoCandidatesFromHtml(html);

  return {
    responseCode: 0,
    id,
    video: candidates[0] || ''
  };
}

function extractVideoCandidatesFromHtml(html) {
  const decodedHtml = String(html || '')
    .replace(/&amp;/gi, '&')
    .replace(/\\\//g, '/');
  const iframeSources = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)]
    .map(match => match[1]);
  const anchorHrefs = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map(match => match[1]);
  const onclickAssignedUrls = [...html.matchAll(/(?:href|location|window\.open)\s*=\s*['"]([^'"]+)['"]/gi)]
    .map(match => match[1]);
  const directVideoUrls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/gi)]
    .map(match => match[0]);
  const genericQuotedUrls = [...decodedHtml.matchAll(/(?:https?:)?\/\/[^\s"'<>\\)]+/gi)]
    .map(match => match[0]);

  return [...new Set([...iframeSources, ...anchorHrefs, ...onclickAssignedUrls, ...directVideoUrls, ...genericQuotedUrls]
    .filter(Boolean)
    .map(url => url.startsWith('//') ? `https:${url}` : url)
    .filter(url => /youtube\.com|youtu\.be|vimeo\.com/i.test(url)))];
}

async function requestUfIndicator() {
  const response = await fetch('https://mindicador.cl/api/uf', {
    headers: {
      Accept: 'application/json'
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message = data?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  const latest = Array.isArray(data?.serie) ? data.serie[0] : null;
  if (!latest || typeof latest.valor !== 'number') {
    throw new Error('No se pudo obtener el valor actual de la UF.');
  }

  return {
    responseCode: 0,
    codigo: 'uf',
    nombre: 'Unidad de fomento (UF)',
    unidad_medida: 'Pesos',
    fecha: latest.fecha,
    valor: latest.valor,
    fuente: 'mindicador.cl'
  };
}

async function proxyRemoteMedia(res, rawUrl) {
  const mediaUrl = String(rawUrl || '').trim();

  if (!mediaUrl) {
    makeErrorResponse(res, 'Debes indicar una URL de medio para el proxy.', 400);
    return;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(mediaUrl);
  } catch (error) {
    makeErrorResponse(res, 'La URL del medio no es válida.', 400);
    return;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !MEDIA_PROXY_ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    makeErrorResponse(res, 'La URL del medio no está permitida.', 403);
    return;
  }

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        Accept: '*/*'
      }
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');

    if (contentType) {
      res.set('Content-Type', contentType);
    }

    if (cacheControl) {
      res.set('Cache-Control', cacheControl);
    } else {
      res.set('Cache-Control', 'public, max-age=300');
    }

    res.status(response.status).send(buffer);
  } catch (error) {
    makeErrorResponse(res, `No se pudo obtener el medio remoto: ${error.message}`, 502, {
      provider: 'media_proxy'
    });
  }
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPropertySearchPayload(query = {}) {
  return {
    Operacion: parseInteger(query.operacion, 1),
    Region: parseInteger(query.region, -1),
    Tipo: query.tipo || '-1',
    Comuna: parseInteger(query.comuna, -1),
    TipoMoneda: parseInteger(query.tipoMoneda, 1),
    ValorDesde: parseNumber(query.valorDesde, 0),
    ValorHasta: parseNumber(query.valorHasta, 0),
    SupDesde: parseNumber(query.supDesde, 0),
    SupHasta: parseNumber(query.supHasta, 0),
    DormDesde: parseInteger(query.dormDesde, 0),
    DormHasta: parseInteger(query.dormHasta, 0),
    Condominio: parseInteger(query.condominio, -1),
    Ordenamiento: query.ordenamiento || 'Reciente',
    RegPag: parseInteger(query.regPag, 50),
    NumPag: parseInteger(query.numPag, 1)
  };
}

async function requestLegacy(actionName, reqQuery = {}, options = {}) {
  if (!actionName) {
    throw new Error(`No hay accion legacy configurada para ${options.debugName || 'esta consulta'}.`);
  }

  const upstreamUrl = new URL(`${LEGACY_BASE_URL}/${LEGACY_PATH}`);
  const baseParams = parseParamString(options.defaultParams || '');

  upstreamUrl.searchParams.set('accion', actionName);
  Object.entries(baseParams).forEach(([key, value]) => upstreamUrl.searchParams.set(key, value));
  Object.entries(reqQuery).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      upstreamUrl.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: 'application/json'
    }
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message = data?.ErrorMensaje || data?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  if (data?.responseCode !== undefined && data.responseCode !== 0) {
    throw new Error(data.ErrorMensaje || 'La API legacy devolvió un error.');
  }

  return data;
}

async function requestProvider(resourceName, reqQuery = {}, pathParams = {}) {
  if (DATA_PROVIDER === 'legacy_asp') {
    if (resourceName === 'detallePropiedad') {
      return requestLegacy(LEGACY_ACTIONS.detallePropiedad, { id: pathParams.id, ...reqQuery }, {
        defaultParams: LEGACY_DEFAULT_PARAMS.detallePropiedad,
        debugName: 'detalle de propiedad'
      });
    }

    return requestLegacy(LEGACY_ACTIONS[resourceName], reqQuery, {
      defaultParams: LEGACY_DEFAULT_PARAMS[resourceName],
      debugName: resourceName
    });
  }

  if (resourceName === 'propiedades') {
    return requestOfinetPost(OFINET_ENDPOINTS.propiedades, buildPropertySearchPayload(reqQuery));
  }

  if (resourceName === 'detallePropiedad') {
    return requestOfinet(resolveEndpoint(OFINET_ENDPOINTS.detallePropiedad, pathParams));
  }

  return requestOfinet(OFINET_ENDPOINTS[resourceName]);
}

async function handleProviderRequest(res, resourceName, reqQuery = {}, pathParams = {}) {
  if (!ensureProviderConfigured(res)) return;

  try {
    res.json(await requestProvider(resourceName, reqQuery, pathParams));
  } catch (error) {
    makeErrorResponse(res, error.message, 502, {
      provider: DATA_PROVIDER,
      resource: resourceName
    });
  }
}

app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  const provider = getProviderConfig();
  res.json({
    ok: true,
    provider: provider.mode,
    ofinetConfigured: Boolean(OFINET_BASE_URL && OFINET_TOKEN),
    legacyConfigured: Boolean(LEGACY_BASE_URL),
    configured: provider.configured,
    missing: provider.missing
  });
});

app.get('/api/ofinet/config', (_req, res) => {
  const provider = getProviderConfig();
  res.json({
    useMockData: !provider.configured,
    baseUrl: '/api/ofinet',
    provider: provider.mode,
    endpoints: {
      comunas: 'comunas',
      tipos: 'tipos',
      operaciones: 'operaciones',
      propiedades: 'propiedades',
      detallePropiedad: 'propiedades/{id}'
    },
    upstream: provider.mode === 'legacy_asp'
      ? {
          baseUrl: LEGACY_BASE_URL,
          path: LEGACY_PATH,
          actions: LEGACY_ACTIONS
        }
      : {
          baseUrl: OFINET_BASE_URL,
          endpoints: OFINET_ENDPOINTS
        }
  });
});

app.get('/api/ofinet/comunas', async (req, res) => {
  await handleProviderRequest(res, 'comunas', req.query);
});

app.get('/api/ofinet/tipos', async (req, res) => {
  await handleProviderRequest(res, 'tipos', req.query);
});

app.get('/api/ofinet/operaciones', async (req, res) => {
  await handleProviderRequest(res, 'operaciones', req.query);
});

app.get('/api/ofinet/propiedades', async (req, res) => {
  await handleProviderRequest(res, 'propiedades', req.query);
});

app.get('/api/ofinet/propiedades/:id', async (req, res) => {
  await handleProviderRequest(res, 'detallePropiedad', req.query, { id: req.params.id });
});

app.get('/api/ofinet/propiedades/:id/legacy-images', async (req, res) => {
  try {
    let payload = await requestOfinetBackofficePropertyImages(req.params.id);

    if (!Array.isArray(payload.images) || payload.images.length === 0) {
      payload = await requestLegacyPublicPropertyImages(req.params.id);
    }

    res.json(payload);
  } catch (error) {
    try {
      res.json(await requestLegacyPublicPropertyImages(req.params.id));
    } catch (fallbackError) {
      makeErrorResponse(res, fallbackError.message || error.message, 502, {
        provider: 'legacy_public_site',
        resource: 'legacy_images'
      });
    }
  }
});

app.get('/api/ofinet/propiedades/:id/legacy-video', async (req, res) => {
  try {
    const payload = await requestOfinetBackofficePropertyVideo(req.params.id);
    res.json({
      responseCode: 0,
      id: req.params.id,
      video: String(payload?.video || '').trim()
    });
  } catch (error) {
    res.json({
      responseCode: 0,
      id: req.params.id,
      video: '',
      warning: error.message,
      provider: 'ofinet_backoffice'
    });
  }
});

app.get('/api/indicators/uf', async (_req, res) => {
  try {
    res.json(await requestUfIndicator());
  } catch (error) {
    makeErrorResponse(res, error.message, 502, {
      provider: 'mindicador',
      resource: 'uf'
    });
  }
});

app.get('/api/media', async (req, res) => {
  await proxyRemoteMedia(res, req.query.url);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Aqui Casas app running on port ${PORT}`);
});
