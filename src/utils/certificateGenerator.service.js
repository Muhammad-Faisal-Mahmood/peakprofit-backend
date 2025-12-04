// Libraries needed: npm install canvas
const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");

/**
 * Generate a personalized funding certificate
 * @param {Object} data - Certificate data
 * @param {string} data.traderName - Full name of the trader
 * @param {string} data.accountSize - Account size (e.g., "$100,000")
 * @param {string} data.date - Date of funding (e.g., "December 3rd, 2025")
 * @param {string} data.userId - User ID for unique filename
 * @returns {Promise<string>} Path to generated certificate
 */

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

async function generateCertificate(data) {
  try {
    const { traderName, accountSize, date, userId } = data;
    const formattedTraderName = toTitleCase(traderName); // Title Case for better match

    // Certificate dimensions (1200x900 for good quality)
    const width = 1200;
    const height = 900;

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // --- Layout and Borders ---

    // Background - white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Outer border (black, thick)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Inner border (black, thin)
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // --- Text Content ---

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";

    // Title - "CERTIFICATE OF FUNDING" (Strong, uppercase, serif-like)
    ctx.font = "bold 64px 'Times New Roman', serif"; // Approximating the font
    ctx.fillText("CERTIFICATE OF FUNDING", width / 2, 150);

    // Subtitle - "Is hereby awarded to" (Italic, standard font)
    ctx.font = "italic 32px Arial, sans-serif";
    ctx.fillText("Is hereby awarded to", width / 2, 220);

    // Trader Name (main focus, larger, serif-like)
    ctx.font = "bold 72px 'Georgia', serif"; // Stronger serif font
    ctx.fillText(formattedTraderName, width / 2, 340);

    // Underline for name (Made slightly shorter to match image style)
    ctx.beginPath();
    ctx.moveTo(350, 360); // Start further in
    ctx.lineTo(width - 350, 360); // End further in
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Description text (Closer spacing, standard font)
    ctx.font = "28px Arial, sans-serif";
    const descLine1 = `This trader has successfully been funded with ${accountSize} after passing`;
    const descLine2 = `a ${accountSize} evaluation challenge, and we are happy for his`;
    const descLine3 = "discipline as a trader and grit";

    ctx.fillText(descLine1, width / 2, 440);
    ctx.fillText(descLine2, width / 2, 480);
    ctx.fillText(descLine3, width / 2, 520);

    // --- Footer Elements (Logo/Company Name and Date/Signature) ---

    // Adjusted Y-position for the footer elements to be lower
    const footerY = 600;

    // ---- LOGO and COMPANY NAME ----
    const logoX = 150;
    const logoSize = 150;
    const companyNameX = logoX + logoSize + 10; // Closer spacing

    try {
      // NOTE: The logo URL is hardcoded in the original and may require network access.
      const logoPath = "https://api.peakprofitfunding.com/images/logo.jpg";
      const logo = await loadImage(logoPath);
      ctx.drawImage(logo, logoX, footerY, logoSize, logoSize);
      //  - *Self-Correction: Cannot insert a logo image if the user's code relies on an external URL for a specific logo.*
    } catch (logoError) {
      console.log(
        "Logo not found or failed to load. Drawing placeholder text."
      );
      // Placeholder for logo if loading fails
      ctx.font = "bold 150px Arial";
      ctx.fillText("P", logoX + logoSize / 2, footerY + logoSize / 2 + 55);
      ctx.font = "16px Arial";
      ctx.fillText(
        "PEAKPROFIT FUNDING",
        logoX + logoSize / 2,
        footerY + logoSize + 20
      );
    }

    // Company Name Text (PEAKPROFIT FUNDING)
    ctx.textAlign = "left";
    ctx.fillStyle = "#000";
    // PEAKPROFIT
    ctx.font = "bold 48px 'Times New Roman', serif";
    ctx.fillText("PEAKPROFIT", companyNameX, footerY + 80);

    // FUNDING (Smaller and centered below PEAKPROFIT)
    ctx.font = "32px 'Times New Roman', serif";
    // Calculate an X-offset to visually center "FUNDING" under "PEAKPROFIT"
    const peakprofitWidth = ctx.measureText("PEAKPROFIT").width;
    const fundingWidth = ctx.measureText("FUNDING").width;
    const fundingOffsetX = (peakprofitWidth - fundingWidth) / 2;

    ctx.fillText("FUNDING", companyNameX + fundingOffsetX, footerY + 130);

    // ---- SIGNATURE DATE and LINE ----
    ctx.textAlign = "right";
    const dateX = width - 250;
    const dateY = footerY + 50; // Aligned with the bottom of the logo/text block

    // Signature Date (italic, script-like font approximation for the signature look)
    ctx.font = "italic bold 50px 'Brush Script MT', cursive, sans-serif";
    ctx.fillText("PeakProfit", dateX, dateY);

    // Signature Line
    ctx.beginPath();
    const lineLength = 250; // Match line length in original code
    ctx.moveTo(dateX - lineLength, dateY + 20);
    ctx.lineTo(dateX, dateY + 20);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();

    // Small Print Date (Below the line)
    ctx.font = "32px 'Times New Roman', serif"; // Slightly larger to match image
    ctx.fillText(date, dateX, dateY + 70);

    // --- Save Certificate ---
    const certificatesDir = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "certificates"
    );
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    const filename = `certificate_${userId}_${Date.now()}.jpg`;
    const filepath = path.join(certificatesDir, filename);

    // Save as JPEG (smaller file size)
    const buffer = canvas.toBuffer("image/jpeg", { quality: 0.95 });
    fs.writeFileSync(filepath, buffer);

    console.log(`Certificate generated: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error("Error generating certificate:", error);
    throw error;
  }
}

/**
 * Generate certificate as PDF (alternative approach using PDFKit)
 * Requires: npm install pdfkit
 */
async function generateCertificatePDF(data) {
  const PDFDocument = require("pdfkit");
  const { traderName, accountSize, date, userId } = data;

  return new Promise((resolve, reject) => {
    try {
      const certificatesDir = path.join(__dirname, "..", "certificates");
      if (!fs.existsSync(certificatesDir)) {
        fs.mkdirSync(certificatesDir, { recursive: true });
      }

      const filename = `certificate_${userId}_${Date.now()}.pdf`;
      const filepath = path.join(certificatesDir, filename);

      const doc = new PDFDocument({
        size: [1200, 900],
        margin: 0,
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Outer border
      doc.rect(20, 20, 1160, 860).lineWidth(8).stroke();

      // Inner border
      doc.rect(40, 40, 1120, 820).lineWidth(3).stroke();

      // Title
      doc
        .fontSize(64)
        .font("Helvetica-Bold")
        .text("CERTIFICATE OF FUNDING", 0, 130, {
          align: "center",
          width: 1200,
        });

      // Subtitle
      doc
        .fontSize(32)
        .font("Helvetica-Oblique")
        .text("Is hereby awarded to", 0, 200, {
          align: "center",
          width: 1200,
        });

      // Trader name
      doc.fontSize(72).font("Helvetica-Bold").text(traderName, 0, 300, {
        align: "center",
        width: 1200,
      });

      // Underline
      doc.moveTo(200, 370).lineTo(1000, 370).lineWidth(2).stroke();

      // Description
      doc
        .fontSize(28)
        .font("Helvetica")
        .text(
          `This trader has successfully been funded with ${accountSize} after passing`,
          0,
          420,
          { align: "center", width: 1200 }
        )
        .text(
          `a ${accountSize} evaluation challenge, and we are happy for his`,
          0,
          460,
          {
            align: "center",
            width: 1200,
          }
        )
        .text("discipline as a trader and grit", 0, 500, {
          align: "center",
          width: 1200,
        });

      // Company name
      doc.fontSize(48).font("Helvetica-Bold").text("PEAKPROFIT", 0, 660, {
        align: "center",
        width: 1200,
      });

      doc.fontSize(32).font("Helvetica").text("FUNDING", 0, 710, {
        align: "center",
        width: 1200,
      });

      // Date
      doc.fontSize(28).font("Helvetica").text(date, 800, 720, {
        align: "right",
        width: 350,
      });

      doc.end();

      stream.on("finish", () => {
        console.log(`PDF Certificate generated: ${filepath}`);
        resolve(filepath);
      });

      stream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateCertificate,
  generateCertificatePDF,
};
