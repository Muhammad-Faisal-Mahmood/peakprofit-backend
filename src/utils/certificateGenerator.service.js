// Libraries needed: npm install pdf-lib @pdf-lib/fontkit
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs");
const path = require("path");

const FONTS_DIR = path.join(__dirname, "certificateFonts");

/**
 * Convert a name to Title Case
 */
function toTitleCase(str) {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
  );
}

/**
 * Generate a personalized certificate by filling the PDF template.
 * @param {Object} data - Certificate data
 * @param {string} data.traderName     - Full name of the trader
 * @param {string} data.userId         - User ID for unique filename
 * @param {string} [data.date]         - Optional date override (already formatted string)
 * @param {string} [data.templatePath] - Optional override for template path
 * @returns {Promise<string>} Path to generated certificate PDF
 */
async function generateCertificate(data) {
  const {
    traderName,
    userId,
    date,
    templatePath = path.join(__dirname, "AccountPromotionTemplate.pdf"),
  } = data;

  const formattedName = toTitleCase(traderName);

  // Load the template PDF
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  // Register fontkit so we can embed custom TTF fonts
  pdfDoc.registerFontkit(fontkit);

  // Embed custom fonts
  const nameFont = await pdfDoc.embedFont(
    fs.readFileSync(path.join(FONTS_DIR, "eurostarBlack.ttf")),
  );
  const dateFont = await pdfDoc.embedFont(
    fs.readFileSync(path.join(FONTS_DIR, "eurostarRegular.ttf")),
  );

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // --- Trader Name ---
  // Centred inside the teal name box (right half of certificate)
  const nameFontSize = 22;
  const nameBoxCenterX = (300 + 772) / 2;
  const nameBoxCenterY = height - 275;
  const nameWidth = nameFont.widthOfTextAtSize(formattedName, nameFontSize);

  page.drawText(formattedName, {
    x: nameBoxCenterX - nameWidth / 2,
    y: nameBoxCenterY - nameFontSize / 3,
    size: nameFontSize,
    font: nameFont,
    color: rgb(1, 1, 1),
  });

  // --- Date ---
  // Centred above the "Date" label at the bottom of the certificate
  const dateFontSize = 13;
  const dateLabelMidX = 431;
  const dateY = height - 505;
  const dateWidth = dateFont.widthOfTextAtSize(date, dateFontSize);

  page.drawText(date, {
    x: dateLabelMidX - dateWidth / 2,
    y: dateY,
    size: dateFontSize,
    font: dateFont,
    color: rgb(1, 1, 1),
  });

  // --- Save ---
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

  const filename = `certificate_${userId}_${Date.now()}.pdf`;
  const filepath = path.join(certificatesDir, filename);

  fs.writeFileSync(filepath, await pdfDoc.save());

  console.log(`Certificate generated: ${filepath}`);
  return filepath;
}

async function generatePayoutCertificate(data) {
  const { traderName, payoutAmount, userId, date } = data;
  const templatePath = path.join(__dirname, "PayoutCertificateTemplate.pdf");
  const formattedName = toTitleCase(traderName);
  const formattedAmount = `$${Number(payoutAmount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Load template
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  // Embed fonts
  const nameFont = await pdfDoc.embedFont(
    fs.readFileSync(path.join(FONTS_DIR, "eurostarBlack.ttf")),
  );
  const dateFont = await pdfDoc.embedFont(
    fs.readFileSync(path.join(FONTS_DIR, "eurostarRegular.ttf")),
  );

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // Shared horizontal bounds of the right-half content area
  // (left edge ~300, right edge ~772 based on template scan)
  const contentLeft = 300;
  const contentRight = 772;
  const contentCenterX = (contentLeft + contentRight) / 2;

  // --- Payout Amount ---
  // Replaces the "your performance fee" teal text (pdfplumber top ~235–254)
  // PDF y = height - midpoint(235, 254) = height - 244.5 ≈ 351
  const amountFontSize = 40;
  const amountY = height - 310;
  const amountWidth = nameFont.widthOfTextAtSize(
    formattedAmount,
    amountFontSize,
  );

  page.drawText(formattedAmount, {
    x: contentCenterX - amountWidth / 2,
    y: amountY,
    size: amountFontSize,
    font: nameFont, // bold/black for emphasis
    color: rgb(1, 1, 1), // match the cyan/teal colour in template
  });

  // --- Trader Name ---
  // Centred inside the teal name box (pdfplumber top ~360–420, centre ~390)
  // PDF y = height - 390 ≈ 205
  const nameFontSize = 22;
  const nameBoxCenterY = height - 390;
  const nameWidth = nameFont.widthOfTextAtSize(formattedName, nameFontSize);

  page.drawText(formattedName, {
    x: contentCenterX - nameWidth / 2 + 10,
    y: nameBoxCenterY - nameFontSize / 3,
    size: nameFontSize,
    font: nameFont,
    color: rgb(1, 1, 1),
  });

  // --- Date ---
  // Centred above the "Date" label (pdfplumber top ~496)
  // PDF y = height - 490 ≈ 105  (slightly above the label)
  const dateFontSize = 13;
  // "Date" label midpoint: x0~426.8, x1~452.9 → mid ~439.8
  const dateLabelMidX = 439;
  const dateY = height - 490;
  const dateWidth = dateFont.widthOfTextAtSize(date, dateFontSize);

  page.drawText(date, {
    x: dateLabelMidX - dateWidth / 2,
    y: dateY,
    size: dateFontSize,
    font: dateFont,
    color: rgb(1, 1, 1),
  });

  // --- Save ---
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

  const filename = `payout_certificate_${userId}_${Date.now()}.pdf`;
  const filepath = path.join(certificatesDir, filename);

  fs.writeFileSync(filepath, await pdfDoc.save());

  console.log(`Payout certificate generated: ${filepath}`);
  return filepath;
}

module.exports = { generateCertificate, generatePayoutCertificate };
