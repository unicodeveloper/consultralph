import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { EnterpriseInquiryEmail } from "@/app/lib/email-templates/enterprise-inquiry";

const ENTERPRISE_RECIPIENTS = (process.env.ENTERPRISE_RECIPIENTS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || ENTERPRISE_RECIPIENTS.length === 0) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const body = await req.json();

    const {
      companyName,
      companySize,
      industry,
      contactName,
      contactEmail,
      jobTitle,
      useCase,
      bookedCall,
    } = body;

    // Validate required fields
    if (!companyName || !contactName || !contactEmail || !jobTitle || !useCase) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const emailHtml = EnterpriseInquiryEmail({
      companyName,
      companySize,
      industry,
      contactName,
      contactEmail,
      jobTitle,
      useCase,
      bookedCall: bookedCall || false,
    });

    await resend.emails.send({
      from: "ConsultRalph Enterprise <support@valyu.ai>",
      to: ENTERPRISE_RECIPIENTS,
      replyTo: contactEmail,
      subject: `Enterprise Inquiry from ConsultRalph - ${companyName}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: "Enterprise inquiry submitted successfully",
    });
  } catch (error) {
    console.error("[Enterprise Inquiry API] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit enterprise inquiry" },
      { status: 500 }
    );
  }
}
