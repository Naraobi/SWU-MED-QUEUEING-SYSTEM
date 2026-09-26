const pool = require("../config/mysql");
const { db } = require("../config/firebase");

const N8N_QUEUE_PREDICTION_WEBHOOK =
  process.env.N8N_QUEUE_PREDICTION_WEBHOOK ||
  "https://swu-med-n8n.onrender.com/webhook/queue-prediction";

// ============================================================
// SYNC QUEUE TICKET TO FIREBASE
// ============================================================

async function syncQueueTicketToFirebase(queueId) {
  if (!queueId) {
    throw new Error(
      "Queue ID is required for Firebase synchronization."
    );
  }

  const [rows] = await pool.query(
    `
    SELECT
      qt.queue_id,
      qt.department_id,
      qt.transaction_id,
      qt.queue_number,
      qt.queue_sequence,
      qt.issued_at,
      qt.called_at,
      qt.service_began_at,
      qt.completed_at,
      qt.status,
      qt.is_priority,

      p.patient_number,

      d.name AS department,
      d.prefix,
      d.kiosk_id

    FROM queue_ticket qt

    INNER JOIN patient p
      ON qt.transaction_id = p.transaction_id

    INNER JOIN department d
      ON qt.department_id = d.department_id

    WHERE qt.queue_id = ?

    LIMIT 1
    `,
    [queueId]
  );

  if (rows.length === 0) {
    throw new Error(
      "Queue ticket not found while synchronizing with Firebase."
    );
  }

  const queue = rows[0];

  await db
    .collection("queue_tickets")
    .doc(queue.queue_id)
    .set(
      {
        queue_id: queue.queue_id,
        department_id: queue.department_id,
        transaction_id: queue.transaction_id,
        queue_number: queue.queue_number,
        queue_sequence: Number(queue.queue_sequence),

        issued_at: queue.issued_at || null,
        called_at: queue.called_at || null,
        service_began_at: queue.service_began_at || null,
        completed_at: queue.completed_at || null,

        status: queue.status,

        is_priority: Boolean(queue.is_priority),

        patient_number: queue.patient_number,

        department: queue.department,

        prefix: queue.prefix,

        kiosk_id: queue.kiosk_id,

        firebase_synced_at: new Date(),
      },
      {
        merge: true,
      }
    );

  console.log(
    `Firebase queue sync successful: ${queue.queue_number}`
  );

  return queue;
}

// ============================================================
// TRIGGER AI QUEUE PREDICTION
// ============================================================

async function triggerQueuePrediction(eventType, queueId) {
  if (!eventType) {
    throw new Error(
      "Queue prediction event type is required."
    );
  }

  if (!queueId) {
    throw new Error(
      "Queue ID is required for queue prediction."
    );
  }

  const controller = new AbortController();

  // Prevent a slow/unavailable n8n server from blocking
  // the hospital queue operation.
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      N8N_QUEUE_PREDICTION_WEBHOOK,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          event: eventType,
          queue_id: queueId,
        }),

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `n8n webhook returned HTTP ${response.status}.`
      );
    }

    let result = null;

    try {
      result = await response.json();
    } catch {
      // n8n may return an empty or non-JSON response.
      // The webhook request itself was still successful.
    }

    console.log(
      `Queue prediction triggered successfully: ${eventType} - ${queueId}`
    );

    return {
      success: true,
      event: eventType,
      queue_id: queueId,
      result,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(
        `Queue prediction webhook timed out: ${eventType} - ${queueId}`
      );
    } else {
      console.error(
        `Queue prediction webhook failed: ${eventType} - ${queueId}`,
        error.message
      );
    }

    // IMPORTANT:
    // AI prediction failure must never break the actual
    // hospital queue operation.
    return {
      success: false,
      event: eventType,
      queue_id: queueId,
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// EXPORT SERVICES
// ============================================================

module.exports = {
  syncQueueTicketToFirebase,
  triggerQueuePrediction,
};