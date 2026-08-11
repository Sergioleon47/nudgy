// netlify/functions/check-alarms.js
//
// Corre cada minuto (Netlify Scheduled Function si el plan lo soporta, si no
// un cron externo pegandole a esta URL) y manda push notifications (FCM) para
// las notas que le toca sonar ahora mismo, para que Nudgy suene aunque el
// navegador este cerrado. Nunca corre en el navegador: usa una service
// account de Firebase (env var FIREBASE_ADMIN_KEY) que nunca se expone al
// cliente. Mismo
// patron de secretos-en-variables-de-entorno-de-Netlify que ya usa
// extract-calendar.js con ANTHROPIC_API_KEY.
//
// No reimplementa el parser de lenguaje natural del cliente (index.html) —
// las notas ya llegan con hour/minute/recurring/target/createdAt
// estructurados; esta funcion solo porta la logica de "le toca sonar ahora"
// (recurringMatchesDay + el bloque everyNHours del ticking loop en
// index.html), evaluada en la timezone de cada destinatario en vez de la
// timezone del navegador.

const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) throw new Error('Falta configurar FIREBASE_ADMIN_KEY en Netlify');
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// ---------- Calendario/hora en la timezone del destinatario ----------
// Todo se hace en milisegundos UTC "de mentira" (Date.UTC con los campos
// locales del destinatario) para que la aritmetica de dias/meses/años sea
// identica a la del cliente sin depender de en que timezone corre el
// servidor — ver el plan para el razonamiento completo.
function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  });
  const parts = {};
  fmt.formatToParts(date).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10) - 1,
    day: parseInt(parts.day, 10),
    hour: parts.hour === '24' ? 0 : parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    weekday: weekdayMap[parts.weekday]
  };
}
function dateKeyZoned(p) { return p.year + '-' + (p.month + 1) + '-' + p.day; }
function dayFloorMs(p) { return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, 0, 0); }

// Port de recurringMatchesDay (index.html ~2925-2964). `createdAtParts` y
// `dParts` ya vienen resueltos en la timezone del destinatario.
function recurringMatchesDay(recurring, createdAtParts, dParts, nowInstant) {
  if (recurring.until && nowInstant > new Date(recurring.until)) return false;
  if (recurring.type === 'daily') return true;
  if (recurring.type === 'weekly') return recurring.weekdays.indexOf(dParts.weekday) !== -1;
  if (recurring.type === 'yearly') return recurring.month === dParts.month && recurring.day === dParts.day;
  if (recurring.type === 'everyNDays') {
    const anchorMid = Date.UTC(createdAtParts.year, createdAtParts.month, createdAtParts.day);
    const dMid = Date.UTC(dParts.year, dParts.month, dParts.day);
    if (dMid < anchorMid) return false;
    const diffDays = Math.round((dMid - anchorMid) / 86400000);
    return diffDays % recurring.n === 0;
  }
  if (recurring.type === 'everyNYears') {
    if (dParts.month !== createdAtParts.month || dParts.day !== createdAtParts.day) return false;
    const yearsDiff = dParts.year - createdAtParts.year;
    return yearsDiff >= 0 && yearsDiff % recurring.n === 0;
  }
  if (recurring.type === 'everyNMonths') {
    const monthsDiff = (dParts.year - createdAtParts.year) * 12 + (dParts.month - createdAtParts.month);
    if (monthsDiff < 0 || monthsDiff % recurring.n !== 0) return false;
    const lastDayOfDMonth = new Date(Date.UTC(dParts.year, dParts.month + 1, 0)).getUTCDate();
    const expectedDay = Math.min(createdAtParts.day, lastDayOfDMonth);
    return dParts.day === expectedDay;
  }
  return false;
}

// Devuelve { fires, pushKey } — mismo esquema de key que firedKey en el
// cliente, pero guardado en un campo separado (pushedKey) para que el
// ticking loop del cliente y esta funcion nunca se pisen entre si.
function evaluateNote(note, timezone, nowInstant) {
  if (note.hour == null || !note.enabled) return { fires: false };
  if (note.snoozeUntil) {
    if (nowInstant >= new Date(note.snoozeUntil)) return { fires: true, clearsSnooze: true };
    return { fires: false };
  }
  const nowParts = zonedParts(nowInstant, timezone);
  const createdAtParts = zonedParts(new Date(note.createdAt), timezone);

  if (note.recurring && note.recurring.type === 'everyNHours') {
    const until = note.recurring.until ? new Date(note.recurring.until) : null;
    if (until && nowInstant > until) return { fires: false };
    if (note.recurring.untilHour != null) {
      const nowClock = nowParts.hour * 60 + nowParts.minute;
      const cutoffClock = note.recurring.untilHour * 60 + (note.recurring.untilMinute || 0);
      if (nowClock > cutoffClock) return { fires: false };
    }
    const anchorFloor = dayFloorMs(createdAtParts);
    const nowFloor = dayFloorMs(nowParts);
    const diffMinutes = Math.round((nowFloor - anchorFloor) / 60000);
    const intervalMinutes = note.recurring.n * 60;
    if (diffMinutes < 0 || diffMinutes % intervalMinutes !== 0) return { fires: false };
    const pushKey = 'h' + diffMinutes;
    if (note.pushedKey === pushKey) return { fires: false };
    return { fires: true, pushKey };
  }

  const minuteMatches = nowParts.hour === note.hour && nowParts.minute === note.minute;
  const todayKey = dateKeyZoned(nowParts);
  const dayMatches = note.recurring
    ? recurringMatchesDay(note.recurring, createdAtParts, nowParts, nowInstant)
    : (note.target ? dateKeyZoned(zonedParts(new Date(note.target), timezone)) === todayKey : false);
  if (minuteMatches && dayMatches && note.pushedKey !== todayKey) {
    return { fires: true, pushKey: todayKey };
  }
  return { fires: false };
}

