const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const OFINET_BASE_URL = (process.env.OFINET_BASE_URL || '').replace(/\/$/, '');
const OFINET_TOKEN = process.env.OFINET_TOKEN || '';

const ENDPOINTS = {
  comunas: process.env.OFINET_ENDPOINT_COMUNAS || 'Comuna',
  tipos: process.env.OFINET_ENDPOINT_TIPOS || 'TipoInmueble',
  operaciones: process.env.OFINET_ENDPOINT_OPERACIONES || 'Operacion',
  propiedades: process.env.OFINET_ENDPOINT_PROPIEDADES || 'Propiedad',
  detallePropiedad: process.env.OFINET_ENDPOINT_DETALLE || 'Propiedad/{id}'
};

function ensureOfinetConfigured(res) {
  if (OFINET_BASE_URL && OFINET_TOKEN) return true;

  res.status(503).json({
    responseCode: -1,
    ErrorMensaje: 'Proxy OFINET no configurado. Define OFINET_BASE_URL y OFINET_TOKEN en Heroku.'
  });
  return false;
}

function resolveEndpoint(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(params[key] ?? ''));
}

async function requestOfinet(endpoint) {
  const response = await fetch(`${OFINET_BASE_URL}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${OFINET_TOKEN}`,
      Accept: 'application/json'
    }
  });

  const bodyText = await response.text();
  let data;

  try {
    data = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`OFINET respondió con un payload inválido (${response.status}): ${bodyText.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = data?.ErrorMensaje || data?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ofinetConfigured: Boolean(OFINET_BASE_URL && OFINET_TOKEN)
  });
});

app.get('/api/ofinet/config', (_req, res) => {
  res.json({
    useMockData: !(OFINET_BASE_URL && OFINET_TOKEN),
    baseUrl: '/api/ofinet',
    endpoints: ENDPOINTS
  });
});

app.get('/api/ofinet/comunas', async (_req, res) => {
  if (!ensureOfinetConfigured(res)) return;

  try {
    res.json(await requestOfinet(ENDPOINTS.comunas));
  } catch (error) {
    res.status(502).json({ responseCode: -1, ErrorMensaje: error.message });
  }
});

app.get('/api/ofinet/tipos', async (_req, res) => {
  if (!ensureOfinetConfigured(res)) return;

  try {
    res.json(await requestOfinet(ENDPOINTS.tipos));
  } catch (error) {
    res.status(502).json({ responseCode: -1, ErrorMensaje: error.message });
  }
});

app.get('/api/ofinet/operaciones', async (_req, res) => {
  if (!ensureOfinetConfigured(res)) return;

  try {
    res.json(await requestOfinet(ENDPOINTS.operaciones));
  } catch (error) {
    res.status(502).json({ responseCode: -1, ErrorMensaje: error.message });
  }
});

app.get('/api/ofinet/propiedades', async (_req, res) => {
  if (!ensureOfinetConfigured(res)) return;

  try {
    res.json(await requestOfinet(ENDPOINTS.propiedades));
  } catch (error) {
    res.status(502).json({ responseCode: -1, ErrorMensaje: error.message });
  }
});

app.get('/api/ofinet/propiedades/:id', async (req, res) => {
  if (!ensureOfinetConfigured(res)) return;

  try {
    const endpoint = resolveEndpoint(ENDPOINTS.detallePropiedad, { id: req.params.id });
    res.json(await requestOfinet(endpoint));
  } catch (error) {
    res.status(502).json({ responseCode: -1, ErrorMensaje: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Aqui Casas app running on port ${PORT}`);
});
