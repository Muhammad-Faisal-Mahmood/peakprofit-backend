// // Libraries needed: npm install canvas
const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");
const logoPath = require("../constants/logoPath");

// --- Font Registration ---

const fontDir = path.join(__dirname, "..", "utils", "certificateFonts");

try {
  // Garamond 8pt (Closest match for body/standard text)
  registerFont(path.join(fontDir, "garamond8-regular.ttf"), {
    family: "Garamond-Display",
  });
  registerFont(path.join(fontDir, "garamond8-italic.ttf"), {
    family: "Garamond-Standard",
  });

  registerFont(path.join(fontDir, "garamond12-italic.ttf"), {
    family: "Garamond-Standard",
  });

  // Garamond 12pt (Used for bolder titles/names)
  registerFont(path.join(fontDir, "garamond12-regular.ttf"), {
    family: "Garamond-Display",
  });

  // Great Vibes (Used for the signature/date script look)
  registerFont(path.join(fontDir, "greatVibes-regular.ttf"), {
    family: "GreatVibes",
  });

  // --- NEW: TrajanPro Registration ---
  registerFont(path.join(fontDir, "TrajanPro-Regular.ttf"), {
    family: "TrajanPro",
  });
  registerFont(path.join(fontDir, "TrajanPro-Bold.otf"), {
    family: "TrajanPro",
    weight: "bold", // Explicitly define weight
  });

  registerFont(path.join(fontDir, "hvm-regular.ttf"), {
    family: "HVM-Script", // Use a distinct family name for the script font
  });

  console.log("Custom fonts successfully registered.");
} catch (error) {
  console.error("Error registering custom fonts. Check font paths:", error);
  // Fallback will use system fonts like Times New Roman/Arial
}

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

    // Title - "CERTIFICATE OF FUNDING" (Using bold TrajanPro for the classic look)
    ctx.font = "bold 64px 'TrajanPro', serif";
    ctx.fillText("CERTIFICATE OF FUNDING", width / 2, 150);

    // Subtitle - "Is hereby awarded to" (Italic - Using Garamond Standard Italic)
    // NOTE: For 'node-canvas', combining style and family often needs explicit registration, but 'italic' may work with Garamond-Standard
    ctx.font = "italic 32px 'Garamond-Standard', serif";
    ctx.fillText("Is hereby awarded to", width / 2, 220);

    // Trader Name (main focus - Using Garamond Display for bold appearance)
    ctx.font = "72px 'Garamond-Display', serif";
    ctx.fillText(formattedTraderName, width / 2, 340);

    // Underline for name
    ctx.beginPath();
    ctx.moveTo(350, 360);
    ctx.lineTo(width - 350, 360);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Description text (standard font - Using Garamond Standard)
    ctx.font = "28px 'TrajanPro', serif";
    const descLine1 = `This trader has successfully been funded with ${accountSize} after passing`;
    const descLine2 = `a ${accountSize} evaluation challenge, and we are happy for his`;
    const descLine3 = "discipline as a trader and grit";

    ctx.fillText(descLine1, width / 2, 440);
    ctx.fillText(descLine2, width / 2, 480);
    ctx.fillText(descLine3, width / 2, 520);

    // --- Footer Elements (Logo/Company Name and Date/Signature) ---

    const footerY = 600;

    // ---- LOGO and COMPANY NAME ----
    const logoX = 150;
    const logoSize = 150;
    const companyNameX = logoX + logoSize + 20;

    try {
      const logo = await loadImage(logoPath);
      ctx.drawImage(logo, logoX, footerY, logoSize, logoSize);
    } catch (logoError) {
      console.log(
        "Logo not found or failed to load. Drawing placeholder text.",
      );
      // Placeholder for logo if loading fails
      ctx.font = "bold 150px Arial";
      ctx.textAlign = "center";
      ctx.fillText("P", logoX + logoSize / 2, footerY + logoSize / 2 + 55);
      ctx.font = "16px Arial";
      ctx.fillText(
        "PEAKPROFIT FUNDING",
        logoX + logoSize / 2,
        footerY + logoSize + 20,
      );
    }

    // Company Name Text (PEAKPROFIT FUNDING)
    ctx.textAlign = "left";
    ctx.fillStyle = "#000";
    // PEAKPROFIT (Using TrajanPro Regular - sans-serif approximation)
    ctx.font = "48px 'TrajanPro', serif";
    ctx.fillText("PEAKPROFIT", companyNameX, footerY + 80);

    ctx.font = "48px 'TrajanPro', serif";
    const peakprofitWidth = ctx.measureText("PEAKPROFIT").width;
    ctx.font = "36px 'TrajanPro', serif";
    const fundingWidth = ctx.measureText("FUNDING").width;
    const fundingOffsetX = (peakprofitWidth - fundingWidth) / 2;

    ctx.fillText("FUNDING", companyNameX + fundingOffsetX, footerY + 130);

    // ---- SIGNATURE DATE and LINE ----
    ctx.textAlign = "right";
    const dateX = width - 250;
    const dateY = footerY + 50;

    // Signature Date (Using Great Vibes for script text)
    ctx.font = "italic bold 50px 'Brush Script MT', cursive, sans-serif";
    ctx.fillText("PeakProfit", dateX, dateY);

    // Signature Line
    ctx.beginPath();
    const lineLength = 300;
    ctx.moveTo(dateX - lineLength, dateY + 20);
    ctx.lineTo(dateX, dateY + 20);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();

    // Small Print Date (Below the line - Using Garamond Standard)
    ctx.font = "32px 'Garamond-Standard', serif";
    ctx.fillText(date, dateX, dateY + 70);

    // --- Save Certificate ---
    const certificatesDir = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "certificates",
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

      // --- Register Fonts for PDFKit ---
      const fontDir = path.join(__dirname, "..", "utils", "certificateFonts");
      const garamond8RegularPath = path.join(fontDir, "garamond8-regular.ttf");
      const garamond8ItalicPath = path.join(fontDir, "garamond8-italic.ttf");
      const garamond12RegularPath = path.join(
        fontDir,
        "garamond12-regular.ttf",
      );
      const greatVibesRegularPath = path.join(
        fontDir,
        "greatVibes-regular.ttf",
      );
      const trajanProRegularPath = path.join(fontDir, "TrajanPro-Regular.ttf");
      const trajanProBoldPath = path.join(fontDir, "TrajanPro-Bold.otf");

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Outer border
      doc.rect(20, 20, 1160, 860).lineWidth(8).stroke();

      // Inner border
      doc.rect(40, 40, 1120, 820).lineWidth(3).stroke();

      // Title - Use TrajanPro Bold
      doc
        .fontSize(64)
        .font(trajanProBoldPath)
        .text("CERTIFICATE OF FUNDING", 0, 130, {
          align: "center",
          width: 1200,
        });

      // Subtitle - Use Garamond 8 Italic
      doc
        .fontSize(32)
        .font(garamond8ItalicPath)
        .text("Is hereby awarded to", 0, 200, {
          align: "center",
          width: 1200,
        });

      // Trader name - Use Garamond 12 Regular
      doc.fontSize(72).font(garamond12RegularPath).text(traderName, 0, 300, {
        align: "center",
        width: 1200,
      });

      // Underline
      doc.moveTo(200, 370).lineTo(1000, 370).lineWidth(2).stroke();

      // Description - Use Garamond 8 Regular
      doc
        .fontSize(28)
        .font(garamond8RegularPath)
        .text(
          `This trader has successfully been funded with ${accountSize} after passing`,
          0,
          420,
          { align: "center", width: 1200 },
        )
        .text(
          `a ${accountSize} evaluation challenge, and we are happy for his`,
          0,
          460,
          {
            align: "center",
            width: 1200,
          },
        )
        .text("discipline as a trader and grit", 0, 500, {
          align: "center",
          width: 1200,
        });

      // Footer Position
      const footerY = 660;

      // Company name - PEAKPROFIT (Using TrajanPro Regular)
      doc
        .fontSize(48)
        .font(trajanProRegularPath)
        .text("PEAKPROFIT", 170, footerY);

      // FUNDING (Using Garamond 8 Regular, centered under PEAKPROFIT)
      // NOTE: PDFKit requires manual X-offset calculation to center 'FUNDING' under 'PEAKPROFIT'
      doc
        .fontSize(32)
        .font(garamond8RegularPath)
        .text("FUNDING", 220, footerY + 50);

      // Date (Signature Look) - Use Great Vibes
      doc
        .fontSize(50)
        .font(greatVibesRegularPath)
        .text(date, 800, footerY + 20, {
          align: "right",
          width: 350,
        });

      // Date (Small Print) - Use Garamond 8 Regular
      doc
        .fontSize(32)
        .font(garamond8RegularPath)
        .text(date, 800, footerY + 130, {
          align: "right",
          width: 350,
        });

      // Signature Line
      doc
        .moveTo(800 - 300, footerY + 90)
        .lineTo(800, footerY + 90)
        .lineWidth(1)
        .stroke();

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

