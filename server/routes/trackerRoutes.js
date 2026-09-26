const express = require("express");
const router = express.Router();
const pool = require("../config/mysql");

// ============================================================
// GET TRACKER DATA
// GET /api/tracker/:queueId
// ============================================================
//
// Used by the patient QR tracker.
//
// Returns:
// - queue number
// - department
// - now serving
// - people ahead
// - estimated wait from AI prediction
// - priority information
// - queue progress
//
// Priority ordering MUST match staffQueueRoutes.js:
//
//   is_priority DESC
//   queue_sequence ASC
//
// ============================================================

router.get("/:queueId", async (req, res) => {
  const { queueId } = req.params;

  if (!queueId) {
    return res.status(400).json({
      success: false,
      message: "Queue ID is required.",
    });
  }

  try {
    // ============================================================
    // 1. GET THE PATIENT'S QUEUE TICKET
    // ============================================================

    const [ticketRows] = await pool.query(
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

        p.department

      FROM queue_ticket qt

      INNER JOIN patient p
        ON qt.transaction_id = p.transaction_id

      WHERE qt.queue_id = ?

      LIMIT 1
      `,
      [queueId]
    );

    if (ticketRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Queue ticket not found.",
      });
    }

    const ticket = ticketRows[0];

    const patientIsPriority =
      Number(ticket.is_priority) === 1;

    // ============================================================
    // 2. GET CURRENTLY SERVING PATIENT
    // ============================================================

    const [servingRows] = await pool.query(
      `
      SELECT
        qt.queue_id,
        qt.queue_number,
        qt.queue_sequence,
        qt.status,
        qt.is_priority,
        qt.called_at,
        qt.service_began_at

      FROM queue_ticket qt

      WHERE qt.department_id = ?
        AND DATE(qt.issued_at) = CURDATE()
        AND qt.status IN ('called', 'serving')

      ORDER BY
        qt.called_at DESC

      LIMIT 1
      `,
      [ticket.department_id]
    );

    const nowServing =
      servingRows.length > 0
        ? servingRows[0].queue_number
        : null;

    // ============================================================
    // 3. COUNT PEOPLE AHEAD
    // ============================================================
    //
    // This uses the SAME priority ordering as
    // staffQueueRoutes.js:
    //
    // ORDER BY
    //   is_priority DESC,
    //   queue_sequence ASC
    //
    // Therefore:
    //
    // Priority patient:
    //   only earlier priority patients are ahead.
    //
    // Regular patient:
    //   all waiting priority patients are ahead,
    //   plus earlier regular patients.
    //
    // ============================================================

    const [aheadRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS people_ahead

      FROM queue_ticket qt

      WHERE qt.department_id = ?

        AND DATE(qt.issued_at) = CURDATE()

        AND qt.status IN ('waiting', 'called', 'serving')

        AND (
          qt.is_priority > ?

          OR (
            qt.is_priority = ?
            AND qt.queue_sequence < ?
          )
        )

        AND qt.queue_id <> ?
      `,
      [
        ticket.department_id,
        patientIsPriority ? 1 : 0,
        patientIsPriority ? 1 : 0,
        ticket.queue_sequence,
        ticket.queue_id,
      ]
    );

    const peopleAhead =
      Number(aheadRows[0]?.people_ahead) || 0;

    // ============================================================
    // 4. COUNT PRIORITY PATIENTS CURRENTLY WAITING
    // ============================================================
    //
    // This is included so the tracker knows how many priority
    // patients are currently affecting the queue.
    //
    // The AI prediction also has its own priority_count.
    //
    // ============================================================

    const [priorityRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS priority_count

      FROM queue_ticket qt

      WHERE qt.department_id = ?
        AND DATE(qt.issued_at) = CURDATE()
        AND qt.status IN ('waiting', 'called', 'serving')
        AND qt.is_priority = 1
      `,
      [ticket.department_id]
    );

    const currentPriorityCount =
      Number(priorityRows[0]?.priority_count) || 0;

    // ============================================================
    // 5. GET TODAY'S AI PREDICTION
    // ============================================================
    //
    // ai_queue_prediction is department/day based.
    //
    // priority_count is already considered by the AI calculation.
    //
    // We use predicted_waiting_time as the patient's current
    // estimated waiting time.
    //
    // ============================================================

    const [predictionRows] = await pool.query(
      `
      SELECT
        prediction_id,
        department_id,
        prediction_date,

        queue_length,
        priority_count,
        active_staff_count,

        avg_service_minutes,
        avg_waiting_minutes,

        predicted_waiting_time,

        generated_at,
        updated_at

      FROM ai_queue_prediction

      WHERE department_id = ?
        AND prediction_date = CURDATE()

      ORDER BY
        updated_at DESC,
        generated_at DESC

      LIMIT 1
      `,
      [ticket.department_id]
    );

    const prediction =
      predictionRows.length > 0
        ? predictionRows[0]
        : null;

    // ============================================================
    // 6. ESTIMATED WAIT
    // ============================================================

    const estimatedWaitMinutes = prediction
      ? Number(prediction.predicted_waiting_time) || 0
      : 0;

    // ============================================================
    // 7. AI PRIORITY COUNT
    // ============================================================

    const aiPriorityCount = prediction
      ? Number(prediction.priority_count) || 0
      : currentPriorityCount;

    // ============================================================
    // 8. QUEUE PROGRESS
    // ============================================================
    //
    // For now, calculate the patient's initial position using
    // all tickets that were issued before this patient's ticket
    // according to the SAME priority ordering.
    //
    // This gives us a stable starting position for the tracker.
    //
    // ============================================================

    const [initialPositionRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS initial_people_ahead

      FROM queue_ticket qt

      WHERE qt.department_id = ?

        AND DATE(qt.issued_at) = CURDATE()

        AND qt.issued_at <= ?

        AND (
          qt.is_priority > ?

          OR (
            qt.is_priority = ?
            AND qt.queue_sequence < ?
          )
        )

        AND qt.queue_id <> ?
      `,
      [
        ticket.department_id,
        ticket.issued_at,
        patientIsPriority ? 1 : 0,
        patientIsPriority ? 1 : 0,
        ticket.queue_sequence,
        ticket.queue_id,
      ]
    );

    const totalAheadAtIssue =
      Number(
        initialPositionRows[0]?.initial_people_ahead
      ) || 0;

    // How many people have moved ahead of the patient
    // since the ticket was issued.
    const servedSoFar = Math.max(
      0,
      totalAheadAtIssue - peopleAhead
    );

    const progressPct =
      totalAheadAtIssue > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (servedSoFar / totalAheadAtIssue) * 100
              )
            )
          )
        : 0;

    // ============================================================
    // 9. RETURN TRACKER DATA
    // ============================================================

    return res.json({
      success: true,

      data: {
        queueId:
          ticket.queue_id,

        queueNumber:
          ticket.queue_number,

        department:
          ticket.department,

        departmentId:
          ticket.department_id,

        queueSequence:
          Number(ticket.queue_sequence),

        status:
          ticket.status,

        isPriority:
          patientIsPriority,

        nowServing,

        peopleAhead,

        estimatedWaitMinutes,

        totalAheadAtIssue,

        progressPct,

        priorityCount:
          aiPriorityCount,

        currentPriorityCount,

        aiPrediction: prediction
          ? {
              predictionId:
                prediction.prediction_id,

              predictionDate:
                prediction.prediction_date,

              queueLength:
                Number(
                  prediction.queue_length
                ) || 0,

              priorityCount:
                Number(
                  prediction.priority_count
                ) || 0,

              activeStaffCount:
                Number(
                  prediction.active_staff_count
                ) || 0,

              avgServiceMinutes:
                Number(
                  prediction.avg_service_minutes
                ) || 0,

              avgWaitingMinutes:
                Number(
                  prediction.avg_waiting_minutes
                ) || 0,

              predictedWaitingTime:
                Number(
                  prediction.predicted_waiting_time
                ) || 0,

              generatedAt:
                prediction.generated_at,

              updatedAt:
                prediction.updated_at,
            }
          : null,
      },
    });

  } catch (error) {
    console.error(
      "GET TRACKER DATA ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve tracker data.",
      error:
        error.message,
    });
  }
});

module.exports = router;