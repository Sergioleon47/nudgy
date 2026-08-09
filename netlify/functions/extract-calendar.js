// netlify/functions/extract-calendar.js
//
// Lee las anotaciones escritas a mano en las celdas recortadas de un calendario
// fisico fotografiado (una imagen chica por cada dia marcado). Corre en el
// servidor de Netlify, nunca en el navegador, asi la ANTHROPIC_API_KEY no se
// expone al cliente. Mismo patron que la funcion de recibos de PATRON.

function buildPrompt(cells, month, year) {
  const list = cells.map((c, i) => `Imagen ${i + 1}: dia ${c.day} de ${month} ${year}`).join('\n');
  return `Cada imagen adjunta es una celda recortada de un calendario de papel escrito a mano, correspondiente a un dia especifico. Esta es la lista de que dia corresponde a cada imagen, en el mismo orden en que las recibis:
${list}

Para cada imagen, transcribi EXACTAMENTE lo que esta escrito a mano en esa celda (puede estar en espanol o ingles, con abreviaturas). No corrijas ortografia, no completes palabras que no se entienden, no agregues nada que no este escrito ahi. Si la celda esta vacia, tiene solo el numero del dia impreso sin ninguna anotacion a mano, o no podes leer nada con confianza razonable, devolve "text": "" para esa imagen.

Devolve exactamente este formato JSON, sin markdown ni texto extra antes o despues:

{
  "items": [
    { "day": number, "text": "string (puede ser vacio)", "confidence": "alta" | "media" | "baja" }
  ]
}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar ANTHROPIC_API_KEY en Netlify' }) };
  }

  let cells, month, year;
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (!Array.isArray(parsed.cells) || parsed.cells.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan las imagenes de las celdas' }) };
    }
    if (parsed.cells.length > 40) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Maximo 40 dias por escaneo' }) };
    }
    cells = parsed.cells;
    month = typeof parsed.month === 'string' ? parsed.month : '';
    year = typeof parsed.year === 'number' ? parsed.year : '';
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body invalido' }) };
  }

  const content = [];
  cells.forEach((c, i) => {
    content.push({ type: 'text', text: `Imagen ${i + 1}, dia ${c.day}:` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: c.mediaType || 'image/jpeg', data: c.base64 }
    });
  });
  content.push({ type: 'text', text: buildPrompt(cells, month, year) });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return { statusCode: 502, body: JSON.stringify({ error: data.error.message || 'Error de la API de Claude' }) };
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Claude no devolvio texto' }) };
    }

    let result;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No se pudo interpretar la respuesta de Claude' }) };
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Error interno' }) };
  }
};
