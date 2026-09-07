// Función serverless (Netlify Function) que envía la notificación push real.
// Corre en un servidor de Netlify, NUNCA en el navegador del cliente — por eso puede
// usar la clave privada de la cuenta de servicio sin exponerla.
//
// La llama el propio sitio (bookspa.html → sendServerPush) justo cuando se crea una
// cita nueva o una solicitud de contacto.

const admin = require('firebase-admin');

// La cuenta de servicio se guarda como variable de entorno en Netlify
// (FIREBASE_SERVICE_ACCOUNT = contenido completo del .json descargado de Firebase).
// Nunca debe escribirse acá ni subirse al repositorio.
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const { tenantId, title, body } = payload;
  if (!tenantId || !title) {
    return { statusCode: 400, body: 'Falta tenantId o title' };
  }

  try {
    const snap = await db
      .collection('tenants').doc(tenantId)
      .collection('data').doc('pushTokens')
      .get();

    if (!snap.exists || !snap.data().json) {
      // El salón nunca activó las notificaciones push en ningún dispositivo: no hay
      // nada que enviar, no es un error.
      return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
    }

    const tokens = JSON.parse(snap.data().json);
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
    }

    const message = {
      notification: { title, body: body || '' },
      tokens
    };

    const result = await admin.messaging().sendEachForMulticast(message);

    // Limpieza: si algún token quedó inválido (el usuario desinstaló la app,
    // borró datos del navegador, etc.), lo sacamos de la lista para no reintentar
    // en vano cada vez.
    const validTokens = tokens.filter((_, i) => {
      const res = result.responses[i];
      if (res.success) return true;
      const code = res.error && res.error.code;
      return code !== 'messaging/invalid-registration-token'
          && code !== 'messaging/registration-token-not-registered';
    });
    if (validTokens.length !== tokens.length) {
      await db.collection('tenants').doc(tenantId).collection('data').doc('pushTokens')
        .set({ json: JSON.stringify(validTokens), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    return { statusCode: 200, body: JSON.stringify({ sent: result.successCount }) };
  } catch (e) {
    console.error('send-push error', e);
    return { statusCode: 500, body: 'Error enviando el push' };
  }
};
