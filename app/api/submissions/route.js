import { NextResponse } from "next/server";
import { Submission, NotificationLog, initializeDatabase } from "@/lib/sequelize";
import { Op } from "sequelize";
import { normalizePhoneNumber } from "@/lib/phone";
import { sendInitialSubmissionNotification } from "@/lib/notify/sicuba";

// Initialize database on first request
let dbInitialized = false;
const initDB = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

export async function GET(request) {
  try {
    await initDB();

    // In a real application, you would verify admin authentication here
    // For workshop purposes, we'll skip authentication

    // Parse query parameters (search + sort) and cache-busting params
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const sort = url.searchParams.get("sort")?.trim(); // createdAt | status
    const orderParam = url.searchParams.get("order")?.trim()?.toUpperCase(); // ASC | DESC
    const queryTimestamp = url.searchParams.get("t");
    const queryRandom = url.searchParams.get("r");
    const queryForce = url.searchParams.get("force");
    const queryCacheBuster = url.searchParams.get("cb");

    // Force fresh data dengan multiple strategies
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const forceRefresh = Date.now();

    console.log(
      `[${new Date().toISOString()}] Fetching submissions with force refresh: ${timestamp}-${random}-${forceRefresh}`
    );
    console.log(
      `[${new Date().toISOString()}] Query params: t=${queryTimestamp}, r=${queryRandom}, force=${queryForce}, cb=${queryCacheBuster}`
    );

    // Build where clause for search q (by nama/email)
    const where = {};
    if (q) {
      where[Op.or] = [
        { nama: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // Build sort option
    const validSortFields = {
      createdAt: "created_at",
      status: "status",
    };
    const sortField = validSortFields[sort] || "created_at";
    const sortOrder = orderParam === "ASC" || orderParam === "DESC" ? orderParam : "DESC";

    const submissions = await Submission.findAll({
      where,
      order: [[sortField, sortOrder]],
      attributes: [
        "id",
        "tracking_code",
        "nama",
        "jenis_layanan",
        "status",
        "created_at",
        "updated_at",
      ],
      // Force fresh data
      raw: false,
      // Add random parameter to force fresh query
      logging: console.log,
    });

    console.log(
      `[${new Date().toISOString()}] Found ${submissions.length} submissions`
    );
    if (submissions.length > 0) {
      console.log(
        `[${new Date().toISOString()}] Latest submission: ${
          submissions[0].tracking_code
        } (${submissions[0].status})`
      );
    }

    // Vercel-specific no-cache headers
    const response = NextResponse.json(submissions);

    // Ultra-aggressive cache control
    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, private, max-age=0, s-maxage=0, stale-while-revalidate=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Clear-Site-Data", '"cache"');

    // Vercel-specific headers
    response.headers.set("Surrogate-Control", "no-store");
    response.headers.set("CDN-Cache-Control", "no-cache");
    response.headers.set("Vercel-CDN-Cache-Control", "no-cache");
    response.headers.set("X-Vercel-Cache", "MISS");

    // Force fresh response dengan dynamic values dan query params
    response.headers.set("Last-Modified", new Date().toUTCString());
    response.headers.set(
      "ETag",
      `"${timestamp}-${random}-${forceRefresh}-${queryTimestamp}-${queryRandom}"`
    );
    response.headers.set("X-Response-Time", `${Date.now()}`);
    response.headers.set(
      "X-Cache-Buster",
      `${timestamp}-${random}-${queryCacheBuster}`
    );
    response.headers.set("X-Force-Refresh", "true");
    response.headers.set(
      "X-Query-Params",
      `${queryTimestamp}-${queryRandom}-${queryForce}`
    );

    return response;
  } catch (error) {
    console.error("Error fetching submissions:", error);

    const errorResponse = NextResponse.json(
      { message: "Terjadi kesalahan internal server" },
      { status: 500 }
    );

    // Same headers for errors
    errorResponse.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, private"
    );
    errorResponse.headers.set("Pragma", "no-cache");
    errorResponse.headers.set("Expires", "0");
    errorResponse.headers.set("Surrogate-Control", "no-store");
    errorResponse.headers.set("CDN-Cache-Control", "no-cache");

    return errorResponse;
  }
}

export async function POST(request) {
  try {
    await initDB();

    const body = await request.json();

    // Validate required fields & email format
    const nama = (body?.nama || "").trim();
    const nik = (body?.nik || "").trim();
    const email = (body?.email || "").trim();
    const no_wa = (body?.no_wa || "").trim();
    const jenis_layanan = (body?.jenis_layanan || "").trim();
    const consent = Boolean(body?.consent);

    if (!nama || !nik || !email || !no_wa || !jenis_layanan || !consent) {
      return NextResponse.json(
        { success: false, message: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Format email tidak valid" },
        { status: 400 }
      );
    }

    // Generate tracking code
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const tracking_code = `WS-${timestamp}-${random}`;

    // Normalize phone number to +62 format
    const normalizedPhone = normalizePhoneNumber(no_wa);

    // Create submission
    const submission = await Submission.create({
      tracking_code,
      nama,
      nik,
      jenis_layanan,
      email,
      no_wa: normalizedPhone,
      consent,
      status: "PENGAJUAN_BARU",
    });

    console.log(
      `[${new Date().toISOString()}] Created submission: ${tracking_code}`
    );

    // Send initial WhatsApp notification
    try {
      const waResult = await sendInitialSubmissionNotification(submission);
      await NotificationLog.create({
        submission_id: submission.id,
        channel: "WHATSAPP",
        send_status: waResult.success ? "SUCCESS" : "FAILED",
        payload: {
          to: submission.no_wa,
          status: "PENGAJUAN_BARU",
          result: waResult,
        },
      });
      console.log(`[${new Date().toISOString()}] Initial WhatsApp notification sent:`, waResult.success ? "SUCCESS" : "FAILED");
    } catch (notificationError) {
      console.error("Error sending initial WhatsApp notification:", notificationError);
      // Don't fail the submission creation if notification fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Pengajuan berhasil dibuat",
        tracking_code: submission.tracking_code,
        submission: submission,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating submission:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
