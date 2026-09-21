const express = require("express");

const router = express.Router();

const {
  getPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
} = require("../services/positionService");

/*
|--------------------------------------------------------------------------
| GET ALL POSITIONS
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const positions = await getPositions();

    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    console.error(
      "GET POSITIONS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve positions.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET POSITION BY ID
|--------------------------------------------------------------------------
*/

router.get("/:positionId", async (req, res) => {
  try {
    const position =
      await getPositionById(
        req.params.positionId
      );

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found.",
      });
    }

    res.json({
      success: true,
      data: position,
    });
  } catch (error) {
    console.error(
      "GET POSITION ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve position.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE POSITION
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const position =
      await createPosition(
        req.body
      );

    res.status(201).json({
      success: true,
      message:
        "Position created successfully.",
      data: position,
    });
  } catch (error) {
    console.error(
      "CREATE POSITION ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create position.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE POSITION
|--------------------------------------------------------------------------
*/

router.put(
  "/:positionId",
  async (req, res) => {
    try {
      const position =
        await updatePosition(
          req.params.positionId,
          req.body
        );

      res.json({
        success: true,
        message:
          "Position updated successfully.",
        data: position,
      });
    } catch (error) {
      console.error(
        "UPDATE POSITION ERROR:",
        error
      );

      const status =
        error.message ===
        "Position not found."
          ? 404
          : 500;

      res.status(status).json({
        success: false,
        message:
          error.message ||
          "Failed to update position.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE POSITION
|--------------------------------------------------------------------------
*/

router.delete(
  "/:positionId",
  async (req, res) => {
    try {
      const result =
        await deletePosition(
          req.params.positionId
        );

      res.json({
        success: true,
        message:
          "Position deleted successfully.",
        data: result,
      });
    } catch (error) {
      console.error(
        "DELETE POSITION ERROR:",
        error
      );

      const status =
        error.message ===
        "Position not found."
          ? 404
          : 500;

      res.status(status).json({
        success: false,
        message:
          error.message ||
          "Failed to delete position.",
      });
    }
  }
);

module.exports = router;