// Expuesto solo para pruebas unitarias de la logica de scheduling (no afecta
// la invocacion normal de Netlify, que solo usa exports.handler).
exports._internal = { zonedParts, dateKeyZoned, recurringMatchesDay, evaluateNote };

// ---------- Handler ----------
exports.handler = async (event) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const given = (event.queryStringParameters || {}).secret;
    if (given !== secret) return { statusCode: 401, body: 'unauthorized' };
  }

  let db, messaging;
  try {
    initAdmin();
    db = admin.firestore();
    messaging = admin.messaging();
  } catch (err) {
    console.error('check-alarms: init failed —', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const now = new Date();
  const results = { checked: 0, fired: 0, errors: [] };

  try {
    // 1. uid -> { tokens: [{id, token}], timezone } a partir de todos los
    // dispositivos que se registraron para recibir push.
    const tokenDocs = await db.collectionGroup('pushTokens').get();
    const byUid = new Map();
    tokenDocs.forEach((doc) => {
      const uid = doc.ref.parent.parent.id;
      const data = doc.data();
      if (!data.token) return;
      const entry = byUid.get(uid) || { tokens: [], timezone: null, updatedAt: null };
      entry.tokens.push({ id: doc.id, token: data.token });
      if (!entry.updatedAt || (data.updatedAt && data.updatedAt > entry.updatedAt)) {
        entry.updatedAt = data.updatedAt || null;
        entry.timezone = data.timezone || entry.timezone;
      }
      byUid.set(uid, entry);
    });
    console.log('check-alarms: ' + tokenDocs.size + ' pushToken doc(s) across ' + byUid.size + ' uid(s)');
    if (!byUid.size) {
      console.log('check-alarms: no push tokens registered, nothing to do');
      return { statusCode: 200, body: JSON.stringify({ skipped: 'no push tokens registered' }) };
    }
    Array.from(byUid.entries()).forEach(([uid, r]) => {
      console.log('check-alarms: uid=' + uid + ' tokens=' + r.tokens.length + ' timezone=' + r.timezone);
    });

    // 2. Resolver, por uid, si tiene un hogar activo -> agrupar por
    // coleccion de notas real para no leerla mas de una vez por hogar.
    const householdIdByUid = new Map();
    await Promise.all(Array.from(byUid.keys()).map(async (uid) => {
      const metaDoc = await db.collection('users').doc(uid).collection('meta').doc('household').get();
      const householdId = metaDoc.exists ? metaDoc.data().householdId : null;
      if (householdId) householdIdByUid.set(uid, householdId);
    }));

    const householdIds = new Set(householdIdByUid.values());
    const personalUids = Array.from(byUid.keys()).filter((uid) => !householdIdByUid.has(uid));
    console.log('check-alarms: ' + personalUids.length + ' personal uid(s), ' + householdIds.size + ' household(s)');

    // Cache de miembros por hogar (uid -> autoAccept), un solo read por hogar.
    const membersByHousehold = new Map();
    await Promise.all(Array.from(householdIds).map(async (hid) => {
      const snap = await db.collection('households').doc(hid).collection('members').get();
      const map = new Map();
      snap.forEach((d) => { map.set(d.id, !!(d.data() || {}).autoAccept); });
      membersByHousehold.set(hid, map);
    }));

    const tasks = [];

    // 3a. Notas personales: una coleccion por uid.
    // Cada `.then()` DEVUELVE su Promise.all de sendAndMark — si en vez de
    // eso se hiciera `tasks.push(sendAndMark(...))` desde adentro del
    // callback, esos pushes llegarian tarde: el `await Promise.all(tasks)`
    // de mas abajo ya habria tomado una foto del array antes de que este
    // `.then()` corra, y la funcion podria responder (y Netlify podria
    // congelar el contenedor) antes de que el push/Firestore-write termine.
    personalUids.forEach((uid) => {
      const recipient = byUid.get(uid);
      if (!recipient.timezone) return;
      tasks.push(
        db.collection('users').doc(uid).collection('notes').get().then((snap) => {
          const sendTasks = [];
          snap.forEach((doc) => {
            const note = doc.data();
            results.checked++;
            const evalResult = evaluateNote(note, recipient.timezone, now);
            if (evalResult.fires) {
              results.fired++;
              sendTasks.push(sendAndMark(doc.ref, note, evalResult, [{ uid, tokens: recipient.tokens }], messaging, db, results));
            }
          });
          return Promise.all(sendTasks);
        }).catch((err) => results.errors.push(String(err)))
      );
    });

    // 3b. Notas de hogar: una coleccion por hogar, fan-out por miembro activo.
    householdIds.forEach((hid) => {
      const memberAutoAccept = membersByHousehold.get(hid) || new Map();
      tasks.push(
        db.collection('households').doc(hid).collection('notes').get().then((snap) => {
          const sendTasks = [];
          snap.forEach((doc) => {
            const note = doc.data();
            results.checked++;
            // El dedup (pushedKey) es a nivel de nota, no por miembro: si el
            // hogar tiene miembros en timezones distintas, la nota dispara
            // en el momento real en que el PRIMER miembro activo llega a su
            // hora local, y ese mismo envio le llega a todos los demas
            // miembros activos en ese instante (no en su propia hora local).
            // Asuncion aceptada para v1: los miembros de un mismo hogar
            // comparten zona horaria (caso de uso real de la app: paciente y
            // cuidador en la misma ciudad).
            const activeRecipients = [];
            let evalResult = { fires: false };
            Array.from(householdIdByUid.entries())
              .filter(([, id]) => id === hid)
              .forEach(([uid]) => {
                const recipient = byUid.get(uid);
                if (!recipient || !recipient.timezone) return;
                const isOwner = note.authorUid === uid;
                const accepted = !!(note.acceptedBy && note.acceptedBy[uid]);
                const autoAccept = memberAutoAccept.get(uid) === true;
                if (!isOwner && !accepted && !autoAccept) return;
                const r = evaluateNote(note, recipient.timezone, now);
                if (r.fires) {
                  evalResult = r;
                  activeRecipients.push({ uid, tokens: recipient.tokens });
                }
              });
            if (evalResult.fires && activeRecipients.length) {
              results.fired++;
              sendTasks.push(sendAndMark(doc.ref, note, evalResult, activeRecipients, messaging, db, results));
            }
          });
          return Promise.all(sendTasks);
        }).catch((err) => results.errors.push(String(err)))
      );
    });

    await Promise.all(tasks);
    console.log('check-alarms: done — checked=' + results.checked + ' fired=' + results.fired + ' errors=' + results.errors.length);
    if (results.errors.length) console.error('check-alarms errors:', results.errors);
    return { statusCode: 200, body: JSON.stringify(results) };
  } catch (err) {
    console.error('check-alarms: fatal —', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, ...results }) };
  }
};