//new certificate code
// const puppeteer = require("puppeteer");
// const fs = require("fs");
// const path = require("path");

// async function generateCertificate(data) {
//   const { traderName, accountSize, date, userId, type = "image" } = data;

//   console.log("trader NAme: ", traderName);
//   console.log("account size: ", accountSize);
//   console.log("date: ", date);

//   // 1. Path Setup
//   const certificatesDir = path.join(
//     __dirname,
//     "..",
//     "..",
//     "uploads",
//     "certificates",
//   );
//   if (!fs.existsSync(certificatesDir))
//     fs.mkdirSync(certificatesDir, { recursive: true });

//   const extension = type === "pdf" ? "pdf" : "jpg";
//   const filename = `certificate_${userId}_${Date.now()}.${extension}`;
//   const filepath = path.join(certificatesDir, filename);

//   // 2. Load the HTML Template
//   // Using the compliant HTML we created in the previous step
//   let html = fs.readFileSync(
//     path.join(__dirname, "mails", "FundingCertificate.html"),
//     "utf8",
//   );

//   // 3. Replace Placeholders
//   html = html
//     .replace(/{{traderName}}/g, traderName)
//     .replace(/{{accountSize}}/g, accountSize)
//     .replace(/{{issuedDate}}/g, date);

//   let browser;
//   try {
//     browser = await puppeteer.launch({
//       headless: "new",
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//     });
//     const page = await browser.newPage();

//     // Set viewport to the exact dimensions of your certificate
//     await page.setViewport({ width: 1000, height: 650, deviceScaleFactor: 2 });

//     // Set content and wait for the Chart JS/SVG to render
//     await page.setContent(html, { waitUntil: "networkidle0" });

//     if (type === "pdf") {
//       await page.pdf({
//         path: filepath,
//         width: "1000px",
//         height: "650px",
//         printBackground: true, // Crucial for gradients/colors
//         margin: { top: 0, right: 0, bottom: 0, left: 0 },
//       });
//     } else {
//       await page.screenshot({
//         path: filepath,
//         type: "jpeg",
//         quality: 95,
//         clip: { x: 0, y: 0, width: 1000, height: 650 },
//       });
//     }

//     return filepath;
//   } catch (error) {
//     console.error("Puppeteer Generation Error:", error);
//     throw error;
//   } finally {
//     if (browser) await browser.close();
//   }
// }

// module.exports = { generateCertificate };
