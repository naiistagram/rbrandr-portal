import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: contract } = await admin
    .from("contracts")
    .select("title, file_url, signature_data, signature_name, signed_at")
    .eq("id", contractId)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!contract.signature_data) return NextResponse.json({ error: "No signature" }, { status: 400 });
  if (!contract.file_url) return NextResponse.json({ error: "No PDF" }, { status: 400 });

  const pdfRes = await fetch(contract.file_url);
  if (!pdfRes.ok) return NextResponse.json({ error: "Could not fetch PDF" }, { status: 502 });
  const pdfBytes = await pdfRes.arrayBuffer();

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // Embed signature PNG
  const base64Data = contract.signature_data.replace(/^data:image\/png;base64,/, "");
  const sigBytes = Buffer.from(base64Data, "base64");
  const sigImage = await pdfDoc.embedPng(sigBytes);
  const sigDims = sigImage.scaleToFit(160, 60);

  const sigX = width - sigDims.width - 40;
  const sigY = 60;

  lastPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigDims.width, height: sigDims.height });

  // Add "Signed" label and date below signature
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const dateStr = contract.signed_at
    ? new Date(contract.signed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  lastPage.drawText("Signed", {
    x: sigX,
    y: sigY - 14,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  if (dateStr) {
    lastPage.drawText(dateStr, {
      x: sigX,
      y: sigY - 24,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  if (contract.signature_name) {
    lastPage.drawText(contract.signature_name.toUpperCase(), {
      x: sigX,
      y: sigY - 36,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const modifiedPdf = await pdfDoc.save();
  const safeName = (contract.title ?? "contract").replace(/[^a-z0-9_-]/gi, "_");

  return new NextResponse(Buffer.from(modifiedPdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}_signed.pdf"`,
    },
  });
}