async function sendAndMark(noteRef, note, evalResult, recipients, messaging, db, results) {
  const tokens = [];
  recipients.forEach((r) => r.tokens.forEach((t) => tokens.push(t.token)));
  if (!tokens.length) return;

  const tag = 'alarm-' + (note.authorUid ? note.authorUid + '_' + note.id : String(note.id));
  const data = { title: '⏰ Nudgy', body: note.raw || '', tag };

  console.log('check-alarms: firing ' + noteRef.path + ' -> ' + tokens.length + ' token(s), body="' + data.body + '"');

  let sendResponse = null;
  try {
    sendResponse = await messaging.sendEachForMulticast({ tokens, data });
    console.log('check-alarms: FCM result for ' + noteRef.path + ' — successCount=' + sendResponse.successCount + ' failureCount=' + sendResponse.failureCount);
    sendResponse.responses.forEach((r, i) => {
      if (!r.success) console.error('check-alarms: token #' + i + ' failed —', r.error && r.error.code, r.error && r.error.message);
    });
  } catch (err) {
    console.error('check-alarms: send threw for ' + noteRef.path + ' —', err);
    results.errors.push('send failed for ' + noteRef.path + ': ' + err.message);
  }

  const update = evalResult.clearsSnooze ? { snoozeUntil: null } : { pushedKey: evalResult.pushKey };
  try {
    await noteRef.update(update);
  } catch (err) {
    results.errors.push('mark failed for ' + noteRef.path + ': ' + err.message);
  }

  if (sendResponse) {
    const deletions = [];
    sendResponse.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
        const badToken = tokens[i];
        recipients.forEach((rec) => {
          rec.tokens.forEach((t) => {
            if (t.token === badToken) {
              deletions.push(db.collection('users').doc(rec.uid).collection('pushTokens').doc(t.id).delete().catch(() => {}));
            }
          });
        });
      }
    });
    await Promise.all(deletions);
  }
}
